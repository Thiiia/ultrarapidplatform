type PlayableRevisionMetadata = {
  chartBucket?: unknown;
  chartPath?: unknown;
  sidecarBucket?: unknown;
  sidecarPath?: unknown;
  chartSha256?: unknown;
  sidecarSha256?: unknown;
  audioSha256?: unknown;
  equationCount?: unknown;
  encounterCount?: unknown;
  targetCount?: unknown;
};

type CompletePlayableRevisionMetadata = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string;
  sidecarPath: string;
  chartSha256: string;
  sidecarSha256: string;
  audioSha256: string;
  equationCount: number;
  encounterCount: number;
  targetCount: number;
};

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * READY revisions must contain enough usable metadata to build a real lesson.
 * Keep this check shared between learner discovery and launch so a listed
 * revision cannot pass one boundary and fail the other on empty paths or counts.
 */
export function hasPlayableRevisionMetadata(
  revision: PlayableRevisionMetadata,
): revision is PlayableRevisionMetadata & CompletePlayableRevisionMetadata {
  return (
    isNonBlankString(revision.chartBucket) &&
    isNonBlankString(revision.chartPath) &&
    isNonBlankString(revision.sidecarBucket) &&
    isNonBlankString(revision.sidecarPath) &&
    isNonBlankString(revision.chartSha256) &&
    isNonBlankString(revision.sidecarSha256) &&
    isNonBlankString(revision.audioSha256) &&
    isPositiveSafeInteger(revision.equationCount) &&
    isPositiveSafeInteger(revision.encounterCount) &&
    isPositiveSafeInteger(revision.targetCount)
  );
}
