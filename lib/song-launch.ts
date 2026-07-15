export const FRESH_SONG_LAUNCH_TTL_SECONDS = 30 * 60;

export type SongLaunchAsset = {
  id: string;
  songBucket: string;
  songPath: string;
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string | null;
  sidecarPath: string | null;
};

export type FreshSongLaunchInput = {
  songAssetId: string;
  chartUrl: string;
  sidecarUrl: string | null;
  audioUrl: string;
};

type StorageSigner = (
  bucket: string,
  path: string,
  expiresInSeconds: number,
) => Promise<string>;

export async function createFreshSongLaunchInput(
  asset: SongLaunchAsset,
  sign: StorageSigner,
): Promise<FreshSongLaunchInput> {
  const sidecarUrlPromise =
    asset.sidecarBucket && asset.sidecarPath
      ? sign(
          asset.sidecarBucket,
          asset.sidecarPath,
          FRESH_SONG_LAUNCH_TTL_SECONDS,
        ).catch(() => null)
      : Promise.resolve(null);

  const [chartUrl, audioUrl, sidecarUrl] = await Promise.all([
    sign(
      asset.chartBucket,
      asset.chartPath,
      FRESH_SONG_LAUNCH_TTL_SECONDS,
    ),
    sign(asset.songBucket, asset.songPath, FRESH_SONG_LAUNCH_TTL_SECONDS),
    sidecarUrlPromise,
  ]);

  return {
    songAssetId: asset.id,
    chartUrl,
    sidecarUrl,
    audioUrl,
  };
}
