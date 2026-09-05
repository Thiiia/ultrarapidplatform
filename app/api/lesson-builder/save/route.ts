import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAppUser } from "@/lib/current-user";
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

type LessonSaveUser = {
  role: "student" | "teacher" | "admin";
  status: "active" | "inactive" | "invited" | "suspended";
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

  const { error } = await supabase.storage.from(target.bucket).upload(target.path, content, {
    contentType: target.contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return target;
}

export function getLessonSaveAuthorizationError(
  user: LessonSaveUser | null,
): { error: "Unauthorized" | "Forbidden"; status: 401 | 403 } | null {
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  if (
    user.status !== "active" ||
    (user.role !== "teacher" && user.role !== "admin")
  ) {
    return { error: "Forbidden", status: 403 };
  }

  return null;
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
    const authorizationError = getLessonSaveAuthorizationError(
      await getCurrentAppUser(),
    );

    if (authorizationError) {
      return NextResponse.json(
        { error: authorizationError.error },
        { status: authorizationError.status },
      );
    }

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    const requestedChartPath = readRequiredString(payload.chart.path, "chart.path");
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

    const chartRef = await uploadTextFile(
      payload.chart,
      { ...targets.chart, contentType: "text/plain;charset=utf-8" },
    );

    const sidecarRef = await uploadTextFile(
      payload.sidecar,
      { ...targets.sidecar, contentType: "application/json;charset=utf-8" },
    );

    const activityPathUpdate = buildSongAssetActivityPathUpdate({
      activityKey,
      chartPath: chartRef.path,
      sidecarPath: sidecarRef.path,
    });

    const songAsset = await prisma.songAsset.update({
      where: { id: songAssetId },
      data: {
        chartBucket: chartRef.bucket,
        sidecarBucket: sidecarRef.bucket,
        ...activityPathUpdate,
      },
      select: { id: true, chartBucket: true, sidecarBucket: true },
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
