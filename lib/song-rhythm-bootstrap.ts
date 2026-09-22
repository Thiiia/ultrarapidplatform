import { createHash } from "node:crypto";

export type RhythmSourceRevision = {
  revision: string;
  songAssetId: string;
  activityKey: string;
  status: string;
  chartBucket: string;
  chartPath: string;
  chartSha256: string | null;
  audioSha256: string | null;
};

export type ResolvedRhythmSource = {
  chartContent: string;
  chartSha256: string;
  audioSha256: string;
  sourceActivityKey: string;
  sourceRevision: string;
};

function requiredSha256(value: string | null, label: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`The rhythm source revision requires a valid ${label}`);
  }
  return normalized;
}

/**
 * Resolve an immutable rhythm source without granting its storage path write
 * authority to the target activity. Only chart bytes and verified hashes cross
 * this boundary; the source sidecar is deliberately absent from the contract.
 */
export async function resolveRhythmSourceRevision({
  songAssetId,
  targetActivityKey,
  sourceActivityKey,
  sourceRevision,
  findRevision,
  readChart,
}: {
  songAssetId: string;
  targetActivityKey: string;
  sourceActivityKey: string;
  sourceRevision: string;
  findRevision: (revision: string) => Promise<RhythmSourceRevision | null>;
  readChart: (bucket: string, path: string) => Promise<string>;
}): Promise<ResolvedRhythmSource> {
  if (sourceActivityKey === targetActivityKey) {
    throw new Error("A shared rhythm bootstrap requires a different target activity");
  }

  const source = await findRevision(sourceRevision);
  if (!source) {
    throw new Error("The requested rhythm source revision was not found");
  }
  if (source.revision !== sourceRevision) {
    throw new Error("The rhythm source revision identity did not match the request");
  }
  if (source.status.toLowerCase() !== "ready") {
    throw new Error("The rhythm source revision must be READY");
  }
  if (source.songAssetId !== songAssetId) {
    throw new Error("The rhythm source revision does not belong to the requested song");
  }
  if (source.activityKey !== sourceActivityKey) {
    throw new Error("The rhythm source revision does not match the requested source activity");
  }

  const expectedChartSha256 = requiredSha256(source.chartSha256, "chart SHA-256");
  const audioSha256 = requiredSha256(source.audioSha256, "audio SHA-256");
  const chartContent = await readChart(source.chartBucket, source.chartPath);
  const chartSha256 = createHash("sha256").update(chartContent, "utf8").digest("hex");
  if (chartSha256 !== expectedChartSha256) {
    throw new Error("The immutable rhythm source chart hash mismatch blocked publication");
  }

  return {
    chartContent,
    chartSha256,
    audioSha256,
    sourceActivityKey,
    sourceRevision,
  };
}
