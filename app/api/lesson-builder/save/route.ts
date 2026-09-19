import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
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
import { prepareAuthoredLessonForPublication } from "@/lib/authored-lesson-publication";
import { createLessonClock } from "@/lib/editor/lesson-timing";

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
  publicationRequestId?: unknown;
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

function sha256(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function sha256ForStoredFile(bucket: string, path: string) {
  const { data, error } = await getSupabaseServerClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Unable to hash required asset: ${bucket}/${path}`);
  return createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex");
}
async function readStoredUtf8Text(
  bucket: string,
  path: string,
  label: string,
): Promise<string> {
  const { data, error } = await getSupabaseServerClient()
    .storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw new Error(
      `Unable to preserve ${label}: ${bucket}/${path}${error?.message ? ` (${error.message})` : ""
      }`,
    );
  }

  // Decode the stored bytes directly so an unchanged chart is carried
  // forward instead of being reconstructed from editor timeline state.
  const bytes = Buffer.from(await data.arrayBuffer());
  const content = bytes.toString("utf8");

  if (!content.trim()) {
    throw new Error(
      `Unable to preserve ${label}: stored file is empty (${bucket}/${path})`,
    );
  }

  return content;
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
  songChartId?: string;
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
      songChartId: existing.id,
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
    const publicationRequestId =
      request.headers.get("idempotency-key")?.trim() ||
      (typeof payload.publicationRequestId === "string" && payload.publicationRequestId.trim()
        ? payload.publicationRequestId.trim()
        : randomUUID());

    if (!payload.sidecar) {
      return NextResponse.json(
        { error: "sidecar payload is required" },
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
      select: { id: true, isActive: true, songBucket: true, songPath: true },
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
    const authorFolder = resolveAuthorFolder({
      name: targetAuthor.name,
      email: null,
    });

    // Resolve the currently-published lesson BEFORE deciding where chart content
    // should come from.
    //
    // A sidecar-only edit should preserve the existing authoritative .chart.
    // The browser does not need to round-trip/reconstruct the rhythm chart.
    const targets = await resolveAuthoredChartTargets({
      songAssetId,
      authorId: targetAuthor.id,
      activityKey,
      authorFolder,
    });

    const submittedChartContent =
      typeof payload.chart?.content === "string" &&
        payload.chart.content.trim().length > 0
        ? payload.chart.content
        : null;

    let chartContent: string;
    let chartSource: "submitted" | "preserved";

    if (submittedChartContent != null) {
      chartContent = submittedChartContent;
      chartSource = "submitted";
    } else {
      if (!targets.current) {
        return NextResponse.json(
          {
            error:
              "chart.content is required for the first publication because there is no existing chart to preserve",
          },
          { status: 400 },
        );
      }

      chartContent = await readStoredUtf8Text(
        targets.current.chartBucket,
        targets.current.chartPath,
        "current chart",
      );

      chartSource = "preserved";
    }

    const sidecarContent = readRequiredString(
      payload.sidecar.content,
      "sidecar.content",
    );

    console.info("[lesson-builder/save] chart source", {
      songAssetId,
      activityKey,
      authorId: targetAuthor.id,
      requestedRevision,
      chartSource,
      sourceChartPath:
        chartSource === "preserved"
          ? targets.current?.chartPath ?? null
          : null,
    });

    const replayedPublication = await prisma.gameContentRevision.findUnique({
      where: { publicationRequestId },
      select: {
        revision: true,
        songAssetId: true,
        activityKey: true,
        authorId: true,
        chartBucket: true,
        chartPath: true,
        sidecarBucket: true,
        sidecarPath: true,
        status: true,
      },
    });
    if (replayedPublication) {
      if (
        replayedPublication.songAssetId !== songAssetId ||
        replayedPublication.activityKey !== activityKey ||
        replayedPublication.authorId !== targetAuthor.id
      ) {
        return NextResponse.json({ error: "Publication request id belongs to a different lesson" }, { status: 409 });
      }
      if (replayedPublication.status !== "ready") {
        return NextResponse.json({ error: "Publication request is still being finalized" }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        authorId: targetAuthor.id,
        authorName: targetAuthor.name,
        revision: replayedPublication.revision,
        publicationRequestId,
        migratedFromLegacy: false,
        songAsset: { id: songAssetId, chartBucket: replayedPublication.chartBucket, sidecarBucket: replayedPublication.sidecarBucket },
        chart: { bucket: replayedPublication.chartBucket, path: replayedPublication.chartPath, contentType: "text/plain;charset=utf-8" },
        sidecar: { bucket: replayedPublication.sidecarBucket, path: replayedPublication.sidecarPath, contentType: "application/json;charset=utf-8" },
      });
    }

    try { validateLessonContent(chartContent, sidecarContent, { forSave: true }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid lesson content" }, { status: 400 }); }

    const previousSidecarContent =
      targets.current?.sidecarBucket && targets.current.sidecarPath
        ? await readStoredUtf8Text(
          targets.current.sidecarBucket,
          targets.current.sidecarPath,
          "current sidecar",
        )
        : undefined;
    const revisionId = randomUUID();
    let authoredPublication;
    try {
      const authoredClock = createLessonClock(chartContent);
      authoredPublication = prepareAuthoredLessonForPublication({
        sidecarContent,
        identity: { songAssetId, activityKey, authorId: targetAuthor.id, revision: revisionId },
        legacyToTickAfterSeconds: (tick, seconds) => {
          return authoredClock.toTick(authoredClock.toSeconds(tick) + seconds);
        },
        runtimeClock: authoredClock,
        previousSidecarContent,
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid authored lesson payload" }, { status: 400 });
    }
    
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
    const persistedSidecarContent = authoredPublication.content;
    const [chartSha256, audioSha256] = await Promise.all([
      Promise.resolve(sha256(chartContent)),
      sha256ForStoredFile(existingSongAsset.songBucket, existingSongAsset.songPath),
    ]);
    const revisionTargets = await publishLessonSaveRevision({
      targets,
      revisionId,
      content: {
        chart: chartContent,
        sidecar: persistedSidecarContent,
      },
      upload: async (file) => { await uploadTextFile(file); },
      commitRevision: async ({ revisionId: publishedRevisionId, chart, sidecar }) => {
        try {
          await prisma.$transaction(async (transaction) => {
            const current = await transaction.songChart.findUnique({
              where: { songAssetId_authorId_activityKey: { songAssetId, authorId: targetAuthor.id, activityKey } },
              select: { id: true, chartBucket: true, chartPath: true, sidecarBucket: true, sidecarPath: true },
            });

            let songChartId = current?.id;
            if (!current) {
              const created = await transaction.songChart.create({
                data: {
                  songAssetId,
                  authorId: targetAuthor.id,
                  activityKey,
                  chartBucket: targets.chart.bucket,
                  chartPath: chart.path,
                  sidecarBucket: targets.sidecar.bucket,
                  sidecarPath: sidecar.path,
                },
                select: { id: true },
              });
              songChartId = created.id;
            } else {
              const expected = targets.current;
              const stillAtExpectedRevision = Boolean(
                expected &&
                current.chartBucket === expected.chartBucket &&
                current.chartPath === expected.chartPath &&
                current.sidecarBucket === expected.sidecarBucket &&
                current.sidecarPath === expected.sidecarPath,
              );
              if (!stillAtExpectedRevision) {
                throw new Error("Save revision conflict: the lesson changed while this publication was being prepared");
              }
              const updated = await transaction.songChart.updateMany({
                where: {
                  id: current.id,
                  chartBucket: current.chartBucket,
                  chartPath: current.chartPath,
                  sidecarBucket: current.sidecarBucket,
                  sidecarPath: current.sidecarPath,
                },
                data: { chartBucket: targets.chart.bucket, chartPath: chart.path, sidecarBucket: targets.sidecar.bucket, sidecarPath: sidecar.path },
              });
              if (updated.count !== 1) {
                throw new Error("Save revision conflict: the lesson changed while this publication was being committed");
              }
            }

            await transaction.gameContentRevision.create({
              data: {
                revision: publishedRevisionId,
                publicationRequestId,
                songChartId: songChartId!,
                songAssetId,
                activityKey,
                authorId: targetAuthor.id,
                chartBucket: chart.bucket,
                chartPath: chart.path,
                sidecarBucket: sidecar.bucket,
                sidecarPath: sidecar.path,
                audioBucket: existingSongAsset.songBucket,
                audioPath: existingSongAsset.songPath,
                chartSha256,
                sidecarSha256: sha256(sidecar.content),
                audioSha256,
                authoredLessonVersion: 3,
                authoredMode: "authored",
                equationCount: authoredPublication.counts.equations,
                encounterCount: authoredPublication.counts.encounters,
                targetCount: authoredPublication.counts.targets,
                status: "ready",
                publishedAt: new Date(),
              },
            });
          });
        } catch (error) {
          if (error instanceof Error && (error.message.startsWith("Save revision conflict") || (error as { code?: string }).code === "P2002")) {
            throw new Error("Save revision conflict: the lesson changed while this publication was being committed");
          }
          throw error;
        }
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
      publicationRequestId,
      migratedFromLegacy: authoredPublication.migratedFromLegacy,
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

    if (
      error instanceof Error &&
      error.message.startsWith("Save revision conflict")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

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

