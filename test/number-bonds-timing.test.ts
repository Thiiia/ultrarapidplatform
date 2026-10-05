import assert from "node:assert/strict";
import test from "node:test";

import {
  authoredStopBufferSeconds,
  resolveNumberBondsStopAtSeconds,
  validateNumberBondsTiming,
} from "../lib/number-bonds-timing";
import { validateAuthoredActivityTiming } from "../lib/activity-authoring-capabilities";
import { createLessonClock } from "../lib/editor/lesson-timing";
import {
  getNumberBondSequenceCapacity,
  planNumberBondSequenceCues,
  type NumberBondSequenceCueTiming,
} from "../lib/number-bonds-note-plan";

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

test("song-specific Number Bonds cues stay on the tempo grid across a tempo change", () => {
  const chart = [
    "[Song]",
    "{",
    "  Resolution = 192",
    "}",
    "[SyncTrack]",
    "{",
    "  0 = B 120000",
    "  7680 = B 80000",
    "}",
    "[ExpertSingle]",
    "{",
    "  2304 = N 0 0",
    "  9408 = N 1 0",
    "  11520 = N 2 0",
    "}",
  ].join("\n");
  const clock = createLessonClock(chart);
  const cues = planNumberBondSequenceCues(chart, "ExpertSingle", 60, 3);

  assert.ok(cues);
  assert.equal(getNumberBondSequenceCapacity(chart, "ExpertSingle", 60), 3);
  assert.deepEqual(cues.map((cue) => cue.hitTick), [2304, 9408, 11520]);
  const gridTicks = clock.ticksPerBeat / 16;

  for (let index = 0; index < cues.length; index += 1) {
    const cue: NumberBondSequenceCueTiming = cues[index]!;
    assert.equal(cue.spinStartTick % gridTicks, 0);
    assert.equal(cue.spinEndTick % gridTicks, 0);
    assert.equal(cue.dragStartTick % gridTicks, 0);
    assert.equal(cue.dragEndTick % gridTicks, 0);
    assert.ok(cue.spinStartSeconds >= cue.hitSeconds + 0.75);
    assert.ok(cue.spinStartTick < cue.spinEndTick);
    assert.ok(cue.spinEndTick < cue.dragStartTick);
    assert.ok(cue.dragStartTick < cue.dragEndTick);
    if (cues[index + 1]) {
      const nextCue: NumberBondSequenceCueTiming = cues[index + 1]!;
      assert.ok(cue.dragEndTick < nextCue.hitTick);
    }
    assert.ok(60 - cue.dragEndSeconds >= 12);
  }
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
