import assert from "node:assert/strict";
import test from "node:test";
import { getAuthoringLessonSaveFailureMessage } from "../lib/editor/lesson-save-error";

test("lesson validation errors are shown as actionable author feedback", () => {
  assert.equal(
    getAuthoringLessonSaveFailureMessage(400, "Number Bonds timing gem_spacing: move the next cue."),
    "Could not save yet: Number Bonds timing gem_spacing: move the next cue.",
  );
});

test("save conflicts ask the author to reload rather than replaying stale edits", () => {
  assert.equal(
    getAuthoringLessonSaveFailureMessage(409, "revision conflict"),
    "Save conflict: revision conflict",
  );
});

test("infrastructure failures remain generic and validation details are bounded", () => {
  assert.equal(getAuthoringLessonSaveFailureMessage(503, "database unavailable"), null);
  const message = getAuthoringLessonSaveFailureMessage(400, "x".repeat(400));
  assert.equal(message?.length, "Could not save yet: ".length + 280 + 1);
  assert.ok(message?.endsWith("…"));
});
