import { prisma } from "@/lib/prisma";
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
  authorName?: string | null;

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
 * The shared "dev" author owns every SongChart used by song choice and the
 * lesson editor. Its storage files always live under `dev/{ActivityFolder}/`
 * in the Charts/SidecarJsons buckets.
 */
export const DEV_AUTHOR_FOLDER = "dev";
const DEV_AUTHOR_EMAIL = "dev";

export async function findDevAuthor() {
  return prisma.user.findUnique({ where: { email: DEV_AUTHOR_EMAIL } });
}

export async function getOrCreateDevAuthor() {
  return prisma.user.upsert({
    where: { email: DEV_AUTHOR_EMAIL },
    update: {},
    create: {
      email: DEV_AUTHOR_EMAIL,
      auth0Sub: DEV_AUTHOR_EMAIL,
      name: DEV_AUTHOR_FOLDER,
      role: "teacher",
    },
  });
}

/**
 * Read-only lookup of a SongChart for a song + activity + author.
 * Returns null when no chart exists for that combination — callers serve
 * blank chart/sidecar content in that case, and the SongChart row is only
 * created later when the user saves (see /api/lesson-builder/save).
 */
export async function findAuthoredChart({
  songAssetId,
  activityKey,
  authorId,
}: {
  songAssetId: string;
  activityKey: SongActivityKey;
  authorId: string;
}): Promise<SongChartRecord | null> {
  const existing = await prisma.songChart.findUnique({
    where: {
      songAssetId_authorId_activityKey: {
        songAssetId,
        authorId,
        activityKey,
      },
    },
  });

  if (!existing) {
    return null;
  }

  return {
    chartBucket: existing.chartBucket,
    chartPath: existing.chartPath,
    sidecarBucket: existing.sidecarBucket,
    sidecarPath: existing.sidecarPath,
  };
}

/**
 * Read-only lookup of the dev-authored SongChart for a song + activity.
 * Returns null when the dev author has not authored one yet — callers serve
 * blank chart/sidecar content in that case, and the SongChart row is only
 * created later when the user saves (see /api/lesson-builder/save).
 */
export async function findDevAuthoredChart({
  songAssetId,
  activityKey,
}: {
  songAssetId: string;
  activityKey: SongActivityKey;
}): Promise<SongChartRecord | null> {
  const devAuthor = await findDevAuthor();

  if (!devAuthor) {
    return null;
  }

  return findAuthoredChart({
    songAssetId,
    activityKey,
    authorId: devAuthor.id,
  });
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

export const FELIX_USER_ID = "cmndltqyc0000ju04s0i4en9r";

export function isFelixAuthor(user: { id?: string | null; name?: string | null; email?: string | null }) {
  const normalizedName = user.name?.trim().toLowerCase();
  const normalizedEmail = user.email?.trim().toLowerCase();

  return (
    user.id?.trim() === FELIX_USER_ID ||
    normalizedName === "felix" ||
    normalizedEmail === "felix@example.com"
  );
}

function blankAssetUrl(kind: "chart" | "sidecar", activityKey: SongActivityKey) {
  const params = new URLSearchParams({
    kind,
    activity: activityKey,
  });

  return `/api/song-package/blank?${params.toString()}`;
}

async function buildSongChoiceForAsset({
  songAsset,
  storageSong,
  activityKey,
  chartRecord,
  signChartAssets = true,
  authorName = null,
}: {
  songAsset: SongAssetLike;
  storageSong: StorageFileEntry;
  activityKey: SongActivityKey;
  chartRecord: SongChartRecord;
  signChartAssets?: boolean;
  authorName?: string | null;
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

    if (signChartAssets && chartRecord.chartBucket && chartRecord.chartPath) {
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

    if (signChartAssets && chartRecord.sidecarBucket && chartRecord.sidecarPath) {
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
      authorName,

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
        chartRecord.sidecarPath && chartRecord.sidecarBucket
          ? {
              bucket: chartRecord.sidecarBucket,
              path: chartRecord.sidecarPath,
              signedUrl: sidecarSignedUrl ?? "",
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
 * Song choice listing for the song-choice pages: every active SongAsset shows
 * up, sourced purely from the SongAsset table. Only the song audio gets a
 * signed URL here; chart/sidecar URLs are resolved at selection time (see
 * findDevAuthoredChart + /api/song-package/launch, which falls back to blank
 * content when nothing is authored yet). The chart/sidecar fields carry the
 * prospective dev-authored storage paths so downstream payloads have a stable
 * shape before the selection fetch completes.
 */
export async function getSongChoices(
  requestedActivityKey?: string | null,
): Promise<SongChoice[]> {
  const preferredActivityKey = resolveRequestedSongActivityKey(requestedActivityKey);

  if (!preferredActivityKey) {
    console.warn("Skipping song choices for invalid activity", { requestedActivityKey });
    return [];
  }

  const songAssets = await prisma.songAsset.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  const songs: Array<SongChoice | null> = await Promise.all(
    songAssets.map(async (songAsset): Promise<SongChoice | null> => {
      const storageSong: StorageFileEntry = {
        path: songAsset.songPath,
        name: songAsset.songPath.split("/").pop() ?? songAsset.songPath,
        size: null,
        mimeType: getContentTypeFromPath(songAsset.songPath),
        updatedAt: songAsset.updatedAt.toISOString(),
      };

      const prospectivePaths = buildAuthoredChartStoragePaths({
        activityKey: preferredActivityKey,
        songAssetId: songAsset.id,
        authorFolder: DEV_AUTHOR_FOLDER,
      });

      return buildSongChoiceForAsset({
        songAsset,
        storageSong,
        activityKey: preferredActivityKey,
        chartRecord: {
          chartBucket: "Charts",
          chartPath: prospectivePaths.chartPath,
          sidecarBucket: "SidecarJsons",
          sidecarPath: prospectivePaths.sidecarPath,
        },
        signChartAssets: false,
      });
    }),
  );

  return songs.filter(isNonNull);
}

export type SongChartAuthor = {
  id: string;
  name: string;
  email: string | null;
  chartCount: number;
};

/**
 * Resolve an author by plaintext name (e.g. "dev", "Felix"). Matches against
 * the user's display name first, then email local-part. Returns null when no
 * user matches.
 */
export async function findAuthorByName(authorName: string) {
  const name = authorName.trim();

  if (!name) {
    return null;
  }

  const byName = await prisma.user.findFirst({ where: { name } });

  if (byName) {
    return byName;
  }

  // Fall back to email local-part match ("dev" matches "dev@...").
  const candidates = await prisma.user.findMany({
    where: { email: { startsWith: `${name}@` } },
  });

  return candidates[0] ?? null;
}

/**
 * Derive the storage author folder for a user (plaintext name, e.g. "dev").
 */
export function resolveAuthorFolderName(user: { name: string | null; email: string | null }) {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return DEV_AUTHOR_FOLDER;
}

/**
 * Distinct authors who have authored at least one SongChart, for the editor
 * file picker's author directory. The shared dev author (when present) is
 * listed first, then alphabetically.
 */
export async function getSongChartAuthors(): Promise<SongChartAuthor[]> {
  const grouped = await prisma.songChart.groupBy({
    by: ["authorId"],
    _count: { _all: true },
  });

  const authorIds = new Set(grouped.map((entry) => entry.authorId));
  if (isFelixAuthor({ id: FELIX_USER_ID, name: "Felix", email: null })) {
    authorIds.add(FELIX_USER_ID);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(authorIds) } },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  const authors = grouped
    .map((entry): SongChartAuthor | null => {
      const user = userById.get(entry.authorId);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        name: user.name?.trim() || user.email || "Unknown author",
        email: user.email ?? null,
        chartCount: entry._count._all,
      };
    })
    .filter(isNonNull);

  const felixUser = userById.get(FELIX_USER_ID);
  if (felixUser && !authors.some((author) => author.id === FELIX_USER_ID)) {
    authors.push({
      id: felixUser.id,
      name: felixUser.name?.trim() || felixUser.email || "Felix",
      email: felixUser.email ?? null,
      chartCount: 0,
    });
  }

  authors.sort((a, b) => {
    const aIsDev = a.email === DEV_AUTHOR_EMAIL;
    const bIsDev = b.email === DEV_AUTHOR_EMAIL;
    const aIsFelix = a.id === FELIX_USER_ID || a.name === "Felix";
    const bIsFelix = b.id === FELIX_USER_ID || b.name === "Felix";

    if (aIsDev !== bIsDev) {
      return aIsDev ? -1 : 1;
    }

    if (aIsFelix !== bIsFelix) {
      return aIsFelix ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  return authors;
}

/**
 * Song listing for the in-editor "open file" picker. Lists authored charts
 * for an activity, filtered to the given author when provided (author
 * directory is required before browsing songs in the picker).
 */
export async function getEditorSongChoices(
  requestedActivityKey: string | null | undefined,
  options: { authorName?: string | null; userId?: string | null },
): Promise<SongChoice[]> {
  const preferredActivityKey = resolveRequestedSongActivityKey(requestedActivityKey);

  if (!preferredActivityKey) {
    console.warn("Skipping editor song choices for invalid activity", { requestedActivityKey });
    return [];
  }

  // Resolve plaintext author name ("dev"/"Felix") to a user id for filtering.
  // An explicitly requested author that resolves to nothing must return an
  // empty listing, never silently broaden to every author (F08).
  let authorId = options.userId ?? null;
  let authorRecord = null as { id: string; name: string | null; email: string | null } | null;
  if (!authorId && options.authorName) {
    authorRecord = (await findAuthorByName(options.authorName)) ?? null;
    authorId = authorRecord?.id ?? null;
    if (!authorId) {
      return [];
    }
  } else if (authorId) {
    authorRecord = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, email: true },
    });
  }

  const authorName = authorRecord ? resolveAuthorFolderName(authorRecord) : (options.authorName ?? DEV_AUTHOR_FOLDER);

  const charts = await prisma.songChart.findMany({
    where: {
      activityKey: preferredActivityKey,
      ...(authorId ? { authorId } : {}),
    },
    include: { songAsset: true, author: true },
    orderBy: { updatedAt: "desc" },
  });

  const chartsByAsset = new Map<string, (typeof charts)[number]>();
  charts.forEach((chart) => {
    if (!chart.songAsset.isActive) {
      return;
    }
    // Most-recently-updated chart wins per song + author combination.
    const key = `${chart.songAssetId}:${chart.authorId}`;
    if (!chartsByAsset.has(key)) {
      chartsByAsset.set(key, chart);
    }
  });

  const storageSongs = await listSongStorageFiles("Songs");
  const storageSongByPath = new Map(storageSongs.map((entry) => [entry.path, entry]));
  const authoredSongIds = new Set(chartsByAsset.values().map((chart) => chart.songAssetId));

  const songAssets = await prisma.songAsset.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  const blankSongs: Array<SongChoice | null> = await Promise.all(
    songAssets.map(async (songAsset) => {
      const existingChart = chartsByAsset.get(`${songAsset.id}:${authorId ?? ""}`) ?? null;
      if (existingChart) {
        const storageSong = storageSongByPath.get(songAsset.songPath);
        if (!storageSong) {
          return null;
        }

        return buildSongChoiceForAsset({
          songAsset,
          storageSong,
          activityKey: preferredActivityKey,
          authorName: authorName,
          chartRecord: {
            chartBucket: existingChart.chartBucket,
            chartPath: existingChart.chartPath,
            sidecarBucket: existingChart.sidecarBucket,
            sidecarPath: existingChart.sidecarPath,
          },
        });
      }

      if (authorId && !authoredSongIds.has(songAsset.id)) {
        const storageSong = storageSongByPath.get(songAsset.songPath);
        if (!storageSong) {
          return null;
        }

        const blankPaths = buildAuthoredChartStoragePaths({
          activityKey: preferredActivityKey,
          songAssetId: songAsset.id,
          authorFolder: authorName,
        });

        return {
          ...buildSongChoiceForAsset({
            songAsset,
            storageSong,
            activityKey: preferredActivityKey,
            authorName,
            chartRecord: {
              chartBucket: "Charts",
              chartPath: blankPaths.chartPath,
              sidecarBucket: "SidecarJsons",
              sidecarPath: blankPaths.sidecarPath,
            },
            signChartAssets: false,
          }),
          chart: {
            bucket: "Charts",
            path: blankPaths.chartPath,
            signedUrl: blankAssetUrl("chart", preferredActivityKey),
            contentType: "text/plain",
          },
          sidecar: {
            bucket: "SidecarJsons",
            path: blankPaths.sidecarPath,
            signedUrl: blankAssetUrl("sidecar", preferredActivityKey),
            contentType: "application/json",
          },
        } as SongChoice;
      }

      return null;
    }),
  );

  const authoredSongs = chartsByAsset.size > 0
    ? await Promise.all(
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
            authorName: chart.author ? resolveAuthorFolderName(chart.author) : null,
            chartRecord: {
              chartBucket: chart.chartBucket,
              chartPath: chart.chartPath,
              sidecarBucket: chart.sidecarBucket,
              sidecarPath: chart.sidecarPath,
            },
          });
        }),
      )
    : [];

  return [...authoredSongs.filter(isNonNull), ...blankSongs.filter(isNonNull)].filter(
    (song, index, allSongs) => allSongs.findIndex((candidate) => candidate.id === song.id) === index,
  );
}

