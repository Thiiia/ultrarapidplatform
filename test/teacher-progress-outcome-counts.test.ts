import assert from "node:assert/strict";
import test from "node:test";

import { summarizePlayerRunOutcomeCounts } from "../lib/teacher-progress";

test("teacher progress separates verified v2 completions from legacy unversioned results", () => {
  assert.deepEqual(summarizePlayerRunOutcomeCounts([
    { outcome: "completed", completionVersion: 2 },
    { outcome: "completed", completionVersion: null },
    { outcome: "failed", completionVersion: 2 },
    { outcome: "abandoned", completionVersion: null },
  ]), {
    completedCount: 1,
    unverifiedCompletedCount: 1,
    failedCount: 2,
  });
});
