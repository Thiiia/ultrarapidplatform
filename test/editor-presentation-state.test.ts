import assert from "node:assert/strict";
import test from "node:test";
import { getBondPresentationState, getRecorderPresentationState } from "../lib/editor/presentation-state";

test("recording labels distinguish actual prerequisites, ready, held, paused and unplaced work", () => {
  const base = { playing: false, rangeOpen: false, pending: null, drafts: 0 } as const;
  assert.equal(getRecorderPresentationState(base).phase, "idle");
  assert.equal(getRecorderPresentationState({ ...base, playing: true }).phase, "waiting-range");
  assert.equal(getRecorderPresentationState({ ...base, rangeOpen: true }).phase, "paused");
  assert.equal(getRecorderPresentationState({ ...base, playing: true, rangeOpen: true }).phase, "ready");
  assert.equal(getRecorderPresentationState({ ...base, drafts: 2 }).phase, "unsaved");
  for (const pending of ["spin", "drag"] as const) {
    assert.equal(getRecorderPresentationState({ ...base, playing: true, rangeOpen: true, pending }).phase, "capturing");
    assert.equal(getRecorderPresentationState({ ...base, rangeOpen: true, pending }).phase, "paused");
    assert.notEqual(getRecorderPresentationState({ ...base, playing: true, pending }).phase, "capturing");
  }
});

test("Number Bonds reports loading/error/preparing before readiness and distinguishes repair from empty", () => {
  const base = { loaded: true, error: false, preparing: false, ready: false, built: false };
  assert.equal(getBondPresentationState(base).phase, "empty");
  assert.equal(getBondPresentationState({ ...base, ready: true }).phase, "ready");
  assert.equal(getBondPresentationState({ ...base, built: true }).phase, "review");
  assert.equal(getBondPresentationState({ ...base, ready: true, preparing: true }).phase, "preparing");
  assert.equal(getBondPresentationState({ ...base, ready: true, loaded: false }).phase, "loading");
  assert.equal(getBondPresentationState({ ...base, ready: true, error: true }).phase, "error");
});
