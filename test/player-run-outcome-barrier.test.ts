import assert from "node:assert/strict";
import test from "node:test";
import { PlayerRunOutcomeBarrier } from "@/lib/player-run-outcome-barrier";

test("a matching Retry waits for outcome persistence and then resumes", () => {
  const barrier = new PlayerRunOutcomeBarrier<{ type: string }>();
  const retry = { type: "retry" };

  barrier.begin("attempt-a");

  assert.equal(barrier.defer("attempt-a", retry), true);
  assert.equal(barrier.settle("attempt-b"), null);
  assert.deepEqual(barrier.settle("attempt-a"), retry);
});

test("a matching Return waits for outcome persistence and preserves the first terminal action", () => {
  const barrier = new PlayerRunOutcomeBarrier<{ type: string }>();
  const returned = { type: "return" };

  barrier.begin("attempt-a");

  assert.equal(barrier.defer("attempt-a", returned), true);
  assert.equal(barrier.defer("attempt-a", { type: "retry" }), true);
  assert.deepEqual(barrier.settle("attempt-a"), returned);
  assert.equal(barrier.settle("attempt-a"), null);
});

test("actions from another or already settled attempt are not deferred", () => {
  const barrier = new PlayerRunOutcomeBarrier<{ type: string }>();

  barrier.begin("attempt-a");

  assert.equal(barrier.defer("attempt-b", { type: "return" }), false);
  assert.equal(barrier.settle("attempt-a"), null);
  assert.equal(barrier.defer("attempt-a", { type: "retry" }), false);
});
