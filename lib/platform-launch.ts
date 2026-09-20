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
  "learningDifficultyKey",
  "source",
  "templateId",
  "templateLabel",
  "templateOrigin",
  "templateSourceRevision",
  "launchAttemptId",
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
  "authorId",
  "revision",
  "receipt",
  "bridgeNonce",
  "installationId",
  "requiresCalibration",
  "calibrationProtocolVersion",
  "calibrationOffsetMs",
  "platformOrigin",
  "assignmentToken",
  "assignment",
  "sessionToken",
  "session",
  "callbackTarget",
  "callback",
  "returnTarget",
  "return",
  // Unity's current bootstrapper reads the versioned receipt from this
  // legacy-compatible key. Keep `receipt` below for platform-side consumers.
  "receiptJson",
] as const;

type SongLaunchInput = {
  songAssetId: string;
  activityKey: string;
  chartUrl: string;
  sidecarUrl?: string | null;
  audioUrl: string;
  authorId?: string | null;
  revision?: string | null;
  receipt?: {
    receiptVersion: 1;
    songAssetId: string;
    activityKey: string;
    authorId: string;
    revision?: string;
    chart?: { bucket: string; path: string };
    sidecar?: { bucket: string; path: string };
    audio?: { bucket: string; path: string };
    counts?: { encounters: number; equations: number; targets: number };
  } | null;
  rhythmDifficultyKey?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle";
  learningDifficultyKey?: string | null;
  source?: "authored" | "starter-template";
  templateProvenance?: { templateId: string; label: string; origin: "verified-starter-template"; sourceRevision?: string } | null;
  launchAttemptId?: string | null;
};

export function createSongLaunchSearchParams({
  songAssetId,
  activityKey,
  chartUrl,
  sidecarUrl,
  audioUrl,
  authorId,
  revision,
  receipt,
  rhythmDifficultyKey,
  learningDifficultyKey,
  source,
  templateProvenance,
  launchAttemptId,
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

  if (learningDifficultyKey) params.set("learningDifficultyKey", learningDifficultyKey);
  if (source) params.set("source", source);
  if (templateProvenance) {
    params.set("templateId", templateProvenance.templateId);
    params.set("templateLabel", templateProvenance.label);
    params.set("templateOrigin", templateProvenance.origin);
    if (templateProvenance.sourceRevision) params.set("templateSourceRevision", templateProvenance.sourceRevision);
  }
  if (launchAttemptId) params.set("launchAttemptId", launchAttemptId);

  if (authorId) {
    params.set("authorId", authorId);
  }

  if (revision) {
    params.set("revision", revision);
  }

  if (receipt) {
    const serializedReceipt = JSON.stringify(receipt);
    params.set("receipt", serializedReceipt);
    params.set("receiptJson", serializedReceipt);
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
