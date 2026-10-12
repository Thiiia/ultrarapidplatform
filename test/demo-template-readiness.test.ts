import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SongLaunchRequestError } from "../lib/song-launch-client";
import { getDemoTemplateUnavailableReadiness } from "../lib/demo-template-readiness";

const lessonBuilderSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/LessonBuilderClient.tsx"),
  "utf8",
);
const studentCopySource = readFileSync(join(process.cwd(), "lib/student-copy.ts"), "utf8");

test("a missing demo lesson explains the song and selected difficulty", () => {
  const readiness = getDemoTemplateUnavailableReadiness(
    new SongLaunchRequestError("revision missing", "REVISION_NOT_FOUND", 404),
    { songTitle: "Garden", rhythmDifficultyKey: "ExpertSingle" },
  );

  assert.deepEqual(readiness, {
    state: "repairable",
    source: "authored",
    canLaunch: false,
    message: "No published lesson is ready for Garden at Expert. Choose another difficulty or song.",
  });
});

test("transient launch failures keep the published lesson retryable", () => {
  assert.equal(
    getDemoTemplateUnavailableReadiness(
      new SongLaunchRequestError("temporarily unavailable", "PACKAGE_UNAVAILABLE", 503),
      { songTitle: "Garden", rhythmDifficultyKey: "ExpertSingle" },
    ),
    null,
  );
});

test("unstructured errors do not change demo lesson readiness", () => {
  assert.equal(
    getDemoTemplateUnavailableReadiness(new Error("network disconnected"), {
      songTitle: "Garden",
      rhythmDifficultyKey: "ExpertSingle",
    }),
    null,
  );
});

test("the demo play control explains its readiness check and disables after a missing lesson", () => {
  assert.match(studentCopySource, /demoPlayLessonLabel: "Check & play"/);
  assert.match(studentCopySource, /demoPlayLessonAriaLabel: "Check this song at the selected difficulty and play it"/);
  assert.match(studentCopySource, /demoPlayLessonTitle: "Check whether a lesson is ready for this song and difficulty, then play it/);
  assert.match(lessonBuilderSource, /setLessonReadiness\(unavailableDemoTemplate\)/);
  assert.match(lessonBuilderSource, /onChooseAnotherSong=\{handleBackToSongChoice\}/);
  assert.match(lessonBuilderSource, /Choose another song from the lesson library/);
  assert.match(lessonBuilderSource, /isDemoLaunchUnavailable\s*\?\s*"Unavailable"/);
  assert.match(lessonBuilderSource, /lessonReadiness\?\.canLaunch !== false/);
  assert.match(lessonBuilderSource, /setLessonReadiness\(null\);[\s\S]{0,120}setNumberBondsRhythmDifficulty/);
});
