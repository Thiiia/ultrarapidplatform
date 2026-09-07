import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthoredChartStoragePaths,
  inferSongActivityKeyFromChartPath,
} from "../lib/song-activity-storage";

test("builds deterministic per-author storage paths under the author folder", () => {
  const paths = buildAuthoredChartStoragePaths({
    activityKey: "early-algebra",
    songAssetId: "song-123",
    authorFolder: "dev",
  });
  assert.deepEqual(paths, {
    chartPath: "dev/Early_Algebra/song-123.chart",
    sidecarPath: "dev/Early_Algebra/song-123.json",
  });
});

type SongActivityStorageModule = {
  defaultSongActivityKey?: string;
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
};

async function loadSongActivityStorageModule(): Promise<SongActivityStorageModule | null> {
  try {
    const modulePath = "../lib/" + "song-activity-storage";
    return (await import(modulePath)) as SongActivityStorageModule;
  } catch {
    return null;
  }
}

test("builds Missing Numbers storage paths in the dev Missing Numbers folder", () => {
  const paths = buildAuthoredChartStoragePaths({
    activityKey: "missing-numbers",
    songAssetId: "waves",
    authorFolder: "dev",
  });

  assert.equal(paths.chartPath, "dev/Missing_Numbers/waves.chart");
  assert.equal(paths.sidecarPath, "dev/Missing_Numbers/waves.json");
});

test("infers the activity from an author-folder-prefixed chart path", () => {
  assert.equal(
    inferSongActivityKeyFromChartPath("dev/Missing_Numbers/waves.chart"),
    "missing-numbers",
  );
  assert.equal(
    inferSongActivityKeyFromChartPath("Early_Algebra/revisions/v2/waves.chart"),
    "early-algebra",
  );
});

test("accepts author-folder-prefixed packages for the matching activity", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  const resolved = songActivityStorage!.resolveRequestedSongActivityPackage!({
    requestedActivityKey: "missing-numbers",
    chartPath: "dev/Missing_Numbers/waves.chart",
    sidecarPath: "dev/Missing_Numbers/waves.json",
  });

  assert.deepEqual(resolved, {
    activityKey: "missing-numbers",
    chartPath: "dev/Missing_Numbers/waves.chart",
    sidecarPath: "dev/Missing_Numbers/waves.json",
  });
});

test("rejects an author-folder-prefixed chart path from a different activity", async () => {
  const songActivityStorage = await loadSongActivityStorageModule();

  assert.throws(
    () =>
      songActivityStorage!.resolveRequestedSongActivityPackage!({
        requestedActivityKey: "early-algebra",
        chartPath: "dev/Missing_Numbers/waves.chart",
        sidecarPath: "dev/Early_Algebra/waves.json",
      }),
    /chart path does not belong to early-algebra/,
  );
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
