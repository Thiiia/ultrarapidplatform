import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { validateLessonContent } from "@/lib/lesson-content";
import { publishLessonSaveRevision } from "@/lib/lesson-save-revision";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  buildAuthoredChartStoragePaths,
  defaultSongActivityKey,
  normalizeSongActivityKey,
  normalizeAuthoredSidecarPath,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import { DEV_AUTHOR_FOLDER, findAuthorByName, getOrCreateDevAuthor } from "@/lib/song-storage";
import { resolveRequestedAuthor } from "@/lib/song-author";
import { checkSaveRevisionPrecondition } from "@/lib/song-launch-identity";
import {
  parseAuthoredLessonDraft,
  stampAuthoredLessonIdentity,
} from "@/lib/authored-lesson";

function resolveAuthorFolder(user: { name: string | null; email: string | null }) {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return DEV_AUTHOR_FOLDER;
}

type SaveFilePayload = {
  content?: unknown;
};

type SavePayload = {
  songAssetId?: unknown;
  activityKey?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  revision?: unknown;
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
  const requestUrl = new URL(request.url);

  if (!origin) {
    return true;
  }

  return origin === requestUrl.origin;
}

/**
 * Resolves storage targets for the SongChart row that owns the chart for the
 * given song + activity + author, returning its current storage targets.
 * Charts live under `{authorFolder}/{ActivityFolder}/` in storage.
 */
async function resolveAuthoredChartTargets({
  songAssetId,
  authorId,
  activityKey,
  authorFolder,
}: {
  songAssetId: string;
  authorId: string;
  activityKey: SongActivityKey;
  authorFolder: string;
}): Promise<{
  chart: Omit<UploadedFileRef, "contentType">;
  sidecar: Omit<UploadedFileRef, "contentType">;
  current?: {
    chartBucket: string;
    chartPath: string;
    sidecarBucket: string | null;
    sidecarPath: string | null;
  };
}> {
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
        path: normalizeAuthoredSidecarPath(
          existing.chartPath,
          existing.sidecarPath,
        ),
      },
      current: {
        chartBucket: existing.chartBucket,
        chartPath: existing.chartPath,
        sidecarBucket: existing.sidecarBucket,
        sidecarPath: existing.sidecarPath,
      },
    };
  }

  const paths = buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorFolder });

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

    // Keep the session lookup for user freshness, but resolve the requested
    // author explicitly below. An explicit unknown author must never become
    // dev content.
    await getCurrentAppUser().catch(() => null);

    const payload = (await request.json()) as SavePayload;
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId").toLowerCase();
    const requestedAuthorId =
      typeof payload.authorId === "string" && payload.authorId.trim()
        ? payload.authorId.trim()
        : null;
    const requestedAuthorName =
      typeof payload.authorName === "string" && payload.authorName.trim()
        ? payload.authorName.trim()
        : null;
    const requestedRevision =
      typeof payload.revision === "string" && payload.revision.trim()
        ? payload.revision.trim()
        : null;

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

    const targetAuthor = await resolveRequestedAuthor({
      authorId: requestedAuthorId,
      authorName: requestedAuthorName,
      findById: async (id) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true } }),
      findByName: async (name) => {
        const user = await findAuthorByName(name);
        return user ? { id: user.id, name: user.name } : null;
      },
      getDefault: async () => {
        const user = await getOrCreateDevAuthor();
        return { id: user.id, name: user.name };
      },
    });
    if (!targetAuthor) {
      return NextResponse.json({ error: "No default author is configured" }, { status: 400 });
    }
    const authorFolder = resolveAuthorFolder({ name: targetAuthor.name, email: null });

    const chartContent = readRequiredString(payload.chart.content, "chart.content");
    const sidecarContent = readRequiredString(payload.sidecar.content, "sidecar.content");
    try { validateLessonContent(chartContent, sidecarContent, { forSave: true }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid lesson content" }, { status: 400 }); }

    let authoredDraft: ReturnType<typeof parseAuthoredLessonDraft> | null = null;
    try {
      const parsedSidecar = JSON.parse(sidecarContent) as unknown;
      if (parsedSidecar && typeof parsedSidecar === "object" && (parsedSidecar as { version?: unknown }).version === 3) {
        authoredDraft = parseAuthoredLessonDraft(parsedSidecar);
        if (authoredDraft.songAssetId !== songAssetId) {
          return NextResponse.json({ error: "Authored lesson songAssetId does not match the selected song" }, { status: 400 });
        }
        if (authoredDraft.activityKey !== activityKey) {
          return NextResponse.json({ error: "Authored lesson activityKey does not match the selected activity" }, { status: 400 });
        }
        if (authoredDraft.authorId && authoredDraft.authorId !== targetAuthor.id) {
          return NextResponse.json({ error: "Authored lesson authorId does not match the selected author" }, { status: 400 });
        }
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid authored lesson payload" }, { status: 400 });
    }

    const targets = await resolveAuthoredChartTargets({
      songAssetId,
      authorId: targetAuthor.id,
      activityKey,
      authorFolder,
    });
    // Concurrency precondition: the draft's previous revision must match the
    // revision currently published in storage. The NEW revision (revisionId) is
    // generated below and stamped as output identity, never equated with the
    // previous one (that mismatch was the F02 second-save defect).
    const precondition = checkSaveRevisionPrecondition(targets.chart.path, requestedRevision);
    if (!precondition.ok) {
      return NextResponse.json(
        { error: `Save revision conflict: expected ${precondition.expected}, found ${precondition.found ?? "none"}` },
        { status: 409 },
      );
    }
    const revisionId = randomUUID();
    const persistedSidecarContent = authoredDraft
      ? JSON.stringify(stampAuthoredLessonIdentity(authoredDraft, {
          songAssetId,
          activityKey,
          authorId: targetAuthor.id,
          revision: revisionId,
        }), null, 2)
      : sidecarContent;
    const revisionTargets = await publishLessonSaveRevision({
      targets,
      revisionId,
      content: {
        chart: chartContent,
        sidecar: persistedSidecarContent,
      },
      upload: async (file) => { await uploadTextFile(file); },
      updatePointers: async ({ chartPath, sidecarPath }) => {
        if (!targets.current) {
          // Publish new rows only after both uploads succeed. The unique key
          // prevents two first saves from overwriting one another.
          const { count } = await prisma.songChart.createMany({
            data: [{ songAssetId, authorId: targetAuthor.id, activityKey,
              chartBucket: targets.chart.bucket, chartPath,
              sidecarBucket: targets.sidecar.bucket, sidecarPath }],
            skipDuplicates: true,
          });
          return count === 1;
        }
        const { count } = await prisma.songChart.updateMany({
          where: {
            songAssetId,
            authorId: targetAuthor.id,
            activityKey,
            chartBucket: targets.chart.bucket,
            chartPath: targets.current?.chartPath ?? targets.chart.path,
            sidecarBucket: targets.current ? targets.current.sidecarBucket : targets.sidecar.bucket,
            sidecarPath: targets.current ? targets.current.sidecarPath : targets.sidecar.path,
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
      authorId: targetAuthor.id,
      authorName: targetAuthor.name,
      revision: revisionId,
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

