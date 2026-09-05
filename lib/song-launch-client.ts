import { createSongLaunchSearchParams } from "./platform-launch";

export async function requestFreshSongLaunchParams(input: { songAssetId: string; activityKey: string; rhythmDifficultyKey?: "ExpertSingle" }) {
  const fresh = await requestFreshSongLaunchPackage(input);
  return createSongLaunchSearchParams({ songAssetId: fresh.songAssetId, activityKey: fresh.activityKey,
    chartUrl: fresh.chart.signedUrl, sidecarUrl: fresh.sidecar.signedUrl, audioUrl: fresh.audio.signedUrl,
    rhythmDifficultyKey: input.rhythmDifficultyKey });
}

export type FreshSongLaunchPackage = {
  songAssetId: string;
  activityKey: string;
  chart: { bucket: string; path: string; signedUrl: string };
  sidecar: { bucket: string; path: string; signedUrl: string };
  audio: { bucket: string; path: string; signedUrl: string };
};

export async function requestFreshSongLaunchPackage({
  songAssetId,
  activityKey,
}: {
  songAssetId: string;
  activityKey: string;
}): Promise<FreshSongLaunchPackage> {
  const response = await fetch("/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songAssetId, activityKey }),
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
