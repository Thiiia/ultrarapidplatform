import { prisma } from "@/lib/prisma";
import {
  getSongAssetPathsForActivity,
  normalizeSongActivityKey,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
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

export async function getSongChoices(
  requestedActivityKey?: string | null,
): Promise<SongChoice[]> {
  const activityKey: SongActivityKey | null = normalizeSongActivityKey(
    requestedActivityKey,
  );

  const songAssets = await prisma.songAsset.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      title: "asc",
    },
  });

  const songs: Array<SongChoice | null> = await Promise.all(
    songAssets.map(async (songAsset): Promise<SongChoice | null> => {
      const songAssetRecord = songAsset as unknown as Record<string, unknown>;
      const selectedPaths = getSongAssetPathsForActivity(
        songAssetRecord,
        activityKey,
      );
      const hasSidecar = Boolean(
        songAsset.sidecarBucket && selectedPaths.sidecarPath,
      );

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
        const [songSignedUrl, chartSignedUrl, sidecarSignedUrl, songMetadata] =
          await Promise.all([
            createSignedUrl(songAsset.songBucket, songAsset.songPath),
            createSignedUrl(songAsset.chartBucket, selectedPaths.chartPath),
            createOptionalSignedUrl(
              songAsset.sidecarBucket,
              hasSidecar ? selectedPaths.sidecarPath : null,
            ),
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

          song: {
            bucket: songAsset.songBucket,
            path: songAsset.songPath,
            signedUrl: songSignedUrl,
            contentType: songContentType,
          },

          chart: {
            bucket: songAsset.chartBucket,
            path: selectedPaths.chartPath,
            signedUrl: chartSignedUrl,
            contentType: getContentTypeFromPath(selectedPaths.chartPath),
          },

          sidecar:
            hasSidecar && sidecarSignedUrl
              ? {
                  bucket: songAsset.sidecarBucket!,
                  path: selectedPaths.sidecarPath!,
                  signedUrl: sidecarSignedUrl,
                  contentType: getContentTypeFromPath(selectedPaths.sidecarPath!),
                }
              : null,
        };
      } catch (error) {
        console.error(
          "Skipping invalid song asset while loading song choices",
          {
            songAssetId: songAsset.id,
            title: songAsset.title,
            songPath: songAsset.songPath,
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