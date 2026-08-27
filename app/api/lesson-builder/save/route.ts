import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  defaultSongActivityKey,
  inferSongActivityKeyFromChartPath,
  normalizeSongActivityKey,
} from "@/lib/song-activity-storage";

type SaveFilePayload = {
  bucket?: unknown;
  path?: unknown;
  content?: unknown;
  contentType?: unknown;
};

type SavePayload = {
  songAssetId?: unknown;
  variantId?: unknown;
  activityKey?: unknown;
  chart?: SaveFilePayload;
  sidecar?: SaveFilePayload;
};

type UploadedFileRef = {
  bucket: string;
  path: string;
  contentType: string;
};

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function uploadTextFile(
  file: SaveFilePayload,
  fallbackContentType: string,
): Promise<UploadedFileRef> {
  const bucket = readRequiredString(file.bucket, "bucket");
  const path = readRequiredString(file.path, "path");
  const content = readRequiredString(file.content, "content");
  const contentType =
    typeof file.contentType === "string" && file.contentType.trim().length > 0
      ? file.contentType.trim()
      : fallbackContentType;

  const supabase = getSupabaseServerClient();

  const { error } = await supabase.storage.from(bucket).upload(path, content, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path, contentType };
}

function normalizeGameType(
  activityKey: string | null,
): "number_bonds" | "equations" | "missing_numbers" | "early_algebra" {
  const normalized = normalizeSongActivityKey(activityKey) ?? defaultSongActivityKey;

  switch (normalized) {
    case "number-bonds":
      return "number_bonds";
    case "equations":
      return "equations";
    case "missing-numbers":
      return "missing_numbers";
    case "early-algebra":
      return "early_algebra";
    default:
      return "number_bonds";
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SavePayload;
    const currentUser = await getCurrentAppUser();

    if (!currentUser) {
      return NextResponse.json({ error: "User is not authenticated" }, { status: 401 });
    }

    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    const requestedChartPath = readRequiredString(payload.chart.path, "chart.path");
    const requestedSidecarPath = readRequiredString(
      payload.sidecar.path,
      "sidecar.path",
    );
    const activityKey =
      normalizeSongActivityKey(
        typeof payload.activityKey === "string" ? payload.activityKey : null,
      ) ??
      inferSongActivityKeyFromChartPath(requestedChartPath) ??
      defaultSongActivityKey;
    const gameType = normalizeGameType(activityKey);

    const chartRef = await uploadTextFile(
      {
        ...payload.chart,
        path: requestedChartPath,
      },
      "text/plain;charset=utf-8",
    );

    const sidecarRef = await uploadTextFile(
      {
        ...payload.sidecar,
        path: requestedSidecarPath,
      },
      "application/json;charset=utf-8",
    );

    const variant =
      payload.variantId && typeof payload.variantId === "string"
        ? await prisma.songAssetVariant.update({
            where: { id: payload.variantId },
            data: {
              chartBucket: chartRef.bucket,
              chartPath: chartRef.path,
              sidecarBucket: sidecarRef.bucket,
              sidecarPath: sidecarRef.path,
              gameType,
            },
          })
        : await (async () => {
            const existingVariant = await prisma.songAssetVariant.findFirst({
              where: {
                songAssetId,
                ownerUserId: currentUser.id,
                gameType,
                chartPath: chartRef.path,
                sidecarPath: sidecarRef.path,
              },
            });

            if (existingVariant) {
              return prisma.songAssetVariant.update({
                where: { id: existingVariant.id },
                data: {
                  chartBucket: chartRef.bucket,
                  sidecarBucket: sidecarRef.bucket,
                  isPublic: false,
                },
              });
            }

            return prisma.songAssetVariant.create({
              data: {
                songAssetId,
                ownerUserId: currentUser.id,
                gameType,
                chartBucket: chartRef.bucket,
                chartPath: chartRef.path,
                sidecarBucket: sidecarRef.bucket,
                sidecarPath: sidecarRef.path,
                isPublic: false,
              },
            });
          })();

    const songAsset = await prisma.songAsset.findUnique({
      where: { id: songAssetId },
      select: { id: true, title: true, songPath: true },
    });

    return NextResponse.json({
      ok: true,
      songAsset,
      variant,
      chart: chartRef,
      sidecar: sidecarRef,
    });
  } catch (error) {
    console.error("Unable to save lesson files:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save lesson files",
      },
      { status: 500 },
    );
  }
}
