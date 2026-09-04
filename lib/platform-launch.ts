const platformLaunchParamKeys = [
  "launch",
  "mode",
  "route",
  "sceneName",
  "scene",
  "songId",
  "songAssetId",
  "activityKey",
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
};

export function createSongLaunchSearchParams({
  songAssetId,
  activityKey,
  chartUrl,
  sidecarUrl,
  audioUrl,
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
