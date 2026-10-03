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

export type EmbeddedCalibrationLaunchSnapshot = Readonly<{
  bridgeNonce: string;
  requiresCalibration: boolean;
  calibrationOffsetMs?: number;
}>;

/**
 * Keep the calibration decision made for one iframe launch stable while the
 * running Unity player reports its fresh calibration back to the platform.
 * The player already applies that result in place; changing these URL params
 * mid-run would reload the iframe and bypass its explicit Continue action.
 */
export function resolveEmbeddedCalibrationLaunchSnapshot(
  current: EmbeddedCalibrationLaunchSnapshot | null,
  bridgeNonce: string | null,
  status: "loading" | "required" | "ready",
  calibrationOffsetMs: number | null,
): EmbeddedCalibrationLaunchSnapshot | null {
  if (!bridgeNonce) return null;

  if (current?.bridgeNonce === bridgeNonce) {
    return current;
  }

  if (status === "loading") return null;

  if (
    status === "ready" &&
    calibrationOffsetMs !== null &&
    Number.isInteger(calibrationOffsetMs) &&
    calibrationOffsetMs >= -350 &&
    calibrationOffsetMs <= 350
  ) {
    return {
      bridgeNonce,
      requiresCalibration: false,
      calibrationOffsetMs,
    };
  }

  return { bridgeNonce, requiresCalibration: true };
}

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
