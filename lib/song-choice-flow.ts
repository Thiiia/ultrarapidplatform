import type { FreshSongLaunchPackage } from "./song-launch-client";

export type SongPackageLoadStatus = "idle" | "loading" | "ready" | "error";

export function getPlayerLaunchRoute(navBasePath: string): string {
  return `${navBasePath}/game`;
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

  const learnerMessage = LEARNER_READINESS_MESSAGES.find(([pattern]) => pattern.test(rawMessage))?.[1];
  if (learnerMessage) {
    return learnerMessage;
  }

  if (!rawMessage) {
    return "We couldn’t load this song’s lesson files. Try again or choose another song.";
  }

  return "We couldn’t load this song’s lesson files. Try again or choose another song.";
}
