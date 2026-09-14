import type { FreshSongLaunchPackage } from "./song-launch-client";

export type SongPackageLoadStatus = "idle" | "loading" | "ready" | "error";

export function isPlayableSongLaunchPackage(
  songPackage: FreshSongLaunchPackage | null | undefined,
) {
  return Boolean(
    songPackage &&
      songPackage.source !== "editor-scaffold" &&
      songPackage.readiness.canLaunch &&
      songPackage.audio.signedUrl.trim() &&
      songPackage.chart.signedUrl.trim() &&
      songPackage.sidecar.signedUrl.trim(),
  );
}

const USER_FACING_READINESS_MESSAGES = [
  /^No authored lesson or verified starter template is available\./,
  /^The authored chart or sidecar needs repair\./,
  /^No chart has been authored for /,
];

/** Keep deployment and storage details out of player-facing error copy. */
export function getSongLaunchErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  if (USER_FACING_READINESS_MESSAGES.some((pattern) => pattern.test(rawMessage))) {
    return rawMessage;
  }

  if (!rawMessage) {
    return "We couldn’t load this song’s lesson files. Try again or choose another song.";
  }

  return "We couldn’t load this song’s lesson files. Try again or choose another song.";
}
