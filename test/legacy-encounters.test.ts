import assert from "node:assert/strict";
import test from "node:test";
import { persistLegacyEncounters, type LegacyEncounterSidecar } from "../lib/legacy-encounters";
import { countLegacySidecar } from "../lib/legacy-sidecar-counts";
import { validateLessonContent } from "../lib/lesson-content";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { buildLessonSaveRevisionTargets } from "../lib/lesson-save-revision";
import { checkSaveRevisionPrecondition } from "../lib/song-launch-identity";
import { projectToSidecarJson } from "../lib/editor/project-to-chart";

const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n 192 = N 1 0\n}';
// Shape and metadata of the actual Melika.encounters.json, including catalogue IDs.
const source: LegacyEncounterSidecar = {
  version: 1, status: "ready", chart: "Charts/Melika.chart",
  encounters: [
    { tick: 6241, equationId: "Year7_001_moveconstant", skillTag: "MoveConstant", expectedSolveSeconds: 9.55, mechanic: "SingleHitUnlockThenTimedDrag", hits: 1, focus: "Operation", patternId: "diagonal_call_response", sustainClass: "", pathStyle: "s_curve", spinTurns: 0, accent: "intro" },
    { tick: 17761, equationId: "Year7_006_dividebycoefficient", mechanic: "MultiHitUnlock", hits: 2 },
  ],
};

test("actual catalogue encounters validate and survive timing round trip without losing metadata", () => {
  const clock = createLessonClock(chart);
  const slots = source.encounters.map(row => ({tick: clock.toSeconds(row.tick), legacyEncounter: row}));
  const persisted = persistLegacyEncounters(source, slots, clock.toTick);
  assert.deepEqual(persisted, source);
  assert.doesNotThrow(() => validateLessonContent(chart, JSON.stringify(persisted)));
  assert.deepEqual(countLegacySidecar(persisted), {encounters: 2, equations: 2, targets: 0});
});

test("legacy moves and deletions preserve remaining encounter identity", () => {
  const result = persistLegacyEncounters(source, [{tick: 5, legacyEncounter: source.encounters[1]}], n => n * 192);
  assert.deepEqual(result.encounters, [{...source.encounters[1], tick: 960}]);
  assert.equal(source.encounters.length, 2);
});

test("downloading an imported encounter lesson retains its runtime metadata", () => {
  const json = projectToSidecarJson({version: 1, legacySource: source, events: source.encounters.map(row => ({type: "ALG_EVENT_SLOT", tick: row.tick, legacyEncounter: row}))});
  assert.deepEqual(JSON.parse(json), {...source, events: []});
});

test("malformed encounter arrays cannot be counted as empty", () => {
  assert.throws(() => countLegacySidecar({version: 1, encounters: null}), /unsupported/);
  assert.throws(() => countLegacySidecar({...source, encounters: [{...source.encounters[0], tick: -1}]}), /tick/);
});

test("draft save accepts incomplete gameplay without relaxing launch validation", () => {
  const collision = JSON.stringify({version: 1, events: [{tick: 192, type: "ALG_MECHANIC", mechanic: "spin"}, {tick: 192, type: "ALG_MECHANIC", mechanic: "drag"}]});
  assert.doesNotThrow(() => validateLessonContent(chart, collision, {forSave: true}));
  assert.throws(() => validateLessonContent(chart, collision), /collision/);
  assert.throws(() => validateLessonContent(chart, JSON.stringify({version: 1, events: [{tick: -1}]}), {forSave: true}), /tick/);
});

test("revision saves keep .encounters.json and reject a missing stale-write precondition", () => {
  const targets = buildLessonSaveRevisionTargets({targets: {chart: {bucket: "Charts", path: "dev/Early_Algebra/Melika.chart"}, sidecar: {bucket: "SidecarJsons", path: "dev/Early_Algebra/Melika.encounters.json"}}, revisionId: "r1"});
  assert.equal(targets.sidecar.path, "dev/Early_Algebra/revisions/r1/Melika.encounters.json");
  assert.equal(checkSaveRevisionPrecondition(targets.chart.path, null).ok, false);
});
