import { prisma } from "@/lib/prisma";
import { BLANK_CHART_TEXT, BLANK_SIDECAR_JSON } from "@/lib/editor/blank-chart";
import {
  buildAuthoredChartStoragePaths,
  resolveRequestedSongActivityKey,
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

export function normalizeSongStoragePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim()
    .toLowerCase();
}

export function findMatchingSongAsset<T extends { songPath: string }>(
  songAssets: T[],
  storagePath: string,
): T | null {
  const normalizedStoragePath = normalizeSongStoragePath(storagePath);

  if (!normalizedStoragePath) {
    return null;
  }

  const normalizedStorageName = normalizedStoragePath.split("/").pop() ?? normalizedStoragePath;

  for (const songAsset of songAssets) {
    const candidatePath = normalizeSongStoragePath(songAsset.songPath);
    const candidateName = candidatePath.split("/").pop() ?? candidatePath;

    if (
      candidatePath === normalizedStoragePath ||
      candidateName === normalizedStorageName
    ) {
      return songAsset;
    }
  }

  return null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

async function createSignedUrl(bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const info = await supabaseAdmin.storage.from(bucket).info(path);
  if (info.error || !info.data) throw new Error(`Required asset unavailable: ${bucket}/${path}`);
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


type SongChartRecord = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string | null;
  sidecarPath: string | null;
};

/**
 * Materializes (creates in Supabase Storage + Postgres) a brand-new blank
 * chart/sidecar pair for a user who has not authored one yet for this
 * song + activity combination.
 */
async function createBlankAuthoredChart({
  songAssetId,
  authorId,
  activityKey,
}: {
  songAssetId: string;
  authorId: string;
  activityKey: SongActivityKey;
}): Promise<SongChartRecord> {
  const { chartPath, sidecarPath } = buildAuthoredChartStoragePaths({
    activityKey,
    songAssetId,
    authorId,
  });

  const chartBucket = "Charts";
  const sidecarBucket = "SidecarJsons";
  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin.storage.from(chartBucket).upload(chartPath, BLANK_CHART_TEXT, {
    contentType: "text/plain;charset=utf-8",
    upsert: true,
  });
  await supabaseAdmin.storage.from(sidecarBucket).upload(sidecarPath, BLANK_SIDECAR_JSON, {
    contentType: "application/json;charset=utf-8",
    upsert: true,
  });

  const created = await prisma.songChart.upsert({
    where: {
      songAssetId_authorId_activityKey: {
        songAssetId,
        authorId,
        activityKey,
      },
    },
    create: {
      songAssetId,
      authorId,
      activityKey,
      chartBucket,
      chartPath,
      sidecarBucket,
      sidecarPath,
    },
    update: {},
  });

  return {
    chartBucket: created.chartBucket,
    chartPath: created.chartPath,
    sidecarBucket: created.sidecarBucket,
    sidecarPath: created.sidecarPath,
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

type SongAssetLike = {
  id: string;
  title: string;
  artist: string | null;
  songBucket: string;
  songPath: string;
  durationSeconds: number | null;
  updatedAt: Date;
  isActive: boolean;
};

async function buildSongChoiceForAsset({
  songAsset,
  storageSong,
  activityKey,
  chartRecord,
}: {
  songAsset: SongAssetLike;
  storageSong: StorageFileEntry;
  activityKey: SongActivityKey;
  chartRecord: SongChartRecord;
}): Promise<SongChoice | null> {
  try {
    let songSignedUrl = "";
    let chartSignedUrl = "";
    let sidecarSignedUrl: string | null = null;

    try {
      songSignedUrl = await createSignedUrl(songAsset.songBucket, storageSong.path);
    } catch (error) {
      console.warn("Unable to generate signed URL for song asset while listing songs", {
        songAssetId: songAsset.id,
        songPath: storageSong.path,
        error: getErrorMessage(error),
      });
    }

    if (chartRecord.chartBucket && chartRecord.chartPath) {
      try {
        chartSignedUrl = await createSignedUrl(chartRecord.chartBucket, chartRecord.chartPath);
      } catch (error) {
        console.warn("Unable to generate signed URL for chart while listing songs", {
          songAssetId: songAsset.id,
          chartPath: chartRecord.chartPath,
          error: getErrorMessage(error),
        });
      }
    }

    if (chartRecord.sidecarBucket && chartRecord.sidecarPath) {
      try {
        sidecarSignedUrl = await createSignedUrl(
          chartRecord.sidecarBucket,
          chartRecord.sidecarPath,
        );
      } catch (error) {
        console.warn("Unable to generate signed URL for sidecar while listing songs", {
          songAssetId: songAsset.id,
          sidecarPath: chartRecord.sidecarPath,
          error: getErrorMessage(error),
        });
      }
    }

    const songMetadata = await getFileMetadata(songAsset.songBucket, storageSong.path).catch(() => null);
    const metadata = songMetadata?.metadata as Record<string, unknown> | undefined;

    const songContentType =
      storageSong.mimeType ??
      (typeof metadata?.mimetype === "string"
        ? metadata.mimetype
        : getContentTypeFromPath(storageSong.path));

    return {
      id: songAsset.id,
      activityKey,
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
        bucket: chartRecord.chartBucket,
        path: chartRecord.chartPath,
        signedUrl: chartSignedUrl,
        contentType: getContentTypeFromPath(chartRecord.chartPath),
      },

      sidecar:
        chartRecord.sidecarPath && chartRecord.sidecarBucket && sidecarSignedUrl
          ? {
              bucket: chartRecord.sidecarBucket,
              path: chartRecord.sidecarPath,
              signedUrl: sidecarSignedUrl,
              contentType: getContentTypeFromPath(chartRecord.sidecarPath),
            }
          : null,
    };
  } catch (error) {
    console.warn("SongAsset row retained without fully generated asset URLs while loading song choices", {
      songAssetId: songAsset.id,
      title: songAsset.title,
      songPath: storageSong.path,
      chartPath: chartRecord.chartPath,
      sidecarPath: chartRecord.sidecarPath,
      error: getErrorMessage(error),
    });

    return {
      id: songAsset.id,
      activityKey,
      name: songAsset.title,
      title: songAsset.title,
      artist: songAsset.artist,
      path: storageSong.path,
      signedUrl: "",
      size: storageSong.size,
      contentType: storageSong.mimeType ?? getContentTypeFromPath(storageSong.path),
      updatedAt: storageSong.updatedAt ?? songAsset.updatedAt.toISOString(),
      durationSeconds: songAsset.durationSeconds,
      song: {
        bucket: songAsset.songBucket,
        path: storageSong.path,
        signedUrl: "",
        contentType: storageSong.mimeType ?? getContentTypeFromPath(storageSong.path),
      },
      chart: {
        bucket: chartRecord.chartBucket,
        path: chartRecord.chartPath,
        signedUrl: "",
        contentType: getContentTypeFromPath(chartRecord.chartPath),
      },
      sidecar:
        chartRecord.sidecarPath && chartRecord.sidecarBucket
          ? {
              bucket: chartRecord.sidecarBucket,
              path: chartRecord.sidecarPath,
              signedUrl: "",
              contentType: getContentTypeFromPath(chartRecord.sidecarPath),
            }
          : null,
    };
  }
}

/**
 * Song choice listing for the song-choice pages: every active song shows up
 * regardless of whether the current user has authored a chart for it yet. If
 * they haven't, a blank chart/sidecar is created on the fly for them.
 */
export async function getSongChoices(
  requestedActivityKey?: string | null,
  options: { userId?: string | null } = {},
): Promise<SongChoice[]> {
  const preferredActivityKey = resolveRequestedSongActivityKey(requestedActivityKey);

  if (!preferredActivityKey) {
    console.warn("Skipping song choices for invalid activity", { requestedActivityKey });
    return [];
  }

  const userId = options.userId ?? null;

  const songAssets = await prisma.songAsset.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  const existingChartsByAsset = userId
    ? new Map(
        (
          await prisma.songChart.findMany({
            where: { authorId: userId, activityKey: preferredActivityKey },
          })
        ).map((chart) => [chart.songAssetId, chart] as const),
      )
    : new Map<string, Awaited<ReturnType<typeof prisma.songChart.findFirst>>>();

  const anyAuthorChartsByAsset = userId
    ? null
    : new Map(
        (
          await prisma.songChart.findMany({
            where: { activityKey: preferredActivityKey },
            orderBy: { updatedAt: "desc" },
          })
        ).reduce<Map<string, Awaited<ReturnType<typeof prisma.songChart.findFirst>>>>(
          (map, chart) => {
            if (!map.has(chart.songAssetId)) {
              map.set(chart.songAssetId, chart);
            }
            return map;
          },
          new Map(),
        ),
      );

  const songs: Array<SongChoice | null> = await Promise.all(
    songAssets.map(async (songAsset): Promise<SongChoice | null> => {
      const storageSong: StorageFileEntry = {
        path: songAsset.songPath,
        name: songAsset.songPath.split("/").pop() ?? songAsset.songPath,
        size: null,
        mimeType: getContentTypeFromPath(songAsset.songPath),
        updatedAt: songAsset.updatedAt.toISOString(),
      };

      const existingChart = userId
        ? existingChartsByAsset.get(songAsset.id) ?? null
        : anyAuthorChartsByAsset?.get(songAsset.id) ?? null;

      const chartRecord: SongChartRecord = existingChart
        ? {
            chartBucket: existingChart.chartBucket,
            chartPath: existingChart.chartPath,
            sidecarBucket: existingChart.sidecarBucket,
            sidecarPath: existingChart.sidecarPath,
          }
        : userId
          ? await createBlankAuthoredChart({
              songAssetId: songAsset.id,
              authorId: userId,
              activityKey: preferredActivityKey,
            })
          : {
              chartBucket: "Charts",
              chartPath: `${preferredActivityKey}/${songAsset.id}.chart`,
              sidecarBucket: "SidecarJsons",
              sidecarPath: `${preferredActivityKey}/${songAsset.id}.json`,
            };

      return buildSongChoiceForAsset({
        songAsset,
        storageSong,
        activityKey: preferredActivityKey,
        chartRecord,
      });
    }),
  );

  return songs.filter(isNonNull);
}

/**
 * Song listing for the in-editor "open file" picker. Restricted to charts the
 * current user has authored, except when there is no authenticated user
 * (demo mode), in which case every authored chart is shown regardless of author.
 */
export async function getEditorSongChoices(
  requestedActivityKey: string | null | undefined,
  options: { userId: string | null },
): Promise<SongChoice[]> {
  const preferredActivityKey = resolveRequestedSongActivityKey(requestedActivityKey);

  if (!preferredActivityKey) {
    console.warn("Skipping editor song choices for invalid activity", { requestedActivityKey });
    return [];
  }

  const charts = await prisma.songChart.findMany({
    where: {
      activityKey: preferredActivityKey,
      ...(options.userId ? { authorId: options.userId } : {}),
    },
    include: { songAsset: true },
    orderBy: { updatedAt: "desc" },
  });

  const chartsByAsset = new Map<string, (typeof charts)[number]>();
  charts.forEach((chart) => {
    if (!chart.songAsset.isActive) {
      return;
    }
    // Most-recently-updated chart wins when multiple authors have one (demo mode).
    if (!chartsByAsset.has(chart.songAssetId)) {
      chartsByAsset.set(chart.songAssetId, chart);
    }
  });

  const storageSongs = await listSongStorageFiles("Songs");
  const storageSongByPath = new Map(storageSongs.map((entry) => [entry.path, entry]));

  const songs: Array<SongChoice | null> = await Promise.all(
    Array.from(chartsByAsset.values()).map(async (chart): Promise<SongChoice | null> => {
      const storageSong = storageSongByPath.get(chart.songAsset.songPath);

      if (!storageSong) {
        console.warn("Skipping authored chart because song audio file was not found in storage", {
          songAssetId: chart.songAssetId,
          songPath: chart.songAsset.songPath,
        });
        return null;
      }

      return buildSongChoiceForAsset({
        songAsset: chart.songAsset,
        storageSong,
        activityKey: preferredActivityKey,
        chartRecord: {
          chartBucket: chart.chartBucket,
          chartPath: chart.chartPath,
          sidecarBucket: chart.sidecarBucket,
          sidecarPath: chart.sidecarPath,
        },
      });
    }),
  );

  return songs.filter(isNonNull);
}

