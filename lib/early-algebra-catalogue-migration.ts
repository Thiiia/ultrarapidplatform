import {
  AUTHORED_HIT_MISS_WINDOW_SECONDS,
  AUTHORED_PRESENTATION_LEAD_SECONDS,
  isAuthoredEquationOperator,
  parseAuthoredLessonDraft,
  tokenizeAuthoredEquationState,
  type AuthoredLessonDraft,
  type AuthoredLessonEncounter,
  type AuthoredLessonEquation,
} from "./authored-lesson";
import {
  PLAYER_HEX_AUTHORED_HIT_PADS,
  PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
  resolveAuthoredHitPadTarget,
} from "./authored-hit-pad-layout";
import { musicalAnchorTicks } from "./authored-lesson-retiming";
import { createLessonClock } from "./editor/lesson-timing";
import { repairLegacyMigratedAuthoredLesson } from "./legacy-authored-migration";

type AlgebraEquationTemplate = { state: string; operationTargets: readonly string[] };

const oneStepTemplates: readonly AlgebraEquationTemplate[] = [
  { state: "x + 2 = 7", operationTargets: ["2"] },
  { state: "x + 3 = 11", operationTargets: ["3"] },
  { state: "x + 4 = 9", operationTargets: ["4"] },
  { state: "x + 5 = 12", operationTargets: ["5"] },
  { state: "x + 6 = 12", operationTargets: ["6"] },
  { state: "x - 1 = 7", operationTargets: ["1"] },
  { state: "x - 2 = 6", operationTargets: ["2"] },
  { state: "x - 2 = 5", operationTargets: ["2"] },
  { state: "x - 3 = 4", operationTargets: ["3"] },
  { state: "x - 4 = 4", operationTargets: ["4"] },
  { state: "2x = 8", operationTargets: ["2x"] },
  { state: "2x = 10", operationTargets: ["2x"] },
  { state: "2x = 12", operationTargets: ["2x"] },
  { state: "3x = 9", operationTargets: ["3x"] },
  { state: "3x = 12", operationTargets: ["3x"] },
  { state: "4x = 12", operationTargets: ["4x"] },
];

const twoStepTemplates: readonly AlgebraEquationTemplate[] = [
  { state: "2x + 1 = 9", operationTargets: ["1", "2x"] },
  { state: "2x + 2 = 10", operationTargets: ["2", "2x"] },
  { state: "2x + 3 = 11", operationTargets: ["3", "2x"] },
  { state: "2x + 4 = 12", operationTargets: ["4", "2x"] },
  { state: "2x - 2 = 6", operationTargets: ["2", "2x"] },
  { state: "3x + 1 = 10", operationTargets: ["1", "3x"] },
  { state: "3x + 2 = 11", operationTargets: ["2", "3x"] },
  { state: "3x + 3 = 12", operationTargets: ["3", "3x"] },
  { state: "3x - 3 = 9", operationTargets: ["3", "3x"] },
  { state: "4x + 1 = 9", operationTargets: ["1", "4x"] },
  { state: "4x + 2 = 10", operationTargets: ["2", "4x"] },
  { state: "4x - 4 = 8", operationTargets: ["4", "4x"] },
];

const threeStepTemplates: readonly AlgebraEquationTemplate[] = [
  { state: "2x + 1 + 2 = 11", operationTargets: ["1", "2", "2x"] },
  { state: "3x + 1 + 2 = 12", operationTargets: ["1", "2", "3x"] },
  { state: "2x + 2 + 3 = 11", operationTargets: ["2", "3", "2x"] },
  { state: "3x + 1 + 4 = 11", operationTargets: ["1", "4", "3x"] },
  { state: "4x + 1 + 2 = 11", operationTargets: ["1", "2", "4x"] },
  { state: "2x + 1 + 3 = 12", operationTargets: ["1", "3", "2x"] },
  { state: "x + 2 + 3 = 10", operationTargets: ["2", "3", "x"] },
  { state: "3x + 2 + 3 = 11", operationTargets: ["2", "3", "3x"] },
  { state: "4x + 1 + 3 = 12", operationTargets: ["1", "3", "4x"] },
  { state: "2x + 4 + 1 = 11", operationTargets: ["4", "1", "2x"] },
];

// Match the authored Drag count to a clear learning profile: one-step
// additive/multiplicative examples, two-step inverses, then a short three-step
// stretch. Keep the unknown on one side and isolate small addends in sequence,
// so early learners can apply the balance rule before the later
// variable-on-both-sides skill.
const foundation = [
  ...oneStepTemplates.slice(0, 8).map(({ state }) => state),
  ...twoStepTemplates.slice(0, 10).map(({ state }) => state),
];
const intermediate = twoStepTemplates.map(({ state }) => state);
const advanced = threeStepTemplates.map(({ state }) => state);
const gardenProgression = [
  ...oneStepTemplates.slice(0, 4).map(({ state }) => state),
  ...twoStepTemplates.slice(0, 4).map(({ state }) => state),
  ...threeStepTemplates.slice(0, 2).map(({ state }) => state),
];

const catalogue: Record<string, { states: readonly string[]; offset: number; dualPadFromEquation: number }> = {
  garden: { states: gardenProgression, offset: 0, dualPadFromEquation: 0 },
  geminiqueen: { states: foundation, offset: 0, dualPadFromEquation: 2 },
  grudge: { states: intermediate, offset: 0, dualPadFromEquation: 1 },
  jazzmaybach: { states: foundation.slice(0, 2), offset: 0, dualPadFromEquation: 1 },
  justbecause: { states: intermediate, offset: 2, dualPadFromEquation: 1 },
  oneone: { states: intermediate, offset: 4, dualPadFromEquation: 1 },
  seven: { states: foundation, offset: 5, dualPadFromEquation: 2 },
  waves: { states: foundation, offset: 0, dualPadFromEquation: 2 },
};

type Clock = ReturnType<typeof createLessonClock>;

function equationTokens(equation: AuthoredLessonEquation) {
  return equation.tokens ?? tokenizeAuthoredEquationState(equation.state)
    .map((label, index) => ({ id: `${equation.id}-token-${index}`, label }));
}

function playableIndexes(equation: AuthoredLessonEquation) {
  return equationTokens(equation).flatMap((token, index) =>
    isAuthoredEquationOperator(token.label) ? [] : [index]);
}

/** Replace equation content while keeping the authored chart and encounter schedule intact. */
export function refreshEarlyAlgebraEquationContent(input: {
  songAssetId: string;
  sidecar: string;
}) {
  const source = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(JSON.parse(input.sidecar)));
  if (source.activityKey !== "early-algebra" || source.songAssetId !== input.songAssetId) {
    throw new Error(`Catalogue identity mismatch for '${input.songAssetId}'`);
  }

  const dragTargetCounts = new Map<string, number>();
  for (const encounter of source.encounters) {
    if (encounter.type !== "drag") continue;
    const targetCount = encounter.dragTargets?.length ?? 0;
    if (targetCount === 0) throw new Error(`Drag encounter '${encounter.id}' has no authored target`);
    const equationId = encounter.equationId ?? "";
    dragTargetCounts.set(equationId, (dragTargetCounts.get(equationId) ?? 0) + targetCount);
  }

  const templateUse = { oneStep: 0, twoStep: 0, threeStep: 0 };
  const plans = new Map<string, {
    equation: AuthoredLessonEquation;
    operationTargetIndexes: number[];
    playableTokenIndexes: number[];
  }>();
  const equations = source.equations.map((equation) => {
    const dragCount = dragTargetCounts.get(equation.id) ?? 0;
    if (dragCount > 3) {
      throw new Error(`Equation '${equation.id}' has ${dragCount} Drag targets; the early-algebra ladder supports at most three steps`);
    }
    const profile = dragCount <= 1 ? "oneStep" : dragCount === 2 ? "twoStep" : "threeStep";
    const candidates = profile === "oneStep"
      ? oneStepTemplates
      : profile === "twoStep" ? twoStepTemplates : threeStepTemplates;
    const offset = [...input.songAssetId].reduce((total, character) => total + character.charCodeAt(0), 0);
    // Rotate songs only within the easiest four examples of each profile.
    // The old full-list rotation could start a learner on multiplication or a
    // later coefficient before the additive foundation had appeared.
    const startingOffset = offset % Math.min(4, candidates.length);
    const candidateIndex = (templateUse[profile]++ + startingOffset) % candidates.length;
    const template = candidates[candidateIndex];
    const tokens = tokenizeAuthoredEquationState(template.state).map((label, tokenIndex) => ({
      id: `${equation.id}-math-refresh-token-${tokenIndex}`,
      label,
    }));
    const operationTargetIndexes = template.operationTargets.map((label) => {
      const index = tokens.findIndex((token) => token.label === label);
      if (index < 0 || isAuthoredEquationOperator(label)) {
        throw new Error(`Math template '${template.state}' has an invalid operation target '${label}'`);
      }
      return index;
    });
    const refreshed = { id: equation.id, state: template.state, tokens };
    plans.set(equation.id, {
      equation: refreshed,
      operationTargetIndexes,
      playableTokenIndexes: playableIndexes(refreshed),
    });
    return refreshed;
  });

  const dragProgress = new Map<string, number>();
  const hitProgress = new Map<string, number>();
  const refreshedById = new Map<string, AuthoredLessonEncounter>();
  const orderedEncounters = [...source.encounters].sort((left, right) =>
    left.startTick - right.startTick || left.id.localeCompare(right.id));
  for (const encounter of orderedEncounters) {
    const equationId = encounter.equationId ?? "";
    const plan = plans.get(equationId);
    if (!plan) throw new Error(`Encounter '${encounter.id}' has no Early Algebra equation`);
    const tokens = equationTokens(plan.equation);
    const targetAt = (index: number) => ({ tokenIndex: index, targetId: tokens[index].id });
    if (encounter.type === "hit") {
      const nextHit = hitProgress.get(equationId) ?? 0;
      const hitBubbles = (encounter.hitBubbles ?? []).map((bubble, bubbleIndex) => {
        const playableIndex = plan.playableTokenIndexes[(nextHit + bubbleIndex) % plan.playableTokenIndexes.length];
        return { ...bubble, ...targetAt(playableIndex) };
      });
      hitProgress.set(equationId, nextHit + hitBubbles.length);
      refreshedById.set(encounter.id, { ...encounter, hitBubbles });
      continue;
    }
    if (encounter.type === "spin") {
      const pendingStep = dragProgress.get(equationId) ?? 0;
      const spinTargets = (encounter.spinTargets ?? []).map((target, index) => ({
        ...target,
        ...targetAt(plan.operationTargetIndexes[Math.min(pendingStep + index, plan.operationTargetIndexes.length - 1)]),
      }));
      if (spinTargets.length === 0) throw new Error(`Spin encounter '${encounter.id}' has no authored target`);
      refreshedById.set(encounter.id, { ...encounter, spinTargets });
      continue;
    }
    const nextStep = dragProgress.get(equationId) ?? 0;
    const dragTargets = (encounter.dragTargets ?? []).map((target, index) => ({
      ...target,
      ...targetAt(plan.operationTargetIndexes[Math.min(nextStep + index, plan.operationTargetIndexes.length - 1)]),
    }));
    dragProgress.set(equationId, nextStep + dragTargets.length);
    refreshedById.set(encounter.id, { ...encounter, dragTargets });
  }

  const encounters = source.encounters.map((encounter) => {
    const refreshed = refreshedById.get(encounter.id);
    if (!refreshed) throw new Error(`Encounter '${encounter.id}' was not refreshed`);
    return refreshed;
  });
  return parseAuthoredLessonDraft({ ...source, equations, encounters });
}

function targetFor(equation: AuthoredLessonEquation, kind: "hit" | "spin" | "drag", occurrence: number) {
  const tokens = equationTokens(equation);
  const playable = playableIndexes(equation);
  const equalsIndex = tokens.findIndex((token) => token.label === "=");
  const left = playable.filter((index) => index < equalsIndex);
  const right = playable.filter((index) => index > equalsIndex);
  const priority = kind === "spin"
    ? [left[0], left[1], right[0]]
    : kind === "drag"
      ? [left[1], right[0], left[0]]
      : [left[1], left[0], right.at(-1), ...playable];
  const candidates = [...new Set(priority.filter((index): index is number => index != null))];
  const tokenIndex = candidates[kind === "hit" ? occurrence % candidates.length : 0];
  if (tokenIndex == null) throw new Error(`Equation '${equation.id}' has no playable token`);
  return { tokenIndex, targetId: tokens[tokenIndex].id };
}

function releaseSeconds(encounter: AuthoredLessonEncounter, clock: Clock) {
  return encounter.type === "hit"
    ? clock.toSeconds(encounter.startTick) + AUTHORED_HIT_MISS_WINDOW_SECONDS
    : clock.toSeconds(encounter.endTick);
}

export function migrateEarlyAlgebraCatalogueSong(input: {
  songAssetId: string;
  chart: string;
  sidecar: string;
}) {
  const specification = catalogue[input.songAssetId];
  if (!specification) throw new Error(`Unknown Early Algebra catalogue song '${input.songAssetId}'`);
  const source = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(JSON.parse(input.sidecar)));
  if (source.activityKey !== "early-algebra" || source.songAssetId !== input.songAssetId) {
    throw new Error(`Catalogue identity mismatch for '${input.songAssetId}'`);
  }
  if (source.encounters.some((encounter) => encounter.id.includes("-rhythm-hit-"))) {
    throw new Error(`'${input.songAssetId}' has already been migrated to the rhythm-hit catalogue`);
  }
  if (source.equations.length > specification.states.length) {
    throw new Error(`No authored equation for all ${source.equations.length} '${input.songAssetId}' equations`);
  }
  const equations = source.equations.map((equation, index) => {
    const state = specification.states[(index + specification.offset) % specification.states.length];
    return {
      id: equation.id,
      state,
      tokens: tokenizeAuthoredEquationState(state).map((label, tokenIndex) => ({
        id: `${equation.id}-v2-token-${tokenIndex}`, label,
      })),
    };
  });
  const equationById = new Map(equations.map((equation) => [equation.id, equation]));
  const equationOrder = new Map(equations.map((equation, index) => [equation.id, index]));
  const clock = createLessonClock(input.chart);
  const { ticks: anchors } = musicalAnchorTicks(input.chart);
  let hitOrdinal = 0;
  const occurrences = new Map<string, number>();
  const nextHitTarget = (equation: AuthoredLessonEquation) => {
    const occurrence = occurrences.get(equation.id) ?? 0;
    occurrences.set(equation.id, occurrence + 1);
    return targetFor(equation, "hit", occurrence);
  };
  const padFor = (ordinal: number) => PLAYER_HEX_AUTHORED_HIT_PADS[ordinal % PLAYER_HEX_AUTHORED_HIT_PADS.length].pad;
  const padsFor = (equation: AuthoredLessonEquation, ordinal: number, featured: boolean) => {
    const twoPads = (equationOrder.get(equation.id) ?? 0) >= specification.dualPadFromEquation &&
      (featured || ordinal % 3 === 0);
    return twoPads ? [padFor(ordinal), padFor(ordinal + 2)] : [padFor(ordinal)];
  };
  const encounters = source.encounters.map((encounter) => {
    const equation = equationById.get(encounter.equationId ?? "");
    if (!equation) throw new Error(`Missing equation for '${encounter.id}'`);
    if (encounter.type === "hit") {
      const originalSlot = resolveAuthoredHitPadTarget(encounter.hitBubbles?.[0] ?? {})[0];
      const padOrdinal = originalSlot == null ? hitOrdinal : originalSlot;
      const pads = padsFor(equation, padOrdinal, true);
      const target = nextHitTarget(equation);
      hitOrdinal += 1;
      return { ...encounter, hitBubbles: [{
        ...target, padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
        pads, positions: pads,
      }] };
    }
    const startSeconds = clock.toSeconds(encounter.startTick);
    const originalEndSeconds = clock.toSeconds(encounter.endTick);
    // Long legacy holds occupied whole musical phrases. Four seconds gives
    // the learner time to act while freeing the later rhythm notes for Hits.
    const endTick = originalEndSeconds - startSeconds > 4.25
      ? Math.max(encounter.startTick + 1, clock.toTick(startSeconds + 4))
      : encounter.endTick;
    if (encounter.type === "spin") {
      return { ...encounter, endTick, spinTargets: [targetFor(equation, "spin", 0)] };
    }
    return { ...encounter, endTick, dragTargets: [{
      ...targetFor(equation, "drag", 0),
      ...(encounter.dragTargets?.[0]?.sourceHitId
        ? { sourceHitId: encounter.dragTargets[0].sourceHitId } : {}),
    }] };
  }).sort((left, right) => left.startTick - right.startTick || left.id.localeCompare(right.id));

  const added: AuthoredLessonEncounter[] = [];
  let addedOrdinal = 0;
  for (const [index, previous] of encounters.entries()) {
    const next = encounters[index + 1];
    if (next?.type === "drag" && next.dragTargets?.[0]?.sourceHitId === previous.id) continue;
    const earliest = releaseSeconds(previous, clock) + AUTHORED_PRESENTATION_LEAD_SECONDS + 0.01;
    const latest = next
      ? clock.toSeconds(next.startTick) - AUTHORED_HIT_MISS_WINDOW_SECONDS - AUTHORED_PRESENTATION_LEAD_SECONDS - 0.01
      : Math.min(
        source.stopAtSeconds == null ? Number.POSITIVE_INFINITY : source.stopAtSeconds - AUTHORED_HIT_MISS_WINDOW_SECONDS,
        releaseSeconds(previous, clock) + 7,
      );
    let lastSelected = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (const tick of anchors) {
      const seconds = clock.toSeconds(tick);
      if (seconds < Math.max(6, earliest) || seconds > latest) continue;
      if (seconds < lastSelected + AUTHORED_HIT_MISS_WINDOW_SECONDS + AUTHORED_PRESENTATION_LEAD_SECONDS + 0.15) continue;
      if (count >= 4) break;
      const equation = equationById.get(previous.equationId ?? "")!;
      const pads = padsFor(equation, hitOrdinal++, false);
      const id = `${previous.id}-rhythm-hit-${++addedOrdinal}`;
      added.push({
        id, eventId: `${previous.eventId}-rhythm-${tick}`, type: "hit",
        equationId: equation.id, startTick: tick, endTick: tick,
        hitBubbles: [{ ...nextHitTarget(equation),
          padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
          pads, positions: pads }],
      });
      lastSelected = seconds;
      count += 1;
    }
  }
  const ordered = [...encounters, ...added].sort((left, right) =>
    left.startTick - right.startTick || left.id.localeCompare(right.id));
  const lastRelease = Math.max(...ordered.map((encounter) => releaseSeconds(encounter, clock)));
  const stopAtSeconds = source.stopAtSeconds == null
    ? undefined : Math.max(source.stopAtSeconds, Number((lastRelease + 0.5).toFixed(3)));
  const draft: AuthoredLessonDraft = {
    ...source, equations, encounters: ordered,
    ...(stopAtSeconds == null ? {} : { stopAtSeconds }),
  };
  return parseAuthoredLessonDraft(draft);
}

/** Upgrade an already rhythm-migrated catalogue without changing its equations or cue timing. */
export function upgradeEarlyAlgebraCatalogueHitPads(input: { songAssetId: string; sidecar: string }) {
  const specification = catalogue[input.songAssetId];
  if (!specification) throw new Error(`Unknown Early Algebra catalogue song '${input.songAssetId}'`);
  const source = parseAuthoredLessonDraft(JSON.parse(input.sidecar));
  if (source.activityKey !== "early-algebra" || source.songAssetId !== input.songAssetId) {
    throw new Error(`Catalogue identity mismatch for '${input.songAssetId}'`);
  }
  if (!source.encounters.some((encounter) => encounter.id.includes("-rhythm-hit-"))) {
    throw new Error(`'${input.songAssetId}' needs the rhythm-hit migration first`);
  }
  const equationOrder = new Map(source.equations.map((equation, index) => [equation.id, index]));
  let hitOrdinal = 0;
  let upgraded = 0;
  const encounters = source.encounters.map((encounter) => {
    if (encounter.type !== "hit") return encounter;
    const ordinal = hitOrdinal++;
    const equationIndex = equationOrder.get(encounter.equationId ?? "");
    if (equationIndex === undefined) throw new Error(`Missing equation for '${encounter.id}'`);
    const featured = !encounter.id.includes("-rhythm-hit-");
    if (equationIndex < specification.dualPadFromEquation || (!featured && ordinal % 3 !== 0)) return encounter;
    if (encounter.hitBubbles?.length !== 1 || encounter.hitBubbles[0].padLayoutVersion !== PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION) {
      throw new Error(`'${encounter.id}' needs one player-hex hit bubble before pad upgrade`);
    }
    const bubble = encounter.hitBubbles[0];
    const slots = resolveAuthoredHitPadTarget(bubble);
    if (slots.length === 2) return encounter;
    if (slots.length !== 1) throw new Error(`'${encounter.id}' needs one existing pad before pad upgrade`);
    const first = PLAYER_HEX_AUTHORED_HIT_PADS[slots[0]].pad;
    const second = PLAYER_HEX_AUTHORED_HIT_PADS[(slots[0] + 2) % PLAYER_HEX_AUTHORED_HIT_PADS.length].pad;
    upgraded += 1;
    return { ...encounter, hitBubbles: [{ ...bubble, pads: [first, second], positions: [first, second] }] };
  });
  if (upgraded === 0) throw new Error(`'${input.songAssetId}' already has its two-pad progression`);
  return parseAuthoredLessonDraft({ ...source, encounters });
}
