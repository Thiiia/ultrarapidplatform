import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveFreshSongLaunchPackage } from "@/lib/song-launch-package";
import {
  DEV_AUTHOR_FOLDER,
  findAuthoredChart,
  findAuthorByName,
  findDevAuthor,
  findDevAuthoredChart,
} from "@/lib/song-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildAuthoredChartStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";

function resolveAuthorFolder(user: { name: string | null; email: string | null } | null) {
  if (!user) return DEV_AUTHOR_FOLDER;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return DEV_AUTHOR_FOLDER;
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

async function createSignedUrl(bucket: string, path: string) {
  const info = await getSupabaseAdmin().storage.from(bucket).info(path);
  if (info.error || !info.data) throw new Error(`Required asset unavailable: ${bucket}/${path}`);
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(path, 5 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Unable to load required song asset: ${error?.message ?? "Unknown error"}`);
  }

  return data.signedUrl;
}

/**
 * Absolute URL of the blank chart/sidecar endpoint. Used in place of a signed
 * storage URL when the dev author has not authored a chart for this song +
 * activity yet, so every consumer (lesson editor hydration, game launch) can
 * still fetch a complete package without anything being persisted.
 */
function buildBlankAssetUrl(request: Request, kind: "chart" | "sidecar", activityKey: string) {
  const url = new URL("/api/song-package/blank", request.url);
  url.searchParams.set("kind", kind);
  url.searchParams.set("activity", activityKey);

  return url.toString();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      songAssetId?: unknown;
      activityKey?: unknown;
      authorId?: unknown;
      authorName?: unknown;
    };
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");
    const activityKey = readRequiredString(payload.activityKey, "activityKey");
    const requestedAuthorName =
      typeof payload.authorName === "string" && payload.authorName.trim()
        ? payload.authorName.trim()
        : typeof payload.authorId === "string" && payload.authorId.trim()
          ? payload.authorId.trim()
          : null;

    // Resolve the author whose chart should be loaded (defaults to dev).
    // Accepts a plaintext name ("dev"/"Felix") via findAuthorByName.
    const requestedAuthor = requestedAuthorName
      ? await findAuthorByName(requestedAuthorName)
      : null;
    const author = requestedAuthor ?? (await findDevAuthor());
    const authorFolder = resolveAuthorFolder(author);

    const songPackage = await resolveFreshSongLaunchPackage({
      songAssetId,
      activityKey,
      authorId: author?.id ?? null,
      loadSongAsset: async (id) =>
        prisma.songAsset.findUnique({
          where: { id },
          select: {
            id: true,
            isActive: true,
            songBucket: true,
            songPath: true,
          },
        }) as Promise<Record<string, unknown> | null>,
      loadSongChart: async (assetId, resolvedActivityKey, authorId) => {
        // Read-only lookup of the author's SongChart for this song + activity.
        // When no match exists, return null so the resolver falls back to the
        // blank package below — nothing is created at load time.
        const key = resolvedActivityKey as SongActivityKey;
        const chart = authorId
          ? await findAuthoredChart({
              songAssetId: assetId,
              activityKey: key,
              authorId,
            })
          : await findDevAuthoredChart({ songAssetId: assetId, activityKey: key });

        if (!chart?.sidecarPath || !chart.sidecarBucket) {
          return null;
        }

        return {
          chartBucket: chart.chartBucket,
          chartPath: chart.chartPath,
          sidecarBucket: chart.sidecarBucket,
          sidecarPath: chart.sidecarPath,
        };
      },
      loadBlankSongChart: async (assetId, resolvedActivityKey) => {
        // No authored chart yet: serve blank chart/sidecar content under the
        // prospective author storage paths. The database entry (and storage
        // objects) are only created when the user saves.
        const blankActivityKey = resolvedActivityKey as SongActivityKey;
        const paths = buildAuthoredChartStoragePaths({
          activityKey: blankActivityKey,
          songAssetId: assetId,
          authorFolder,
        });

        return {
          chart: {
            bucket: "Charts",
            path: paths.chartPath,
            signedUrl: buildBlankAssetUrl(request, "chart", blankActivityKey),
          },
          sidecar: {
            bucket: "SidecarJsons",
            path: paths.sidecarPath,
            signedUrl: buildBlankAssetUrl(request, "sidecar", blankActivityKey),
          },
        };
      },
      createSignedUrl,
    });

    return NextResponse.json(songPackage, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load song package" },
      { status: 400 },
    );
  }
}
