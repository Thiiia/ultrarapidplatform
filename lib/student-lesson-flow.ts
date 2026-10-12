export type StudentDashboardPath = "/student" | "/demo/student";

export type StudentMissionActivity = {
  title: string;
  detail: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function safeText(value: unknown, maxLength = 320): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}

export function getStudentAssignmentHref(
  navBasePath: StudentDashboardPath,
  assignmentId: string,
): string {
  const query = new URLSearchParams({ assignmentId });
  return navBasePath + "/lessons?" + query.toString();
}

export function getStudentMissionHref(
  navBasePath: StudentDashboardPath,
  missionId: string,
): string {
  const query = new URLSearchParams({ missionId });
  return navBasePath + "/lessons?" + query.toString();
}

export function getMissionActivityLabel(contentJson: unknown): string | null {
  const root = asRecord(contentJson);
  const meta = asRecord(root?.meta);
  const tags = Array.isArray(meta?.tags) ? meta.tags : [];
  const activityTag = tags.find(
    (tag): tag is string =>
      typeof tag === "string" && tag.startsWith("activity:"),
  );
  if (!activityTag) return null;

  const labels: Record<string, string> = {
    "early-algebra": "Early Algebra",
    "number-bonds": "Number Bonds",
    equations: "Equations",
    "missing-numbers": "Missing Numbers",
  };
  return labels[activityTag.slice("activity:".length)] ?? null;
}

export function getMissionActivities(contentJson: unknown): StudentMissionActivity[] {
  const root = asRecord(contentJson);
  if (!root) return [];

  const legacyActivities = Array.isArray(root.activities) ? root.activities : [];
  if (legacyActivities.length > 0) {
    return legacyActivities
      .slice(0, 12)
      .flatMap((item): StudentMissionActivity[] => {
        const activity = asRecord(item);
        const title = safeText(activity?.title);
        if (!title) return [];

        const type = safeText(activity?.type, 40);
        const detail =
          type === "practice"
            ? "Practice"
            : type === "checkpoint"
              ? "Checkpoint"
              : type;
        return [{ title, detail }];
      });
  }

  const blocks = Array.isArray(root.blocks) ? root.blocks : [];
  return blocks.slice(0, 12).flatMap((item): StudentMissionActivity[] => {
    const block = asRecord(item);
    if (!block) return [];

    const type = safeText(block.type, 40);
    if (type === "text" || type === "dialogue") {
      const detail = safeText(block.text);
      return detail ? [{ title: "Lesson note", detail }] : [];
    }
    if (type === "checkpoint") {
      return [{ title: safeText(block.label, 100) ?? "Checkpoint", detail: null }];
    }
    if (type === "unity_level") {
      return [{ title: "Learning activity", detail: null }];
    }
    return [];
  });
}
