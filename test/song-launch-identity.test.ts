import assert from "node:assert/strict";
import test from "node:test";
import {
  extractRevisionFromStoragePath,
  requireMatchingRevision,
} from "../lib/song-launch-identity";

test("extracts the immutable revision from authored storage paths", () => {
  assert.equal(
    extractRevisionFromStoragePath("Felix/Early_Algebra/revisions/rev-7/song.chart"),
    "rev-7",
  );
});

test("rejects chart and sidecar paths from different revisions", () => {
  assert.throws(
    () =>
      requireMatchingRevision(
        "Felix/Early_Algebra/revisions/rev-7/song.chart",
        "Felix/Early_Algebra/revisions/rev-8/song.json",
      ),
    /revisions do not match/i,
  );
});

test("rejects a requested revision that is not the published revision", () => {
  assert.throws(
    () =>
      requireMatchingRevision(
        "Felix/Early_Algebra/revisions/rev-7/song.chart",
        "Felix/Early_Algebra/revisions/rev-7/song.json",
        "rev-6",
      ),
    /not the published revision/i,
  );
});
