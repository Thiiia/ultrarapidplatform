import {
  AUTHORED_HIT_MISS_WINDOW_SECONDS,
  AUTHORED_PRESENTATION_LEAD_SECONDS,
  isAuthoredEquationOperator,
  parseAuthoredLessonDraft,
  tokenizeAuthoredEquationState,
  type AuthoredLessonDraft,
} from "./authored-lesson";
import {
  validateLegacyEncounters,
  type LegacyEncounter,
  type LegacyEncounterSidecar,
} from "./legacy-encounters";

// These are the canonical equation states for every legacy catalogue ID that
// is currently stored in the Early Algebra library. Legacy sidecars kept only
// IDs, so this table is the lossless bridge to the Unity curriculum asset.
const LEGACY_EQUATION_STATES: Record<string, string> = {
  "Year7_001_moveconstant": "x-5=6", "Year7_002_moveconstant": "x-6=6",
  "Year7_003_moveconstant": "x-7=6", "Year7_004_moveconstant": "x-8=6",
  "Year7_005_moveconstant": "x-9=6", "Year7_006_dividebycoefficient": "8x=32",
  "Year7_007_dividebycoefficient": "9x=27", "Year7_009_dividebycoefficient": "10x=30",
  "Year7_011_mixedmultistep": "6x+5=35", "Year7_012_mixedmultistep": "6x+4=40",
  "Year7_013_mixedmultistep": "7x+4=39", "Year7_014_mixedmultistep": "7x+6=34",
  "Year7_015_mixedmultistep": "8x+3=35", "Year7_017_mixedmultistep": "9x+2=29",
  "Year7_018_signflip": "-2x+14=6", "Year7_026_moveconstant": "x-10=6",
  "Year7_027_moveconstant": "x-11=7", "Year7_028_dividebycoefficient": "2x=14",
  "Year7_030_dividebycoefficient": "4x=28", "Year7_032_dividebycoefficient": "6x=36",
  "Year8_001_mixedmultistep": "5x+7=42", "Year8_002_mixedmultistep": "6x+5=47",
  "Year8_003_mixedmultistep": "7x+8=50", "Year8_004_mixedmultistep": "8x+6=54",
  "Year8_005_mixedmultistep": "9x+4=49", "Year8_006_mixedmultistep": "10x+7=57",
  "Year8_007_mixedmultistep": "6x-11=25", "Year8_008_mixedmultistep": "7x-9=40",
  "Year8_011_signflip": "-6x+43=7", "Year8_013_signflip": "-8x+49=9",
  "Year8_015_signflip": "-10x+59=9", "Year8_016_movevariable": "4x+3=x+18",
  "Year8_017_movevariable": "5x+2=2x+20", "Year8_018_movevariable": "6x+5=2x+25",
  "Year8_020_movevariable": "8x+6=3x+31", "Year8_022_movevariable": "10x+5=4x+35",
  "Year9_002_mixedmultistep": "x^2-12x+36=0", "Year9_011_signflip": "x^2-18x+81=0",
  "Year9_014_signflip": "x^2-28x+196=0", "Year9_016_movevariable": "8x+9=2x+51",
  "Year9_019_movevariable": "11x+5=4x+61", "Year9_022_movevariable": "14x+4=7x+53",
  "Year9_025_movevariable": "14x+10=6x+74", "Year9_028_movevariable": "11x+13=3x+77",
};

const HIT_PADS = ["topLeft", "topRight", "left", "right", "bottomLeft", "bottomRight"] as const;
const LEGACY_MIGRATED_ENCOUNTER_ID = /^legacy-\d+-(?:hit|spin|drag)$/;
// Unity owns one shared presenter. A dependent drag can only be shown after
// its source hit has reached its miss release and the next cue's lead-in can
// begin. Keep a small clock-rounding margin as migration works in chart ticks.
const DEPENDENT_DRAG_SAFE_GAP_SECONDS =
  AUTHORED_HIT_MISS_WINDOW_SECONDS + AUTHORED_PRESENTATION_LEAD_SECONDS + 0.1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type LegacyEquationRuntimeTokens = {
  state: string;
  tokens: Array<{ id: string; label: string }>;
  /** Maps a target index from the old whitespace-tokenized state to its runtime-safe token. */
  runtimeIndexByLegacyIndex: number[];
};

/**
 * The first v3 legacy bridge wrote some multi-digit values as separate
 * whitespace-delimited digits (for example, `X - 9 = 1 0`). Unity removes
 * that whitespace before rendering, so it creates one `10` bubble while the
 * sidecar can still target the non-existent final `0` token. Preserve normal
 * editor token boundaries, but fold only adjacent digit fragments and attach
 * stable token identities for the Unity token mapper.
 */
function createLegacyRuntimeTokens(equationId: string, state: string): LegacyEquationRuntimeTokens {
  const legacyTokens = tokenizeAuthoredEquationState(state);
  const labels: string[] = [];
  const runtimeIndexByLegacyIndex: number[] = [];

  for (let index = 0; index < legacyTokens.length;) {
    const token = legacyTokens[index];
    if (!/^\d+$/.test(token)) {
      runtimeIndexByLegacyIndex[index] = labels.length;
      labels.push(token);
      index += 1;
      continue;
    }

    const runtimeIndex = labels.length;
    let combined = token;
    runtimeIndexByLegacyIndex[index] = runtimeIndex;
    index += 1;
    while (index < legacyTokens.length && /^\d+$/.test(legacyTokens[index])) {
      combined += legacyTokens[index];
      runtimeIndexByLegacyIndex[index] = runtimeIndex;
      index += 1;
    }
    labels.push(combined);
  }

  return {
    state: labels.join(" "),
    tokens: labels.map((label, index) => ({ id: `${equationId}-legacy-token-${index}`, label })),
    runtimeIndexByLegacyIndex,
  };
}

function rebindLegacyTargetCollection(
  value: unknown,
  runtimeTokens: LegacyEquationRuntimeTokens | undefined,
): unknown {
  if (!Array.isArray(value) || !runtimeTokens) return value;

  let changed = false;
  const rebound = value.map((target) => {
    if (!isRecord(target) || typeof target.tokenIndex !== "number" || !Number.isSafeInteger(target.tokenIndex)) {
      return target;
    }

    const runtimeIndex = runtimeTokens.runtimeIndexByLegacyIndex[target.tokenIndex];
    const token = runtimeTokens.tokens[runtimeIndex];
    if (runtimeIndex == null || !token) return target;

    if (runtimeIndex === target.tokenIndex && target.targetId === token.id) return target;
    changed = true;
    return { ...target, tokenIndex: runtimeIndex, targetId: token.id };
  });

  return changed ? rebound : value;
}

function bindLegacyTargetIds(
  value: unknown,
  runtimeTokens: LegacyEquationRuntimeTokens | undefined,
): unknown {
  if (!Array.isArray(value) || !runtimeTokens) return value;

  let changed = false;
  const rebound = value.map((target) => {
    if (!isRecord(target) || typeof target.tokenIndex !== "number" || !Number.isSafeInteger(target.tokenIndex)) {
      return target;
    }
    const token = runtimeTokens.tokens[target.tokenIndex];
    if (!token || target.targetId === token.id) return target;
    changed = true;
    return { ...target, targetId: token.id };
  });

  return changed ? rebound : value;
}

function repairLegacyTargetCollection(value: unknown, state: string): unknown {
  if (!Array.isArray(value)) return value;
  const tokens = tokenizeAuthoredEquationState(state);
  const playableIndexes = tokens.flatMap((token, tokenIndex) => isAuthoredEquationOperator(token) ? [] : [tokenIndex]);
  if (playableIndexes.length === 0) return value;

  let changed = false;
  const repaired = value.map((target) => {
    const tokenIndex = isRecord(target) ? target.tokenIndex : null;
    if (!isRecord(target) || typeof tokenIndex !== "number" || !Number.isSafeInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokens.length || !isAuthoredEquationOperator(tokens[tokenIndex])) {
      return target;
    }
    changed = true;
    return { ...target, tokenIndex: playableIndexes[tokenIndex % playableIndexes.length] };
  });

  return changed ? repaired : value;
}

function repairLegacyHitPads(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  let changed = false;
  const repaired = value.map((target, targetIndex) => {
    if (!isRecord(target)) return target;
    const pads = target.pads;
    const positions = target.positions;
    // Keep malformed supplied fields for the strict parser to reject. Only
    // fill the narrowly-known historical omission from the old legacy bridge.
    if ((pads != null && !Array.isArray(pads)) || (positions != null && !Array.isArray(positions))) return target;
    if ((Array.isArray(pads) && pads.length > 0) || (Array.isArray(positions) && positions.length > 0)) return target;
    const pad = HIT_PADS[targetIndex % HIT_PADS.length];
    changed = true;
    return { ...target, positions: [pad], pads: [pad] };
  });
  return changed ? repaired : value;
}

/**
 * Repairs only v3 rows generated by the earlier legacy bridge, whose ordinal
 * target selection accidentally included equation operators. Authored rows are
 * deliberately untouched so invalid new content is still rejected.
 */
export function repairLegacyMigratedAuthoredLesson<T>(value: T): T {
  if (!isRecord(value) || value.version !== 3 || value.mode !== "authored" || !Array.isArray(value.equations) || !Array.isArray(value.encounters)) {
    return value;
  }

  const sourceEquations = value.equations as unknown[];
  const sourceEncounters = value.encounters as unknown[];
  const legacyEquationIds = new Set(sourceEncounters.flatMap((encounter) =>
    isRecord(encounter) && typeof encounter.id === "string" &&
      LEGACY_MIGRATED_ENCOUNTER_ID.test(encounter.id) && typeof encounter.equationId === "string"
      ? [encounter.equationId]
      : [],
  ));
  const runtimeTokensByEquationId = new Map<string, LegacyEquationRuntimeTokens>();
  const equations = sourceEquations.map((equation) => {
    if (!isRecord(equation) || typeof equation.id !== "string" || typeof equation.state !== "string" ||
      !legacyEquationIds.has(equation.id) || Array.isArray(equation.tokens)) {
      return equation;
    }

    const runtimeTokens = createLegacyRuntimeTokens(equation.id, equation.state);
    runtimeTokensByEquationId.set(equation.id, runtimeTokens);
    return { ...equation, state: runtimeTokens.state, tokens: runtimeTokens.tokens };
  });
  const stateByEquationId = new Map(equations.flatMap((equation) =>
    isRecord(equation) && typeof equation.id === "string" && typeof equation.state === "string"
      ? [[equation.id, equation.state] as const]
      : [],
  ));
  const hitTickById = new Map(sourceEncounters.flatMap((encounter) =>
    isRecord(encounter) && typeof encounter.id === "string" && encounter.type === "hit" &&
    typeof encounter.startTick === "number" && Number.isSafeInteger(encounter.startTick)
      ? [[encounter.id, encounter.startTick] as const]
      : [],
  ));
  let changed = equations.some((equation, index) => equation !== sourceEquations[index]);
  const encounters = sourceEncounters.map((encounter) => {
    if (!isRecord(encounter) || typeof encounter.id !== "string" || !LEGACY_MIGRATED_ENCOUNTER_ID.test(encounter.id) || typeof encounter.equationId !== "string") {
      return encounter;
    }
    const state = stateByEquationId.get(encounter.equationId);
    if (!state) return encounter;
    const targetKey = encounter.type === "hit" ? "hitBubbles" : encounter.type === "spin" ? "spinTargets" : encounter.type === "drag" ? "dragTargets" : null;
    if (!targetKey) return encounter;
    const reboundTargets = rebindLegacyTargetCollection(
      encounter[targetKey],
      runtimeTokensByEquationId.get(encounter.equationId),
    );
    const operatorRepairedTargets = repairLegacyTargetCollection(reboundTargets, state);
    const targets = encounter.type === "hit"
      ? repairLegacyHitPads(operatorRepairedTargets)
      : operatorRepairedTargets;
    const boundTargets = bindLegacyTargetIds(
      targets,
      runtimeTokensByEquationId.get(encounter.equationId),
    );
    let repaired: Record<string, unknown> = boundTargets === encounter[targetKey]
      ? encounter
      : { ...encounter, [targetKey]: boundTargets };
    if (repaired !== encounter) changed = true;

    if (encounter.type === "drag" && Array.isArray(encounter.dragTargets) &&
      typeof encounter.startTick === "number" && Number.isSafeInteger(encounter.startTick) &&
      typeof encounter.endTick === "number" && Number.isSafeInteger(encounter.endTick)) {
      const sourceTick = encounter.dragTargets
        .flatMap((target) => isRecord(target) && typeof target.sourceHitId === "string"
          ? [hitTickById.get(target.sourceHitId)]
          : [])
        .find((tick): tick is number => typeof tick === "number");
      if (sourceTick != null && sourceTick >= encounter.startTick) {
        const duration = Math.max(1, encounter.endTick - encounter.startTick);
        repaired = { ...repaired, startTick: sourceTick + 1, endTick: sourceTick + 1 + duration };
        changed = true;
      }
    }

    return repaired;
  });

  return changed ? { ...value, equations, encounters } as T : value;
}

function durationEndTick(
  startTick: number,
  encounter: LegacyEncounter,
  toTickAfterSeconds: (tick: number, seconds: number) => number,
) {
  const seconds = typeof encounter.expectedSolveSeconds === "number" && encounter.expectedSolveSeconds > 0
    ? encounter.expectedSolveSeconds
    : 1;
  return Math.max(startTick + 1, toTickAfterSeconds(startTick, seconds));
}

function tokenIndexFor(state: string, index: number) {
  const playableIndexes = tokenizeAuthoredEquationState(state)
    .flatMap((token, tokenIndex) => isAuthoredEquationOperator(token) ? [] : [tokenIndex]);

  if (playableIndexes.length === 0) {
    throw new Error("Legacy equation has no playable target token");
  }

  return playableIndexes[index % playableIndexes.length];
}

function hitEncounter({ id, eventId, equationId, tick, state, hits }: {
  id: string; eventId: string; equationId: string; tick: number; state: string; hits: number;
}) {
  return {
    id,
    eventId,
    type: "hit" as const,
    equationId,
    startTick: tick,
    endTick: tick,
    hitBubbles: Array.from({ length: Math.max(1, hits) }, (_, index) => ({
      tokenIndex: tokenIndexFor(state, index),
      positions: [HIT_PADS[index % HIT_PADS.length]],
      pads: [HIT_PADS[index % HIT_PADS.length]],
    })),
  };
}

/** Converts known Unity-catalogue legacy encounters to the strict v3 wire format. */
export function migrateLegacyEncounterSidecar({
  source,
  identity,
  toTickAfterSeconds,
}: {
  source: LegacyEncounterSidecar;
  identity: { songAssetId: string; activityKey: string };
  toTickAfterSeconds: (tick: number, seconds: number) => number;
}): AuthoredLessonDraft {
  validateLegacyEncounters(source);
  const equations: AuthoredLessonDraft["equations"] = [];
  const equationStates = new Map<string, string>();
  const encounters: AuthoredLessonDraft["encounters"] = [];

  source.encounters.forEach((legacy, index) => {
    const state = LEGACY_EQUATION_STATES[legacy.equationId];
    if (!state) throw new Error(`Legacy equation '${legacy.equationId}' has no canonical equation state for v3 migration`);
    if (!equationStates.has(legacy.equationId)) {
      equationStates.set(legacy.equationId, state);
      equations.push({ id: legacy.equationId, state });
    }

    const eventId = `legacy-${index}`;
    const hitId = `${eventId}-hit`;
    const hits = typeof legacy.hits === "number" ? Math.max(1, Math.round(legacy.hits)) : 1;
    const endTick = durationEndTick(legacy.tick, legacy, toTickAfterSeconds);
    switch (legacy.mechanic) {
      case "MultiHitUnlock":
        encounters.push(hitEncounter({ id: hitId, eventId, equationId: legacy.equationId, tick: legacy.tick, state, hits }));
        break;
      case "DJSpinout":
        encounters.push({ id: `${eventId}-spin`, eventId, type: "spin", equationId: legacy.equationId, startTick: legacy.tick, endTick,
          spinTargets: [{ tokenIndex: tokenIndexFor(state, index) }] });
        break;
      case "ClassicTimedDrag":
        encounters.push({ id: `${eventId}-drag`, eventId, type: "drag", equationId: legacy.equationId, startTick: legacy.tick, endTick,
          dragTargets: [{ tokenIndex: tokenIndexFor(state, index) }] });
        break;
      case "SingleHitUnlockThenTimedDrag":
      case "DoubleHitDrag":
        encounters.push(hitEncounter({ id: hitId, eventId, equationId: legacy.equationId, tick: legacy.tick, state, hits }));
        // The v3 Unity runtime requires the source Hit to release before a
        // dependent Drag's presentation lead-in begins. A one-tick offset can
        // still collide visually, so convert the full safe window through the
        // song's tempo map before preserving the legacy drag duration.
        const dragStartTick = Math.max(
          legacy.tick + 1,
          toTickAfterSeconds(legacy.tick, DEPENDENT_DRAG_SAFE_GAP_SECONDS),
        );
        encounters.push({ id: `${eventId}-drag`, eventId, type: "drag", equationId: legacy.equationId, startTick: dragStartTick,
          endTick: durationEndTick(dragStartTick, legacy, toTickAfterSeconds),
          dragTargets: [{ tokenIndex: tokenIndexFor(state, hits), sourceHitId: hitId }] });
        break;
      default:
        throw new Error(`Legacy mechanic '${legacy.mechanic}' is unsupported for v3 migration`);
    }
  });

  return parseAuthoredLessonDraft({ version: 3, mode: "authored", ...identity, equations, encounters });
}
