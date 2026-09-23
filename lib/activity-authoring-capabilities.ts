import { normalizeSongActivityKey, type SongActivityKey } from "./song-activity-storage";
import type {
  AuthoredLessonDraft,
  AuthoredSavedEquation,
} from "./authored-lesson-serialization";

export type AuthoredActivityMechanic = "hit" | "spin" | "drag";

export type ActivityAuthoringCapabilities = {
  activityKey: SongActivityKey;
  supportedAuthoredMechanics: readonly AuthoredActivityMechanic[];
  runtimeExpandedMechanics: readonly string[];
  displayMechanics: readonly string[];
};

const EARLY_ALGEBRA_CAPABILITIES: ActivityAuthoringCapabilities = {
  activityKey: "early-algebra",
  supportedAuthoredMechanics: ["hit", "spin", "drag"],
  runtimeExpandedMechanics: [],
  displayMechanics: ["hit", "spin", "drag"],
};

const NUMBER_BONDS_CAPABILITIES: ActivityAuthoringCapabilities = {
  activityKey: "number-bonds",
  supportedAuthoredMechanics: ["hit"],
  runtimeExpandedMechanics: ["hit", "catch", "spinout", "drag"],
  displayMechanics: ["hit"],
};

const GENERIC_CAPABILITIES: Record<SongActivityKey, ActivityAuthoringCapabilities> = {
  "number-bonds": NUMBER_BONDS_CAPABILITIES,
  "early-algebra": EARLY_ALGEBRA_CAPABILITIES,
  equations: { ...EARLY_ALGEBRA_CAPABILITIES, activityKey: "equations" },
  "missing-numbers": { ...EARLY_ALGEBRA_CAPABILITIES, activityKey: "missing-numbers" },
};

/**
 * Initial conservative timing limits for the sequential Number Bonds runtime.
 * These values must be reviewed against human playtesting before they are
 * treated as universal performance limits.
 */
export const NUMBER_BONDS_TIMING_POLICY = {
  version: 1,
  minimumHitSpacingSeconds: 7.5,
  finalInteractionTailSeconds: 12,
  allowSimultaneousHits: false,
} as const;

export type NumberBondsTimingIssue = {
  code: "gem_spacing" | "gem_tail" | "simultaneous_hits" | "stop_required" | "timing_invalid";
  encounterId: string;
  relatedEncounterId?: string;
  earliestStartSeconds?: number;
  minimumStopSeconds?: number;
};

export type AuthoredActivityTimingEncounter = {
  id: string;
  type: AuthoredActivityMechanic;
  startSeconds: number;
};

const TIMING_COMPARISON_EPSILON_SECONDS = 1e-8;

/** Return the whole-token index for either supported Number Bonds equation order. */
export function getNumberBondsWholeTokenIndex(
  equation: { tokens: ReadonlyArray<{ label: string }>; state?: string } | { state: string },
): number | null {
  if (!("tokens" in equation)) return null;
  const labels = equation.tokens.map((token) => token.label.trim());
  const tokenEquation = { tokens: labels.map((label, index) => ({ id: `number-bonds-token-${index}`, label })) };
  if (getNumberBondsWhole(tokenEquation) == null || labels.length !== 5) return null;

  if (/^\d+$/.test(labels[0]) && labels[1] === "=" && /^\d+$/.test(labels[2]) &&
      labels[3] === "+" && /^\d+$/.test(labels[4])) {
    return 0;
  }
  if (/^\d+$/.test(labels[0]) && labels[1] === "+" && /^\d+$/.test(labels[2]) &&
      labels[3] === "=" && /^\d+$/.test(labels[4])) {
    return 4;
  }
  return null;
}

/** Validate Number Bonds timing in song seconds, independent of editor/runtime storage. */
export function validateAuthoredActivityTiming(
  activityKey: string | null | undefined,
  encounters: readonly AuthoredActivityTimingEncounter[],
  stopAtSeconds?: number,
): NumberBondsTimingIssue[] {
  if (normalizeSongActivityKey(activityKey) !== "number-bonds") return [];

  const hits = encounters
    .filter((encounter) => encounter.type === "hit")
    .map((encounter) => {
      if (!Number.isFinite(encounter.startSeconds)) {
        return { ...encounter, invalid: true as const };
      }
      return { ...encounter, invalid: false as const };
    })
    .sort((left, right) =>
      (left.invalid ? Number.POSITIVE_INFINITY : left.startSeconds) -
        (right.invalid ? Number.POSITIVE_INFINITY : right.startSeconds) ||
      left.id.localeCompare(right.id),
    );

  const issues: NumberBondsTimingIssue[] = [];
  for (const hit of hits) {
    if (hit.invalid) issues.push({ code: "timing_invalid", encounterId: hit.id });
  }
  const validHits = hits.filter((hit) => !hit.invalid);
  for (let index = 1; index < validHits.length; index += 1) {
    const previous = validHits[index - 1];
    const current = validHits[index];
    const spacing = current.startSeconds - previous.startSeconds;
    if (spacing <= TIMING_COMPARISON_EPSILON_SECONDS && !NUMBER_BONDS_TIMING_POLICY.allowSimultaneousHits) {
      issues.push({
        code: "simultaneous_hits",
        encounterId: current.id,
        relatedEncounterId: previous.id,
      });
    } else if (spacing + TIMING_COMPARISON_EPSILON_SECONDS < NUMBER_BONDS_TIMING_POLICY.minimumHitSpacingSeconds) {
      issues.push({
        code: "gem_spacing",
        encounterId: current.id,
        relatedEncounterId: previous.id,
        earliestStartSeconds: previous.startSeconds + NUMBER_BONDS_TIMING_POLICY.minimumHitSpacingSeconds,
      });
    }
  }

  const finalHit = validHits.at(-1);
  if (!finalHit) return issues;
  const minimumStopSeconds = finalHit.startSeconds + NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds;
  if (typeof stopAtSeconds !== "number" || !Number.isFinite(stopAtSeconds) || stopAtSeconds < 0) {
    issues.push({ code: "stop_required", encounterId: finalHit.id, minimumStopSeconds });
  } else if (stopAtSeconds + TIMING_COMPARISON_EPSILON_SECONDS < minimumStopSeconds) {
    issues.push({ code: "gem_tail", encounterId: finalHit.id, minimumStopSeconds });
  }

  return issues;
}

export function getActivityAuthoringCapabilities(
  activityKey: string | null | undefined,
): ActivityAuthoringCapabilities {
  const normalized = normalizeSongActivityKey(activityKey);
  if (typeof activityKey === "string" && activityKey.trim() && !normalized) {
    throw new Error(`Unsupported song activity for authoring: ${activityKey}`);
  }
  return GENERIC_CAPABILITIES[normalized ?? "early-algebra"];
}

export function isAuthoredMechanicSupported(
  activityKey: string | null | undefined,
  mechanic: AuthoredActivityMechanic,
) {
  return getActivityAuthoringCapabilities(activityKey)
    .supportedAuthoredMechanics
    .includes(mechanic);
}

/** Return the Number Bonds whole for the exact equation shape Unity accepts. */
export function getNumberBondsWhole(
  equation: Pick<AuthoredSavedEquation, "tokens"> | { state: string },
): number | null {
  const state = "tokens" in equation
    ? equation.tokens.map((token) => token.label).join(" ")
    : equation.state;
  const normalized = state.replace(/\s+/g, " ").trim();
  const leftToRight = normalized.match(/^(\d+)\s*=\s*(\d+)\s*\+\s*(\d+)$/);
  const rightToLeft = normalized.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)$/);
  const match = leftToRight ?? rightToLeft;
  if (!match) return null;

  const [first, second, third] = match.slice(1).map(Number);
  const whole = leftToRight ? first : third;
  const parts = leftToRight ? [second, third] : [first, second];
  if (
    !Number.isInteger(whole) ||
    whole < 2 ||
    whole > 5 ||
    parts.some((part) => !Number.isInteger(part) || part <= 0) ||
    parts[0] + parts[1] !== whole
  ) {
    return null;
  }
  return whole;
}

export type ActivityContractIssue = {
  code:
    | "activity_equation_count"
    | "activity_equation_invalid"
    | "activity_mechanic_unsupported"
    | "activity_target_shape"
    | "activity_hit_count"
    | "activity_unknown";
  message: string;
};

/**
 * Validate the serialized activity contract. Historical unsupported content
 * is reported for repair; it is never silently retagged or rewritten.
 */
export function getAuthoredActivityContractIssues(
  draft: Pick<AuthoredLessonDraft, "activityKey" | "equations" | "encounters">,
): ActivityContractIssue[] {
  const normalized = normalizeSongActivityKey(draft.activityKey);
  if (!normalized) {
    return [{
      code: "activity_unknown",
      message: `The authored lesson uses unsupported activity "${draft.activityKey}".`,
    }];
  }

  const capabilities = getActivityAuthoringCapabilities(normalized);
  if (capabilities.activityKey !== "number-bonds") return [];

  const issues: ActivityContractIssue[] = [];
  if (draft.equations.length !== 1) {
    issues.push({
      code: "activity_equation_count",
      message: "Number Bonds requires exactly one equation.",
    });
  }

  const equation = draft.equations[0];
  const whole = equation ? getNumberBondsWhole(equation) : null;
  if (equation && whole == null) {
    issues.push({
      code: "activity_equation_invalid",
      message: "Number Bonds requires an equation such as 5 = 2 + 3.",
    });
  }

  const unsupported = draft.encounters.find((encounter) => encounter.type !== "hit");
  if (unsupported) {
    issues.push({
      code: "activity_mechanic_unsupported",
      message: `Number Bonds does not author ${unsupported.type} encounters; runtime spinout and drag are generated from Hits.`,
    });
  }

  const malformedHit = draft.encounters.find((encounter) => {
    if (encounter.type !== "hit") return false;
    const bubbles = encounter.hitBubbles ?? [];
    const requiredPads = new Set(bubbles.flatMap((bubble) => [
      ...(bubble.pads ?? []),
      ...(bubble.positions ?? []),
    ]).filter((pad) => typeof pad === "string" && pad.trim().length > 0));
    return bubbles.length !== 1 || requiredPads.size !== 1;
  });
  if (malformedHit) {
    issues.push({
      code: "activity_target_shape",
      message: "Each Number Bonds Hit must target the whole token with exactly one hit pad.",
    });
  }

  const wholeTokenIndex = equation ? getNumberBondsWholeTokenIndex(equation) : null;
  const partTokenHit = wholeTokenIndex == null ? undefined : draft.encounters.find((encounter) =>
    encounter.type === "hit" && encounter.hitBubbles?.some((bubble) => bubble.tokenIndex !== wholeTokenIndex),
  );
  if (partTokenHit && !malformedHit) {
    issues.push({
      code: "activity_target_shape",
      message: `Number Bonds Hit '${partTokenHit.id}' must target the whole token until the runtime supports part-token targets.`,
    });
  }

  if (whole != null) {
    const hitCount = draft.encounters.filter((encounter) => encounter.type === "hit").length;
    if (hitCount < whole) {
      issues.push({
        code: "activity_hit_count",
        message: `This Number Bonds equation requires at least ${whole} authored Hits.`,
      });
    }
  }

  return issues;
}
