"use client";
import { useCallback, useState } from "react";
import { createRecordedDraftLedger, type RecordedDraftUpdate } from "@/lib/editor/recorded-draft-ledger";

/** Call the setter from events/effects, never from another React state updater. */
export function useRecordedDrafts<T>() {
  const [ledger] = useState(createRecordedDraftLedger<T>);
  const [drafts, setView] = useState<T[]>([]);
  const setDrafts = useCallback((update: RecordedDraftUpdate<T>) => {
    // Resolve once at input time. React receives a value, not an impure updater.
    setView(ledger.replace(update));
  }, [ledger]);
  return { drafts, setDrafts, ledger };
}
