/** Presentation only: these states must never advance a chart or award a result. */
export function getRecorderPresentationState({ playing, rangeOpen, pending, drafts }: {
  playing: boolean; rangeOpen: boolean; pending: "spin" | "drag" | null; drafts: number;
}) {
  if (pending && playing && rangeOpen) return { phase: "capturing", label: `Recording ${pending === "spin" ? "Spin" : "Drag"}` } as const;
  if (rangeOpen && !playing) return { phase: "paused", label: "Play song to record" } as const;
  if (rangeOpen) return { phase: "ready", label: "Ready to record" } as const;
  if (drafts > 0) return { phase: "unsaved", label: "Unplaced moves" } as const;
  if (playing) return { phase: "waiting-range", label: "Open an encounter" } as const;
  return { phase: "idle", label: "Start an encounter" } as const;
}

export function getBondPresentationState({ loaded, error, preparing, ready, built }: {
  loaded: boolean; error: boolean; preparing: boolean; ready: boolean; built: boolean;
}) {
  if (error) return { phase: "error", label: "Song needs attention" } as const;
  if (!loaded) return { phase: "loading", label: "Loading song cues" } as const;
  if (preparing) return { phase: "preparing", label: "Preparing mission" } as const;
  if (ready) return { phase: "ready", label: "Ready to play" } as const;
  if (built) return { phase: "review", label: "Check mission" } as const;
  return { phase: "empty", label: "Choose a bond, then build" } as const;
}
