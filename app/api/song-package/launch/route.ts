import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { resolveFreshSongLaunchPackage, SongLaunchRevisionNotFoundError } from "@/lib/song-launch-package";
import { canRefreshPlayerLaunchAttempt, parsePlayerLaunchRefreshRequest, resolveLaunchAttemptIdForPackage, shouldCreatePlayerLaunchAttempt } from "@/lib/player-launch-attempt-policy";
import { canonicalPlayerJson } from "@/lib/player-run-lifecycle";
import { getCurrentAppUser } from "@/lib/current-user";
import { canPreviewOwnLessonDraft } from "@/lib/lesson-save-authorization";
import {
  createSongStorageSignedUrl,
  DEV_AUTHOR_FOLDER,
  findAuthorByName,
  findDevAuthor,
} from "@/lib/song-storage";
import { resolveRequestedAuthor } from "@/lib/song-author";
import { assertHostedUnitySupportsPublishedLesson, HostedUnityCapabilityError } from "@/lib/hosted-unity-capability-check";
import { getUnityGameUrl } from "@/lib/unity-game-url";
import {
  buildAuthoredChartStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import {
  isRhythmDifficultyKey,
  selectNumberBondsSidecarRevision,
} from "@/lib/number-bonds-sidecar";

function resolveAuthorFolder(user: { name: string | null; email: string | null } | null) {
  if (!user) return DEV_AUTHOR_FOLDER;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return DEV_AUTHOR_FOLDER;
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

/**
 * Absolute URL of the blank chart/sidecar endpoint. Used in place of a signed
 * storage URL when the dev author has not authored a chart for this song +
 * activity yet, so every consumer (lesson editor hydration, game launch) can
 * still fetch a complete package without anything being persisted.
 */
function buildBlankAssetUrl(request: Request, kind: "chart" | "sidecar", activityKey: string) {
  const url = new URL("/api/song-package/blank", request.url);
  url.searchParams.set("kind", kind);
  url.searchParams.set("activity", activityKey);

  return url.toString();
}

export async function POST(request: Request) {
  let payload: {
    songAssetId?: unknown;
    activityKey?: unknown;
    authorId?: unknown;
    authorName?: unknown;
    revision?: unknown;
    allowBlankPackage?: unknown;
    rhythmDifficultyKey?: unknown;
    learningDifficultyKey?: unknown;
    refreshLaunchAttemptId?: unknown;
    refreshOnly?: unknown;
    allowDraftPreview?: unknown;
  };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    payload = parsed;
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "The launch request must contain a valid JSON object." },
      { status: 400 },
    );
  }
  if (typeof payload.songAssetId !== "string" || !payload.songAssetId.trim() ||
      typeof payload.activityKey !== "string" || !payload.activityKey.trim()) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", error: "Choose a song and activity before opening the lesson." },
      { status: 400 },
    );
  }
  try {
    // The package route is also used by local/demo flows, so an absent auth
    // session does not prevent package resolution. Authenticated launches are
    // registered below and are the only launches eligible for server-side
    // outcome persistence.
    let player = null;
    try {
      player = await getCurrentAppUser();
    } catch {
      player = null;
    }

    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");
    const activityKey = readRequiredString(payload.activityKey, "activityKey");
    let requestedAuthorId =
      typeof payload.authorId === "string" && payload.authorId.trim()
        ? payload.authorId.trim()
        : null;
    const requestedAuthorName =
      typeof payload.authorName === "string" && payload.authorName.trim()
        ? payload.authorName.trim()
        : null;
    let requestedRevision =
      typeof payload.revision === "string" && payload.revision.trim()
        ? payload.revision.trim()
        : null;
    if (payload.rhythmDifficultyKey != null && !isRhythmDifficultyKey(payload.rhythmDifficultyKey)) {
      return NextResponse.json({
        code: "INVALID_DIFFICULTY_KEY",
        error: "Choose a supported rhythm difficulty before opening the lesson.",
      }, { status: 400 });
    }
    const rhythmDifficultyKey = isRhythmDifficultyKey(payload.rhythmDifficultyKey)
      ? payload.rhythmDifficultyKey
      : null;
    const learningDifficultyKey =
      typeof payload.learningDifficultyKey === "string" && payload.learningDifficultyKey.trim()
        ? payload.learningDifficultyKey.trim()
        : null;
    const refreshRequest = parsePlayerLaunchRefreshRequest(
      payload.refreshOnly,
      payload.refreshLaunchAttemptId,
    );
    if (!refreshRequest.ok) {
      return NextResponse.json({
        code: "INVALID_REFRESH_REQUEST",
        error: "This lesson session could not be resumed. Start it again from your lessons.",
      }, { status: 400 });
    }
    const refreshLaunchAttemptId = refreshRequest.launchAttemptId;
    let refreshAttempt: {
      userId: string;
      songAssetId: string;
      activityKey: string;
      authorId: string;
      revision: string | null;
      receipt: Prisma.JsonValue;
      status: string;
    } | null = null;
    if (refreshLaunchAttemptId) {
      if (!player) {
        return NextResponse.json({ code: "ATTEMPT_NOT_AUTHENTICATED", error: "Sign in again to resume this lesson." }, { status: 403 });
      }
      refreshAttempt = await prisma.playerLaunchAttempt.findUnique({
        where: { launchAttemptId: refreshLaunchAttemptId },
        select: { userId: true, songAssetId: true, activityKey: true, authorId: true, revision: true, receipt: true, status: true },
      });
      if (!refreshAttempt) {
        return NextResponse.json({ code: "ATTEMPT_NOT_FOUND", error: "This lesson session has expired. Start it again from your lessons." }, { status: 404 });
      }
      if (refreshAttempt.userId !== player.id) {
        return NextResponse.json({ code: "ATTEMPT_FORBIDDEN", error: "This lesson session belongs to another learner." }, { status: 403 });
      }
      if (!canRefreshPlayerLaunchAttempt(refreshAttempt.status)) {
        return NextResponse.json({ code: "ATTEMPT_TERMINAL", error: "This lesson session has ended. Start a new run from your lessons." }, { status: 409 });
      }
      if (refreshAttempt.songAssetId !== songAssetId || refreshAttempt.activityKey !== activityKey ||
        (requestedAuthorId && refreshAttempt.authorId !== requestedAuthorId) ||
        (requestedRevision && refreshAttempt.revision !== requestedRevision) || !refreshAttempt.revision) {
        return NextResponse.json({ code: "ATTEMPT_IDENTITY_MISMATCH", error: "This lesson session no longer matches its published revision." }, { status: 409 });
      }
      requestedAuthorId = refreshAttempt.authorId;
      requestedRevision = refreshAttempt.revision;
    }
    const author = await resolveRequestedAuthor({
      authorId: requestedAuthorId,
      authorName: requestedAuthorName,
      findById: async (id) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true } }),
      findByName: async (name) => {
        const user = await findAuthorByName(name);
        return user ? { id: user.id, name: user.name } : null;
      },
      getDefault: async () => {
        const user = await findDevAuthor();
        return user ? { id: user.id, name: user.name } : null;
      },
    });
    if (!author) {
      throw new Error("No default author is configured");
    }
    const allowDraftPreview = payload.allowDraftPreview === true &&
      canPreviewOwnLessonDraft(player, author.id, requestedRevision);
    const authorFolder = resolveAuthorFolder({ name: author.name, email: null });

    const songPackage = await resolveFreshSongLaunchPackage({
      songAssetId,
      activityKey,
      authorId: author.id,
      revision: requestedRevision,
      allowBlankPackage: payload.allowBlankPackage === true && !requestedRevision,
      rhythmDifficultyKey,
      learningDifficultyKey,
      launchAttemptId: resolveLaunchAttemptIdForPackage(
        Boolean(player),
        refreshLaunchAttemptId,
        randomUUID,
      ),
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
      loadSongChart: async (assetId, resolvedActivityKey, authorId, difficultyKey) => {
        if (!authorId) return null;
        const revisions = await prisma.gameContentRevision.findMany({
          where: {
            songAssetId: assetId,
            activityKey: resolvedActivityKey,
            authorId,
            status: allowDraftPreview ? { in: ["ready", "draft"] } : "ready",
            ...(requestedRevision ? { revision: requestedRevision } : {}),
          },
          orderBy: { publishedAt: "desc" },
          select: {
            revision: true, status: true, chartBucket: true, chartPath: true, sidecarBucket: true, sidecarPath: true,
            chartSha256: true, sidecarSha256: true, audioSha256: true,
            equationCount: true, encounterCount: true, targetCount: true,
          },
        });
        const revision = resolvedActivityKey === "number-bonds" && difficultyKey
          ? requestedRevision
            ? revisions[0] ?? null
            : selectNumberBondsSidecarRevision(revisions, assetId, difficultyKey, {
                allowLegacyReadyFallback: true,
              })
          : revisions[0] ?? null;
        if (!revision || !revision.chartSha256 || !revision.sidecarSha256 || !revision.audioSha256 ||
          revision.equationCount == null || revision.encounterCount == null || revision.targetCount == null) return null;
        return {
          chartBucket: revision.chartBucket,
          chartPath: revision.chartPath,
          sidecarBucket: revision.sidecarBucket,
          sidecarPath: revision.sidecarPath,
          authorId,
          revision: revision.revision,
          counts: { equations: revision.equationCount, encounters: revision.encounterCount, targets: revision.targetCount },
          hashes: { chartSha256: revision.chartSha256, sidecarSha256: revision.sidecarSha256, audioSha256: revision.audioSha256 },
        };
      },
      loadBlankSongChart: async (assetId, resolvedActivityKey) => {
        // No authored chart yet: serve blank chart/sidecar content under the
        // prospective author storage paths. The database entry (and storage
        // objects) are only created when the user saves.
        const blankActivityKey = resolvedActivityKey as SongActivityKey;
        const paths = buildAuthoredChartStoragePaths({
          activityKey: blankActivityKey,
          songAssetId: assetId,
          authorFolder,
        });

        return {
          chart: {
            bucket: "Charts",
            path: paths.chartPath,
            signedUrl: buildBlankAssetUrl(request, "chart", blankActivityKey),
          },
          sidecar: {
            bucket: "SidecarJsons",
            path: paths.sidecarPath,
            signedUrl: buildBlankAssetUrl(request, "sidecar", blankActivityKey),
          },
        };
      },
      createSignedUrl: createSongStorageSignedUrl,
    });

    if (refreshAttempt && (!songPackage.receipt ||
      canonicalPlayerJson(songPackage.receipt) !== canonicalPlayerJson(refreshAttempt.receipt))) {
      return NextResponse.json({ code: "ATTEMPT_IDENTITY_MISMATCH", error: "This lesson session no longer matches its published revision." }, { status: 409 });
    }

    if (songPackage.readiness.canLaunch && songPackage.receipt) {
      if (songPackage.receipt.songAssetId !== songPackage.songAssetId ||
          songPackage.receipt.activityKey !== songPackage.activityKey ||
          songPackage.receipt.authorId !== songPackage.authorId ||
          songPackage.receipt.revision !== songPackage.revision) {
        throw new HostedUnityCapabilityError(
          "PUBLISHED_LESSON_IDENTITY_MISMATCH",
          "The prepared lesson identity does not match its launch receipt.",
        );
      }
      await assertHostedUnitySupportsPublishedLesson({
        gameUrl: getUnityGameUrl(),
        sidecarUrl: songPackage.sidecar.signedUrl,
        expectedActivityKey: songPackage.activityKey,
        receipt: songPackage.receipt,
      });
    }

    if (shouldCreatePlayerLaunchAttempt({
      hasAuthenticatedPlayer: Boolean(player),
      refreshLaunchAttemptId,
      source: songPackage.source,
      canLaunch: songPackage.readiness.canLaunch,
      hasReceipt: Boolean(songPackage.receipt),
      hasLaunchAttemptId: Boolean(songPackage.launchAttemptId),
    })) {
      if (!songPackage.receipt || !songPackage.launchAttemptId || !player) {
        throw new Error("Playable launch package is missing its receipt, attempt id, or authenticated player");
      }

      await prisma.playerLaunchAttempt.create({
        data: {
          launchAttemptId: songPackage.launchAttemptId,
          userId: player.id,
          songAssetId: songPackage.receipt.songAssetId,
          activityKey: songPackage.receipt.activityKey,
          authorId: songPackage.receipt.authorId,
          revision: songPackage.receipt.revision,
          source: songPackage.receipt.source,
          templateId: songPackage.receipt.templateProvenance?.templateId,
          receipt: songPackage.receipt as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json(songPackage, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HostedUnityCapabilityError) {
      const status = error.code === "RUNTIME_CAPABILITY_UNAVAILABLE" ? 503 : 409;
      return NextResponse.json({ code: error.code, error: error.message }, { status });
    }
    if (error instanceof SongLaunchRevisionNotFoundError) {
      return NextResponse.json({ code: "REVISION_NOT_FOUND", error: error.message }, { status: 404 });
    }
    console.error("Song package launch failed", error);
    return NextResponse.json(
      { code: "PACKAGE_UNAVAILABLE", error: "The song package could not be prepared right now. Please retry." },
      { status: 503 },
    );
  }
}
