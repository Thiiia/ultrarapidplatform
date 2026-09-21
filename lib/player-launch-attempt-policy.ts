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
