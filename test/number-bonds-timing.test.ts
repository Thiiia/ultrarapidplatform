import assert from "node:assert/strict";
import test from "node:test";

import {
  authoredStopBufferSeconds,
  resolveNumberBondsStopAtSeconds,
  validateNumberBondsTiming,
} from "../lib/number-bonds-timing";
import { validateAuthoredActivityTiming } from "../lib/activity-authoring-capabilities";
import { createLessonClock } from "../lib/editor/lesson-timing";

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

test("automatic stop follows the chart tick when a rounded editor time lands earlier", () => {
  const clock = createLessonClock('[Song]\n{\n  Resolution = 192\n}\n[SyncTrack]\n{\n  0 = B 123000\n}');
  const editorHitSeconds = 6.001;
  const runtimeHitSeconds = clock.toSeconds(clock.toTick(editorHitSeconds));
  assert.ok(runtimeHitSeconds > editorHitSeconds);
  assert.equal(validateNumberBondsTiming([{ id: "last", startSeconds: runtimeHitSeconds }], editorHitSeconds + 12)[0]?.code, "gem_tail");
  const stopAtSeconds = resolveNumberBondsStopAtSeconds([editorHitSeconds], editorHitSeconds + 12, clock);
  assert.deepEqual(validateNumberBondsTiming([{ id: "last", startSeconds: runtimeHitSeconds }], stopAtSeconds), []);
});

test("editor guidance delegates every timing decision to the shared readiness and publication validator", () => {
  const cues = [
    { id: "late", startSeconds: 19 },
    { id: "non-finite", startSeconds: Number.NaN },
    { id: "same-time", startSeconds: 19 },
    { id: "too-close", startSeconds: 22 },
  ];
  const shared = validateAuthoredActivityTiming(
    "number-bonds",
    cues.map((cue) => ({ ...cue, type: "hit" as const })),
    20,
  );
  const editor = validateNumberBondsTiming(cues, 20).map(({ message: _message, ...issue }) => issue);

  assert.deepEqual(editor, shared);
});
