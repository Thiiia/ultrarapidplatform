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

    // Folder ownership alone is not enough: historical database rows have
    // accidentally stored a JSON sidecar in chartPath (and vice versa). Reject
    // that record before a signed URL is fetched so the editor can show a
    // repairable package state rather than an empty timeline.
    normalizeAuthoredSidecarPath(chartPath, resolvedSidecarPath);
  } else if (!chartPath.trim().toLowerCase().endsWith(".chart")) {
    throw new Error("Stored chart path must reference a .chart file; repair the lesson record");
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
  const sidecar = sidecarPath?.trim() ?? "";
  if (!chartPath.trim().toLowerCase().endsWith(".chart")) {
    throw new Error("Stored chart path must reference a .chart file; repair the lesson record");
  }
  if (!sidecar.toLowerCase().endsWith(".json")) {
    throw new Error("Stored sidecar path must reference its actual JSON file; repair the lesson record");
  }
  return sidecar;
}

