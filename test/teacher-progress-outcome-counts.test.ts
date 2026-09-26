import assert from "node:assert/strict";
import test from "node:test";

import { summarizePlayerRunOutcomeCounts } from "../lib/teacher-progress";

test("teacher progress treats v2 and step-detailed v3 completions as verified", () => {
  assert.deepEqual(summarizePlayerRunOutcomeCounts([
    { outcome: "completed", completionVersion: 2 },
    { outcome: "completed", completionVersion: 3 },
    { outcome: "completed", completionVersion: null },
    { outcome: "failed", completionVersion: 2 },
    { outcome: "abandoned", completionVersion: null },
  ]), {
    completedCount: 2,
    unverifiedCompletedCount: 1,
    failedCount: 2,
  });
});
