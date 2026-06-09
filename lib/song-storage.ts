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
  hitCounts: number[];
  hit_counts: number[];
  spinCounts: number[];
  spin_counts: number[];
  dragCounts: number[];
  drag_counts: number[];

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

function normalizeCountArray(value: unknown, equationSlots: number) {
  const raw = Array.isArray(value) ? value : [];
  const normalized = raw
    .map((item) => normalizeCount(item))
    .slice(0, equationSlots);

  while (normalized.length < equationSlots) {
    normalized.push(0);
  }

  return normalized;
}

async function getSongAssetMechanicCounts(songAssetIds: string[]) {
  if (songAssetIds.length === 0) {
    return new Map<string, SongAssetMechanicCounts>();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("SongAsset")
    .select("id,equation_slots,hit_count,spin_count,drag_count")
    .in("id", songAssetIds);

  if (error) {
    console.error("Unable to load SongAsset mechanic counts:", error);
    return new Map<string, SongAssetMechanicCounts>();
  }

  console.log("Loaded SongAsset mechanic counts:", data);

  return new Map(
    (data ?? []).map((row) => {
      const typedRow = row as {
        id: string;
        equation_slots: unknown;
        hit_count: unknown;
        spin_count: unknown;
        drag_count: unknown;
      };

      return [
        typedRow.id,
        {
          equation_slots: normalizeCount(typedRow.equation_slots),
          hit_counts: Array.isArray(typedRow.hit_count)
            ? typedRow.hit_count.map(normalizeCount)
            : [],
          spin_counts: Array.isArray(typedRow.spin_count)
            ? typedRow.spin_count.map(normalizeCount)
            : [],
          drag_counts: Array.isArray(typedRow.drag_count)
            ? typedRow.drag_count.map(normalizeCount)
            : [],
        },
      ];
    }),
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

        hitCounts,
        hit_counts: hitCounts,

        spinCounts,
        spin_counts: spinCounts,

        dragCounts,
        drag_counts: dragCounts,

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