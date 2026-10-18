/** Read at input time: React's displayed playhead can lag media timeupdate events. */
export function readEditorPlaybackSeconds(audio: Pick<HTMLMediaElement, "currentTime"> | null, displayedSeconds: number) {
  const seconds = audio?.currentTime;
  if (typeof seconds === "number" && Number.isFinite(seconds)) return Math.max(0, seconds);
  return Number.isFinite(displayedSeconds) ? Math.max(0, displayedSeconds) : 0;
}

/** Media state closes capture immediately, before React paints pause/seek changes. */
export function canCaptureEditorPlayback(audio: Pick<HTMLMediaElement, "paused" | "ended" | "seeking" | "readyState"> | null, playbackRequested: boolean) {
  return playbackRequested && (!audio || (!audio.paused && !audio.ended && !audio.seeking && audio.readyState >= 2));
}
