import {
  getNumberBondsWhole,
  getNumberBondsWholeTokenIndex,
  NUMBER_BONDS_MAX_WHOLE,
  NUMBER_BONDS_MIN_WHOLE,
  NUMBER_BONDS_TIMING_POLICY,
} from "./activity-authoring-capabilities";
import { parseSupportedChartSemantics, type SupportedRhythmDifficulty } from "./chart-semantics";
import { createLessonClock } from "./editor/lesson-timing";
import {
  PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
  resolveAuthoredHitPadSlot,
  type AuthoredHitPad,
} from "./authored-hit-pad-layout";
import { serializeAuthoredLesson, type AuthoredLessonDraft, type AuthoredSavedEquation, type AuthoredTimelineEvent } from "./authored-lesson-serialization";
import type { SongActivityKey } from "./song-activity-storage";

type RhythmSourceActivityKey = Exclude<SongActivityKey, "number-bonds">;

export type NumberBondsRhythmSource = {
  songAssetId: string;
  activityKey: SongActivityKey;
  revision: string;
  chartSha256: string;
  audioSha256: string;
};

export type NumberBondsPadChoreography =
  | "clockwise-hex"
  | "alternating-hex"
  | readonly AuthoredHitPad[];

export type NumberBondsCueSelectionConstraints = {
  minimumStartSeconds?: number;
  minimumSpacingSeconds?: number;
  finalInteractionTailSeconds?: number;
};

export type NumberBondsLessonDefinition = {
  songAssetId: string;
  equation: AuthoredSavedEquation;
  rhythmSource: NumberBondsRhythmSource;
  rhythmDifficulty: SupportedRhythmDifficulty;
  chartContent: string;
  durationSeconds: number;
  cueSelectionConstraints?: NumberBondsCueSelectionConstraints;
  padChoreography?: NumberBondsPadChoreography;
};

export type GeneratedNumberBondsLesson = {
  draft: AuthoredLessonDraft;
  sidecarContent: string;
  provenance: {
    songAssetId: string;
    sourceActivityKey: RhythmSourceActivityKey;
    sourceRevision: string;
    chartSha256: string;
    audioSha256: string;
    rhythmDifficulty: SupportedRhythmDifficulty;
    selectedCueTicks: number[];
    selectedCueSeconds: number[];
  };
};

export const NUMBER_BONDS_WHOLE_VALUES = Array.from(
  { length: NUMBER_BONDS_MAX_WHOLE - NUMBER_BONDS_MIN_WHOLE + 1 },
  (_, index) => NUMBER_BONDS_MIN_WHOLE + index,
);

export type NumberBondsCatalogueEntry = {
  id: string;
  whole: number;
  knownPart: number;
  complement: number;
  tokens: readonly [string, "=", string, "+", string];
};

/** Every ordered positive-part bond is available through the milestone whole 20. */
export const NUMBER_BONDS_EQUATION_CATALOGUE: readonly NumberBondsCatalogueEntry[] =
  NUMBER_BONDS_WHOLE_VALUES.flatMap((whole) =>
    Array.from({ length: whole - 1 }, (_, index): NumberBondsCatalogueEntry => {
      const knownPart = index + 1;
      const complement = whole - knownPart;
      return {
        id: `bond-${whole}-${knownPart}-${complement}`,
        whole,
        knownPart,
        complement,
        tokens: [`${whole}`, "=", `${knownPart}`, "+", `${complement}`] as const,
      };
    }),
  );

export const NUMBER_BONDS_PAD_CHOREOGRAPHIES = {
  "clockwise-hex": ["top", "upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"],
  "alternating-hex": ["top", "bottom", "upperRight", "lowerLeft", "lowerRight", "upperLeft"],
} as const satisfies Record<string, readonly AuthoredHitPad[]>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const CUE_EPSILON_SECONDS = 1e-8;

/** Return a fresh catalogue equation so one editor cannot mutate shared definitions. */
export function getNumberBondsCatalogueEquation(id: string): AuthoredSavedEquation {
  const entry = NUMBER_BONDS_EQUATION_CATALOGUE.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown Number Bonds catalogue entry '${id}'.`);
  return {
    id: entry.id,
    tokens: entry.tokens.map((label, index) => ({ id: `${entry.id}-token-${index}`, label })),
  };
}

function getDifficultyNoteTicks(chartContent: string, difficulty: SupportedRhythmDifficulty): number[] {
  const semantics = parseSupportedChartSemantics(chartContent, {
    selectedDifficulty: difficulty,
    requireRhythmNotes: true,
  });
  const body = chartContent.match(new RegExp(`\\[${difficulty}\\]\\s*\\{([\\s\\S]*?)\\}`, "i"))?.[1];
  if (!body) throw new Error(`The selected rhythm chart has no ${difficulty} note section.`);

  const ticks = Array.from(body.matchAll(/^\s*(\d+)\s*=\s*N\s+(\d+)\s+(\d+)\s*$/gm), (match) => Number(match[1]));
  if (ticks.length !== semantics.difficulties[difficulty].noteCount) {
    throw new Error(`The selected ${difficulty} notes could not be read consistently.`);
  }
  return [...new Set(ticks)].sort((left, right) => left - right);
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] + CUE_EPSILON_SECONDS < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Select the earliest deterministic cue sequence that satisfies the full policy. */
function selectCueSeconds(
  noteSeconds: readonly number[],
  cueCount: number,
  constraints: Required<NumberBondsCueSelectionConstraints>,
  durationSeconds: number,
): number[] {
  const lastAllowedSeconds = durationSeconds - constraints.finalInteractionTailSeconds;
  const candidates = [...new Set(noteSeconds)]
    .filter((seconds) => Number.isFinite(seconds) &&
      seconds + CUE_EPSILON_SECONDS >= constraints.minimumStartSeconds &&
      seconds <= lastAllowedSeconds + CUE_EPSILON_SECONDS)
    .sort((left, right) => left - right);
  const nextIndexes = candidates.map((seconds) =>
    lowerBound(candidates, seconds + constraints.minimumSpacingSeconds),
  );

  // possible[remaining][start] indicates whether that many cues fit from start.
  // The backward table avoids exponential backtracking on dense charts that
  // ultimately do not have enough separated cues.
  const possible = Array.from({ length: cueCount + 1 }, () => Array(candidates.length + 1).fill(false) as boolean[]);
  possible[0].fill(true);
  for (let remaining = 1; remaining <= cueCount; remaining += 1) {
    for (let start = candidates.length - 1; start >= 0; start -= 1) {
      possible[remaining][start] = possible[remaining][start + 1] ||
        possible[remaining - 1][nextIndexes[start]];
    }
  }

  if (!possible[cueCount][0]) {
    throw new Error(
      `This ${constraints.minimumStartSeconds.toFixed(2)}s–${lastAllowedSeconds.toFixed(2)}s rhythm window does not contain ${cueCount} ${constraints.minimumSpacingSeconds.toFixed(2)}s-spaced ${"Number Bonds catch cue"}${cueCount === 1 ? "" : "s"}. Choose a longer rhythm or a lower Number Bonds whole.`,
    );
  }

  const selected: number[] = [];
  let start = 0;
  for (let remaining = cueCount; remaining > 0; remaining -= 1) {
    let found = false;
    for (let index = start; index < candidates.length; index += 1) {
      if (!possible[remaining - 1][nextIndexes[index]]) continue;
      selected.push(candidates[index]);
      start = nextIndexes[index];
      found = true;
      break;
    }
    if (!found) throw new Error("The rhythm cue selection could not be completed safely.");
  }
  return selected;
}

function resolvePadSequence(
  choreography: NumberBondsPadChoreography | undefined,
  cueCount: number,
): AuthoredHitPad[] {
  const configured = choreography === undefined
    ? NUMBER_BONDS_PAD_CHOREOGRAPHIES["clockwise-hex"]
    : typeof choreography === "string"
      ? NUMBER_BONDS_PAD_CHOREOGRAPHIES[choreography]
      : choreography;
  if (!configured || configured.length === 0) {
    throw new Error("Choose a non-empty hit-pad choreography.");
  }

  // Six player pads form a repeating movement pattern; they do not combine unit hits.
  const pads = Array.from({ length: cueCount }, (_, index) => configured[index % configured.length]);
  if (pads.some((pad) => resolveAuthoredHitPadSlot(pad, PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION) < 0)) {
    throw new Error("The hit-pad choreography contains a pad that is not in the current player layout.");
  }
  return [...pads];
}

function stableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "item";
}

/**
 * Generate a strict v3 Number Bonds sidecar from actual note ticks in one
 * immutable rhythm revision. The source chart is read only; its sidecar is not
 * an input and cannot leak into the generated lesson.
 */
export function generateNumberBondsAuthoredLesson(
  definition: NumberBondsLessonDefinition,
): GeneratedNumberBondsLesson {
  const { rhythmSource } = definition;
  if (!definition.songAssetId.trim() || definition.songAssetId !== rhythmSource.songAssetId) {
    throw new Error("The Number Bonds lesson and rhythm source must belong to the same song.");
  }
  if (rhythmSource.activityKey === "number-bonds") {
    throw new Error("Number Bonds must start from an immutable rhythm revision owned by another activity.");
  }
  if (!UUID_PATTERN.test(rhythmSource.revision)) {
    throw new Error("Choose an immutable rhythm source revision.");
  }
  if (!SHA256_PATTERN.test(rhythmSource.chartSha256) || !SHA256_PATTERN.test(rhythmSource.audioSha256)) {
    throw new Error("The rhythm source is missing its verified chart or audio hash.");
  }
  if (!Number.isFinite(definition.durationSeconds) || definition.durationSeconds <= 0) {
    throw new Error("The song duration is required to keep every catch cue inside the audio and its final interaction tail.");
  }

  const whole = getNumberBondsWhole(definition.equation);
  const wholeTokenIndex = getNumberBondsWholeTokenIndex(definition.equation);
  if (whole == null || wholeTokenIndex == null) {
    throw new Error(`Number Bonds supports whole ${NUMBER_BONDS_MIN_WHOLE}–${NUMBER_BONDS_MAX_WHOLE} equations with one unit gem per whole and the whole token on either side of the equals sign.`);
  }
  const targetToken = definition.equation.tokens[wholeTokenIndex];
  if (!targetToken?.id.trim() || new Set(definition.equation.tokens.map((token) => token.id)).size !== definition.equation.tokens.length) {
    throw new Error("Each Number Bonds equation needs unique, stable token IDs.");
  }

  const requestedConstraints = definition.cueSelectionConstraints ?? {};
  const minimumStartSeconds = requestedConstraints.minimumStartSeconds ?? 0;
  const minimumSpacingSeconds = Math.max(
    NUMBER_BONDS_TIMING_POLICY.minimumHitSpacingSeconds,
    requestedConstraints.minimumSpacingSeconds ?? NUMBER_BONDS_TIMING_POLICY.minimumHitSpacingSeconds,
  );
  const finalInteractionTailSeconds = Math.max(
    NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds,
    requestedConstraints.finalInteractionTailSeconds ?? NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds,
  );
  if (!Number.isFinite(minimumStartSeconds) || minimumStartSeconds < 0 ||
      !Number.isFinite(minimumSpacingSeconds) || !Number.isFinite(finalInteractionTailSeconds)) {
    throw new Error("Number Bonds cue constraints must be finite non-negative seconds.");
  }
  const constraints = { minimumStartSeconds, minimumSpacingSeconds, finalInteractionTailSeconds };

  const noteTicks = getDifficultyNoteTicks(definition.chartContent, definition.rhythmDifficulty);
  const clock = createLessonClock(definition.chartContent);
  const noteSeconds = noteTicks.map((tick) => clock.toSeconds(tick));
  const selectedCueSeconds = selectCueSeconds(noteSeconds, whole, constraints, definition.durationSeconds);
  const selectedCueTicks = selectedCueSeconds.map((seconds) => clock.toTick(seconds));
  const pads = resolvePadSequence(definition.padChoreography, whole);
  const idPrefix = `nb-${stableIdPart(definition.songAssetId)}-${stableIdPart(definition.equation.id)}`;

  const events: AuthoredTimelineEvent[] = selectedCueSeconds.map((seconds, index) => {
    const encounterId = `${idPrefix}-hit-${index + 1}`;
    const pad = pads[index];
    const equation = {
      id: definition.equation.id,
      tokens: definition.equation.tokens.map((token) => ({ ...token })),
    };
    const hitBubbles = [{
      tokenIndex: wholeTokenIndex,
      targetId: targetToken.id,
      padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
      positions: [pad],
      pads: [pad],
    }];
    return {
      id: `${idPrefix}-event-${index + 1}`,
      tick: seconds,
      endTick: seconds,
      counts: { hit: 1, spin: 0, drag: 0 },
      assignments: { hit: equation, spin: null, drag: null },
      mechanicInstances: {
        hit: [{
          id: encounterId,
          tick: seconds,
          endTick: seconds,
          equation,
          hitBubbles,
          spinTargets: [],
          dragTargets: [],
        }],
        spin: [],
        drag: [],
      },
    };
  });

  const draft = serializeAuthoredLesson(
    events,
    { songAssetId: definition.songAssetId, activityKey: "number-bonds" },
    clock,
    definition.durationSeconds,
    [definition.equation],
    { forPublish: true, activityKey: "number-bonds" },
  );
  return {
    draft,
    sidecarContent: JSON.stringify(draft, null, 2),
    provenance: {
      songAssetId: definition.songAssetId,
      sourceActivityKey: rhythmSource.activityKey,
      sourceRevision: rhythmSource.revision,
      chartSha256: rhythmSource.chartSha256,
      audioSha256: rhythmSource.audioSha256,
      rhythmDifficulty: definition.rhythmDifficulty,
      selectedCueTicks,
      selectedCueSeconds,
    },
  };
}
