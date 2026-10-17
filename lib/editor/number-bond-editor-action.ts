/** Invalid built journeys need repair; playing must never implicitly regenerate them. */
export function getNumberBondEditorAction({
  ready,
  matchingNotes,
  hasSequence,
}: { ready: boolean; matchingNotes: boolean; hasSequence: boolean }): "play" | "review" | "build" {
  if (ready && matchingNotes) return "play";
  if (matchingNotes && hasSequence) return "review";
  return "build";
}
