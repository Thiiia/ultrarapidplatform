import {
  getSongAssetPathsForActivity,
  resolveRequestedSongActivityKey,
  resolveRequestedSongActivityPackage,
} from "@/lib/song-activity-storage";

type SignedStorageRef = {
  bucket: string;
  path: string;
  signedUrl: string;
};

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

export async function resolveFreshSongLaunchPackage({
  songAssetId,
  activityKey,
  loadSongAsset,
  createSignedUrl,
}: {
  songAssetId: string;
  activityKey: string;
  loadSongAsset: (id: string) => Promise<Record<string, unknown> | null>;
  createSignedUrl: (bucket: string, path: string) => Promise<string>;
}) {
  const canonicalSongAssetId = readRequiredString(songAssetId, "songAssetId").toLowerCase();
  const songAsset = await loadSongAsset(canonicalSongAssetId);

  if (!songAsset || songAsset.isActive !== true) {
    throw new Error("Song not found");
  }

  if (readRequiredString(songAsset.id, "song asset id") !== canonicalSongAssetId) {
    throw new Error("Song identifier is not canonical");
  }

  const requestedActivityKey = resolveRequestedSongActivityKey(activityKey);

  if (!requestedActivityKey) {
    throw new Error(`Unsupported song activity: ${activityKey}`);
  }

  const requestedPackage = getSongAssetPathsForActivity(
    songAsset,
    requestedActivityKey,
  );

  const activityPackage = resolveRequestedSongActivityPackage({
    requestedActivityKey: activityKey,
    chartPath: requestedPackage.chartPath,
    sidecarPath: requestedPackage.sidecarPath,
  });

  if (!activityPackage.sidecarPath) {
    throw new Error(`Missing sidecar path for ${activityPackage.activityKey}`);
  }

  const chartBucket = readRequiredString(songAsset.chartBucket, "chartBucket");
  const sidecarBucket = readRequiredString(songAsset.sidecarBucket, "sidecarBucket");
  const audioBucket = readRequiredString(songAsset.songBucket, "songBucket");
  const audioPath = readRequiredString(songAsset.songPath, "songPath");

  const [chartUrl, sidecarUrl, audioUrl] = await Promise.all([
    createSignedUrl(chartBucket, activityPackage.chartPath),
    createSignedUrl(sidecarBucket, activityPackage.sidecarPath),
    createSignedUrl(audioBucket, audioPath),
  ]);

  return {
    songAssetId: canonicalSongAssetId,
    activityKey: activityPackage.activityKey,
    chart: {
      bucket: chartBucket,
      path: activityPackage.chartPath,
      signedUrl: chartUrl,
    } satisfies SignedStorageRef,
    sidecar: {
      bucket: sidecarBucket,
      path: activityPackage.sidecarPath,
      signedUrl: sidecarUrl,
    } satisfies SignedStorageRef,
    audio: {
      bucket: audioBucket,
      path: audioPath,
      signedUrl: audioUrl,
    } satisfies SignedStorageRef,
  };
}
