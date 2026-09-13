import { resolveRequestedSongActivityKey, resolveRequestedSongActivityPackage } from "@/lib/song-activity-storage";
import { extractRevisionFromStoragePath, requireMatchingRevision } from "@/lib/song-launch-identity";

type SignedStorageRef = {
  bucket: string;
  path: string;
  signedUrl: string;
};

type SongChartTargets = {
  legacy?: boolean;
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string;
  sidecarPath: string;
  authorId?: string;
  revision?: string;
  counts: {
    encounters: number;
    equations: number;
    targets: number;
  };
  hashes?: {
    chartSha256: string;
    sidecarSha256: string;
    audioSha256: string;
  };
};

type BlankSongChartPackage = {
  chart: SignedStorageRef;
  sidecar: SignedStorageRef;
};

export type RhythmDifficultyKey = "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle";
export type LessonSource = "authored" | "starter-template";
export type TemplateProvenance = {
  templateId: string;
  label: string;
  origin: "verified-starter-template";
  sourceRevision?: string;
};
export type LessonReadinessIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  recoveryAction?: string;
  affectedAsset?: "chart" | "sidecar" | "audio";
};

/**
 * A small, user-facing summary of whether this package can cross the editor →
 * Unity boundary. It intentionally travels with the signed package so the
 * editor never has to infer readiness from an empty timeline or a transport
 * error.
 */
export type LessonReadiness =
  | {
    state: "ready";
    source: "authored";
    canLaunch: true;
    message: string;
    issues?: LessonReadinessIssue[];
  }
  | {
    state: "template-fallback";
    source: "starter-template";
    canLaunch: true;
    message: string;
    issues?: LessonReadinessIssue[];
  }
  | {
    state: "repairable" | "blocked";
    source: "authored" | "starter-template";
    canLaunch: false;
    message: string;
    issues?: LessonReadinessIssue[];
  };

export type PlayableLessonPackage = {
  contractVersion: 1;
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  source: LessonSource;
  templateProvenance?: TemplateProvenance;
  runtimeCapabilities: string[];
  rhythmDifficultyKey?: RhythmDifficultyKey;
  learningDifficultyKey?: string;
  launchAttemptId?: string;
  receipt?: SongLaunchReceipt;
  readiness: LessonReadiness;
  chart: SignedStorageRef;
  sidecar: SignedStorageRef;
  audio: SignedStorageRef;
};

/**
 * Versioned launch receipt: stable identity + object references + content
 * counts, used to compare the platform's delivered package against Unity's
 * received one. Signed URLs (credentials) are excluded; only bucket/path
 * references and counts are recorded.
 */
export type SongLaunchReceipt = {
  receiptVersion: 1;
  contractVersion: 1;
  songAssetId: string;
  activityKey: string;
  authorId: string;
  revision?: string;
  source: LessonSource;
  templateProvenance?: TemplateProvenance;
  runtimeCapabilities: string[];
  rhythmDifficultyKey?: RhythmDifficultyKey;
  learningDifficultyKey?: string;
  launchAttemptId?: string;
  chart: { bucket: string; path: string };
  sidecar: { bucket: string; path: string };
  audio: { bucket: string; path: string };
  counts: {
    encounters: number;
    equations: number;
    targets: number;
  };
  hashes?: {
    chartSha256: string;
    sidecarSha256: string;
    audioSha256: string;
  };
};

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function requireCounts(value: SongChartTargets["counts"] | undefined) {
  if (!value || !Number.isSafeInteger(value.encounters) || value.encounters < 0 ||
      !Number.isSafeInteger(value.equations) || value.equations < 0 ||
      !Number.isSafeInteger(value.targets) || value.targets < 0) {
    throw new Error("Authored launch package is missing valid receipt counts");
  }
  return value;
}

export async function resolveFreshSongLaunchPackage({
  songAssetId,
  activityKey,
  authorId,
  revision,
  allowBlankPackage = false,
  rhythmDifficultyKey,
  learningDifficultyKey,
  launchAttemptId,
  loadSongAsset,
  loadSongChart,
  loadBlankSongChart,
  createSignedUrl,
}: {
  songAssetId: string;
  activityKey: string;
  authorId: string | null;
  revision?: string | null;
  allowBlankPackage?: boolean;
  rhythmDifficultyKey?: RhythmDifficultyKey | null;
  learningDifficultyKey?: string | null;
  launchAttemptId?: string | null;
  loadSongAsset: (id: string) => Promise<Record<string, unknown> | null>;
  loadSongChart: (
    songAssetId: string,
    activityKey: string,
    authorId: string | null,
  ) => Promise<SongChartTargets | null>;
  // Optional fallback used when no chart has been authored yet: supplies
  // pre-built refs (e.g. blank-content URLs under the prospective storage
  // paths) instead of rejecting. Nothing is persisted by this fallback.
  loadBlankSongChart?: (
    songAssetId: string,
    activityKey: string,
  ) => Promise<BlankSongChartPackage | null>;
  createSignedUrl: (bucket: string, path: string) => Promise<string>;
}) {
  const canonicalSongAssetId = readRequiredString(songAssetId, "songAssetId").toLowerCase();
  const songAsset = await loadSongAsset(canonicalSongAssetId);

  if (!songAsset || songAsset.isActive !== true) {
    throw new Error("Song not found");
  }

  if (readRequiredString(songAsset.id, "song asset id") !== canonicalSongAssetId) {
    throw new Error("Song identifier is not canonical");
  }

  const requestedActivityKey = resolveRequestedSongActivityKey(activityKey);

  if (!requestedActivityKey) {
    throw new Error(`Unsupported song activity: ${activityKey}`);
  }

  const audioBucket = readRequiredString(songAsset.songBucket, "songBucket");
  const audioPath = readRequiredString(songAsset.songPath, "songPath");

  const buildStarterTemplatePackage = async (
    message = "A verified starter template is loaded because this song has no published lesson yet.",
  ): Promise<PlayableLessonPackage> => {
    const blankTargets =
      (await loadBlankSongChart?.(canonicalSongAssetId, requestedActivityKey)) ?? null;

    if (!blankTargets) {
      throw new Error(`No verified starter template is available for ${requestedActivityKey}`);
    }

    const blankAudioUrl = await createSignedUrl(audioBucket, audioPath);
    return {
      contractVersion: 1,
      songAssetId: canonicalSongAssetId,
      activityKey: requestedActivityKey,
      ...(authorId ? { authorId } : {}),
      source: "starter-template",
      templateProvenance: {
        templateId: `${requestedActivityKey}:verified-starter-template`,
        label: `${requestedActivityKey} verified starter template`,
        origin: "verified-starter-template",
      },
      runtimeCapabilities: ["launch-receipt-v1", "starter-template"],
      ...(rhythmDifficultyKey ? { rhythmDifficultyKey } : {}),
      ...(learningDifficultyKey ? { learningDifficultyKey } : {}),
      ...(launchAttemptId ? { launchAttemptId } : {}),
      readiness: {
        state: "template-fallback",
        source: "starter-template",
        canLaunch: true,
        message,
      },
      chart: blankTargets.chart,
      sidecar: blankTargets.sidecar,
      audio: {
        bucket: audioBucket,
        path: audioPath,
        signedUrl: blankAudioUrl,
      },
    };
  };

  const chartTargets = await loadSongChart(canonicalSongAssetId, requestedActivityKey, authorId);

  if (!chartTargets) {
    if (!allowBlankPackage) {
      throw new Error(
        `No chart has been authored for ${requestedActivityKey}; blank editor content is not playable`,
      );
    }

    return buildStarterTemplatePackage();
  }

  try {
    resolveRequestedSongActivityPackage({ requestedActivityKey, chartPath: chartTargets.chartPath, sidecarPath: chartTargets.sidecarPath });
  } catch (error) {
    // A historical row can contain swapped chart/sidecar paths. In an
    // unpinned launch, prefer an explicitly-labelled starter template over
    // returning a package Unity cannot read. Pinned revisions always fail
    // closed so their immutable identity is never substituted.
    if (allowBlankPackage && !revision) {
      return buildStarterTemplatePackage(
        "The authored chart or sidecar needs repair, so a verified starter template is loaded instead.",
      );
    }
    throw error;
  }
  const unrevisionedLegacy = chartTargets.legacy === true && !revision &&
    !extractRevisionFromStoragePath(chartTargets.chartPath) &&
    !extractRevisionFromStoragePath(chartTargets.sidecarPath);
  const resolvedRevision = unrevisionedLegacy ? undefined : requireMatchingRevision(
    chartTargets.chartPath,
    chartTargets.sidecarPath,
    revision,
  );
  if (chartTargets.revision && chartTargets.revision !== resolvedRevision) {
    throw new Error("Launch package chart target revision does not match its storage path");
  }
  if (authorId && chartTargets.authorId && chartTargets.authorId !== authorId) {
    throw new Error("Launch package author does not match the requested author");
  }

  const resolvedAuthorId = chartTargets.authorId ?? authorId ?? "";
  const counts = requireCounts(chartTargets.counts);
  if (!chartTargets.hashes) {
    throw new Error("Authored launch package is missing immutable artifact hashes");
  }

  const receipt: SongLaunchReceipt = {
    receiptVersion: 1,
    contractVersion: 1,
    songAssetId: canonicalSongAssetId,
    activityKey: requestedActivityKey,
    authorId: resolvedAuthorId,
    revision: chartTargets.revision ?? resolvedRevision,
    source: "authored",
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
    ...(rhythmDifficultyKey ? { rhythmDifficultyKey } : {}),
    ...(learningDifficultyKey ? { learningDifficultyKey } : {}),
    ...(launchAttemptId ? { launchAttemptId } : {}),
    chart: { bucket: chartTargets.chartBucket, path: chartTargets.chartPath },
    sidecar: { bucket: chartTargets.sidecarBucket, path: chartTargets.sidecarPath },
    audio: { bucket: audioBucket, path: audioPath },
    counts,
    hashes: chartTargets.hashes,
  };

  const [chartUrl, sidecarUrl, audioUrl] = await Promise.all([
    createSignedUrl(chartTargets.chartBucket, chartTargets.chartPath),
    createSignedUrl(chartTargets.sidecarBucket, chartTargets.sidecarPath),
    createSignedUrl(audioBucket, audioPath),
  ]);

  return {
    contractVersion: 1,
    songAssetId: canonicalSongAssetId,
    activityKey: requestedActivityKey,
    authorId: resolvedAuthorId,
    revision: chartTargets.revision ?? resolvedRevision,
    source: "authored",
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
    ...(rhythmDifficultyKey ? { rhythmDifficultyKey } : {}),
    ...(learningDifficultyKey ? { learningDifficultyKey } : {}),
    ...(launchAttemptId ? { launchAttemptId } : {}),
    receipt,
    readiness: {
      state: "ready",
      source: "authored",
      canLaunch: true,
      message: "Your authored lesson is ready for Unity.",
    },
    chart: {
      bucket: chartTargets.chartBucket,
      path: chartTargets.chartPath,
      signedUrl: chartUrl,
    } satisfies SignedStorageRef,
    sidecar: {
      bucket: chartTargets.sidecarBucket,
      path: chartTargets.sidecarPath,
      signedUrl: sidecarUrl,
    } satisfies SignedStorageRef,
    audio: {
      bucket: audioBucket,
      path: audioPath,
      signedUrl: audioUrl,
    } satisfies SignedStorageRef,
  } satisfies PlayableLessonPackage;
}

