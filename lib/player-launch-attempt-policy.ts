import type { LessonSource } from "@/lib/song-launch-package";

export function shouldCreatePlayerLaunchAttempt(input: {
  hasAuthenticatedPlayer: boolean;
  refreshLaunchAttemptId: string | null;
  source: LessonSource;
  canLaunch: boolean;
  hasReceipt: boolean;
  hasLaunchAttemptId: boolean;
}): boolean {
  return !input.refreshLaunchAttemptId
    && input.hasAuthenticatedPlayer
    && input.canLaunch
    && input.source !== "editor-scaffold"
    && input.hasReceipt
    && input.hasLaunchAttemptId;
}

export function canRefreshPlayerLaunchAttempt(status: string): boolean {
  return status === "active";
}

export function parsePlayerLaunchRefreshRequest(
  refreshOnly: unknown,
  launchAttemptId: unknown,
): { ok: true; launchAttemptId: string | null } | { ok: false } {
  const normalizedId = typeof launchAttemptId === "string" ? launchAttemptId.trim() : "";
  if (refreshOnly === true) {
    return normalizedId
      ? { ok: true, launchAttemptId: normalizedId }
      : { ok: false };
  }

  return normalizedId
    ? { ok: false }
    : { ok: true, launchAttemptId: null };
}
