import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { validateLessonContent } from "@/lib/lesson-content";
import { publishLessonSaveRevision } from "@/lib/lesson-save-revision";
import { prisma } from "@/lib/prisma";
import {
  buildSongAssetActivityPathUpdate,
  defaultSongActivityKey,
  getSongAssetPathsForActivity,
  inferSongActivityKeyFromChartPath,
  normalizeSongActivityKey,
  resolveSongAssetStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";

type SaveFilePayload = {
  bucket?: unknown;
  path?: unknown;
  content?: unknown;
  contentType?: unknown;
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

export function getAllowedLessonSaveTargets(
  songAsset: Record<string, unknown>,
  activityKey: SongActivityKey,
): { chart: Omit<UploadedFileRef, "contentType">; sidecar: Omit<UploadedFileRef, "contentType"> } {
  const selectedPaths = getSongAssetPathsForActivity(songAsset, activityKey);

  if (!selectedPaths.chartPath) {
    throw new Error("Song activity chart path is missing");
  }

  if (!selectedPaths.sidecarPath) {
    throw new Error("Song activity sidecar path is missing");
  }

  const resolvedPaths = resolveSongAssetStoragePaths({
    activityKey,
    chartPath: selectedPaths.chartPath,
    sidecarPath: selectedPaths.sidecarPath,
  });
  const chartBucket = readRequiredString(songAsset.chartBucket, "chartBucket");
  const sidecarBucket =
    typeof songAsset.sidecarBucket === "string" &&
    songAsset.sidecarBucket.trim().length > 0
      ? songAsset.sidecarBucket.trim()
      : "SidecarJsons";

  return {
    chart: { bucket: chartBucket, path: resolvedPaths.chartPath },
    sidecar: { bucket: sidecarBucket, path: resolvedPaths.sidecarPath },
  };
}

function matchesStorageTarget(
  file: SaveFilePayload,
  target: Omit<UploadedFileRef, "contentType">,
) {
  if (
    typeof file.bucket !== "string" ||
    typeof file.path !== "string" ||
    file.bucket.trim().length === 0 ||
    file.path.trim().length === 0
  ) {
    return false;
  }

  return (
    file.bucket.trim() === target.bucket && file.path.trim() === target.path
  );
}

export function hasAllowedLessonSaveTargets(
  files: Pick<SavePayload, "chart" | "sidecar">,
  targets: {
    chart: Omit<UploadedFileRef, "contentType">;
    sidecar: Omit<UploadedFileRef, "contentType">;
  },
) {
  return (
    !!files.chart &&
    !!files.sidecar &&
    matchesStorageTarget(files.chart, targets.chart) &&
    matchesStorageTarget(files.sidecar, targets.sidecar)
  );
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginLessonSaveRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId").toLowerCase();

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    const requestedChartPath = readRequiredString(payload.chart.path, "chart.path");
    if (payload.activityKey != null && (typeof payload.activityKey !== "string" || !normalizeSongActivityKey(payload.activityKey))) {
      return NextResponse.json({ error: "Unsupported song activity" }, { status: 400 });
    }
    const activityKey =
      normalizeSongActivityKey(
        typeof payload.activityKey === "string" ? payload.activityKey : null,
      ) ??
      inferSongActivityKeyFromChartPath(requestedChartPath) ??
      defaultSongActivityKey;
    const existingSongAsset = await prisma.songAsset.findUnique({
      where: { id: songAssetId },
      select: {
        id: true,
        isActive: true,
        chartBucket: true,
        sidecarBucket: true,
        numberBondsChartPath: true,
        equationsChartPath: true,
        missingNumbersChartPath: true,
        earlyAlgebraChartPath: true,
        numberBondsSidecarPath: true,
        equationsSidecarPath: true,
        missingNumbersSidecarPath: true,
        earlyAlgebraSidecarPath: true,
      },
    });

    if (!existingSongAsset || !existingSongAsset.isActive) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const targets = getAllowedLessonSaveTargets(existingSongAsset, activityKey);

    if (!hasAllowedLessonSaveTargets(payload, targets)) {
      return NextResponse.json({ error: "Invalid save target" }, { status: 400 });
    }

    readRequiredString(payload.chart.content, "chart.content");
    readRequiredString(payload.sidecar.content, "sidecar.content");
    const chartContent = payload.chart.content as string;
    const sidecarContent = payload.sidecar.content as string;
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
        const { count } = await prisma.songAsset.updateMany({
          where: {
            id: songAssetId,
            isActive: true,
            chartBucket: targets.chart.bucket,
            sidecarBucket: targets.sidecar.bucket,
            ...buildSongAssetActivityPathUpdate({
              activityKey,
              chartPath: targets.chart.path,
              sidecarPath: targets.sidecar.path,
            }),
          },
          data: {
            chartBucket: targets.chart.bucket,
            sidecarBucket: targets.sidecar.bucket,
            ...buildSongAssetActivityPathUpdate({
              activityKey,
              chartPath,
              sidecarPath,
            }),
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
