import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { validateLessonContent } from "@/lib/lesson-content";
import { publishLessonSaveRevision } from "@/lib/lesson-save-revision";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  buildAuthoredChartStoragePaths,
  normalizeSongActivityKey,
  normalizeAuthoredSidecarPath,
  validateWritableActivityStorageTarget,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import { DEV_AUTHOR_FOLDER, findAuthorByName, getOrCreateDevAuthor } from "@/lib/song-storage";
import { resolveRequestedAuthor } from "@/lib/song-author";
import { checkSaveRevisionPrecondition } from "@/lib/song-launch-identity";
import {
  prepareAuthoredLessonDraft,
  prepareAuthoredLessonForPublication,
  type AuthoredLessonPublication,
} from "@/lib/authored-lesson-publication";
import { createLessonClock } from "@/lib/editor/lesson-timing";
import { isSameOriginLessonSaveRequest } from "@/lib/lesson-save-origin";
import { canPublishLessonForAuthor, canSaveLessonForAuthor } from "@/lib/lesson-save-authorization";
import { mapLessonSaveInfrastructureError } from "@/lib/lesson-save-infrastructure-error";
import {
  resolveLessonSaveRhythmSource,
  type LessonRhythmSourceProvenance,
} from "@/lib/lesson-save-rhythm-source";
import {
  resolveRhythmSourceRevision,
  type ResolvedRhythmSource,
} from "@/lib/song-rhythm-bootstrap";
import { isRhythmDifficultyKey, type RhythmDifficultyKey } from "@/lib/number-bonds-sidecar";

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
  intent?: unknown;
  songAssetId?: unknown;
  activityKey?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  revision?: unknown;
  rhythmDifficultyKey?: unknown;
  publicationRequestId?: unknown;
  chart?: SaveFilePayload;
  sidecar?: SaveFilePayload;
  rhythmSource?: {
    activityKey?: unknown;
    revision?: unknown;
  };
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
  rhythmDifficultyKey,
}: {
  songAssetId: string;
  authorId: string;
  activityKey: SongActivityKey;
  authorFolder: string;
  rhythmDifficultyKey?: RhythmDifficultyKey | null;
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
    const writableChartPath = validateWritableActivityStorageTarget({
      activityKey,
      path: existing.chartPath,
      pathKind: "chart",
    });
    const writableSidecarPath = validateWritableActivityStorageTarget({
      activityKey,
      path: existing.sidecarPath ?? "",
      pathKind: "sidecar",
    });
    return {
      chart: { bucket: existing.chartBucket, path: writableChartPath },
      sidecar: {
        bucket: existing.sidecarBucket ?? "SidecarJsons",
        path: normalizeAuthoredSidecarPath(
          writableChartPath,
          rhythmDifficultyKey
            ? buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorFolder, rhythmDifficultyKey }).sidecarPath
            : writableSidecarPath,
        ),
      },
      current: {
        chartBucket: existing.chartBucket,
        chartPath: writableChartPath,
        sidecarBucket: existing.sidecarBucket,
        sidecarPath: writableSidecarPath,
      },
      songChartId: existing.id,
    };
  }

  const paths = buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorFolder, rhythmDifficultyKey });

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

    // The origin check protects browser requests from cross-site submission;
    // it is not authentication. Saving writes shared lesson assets and an
    // immutable lesson revision, so require a real app session before parsing it.
    const sessionUser = await getCurrentAppUser().catch(() => null);
    if (!sessionUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const payload = (await request.json()) as SavePayload;
    if (payload.intent !== "draft" && payload.intent !== "publish") {
      return NextResponse.json({ error: "intent must be either draft or publish" }, { status: 400 });
    }
    const intent = payload.intent;
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
    const publicationRequestId = intent === "publish"
      ? request.headers.get("idempotency-key")?.trim() ||
        (typeof payload.publicationRequestId === "string" && payload.publicationRequestId.trim()
          ? payload.publicationRequestId.trim()
          : randomUUID())
      : null;

    if (!payload.sidecar) {
      return NextResponse.json(
        { error: "sidecar payload is required" },
        { status: 400 },
      );
    }

    const activityKey =
      typeof payload.activityKey === "string"
        ? normalizeSongActivityKey(payload.activityKey)
        : null;
    if (!activityKey) {
      return NextResponse.json(
        { error: "activityKey is required and must be a supported song activity" },
        { status: 400 },
      );
    }
    const rhythmDifficultyKey = payload.rhythmDifficultyKey == null
      ? null
      : isRhythmDifficultyKey(payload.rhythmDifficultyKey)
        ? payload.rhythmDifficultyKey
        : null;
    if (payload.rhythmDifficultyKey != null && !rhythmDifficultyKey) {
      return NextResponse.json({ error: "rhythmDifficultyKey is unsupported" }, { status: 400 });
    }

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
        if (sessionUser.role !== "admin") {
          return { id: sessionUser.id, name: sessionUser.name };
        }

        const user = await getOrCreateDevAuthor();
        return { id: user.id, name: user.name };
      },
    });
    if (!targetAuthor) {
      return NextResponse.json({ error: "No default author is configured" }, { status: 400 });
    }
    if (!canSaveLessonForAuthor(sessionUser, targetAuthor.id)) {
      return NextResponse.json(
        { error: "You can only save lessons under your own author account." },
        { status: 403 },
      );
    }
    if (intent === "publish" && !canPublishLessonForAuthor(sessionUser, targetAuthor.id)) {
      return NextResponse.json(
        { error: "Only teachers can publish their own lessons. Admins may publish for any author." },
        { status: 403 },
      );
    }
    const authorFolder = resolveAuthorFolder({
      name: targetAuthor.name,
      email: targetAuthor.id === sessionUser.id ? sessionUser.email : null,
    });

    // Resolve the currently-published lesson BEFORE deciding where chart content
    // should come from.
    //
    // A sidecar-only edit should preserve the existing authoritative .chart.
    // The browser does not need to round-trip/reconstruct the rhythm chart.
    let targets: Awaited<ReturnType<typeof resolveAuthoredChartTargets>>;
    try {
      targets = await resolveAuthoredChartTargets({
        songAssetId,
        authorId: targetAuthor.id,
        activityKey,
        authorFolder,
        rhythmDifficultyKey: activityKey === "number-bonds" ? rhythmDifficultyKey : null,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "The lesson storage target is not writable for this activity" },
        { status: 400 },
      );
    }

    const submittedChartContent =
      typeof payload.chart?.content === "string" &&
        payload.chart.content.trim().length > 0
        ? payload.chart.content
        : null;

    const sourceActivityKey =
      typeof payload.rhythmSource?.activityKey === "string"
        ? normalizeSongActivityKey(payload.rhythmSource.activityKey)
        : null;
    const sourceRevision =
      typeof payload.rhythmSource?.revision === "string" &&
      payload.rhythmSource.revision.trim()
        ? payload.rhythmSource.revision.trim()
        : null;
    const hasRhythmSourceRequest = payload.rhythmSource != null;

    if (hasRhythmSourceRequest && (!sourceActivityKey || !sourceRevision)) {
      return NextResponse.json(
        { error: "rhythmSource requires a supported activityKey and an exact revision" },
        { status: 400 },
      );
    }
    if (submittedChartContent != null && hasRhythmSourceRequest) {
      return NextResponse.json(
        { error: "Submit either chart.content or rhythmSource, not both" },
        { status: 400 },
      );
    }

    // A retry of the original shared-rhythm publication must replay its
    // immutable result before the first-publication-only guard runs. Bind the
    // request ID to the same source revision and activity so a reused ID cannot
    // silently replay a different lesson bootstrap.
    const replayedPublication = publicationRequestId
      ? await prisma.gameContentRevision.findUnique({
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
        rhythmSource: {
          select: {
            revision: true,
            activityKey: true,
            chartSha256: true,
            audioSha256: true,
          },
        },
      },
    })
      : null;
    if (replayedPublication) {
      if (
        replayedPublication.songAssetId !== songAssetId ||
        replayedPublication.activityKey !== activityKey ||
        replayedPublication.authorId !== targetAuthor.id
      ) {
        return NextResponse.json({ error: "Publication request id belongs to a different lesson" }, { status: 409 });
      }
      if (activityKey === "number-bonds" && rhythmDifficultyKey &&
          replayedPublication.sidecarPath.replace(/\\/g, "/").split("/").pop() !==
            buildAuthoredChartStoragePaths({ activityKey, songAssetId, authorFolder, rhythmDifficultyKey }).sidecarPath.split("/").pop()) {
        return NextResponse.json({ error: "Publication request id belongs to a different rhythm difficulty" }, { status: 409 });
      }
      if (replayedPublication.status !== "ready") {
        return NextResponse.json({ error: "Publication request is still being finalized" }, { status: 409 });
      }
      if (
        (replayedPublication.rhythmSource?.revision ?? null) !== sourceRevision ||
        (replayedPublication.rhythmSource?.activityKey ?? null) !== sourceActivityKey
      ) {
        return NextResponse.json({ error: "Publication request id belongs to a different rhythm source" }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        authorId: targetAuthor.id,
        authorName: targetAuthor.name,
        revision: replayedPublication.revision,
        status: "ready",
        previewable: true,
        publicationRequestId,
        migratedFromLegacy: false,
        rhythmSource: replayedPublication.rhythmSource
          ? {
              activityKey: replayedPublication.rhythmSource.activityKey,
              revision: replayedPublication.rhythmSource.revision,
              chartSha256: replayedPublication.rhythmSource.chartSha256,
              audioSha256: replayedPublication.rhythmSource.audioSha256,
            }
          : null,
        songAsset: { id: songAssetId, chartBucket: replayedPublication.chartBucket, sidecarBucket: replayedPublication.sidecarBucket },
        chart: { bucket: replayedPublication.chartBucket, path: replayedPublication.chartPath, contentType: "text/plain;charset=utf-8" },
        sidecar: { bucket: replayedPublication.sidecarBucket, path: replayedPublication.sidecarPath, contentType: "application/json;charset=utf-8" },
      });
    }

    let chartContent: string;
    let chartSource: "submitted" | "preserved" | "shared-rhythm";
    let resolvedRhythmSource: ResolvedRhythmSource | null = null;

    if (submittedChartContent != null) {
      chartContent = submittedChartContent;
      chartSource = "submitted";
    } else if (sourceActivityKey && sourceRevision) {
      try {
        resolvedRhythmSource = await resolveRhythmSourceRevision({
          songAssetId,
          targetActivityKey: activityKey,
          sourceActivityKey,
          sourceRevision,
          findRevision: async (revision) => prisma.gameContentRevision.findUnique({
            where: { revision },
            select: {
              revision: true,
              songAssetId: true,
              activityKey: true,
              status: true,
              chartBucket: true,
              chartPath: true,
              chartSha256: true,
              audioSha256: true,
            },
          }),
          readChart: (bucket, path) => readStoredUtf8Text(
            bucket,
            path,
            "shared rhythm source chart",
          ),
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to resolve the shared rhythm source" },
          { status: 400 },
        );
      }
      chartContent = resolvedRhythmSource.chartContent;
      chartSource = "shared-rhythm";
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

    try {
      validateLessonContent(chartContent, sidecarContent, { forSave: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid lesson content";
      console.warn("[lesson-builder/save] validation rejected", {
        activityKey,
        songAssetId,
        message: message.slice(0, 280),
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const targetSidecarBasename = targets.sidecar.path.replace(/\\/g, "/").split("/").pop();
    const previousSidecarBasename = targets.current?.sidecarPath?.replace(/\\/g, "/").split("/").pop();
    const previousSidecarContent =
      targets.current?.sidecarBucket && targets.current.sidecarPath &&
      previousSidecarBasename === targetSidecarBasename
        ? await readStoredUtf8Text(
          targets.current.sidecarBucket,
          targets.current.sidecarPath,
          "current sidecar",
        )
        : undefined;
    const previousAuthoredSidecarContent = (() => {
      if (!previousSidecarContent) return undefined;
      try {
        const previous = JSON.parse(previousSidecarContent) as { version?: unknown; mode?: unknown };
        return previous.version === 3 && previous.mode === "authored"
          ? previousSidecarContent
          : undefined;
      } catch {
        return undefined;
      }
    })();
    const revisionId = randomUUID();
    let authoredPublication: AuthoredLessonPublication | null = null;
    let revisionCounts: { equations: number; encounters: number; targets: number } | null = null;
    let authoredLessonVersion: number | null = 3;
    let authoredMode: string | null = "authored";
    try {
      const authoredClock = createLessonClock(chartContent);
      const identity = {
        songAssetId,
        activityKey,
        authorId: targetAuthor.id,
        revision: revisionId,
        ...(activityKey === "number-bonds" && rhythmDifficultyKey ? { rhythmDifficultyKey } : {}),
      };
      const legacyToTickAfterSeconds = (tick: number, seconds: number) => {
        return authoredClock.toTick(authoredClock.toSeconds(tick) + seconds);
      };
      if (intent === "publish") {
        authoredPublication = prepareAuthoredLessonForPublication({
          sidecarContent,
          identity,
          legacyToTickAfterSeconds,
          runtimeClock: authoredClock,
          previousSidecarContent: previousAuthoredSidecarContent,
        });
        revisionCounts = authoredPublication.counts;
      } else {
        let draft: AuthoredLessonPublication | null = null;
        try {
          draft = prepareAuthoredLessonDraft({ sidecarContent, identity, legacyToTickAfterSeconds });
        } catch {
          // Valid editor sidecars can still be in the legacy timeline format.
          // Keep those private drafts intact; only an authored v3 snapshot can preview.
          authoredPublication = {
            content: sidecarContent,
            counts: { equations: 0, encounters: 0, targets: 0 },
            migratedFromLegacy: false,
          };
          authoredLessonVersion = null;
          authoredMode = null;
        }
        if (draft) {
          try {
            const playableDraft = prepareAuthoredLessonForPublication({
              sidecarContent: draft.content,
              identity,
              runtimeClock: authoredClock,
              previousSidecarContent: previousAuthoredSidecarContent,
            });
            authoredPublication = { ...playableDraft, migratedFromLegacy: draft.migratedFromLegacy };
            revisionCounts = playableDraft.counts;
          } catch {
            authoredPublication = draft;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid authored lesson payload";
      console.warn("[lesson-builder/save] authored publication rejected", {
        activityKey,
        songAssetId,
        message: message.slice(0, 280),
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!authoredPublication) {
      return NextResponse.json({ error: "Unable to prepare lesson content for saving" }, { status: 400 });
    }
    
    // Concurrency precondition: the draft's previous revision must match the
    // revision currently published in storage. The NEW revision (revisionId) is
    // generated below and stamped as output identity, never equated with the
    // previous one (that mismatch was the F02 second-save defect).
    // A revision loaded from another author or activity can seed a new private
    // draft, but it is not the concurrency token for this author’s first save.
    // Only compare revisions when this author already has a SongChart pointer.
    const expectedRevision = targets.current ? requestedRevision : null;
    const precondition = checkSaveRevisionPrecondition(targets.chart.path, expectedRevision);
    if (!precondition.ok) {
      return NextResponse.json(
        { error: `Save revision conflict: expected ${precondition.expected}, found ${precondition.found ?? "none"}` },
        { status: 409 },
      );
    }

    const previousRevision = precondition.currentRevision
      ? await prisma.gameContentRevision.findUnique({
          where: { revision: precondition.currentRevision },
          select: {
            revision: true,
            songAssetId: true,
            activityKey: true,
            authorId: true,
            chartBucket: true,
            chartPath: true,
            chartSha256: true,
            audioSha256: true,
            rhythmSource: {
              select: {
                revision: true,
                activityKey: true,
                chartSha256: true,
                audioSha256: true,
              },
            },
          },
        })
      : null;
    if (
      previousRevision &&
      (previousRevision.songAssetId !== songAssetId ||
        previousRevision.activityKey !== activityKey ||
        previousRevision.authorId !== targetAuthor.id ||
        previousRevision.chartBucket !== targets.chart.bucket ||
        previousRevision.chartPath !== targets.chart.path)
    ) {
      return NextResponse.json(
        { error: "Save revision conflict: the current lesson revision could not be verified" },
        { status: 409 },
      );
    }

    const previousRhythmSource: LessonRhythmSourceProvenance | null =
      previousRevision?.rhythmSource &&
      typeof previousRevision.chartSha256 === "string" &&
      typeof previousRevision.audioSha256 === "string" &&
      typeof previousRevision.rhythmSource.chartSha256 === "string" &&
      typeof previousRevision.rhythmSource.audioSha256 === "string" &&
      previousRevision.chartSha256 === previousRevision.rhythmSource.chartSha256 &&
      previousRevision.audioSha256 === previousRevision.rhythmSource.audioSha256
        ? {
            activityKey: previousRevision.rhythmSource.activityKey,
            revision: previousRevision.rhythmSource.revision,
            chartSha256: previousRevision.rhythmSource.chartSha256,
            audioSha256: previousRevision.rhythmSource.audioSha256,
          }
        : null;
    let persistedRhythmSource: LessonRhythmSourceProvenance | null;
    try {
      persistedRhythmSource = resolveLessonSaveRhythmSource({
        activityKey,
        chartSource,
        resolvedRhythmSource: resolvedRhythmSource
          ? {
              activityKey: resolvedRhythmSource.sourceActivityKey,
              revision: resolvedRhythmSource.sourceRevision,
              chartSha256: resolvedRhythmSource.chartSha256,
              audioSha256: resolvedRhythmSource.audioSha256,
            }
          : null,
        previousRhythmSource,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to preserve rhythm source provenance" },
        { status: 400 },
      );
    }

    console.info("[lesson-builder/save] chart source", {
      songAssetId,
      activityKey,
      authorId: targetAuthor.id,
      requestedRevision,
      chartSource,
      sourceChartPath: chartSource === "preserved" ? targets.current?.chartPath ?? null : null,
      rhythmSourceActivityKey: persistedRhythmSource?.activityKey ?? null,
      rhythmSourceRevision: persistedRhythmSource?.revision ?? null,
    });

    const persistedSidecarContent = authoredPublication.content;
    const [chartSha256, audioSha256] = await Promise.all([
      Promise.resolve(sha256(chartContent)),
      sha256ForStoredFile(existingSongAsset.songBucket, existingSongAsset.songPath),
    ]);
    if (
      resolvedRhythmSource &&
      (chartSha256 !== resolvedRhythmSource.chartSha256 ||
        audioSha256 !== resolvedRhythmSource.audioSha256)
    ) {
      return NextResponse.json(
        { error: "Shared rhythm publication no longer matches the source chart/audio hashes" },
        { status: 409 },
      );
    }
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
                ...(publicationRequestId ? { publicationRequestId } : {}),
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
                rhythmSourceRevision: persistedRhythmSource?.revision ?? null,
                authoredLessonVersion,
                authoredMode,
                equationCount: revisionCounts?.equations ?? null,
                encounterCount: revisionCounts?.encounters ?? null,
                targetCount: revisionCounts?.targets ?? null,
                status: intent === "publish" ? "ready" : "draft",
                publishedAt: intent === "publish" ? new Date() : null,
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
      status: intent === "publish" ? "ready" : "draft",
      previewable: intent === "publish" || revisionCounts !== null,
      ...(publicationRequestId ? { publicationRequestId } : {}),
      migratedFromLegacy: authoredPublication.migratedFromLegacy,
      rhythmSource: persistedRhythmSource
        ? {
            activityKey: persistedRhythmSource.activityKey,
            revision: persistedRhythmSource.revision,
            chartSha256: persistedRhythmSource.chartSha256,
            audioSha256: persistedRhythmSource.audioSha256,
          }
        : null,
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

    const infrastructureFailure = mapLessonSaveInfrastructureError(error);
    if (infrastructureFailure) {
      return NextResponse.json(infrastructureFailure.body, { status: infrastructureFailure.status });
    }

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
