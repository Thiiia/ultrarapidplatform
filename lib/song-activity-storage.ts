export type SongActivityKey =
  | "number-bonds"
  | "equations"
  | "missing-numbers"
  | "early-algebra";

export const defaultSongActivityKey: SongActivityKey = "number-bonds";

type SongActivityFolders = {
  chartFolder: string;
  sidecarFolder: string;
};

const songActivityFoldersByKey: Record<SongActivityKey, SongActivityFolders> = {
  "number-bonds": {
    chartFolder: "Number_Bonds",
    sidecarFolder: "Number_Bonds",
  },
  equations: {
    chartFolder: "Equations",
    sidecarFolder: "Equations",
  },
  "missing-numbers": {
    chartFolder: "Missing_Numbers",
    sidecarFolder: "Missing_Numbers",
  },
  "early-algebra": {
    chartFolder: "Early_Algebra",
    sidecarFolder: "Early_Algebra",
  },
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function normalizeSongActivityKey(
  value: string | null | undefined,
): SongActivityKey | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeToken(value);

  if (normalized === "number-bonds" || normalized === "numberbond") {
    return "number-bonds";
  }

  if (normalized === "equations" || normalized === "equation") {
    return "equations";
  }

  if (normalized === "missing-numbers" || normalized === "missingnumber") {
    return "missing-numbers";
  }

  if (normalized === "early-algebra" || normalized === "earlyalgebra") {
    return "early-algebra";
  }

  return null;
}

export function resolveRequestedSongActivityKey(
  value: string | null | undefined,
): SongActivityKey | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return defaultSongActivityKey;
  }

  return normalizeSongActivityKey(value);
}

function assertStoragePathBelongsToActivity({
  activityKey,
  path,
  pathKind,
}: {
  activityKey: SongActivityKey;
  path: string;
  pathKind: "chart" | "sidecar";
}) {
  const expectedFolder = songActivityFoldersByKey[activityKey][
    pathKind === "chart" ? "chartFolder" : "sidecarFolder"
  ];

  if (!path.startsWith(`${expectedFolder}/`)) {
    throw new Error(`${pathKind} path does not belong to ${activityKey}`);
  }
}

export function resolveRequestedSongActivityPackage({
  requestedActivityKey,
  chartPath,
  sidecarPath,
}: {
  requestedActivityKey: string | null | undefined;
  chartPath: string;
  sidecarPath?: string | null;
}) {
  const activityKey = resolveRequestedSongActivityKey(requestedActivityKey);

  if (!activityKey) {
    throw new Error(`Unsupported song activity: ${requestedActivityKey}`);
  }

  if (!chartPath.trim()) {
    throw new Error(`Missing chart path for ${activityKey}`);
  }

  assertStoragePathBelongsToActivity({
    activityKey,
    path: chartPath,
    pathKind: "chart",
  });

  const resolvedSidecarPath = sidecarPath?.trim() ? sidecarPath : null;

  if (!resolvedSidecarPath && activityKey === "early-algebra") {
    throw new Error(`Missing sidecar path for ${activityKey}`);
  }

  if (resolvedSidecarPath) {
    assertStoragePathBelongsToActivity({
      activityKey,
      path: resolvedSidecarPath,
      pathKind: "sidecar",
    });
  }

  return {
    activityKey,
    chartPath,
    sidecarPath: resolvedSidecarPath,
  };
}

export function inferSongActivityKeyFromChartPath(
  chartPath: string,
): SongActivityKey | null {
  const folder = chartPath.split("/")[0] ?? "";
  return normalizeSongActivityKey(folder);
}

/**
 * Deterministic per-author, per-activity storage paths for a SongChart row.
 * Used both to materialize a brand-new (blank) chart/sidecar and to validate
 * that a save request targets the storage location it's actually allowed to write to.
 */
export function buildAuthoredChartStoragePaths({
  activityKey,
  songAssetId,
  authorId,
}: {
  activityKey: SongActivityKey;
  songAssetId: string;
  authorId: string;
}) {
  const folders = songActivityFoldersByKey[activityKey];
  const fileBaseName = `${songAssetId}__${authorId}`;

  return {
    chartPath: `${folders.chartFolder}/${fileBaseName}.chart`,
    sidecarPath: `${folders.sidecarFolder}/${fileBaseName}.json`,
  };
}

