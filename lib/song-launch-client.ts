import { createSongLaunchSearchParams } from "./platform-launch";
import type { LessonReadiness, RhythmDifficultyKey, SongLaunchReceipt } from "./song-launch-package";

export async function requestFreshSongLaunchParams(input: { songAssetId: string; activityKey: string; authorId?: string | null; authorName?: string | null; revision?: string | null; allowBlankPackage?: boolean; rhythmDifficultyKey?: RhythmDifficultyKey; learningDifficultyKey?: string | null }) {
  const fresh = await requestFreshSongLaunchPackage(input);
  return createSongLaunchSearchParams({ songAssetId: fresh.songAssetId, activityKey: fresh.activityKey,
    chartUrl: fresh.chart.signedUrl, sidecarUrl: fresh.sidecar.signedUrl, audioUrl: fresh.audio.signedUrl,
    authorId: fresh.authorId, revision: fresh.revision, receipt: fresh.receipt,
    rhythmDifficultyKey: input.rhythmDifficultyKey });
}

export type FreshSongLaunchPackage = {
  contractVersion: 1;
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  source: "authored" | "starter-template";
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

export async function requestFreshSongLaunchPackage({
  songAssetId,
  activityKey,
  authorId = null,
  authorName = null,
  revision = null,
  allowBlankPackage = false,
  rhythmDifficultyKey,
  learningDifficultyKey = null,
}: {
  songAssetId: string;
  activityKey: string;
  authorId?: string | null;
  authorName?: string | null;
  revision?: string | null;
  allowBlankPackage?: boolean;
  rhythmDifficultyKey?: RhythmDifficultyKey;
  learningDifficultyKey?: string | null;
}): Promise<FreshSongLaunchPackage> {
  const response = await fetch("/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songAssetId, activityKey, authorId, authorName, revision, allowBlankPackage, rhythmDifficultyKey, learningDifficultyKey }),
  });
  const result = (await response.json().catch(() => null)) as
    | (FreshSongLaunchPackage & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok || !result || !("chart" in result) || !("sidecar" in result) || !("audio" in result)) {
    throw new Error(result?.error ?? "Unable to prepare the current song package");
  }

  return result;
}
