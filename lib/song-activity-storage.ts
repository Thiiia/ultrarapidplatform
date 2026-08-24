export type SongActivityKey =
  | "number-bonds"
  | "equations"
  | "missing-numbers"
  | "early-algebra";

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
    sidecarFolder: "Missing_Numbers",
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
    chartPath: `${folders.chartFolder}/${chartFileName}`,
    sidecarPath: `${folders.sidecarFolder}/${sidecarFileName}`,
  };
}