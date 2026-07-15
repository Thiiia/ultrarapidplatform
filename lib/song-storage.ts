import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  createFreshSongLaunchInput,
  type FreshSongLaunchInput,
} from "@/lib/song-launch";

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

async function createOptionalSignedUrl(bucket: string | null, path: string | null) {
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

async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 60,
) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

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

export async function getSongLaunchPayload(
  songAssetId: string,
): Promise<FreshSongLaunchInput | null> {
  songAssetId = songAssetId.trim();

  if (!songAssetId) {
    return null;
  }

  const songAsset = await prisma.songAsset.findFirst({
    where: {
      id: songAssetId,
      isActive: true,
    },
    select: {
      id: true,
      songBucket: true,
      songPath: true,
      chartBucket: true,
      chartPath: true,
      sidecarBucket: true,
      sidecarPath: true,
    },
  });

  if (!songAsset) {
    return null;
  }

  return createFreshSongLaunchInput(songAsset, createSignedUrl);
}

export async function getSongChoices(): Promise<SongChoice[]> {
  const songAssets = await prisma.songAsset.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      title: "asc",
    },
  });

  const songs = await Promise.all(
    songAssets.map(async (songAsset) => {
      const hasSidecar = Boolean(songAsset.sidecarBucket && songAsset.sidecarPath);

      const [
        songSignedUrl,
        chartSignedUrl,
        sidecarSignedUrl,
        songMetadata,
      ] = await Promise.all([
        createSignedUrl(songAsset.songBucket, songAsset.songPath),
        createSignedUrl(songAsset.chartBucket, songAsset.chartPath),
createOptionalSignedUrl(songAsset.sidecarBucket, songAsset.sidecarPath),
        getFileMetadata(songAsset.songBucket, songAsset.songPath),
      ]);

      const metadata = songMetadata?.metadata as Record<string, unknown> | undefined;

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
        equationSlots: 0,
        equation_slots: 0,
        equationSlotTicks: [],
        equation_slot_ticks: [],
        hitCounts: [],
        hit_counts: [],
        hit_count: [],
        spinCounts: [],
        spin_counts: [],
        spin_count: [],
        dragCounts: [],
        drag_counts: [],
        drag_count: [],

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
