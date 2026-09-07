import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { validateLessonContent } from "@/lib/lesson-content";
import { publishLessonSaveRevision } from "@/lib/lesson-save-revision";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppUser } from "@/lib/current-user";
import {
  buildAuthoredChartStoragePaths,
  defaultSongActivityKey,
  normalizeSongActivityKey,
  type SongActivityKey,
} from "@/lib/song-activity-storage";

type SaveFilePayload = {
  content?: unknown;
};

type SavePayload = {
  songAssetId?: unknown;
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

async function uploadTextFile({
  bucket,
  path,
  content,
  contentType,
}: UploadedFileRef & { content: string }): Promise<UploadedFileRef> {

  const supabase = getSupabaseServerClient();

  const { error } = await supabase.storage.from(bucket).upload(path, content, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket, path, contentType };
}

export function isSameOriginLessonSaveRequest(request: Request) {
  const origin = request.headers.get("origin");

  return origin === new URL(request.url).origin;
}

/**
 * Finds (or lazily creates) the SongChart row that owns this user's chart
 * for the given song + activity, returning its current storage targets.
 */
async function getOrCreateAuthoredChartTargets({
  songAssetId,
  authorId,
  activityKey,
}: {
  songAssetId: string;
  authorId: string;
  activityKey: SongActivityKey;
}): Promise<{ chart: Omit<UploadedFileRef, "contentType">; sidecar: Omit<UploadedFileRef, "contentType"> }> {
  const existing = await prisma.songChart.findUnique({
    where: {
      songAssetId_authorId_activityKey: { songAssetId, authorId, activityKey },
    },
  });

  if (existing) {
    return {
      chart: { bucket: existing.chartBucket, path: existing.chartPath },
      sidecar: {
        bucket: existing.sidecarBucket ?? "SidecarJsons",
        path:
          existing.sidecarPath ??
          buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorId }).sidecarPath,
      },
    };
  }

  const paths = buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorId });

  await prisma.songChart.create({
    data: {
      songAssetId,
      authorId,
      activityKey,
      chartBucket: "Charts",
      chartPath: paths.chartPath,
      sidecarBucket: "SidecarJsons",
      sidecarPath: paths.sidecarPath,
    },
  });

  return {
    chart: { bucket: "Charts", path: paths.chartPath },
    sidecar: { bucket: "SidecarJsons", path: paths.sidecarPath },
  };
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginLessonSaveRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentUser = await requireCurrentAppUser();

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId").toLowerCase();

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    if (payload.activityKey != null && (typeof payload.activityKey !== "string" || !normalizeSongActivityKey(payload.activityKey))) {
      return NextResponse.json({ error: "Unsupported song activity" }, { status: 400 });
    }
    const activityKey =
      normalizeSongActivityKey(
        typeof payload.activityKey === "string" ? payload.activityKey : null,
      ) ?? defaultSongActivityKey;

    const existingSongAsset = await prisma.songAsset.findUnique({
      where: { id: songAssetId },
      select: { id: true, isActive: true },
    });

    if (!existingSongAsset || !existingSongAsset.isActive) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const targets = await getOrCreateAuthoredChartTargets({
      songAssetId,
      authorId: currentUser.id,
      activityKey,
    });

    const chartContent = readRequiredString(payload.chart.content, "chart.content");
    const sidecarContent = readRequiredString(payload.sidecar.content, "sidecar.content");
    try { validateLessonContent(chartContent, sidecarContent); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid lesson content" }, { status: 400 }); }
    const revisionTargets = await publishLessonSaveRevision({
      targets,
      revisionId: randomUUID(),
      content: {
        chart: chartContent,
        sidecar: sidecarContent,
      },
      upload: async (file) => { await uploadTextFile(file); },
      updatePointers: async ({ chartPath, sidecarPath }) => {
        const { count } = await prisma.songChart.updateMany({
          where: {
            songAssetId,
            authorId: currentUser.id,
            activityKey,
            chartBucket: targets.chart.bucket,
            chartPath: targets.chart.path,
            sidecarBucket: targets.sidecar.bucket,
            sidecarPath: targets.sidecar.path,
          },
          data: {
            chartBucket: targets.chart.bucket,
            chartPath,
            sidecarBucket: targets.sidecar.bucket,
            sidecarPath,
          },
        });

        return count === 1;
      },
    });

    const chartRef: UploadedFileRef = {
      ...revisionTargets.chart,
      contentType: "text/plain;charset=utf-8",
    };
    const sidecarRef: UploadedFileRef = {
      ...revisionTargets.sidecar,
      contentType: "application/json;charset=utf-8",
    };

    return NextResponse.json({
      ok: true,
      songAsset: {
        id: songAssetId,
        chartBucket: chartRef.bucket,
        sidecarBucket: sidecarRef.bucket,
      },
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

