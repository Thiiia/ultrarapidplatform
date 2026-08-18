import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { resolveSongSaveTargets } from "@/lib/song-save";
import { canAccessTeamPreview } from "@/lib/team-preview-access";

type SaveFilePayload = {
  content?: unknown;
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
  target: UploadedFileRef,
): Promise<UploadedFileRef> {
  const content = readRequiredString(file.content, "content");

  const supabase = getSupabaseServerClient();

  const { error } = await supabase.storage
    .from(target.bucket)
    .upload(target.path, content, {
      contentType: target.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return target;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessTeamPreview(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    const existingSongAsset = await prisma.songAsset.findFirst({
      where: {
        id: songAssetId,
        isActive: true,
      },
      select: {
        chartBucket: true,
        chartPath: true,
        sidecarBucket: true,
        sidecarPath: true,
      },
    });

    if (!existingSongAsset) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const targets = resolveSongSaveTargets(existingSongAsset);

    const chartRef = await uploadTextFile(
      payload.chart,
      { ...targets.chart, contentType: "text/plain;charset=utf-8" },
    );

    const sidecarRef = await uploadTextFile(
      payload.sidecar,
      { ...targets.sidecar, contentType: "application/json;charset=utf-8" },
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
    console.error("Unable to save lesson files:", error);

    return NextResponse.json(
      { error: "Unable to save lesson files" },
      { status: 500 },
    );
  }
}
