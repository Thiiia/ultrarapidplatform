import { prisma } from "@/lib/prisma";
import {
  getSongAssetPathsForActivity,
  resolveRequestedSongActivityKey,
  resolveRequestedSongActivityPackage,
  resolveSongAssetStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type SongChoice = {
  id: string;
  activityKey: SongActivityKey;
  name: string;
  title: string;
  artist: string | null;
  path: string;
  signedUrl: string;
  size: number | null;
  contentType: string | null;
  updatedAt: string | null;
  durationSeconds: number | null;

  song: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  chart: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  sidecar: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  } | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

async function createSignedUrl(bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Unable to create signed URL for ${bucket}/${path}: ${
        error?.message ?? "Unknown error"
      }`,
    );
  }

  return data.signedUrl;
}

function dedupePaths(paths: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return paths.filter((path): path is string => {
    if (!path) {
      return false;
    }

    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) {
      return false;
    }

    seen.add(trimmed);
    return true;
  });
}

function toEncountersSidecarPath(chartPath: string) {
  return chartPath.replace(/\.chart$/i, ".encounters.json");
}

async function createOptionalSignedUrlFromCandidates(
  bucket: string | null,
  candidatePaths: string[],
) {
  if (!bucket) {
    return null;
  }

  for (const candidatePath of dedupePaths(candidatePaths)) {
    try {
      const signedUrl = await createSignedUrl(bucket, candidatePath);
      return {
        path: candidatePath,
        signedUrl,
      };
    } catch {
      // Continue trying other candidate paths.
    }
  }

  return null;
}

type ResolvedChartAndSidecar = {
  chart: {
    path: string;
    signedUrl: string;
  };
  sidecar: {
    bucket: string;
    path: string;
    signedUrl: string;
  } | null;
};

function buildSidecarBucketCandidates(bucket: string | null) {
  return dedupePaths([
    bucket,
    "SidecarJsons",
    "Sidecar jsons",
    "SidecarJSONs",
  ]);
}

async function createOptionalSignedUrlFromBucketAndPathCandidates(
  bucketCandidates: string[],
  pathCandidates: string[],
) {
  for (const candidateBucket of bucketCandidates) {
    const signed = await createOptionalSignedUrlFromCandidates(
      candidateBucket,
      pathCandidates,
    );

    if (signed) {
      return {
        bucket: candidateBucket,
        path: signed.path,
        signedUrl: signed.signedUrl,
      };
    }
  }

  return null;
}

async function resolveChartAndSidecarForSongAsset({
  songAssetRecord,
  chartBucket,
  sidecarBucket,
  activityKey,
}: {
  songAssetRecord: Record<string, unknown>;
  chartBucket: string;
  sidecarBucket: string | null;
  activityKey: SongActivityKey;
}): Promise<ResolvedChartAndSidecar> {
  const candidatePaths = getSongAssetPathsForActivity(songAssetRecord, activityKey);

  const validatedPackage = resolveRequestedSongActivityPackage({
    requestedActivityKey: activityKey,
    chartPath: candidatePaths.chartPath,
    sidecarPath: candidatePaths.sidecarPath,
  });

  const chartSignedUrl = await createSignedUrl(chartBucket, validatedPackage.chartPath);

  const inferredSidecarPath = resolveSongAssetStoragePaths({
    activityKey,
    chartPath: validatedPackage.chartPath,
    sidecarPath: null,
  }).sidecarPath;
  const inferredEncountersSidecarPath = toEncountersSidecarPath(inferredSidecarPath);

  const sidecarCandidatePaths = dedupePaths([
    validatedPackage.sidecarPath,
    inferredSidecarPath,
    inferredEncountersSidecarPath,
  ]);
  const sidecarBucketCandidates = buildSidecarBucketCandidates(sidecarBucket);

  const sidecar = await createOptionalSignedUrlFromBucketAndPathCandidates(
    sidecarBucketCandidates,
    sidecarCandidatePaths,
  );

  return {
    chart: {
      path: validatedPackage.chartPath,
      signedUrl: chartSignedUrl,
    },
    sidecar: sidecar
      ? {
          bucket: sidecar.bucket,
          path: sidecar.path,
          signedUrl: sidecar.signedUrl,
        }
      : null,
  };
}

async function getFileMetadata(bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const folder = path.split("/").slice(0, -1).join("/");
  const fileName = path.split("/").pop();

  const { data } = await supabaseAdmin.storage.from(bucket).list(folder || undefined, {
    search: fileName,
    limit: 1,
  });

  return data?.[0] ?? null;
}

function getContentTypeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "chart") return "text/plain";
  if (extension === "json") return "application/json";

  return null;
}

type StorageFileEntry = {
  path: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  updatedAt: string | null;
};

function isAudioStoragePath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension === "mp3" || extension === "wav" || extension === "ogg" || extension === "m4a";
}

async function listSongStorageFiles(bucket: string): Promise<StorageFileEntry[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const files: StorageFileEntry[] = [];
  const queue: string[] = [""];

  while (queue.length > 0) {
    const prefix = queue.shift() ?? "";
    let offset = 0;

    while (true) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix || undefined, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        throw new Error(`Unable to list files for ${bucket}/${prefix}: ${error.message}`);
      }

      const entries = data ?? [];

      entries.forEach((entry) => {
        const name = entry.name ?? "";
        if (!name) {
          return;
        }

        const fullPath = prefix ? `${prefix}/${name}` : name;
        const isFolder = !entry.id;

        if (isFolder) {
          queue.push(fullPath);
          return;
        }

        const metadata = (entry.metadata ?? null) as
          | {
              size?: number;
              mimetype?: string;
            }
          | null;

        files.push({
          path: fullPath,
          name,
          size: typeof metadata?.size === "number" ? metadata.size : null,
          mimeType: typeof metadata?.mimetype === "string" ? metadata.mimetype : null,
          updatedAt: entry.updated_at ?? null,
        });
      });

      if (entries.length < 100) {
        break;
      }

      offset += entries.length;
    }
  }

  return files;
}

export async function getSongChoices(
  requestedActivityKey?: string | null,
): Promise<SongChoice[]> {
  const preferredActivityKey = resolveRequestedSongActivityKey(
    requestedActivityKey,
  );

  if (!preferredActivityKey) {
    console.warn("Skipping song choices for invalid activity", { requestedActivityKey });
    return [];
  }

  const songAssets = await prisma.songAsset.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      title: "asc",
    },
  });

  const songAssetByPath = new Map(songAssets.map((songAsset) => [songAsset.songPath, songAsset]));
  const storageSongs = await listSongStorageFiles("Songs");
  const audioSongs = storageSongs
    .filter((entry) => isAudioStoragePath(entry.path))
    .sort((left, right) => left.path.localeCompare(right.path));

  const songs: Array<SongChoice | null> = await Promise.all(
    audioSongs.map(async (storageSong): Promise<SongChoice | null> => {
      const songAsset = songAssetByPath.get(storageSong.path);

      if (!songAsset) {
        console.warn("Skipping song in storage because no matching SongAsset row was found", {
          songPath: storageSong.path,
        });
        return null;
      }

      const songAssetRecord = songAsset as unknown as Record<string, unknown>;
      const selectedPaths = getSongAssetPathsForActivity(songAssetRecord, preferredActivityKey);

      if (!selectedPaths.chartPath) {
        console.warn(
          "Skipping song asset with missing chart path for activity",
          {
            songAssetId: songAsset.id,
            title: songAsset.title,
            activityKey: selectedPaths.activityKey,
          },
        );
        return null;
      }

      try {
        const [songSignedUrl, resolvedChartAndSidecar, songMetadata] =
          await Promise.all([
            createSignedUrl(songAsset.songBucket, storageSong.path),
            resolveChartAndSidecarForSongAsset({
              songAssetRecord,
              chartBucket: songAsset.chartBucket,
              sidecarBucket: songAsset.sidecarBucket,
              activityKey: preferredActivityKey,
            }),
            getFileMetadata(songAsset.songBucket, storageSong.path),
          ]);

        const metadata = songMetadata?.metadata as Record<string, unknown> | undefined;

        const songContentType =
          storageSong.mimeType ??
          (typeof metadata?.mimetype === "string"
            ? metadata.mimetype
            : getContentTypeFromPath(storageSong.path));

        return {
          id: songAsset.id,
          activityKey: preferredActivityKey,
          name: songAsset.title,
          title: songAsset.title,
          artist: songAsset.artist,
          path: storageSong.path,
          signedUrl: songSignedUrl,
          size:
            storageSong.size ??
            (typeof metadata?.size === "number" ? metadata.size : null),
          contentType: songContentType,
          updatedAt: storageSong.updatedAt ?? songAsset.updatedAt.toISOString(),
          durationSeconds: songAsset.durationSeconds,

          song: {
            bucket: songAsset.songBucket,
            path: storageSong.path,
            signedUrl: songSignedUrl,
            contentType: songContentType,
          },

          chart: {
            bucket: songAsset.chartBucket,
            path: resolvedChartAndSidecar.chart.path,
            signedUrl: resolvedChartAndSidecar.chart.signedUrl,
            contentType: getContentTypeFromPath(resolvedChartAndSidecar.chart.path),
          },

          sidecar:
            resolvedChartAndSidecar.sidecar
              ? {
                  bucket: resolvedChartAndSidecar.sidecar.bucket,
                  path: resolvedChartAndSidecar.sidecar.path,
                  signedUrl: resolvedChartAndSidecar.sidecar.signedUrl,
                  contentType: getContentTypeFromPath(resolvedChartAndSidecar.sidecar.path),
                }
              : null,
        };
      } catch (error) {
        console.error(
          "Skipping invalid song asset while loading song choices",
          {
            songAssetId: songAsset.id,
            title: songAsset.title,
            songPath: storageSong.path,
            chartPath: selectedPaths.chartPath,
            error: getErrorMessage(error),
          },
        );

        return null;
      }
    }),
  );

  return songs.filter(isNonNull);
}
