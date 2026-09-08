import assert from "node:assert/strict";
import test from "node:test";
import {
  checkSaveRevisionPrecondition,
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

test("save precondition: first save proceeds when nothing is published", () => {
  const result = checkSaveRevisionPrecondition("Felix/Early_Algebra/song.chart", null);
  assert.deepEqual(result, { ok: true, currentRevision: null });
});

test("save precondition: R1 to R2 succeeds when draft carries the published revision", () => {
  const result = checkSaveRevisionPrecondition(
    "Felix/Early_Algebra/revisions/rev-1/song.chart",
    "rev-1",
  );
  assert.deepEqual(result, { ok: true, currentRevision: "rev-1" });
});

test("save precondition: stale R1 fails after R2 is published", () => {
  const result = checkSaveRevisionPrecondition(
    "Felix/Early_Algebra/revisions/rev-2/song.chart",
    "rev-1",
  );
  assert.deepEqual(result, { ok: false, expected: "rev-1", found: "rev-2" });
});

test("save precondition: concurrent second save with the same base revision fails explicitly", () => {
  // Two editors both hold R1; the first publishes R2, the second's R1 is now stale.
  const result = checkSaveRevisionPrecondition(
    "Felix/Early_Algebra/revisions/rev-2/song.chart",
    "rev-1",
  );
  assert.equal(result.ok, false);
});
