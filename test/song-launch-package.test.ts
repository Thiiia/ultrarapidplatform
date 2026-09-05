import assert from "node:assert/strict";
import test from "node:test";

type SongLaunchPackageModule = {
  resolveFreshSongLaunchPackage?: (input: {
    songAssetId: string;
    activityKey: string;
    loadSongAsset: (id: string) => Promise<Record<string, unknown> | null>;
    createSignedUrl: (bucket: string, path: string) => Promise<string>;
  }) => Promise<{
    songAssetId: string;
    activityKey: string;
    chart: { bucket: string; path: string; signedUrl: string };
    sidecar: { bucket: string; path: string; signedUrl: string };
    audio: { bucket: string; path: string; signedUrl: string };
  }>;
};

async function loadSongLaunchPackageModule(): Promise<SongLaunchPackageModule | null> {
  try {
    return (await import("../lib/song-launch-package")) as SongLaunchPackageModule;
  } catch {
    return null;
  }
}

test("resolves and signs the current complete activity package from the canonical song asset", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();

  assert.equal(
    typeof songLaunchPackage?.resolveFreshSongLaunchPackage,
    "function",
    "play must resolve a fresh server-owned song package",
  );

  const signedTargets: Array<{ bucket: string; path: string }> = [];
  const resolved = await songLaunchPackage!.resolveFreshSongLaunchPackage!({
    songAssetId: "song-123",
    activityKey: "early-algebra",
    loadSongAsset: async (id) => {
      assert.equal(id, "song-123");
      return {
        id,
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/waves.mp3",
        chartBucket: "Charts",
        sidecarBucket: "SidecarJsons",
        earlyAlgebraChartPath: "Early_Algebra/revisions/rev-7/waves.chart",
        earlyAlgebraSidecarPath: "Early_Algebra/revisions/rev-7/waves.json",
      };
    },
    createSignedUrl: async (bucket, path) => {
      signedTargets.push({ bucket, path });
      return `https://storage.example/${bucket}/${path}`;
    },
  });

  assert.deepEqual(signedTargets, [
    { bucket: "Charts", path: "Early_Algebra/revisions/rev-7/waves.chart" },
    { bucket: "SidecarJsons", path: "Early_Algebra/revisions/rev-7/waves.json" },
    { bucket: "Songs", path: "albums/waves.mp3" },
  ]);
  assert.deepEqual(resolved, {
    songAssetId: "song-123",
    activityKey: "early-algebra",
    chart: {
      bucket: "Charts",
      path: "Early_Algebra/revisions/rev-7/waves.chart",
      signedUrl: "https://storage.example/Charts/Early_Algebra/revisions/rev-7/waves.chart",
    },
    sidecar: {
      bucket: "SidecarJsons",
      path: "Early_Algebra/revisions/rev-7/waves.json",
      signedUrl: "https://storage.example/SidecarJsons/Early_Algebra/revisions/rev-7/waves.json",
    },
    audio: {
      bucket: "Songs",
      path: "albums/waves.mp3",
      signedUrl: "https://storage.example/Songs/albums/waves.mp3",
    },
  });
});

test("rejects an incomplete activity package before creating signed URLs", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();
  let signedUrlCalls = 0;

  await assert.rejects(
    songLaunchPackage!.resolveFreshSongLaunchPackage!({
      songAssetId: "song-123",
      activityKey: "equations",
      loadSongAsset: async () => ({
        id: "song-123",
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/waves.mp3",
        chartBucket: "Charts",
        sidecarBucket: "SidecarJsons",
        equationsChartPath: "Equations/waves.chart",
        equationsSidecarPath: null,
      }),
      createSignedUrl: async () => {
        signedUrlCalls += 1;
        return "unused";
      },
    }),
    /Missing sidecar path/,
  );

  assert.equal(signedUrlCalls, 0);
});
