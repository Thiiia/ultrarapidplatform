export type StarterTemplateGuidanceInput = {
  songId: string | null;
  encounterCount: number;
  dismissedForSongId: string | null;
};

/**
 * A loaded lesson is a complete starting point. Offer a small, optional
 * invitation to personalise it only while the current song has encounters
 * and the learner has not already chosen how to proceed.
 */
export function shouldOfferStarterTemplate({
  songId,
  encounterCount,
  dismissedForSongId,
}: StarterTemplateGuidanceInput): boolean {
  return Boolean(songId && encounterCount > 0 && dismissedForSongId !== songId);
}

export function libraryEquationsForTab<T>(
  tab: "mine" | "premade",
  myEquations: T[],
  templateEquations: T[],
): T[] {
  return tab === "mine" ? myEquations : templateEquations;
}

export function lessonLaunchStrategy(
  hasUnsavedChanges: boolean,
): "published-template" | "publish-draft" {
  return hasUnsavedChanges ? "publish-draft" : "published-template";
}
