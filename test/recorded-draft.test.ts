import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_AUTHORED_HIT_PADS, PLAYER_HEX_AUTHORED_HIT_PADS } from "../lib/authored-hit-pad-layout";
import { groupRecordedDrafts, isRecoverableRecordedDraft, type RecordedMechanicDraft } from "../lib/editor/recorded-draft";
import { serializeAuthoredLesson, timelineEventsFromAuthoredLesson, type AuthoredTimelineEvent } from "../lib/authored-lesson-serialization";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { inputFromEvent } from "../lib/guided-authored-encounter";

const base = () => ({ id: "stable-hit", mechanic: "hit", equationId: "eq", tick: 6.321, hitBubbles: [], spinTargets: [], dragTargets: [] });
for (const [version, pads] of [[1, LEGACY_AUTHORED_HIT_PADS], [2, PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad }) => pad)]] as const) {
  for (const pad of pads) test(`recovery preserves layout ${version} pad ${pad} and authored identity`, () => {
    const draft = { ...base(), hitBubbles: [{ tokenIndex: 0, targetId: "term-x", pads: [pad], positions: [pad], padLayoutVersion: version }] };
    const parsed: unknown = JSON.parse(JSON.stringify(draft));
    assert.ok(isRecoverableRecordedDraft(parsed));
    assert.deepEqual(parsed, draft);
  });
}

test("optional pad aliases and unfinished targets remain repairable instead of being discarded", () => {
  for (const target of [{ tokenIndex: 0 }, { tokenIndex: 0, pads: ["top"], padLayoutVersion: 2 }, { tokenIndex: 0, positions: ["left"] }]) {
    assert.ok(isRecoverableRecordedDraft({ ...base(), hitBubbles: [target] }));
  }
  assert.ok(isRecoverableRecordedDraft({ ...base(), mechanic: "drag", endTick: 9, dragTargets: [{ tokenIndex: 2, sourceHitId: "same-gem-hit" }] }));
});

test("recovery rejects corrupt shapes and nonfinite times without normalizing data", () => {
  for (const invalid of [null, [], { ...base(), id: "" }, { ...base(), tick: NaN }, { ...base(), tick: -1 }, { ...base(), endTick: 6 },
    { ...base(), hitBubbles: [null] }, { ...base(), hitBubbles: [{ tokenIndex: 0, pads: ["unknown"] }] },
    { ...base(), hitBubbles: [{ tokenIndex: 0, pads: "top" }] }, { ...base(), hitBubbles: [{ tokenIndex: -1 }] },
    { ...base(), hitBubbles: [{ tokenIndex: 0, padLayoutVersion: 99 }] }, { ...base(), dragTargets: [{ tokenIndex: 0, sourceHitId: 7 }] }]) {
    assert.equal(isRecoverableRecordedDraft(invalid), false);
  }
});

test("finalizing preserves per-move equations, IDs, exact times and linked Drag sources", () => {
  const equations = [{ id: "eq-at-capture", state: "x + 2 = 7" }, { id: "selected-later", state: "x + 1 = 3" }];
  const hit: RecordedMechanicDraft = { ...base(), mechanic: "hit", equationId: "eq-at-capture" };
  const spin: RecordedMechanicDraft = { ...hit, id: "stable-spin", mechanic: "spin", tick: 8.123, endTick: 9.875, spinTargets: [{ tokenIndex: 0 }] };
  const drag: RecordedMechanicDraft = { ...hit, id: "stable-drag", mechanic: "drag", tick: 11, endTick: 12.999, dragTargets: [{ tokenIndex: 2, sourceHitId: hit.id }] };
  const before = JSON.stringify([hit, spin, drag]);
  const committed = groupRecordedDrafts([hit, spin, drag], equations);
  assert.equal(committed.mechanicInstances.hit[0].equation?.id, "eq-at-capture");
  assert.equal(committed.assignments.drag?.id, "eq-at-capture");
  assert.equal(committed.mechanicInstances.hit[0].id, hit.id);
  assert.equal(committed.mechanicInstances.hit[0].tick, 6.321);
  assert.equal(committed.mechanicInstances.hit[0].endTick, undefined);
  assert.equal(committed.mechanicInstances.spin[0].endTick, 9.875);
  assert.equal(committed.mechanicInstances.drag[0].endTick, 12.999);
  assert.equal(committed.mechanicInstances.drag[0].dragTargets[0].sourceHitId, hit.id);
  assert.equal(JSON.stringify([hit, spin, drag]), before);
});

test("finalizing never substitutes another equation for an unresolved or mixed captured identity", () => {
  const equations = [{ id: "a" }, { id: "b" }];
  const first: RecordedMechanicDraft = { ...base(), mechanic: "hit", equationId: "a" };
  const second = { ...first, id: "second", equationId: "b" };
  const mixed = groupRecordedDrafts([first, second], equations);
  assert.equal(mixed.assignments.hit, null);
  assert.deepEqual(mixed.mechanicInstances.hit.map(instance => instance.equation?.id), ["a", "b"]);
  const missing = groupRecordedDrafts([{ ...first, equationId: "missing" }], equations);
  assert.equal(missing.mechanicInstances.hit[0].equation, null);
  assert.equal(missing.mechanicInstances.hit[0].equationId, "missing");
  assert.equal(missing.assignments.hit, null);
});

test("recorded Hit, Spin and Drag survive the real authored serializer and hydration", () => {
  const equation = { id: "captured-equation", tokens: ["x", "+", "2", "=", "7"].map((label, index) => ({ id: `term-${index}`, label })) };
  const hit: RecordedMechanicDraft = { ...base(), id: "recorded-hit", mechanic: "hit", tick: 6, equationId: equation.id,
    hitBubbles: [{ tokenIndex: 0, targetId: "term-0", pads: ["top"], positions: ["top"], padLayoutVersion: 2 }] };
  const spin: RecordedMechanicDraft = { ...base(), id: "recorded-spin", mechanic: "spin", tick: 8, endTick: 9, equationId: equation.id, spinTargets: [{ tokenIndex: 0 }] };
  const drag: RecordedMechanicDraft = { ...base(), id: "recorded-drag", mechanic: "drag", tick: 11, endTick: 12, equationId: equation.id, dragTargets: [{ tokenIndex: 2, sourceHitId: hit.id }] };
  const projected = groupRecordedDrafts([hit, spin, drag], [equation]);
  const event: AuthoredTimelineEvent = { id: "recorded-event", tick: 6, endTick: 12, counts: { hit: 1, spin: 1, drag: 1 }, ...projected };
  const clock = createLessonClock('[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n');
  const saved = serializeAuthoredLesson([event], { songAssetId: "garden", activityKey: "early-algebra", revision: "recording-revision" }, clock, 16, [equation], { forPublish: true });
  assert.deepEqual(saved.encounters.map(encounter => encounter.equationId), [equation.id, equation.id, equation.id]);
  const reopened = timelineEventsFromAuthoredLesson(parseAuthoredLessonDraft(JSON.parse(JSON.stringify(saved))), clock).events[0];
  assert.equal(reopened.id, event.id);
  for (const mechanic of ["hit", "spin", "drag"] as const) {
    const actual = reopened.mechanicInstances![mechanic]![0];
    const expected = projected.mechanicInstances[mechanic][0];
    assert.equal(actual.id, expected.id);
    assert.equal(actual.equation?.id, equation.id);
    assert.equal(actual.tick, expected.tick);
    assert.equal(actual.endTick, expected.endTick);
    assert.equal(inputFromEvent(reopened, mechanic, actual).endTick, mechanic === "hit" ? expected.tick : expected.endTick);
  }
  assert.deepEqual(reopened.mechanicInstances!.hit![0].hitBubbles?.[0].pads, ["top"]);
  assert.equal(reopened.mechanicInstances!.hit![0].hitBubbles?.[0].padLayoutVersion, 2);
  assert.equal(reopened.mechanicInstances!.drag![0].dragTargets?.[0].sourceHitId, hit.id);
});
