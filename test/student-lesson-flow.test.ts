import assert from "node:assert/strict";
import { test } from "node:test";
import * as studentLessonFlow from "../lib/student-lesson-flow";

test("student lesson links stay inside the selected dashboard route", () => {
  assert.equal(
    studentLessonFlow.getStudentAssignmentHref("/demo/student", "assignment one"),
    "/demo/student/lessons?assignmentId=assignment+one",
  );
  assert.equal(
    studentLessonFlow.getStudentMissionHref("/student", "mission-1"),
    "/student/lessons?missionId=mission-1",
  );
});

test("lesson outline reads legacy demo activities as safe text", () => {
  assert.deepEqual(
    studentLessonFlow.getMissionActivities({
      type: "lesson",
      activities: [
        { type: "practice", title: "Clap the Beat" },
        { type: "checkpoint", title: "Timing Check" },
        { type: "practice", title: "<script>alert(1)</script>" },
      ],
    }),
    [
      { title: "Clap the Beat", detail: "Practice" },
      { title: "Timing Check", detail: "Checkpoint" },
      { title: "<script>alert(1)</script>", detail: "Practice" },
    ],
  );
});

test("lesson outline supports authored blocks and ignores malformed entries", () => {
  assert.deepEqual(
    studentLessonFlow.getMissionActivities({
      version: "1.0",
      blocks: [
        { type: "text", text: "Keep both sides balanced." },
        { type: "checkpoint", label: "Check your answer" },
        { type: "unity_level", levelId: "level-1" },
        { type: "unknown", text: "ignore me" },
        null,
      ],
    }),
    [
      { title: "Lesson note", detail: "Keep both sides balanced." },
      { title: "Check your answer", detail: null },
      { title: "Learning activity", detail: null },
    ],
  );
});

test("activity mode labels come only from recognized mission tags", () => {
  assert.equal(
    studentLessonFlow.getMissionActivityLabel({ meta: { tags: ["activity:early-algebra"] } }),
    "Early Algebra",
  );
  assert.equal(
    studentLessonFlow.getMissionActivityLabel({ meta: { tags: ["activity:unrecognized"] } }),
    null,
  );
});
