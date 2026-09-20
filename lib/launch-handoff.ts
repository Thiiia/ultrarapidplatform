const launchStorageKey = "ultrarapid_launch_params";

const launchParamKeys = [
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
  "receiptJson",
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
] as const;

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function persistLaunchParams(params: URLSearchParams) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(launchStorageKey, params.toString());
}

export function readPersistedLaunchParams() {
  if (!canUseSessionStorage()) {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.sessionStorage.getItem(launchStorageKey) ?? "");
}

export function resolveLaunchParams(searchParams: Pick<URLSearchParams, "get">) {
  const routeParams = new URLSearchParams();

  for (const key of launchParamKeys) {
    const value = searchParams.get(key);

    if (value) {
      routeParams.set(key, value);
    }
  }

  if (routeParams.size > 0) {
    persistLaunchParams(routeParams);
    return routeParams;
  }

  return readPersistedLaunchParams();
}
