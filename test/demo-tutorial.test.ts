import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { shouldShowDemoDraftReentryTutorial } from "../lib/demo-tutorial";

const lessonBuilderSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/LessonBuilderClient.tsx"),
  "utf8",
);
const studentCopySource = readFileSync(join(process.cwd(), "lib/student-copy.ts"), "utf8");

test("a returning Early Algebra demo editor opens the short tutorial", () => {
  assert.equal(shouldShowDemoDraftReentryTutorial({
    isDemoMode: true,
    entryIntent: "personalize",
    hasRestoredDraft: true,
    activityKey: "early-algebra",
  }), true);
});

test("a returning Number Bonds demo editor opens the short tutorial", () => {
  assert.equal(shouldShowDemoDraftReentryTutorial({
    isDemoMode: true,
    entryIntent: "personalize",
    hasRestoredDraft: true,
    activityKey: "number-bonds",
  }), true);
});

test("first-time, play-only, and non-demo visits do not interrupt play with the re-entry tutorial", () => {
  const base = {
    isDemoMode: true,
    entryIntent: "personalize",
    hasRestoredDraft: true,
    activityKey: "early-algebra",
  } as const;

  assert.equal(shouldShowDemoDraftReentryTutorial({ ...base, hasRestoredDraft: false }), false);
  assert.equal(shouldShowDemoDraftReentryTutorial({ ...base, entryIntent: "play" }), false);
  assert.equal(shouldShowDemoDraftReentryTutorial({ ...base, isDemoMode: false }), false);
  assert.equal(shouldShowDemoDraftReentryTutorial({ ...base, activityKey: "other" }), false);
});

test("the builder starts the welcome prompt only after a saved demo draft is restored", () => {
  assert.match(lessonBuilderSource, /shouldShowDemoDraftReentryTutorial\(/);
  assert.match(lessonBuilderSource, /readDemoLessonDraft\(window\.localStorage, selectedSongStorage\.id, activityKey\)/);
  assert.match(lessonBuilderSource, /setTutorialStep\("welcome"\)/);
  assert.match(studentCopySource, /demoReentryTutorial: "Welcome back\. Your lesson is saved on this device\./);
});
