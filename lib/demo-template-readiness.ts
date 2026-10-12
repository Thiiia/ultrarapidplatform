import { SongLaunchRequestError } from "./song-launch-client";
import type { LessonReadiness } from "./song-launch-package";

type DemoTemplateReadinessInput = {
  songTitle: string;
  rhythmDifficultyKey?: string;
};

export function getDemoTemplateUnavailableReadiness(
  error: unknown,
  input: DemoTemplateReadinessInput,
): LessonReadiness | null {
  if (!(error instanceof SongLaunchRequestError) || error.code !== "REVISION_NOT_FOUND") {
    return null;
  }

  const songTitle = input.songTitle.trim() || "this song";
  const rhythmDifficulty = input.rhythmDifficultyKey?.replace(/Single$/, "") || "selected rhythm difficulty";

  return {
    state: "repairable",
    source: "authored",
    canLaunch: false,
    message: `No published lesson is ready for ${songTitle} at ${rhythmDifficulty}. Choose another difficulty or song.`,
  };
}
