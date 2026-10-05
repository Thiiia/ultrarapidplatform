export type NumberBondSequenceDestinationPart = "part-a" | "part-b";

export type NumberBondSequenceGem = Readonly<{
  gemId: string;
  unitIndex: number;
  spinEncounterId: string;
  dragEncounterId: string;
  destination: Readonly<{
    part: NumberBondSequenceDestinationPart;
    slotIndex: number;
  }>;
}>;

type NumberBondSequenceTarget = {
  tokenIndex: number;
  targetId?: string;
  sourceHitId?: string;
  positions?: readonly string[];
  pads?: readonly string[];
};

type NumberBondSequenceEncounter = {
  id: string;
  eventId: string;
  type: "hit" | "spin" | "drag";
  equationId?: string;
  startTick: number;
  endTick: number;
  hitBubbles?: readonly NumberBondSequenceTarget[];
  spinTargets?: readonly NumberBondSequenceTarget[];
  dragTargets?: readonly NumberBondSequenceTarget[];
};

export type NumberBondSequenceLesson = {
  activityKey: string;
  stopAtSeconds?: number;
  equations: readonly {
    id: string;
    state: string;
    tokens?: readonly { id: string; label: string }[];
  }[];
  encounters: readonly NumberBondSequenceEncounter[];
  numberBondSequenceVersion?: 1;
  numberBondGems?: readonly NumberBondSequenceGem[];
};

const SEQUENCE_VERSION = 1;
const MIN_WHOLE = 2;
const MAX_WHOLE = 20;

function fail(message: string): never {
  throw new Error(`Number Bonds sequence v1: ${message}`);
}

function isExtensionDeclared(lesson: Pick<NumberBondSequenceLesson, "numberBondSequenceVersion" | "numberBondGems">) {
  return lesson.numberBondSequenceVersion !== undefined || lesson.numberBondGems !== undefined;
}

function parseNumberBondEquation(state: string) {
  const normalized = state.trim().replace(/\s+/g, " ");
  const wholeFirst = normalized.match(/^(\d+)\s*=\s*(\d+)\s*\+\s*(\d+)$/);
  const partsFirst = normalized.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)$/);
  const match = wholeFirst ?? partsFirst;
  if (!match) fail("the equation must use supported whole = part + part notation.");

  const whole = Number(wholeFirst ? match[1] : match[3]);
  const partA = Number(wholeFirst ? match[2] : match[1]);
  const partB = Number(wholeFirst ? match[3] : match[2]);
  if (
    !Number.isSafeInteger(whole) ||
    !Number.isSafeInteger(partA) ||
    !Number.isSafeInteger(partB) ||
    whole < MIN_WHOLE ||
    whole > MAX_WHOLE ||
    partA <= 0 ||
    partB <= 0 ||
    partA + partB !== whole
  ) {
    fail(`the parts must be positive integers that sum to a whole from ${MIN_WHOLE} to ${MAX_WHOLE}.`);
  }

  return {
    whole,
    partA,
    partB,
    tokenIndexes: wholeFirst
      ? { whole: 0, partA: 2, partB: 4, labels: [`${whole}`, "=", `${partA}`, "+", `${partB}`] }
      : { whole: 4, partA: 0, partB: 2, labels: [`${partA}`, "+", `${partB}`, "=", `${whole}`] },
  };
}

/**
 * Validate the Number Bonds-only extension that links each physical unit gem
 * to its existing v3 Spin and Drag encounters. Drag.sourceHitId remains the
 * canonical v3 Hit link; the extension does not duplicate it.
 */
export function validateNumberBondSequenceV1(
  lesson: NumberBondSequenceLesson,
): readonly NumberBondSequenceGem[] | null {
  if (!isExtensionDeclared(lesson)) return null;
  if (lesson.numberBondSequenceVersion !== SEQUENCE_VERSION) {
    fail("unsupported numberBondSequenceVersion.");
  }
  if (!Array.isArray(lesson.numberBondGems)) {
    fail("numberBondGems must be an array.");
  }
  if (lesson.activityKey !== "number-bonds") {
    fail("v1 is supported only for the Number Bonds activity.");
  }
  if (lesson.equations.length !== 1) fail("exactly one authored Number Bonds equation is required.");
  if (lesson.stopAtSeconds === undefined || !Number.isFinite(lesson.stopAtSeconds)) {
    fail("stopAtSeconds is required.");
  }

  const equation = lesson.equations[0];
  const bond = parseNumberBondEquation(equation.state);
  const tokens = equation.tokens ?? [];
  const labels = tokens.map((token) => token.label.trim());
  if (
    labels.length !== 5 ||
    labels.some((label, index) => label !== bond.tokenIndexes.labels[index]) ||
    tokens.some((token) => typeof token.id !== "string" || !token.id.trim()) ||
    new Set(tokens.map((token) => token.id)).size !== tokens.length
  ) {
    fail("equation token labels and stable identities must match the authored bond.");
  }

  const gems = lesson.numberBondGems;
  if (gems.length !== bond.whole) fail(`exactly ${bond.whole} unit gems are required.`);
  if (lesson.encounters.length !== bond.whole * 3) {
    fail(`exactly ${bond.whole} Hit, ${bond.whole} Spin, and ${bond.whole} Drag encounters are required.`);
  }

  const encountersById = new Map<string, NumberBondSequenceEncounter>();
  const encountersByType = {
    hit: [] as NumberBondSequenceEncounter[],
    spin: [] as NumberBondSequenceEncounter[],
    drag: [] as NumberBondSequenceEncounter[],
  };
  for (const encounter of lesson.encounters) {
    if (encountersById.has(encounter.id)) fail(`duplicate encounter id '${encounter.id}'.`);
    if (encounter.equationId !== equation.id) fail(`encounter '${encounter.id}' uses a different equation.`);
    encountersById.set(encounter.id, encounter);
    encountersByType[encounter.type].push(encounter);
  }
  if (
    encountersByType.hit.length !== bond.whole ||
    encountersByType.spin.length !== bond.whole ||
    encountersByType.drag.length !== bond.whole
  ) {
    fail(`exactly ${bond.whole} Hit, ${bond.whole} Spin, and ${bond.whole} Drag encounters are required.`);
  }

  const gemIds = new Set<string>();
  const unitIndices = new Set<number>();
  const slotKeys = new Set<string>();
  const referencedSpins = new Set<string>();
  const referencedDrags = new Set<string>();
  const referencedHits = new Set<string>();
  const journeys: Array<{
    unitIndex: number;
    hit: NumberBondSequenceEncounter;
    spin: NumberBondSequenceEncounter;
    drag: NumberBondSequenceEncounter;
  }> = [];

  for (const gem of gems) {
    if (!gem.gemId.trim() || gemIds.has(gem.gemId)) fail("gemId values must be non-empty and unique.");
    gemIds.add(gem.gemId);
    if (!Number.isSafeInteger(gem.unitIndex) || gem.unitIndex < 0 || gem.unitIndex >= bond.whole || unitIndices.has(gem.unitIndex)) {
      fail(`unitIndex values must uniquely cover units 0 through ${bond.whole - 1}.`);
    }
    unitIndices.add(gem.unitIndex);

    const spin = encountersById.get(gem.spinEncounterId);
    const drag = encountersById.get(gem.dragEncounterId);
    if (!spin || spin.type !== "spin") fail(`gem '${gem.gemId}' references a missing Spin encounter.`);
    if (!drag || drag.type !== "drag") fail(`gem '${gem.gemId}' references a missing Drag encounter.`);
    if (referencedSpins.has(spin.id) || referencedDrags.has(drag.id)) {
      fail("each Spin and Drag encounter must belong to exactly one gem.");
    }
    referencedSpins.add(spin.id);
    referencedDrags.add(drag.id);

    const inPartA = gem.unitIndex < bond.partA;
    const expectedPart: NumberBondSequenceDestinationPart = inPartA ? "part-a" : "part-b";
    const expectedSlot = inPartA ? gem.unitIndex : gem.unitIndex - bond.partA;
    const expectedTokenIndex = inPartA ? bond.tokenIndexes.partA : bond.tokenIndexes.partB;
    const expectedTokenId = tokens[expectedTokenIndex].id;
    if (gem.destination.part !== expectedPart || gem.destination.slotIndex !== expectedSlot) {
      fail(`gem '${gem.gemId}' has an invalid destination part or slot.`);
    }
    const slotKey = `${gem.destination.part}:${gem.destination.slotIndex}`;
    if (slotKeys.has(slotKey)) fail(`destination slot '${slotKey}' is assigned more than once.`);
    slotKeys.add(slotKey);

    const dragTarget = drag.dragTargets?.[0];
    const sourceHitId = dragTarget?.sourceHitId;
    const hitTarget = sourceHitId ? encountersById.get(sourceHitId) : undefined;
    if (!hitTarget || hitTarget.type !== "hit") fail(`gem '${gem.gemId}' Drag must link to its Hit through sourceHitId.`);
    if (hitTarget.equationId !== equation.id || hitTarget.endTick >= spin.startTick || spin.endTick >= drag.startTick) {
      fail(`gem '${gem.gemId}' Hit, Spin, and Drag timing is out of order.`);
    }
    const hitBubbles = hitTarget.hitBubbles ?? [];
    if (
      hitBubbles.length !== 1 ||
      hitBubbles[0].tokenIndex !== bond.tokenIndexes.whole ||
      hitBubbles[0].targetId !== tokens[bond.tokenIndexes.whole].id
    ) {
      fail(`gem '${gem.gemId}' Hit must target the whole token.`);
    }
    const hitPads = new Set([
      ...(hitBubbles[0].pads ?? []),
      ...(hitBubbles[0].positions ?? []),
    ]);
    if (hitPads.size !== 1) fail(`gem '${gem.gemId}' Hit must select exactly one pad.`);

    const spinTargets = spin.spinTargets ?? [];
    if (
      spinTargets.length !== 1 ||
      spinTargets[0].tokenIndex !== bond.tokenIndexes.whole ||
      spinTargets[0].targetId !== tokens[bond.tokenIndexes.whole].id
    ) {
      fail(`gem '${gem.gemId}' Spin must target the whole token.`);
    }

    const dragTargets = drag.dragTargets ?? [];
    if (
      dragTargets.length !== 1 ||
      dragTargets[0].tokenIndex !== expectedTokenIndex ||
      dragTargets[0].targetId !== expectedTokenId ||
      dragTargets[0].sourceHitId !== hitTarget.id
    ) {
      fail(`gem '${gem.gemId}' Drag must target its part and link to its Hit.`);
    }
    if (hitTarget.endTick >= spin.startTick || spin.endTick >= drag.startTick) {
      fail(`gem '${gem.gemId}' must complete Hit, then Spin, then Drag.`);
    }
    referencedHits.add(hitTarget.id);
    journeys.push({ unitIndex: gem.unitIndex, hit: hitTarget, spin, drag });
  }

  if (unitIndices.size !== bond.whole || Array.from({ length: bond.whole }, (_, index) => index).some((index) => !unitIndices.has(index))) {
    fail(`unitIndex values must uniquely cover units 0 through ${bond.whole - 1}.`);
  }
  if (
    referencedHits.size !== bond.whole ||
    referencedSpins.size !== bond.whole ||
    referencedDrags.size !== bond.whole ||
    encountersByType.spin.some((encounter) => !referencedSpins.has(encounter.id)) ||
    encountersByType.drag.some((encounter) => !referencedDrags.has(encounter.id)) ||
    encountersByType.hit.some((encounter) => !referencedHits.has(encounter.id))
  ) {
    fail("every Hit, Spin, and Drag must belong to exactly one gem.");
  }
  journeys.sort((left, right) => left.unitIndex - right.unitIndex);
  for (let index = 1; index < journeys.length; index += 1) {
    if (journeys[index - 1].drag.endTick >= journeys[index].hit.startTick) {
      fail(`each gem must finish its Drag before the next unit Hit begins (unit ${index + 1}).`);
    }
  }

  return gems;
}
