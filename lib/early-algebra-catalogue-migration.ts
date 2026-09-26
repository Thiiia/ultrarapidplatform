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

// Deliberate progressions: one-step equations first, then two-step and
// variable-on-both-sides equations. Each state has an integer solution.
const foundation = [
  "x + 4 = 11", "x - 6 = 8", "3x = 21", "2x + 5 = 19",
  "4x - 7 = 25", "5x + 6 = 31", "6x - 9 = 27", "3x + 8 = 26",
  "7x - 5 = 51", "4x + 9 = 2x + 21", "5x - 4 = 2x + 20",
  "6x + 3 = 3x + 30", "8x - 10 = 5x + 14",
  "7x + 2 = 4x + 20", "9x - 5 = 6x + 22",
  "2x + 13 = x + 23", "3x - 4 = x + 4", "4x + 6 = x + 33",
];
const intermediate = [
  "4x + 7 = 35", "6x - 5 = 31", "5x + 9 = 3x + 25",
  "7x - 11 = 3x + 13", "8x + 5 = 2x + 47",
  "9x - 8 = 5x + 20", "3x + 17 = 2x + 26",
  "11x - 9 = 6x + 36", "12x + 4 = 8x + 28",
  "6x + 15 = 2x + 47", "10x - 12 = 7x + 9",
  "7x + 18 = 4x + 36",
];
const advanced = [
  "7x + 9 = 3x + 29", "11x - 5 = 4x + 44",
  "9x + 14 = 5x + 50", "12x - 8 = 3x + 46",
  "14x + 6 = 8x + 66", "15x - 13 = 6x + 50",
  "13x + 11 = 5x + 75", "16x - 7 = 7x + 92",
  "18x + 4 = 10x + 100", "17x - 12 = 9x + 20",
];

const catalogue: Record<string, { states: readonly string[]; offset: number }> = {
  garden: { states: advanced, offset: 0 },
  geminiqueen: { states: foundation, offset: 0 },
  grudge: { states: intermediate, offset: 0 },
  jazzmaybach: { states: ["x + 4 = 10", "3x + 7 = 31"], offset: 0 },
  justbecause: { states: intermediate, offset: 2 },
  oneone: { states: intermediate, offset: 4 },
  seven: { states: foundation, offset: 5 },
  waves: { states: foundation, offset: 0 },
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
  const encounters = source.encounters.map((encounter) => {
    const equation = equationById.get(encounter.equationId ?? "");
    if (!equation) throw new Error(`Missing equation for '${encounter.id}'`);
    if (encounter.type === "hit") {
      const originalSlot = resolveAuthoredHitPadTarget(encounter.hitBubbles?.[0] ?? {})[0];
      const pad = padFor(originalSlot == null ? hitOrdinal : originalSlot);
      const target = nextHitTarget(equation);
      hitOrdinal += 1;
      return { ...encounter, hitBubbles: [{
        ...target, padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
        pads: [pad], positions: [pad],
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
      const pad = padFor(hitOrdinal++);
      const id = `${previous.id}-rhythm-hit-${++addedOrdinal}`;
      added.push({
        id, eventId: `${previous.eventId}-rhythm-${tick}`, type: "hit",
        equationId: equation.id, startTick: tick, endTick: tick,
        hitBubbles: [{ ...nextHitTarget(equation),
          padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
          pads: [pad], positions: [pad] }],
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
