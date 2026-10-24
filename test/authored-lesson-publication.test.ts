import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("server publication preserves multiple Hit prerequisites on one Drag target", () => {
  const sidecar = JSON.parse(readFileSync("test/fixtures/early-algebra-multi-source-v3.json", "utf8"));
  const result = prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(sidecar),
    identity: {
      songAssetId: sidecar.songAssetId,
      activityKey: "early-algebra",
      authorId: sidecar.authorId,
      revision: sidecar.revision,
    },
  });

  const published = JSON.parse(result.content);
  const drag = published.encounters.find((encounter: { type: string }) => encounter.type === "drag");
  assert.ok(drag);
  assert.equal(drag.dragTargets.length, 1);
  assert.equal(drag.dragTargets[0].sourceHitId, "hit-a");
  assert.deepEqual(drag.dragTargets[0].sourceHitIds, ["hit-a", "hit-b"]);
  assert.equal(result.counts.encounters, sidecar.encounters.length);
});
