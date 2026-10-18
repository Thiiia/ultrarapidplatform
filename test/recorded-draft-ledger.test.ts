import assert from "node:assert/strict";
import test from "node:test";
import { createRecordedDraftLedger } from "../lib/editor/recorded-draft-ledger";
import { groupRecordedDrafts, type RecordedMechanicDraft } from "../lib/editor/recorded-draft";
import { findNewTimingConflict } from "../lib/guided-authored-encounter";
import type { AuthoredTimelineEvent } from "../lib/authored-lesson-serialization";

test("batched input validates against the immediately preceding accepted draft", () => {
  const ledger = createRecordedDraftLedger<{ id: string; seconds: number }>();
  const capture = (id: string, seconds: number) => {
    if (ledger.getSnapshot().some(draft => Math.abs(draft.seconds - seconds) < .25)) return false;
    ledger.replace(current => [...current, { id, seconds }]);
    return true;
  };
  assert.equal(capture("hit-1", 6), true);
  assert.equal(capture("hit-2", 6), false);
  assert.equal(capture("hit-3", 7), true);
  assert.deepEqual(ledger.getSnapshot().map(draft => draft.id), ["hit-1", "hit-3"]);
});

test("clear, restore, repair and finalize see one coherent draft snapshot", () => {
  const ledger = createRecordedDraftLedger<{ id: string; end: number }>();
  const restored = [{ id: "spin", end: 7 }];
  ledger.replace(restored);
  let calls = 0;
  const published = ledger.replace(current => { calls++; return current.map(draft => ({ ...draft, end: 8 })); });
  assert.equal(calls, 1);
  assert.equal(ledger.getSnapshot(), published);
  assert.deepEqual(restored, [{ id: "spin", end: 7 }]);
  ledger.replace([]);
  ledger.replace(current => [...current, { id: "new-hit", end: 9 }]);
  assert.deepEqual(ledger.getSnapshot(), [{ id: "new-hit", end: 9 }]);
  ledger.replace(current => current.filter(draft => draft.id !== "new-hit"));
  assert.deepEqual(ledger.getSnapshot(), []);
});

test("failed updates preserve the previous snapshot and independent editors do not share drafts", () => {
  const first = createRecordedDraftLedger<string>();
  const second = createRecordedDraftLedger<string>();
  first.replace(["kept"]);
  assert.throws(() => first.replace(() => { throw new Error("rejected repair"); }));
  assert.deepEqual(first.getSnapshot(), ["kept"]);
  assert.deepEqual(second.getSnapshot(), []);
});

test("same-batch capture uses the actual Unity authoring collision validator", () => {
  const ledger = createRecordedDraftLedger<RecordedMechanicDraft>();
  const equation = { id: "eq", tokens: ["x", "+", "2", "=", "7"].map((label, index) => ({ id: `token-${index}`, label })) };
  const events = (drafts: RecordedMechanicDraft[]): AuthoredTimelineEvent[] => drafts.map(draft => ({
    id: draft.id, tick: draft.tick, counts: { hit: 1, spin: 0, drag: 0 }, ...groupRecordedDrafts([draft], [equation]),
  }));
  const capture = (id: string, seconds: number) => {
    const candidate: RecordedMechanicDraft = { id, mechanic: "hit", equationId: equation.id, tick: seconds,
      hitBubbles: [{ tokenIndex: 0, pads: ["top"], padLayoutVersion: 2 }], spinTargets: [], dragTargets: [] };
    const current = ledger.getSnapshot();
    const conflict = findNewTimingConflict(events(current), events([...current, candidate]), { activityKey: "early-algebra" });
    if (conflict) return conflict.code;
    ledger.replace([...current, candidate]);
    return "accepted";
  };
  assert.equal(capture("first", 8), "accepted");
  assert.notEqual(capture("too-close", 8.5), "accepted");
  assert.equal(capture("next", 12), "accepted");
  assert.deepEqual(ledger.getSnapshot().map(draft => draft.id), ["first", "next"]);
});
