import { resolveRequestedSongActivityKey } from "@/lib/song-activity-storage";
import { requireMatchingRevision } from "@/lib/song-launch-identity";

type SignedStorageRef = {
  bucket: string;
  path: string;
  signedUrl: string;
};

type SongChartTargets = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string;
  sidecarPath: string;
  authorId?: string;
  revision?: string;
};

type BlankSongChartPackage = {
  chart: SignedStorageRef;
  sidecar: SignedStorageRef;
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
  authorId,
  revision,
  allowBlankPackage = false,
  loadSongAsset,
  loadSongChart,
  loadBlankSongChart,
  createSignedUrl,
}: {
  songAssetId: string;
  activityKey: string;
  authorId: string | null;
  revision?: string | null;
  allowBlankPackage?: boolean;
  loadSongAsset: (id: string) => Promise<Record<string, unknown> | null>;
  loadSongChart: (
    songAssetId: string,
    activityKey: string,
    authorId: string | null,
  ) => Promise<SongChartTargets | null>;
  // Optional fallback used when no chart has been authored yet: supplies
  // pre-built refs (e.g. blank-content URLs under the prospective storage
  // paths) instead of rejecting. Nothing is persisted by this fallback.
  loadBlankSongChart?: (
    songAssetId: string,
    activityKey: string,
  ) => Promise<BlankSongChartPackage | null>;
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

  const audioBucket = readRequiredString(songAsset.songBucket, "songBucket");
  const audioPath = readRequiredString(songAsset.songPath, "songPath");

  const chartTargets = await loadSongChart(canonicalSongAssetId, requestedActivityKey, authorId);

  if (!chartTargets) {
    if (!allowBlankPackage) {
      throw new Error(
        `No chart has been authored for ${requestedActivityKey}; blank editor content is not playable`,
      );
    }

    const blankTargets =
      (await loadBlankSongChart?.(canonicalSongAssetId, requestedActivityKey)) ?? null;

    if (!blankTargets) {
      throw new Error(`No chart has been authored for ${requestedActivityKey} yet`);
    }

    const blankAudioUrl = await createSignedUrl(audioBucket, audioPath);

    return {
      songAssetId: canonicalSongAssetId,
      activityKey: requestedActivityKey,
      ...(authorId ? { authorId } : {}),
      chart: blankTargets.chart,
      sidecar: blankTargets.sidecar,
      audio: {
        bucket: audioBucket,
        path: audioPath,
        signedUrl: blankAudioUrl,
      } satisfies SignedStorageRef,
    };
  }

  const resolvedRevision = requireMatchingRevision(
    chartTargets.chartPath,
    chartTargets.sidecarPath,
    revision,
  );
  if (chartTargets.revision && chartTargets.revision !== resolvedRevision) {
    throw new Error("Launch package chart target revision does not match its storage path");
  }
  if (authorId && chartTargets.authorId && chartTargets.authorId !== authorId) {
    throw new Error("Launch package author does not match the requested author");
  }

  const [chartUrl, sidecarUrl, audioUrl] = await Promise.all([
    createSignedUrl(chartTargets.chartBucket, chartTargets.chartPath),
    createSignedUrl(chartTargets.sidecarBucket, chartTargets.sidecarPath),
    createSignedUrl(audioBucket, audioPath),
  ]);

  return {
    songAssetId: canonicalSongAssetId,
    activityKey: requestedActivityKey,
    authorId: chartTargets.authorId ?? authorId ?? "",
    revision: chartTargets.revision ?? resolvedRevision,
    chart: {
      bucket: chartTargets.chartBucket,
      path: chartTargets.chartPath,
      signedUrl: chartUrl,
    } satisfies SignedStorageRef,
    sidecar: {
      bucket: chartTargets.sidecarBucket,
      path: chartTargets.sidecarPath,
      signedUrl: sidecarUrl,
    } satisfies SignedStorageRef,
    audio: {
      bucket: audioBucket,
      path: audioPath,
      signedUrl: audioUrl,
    } satisfies SignedStorageRef,
  };
}

