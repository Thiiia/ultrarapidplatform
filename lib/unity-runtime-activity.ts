export const currentUnityRuntimeActivityKeys = ["number-bonds", "early-algebra"] as const;

export type CurrentUnityRuntimeActivityKey = (typeof currentUnityRuntimeActivityKeys)[number];

export function isCurrentUnityRuntimeActivity(activityKey: string): activityKey is CurrentUnityRuntimeActivityKey {
  return currentUnityRuntimeActivityKeys.includes(activityKey as CurrentUnityRuntimeActivityKey);
}

export function getUnityRuntimeActivityIssue(activityKey: string) {
  return {
    code: "unity-runtime-activity-unsupported",
    severity: "error" as const,
    message: `The current Unity runtime does not implement activity "${activityKey}".`,
    recoveryAction: "Choose Number Bonds or Early Algebra, or finish the Unity activity implementation before publishing this lesson.",
  };
}
