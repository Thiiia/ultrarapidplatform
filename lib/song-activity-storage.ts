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

function stripOptionalAuthorFolderPrefix(path: string) {
  const segments = path.split("/");

  return segments.length > 1 ? segments.slice(1).join("/") : path;
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

  const withoutAuthorFolder = stripOptionalAuthorFolderPrefix(path);

  if (
    !path.startsWith(`${expectedFolder}/`) &&
    !withoutAuthorFolder.startsWith(`${expectedFolder}/`)
  ) {
    throw new Error(`${pathKind} path does not belong to ${activityKey}`);
  }
}

/**
 * Validate a storage target that a save is allowed to write. This deliberately
 * remains folder-owned even though immutable read references may be shared by
 * multiple activity revisions.
 */
export function validateWritableActivityStorageTarget({
  activityKey,
  path,
  pathKind,
}: {
  activityKey: SongActivityKey;
  path: string;
  pathKind: "chart" | "sidecar";
}) {
  if (!path.trim()) {
    throw new Error(`Missing ${pathKind} storage path for ${activityKey}`);
  }

  assertStoragePathBelongsToActivity({ activityKey, path, pathKind });

  if (pathKind === "chart" && !path.trim().toLowerCase().endsWith(".chart")) {
    throw new Error("Writable chart path must reference a .chart file");
  }
  if (pathKind === "sidecar" && !path.trim().toLowerCase().endsWith(".json")) {
    throw new Error("Writable sidecar path must reference a JSON file");
  }

  return path;
}

/**
 * Validate an immutable rhythm reference. The physical folder is not an
 * activity authority: the same hash-pinned chart bytes may be referenced by
 * more than one activity revision.
 */
export function validateRhythmChartReference(chartPath: string) {
  const normalized = chartPath.trim();
  if (!normalized.toLowerCase().endsWith(".chart")) {
    throw new Error("Stored chart path must reference a .chart file; repair the lesson record");
  }
  return normalized;
}

/**
 * Validate the file shape of an immutable activity sidecar reference. Its
 * activity identity is validated from the sidecar/revision contract, not from
 * the storage folder name.
 */
export function validateActivitySidecarReference(sidecarPath: string) {
  const normalized = sidecarPath.trim();
  if (!normalized.toLowerCase().endsWith(".json")) {
    throw new Error("Stored sidecar path must reference its actual JSON file; repair the lesson record");
  }
  return normalized;
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

  const resolvedChartPath = validateRhythmChartReference(chartPath);

  const resolvedSidecarPath = sidecarPath?.trim()
    ? validateActivitySidecarReference(sidecarPath)
    : null;

  if (!resolvedSidecarPath && activityKey === "early-algebra") {
    throw new Error(`Missing sidecar path for ${activityKey}`);
  }

  if (resolvedSidecarPath) {
    // File shape is checked before fetching. Activity identity is checked by
    // the revision metadata and parsed sidecar contract, not by this folder.
    normalizeAuthoredSidecarPath(resolvedChartPath, resolvedSidecarPath);
  }

  return {
    activityKey,
    chartPath: resolvedChartPath,
    sidecarPath: resolvedSidecarPath,
  };
}

export function inferSongActivityKeyFromChartPath(
  chartPath: string,
): SongActivityKey | null {
  const segments = chartPath.split("/").filter(Boolean);

  // Chart paths may carry an author-folder prefix (e.g. "dev/Early_Algebra/..."),
  // so inspect the first two segments for a known activity folder.
  for (const segment of segments.slice(0, 2)) {
    const activityKey = normalizeSongActivityKey(segment);

    if (activityKey) {
      return activityKey;
    }
  }

  return null;
}

/**
 * Deterministic per-author, per-activity storage paths for a SongChart row.
 * Used both to materialize a brand-new (blank) chart/sidecar and to validate
 * that a save request targets the storage location it's actually allowed to write to.
 *
 * Storage layout: `{authorFolder}/{ActivityFolder}/{songAssetId}.chart|.json`,
 * e.g. `dev/Missing_Numbers/waves.chart`.
 */
export function buildAuthoredChartStoragePaths({
  activityKey,
  songAssetId,
  authorFolder,
}: {
  activityKey: SongActivityKey;
  songAssetId: string;
  authorFolder: string;
}) {
  const folders = songActivityFoldersByKey[activityKey];
  const normalizedAuthorFolder = authorFolder.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedAuthorFolder) {
    throw new Error("Author folder is required");
  }

  return {
    chartPath: `${normalizedAuthorFolder}/${folders.chartFolder}/${songAssetId}.chart`,
    sidecarPath: `${normalizedAuthorFolder}/${folders.sidecarFolder}/${songAssetId}.json`,
  };
}

/**
 * Validate stored references without guessing filenames. Historical sidecars
 * use .encounters.json; editor-created sidecars may use .json.
 */
export function normalizeAuthoredSidecarPath(
  chartPath: string,
  sidecarPath?: string | null,
) {
  validateRhythmChartReference(chartPath);
  return validateActivitySidecarReference(sidecarPath?.trim() ?? "");
}

