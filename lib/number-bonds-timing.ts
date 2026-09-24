/** Keep the authored Number Bonds gate aligned with Unity's sequential runner. */
export const NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS = 7.5;
export const NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS = 12;
const COMPARISON_EPSILON_SECONDS = 0.00000001;

export type NumberBondsTimingCue = { id: string; startSeconds: number };
export type NumberBondsTimingIssue = {
  code: "timing_invalid" | "simultaneous_hits" | "gem_spacing" | "stop_required" | "gem_tail";
  encounterId: string;
  relatedEncounterId?: string;
  earliestStartSeconds?: number;
  minimumStopSeconds?: number;
  message: string;
};

export function authoredStopBufferSeconds(activityKey: string | null | undefined): number {
  return activityKey === "number-bonds" ? NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS : 5;
}

export function validateNumberBondsTiming(
  cues: readonly NumberBondsTimingCue[],
  stopAtSeconds: number | null | undefined,
): NumberBondsTimingIssue[] {
  const issues: NumberBondsTimingIssue[] = [];
  const hits = cues.filter((cue) => {
    if (Number.isFinite(cue.startSeconds)) return true;
    issues.push({
      code: "timing_invalid", encounterId: cue.id,
      message: `Hit '${cue.id}' has an invalid song time.`,
    });
    return false;
  }).sort((left, right) =>
    left.startSeconds - right.startSeconds || left.id.localeCompare(right.id),
  );

  for (let index = 1; index < hits.length; index += 1) {
    const previous = hits[index - 1];
    const current = hits[index];
    const spacing = current.startSeconds - previous.startSeconds;
    if (spacing <= COMPARISON_EPSILON_SECONDS) {
      issues.push({
        code: "simultaneous_hits", encounterId: current.id, relatedEncounterId: previous.id,
        message: `Number Bonds plays one gem at a time. Move Hit '${current.id}' after Hit '${previous.id}'.`,
      });
    } else if (spacing + COMPARISON_EPSILON_SECONDS < NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS) {
      const earliestStartSeconds = previous.startSeconds + NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS;
      issues.push({
        code: "gem_spacing", encounterId: current.id, relatedEncounterId: previous.id,
        earliestStartSeconds,
        message: `Move Hit '${current.id}' to ${earliestStartSeconds.toFixed(2)}s or later so the previous gem can finish its catch, spin and drag.`,
      });
    }
  }

  if (hits.length === 0) return issues;
  const finalHit = hits[hits.length - 1];
  const minimumStopSeconds = finalHit.startSeconds + NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS;
  if (stopAtSeconds == null || !Number.isFinite(stopAtSeconds) || stopAtSeconds < 0) {
    issues.push({
      code: "stop_required", encounterId: finalHit.id, minimumStopSeconds,
      message: `Keep the song playing until at least ${minimumStopSeconds.toFixed(2)}s so the final gem can finish.`,
    });
  } else if (stopAtSeconds + COMPARISON_EPSILON_SECONDS < minimumStopSeconds) {
    issues.push({
      code: "gem_tail", encounterId: finalHit.id, minimumStopSeconds,
      message: `Extend this lesson's stop time to ${minimumStopSeconds.toFixed(2)}s or later for the final gem.`,
    });
  }
  return issues;
}
