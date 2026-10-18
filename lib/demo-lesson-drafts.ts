export type DemoLessonDraft = {
  chart: string;
  sidecar: string;
  updatedAt?: number;
};

type DemoDraftStorage = Pick<Storage, "getItem" | "setItem">;

export function demoLessonDraftStorageKey(songAssetId: string, activityKey: string) {
  return `ultrarapid-demo-lesson-draft:v1:${encodeURIComponent(songAssetId)}:${encodeURIComponent(activityKey)}`;
}

export function saveDemoLessonDraft(
  storage: DemoDraftStorage,
  songAssetId: string,
  activityKey: string,
  draft: DemoLessonDraft,
  now = Date.now(),
) {
  storage.setItem(demoLessonDraftStorageKey(songAssetId, activityKey), JSON.stringify({ ...draft, updatedAt: now }));
}

export function readDemoLessonDraft(
  storage: Pick<Storage, "getItem">,
  songAssetId: string,
  activityKey: string,
): DemoLessonDraft | null {
  let stored: string | null;
  try {
    stored = storage.getItem(demoLessonDraftStorageKey(songAssetId, activityKey));
  } catch {
    return null;
  }
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    if (
      value &&
      typeof value === "object" &&
      typeof (value as DemoLessonDraft).chart === "string" &&
      typeof (value as DemoLessonDraft).sidecar === "string"
    ) {
      const timestamp = (value as DemoLessonDraft).updatedAt;
      const draft: DemoLessonDraft = {
        chart: (value as DemoLessonDraft).chart,
        sidecar: (value as DemoLessonDraft).sidecar,
        ...(Number.isSafeInteger(timestamp) && timestamp! >= 0 ? { updatedAt: timestamp } : {}),
      };
      JSON.parse(draft.sidecar);
      return draft;
    }
  } catch {
    return null;
  }

  return null;
}
