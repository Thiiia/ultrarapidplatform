export const NUMBER_BONDS_SONG_ASSET_IDS = [
  "jazzmaybach",
  "grudge",
  "geminiqueen",
  "justbecause",
  "seven",
  "oneone",
  "garden",
] as const;

export const RHYTHM_DIFFICULTY_KEYS = [
  "EasySingle",
  "MediumSingle",
  "HardSingle",
  "ExpertSingle",
] as const;

export type RhythmDifficultyKey = (typeof RHYTHM_DIFFICULTY_KEYS)[number];

export type DifficultyKeyedActivityKey = "number-bonds" | "early-algebra";

export function isRhythmDifficultyActivityKey(value: unknown): value is DifficultyKeyedActivityKey {
  return value === "number-bonds" || value === "early-algebra";
}

export function isRhythmDifficultyKey(value: unknown): value is RhythmDifficultyKey {
  return typeof value === "string" && RHYTHM_DIFFICULTY_KEYS.includes(value as RhythmDifficultyKey);
}

/**
 * Number Bonds keeps one authored encounter companion per song and chart
 * difficulty. Keep this basename aligned with Unity StreamingAssets so the
 * immutable Platform revision can publish the corresponding artifact.
 */
function normalizeSupportedSongAssetId(songAssetId: string, activityKey: DifficultyKeyedActivityKey) {
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!NUMBER_BONDS_SONG_ASSET_IDS.includes(normalizedSongAssetId as (typeof NUMBER_BONDS_SONG_ASSET_IDS)[number])) {
    const activityLabel = activityKey === "number-bonds" ? "Number Bonds" : "Early Algebra";
    throw new Error(`Unsupported ${activityLabel} song asset: ${songAssetId}`);
  }
  return normalizedSongAssetId;
}

export function buildDifficultyEncounterSidecarFilename(
  activityKey: DifficultyKeyedActivityKey,
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
) {
  const normalizedSongAssetId = normalizeSupportedSongAssetId(songAssetId, activityKey);
  return `${activityKey}-${normalizedSongAssetId}-${rhythmDifficultyKey}.encounters.json`;
}

export function getActivityDifficultyFromSidecarPath(
  sidecarPath: string | null | undefined,
  songAssetId: string,
  activityKey: DifficultyKeyedActivityKey,
): RhythmDifficultyKey | null {
  if (!sidecarPath) return null;
  let normalizedSongAssetId: string;
  try { normalizedSongAssetId = normalizeSupportedSongAssetId(songAssetId, activityKey); }
  catch { return null; }

  const basename = sidecarPath.replace(/\\/g, "/").split("/").pop();
  if (!basename) return null;
  return RHYTHM_DIFFICULTY_KEYS.find((difficulty) =>
    basename === buildDifficultyEncounterSidecarFilename(activityKey, normalizedSongAssetId, difficulty),
  ) ?? null;
}

export function activitySidecarPathMatchesSelection({
  sidecarPath,
  songAssetId,
  rhythmDifficultyKey,
  activityKey,
}: {
  sidecarPath: string;
  songAssetId: string;
  rhythmDifficultyKey: RhythmDifficultyKey;
  activityKey: DifficultyKeyedActivityKey;
}) {
  return getActivityDifficultyFromSidecarPath(sidecarPath, songAssetId, activityKey) === rhythmDifficultyKey;
}

export function isLegacyDifficultySidecarPathForSong(
  sidecarPath: string | null | undefined,
  songAssetId: string,
  _activityKey: DifficultyKeyedActivityKey,
) {
  if (!sidecarPath) return false;
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalizedSongAssetId)) return false;
  const basename = sidecarPath.replace(/\\/g, "/").split("/").pop();
  return basename === `${normalizedSongAssetId}.json` ||
    basename === `${normalizedSongAssetId}.encounters.json`;
}

export function isLegacySidecarCompanionForChart(
  sidecarPath: string | null | undefined,
  chartPath: string | null | undefined,
) {
  if (!sidecarPath || !chartPath) return false;

  const sidecarBasename = sidecarPath.replace(/\\/g, "/").split("/").pop();
  const chartBasename = chartPath.replace(/\\/g, "/").split("/").pop();
  if (!sidecarBasename || !chartBasename || !/\.chart$/i.test(chartBasename)) return false;

  const sidecarStem = sidecarBasename.replace(/(?:\.encounters)?\.json$/i, "");
  const chartStem = chartBasename.replace(/\.chart$/i, "");
  if (!sidecarStem || !chartStem || /-(?:easy|medium|hard|expert)single$/i.test(sidecarStem)) return false;

  return sidecarStem.toLowerCase() === chartStem.toLowerCase();
}

export function selectDifficultySidecarRevision<T extends { sidecarPath: string; chartPath?: string; status?: string }>(
  revisions: readonly T[],
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
  activityKey: DifficultyKeyedActivityKey,
  { allowLegacyReadyFallback = false }: { allowLegacyReadyFallback?: boolean } = {},
): T | null {
  const exact = revisions.find((revision) => activitySidecarPathMatchesSelection({
    sidecarPath: revision.sidecarPath,
    songAssetId,
    rhythmDifficultyKey,
    activityKey,
  }));
  if (exact) return exact;
  if (!allowLegacyReadyFallback) return null;

  return revisions.find((revision) =>
    revision.status === "ready" &&
    (isLegacyDifficultySidecarPathForSong(revision.sidecarPath, songAssetId, activityKey) ||
      isLegacySidecarCompanionForChart(revision.sidecarPath, revision.chartPath)),
  ) ?? null;
}

export function buildNumberBondsEncounterSidecarFilename(
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
) {
  return buildDifficultyEncounterSidecarFilename("number-bonds", songAssetId, rhythmDifficultyKey);
}

export function buildEarlyAlgebraEncounterSidecarFilename(
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
) {
  return buildDifficultyEncounterSidecarFilename("early-algebra", songAssetId, rhythmDifficultyKey);
}

export function getNumberBondsDifficultyFromSidecarPath(
  sidecarPath: string | null | undefined,
  songAssetId: string,
) {
  return getActivityDifficultyFromSidecarPath(sidecarPath, songAssetId, "number-bonds");
}

export function getEarlyAlgebraDifficultyFromSidecarPath(
  sidecarPath: string | null | undefined,
  songAssetId: string,
) {
  return getActivityDifficultyFromSidecarPath(sidecarPath, songAssetId, "early-algebra");
}

export function numberBondsSidecarPathMatchesSelection(input: {
  sidecarPath: string;
  songAssetId: string;
  rhythmDifficultyKey: RhythmDifficultyKey;
}) {
  return activitySidecarPathMatchesSelection({ ...input, activityKey: "number-bonds" });
}

export function earlyAlgebraSidecarPathMatchesSelection(input: {
  sidecarPath: string;
  songAssetId: string;
  rhythmDifficultyKey: RhythmDifficultyKey;
}) {
  return activitySidecarPathMatchesSelection({ ...input, activityKey: "early-algebra" });
}

export function isLegacyNumberBondsSidecarPathForSong(sidecarPath: string | null | undefined, songAssetId: string) {
  if (!NUMBER_BONDS_SONG_ASSET_IDS.includes(songAssetId.trim().toLowerCase() as (typeof NUMBER_BONDS_SONG_ASSET_IDS)[number])) {
    return false;
  }
  return isLegacyDifficultySidecarPathForSong(sidecarPath, songAssetId, "number-bonds");
}

export function isLegacyEarlyAlgebraSidecarPathForSong(sidecarPath: string | null | undefined, songAssetId: string) {
  if (!sidecarPath) return false;
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalizedSongAssetId)) return false;

  const normalizedPath = sidecarPath.replace(/\\/g, "/").toLowerCase();
  const basename = normalizedPath.split("/").pop();
  const belongsToEarlyAlgebra = normalizedPath.split("/").some((segment) =>
    segment === "early_algebra" || segment === "early-algebra",
  );
  const belongsToSong = basename === `${normalizedSongAssetId}.json` ||
    basename === `${normalizedSongAssetId}.encounters.json`;
  return belongsToEarlyAlgebra && belongsToSong;
}

export function selectNumberBondsSidecarRevision<T extends { sidecarPath: string; chartPath?: string; status?: string }>(
  revisions: readonly T[], songAssetId: string, rhythmDifficultyKey: RhythmDifficultyKey,
  options: { allowLegacyReadyFallback?: boolean } = {},
) {
  return selectDifficultySidecarRevision(revisions, songAssetId, rhythmDifficultyKey, "number-bonds", options);
}

export function selectEarlyAlgebraSidecarRevision<T extends { sidecarPath: string; chartPath?: string; status?: string }>(
  revisions: readonly T[], songAssetId: string, rhythmDifficultyKey: RhythmDifficultyKey,
  options: { allowLegacyReadyFallback?: boolean } = {},
) {
  return selectDifficultySidecarRevision(revisions, songAssetId, rhythmDifficultyKey, "early-algebra", options);
}
