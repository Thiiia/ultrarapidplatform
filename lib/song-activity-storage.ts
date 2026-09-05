export type SongActivityKey =
  | "number-bonds"
  | "equations"
  | "missing-numbers"
  | "early-algebra";

export const defaultSongActivityKey: SongActivityKey = "number-bonds";

type ActivityPathFieldNames = {
  chartField: string;
  sidecarField: string;
};

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

const songAssetPathFieldsByKey: Record<SongActivityKey, ActivityPathFieldNames> = {
  "number-bonds": {
    chartField: "numberBondsChartPath",
    sidecarField: "numberBondsSidecarPath",
  },
  equations: {
    chartField: "equationsChartPath",
    sidecarField: "equationsSidecarPath",
  },
  "missing-numbers": {
    chartField: "missingNumbersChartPath",
    sidecarField: "missingNumbersSidecarPath",
  },
  "early-algebra": {
    chartField: "earlyAlgebraChartPath",
    sidecarField: "earlyAlgebraSidecarPath",
  },
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function getFileNameFromPath(path: string, fallbackFileName: string) {
  const fileName = path.split("/").pop()?.trim();
  return fileName && fileName.length > 0 ? fileName : fallbackFileName;
}

function toJsonFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/i, "") + ".json";
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

export function resolveSongAssetStoragePaths({
  activityKey,
  chartPath,
  sidecarPath,
}: {
  activityKey: SongActivityKey | null;
  chartPath: string;
  sidecarPath?: string | null;
}) {
  const chartFileName = getFileNameFromPath(chartPath, "selected.chart");
  const sidecarFileName = sidecarPath
    ? getFileNameFromPath(sidecarPath, toJsonFileName(chartFileName))
    : toJsonFileName(chartFileName);

  if (!activityKey) {
    return {
      chartPath,
      sidecarPath: sidecarPath ?? toJsonFileName(chartPath),
    };
  }

  const folders = songActivityFoldersByKey[activityKey];

  return {
    chartPath: chartPath.startsWith(`${folders.chartFolder}/`) ? chartPath : `${folders.chartFolder}/${chartFileName}`,
    sidecarPath: sidecarPath?.startsWith(`${folders.sidecarFolder}/`) ? sidecarPath : `${folders.sidecarFolder}/${sidecarFileName}`,
  };
}

function readStringProperty(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSongAssetPathsForActivity(
  songAssetRecord: Record<string, unknown>,
  activityKey: SongActivityKey,
) {
  const { chartField, sidecarField } = songAssetPathFieldsByKey[activityKey];

  const chartPath = readStringProperty(songAssetRecord, chartField) ?? "";
  const sidecarPath = readStringProperty(songAssetRecord, sidecarField);

  return {
    activityKey,
    chartPath,
    sidecarPath,
  };
}

export function buildSongAssetActivityPathUpdate({
  activityKey,
  chartPath,
  sidecarPath,
}: {
  activityKey: SongActivityKey;
  chartPath: string;
  sidecarPath: string;
}) {
  const { chartField, sidecarField } = songAssetPathFieldsByKey[activityKey];

  return {
    [chartField]: chartPath,
    [sidecarField]: sidecarPath,
  };
}
