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

function oneStepTemplateForOccurrence(
  occurrence: number,
  songOffset: number,
  usedStates: Set<string>,
  totalSteps: number,
) {
  // Keep this early-algebra bridge to one inverse addition/subtraction per row.
  // Multiplicative equations need their own progression after learners secure
  // the balance and inverse-operation ideas used here.
  const additiveCount = Math.ceil(totalSteps / 2);
  const subtractiveCount = totalSteps - additiveCount;
  const families = [
    { name: "additive", templates: refreshedAdditionTemplates, count: additiveCount },
    { name: "subtractive", templates: refreshedSubtractionTemplates, count: subtractiveCount },
  ];
  let precedingCount = 0;
  const family = families.find(({ count }) => {
    const containsOccurrence = occurrence < precedingCount + count;
    precedingCount += count;
    return containsOccurrence;
  });
  if (!family || family.templates.length === 0) {
    throw new Error(`No Early Algebra one-step family is available for row ${occurrence + 1}`);
  }
  const familyOccurrence = occurrence - (precedingCount - family.count);
  const candidates = orderOneStepVariantsBySolution(family.templates, songOffset, family.count);
  return firstUnusedTemplate(candidates, familyOccurrence, usedStates, `${family.name} one-step`);
}

function orderOneStepVariantsBySolution(
  templates: readonly AlgebraEquationTemplate[],
  songOffset: number,
  requestedCount: number,
) {
  const variantsBySolution = new Map<number, AlgebraEquationTemplate[]>();
  for (const template of templates) {
    const addition = template.state.match(/^x \+ (\d+) = (\d+)$/);
    const subtraction = template.state.match(/^x - (\d+) = (\d+)$/);
    if (!addition && !subtraction) {
      throw new Error(`Early Algebra one-step template '${template.state}' is not a supported equation`);
    }
    const solution = addition
      ? Number(addition[2]) - Number(addition[1])
      : Number(subtraction![1]) + Number(subtraction![2]);
    if (!Number.isSafeInteger(solution) || solution <= 0 || solution > 10) {
      throw new Error(`Early Algebra one-step template '${template.state}' has an out-of-range solution`);
    }
    const variants = variantsBySolution.get(solution) ?? [];
    variants.push(template);
    variantsBySolution.set(solution, variants);
  }

  // Spread rows across the answer tiers from easiest to hardest. This gives
  // short songs a useful range instead of repeating one answer, while the
  // offset varies operands within each tier without raising the entry point.
  const ordered: AlgebraEquationTemplate[] = [];
  const tiers = [...variantsBySolution.entries()].sort(([left], [right]) => left - right);
  const availableTemplates = tiers.reduce((total, [, variants]) => total + variants.length, 0);
  if (requestedCount > availableTemplates) {
    throw new Error(`Not enough Early Algebra templates for ${requestedCount} one-step rows`);
  }
  const selectedPerTier = tiers.map(() => 0);
  let remaining = requestedCount;
  while (remaining > 0) {
    let allocatedThisRound = 0;
    for (let tierIndex = 0; tierIndex < tiers.length && remaining > 0; tierIndex += 1) {
      if (selectedPerTier[tierIndex] >= tiers[tierIndex][1].length) continue;
      selectedPerTier[tierIndex] += 1;
      remaining -= 1;
      allocatedThisRound += 1;
    }
    if (allocatedThisRound === 0) {
      throw new Error(`Not enough Early Algebra templates for ${requestedCount} one-step rows`);
    }
  }

  const selectTier = (tierIndex: number, previousTarget: string | undefined): boolean => {
    if (tierIndex >= tiers.length) return true;
    const [, variants] = tiers[tierIndex];
    const selectedCount = selectedPerTier[tierIndex];
    if (selectedCount === 0) return selectTier(tierIndex + 1, previousTarget);

    const offset = songOffset % variants.length;
    const candidates = [...variants.slice(offset), ...variants.slice(0, offset)];
    const chosenIndexes = new Set<number>();
    const chooseWithinTier = (remaining: number, lastTarget: string | undefined): boolean => {
      if (remaining === 0) return selectTier(tierIndex + 1, lastTarget);
      for (const [variantIndex, candidate] of candidates.entries()) {
        const target = candidate.operationTargets[0];
        if (chosenIndexes.has(variantIndex) || target === lastTarget) continue;
        chosenIndexes.add(variantIndex);
        ordered.push(candidate);
        if (chooseWithinTier(remaining - 1, target)) return true;
        ordered.pop();
        chosenIndexes.delete(variantIndex);
      }
      return false;
    };

    return chooseWithinTier(selectedCount, previousTarget);
  };

  // Backtrack across answer tiers when a tier has only one available operand.
  // This keeps adjacent rows varied even when a final singleton would otherwise
  // repeat the preceding operand (for example, Waves' largest subtraction).
  if (!selectTier(0, undefined)) {
    throw new Error(`Could not order ${requestedCount} distinct Early Algebra equation variants`);
  }
  return ordered;
}

// Keep numbers within 10 for the upper-primary entry point, while varying the
// examples by song without introducing multi-step or coefficient notation.
const refreshedAdditionTemplates: readonly AlgebraEquationTemplate[] = Array.from(
  { length: 9 },
  (_, index) => index + 1,
).flatMap((solution) => Array.from(
  { length: 10 - solution },
  (_, index) => {
    const addend = index + 1;
    return { state: `x + ${addend} = ${addend + solution}`, operationTargets: [String(addend)] };
  },
));
const refreshedSubtractionTemplates: readonly AlgebraEquationTemplate[] = Array.from(
  { length: 9 },
  (_, index) => index + 2,
).flatMap((solution) => Array.from(
  { length: solution - 1 },
  (_, index) => {
    const subtrahend = index + 1;
    const difference = solution - subtrahend;
    return { state: `x - ${subtrahend} = ${difference}`, operationTargets: [String(subtrahend)] };
  },
));

function firstUnusedTemplate(
  candidates: readonly AlgebraEquationTemplate[],
  startingIndex: number,
  usedStates: Set<string>,
  stepLabel: string,
) {
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(startingIndex + offset) % candidates.length];
    if (usedStates.has(candidate.state)) continue;
    usedStates.add(candidate.state);
    return candidate;
  }
  throw new Error(`No distinct Early Algebra ${stepLabel} equation template is available`);
}

// Catalogue migration and refresh now share the same Early Algebra scope:
// one inverse addition or subtraction per row, with positive whole-number
// answers no greater than 10. Richer coefficient and multi-step work belongs
// in a later lesson, after learners have practised equality and inverse operations.
const catalogue: Record<string, { offset: number; dualPadFromEquation: number }> = {
  garden: { offset: 0, dualPadFromEquation: 0 },
  geminiqueen: { offset: 0, dualPadFromEquation: 2 },
  grudge: { offset: 0, dualPadFromEquation: 1 },
  jazzmaybach: { offset: 0, dualPadFromEquation: 1 },
  justbecause: { offset: 2, dualPadFromEquation: 1 },
  oneone: { offset: 4, dualPadFromEquation: 1 },
  seven: { offset: 5, dualPadFromEquation: 2 },
  waves: { offset: 0, dualPadFromEquation: 2 },
};

type Clock = ReturnType<typeof createLessonClock>;

function equationTokens(equation: AuthoredLessonEquation) {
  return equation.tokens ?? tokenizeAuthoredEquationState(equation.state)
    .map((label, index) => ({ id: `${equation.id}-token-${index}`, label }));
}

function simplifyOverRangeCueOnlyEquation(equation: AuthoredLessonEquation) {
  const match = equation.state.match(/^x\s*([+-])\s*(\d+)\s*=\s*(\d+)$/);
  if (!match) return equation;
  const solution = match[1] === "+"
    ? Number(match[3]) - Number(match[2])
    : Number(match[3]) + Number(match[2]);
  const literals = [Number(match[2]), Number(match[3])];
  if (solution <= 10 && literals.every((value) => value <= 10)) return equation;

  const state = match[1] === "+" ? "x + 2 = 5" : "x - 2 = 5";
  const previousTokens = equationTokens(equation);
  const labels = tokenizeAuthoredEquationState(state);
  if (previousTokens.length !== labels.length) return equation;
  return {
    ...equation,
    state,
    // Keep cue targets stable: this rewrite changes the labels, not token slots.
    tokens: labels.map((label, index) => ({ id: previousTokens[index].id, label })),
  };
}

function playableIndexes(equation: AuthoredLessonEquation) {
  return equationTokens(equation).flatMap((token, index) =>
    isAuthoredEquationOperator(token.label) ? [] : [index]);
}

/** Reauthor the equation row at each Drag boundary while keeping cue identity and timing intact. */
export function refreshEarlyAlgebraEquationContent(input: {
  songAssetId: string;
  sidecar: string;
}) {
  const source = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(JSON.parse(input.sidecar)));
  if (source.activityKey !== "early-algebra" || source.songAssetId !== input.songAssetId) {
    throw new Error(`Catalogue identity mismatch for '${input.songAssetId}'`);
  }
  const orderedEncounters = [...source.encounters].sort((left, right) =>
    left.startTick - right.startTick || left.id.localeCompare(right.id));
  if (!orderedEncounters.some((encounter) => encounter.type === "drag")) return source;
  const totalDragSteps = orderedEncounters.filter((encounter) => encounter.type === "drag").length;
  const draggedEquationIds = new Set(orderedEncounters
    .filter((encounter) => encounter.type === "drag")
    .map((encounter) => encounter.equationId));
  const preservedEquations = source.equations
    .filter((equation) => !draggedEquationIds.has(equation.id))
    .map(simplifyOverRangeCueOnlyEquation);

  const songOffset = [...input.songAssetId]
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const usedStates = new Set<string>();
  const steps: Array<{
    equation: AuthoredLessonEquation;
    operationTargetIndex: number;
    encounters: AuthoredLessonEncounter[];
  }> = [];
  let pendingEncounters: AuthoredLessonEncounter[] = [];
  const refreshedById = new Map<string, AuthoredLessonEncounter>(source.encounters
    .filter((encounter) => !draggedEquationIds.has(encounter.equationId))
    .map((encounter) => [encounter.id, encounter]));

  const finishStep = () => {
    const dragEncounters = pendingEncounters.filter((encounter) => encounter.type === "drag");
    if (dragEncounters.length !== 1 || (dragEncounters[0].dragTargets?.length ?? 0) !== 1) {
      throw new Error("Each refreshed Early Algebra row must finish with exactly one single-target Drag encounter");
    }
    const hitIds = new Set(pendingEncounters
      .filter((encounter) => encounter.type === "hit")
      .map(({ id }) => id));
    if (hitIds.size === 0 || !hitIds.has(dragEncounters[0].dragTargets?.[0]?.sourceHitId ?? "")) {
      throw new Error(`Drag encounter '${dragEncounters[0].id}' must use a Hit from its own equation row`);
    }

    const template = oneStepTemplateForOccurrence(
      steps.length,
      songOffset,
      usedStates,
      totalDragSteps,
    );
    const id = `${input.songAssetId}-early-step-${String(steps.length + 1).padStart(2, "0")}`;
    const tokens = tokenizeAuthoredEquationState(template.state).map((label, tokenIndex) => ({
      id: `${id}-token-${tokenIndex}`,
      label,
    }));
    const operationTargetIndex = tokens.findIndex((token) => token.label === template.operationTargets[0]);
    if (operationTargetIndex < 0 || isAuthoredEquationOperator(template.operationTargets[0])) {
      throw new Error(`Math template '${template.state}' has an invalid operation target`);
    }
    const equation = { id, state: template.state, tokens };
    steps.push({ equation, operationTargetIndex, encounters: pendingEncounters });
    pendingEncounters = [];
  };

  for (const encounter of orderedEncounters) {
    // Keep cue-only rows attached to their authored equation. In a mixed
    // lesson, absorbing one into the next Drag step would retarget its Hits
    // and silently drop its equation from the refreshed sidecar.
    if (!draggedEquationIds.has(encounter.equationId)) continue;
    pendingEncounters.push(encounter);
    if (encounter.type === "drag") finishStep();
  }

  // Some charts have trailing rhythm Hits after their final Drag. Reuse that
  // solved row; Unity restores its authored start state for the next cue.
  if (pendingEncounters.length > 0) {
    if (steps.length === 0) return source;
    steps[steps.length - 1].encounters.push(...pendingEncounters);
  }

  for (const step of steps) {
    const tokens = step.equation.tokens ?? [];
    const targetAt = (tokenIndex: number) => ({ tokenIndex, targetId: tokens[tokenIndex].id });
    const playableTokenIndexes = playableIndexes(step.equation);
    const dragSourceHitId = step.encounters.find((encounter) => encounter.type === "drag")
      ?.dragTargets?.[0]?.sourceHitId;
    let hitProgress = 0;

    for (const encounter of step.encounters) {
      const refreshed = { ...encounter, equationId: step.equation.id };
      if (encounter.type === "hit") {
        const hitBubbles = (encounter.hitBubbles ?? []).map((bubble, bubbleIndex) => {
          const tokenIndex = encounter.id === dragSourceHitId && bubbleIndex === 0
            ? step.operationTargetIndex
            : playableTokenIndexes[(hitProgress + bubbleIndex) % playableTokenIndexes.length];
          return { ...bubble, ...targetAt(tokenIndex) };
        });
        hitProgress += hitBubbles.length;
        refreshedById.set(encounter.id, { ...refreshed, hitBubbles });
      } else if (encounter.type === "spin") {
        const spinTargets = (encounter.spinTargets ?? []).map((target) => ({
          ...target,
          ...targetAt(step.operationTargetIndex),
        }));
        if (spinTargets.length === 0) throw new Error(`Spin encounter '${encounter.id}' has no authored target`);
        refreshedById.set(encounter.id, { ...refreshed, spinTargets });
      } else {
        const dragTargets = (encounter.dragTargets ?? []).map((target) => ({
          ...target,
          ...targetAt(step.operationTargetIndex),
        }));
        refreshedById.set(encounter.id, { ...refreshed, dragTargets });
      }
    }
  }

  const equations = [...steps.map(({ equation }) => equation), ...preservedEquations];
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
  if (source.equations.length > refreshedAdditionTemplates.length + refreshedSubtractionTemplates.length) {
    throw new Error(`No distinct Early Algebra one-step equation for all ${source.equations.length} '${input.songAssetId}' equations`);
  }
  const songOffset = [...input.songAssetId]
    .reduce((total, character) => total + character.charCodeAt(0), 0) + specification.offset;
  const usedStates = new Set<string>();
  const equations = source.equations.map((equation, index) => {
    const state = oneStepTemplateForOccurrence(
      index,
      songOffset,
      usedStates,
      source.equations.length,
    ).state;
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
