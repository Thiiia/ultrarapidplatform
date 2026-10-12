type DemoDraftReentryTutorialInput = {
  isDemoMode: boolean;
  entryIntent: "play" | "personalize";
  hasRestoredDraft: boolean;
  activityKey: string | null;
};

export function shouldShowDemoDraftReentryTutorial({
  isDemoMode,
  entryIntent,
  hasRestoredDraft,
  activityKey,
}: DemoDraftReentryTutorialInput) {
  return isDemoMode &&
    entryIntent === "personalize" &&
    hasRestoredDraft &&
    (activityKey === "early-algebra" || activityKey === "number-bonds");
}
