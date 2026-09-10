import {
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

function durationEndTick(
  encounter: LegacyEncounter,
  toTickAfterSeconds: (tick: number, seconds: number) => number,
) {
  const seconds = typeof encounter.expectedSolveSeconds === "number" && encounter.expectedSolveSeconds > 0
    ? encounter.expectedSolveSeconds
    : 1;
  return Math.max(encounter.tick + 1, toTickAfterSeconds(encounter.tick, seconds));
}

function tokenIndexFor(state: string, index: number) {
  return index % Math.max(1, tokenizeAuthoredEquationState(state).length);
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
    const endTick = durationEndTick(legacy, toTickAfterSeconds);
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
        encounters.push({ id: `${eventId}-drag`, eventId, type: "drag", equationId: legacy.equationId, startTick: legacy.tick, endTick,
          dragTargets: [{ tokenIndex: tokenIndexFor(state, hits), sourceHitId: hitId }] });
        break;
      default:
        throw new Error(`Legacy mechanic '${legacy.mechanic}' is unsupported for v3 migration`);
    }
  });

  return parseAuthoredLessonDraft({ version: 3, mode: "authored", ...identity, equations, encounters });
}
