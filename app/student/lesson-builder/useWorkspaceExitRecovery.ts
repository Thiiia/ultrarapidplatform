"use client";
import { useEffect, useEffectEvent } from "react";

/** Synchronous private recovery only; no network request or input judgement on exit. */
export function useWorkspaceExitRecovery(enabled: boolean, saveRecovery: () => void) {
  const saveLatest = useEffectEvent(saveRecovery);
  useEffect(() => {
    if (!enabled) return;
    const save = () => saveLatest();
    const onVisibilityChange = () => { if (document.hidden) saveLatest(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);
}
