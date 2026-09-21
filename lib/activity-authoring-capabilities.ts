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

  const malformedHit = draft.encounters.find(
    (encounter) => encounter.type === "hit" && encounter.hitBubbles?.length !== 1,
  );
  if (malformedHit) {
    issues.push({
      code: "activity_target_shape",
      message: "Each Number Bonds Hit must contain exactly one bubble target.",
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
