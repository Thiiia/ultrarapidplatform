import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type SaveFilePayload = {
  bucket?: unknown;
  path?: unknown;
  content?: unknown;
  contentType?: unknown;
};

type SavePayload = {
  songAssetId?: unknown;
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

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(
      payload.songAssetId,
      "songAssetId",
    );

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    const chartRef = await uploadTextFile(
      payload.chart,
      "text/plain;charset=utf-8",
    );

    const sidecarRef = await uploadTextFile(
      payload.sidecar,
      "application/json;charset=utf-8",
    );

    const songAsset = await prisma.songAsset.update({
      where: { id: songAssetId },
      data: {
        chartBucket: chartRef.bucket,
        chartPath: chartRef.path,
        sidecarBucket: sidecarRef.bucket,
        sidecarPath: sidecarRef.path,
      },
      select: {
        id: true,
        chartBucket: true,
        chartPath: true,
        sidecarBucket: true,
        sidecarPath: true,
      },
    });

    return NextResponse.json({
      ok: true,
      songAsset,
      chart: chartRef,
      sidecar: sidecarRef,
    });
  } catch (error) {
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