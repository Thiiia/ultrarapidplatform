const platformLaunchParamKeys = [
  "launch",
  "mode",
  "route",
  "sceneName",
  "scene",
  "songId",
  "songAssetId",
  "activityKey",
  "rhythmDifficultyKey",
  "trackId",
  "song",
  "manifestUrl",
  "manifest",
  "chartPath",
  "chartUrl",
  "chart",
  "sidecarPath",
  "sidecarUrl",
  "sidecar",
  "audioPath",
  "audioUrl",
  "audio",
  "songUrl",
  "assignmentToken",
  "assignment",
  "sessionToken",
  "session",
  "callbackTarget",
  "callback",
  "returnTarget",
  "return",
] as const;

type SongLaunchInput = {
  songAssetId: string;
  activityKey: string;
  chartUrl: string;
  sidecarUrl?: string | null;
  audioUrl: string;
  rhythmDifficultyKey?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle";
};

export function createSongLaunchSearchParams({
  songAssetId,
  activityKey,
  chartUrl,
  sidecarUrl,
  audioUrl,
  rhythmDifficultyKey,
}: SongLaunchInput) {
  const params = new URLSearchParams({
    launch: "PlayNow",
    songAssetId,
    activityKey,
    chartUrl,
    audioUrl,
  });

  if (sidecarUrl) {
    params.set("sidecarUrl", sidecarUrl);
  }

  if (rhythmDifficultyKey) {
    params.set("rhythmDifficultyKey", rhythmDifficultyKey);
  }

  return params;
}

export function buildEmbeddedGameUrl(
  gameUrl: string,
  searchParams: Pick<URLSearchParams, "get">,
) {
  const launchParams = new URLSearchParams();

  for (const key of platformLaunchParamKeys) {
    const value = searchParams.get(key);

    if (value) {
      launchParams.set(key, value);
    }
  }

  if (launchParams.size === 0) {
    return gameUrl;
  }

  try {
    const url = new URL(gameUrl);

    launchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  } catch {
    const separator = gameUrl.includes("?") ? "&" : "?";
    return gameUrl + separator + launchParams.toString();
  }
}
