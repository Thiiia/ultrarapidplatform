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

/**
 * Only authenticated launches receive server-owned attempt IDs. Demo launches
 * remain playable, but must not carry an ID that the refresh endpoint expects
 * to resolve to a persisted PlayerLaunchAttempt.
 */
export function resolveLaunchAttemptIdForPackage(
  hasAuthenticatedPlayer: boolean,
  refreshLaunchAttemptId: string | null,
  createAttemptId: () => string,
): string | null {
  if (refreshLaunchAttemptId) return refreshLaunchAttemptId;
  return hasAuthenticatedPlayer ? createAttemptId() : null;
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
