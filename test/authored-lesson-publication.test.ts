import assert from "node:assert/strict";
import test from "node:test";

import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";

test("server publication rejects an equation-only Algebra sidecar", () => {
  const sidecarContent = JSON.stringify({
    version: 3,
    mode: "authored",
    songAssetId: "song-1",
    activityKey: "early-algebra",
    equations: [{ id: "eq-1", state: "x+1=2" }],
    encounters: [],
  });

  assert.throws(
    () => prepareAuthoredLessonForPublication({
      sidecarContent,
      identity: { songAssetId: "song-1", activityKey: "early-algebra", authorId: "author-1", revision: "rev-1" },
    }),
    /at least one encounter/i,
  );
});
