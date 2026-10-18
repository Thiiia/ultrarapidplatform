/** Invalid built journeys need repair; playing must never implicitly regenerate them. */
export function getNumberBondEditorAction({
  ready,
  matchingNotes,
  hasSequence,
  demo = false,
}: { ready: boolean; matchingNotes: boolean; hasSequence: boolean; demo?: boolean }): "play" | "review" | "build" | "published-template" {
  if (demo) return "published-template";
  if (ready && matchingNotes) return "play";
  if (matchingNotes && hasSequence) return "review";
  return "build";
}
