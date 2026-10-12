import assert from "node:assert/strict";
import test from "node:test";
import { hasPlayableRevisionMetadata } from "../lib/playable-revision-metadata";

const playableRevision = {
  chartBucket: "Charts",
  chartPath: "dev/Early_Algebra/revisions/rev/Garden.chart",
  sidecarBucket: "SidecarJsons",
  sidecarPath: "dev/Early_Algebra/revisions/rev/Garden.encounters.json",
  chartSha256: "a".repeat(64),
  sidecarSha256: "b".repeat(64),
  audioSha256: "c".repeat(64),
  equationCount: 1,
  encounterCount: 3,
  targetCount: 1,
};

test("a complete revision with storage identities, hashes, and positive counts is playable", () => {
  assert.equal(hasPlayableRevisionMetadata(playableRevision), true);
});

test("missing storage identities or hashes make a revision unplayable", () => {
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, chartPath: "  " }), false);
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, sidecarBucket: null }), false);
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, audioSha256: "" }), false);
});

test("null, zero, fractional, and unsafe lesson counts make a revision unplayable", () => {
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, encounterCount: null }), false);
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, targetCount: 0 }), false);
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, equationCount: 1.5 }), false);
  assert.equal(hasPlayableRevisionMetadata({ ...playableRevision, encounterCount: Number.MAX_SAFE_INTEGER + 1 }), false);
});
