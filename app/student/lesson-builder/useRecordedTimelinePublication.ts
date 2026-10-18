"use client";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";

/** Serialize accepted recording commits after React commits, never in an updater. */
export function useRecordedTimelinePublication<T extends { id: string }>(events: T[], publish: (events: T[]) => void) {
  const pending = useRef(new Set<string>());
  const publishCommitted = useEffectEvent(publish);
  const queue = useCallback((id: string) => { pending.current.add(id); }, []);
  const cancel = useCallback(() => { pending.current.clear(); }, []);
  useEffect(() => {
    if (!pending.current.size || ![...pending.current].every(id => events.some(event => event.id === id))) return;
    pending.current.clear();
    publishCommitted(events);
  }, [events]);
  return { queue, cancel };
}
