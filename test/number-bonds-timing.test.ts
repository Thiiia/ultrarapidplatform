import assert from "node:assert/strict";
import test from "node:test";

import {
  authoredStopBufferSeconds,
  validateNumberBondsTiming,
} from "../lib/number-bonds-timing";

test("Number Bonds uses a full final interaction tail", () => {
  assert.equal(authoredStopBufferSeconds("number-bonds"), 12);
  assert.equal(authoredStopBufferSeconds("early-algebra"), 5);
  assert.deepEqual(validateNumberBondsTiming([
    { id: "first", startSeconds: 10 },
    { id: "second", startSeconds: 17.5 },
  ], 29.5), []);
});

test("Number Bonds identifies too-close and simultaneous gems", () => {
  assert.equal(validateNumberBondsTiming([
    { id: "first", startSeconds: 10 },
    { id: "second", startSeconds: 17.499 },
  ], 30)[0]?.code, "gem_spacing");
  assert.equal(validateNumberBondsTiming([
    { id: "first", startSeconds: 10 },
    { id: "second", startSeconds: 10 },
  ], 30)[0]?.code, "simultaneous_hits");
});

test("Number Bonds rejects a stop before the final gem completes", () => {
  const hits = [{ id: "last", startSeconds: 17.5 }];
  assert.equal(validateNumberBondsTiming(hits, 29.499)[0]?.code, "gem_tail");
  assert.equal(validateNumberBondsTiming(hits, undefined)[0]?.code, "stop_required");
});
