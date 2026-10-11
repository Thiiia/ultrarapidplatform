import type { FreshSongLaunchPackage } from "./song-launch-client";
import { studentCopy } from "./student-copy";

export type SongPackageLoadStatus = "idle" | "loading" | "ready" | "error";

export function getPlayerLaunchRoute(navBasePath: string): string {
  return `${navBasePath}/game`;
}

export function getSongChoiceRoute(navBasePath: string, activityKey?: string | null): string {
  const route = `${navBasePath}/song-choice`;
  if (!activityKey?.trim()) return route;

  const searchParams = new URLSearchParams({ activity: activityKey.trim() });
  return `${route}?${searchParams.toString()}`;
}

export function buildSongSelectionCacheKey(songId: string, activityKey: string) {
  return `${activityKey}:${songId}`;
}

export function isPlayableSongLaunchPackage(
  songPackage: FreshSongLaunchPackage | null | undefined,
): songPackage is FreshSongLaunchPackage & {
  source: "authored" | "starter-template";
  readiness: FreshSongLaunchPackage["readiness"] & { canLaunch: true };
} {
  return Boolean(
    songPackage &&
      songPackage.source !== "editor-scaffold" &&
      songPackage.readiness.canLaunch &&
      songPackage.audio.signedUrl.trim() &&
      songPackage.chart.signedUrl.trim() &&
      songPackage.sidecar.signedUrl.trim(),
  );
}

const LEARNER_READINESS_MESSAGES: Array<[RegExp, string]> = [
  [
    /^This activity is not supported by the current lesson flow\./,
    studentCopy.songChoice.activityUnavailable,
  ],
  [
    /^This Number Bonds lesson has not been published yet\./,
    "This Number Bonds lesson is being built. Choose Build Number Bonds lesson to finish it, or try another song.",
  ],
  [
    /^No authored lesson or verified starter template is available\./,
    "This lesson is not ready to play yet. Try another song or ask your teacher for help.",
  ],
  [
    /^The authored chart or sidecar needs repair\./,
    "This lesson needs a quick fix before it can play. Try another song for now.",
  ],
  [
    /^No chart has been authored for /,
    "This song does not have a playable lesson yet. Try another song.",
  ],
];

/** Keep deployment and storage details out of player-facing error copy. */
export function getSongLaunchErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  const errorCode =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  const errorStatus =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  const launchErrors = studentCopy.songChoice.launchErrors;

  if (errorCode === "RUNTIME_CAPABILITY_UNAVAILABLE") {
    return studentCopy.game.runtimeUnavailable;
  }

  switch (errorCode) {
    case "PACKAGE_UNAVAILABLE":
      return launchErrors.preparationUnavailable;
    case "REVISION_NOT_FOUND":
      return launchErrors.revisionUnavailable;
    case "ATTEMPT_NOT_AUTHENTICATED":
      return launchErrors.sessionSignIn;
    case "ATTEMPT_NOT_FOUND":
    case "ATTEMPT_TERMINAL":
      return launchErrors.sessionEnded;
    case "ATTEMPT_FORBIDDEN":
      return launchErrors.sessionUnavailable;
    case "ATTEMPT_IDENTITY_MISMATCH":
      return launchErrors.lessonChanged;
  }

  const learnerMessage = LEARNER_READINESS_MESSAGES.find(([pattern]) => pattern.test(rawMessage))?.[1];
  if (learnerMessage) {
    return learnerMessage;
  }

  if (/failed to fetch|fetch failed|load failed|networkerror|network request failed/i.test(rawMessage)) {
    return launchErrors.connectionInterrupted;
  }

  const signedAssetStatus = rawMessage.match(/^Unable to load (?:text |JSON )?file:\s*(\d{3})\b/i)?.[1];
  const status = signedAssetStatus ? Number(signedAssetStatus) : errorStatus;

  if (status === 401 || status === 403 || status === 410) {
    return launchErrors.lessonLinkUnavailable;
  }
  if (status === 404) {
    return launchErrors.lessonContentMissing;
  }
  if (status === 429 || (status !== null && status >= 500)) {
    return launchErrors.preparationUnavailable;
  }
  if (/sidecar did not contain valid JSON|invalid JSON|unexpected token/i.test(rawMessage)) {
    return launchErrors.lessonDataUnreadable;
  }

  return launchErrors.unableToOpen;
}
