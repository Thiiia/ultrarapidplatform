import assert from "node:assert/strict";
import test from "node:test";
import { resolveSongAssetStoragePaths } from "../lib/song-activity-storage";

test("retains immutable revision paths for the next save", () => {
  const pair = { chartPath: "Early_Algebra/revisions/current/waves.chart", sidecarPath: "Early_Algebra/revisions/current/waves.json" };
  assert.deepEqual(resolveSongAssetStoragePaths({activityKey: "early-algebra", ...pair}), pair);
});

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
  resolveRequestedSongActivityPackage?: (input: {
    requestedActivityKey: string | null | undefined;
    chartPath: string;
    sidecarPath?: string | null;
  }) => {
    activityKey: string;
    chartPath: string;
    sidecarPath: string | null;
  };
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

test("rejects an explicit invalid activity instead of launching the default package", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.equal(
    typeof songActivityStorage?.resolveRequestedSongActivityPackage,
    "function",
    "song-activity-storage must expose resolveRequestedSongActivityPackage",
  );
  assert.throws(
    () =>
      songActivityStorage!.resolveRequestedSongActivityPackage!({
        requestedActivityKey: "fraction-race",
        chartPath: "Number_Bonds/waves.chart",
        sidecarPath: "Number_Bonds/waves.json",
      }),
    /Unsupported song activity/,
  );
});

test("uses the intentional default only when the activity is absent", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  const resolved = songActivityStorage!.resolveRequestedSongActivityPackage!({
    requestedActivityKey: undefined,
    chartPath: "Number_Bonds/revisions/v2/waves.chart",
    sidecarPath: "Number_Bonds/revisions/v2/waves.json",
  });

  assert.deepEqual(resolved, {
    activityKey: "number-bonds",
    chartPath: "Number_Bonds/revisions/v2/waves.chart",
    sidecarPath: "Number_Bonds/revisions/v2/waves.json",
  });
});

test("rejects a chart path from a different activity folder", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.throws(
    () =>
      songActivityStorage!.resolveRequestedSongActivityPackage!({
        requestedActivityKey: "early-algebra",
        chartPath: "Missing_Numbers/waves.chart",
        sidecarPath: "Early_Algebra/waves.json",
      }),
    /chart path does not belong to early-algebra/,
  );
});

test("rejects an Early Algebra package that points at a Missing Numbers sidecar", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.throws(
    () =>
      songActivityStorage!.resolveRequestedSongActivityPackage!({
        requestedActivityKey: "early-algebra",
        chartPath: "Early_Algebra/waves.chart",
        sidecarPath: "Missing_Numbers/waves.json",
      }),
    /sidecar path does not belong to early-algebra/,
  );
});

test("rejects an Early Algebra package without its own sidecar", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.throws(
    () =>
      songActivityStorage!.resolveRequestedSongActivityPackage!({
        requestedActivityKey: "early-algebra",
        chartPath: "Early_Algebra/waves.chart",
        sidecarPath: null,
      }),
    /Missing sidecar path for early-algebra/,
  );
});
