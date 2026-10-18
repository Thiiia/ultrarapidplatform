export type RecordedDraftUpdate<T> = T[] | ((current: T[]) => T[]);

/** Event-owned draft snapshot: a second input sees the first before React paints. */
export function createRecordedDraftLedger<T>() {
  let snapshot: T[] = [];
  return {
    getSnapshot: () => snapshot,
    replace(update: RecordedDraftUpdate<T>) {
      const next = typeof update === "function" ? update(snapshot) : update;
      snapshot = next;
      return next;
    },
  };
}
