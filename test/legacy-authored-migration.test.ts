import assert from "node:assert/strict";
import test from "node:test";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { migrateLegacyEncounterSidecar, repairLegacyMigratedAuthoredLesson } from "../lib/legacy-authored-migration";

test("migrates known legacy catalogue encounters into a playable v3 authored lesson", () => {
  const migrated = migrateLegacyEncounterSidecar({
    source: {
      version: 1,
      encounters: [
        { tick: 960, equationId: "Year7_001_moveconstant", mechanic: "MultiHitUnlock", hits: 2 },
        { tick: 1920, equationId: "Year7_007_dividebycoefficient", mechanic: "DJSpinout", expectedSolveSeconds: 2 },
        { tick: 2880, equationId: "Year7_011_mixedmultistep", mechanic: "DoubleHitDrag", hits: 2, expectedSolveSeconds: 3 },
      ],
    },
    identity: { songAssetId: "waves", activityKey: "early-algebra" },
    toTickAfterSeconds: (tick, seconds) => tick + Math.round(seconds * 192),
  });

  const parsed = parseAuthoredLessonDraft(migrated);
  assert.equal(parsed.version, 3);
  assert.equal(parsed.mode, "authored");
  assert.deepEqual(parsed.equations, [
    { id: "Year7_001_moveconstant", state: "x-5=6" },
    { id: "Year7_007_dividebycoefficient", state: "9x=27" },
    { id: "Year7_011_mixedmultistep", state: "6x+5=35" },
  ]);
  assert.equal(parsed.encounters.length, 4);
  assert.equal(parsed.encounters[0].hitBubbles?.length, 2);
  assert.equal(parsed.encounters[1].type, "spin");
  assert.equal(parsed.encounters[2].type, "hit");
  assert.equal(parsed.encounters[3].type, "drag");
  assert.equal(parsed.encounters[3].dragTargets?.[0].sourceHitId, parsed.encounters[2].id);
  assert.ok(parsed.encounters[2].endTick < parsed.encounters[3].startTick);
  // A one-tick offset is still inside Unity's hit-release + cue-lead window.
  // At this fixture's 192 ticks/second clock, the dependent drag needs a
  // 1.525-second spacing before it can safely be presented.
  assert.equal(parsed.encounters[3].startTick, 2880 + Math.round(1.525 * 192));
});

test("rejects a legacy equation that is absent from the canonical migration catalogue", () => {
  assert.throws(() => migrateLegacyEncounterSidecar({
    source: { version: 1, encounters: [{ tick: 0, equationId: "missing", mechanic: "MultiHitUnlock", hits: 1 }] },
    identity: { songAssetId: "waves", activityKey: "early-algebra" },
    toTickAfterSeconds: (tick, seconds) => tick + Math.round(seconds * 192),
  }), /no canonical equation state/i);
});

test("repairs historical legacy-migrated targets that point at operators", () => {
  const historical = {
    version: 3,
    mode: "authored",
    songAssetId: "waves",
    activityKey: "early-algebra",
    equations: [{ id: "Year7_011_mixedmultistep", state: "6x+5=35" }],
    encounters: [{
      id: "legacy-0-hit",
      eventId: "legacy-0",
      type: "hit",
      equationId: "Year7_011_mixedmultistep",
      startTick: 960,
      endTick: 960,
      hitBubbles: [{ tokenIndex: 1 }],
    }],
  };

  assert.throws(() => parseAuthoredLessonDraft(historical), /non-playable operator/i);
  const repaired = repairLegacyMigratedAuthoredLesson(historical);
  assert.doesNotThrow(() => parseAuthoredLessonDraft(repaired));
  assert.equal((repaired.encounters[0].hitBubbles?.[0] as { tokenIndex: number }).tokenIndex, 2);
  assert.deepEqual(repaired.encounters[0].hitBubbles?.[0], {
    tokenIndex: 2,
    targetId: "Year7_011_mixedmultistep-legacy-token-2",
    positions: ["topLeft"],
    pads: ["topLeft"],
  });
});

test("repairs legacy digit-fragment targets to Unity's rendered number token", () => {
  const historical = {
    version: 3,
    mode: "authored",
    songAssetId: "waves",
    activityKey: "early-algebra",
    equations: [{ id: "waves-equation", state: "X - 9 = 1 0" }],
    encounters: [{
      id: "legacy-0-hit",
      eventId: "legacy-0",
      type: "hit",
      equationId: "waves-equation",
      startTick: 960,
      endTick: 960,
      hitBubbles: [{ tokenIndex: 5, positions: ["right"], pads: ["right"] }],
    }],
  };

  const repaired = repairLegacyMigratedAuthoredLesson(historical);
  assert.deepEqual(repaired.equations[0], {
    id: "waves-equation",
    state: "X - 9 = 10",
    tokens: [
      { id: "waves-equation-legacy-token-0", label: "X" },
      { id: "waves-equation-legacy-token-1", label: "-" },
      { id: "waves-equation-legacy-token-2", label: "9" },
      { id: "waves-equation-legacy-token-3", label: "=" },
      { id: "waves-equation-legacy-token-4", label: "10" },
    ],
  });
  assert.deepEqual(repaired.encounters[0].hitBubbles, [{
    tokenIndex: 4,
    targetId: "waves-equation-legacy-token-4",
    positions: ["right"],
    pads: ["right"],
  }]);
  assert.doesNotThrow(() => parseAuthoredLessonDraft(repaired));
});

test("repairs a historical same-tick legacy hit and dependent drag", () => {
  const historical = {
    version: 3,
    mode: "authored",
    songAssetId: "waves",
    activityKey: "early-algebra",
    equations: [{ id: "Year7_011_mixedmultistep", state: "6x+5=35" }],
    encounters: [{
      id: "legacy-0-hit",
      eventId: "legacy-0",
      type: "hit",
      equationId: "Year7_011_mixedmultistep",
      startTick: 960,
      endTick: 960,
      hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }],
    }, {
      id: "legacy-0-drag",
      eventId: "legacy-0",
      type: "drag",
      equationId: "Year7_011_mixedmultistep",
      startTick: 960,
      endTick: 1152,
      dragTargets: [{ tokenIndex: 2, sourceHitId: "legacy-0-hit" }],
    }],
  };

  const repaired = repairLegacyMigratedAuthoredLesson(historical);
  const parsed = parseAuthoredLessonDraft(repaired);
  assert.equal(parsed.encounters[1].startTick, 961);
  assert.equal(parsed.encounters[1].endTick, 1153);
});
