export type DemoLessonDraft = {
  chart: string;
  sidecar: string;
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
) {
  storage.setItem(demoLessonDraftStorageKey(songAssetId, activityKey), JSON.stringify(draft));
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
      const draft = { chart: (value as DemoLessonDraft).chart, sidecar: (value as DemoLessonDraft).sidecar };
      JSON.parse(draft.sidecar);
      return draft;
    }
  } catch {
    return null;
  }

  return null;
}
