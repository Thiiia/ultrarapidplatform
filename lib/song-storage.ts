import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type SongChoice = {
  id: string;
  name: string;
  title: string;
  artist: string | null;
  path: string;
  signedUrl: string;
  size: number | null;
  contentType: string | null;
  updatedAt: string | null;
  durationSeconds: number | null;
  equationSlots: number;
  equation_slots: number;
  equationSlotTicks: number[];
  equation_slot_ticks: number[];
  hitCounts: number[];
  hit_counts: number[];
  hit_count: number[];
  spinCounts: number[];
  spin_counts: number[];
  spin_count: number[];
  dragCounts: number[];
  drag_counts: number[];
  drag_count: number[];

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

type SongAssetMechanicCounts = {
  equation_slots: number | null;
  equation_slot_ticks: number[] | null;
  hit_counts: number[] | null;
  spin_counts: number[] | null;
  drag_counts: number[] | null;
};

async function createOptionalSignedUrl(
  bucket: string | null,
  path: string | null,
) {
  if (!bucket || !path) {
    return null;
  }

  try {
    return await createSignedUrl(bucket, path);
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

async function getFileMetadata(bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const folder = path.split("/").slice(0, -1).join("/");
  const fileName = path.split("/").pop();

  const { data } = await supabaseAdmin.storage
    .from(bucket)
    .list(folder || undefined, {
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

function normalizeCount(value: unknown) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.round(count);
}

function parseCountArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCount(item));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      return parseCountArray(parsed);
    } catch {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim().replace(/^"|"$/g, ""))
          .map((item) => normalizeCount(item));
      }
    }
  }

  return [];
}

function normalizeCountArray(value: unknown, equationSlots: number) {
  const normalized = parseCountArray(value).slice(0, equationSlots);

  while (normalized.length < equationSlots) {
    normalized.push(0);
  }

  return normalized;
}

type SongAssetMechanicRow = {
  id: string;
  equation_slots: number | string | null;
  equation_slot_ticks: unknown;
  hit_count: unknown;
  spin_count: unknown;
  drag_count: unknown;
};

async function getSongAssetMechanicCounts(songAssetIds: string[]) {
  if (songAssetIds.length === 0) {
    return new Map<string, SongAssetMechanicCounts>();
  }

  const rows = await prisma.$queryRaw<SongAssetMechanicRow[]>(Prisma.sql`
    select
      id,
      equation_slots,
      equation_slot_ticks,
      hit_count,
      spin_count,
      drag_count
    from public."SongAsset"
    where id in (${Prisma.join(songAssetIds)})
  `);

  console.log("Loaded SongAsset mechanic counts from Prisma:", rows);

  return new Map(
    rows.map((row) => [
      row.id,
      {
        equation_slots: normalizeCount(row.equation_slots),
        equation_slot_ticks: parseCountArray(row.equation_slot_ticks),
        hit_counts: parseCountArray(row.hit_count),
        spin_counts: parseCountArray(row.spin_count),
        drag_counts: parseCountArray(row.drag_count),
      },
    ]),
  );
}

export async function getSongChoices(): Promise<SongChoice[]> {
  const songAssets = await prisma.songAsset.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      title: "asc",
    },
    select: {
      id: true,
      title: true,
      artist: true,
      songBucket: true,
      songPath: true,
      chartBucket: true,
      chartPath: true,
      sidecarBucket: true,
      sidecarPath: true,
      durationSeconds: true,
      updatedAt: true,
    },
  });

  const mechanicCountsById = await getSongAssetMechanicCounts(
    songAssets.map((songAsset) => songAsset.id),
  );

  const songs = await Promise.all(
    songAssets.map(async (songAsset) => {
      const hasSidecar = Boolean(
        songAsset.sidecarBucket && songAsset.sidecarPath,
      );

      const mechanicCounts = mechanicCountsById.get(songAsset.id);
      const equationSlots = normalizeCount(mechanicCounts?.equation_slots);

      const equationSlotTicks = normalizeCountArray(
        mechanicCounts?.equation_slot_ticks,
        equationSlots,
      );

      const hitCounts = normalizeCountArray(
        mechanicCounts?.hit_counts,
        equationSlots,
      );

      const spinCounts = normalizeCountArray(
        mechanicCounts?.spin_counts,
        equationSlots,
      );

      const dragCounts = normalizeCountArray(
        mechanicCounts?.drag_counts,
        equationSlots,
      );

      const [songSignedUrl, chartSignedUrl, sidecarSignedUrl, songMetadata] =
        await Promise.all([
          createSignedUrl(songAsset.songBucket, songAsset.songPath),
          createSignedUrl(songAsset.chartBucket, songAsset.chartPath),
          createOptionalSignedUrl(
            songAsset.sidecarBucket,
            songAsset.sidecarPath,
          ),
          getFileMetadata(songAsset.songBucket, songAsset.songPath),
        ]);

      const metadata = songMetadata?.metadata as
        | Record<string, unknown>
        | undefined;

      const songContentType =
        typeof metadata?.mimetype === "string"
          ? metadata.mimetype
          : getContentTypeFromPath(songAsset.songPath);

      return {
        id: songAsset.id,
        name: songAsset.title,
        title: songAsset.title,
        artist: songAsset.artist,
        path: songAsset.songPath,
        signedUrl: songSignedUrl,
        size: typeof metadata?.size === "number" ? metadata.size : null,
        contentType: songContentType,
        updatedAt: songAsset.updatedAt.toISOString(),
        durationSeconds: songAsset.durationSeconds,

        equationSlots,
        equation_slots: equationSlots,
        equationSlotTicks,
        equation_slot_ticks: equationSlotTicks,

        hitCounts,
        hit_counts: hitCounts,
        hit_count: hitCounts,

        spinCounts,
        spin_counts: spinCounts,
        spin_count: spinCounts,

        dragCounts,
        drag_counts: dragCounts,
        drag_count: dragCounts,

        song: {
          bucket: songAsset.songBucket,
          path: songAsset.songPath,
          signedUrl: songSignedUrl,
          contentType: songContentType,
        },

        chart: {
          bucket: songAsset.chartBucket,
          path: songAsset.chartPath,
          signedUrl: chartSignedUrl,
          contentType: getContentTypeFromPath(songAsset.chartPath),
        },

        sidecar:
          hasSidecar && sidecarSignedUrl
            ? {
                bucket: songAsset.sidecarBucket!,
                path: songAsset.sidecarPath!,
                signedUrl: sidecarSignedUrl,
                contentType: getContentTypeFromPath(songAsset.sidecarPath!),
              }
            : null,
      };
    }),
  );

  return songs;
}