import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { resolveRhythmSourceRevision } from "../lib/song-rhythm-bootstrap";

const CHART = "[Song]\n{\n  Name = \"Jazz in the Maybach\"\n}\n";
const CHART_SHA = createHash("sha256").update(CHART, "utf8").digest("hex");
const AUDIO_SHA = "0b4eeff6cafe9b8608f541f378183e95fa75357f2ab29a9b62f103bfbbe2eeb5";

function sourceRevision(overrides: Record<string, unknown> = {}) {
  return {
    revision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
    songAssetId: "jazzmaybach",
    activityKey: "early-algebra",
    status: "ready",
    chartBucket: "Charts",
    chartPath: "dev/Early_Algebra/revisions/c958/Melika.chart",
    chartSha256: CHART_SHA,
    audioSha256: AUDIO_SHA,
    ...overrides,
  };
}

test("resolves an exact READY revision and verifies the authoritative chart bytes", async () => {
  const reads: Array<{ bucket: string; path: string }> = [];
  const result = await resolveRhythmSourceRevision({
    songAssetId: "jazzmaybach",
    targetActivityKey: "number-bonds",
    sourceActivityKey: "early-algebra",
    sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
    findRevision: async () => sourceRevision(),
    readChart: async (bucket, path) => {
      reads.push({ bucket, path });
      return CHART;
    },
  });

  assert.equal(result.chartContent, CHART);
  assert.equal(result.chartSha256, CHART_SHA);
  assert.equal(result.audioSha256, AUDIO_SHA);
  assert.equal(result.sourceActivityKey, "early-algebra");
  assert.equal(result.sourceRevision, "c9587d12-9a90-4509-9b74-5655caa05ea9");
  assert.deepEqual(reads, [{
    bucket: "Charts",
    path: "dev/Early_Algebra/revisions/c958/Melika.chart",
  }]);
});

for (const [name, overrides, expected] of [
  ["non-ready source", { status: "draft" }, "READY"],
  ["wrong song", { songAssetId: "waves" }, "requested song"],
  ["wrong activity", { activityKey: "missing-numbers" }, "source activity"],
  ["missing chart hash", { chartSha256: null }, "chart SHA-256"],
  ["missing audio hash", { audioSha256: null }, "audio SHA-256"],
] as const) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(
      resolveRhythmSourceRevision({
        songAssetId: "jazzmaybach",
        targetActivityKey: "number-bonds",
        sourceActivityKey: "early-algebra",
        sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
        findRevision: async () => sourceRevision(overrides),
        readChart: async () => CHART,
      }),
      new RegExp(expected, "i"),
    );
  });
}

test("rejects a shared-rhythm request that would publish back into the source activity", async () => {
  await assert.rejects(
    resolveRhythmSourceRevision({
      songAssetId: "jazzmaybach",
      targetActivityKey: "early-algebra",
      sourceActivityKey: "early-algebra",
      sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
      findRevision: async () => sourceRevision(),
      readChart: async () => CHART,
    }),
    /different target activity/i,
  );
});

test("rejects chart bytes that do not match the immutable source hash", async () => {
  await assert.rejects(
    resolveRhythmSourceRevision({
      songAssetId: "jazzmaybach",
      targetActivityKey: "number-bonds",
      sourceActivityKey: "early-algebra",
      sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
      findRevision: async () => sourceRevision(),
      readChart: async () => `${CHART}\n# changed`,
    }),
    /chart hash mismatch/i,
  );
});

test("rejects an unknown source revision before any storage read", async () => {
  let readAttempted = false;
  await assert.rejects(
    resolveRhythmSourceRevision({
      songAssetId: "jazzmaybach",
      targetActivityKey: "number-bonds",
      sourceActivityKey: "early-algebra",
      sourceRevision: "missing",
      findRevision: async () => null,
      readChart: async () => {
        readAttempted = true;
        return CHART;
      },
    }),
    /not found/i,
  );
  assert.equal(readAttempted, false);
});
