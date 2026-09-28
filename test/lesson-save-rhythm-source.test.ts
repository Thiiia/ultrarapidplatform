import assert from "node:assert/strict";
import test from "node:test";
import { resolveLessonSaveRhythmSource } from "../lib/lesson-save-rhythm-source";

const source = {
  activityKey: "early-algebra",
  revision: "ea-revision-1",
  chartSha256: "a".repeat(64),
  audioSha256: "b".repeat(64),
};

test("Number Bonds can advance from a newly selected Early Algebra source revision", () => {
  assert.deepEqual(
    resolveLessonSaveRhythmSource({
      activityKey: "number-bonds",
      chartSource: "shared-rhythm",
      resolvedRhythmSource: source,
      previousRhythmSource: null,
    }),
    source,
  );
});

test("sidecar-only Number Bonds saves preserve their verified source revision", () => {
  assert.deepEqual(
    resolveLessonSaveRhythmSource({
      activityKey: "number-bonds",
      chartSource: "preserved",
      resolvedRhythmSource: null,
      previousRhythmSource: source,
    }),
    source,
  );
});

test("Number Bonds cannot publish an independent chart or lose its rhythm source", () => {
  assert.throws(
    () =>
      resolveLessonSaveRhythmSource({
        activityKey: "number-bonds",
        chartSource: "submitted",
        resolvedRhythmSource: null,
        previousRhythmSource: null,
      }),
    /must reuse a verified Early Algebra rhythm chart/,
  );

  assert.throws(
    () =>
      resolveLessonSaveRhythmSource({
        activityKey: "number-bonds",
        chartSource: "preserved",
        resolvedRhythmSource: null,
        previousRhythmSource: null,
      }),
    /Choose an Early Algebra rhythm source/,
  );
});

test("Number Bonds rejects provenance from a different activity", () => {
  assert.throws(
    () =>
      resolveLessonSaveRhythmSource({
        activityKey: "number-bonds",
        chartSource: "shared-rhythm",
        resolvedRhythmSource: { ...source, activityKey: "number-bonds" },
        previousRhythmSource: null,
      }),
    /must point to an Early Algebra revision/,
  );
});

test("Early Algebra saves retain their existing optional provenance behavior", () => {
  assert.equal(
    resolveLessonSaveRhythmSource({
      activityKey: "early-algebra",
      chartSource: "submitted",
      resolvedRhythmSource: null,
      previousRhythmSource: source,
    }),
    null,
  );
});
