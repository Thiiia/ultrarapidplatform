import {
  NUMBER_BONDS_TIMING_POLICY,
  validateAuthoredActivityTiming,
  type NumberBondsTimingIssue as AuthoredActivityTimingIssue,
} from "./activity-authoring-capabilities";

/** Keep the authored Number Bonds gate aligned with Unity's sequential runner. */
export const NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS = NUMBER_BONDS_TIMING_POLICY.minimumHitSpacingSeconds;
export const NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS = NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds;

export type NumberBondsTimingCue = { id: string; startSeconds: number };
export type NumberBondsTimingIssue = AuthoredActivityTimingIssue & { message: string };

export function authoredStopBufferSeconds(activityKey: string | null | undefined): number {
  return activityKey === "number-bonds" ? NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS : 5;
}

/**
 * Compatibility wrapper for editor callers that need user-facing guidance.
 * The policy and validation logic live in validateAuthoredActivityTiming so
 * draft readiness and publication cannot drift apart.
 */
export function validateNumberBondsTiming(
  cues: readonly NumberBondsTimingCue[],
  stopAtSeconds: number | null | undefined,
): NumberBondsTimingIssue[] {
  const issues = validateAuthoredActivityTiming(
    "number-bonds",
    cues.map((cue) => ({ ...cue, type: "hit" as const })),
    stopAtSeconds ?? undefined,
  );

  return issues.map((issue) => {
    let message: string;
    switch (issue.code) {
      case "timing_invalid":
        message = `Hit '${issue.encounterId}' has an invalid song time.`;
        break;
      case "simultaneous_hits":
        message = `Number Bonds plays one gem at a time. Move Hit '${issue.encounterId}' after Hit '${issue.relatedEncounterId}'.`;
        break;
      case "gem_spacing":
        message = `Move Hit '${issue.encounterId}' to ${issue.earliestStartSeconds?.toFixed(2)}s or later so the previous gem can finish its catch, spin and drag.`;
        break;
      case "stop_required":
        message = `Keep the song playing until at least ${issue.minimumStopSeconds?.toFixed(2)}s so the final gem can finish.`;
        break;
      case "gem_tail":
        message = `Extend this lesson's stop time to ${issue.minimumStopSeconds?.toFixed(2)}s or later for the final gem.`;
        break;
    }
    return { ...issue, message };
  });
}
