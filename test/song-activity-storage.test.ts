import assert from "node:assert/strict";
import test from "node:test";

type SongActivityStorageModule = {
  defaultSongActivityKey?: string;
  getSongAssetPathsForActivity?: (
    songAssetRecord: Record<string, unknown>,
    requestedActivityKey: "early-algebra",
  ) => {
    activityKey: string;
    chartPath: string;
    sidecarPath: string | null;
  };
  resolveRequestedSongActivityKey?: (
    activity: string | null | undefined,
  ) => string | null;
  resolveSongAssetStoragePaths?: (input: {
    activityKey: "early-algebra";
    chartPath: string;
    sidecarPath?: string | null;
  }) => {
    chartPath: string;
    sidecarPath: string;
  };
};

async function loadSongActivityStorageModule(): Promise<SongActivityStorageModule | null> {
  try {
    const modulePath = "../lib/" + "song-activity-storage";
    return (await import(modulePath)) as SongActivityStorageModule;
  } catch {
    return null;
  }
}

test("does not attach a Missing Numbers sidecar to an Early Algebra chart", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.equal(
    typeof songActivityStorage?.getSongAssetPathsForActivity,
    "function",
    "song-activity-storage must expose getSongAssetPathsForActivity",
  );

  const paths = songActivityStorage!.getSongAssetPathsForActivity!(
    {
      earlyAlgebraChartPath: "Early_Algebra/waves.chart",
      missingNumbersSidecarPath: "Missing_Numbers/waves.json",
      chartPath: "Missing_Numbers/waves.chart",
      sidecarPath: "Missing_Numbers/waves.json",
    },
    "early-algebra",
  );

  assert.equal(paths.chartPath, "Early_Algebra/waves.chart");
  assert.equal(paths.sidecarPath, null);
});

test("uses the Early Algebra sidecar folder when deriving storage paths", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.equal(
    typeof songActivityStorage?.resolveSongAssetStoragePaths,
    "function",
    "song-activity-storage must expose resolveSongAssetStoragePaths",
  );

  const paths = songActivityStorage!.resolveSongAssetStoragePaths!({
    activityKey: "early-algebra",
    chartPath: "Early_Algebra/waves.chart",
    sidecarPath: null,
  });

  assert.deepEqual(paths, {
    chartPath: "Early_Algebra/waves.chart",
    sidecarPath: "Early_Algebra/waves.json",
  });
});

test("rejects an invalid activity request instead of selecting another package", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.equal(
    typeof songActivityStorage?.resolveRequestedSongActivityKey,
    "function",
    "song-activity-storage must expose resolveRequestedSongActivityKey",
  );
  assert.equal(
    songActivityStorage!.resolveRequestedSongActivityKey!("fraction-race"),
    null,
  );
  assert.equal(
    songActivityStorage!.resolveRequestedSongActivityKey!(undefined),
    songActivityStorage!.defaultSongActivityKey,
  );
});
