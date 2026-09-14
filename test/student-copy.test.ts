import assert from "node:assert/strict";
import test from "node:test";
import { getLearnerFacingError, studentCopy } from "../lib/student-copy";

test("learner copy keeps infrastructure terms out of visible messages", () => {
  const visibleCopy = JSON.stringify(studentCopy);

  assert.doesNotMatch(visibleCopy, /Unity|Supabase|workspace|sidecar|\.chart|publish|revision/i);
  assert.match(studentCopy.dashboard.welcome("Mia"), /Welcome back, Mia/);
  assert.match(
    getLearnerFacingError(new Error("Saved files could not be verified"), studentCopy.editor.lessonSaveFailed),
    /could not save these changes/i,
  );
});
