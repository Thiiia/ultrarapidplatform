import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveFreshSongLaunchPackage } from "@/lib/song-launch-package";
import { ensureDevAuthoredChart } from "@/lib/song-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SongActivityKey } from "@/lib/song-activity-storage";

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      songAssetId?: unknown;
      activityKey?: unknown;
    };
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");
    const activityKey = readRequiredString(payload.activityKey, "activityKey");
    const songPackage = await resolveFreshSongLaunchPackage({
      songAssetId,
      activityKey,
      authorId: null,
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
      loadSongChart: async (assetId, resolvedActivityKey) => {
        // Song charts are always authored by the shared "dev" user. When no
        // dev-authored chart exists for this song + activity yet, a blank
        // chart/sidecar pair is materialized under dev/{ActivityFolder}/ and
        // persisted as a new SongChart row before signing.
        const chart = await ensureDevAuthoredChart({
          songAssetId: assetId,
          activityKey: resolvedActivityKey as SongActivityKey,
        });

        if (!chart.sidecarPath || !chart.sidecarBucket) {
          return null;
        }

        return {
          chartBucket: chart.chartBucket,
          chartPath: chart.chartPath,
          sidecarBucket: chart.sidecarBucket,
          sidecarPath: chart.sidecarPath,
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
