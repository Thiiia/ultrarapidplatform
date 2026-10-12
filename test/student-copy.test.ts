import assert from "node:assert/strict";
import test from "node:test";
import { getLearnerFacingError, studentCopy } from "../lib/student-copy";

test("learner copy keeps infrastructure terms out of visible messages", () => {
  const visibleStrings: string[] = [];
  function collectVisibleStrings(value: unknown) {
    if (typeof value === "string") {
      visibleStrings.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectVisibleStrings);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(collectVisibleStrings);
    }
  }
  collectVisibleStrings(studentCopy);
  const visibleCopy = visibleStrings.join("\n");

  assert.doesNotMatch(visibleCopy, /Unity|Supabase|workspace|sidecar|\.chart|publish|revision/i);
  assert.match(studentCopy.dashboard.welcome("Mia"), /Welcome back, Mia/);
  assert.match(
    getLearnerFacingError(new Error("Saved files could not be verified"), studentCopy.editor.lessonSaveFailed),
    /could not save these changes/i,
  );
});

test("runtime capability failures are not described as missing lesson files", () => {
  const error = Object.assign(new Error("The hosted Unity capability manifest could not be loaded."), {
    code: "RUNTIME_CAPABILITY_UNAVAILABLE",
    status: 503,
  });

  assert.equal(
    getLearnerFacingError(error, studentCopy.editor.lessonLoadFailed),
    studentCopy.game.runtimeUnavailable,
  );
  assert.doesNotMatch(studentCopy.game.runtimeUnavailable, /file|manifest|Unity|runtime capability/i);
});
