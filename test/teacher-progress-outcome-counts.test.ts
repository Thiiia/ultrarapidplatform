import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TeacherProgressClient from "../app/teacher/progress/TeacherProgressClient";
import { summarizeStudentRunTimingJudgements } from "../lib/student-run-feedback";
import {
  findOutcomeForLaunchAttempt,
  projectTeacherRunProgress,
  summarizePlayerRunOutcomeCounts,
} from "../lib/teacher-progress";

test("teacher progress keeps terminal outcomes distinct and leaves unknown states unclassified", () => {
  assert.deepEqual(summarizePlayerRunOutcomeCounts([
    { outcome: "completed", completionVersion: 2 },
    { outcome: "completed", completionVersion: 3 },
    { outcome: "completed", completionVersion: null },
    { outcome: "failed", completionVersion: 2 },
    { outcome: "abandoned", completionVersion: null },
    { outcome: "cancelled", completionVersion: null },
    { outcome: "interrupted-by-legacy-client", completionVersion: null },
  ]), {
    completedCount: 2,
    unverifiedCompletedCount: 1,
    failedCount: 1,
    abandonedCount: 1,
    cancelledCount: 1,
    unclassifiedOutcomeCount: 1,
  });
});

test("teacher progress preserves maths achievement separately from incomplete authored coverage", () => {
  assert.deepEqual(projectTeacherRunProgress({
    outcome: "failed",
    completionVersion: 3,
    completedEvents: 17,
    requiredEvents: 32,
    solvedSets: 9,
    hitAttempts: 41,
    missionSteps: [
      { recordType: "authored-judgement", judgement: "perfect" },
      { recordType: "equation-transition", judgement: "perfect", performanceOutcomes: ["perfect", "good"] },
      { recordType: "performance", judgement: "miss" },
    ],
  }), {
    state: "failed",
    resultSaved: true,
    completedEvents: 17,
    requiredEvents: 32,
    solvedSets: 9,
    hitAttempts: 41,
    timingJudgements: { perfect: 1, good: 0, early: 0, late: 0, miss: 0 },
  });
});

test("authored timing summary ignores transition aggregates and non-judgement telemetry", () => {
  assert.deepEqual(summarizeStudentRunTimingJudgements([
    { recordType: "authored-judgement", judgement: "perfect" },
    { recordType: "authored-judgement", judgement: "good" },
    { recordType: "authored-judgement", judgement: "early" },
    { recordType: "authored-judgement", judgement: "late" },
    { recordType: "authored-judgement", judgement: "miss" },
    { recordType: "equation-transition", judgement: "solved", performanceOutcomes: ["perfect", "good"] },
    { recordType: "performance", judgement: "miss" },
    { recordType: "encounter-result", judgement: "completed" },
  ]), { perfect: 1, good: 1, early: 1, late: 1, miss: 1 });
  assert.equal(summarizeStudentRunTimingJudgements([]), null);
});

test("teacher progress reports saved completion payload version without asserting assignment credit", () => {
  assert.equal(projectTeacherRunProgress({
    outcome: "completed",
    completionVersion: 3,
    completedEvents: 32,
    requiredEvents: 32,
    solvedSets: 9,
    hitAttempts: 41,
  }).state, "completed");

  assert.equal(projectTeacherRunProgress({
    outcome: "completed",
    completionVersion: null,
    completedEvents: 12,
    requiredEvents: null,
    solvedSets: 3,
    hitAttempts: 10,
  }).state, "unverified-completion");
});

test("latest teacher progress is joined to the exact latest launch attempt", () => {
  const previousComplete = {
    launchAttemptId: "attempt-1",
    outcome: "completed",
    completionVersion: 3,
    completedEvents: 32,
    requiredEvents: 32,
    solvedSets: 9,
    hitAttempts: 50,
  };
  const latestPartial = {
    launchAttemptId: "attempt-2",
    outcome: "abandoned",
    completionVersion: 3,
    completedEvents: 7,
    requiredEvents: 32,
    solvedSets: 2,
    hitAttempts: 8,
  };

  const exactOutcome = findOutcomeForLaunchAttempt([previousComplete, latestPartial], "attempt-2");
  assert.equal(exactOutcome, latestPartial);
  assert.equal(projectTeacherRunProgress(exactOutcome).state, "abandoned");
  assert.equal(projectTeacherRunProgress(exactOutcome).solvedSets, 2);
});

test("missing latest outcome remains unknown instead of borrowing another run's progress", () => {
  assert.deepEqual(projectTeacherRunProgress(null), {
    state: "no-saved-result",
    resultSaved: false,
    completedEvents: null,
    requiredEvents: null,
    solvedSets: null,
    hitAttempts: null,
    timingJudgements: null,
  });
});

test("teacher progress renders maths, rhythm, and saved outcome state as separate facts", () => {
  const html = renderToStaticMarkup(createElement(TeacherProgressClient, {
    classes: [],
    navBasePath: "/teacher",
    selectedClass: {
      id: "class-1",
      name: "Year 6",
      students: [{
        id: "student-1",
        name: "Maya",
        email: "maya@example.com",
        schoolName: null,
        lastLoginAt: null,
        totalAttempts: 3,
        attemptsByActivity: [{ activityKey: "early-algebra", attempts: 3 }],
        latestRun: {
          state: "failed",
          resultSaved: true,
          completedEvents: 17,
          requiredEvents: 32,
          solvedSets: 9,
          hitAttempts: 41,
          timingJudgements: { perfect: 3, good: 1, early: 1, late: 2, miss: 0 },
        },
        completedEvents: 28,
        hitAttempts: 70,
        completedCount: 0,
        unverifiedCompletedCount: 0,
        failedCount: 1,
        abandonedCount: 2,
        cancelledCount: 3,
        unclassifiedOutcomeCount: 0,
        lastPlayed: {
          activityKey: "early-algebra",
          songTitle: "Garden",
          playedAt: new Date("2026-10-24T10:00:00.000Z"),
        },
      }],
    },
  }));

  assert.match(html, /Latest saved outcome:<\/strong> Failed outcome/);
  assert.match(html, /Math:<\/strong> 9 sets solved/);
  assert.match(html, /Rhythm:<\/strong> 17\/32 authored encounters/);
  assert.doesNotMatch(html, /Assignment credit|Verified completions/);
  assert.match(html, /Result saved/);
  assert.match(html, /Failed: <\/span>1/);
  assert.match(html, /Abandoned: <\/span>2/);
  assert.match(html, /Cancelled: <\/span>3/);
  assert.match(html, /Completed outcomes \(V2\/V3\)/);
  assert.match(html, /Authored timing: <\/span>Perfect 3/);
  assert.match(html, /Assistance and interruption details are not included in this saved outcome\./);
});
