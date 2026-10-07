export const NUMBER_BONDS_SONG_ASSET_IDS = [
  "waves",
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

export function isRhythmDifficultyKey(value: unknown): value is RhythmDifficultyKey {
  return typeof value === "string" && RHYTHM_DIFFICULTY_KEYS.includes(value as RhythmDifficultyKey);
}

/**
 * Number Bonds keeps one authored encounter companion per song and chart
 * difficulty. Keep this basename aligned with Unity StreamingAssets so the
 * immutable Platform revision can publish the corresponding artifact.
 */
export function buildNumberBondsEncounterSidecarFilename(
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
) {
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!NUMBER_BONDS_SONG_ASSET_IDS.includes(normalizedSongAssetId as (typeof NUMBER_BONDS_SONG_ASSET_IDS)[number])) {
    throw new Error(`Unsupported Number Bonds song asset: ${songAssetId}`);
  }

  return `number-bonds-${normalizedSongAssetId}-${rhythmDifficultyKey}.encounters.json`;
}

export function getNumberBondsDifficultyFromSidecarPath(
  sidecarPath: string | null | undefined,
  songAssetId: string,
): RhythmDifficultyKey | null {
  if (!sidecarPath) return null;
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!NUMBER_BONDS_SONG_ASSET_IDS.includes(normalizedSongAssetId as (typeof NUMBER_BONDS_SONG_ASSET_IDS)[number])) {
    return null;
  }

  const basename = sidecarPath.replace(/\\/g, "/").split("/").pop();
  if (!basename) return null;
  return RHYTHM_DIFFICULTY_KEYS.find((difficulty) =>
    basename === buildNumberBondsEncounterSidecarFilename(normalizedSongAssetId, difficulty),
  ) ?? null;
}

export function numberBondsSidecarPathMatchesSelection({
  sidecarPath,
  songAssetId,
  rhythmDifficultyKey,
}: {
  sidecarPath: string;
  songAssetId: string;
  rhythmDifficultyKey: RhythmDifficultyKey;
}) {
  return getNumberBondsDifficultyFromSidecarPath(sidecarPath, songAssetId) === rhythmDifficultyKey;
}

export function isLegacyNumberBondsSidecarPathForSong(
  sidecarPath: string | null | undefined,
  songAssetId: string,
) {
  if (!sidecarPath) return false;
  const normalizedSongAssetId = songAssetId.trim().toLowerCase();
  if (!NUMBER_BONDS_SONG_ASSET_IDS.includes(normalizedSongAssetId as (typeof NUMBER_BONDS_SONG_ASSET_IDS)[number])) {
    return false;
  }
  const basename = sidecarPath.replace(/\\/g, "/").split("/").pop();
  return basename === `${normalizedSongAssetId}.json` ||
    basename === `${normalizedSongAssetId}.encounters.json`;
}

export function selectNumberBondsSidecarRevision<T extends { sidecarPath: string; status?: string }>(
  revisions: readonly T[],
  songAssetId: string,
  rhythmDifficultyKey: RhythmDifficultyKey,
  { allowLegacyReadyFallback = false }: { allowLegacyReadyFallback?: boolean } = {},
): T | null {
  const exact = revisions.find((revision) => numberBondsSidecarPathMatchesSelection({
    sidecarPath: revision.sidecarPath,
    songAssetId,
    rhythmDifficultyKey,
  }));
  if (exact) return exact;
  if (!allowLegacyReadyFallback) return null;

  return revisions.find((revision) =>
    revision.status === "ready" &&
    isLegacyNumberBondsSidecarPathForSong(revision.sidecarPath, songAssetId),
  ) ?? null;
}
