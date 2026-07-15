type SongSaveAsset = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string | null;
  sidecarPath: string | null;
};

type StorageTarget = {
  bucket: string;
  path: string;
};

export function resolveSongSaveTargets(asset: SongSaveAsset): {
  chart: StorageTarget;
  sidecar: StorageTarget;
} {
  const fallbackSidecarPath = /\.chart$/i.test(asset.chartPath)
    ? asset.chartPath.replace(/\.chart$/i, ".json")
    : `${asset.chartPath}.json`;

  return {
    chart: {
      bucket: asset.chartBucket,
      path: asset.chartPath,
    },
    sidecar: {
      bucket: asset.sidecarBucket ?? "SidecarJsons",
      path: asset.sidecarPath ?? fallbackSidecarPath,
    },
  };
}
