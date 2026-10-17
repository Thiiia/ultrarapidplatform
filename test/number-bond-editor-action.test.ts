import assert from "node:assert/strict";
import test from "node:test";
import { getNumberBondEditorAction } from "../lib/editor/number-bond-editor-action";

test("a built journey needing repair cannot implicitly rebuild on play", () => {
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: true, hasSequence: true }), "review");
});
test("ready saved lessons play with either supported content version", () => {
  for (const hasSequence of [true, false]) {
    assert.equal(getNumberBondEditorAction({ ready: true, matchingNotes: true, hasSequence }), "play");
  }
});
test("new targets and legacy incomplete lessons retain explicit building", () => {
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: false, hasSequence: true }), "build");
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: true, hasSequence: false }), "build");
  assert.equal(getNumberBondEditorAction({ ready: true, matchingNotes: false, hasSequence: true }), "build");
});
