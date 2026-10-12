import { createSongLaunchSearchParams } from "./platform-launch";
import type { LessonReadiness, PlayableLessonSource, RhythmDifficultyKey, SongLaunchReceipt } from "./song-launch-package";
import { assertSongActivityMatches } from "./song-activity-authority";

export async function requestFreshSongLaunchParams(input: { songAssetId: string; activityKey: string; authorId?: string | null; authorName?: string | null; revision?: string | null; allowBlankPackage?: boolean; allowDraftPreview?: boolean; rhythmDifficultyKey?: RhythmDifficultyKey; learningDifficultyKey?: string | null; refreshLaunchAttemptId?: string | null }) {
  const fresh = await requestFreshSongLaunchPackage(input);
  if (!fresh.readiness.canLaunch || fresh.source === "editor-scaffold") {
    throw new Error(fresh.readiness.message);
  }
  return createSongLaunchSearchParams({ songAssetId: fresh.songAssetId, activityKey: fresh.activityKey,
    chartUrl: fresh.chart.signedUrl, sidecarUrl: fresh.sidecar.signedUrl, audioUrl: fresh.audio.signedUrl,
    authorId: fresh.authorId, revision: fresh.revision, receipt: fresh.receipt,
    rhythmDifficultyKey: fresh.rhythmDifficultyKey ?? input.rhythmDifficultyKey,
    learningDifficultyKey: fresh.learningDifficultyKey ?? input.learningDifficultyKey,
    source: fresh.source as PlayableLessonSource,
    templateProvenance: fresh.templateProvenance,
    launchAttemptId: fresh.launchAttemptId,
  });
}

export type FreshSongLaunchPackage = {
  contractVersion: 1;
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  source: "authored" | "starter-template" | "editor-scaffold";
  templateProvenance?: { templateId: string; label: string; origin: "verified-starter-template"; sourceRevision?: string };
  runtimeCapabilities: string[];
  rhythmDifficultyKey?: RhythmDifficultyKey;
  learningDifficultyKey?: string;
  launchAttemptId?: string;
  readiness: LessonReadiness;
  receipt?: SongLaunchReceipt;
  chart: { bucket: string; path: string; signedUrl: string };
  sidecar: { bucket: string; path: string; signedUrl: string };
  audio: { bucket: string; path: string; signedUrl: string };
};

export class SongLaunchRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "SongLaunchRequestError";
  }
}

export async function requestSongLaunchReadiness(input: {
  songAssetId: string;
  activityKey: string;
  authorId?: string | null;
  authorName?: string | null;
  revision?: string | null;
  rhythmDifficultyKey?: RhythmDifficultyKey;
}): Promise<LessonReadiness> {
  const response = await fetch("/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, readinessOnly: true }),
  });
  const result = (await response.json().catch(() => null)) as
    | {
      songAssetId?: string;
      activityKey?: string;
      authorId?: string;
      revision?: string;
      rhythmDifficultyKey?: RhythmDifficultyKey;
      readiness?: LessonReadiness;
      code?: string;
      error?: string;
    }
    | null;

  if (!response.ok || !result || !result.readiness || typeof result.readiness.canLaunch !== "boolean") {
    throw new SongLaunchRequestError(
      result?.error ?? "Unable to check whether this lesson is ready",
      result?.code ?? null,
      response.status,
    );
  }

  if (result.songAssetId !== input.songAssetId || typeof result.activityKey !== "string") {
    throw new SongLaunchRequestError(
      "The readiness response does not match the selected song.",
      "READINESS_IDENTITY_MISMATCH",
      response.status,
    );
  }
  assertSongActivityMatches({
    expectedActivityKey: input.activityKey,
    actualActivityKey: result.activityKey,
    boundary: "song-package-readiness",
  });
  if ((input.authorId && result.authorId !== input.authorId) ||
      (input.revision && result.revision !== input.revision) ||
      (input.rhythmDifficultyKey && result.rhythmDifficultyKey !== input.rhythmDifficultyKey)) {
    throw new SongLaunchRequestError(
      "The readiness response does not match the selected lesson revision and difficulty.",
      "READINESS_IDENTITY_MISMATCH",
      response.status,
    );
  }

  return result.readiness;
}

export async function requestFreshSongLaunchPackage({
  songAssetId,
  activityKey,
  authorId = null,
  authorName = null,
  revision = null,
  allowBlankPackage = false,
  allowDraftPreview = false,
  rhythmDifficultyKey,
  learningDifficultyKey = null,
  refreshLaunchAttemptId = null,
}: {
  songAssetId: string;
  activityKey: string;
  authorId?: string | null;
  authorName?: string | null;
  revision?: string | null;
  allowBlankPackage?: boolean;
  allowDraftPreview?: boolean;
  rhythmDifficultyKey?: RhythmDifficultyKey;
  learningDifficultyKey?: string | null;
  refreshLaunchAttemptId?: string | null;
}): Promise<FreshSongLaunchPackage> {
  const response = await fetch("/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      songAssetId,
      activityKey,
      authorId,
      authorName,
      revision,
      allowBlankPackage,
      allowDraftPreview,
      rhythmDifficultyKey,
      learningDifficultyKey,
      refreshLaunchAttemptId,
      refreshOnly: Boolean(refreshLaunchAttemptId),
    }),
  });
  const result = (await response.json().catch(() => null)) as
    | (FreshSongLaunchPackage & { code?: string; error?: string })
    | { code?: string; error?: string }
    | null;

  if (!response.ok || !result || !("chart" in result) || !("sidecar" in result) || !("audio" in result)) {
    throw new SongLaunchRequestError(
      result?.error ?? "Unable to prepare the current song package",
      result?.code ?? null,
      response.status,
    );
  }

  assertSongActivityMatches({
    expectedActivityKey: activityKey,
    actualActivityKey: result.activityKey,
    boundary: "song-package",
  });

  return result;
}
