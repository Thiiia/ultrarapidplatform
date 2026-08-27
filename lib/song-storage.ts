import { prisma } from "@/lib/prisma";
import {
  defaultSongActivityKey,
  getSongAssetPathsForActivity,
  normalizeSongActivityKey,
  resolveSongAssetStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const allSongActivityKeys: SongActivityKey[] = [
  "number-bonds",
  "equations",
  "missing-numbers",
  "early-algebra",
];

export type SongChoice = {
  id: string;
  songAssetId: string;
  variantId: string;
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

async function createOptionalSignedUrl(
  bucket: string | null,
  path: string | null,
): Promise<{ bucket: string; path: string; signedUrl: string } | null> {
  if (!bucket || !path) {
    return null;
  }

  try {
    return {
      bucket,
      path,
      signedUrl: await createSignedUrl(bucket, path),
    };
  } catch (error) {
    console.warn(`Skipping missing optional sidecar ${bucket}/${path}:`, error);
    return null;
  }
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

async function createSignedUrlFromCandidates(bucket: string, candidatePaths: string[]) {
  let lastError: unknown = null;

  for (const candidatePath of dedupePaths(candidatePaths)) {
    try {
      const signedUrl = await createSignedUrl(bucket, candidatePath);
      return {
        path: candidatePath,
        signedUrl,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Unable to create signed URL from candidate paths for ${bucket}`);
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
  preferredActivityKey,
  allowActivityFallback,
}: {
  songAssetRecord: Record<string, unknown>;
  chartBucket: string;
  sidecarBucket: string | null;
  preferredActivityKey: SongActivityKey;
  allowActivityFallback: boolean;
}): Promise<ResolvedChartAndSidecar> {
  const candidateActivityOrder: SongActivityKey[] = allowActivityFallback
    ? [
        preferredActivityKey,
        ...allSongActivityKeys.filter((key) => key !== preferredActivityKey),
      ]
    : [preferredActivityKey];

  let lastChartError: unknown = null;

  for (const candidateActivityKey of candidateActivityOrder) {
    const candidatePaths = getSongAssetPathsForActivity(
      songAssetRecord,
      candidateActivityKey,
    );

    if (!candidatePaths.chartPath) {
      continue;
    }

    try {
      const chartSignedUrl = await createSignedUrl(
        chartBucket,
        candidatePaths.chartPath,
      );

      const inferredSidecarPath = resolveSongAssetStoragePaths({
        activityKey: candidateActivityKey,
        chartPath: candidatePaths.chartPath,
        sidecarPath: null,
      }).sidecarPath;
      const inferredEncountersSidecarPath = toEncountersSidecarPath(
        inferredSidecarPath,
      );

      const sidecarCandidatePaths = dedupePaths([
        candidatePaths.sidecarPath,
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
          path: candidatePaths.chartPath,
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
    } catch (error) {
      lastChartError = error;
    }
  }

  if (lastChartError instanceof Error) {
    throw lastChartError;
  }

  throw new Error(`Unable to resolve chart for song asset from activity paths`);
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

function toVariantGameType(
  activityKey: SongActivityKey | null,
): "number_bonds" | "equations" | "missing_numbers" | "early_algebra" | null {
  switch (activityKey) {
    case "number-bonds":
      return "number_bonds";
    case "equations":
      return "equations";
    case "missing-numbers":
      return "missing_numbers";
    case "early-algebra":
      return "early_algebra";
    default:
      return null;
  }
}

export async function getSongChoices(
  requestedActivityKey?: string | null,
  currentUserId?: string | null,
): Promise<SongChoice[]> {
  const activityKey: SongActivityKey | null = normalizeSongActivityKey(
    requestedActivityKey,
  );
  const gameTypeFilter = toVariantGameType(activityKey);

  const where = currentUserId
    ? {
        AND: [
          {
            OR: [
              { ownerUserId: currentUserId },
              { isPublic: true },
              { shares: { some: { sharedWithUserId: currentUserId } } },
            ],
          },
          ...(gameTypeFilter ? [{ gameType: gameTypeFilter }] : []),
        ],
      }
    : {
        ...(gameTypeFilter ? { gameType: gameTypeFilter } : {}),
        isPublic: true,
      };

  const variants = await prisma.songAssetVariant.findMany({
    where,
    include: {
      songAsset: true,
    },
    orderBy: [{ songAsset: { title: "asc" } }, { createdAt: "desc" }],
  });

  const songs: Array<SongChoice | null> = await Promise.all(
    variants.map(async (variant): Promise<SongChoice | null> => {
      const songAsset = variant.songAsset;

      if (!songAsset || !songAsset.isActive) {
        return null;
      }

      try {
        const [songSignedUrl, songMetadata] = await Promise.all([
          createSignedUrl(songAsset.songBucket, songAsset.songPath),
          getFileMetadata(songAsset.songBucket, songAsset.songPath),
        ]);

        const metadata = (songMetadata?.metadata ?? null) as
          | Record<string, unknown>
          | null;
        const songContentType =
          typeof metadata?.mimetype === "string"
            ? metadata.mimetype
            : getContentTypeFromPath(songAsset.songPath);

        const chartSignedUrl = await createSignedUrl(
          variant.chartBucket,
          variant.chartPath,
        );

        const sidecarSignedUrl = variant.sidecarPath
          ? await createOptionalSignedUrl(variant.sidecarBucket, variant.sidecarPath)
          : null;

        return {
          id: songAsset.id,
          songAssetId: songAsset.id,
          variantId: variant.id,
          name: songAsset.title,
          title: songAsset.title,
          artist: songAsset.artist,
          path: songAsset.songPath,
          signedUrl: songSignedUrl,
          size:
            typeof metadata?.size === "number" ? metadata.size : null,
          contentType: songContentType,
          updatedAt: songAsset.updatedAt.toISOString(),
          durationSeconds: songAsset.durationSeconds,

          song: {
            bucket: songAsset.songBucket,
            path: songAsset.songPath,
            signedUrl: songSignedUrl,
            contentType: songContentType,
          },

          chart: {
            bucket: variant.chartBucket,
            path: variant.chartPath,
            signedUrl: chartSignedUrl,
            contentType: getContentTypeFromPath(variant.chartPath),
          },

          sidecar: sidecarSignedUrl
            ? {
                bucket: sidecarSignedUrl.bucket,
                path: sidecarSignedUrl.path,
                signedUrl: sidecarSignedUrl.signedUrl,
                contentType: getContentTypeFromPath(sidecarSignedUrl.path),
              }
            : null,
        };
      } catch (error) {
        console.error(
          "Skipping invalid song asset variant while loading song choices",
          {
            variantId: variant.id,
            songAssetId: songAsset.id,
            title: songAsset.title,
            gameType: variant.gameType,
            error: getErrorMessage(error),
          },
        );

        return null;
      }
    }),
  );

  const deduped = new Map<string, SongChoice>();
  songs.forEach((song) => {
    if (!song) return;
    deduped.set(`${song.songAssetId}:${song.variantId}`, song);
  });

  return Array.from(deduped.values());
}
