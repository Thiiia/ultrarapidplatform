import assert from "node:assert/strict";
import test from "node:test";

type SongChartTargets = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string;
  sidecarPath: string;
};

type SongLaunchPackageModule = {
  resolveFreshSongLaunchPackage?: (input: {
    songAssetId: string;
    activityKey: string;
    authorId: string | null;
    loadSongAsset: (id: string) => Promise<Record<string, unknown> | null>;
    loadSongChart: (
      songAssetId: string,
      activityKey: string,
      authorId: string | null,
    ) => Promise<SongChartTargets | null>;
    loadBlankSongChart?: (
      songAssetId: string,
      activityKey: string,
    ) => Promise<{
      chart: { bucket: string; path: string; signedUrl: string };
      sidecar: { bucket: string; path: string; signedUrl: string };
    } | null>;
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

test("resolves and signs the current complete activity package for the requesting author", async () => {
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
    authorId: "author-7",
    loadSongAsset: async (id) => {
      assert.equal(id, "song-123");
      return {
        id,
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/waves.mp3",
      };
    },
    loadSongChart: async (songAssetId, activityKey, authorId) => {
      assert.equal(songAssetId, "song-123");
      assert.equal(activityKey, "early-algebra");
      assert.equal(authorId, "author-7");
      return {
        chartBucket: "Charts",
        chartPath: "Early_Algebra/revisions/rev-7/waves.chart",
        sidecarBucket: "SidecarJsons",
        sidecarPath: "Early_Algebra/revisions/rev-7/waves.json",
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

test("rejects a song/activity nobody has authored yet before creating signed URLs", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();
  let signedUrlCalls = 0;

  await assert.rejects(
    songLaunchPackage!.resolveFreshSongLaunchPackage!({
      songAssetId: "song-123",
      activityKey: "equations",
      authorId: "author-7",
      loadSongAsset: async () => ({
        id: "song-123",
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/waves.mp3",
      }),
      loadSongChart: async () => null,
      createSignedUrl: async () => {
        signedUrlCalls += 1;
        return "unused";
      },
    }),
    /No chart has been authored/,
  );

  assert.equal(signedUrlCalls, 0);
});

test("serves the blank chart package when no chart is authored and a blank fallback is provided", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();
  const signedTargets: Array<{ bucket: string; path: string }> = [];

  const resolved = await songLaunchPackage!.resolveFreshSongLaunchPackage!({
    songAssetId: "song-123",
    activityKey: "missing-numbers",
    authorId: null,
    loadSongAsset: async (id) => {
      assert.equal(id, "song-123");
      return {
        id,
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/waves.mp3",
      };
    },
    loadSongChart: async () => null,
    loadBlankSongChart: async (songAssetId, activityKey) => {
      assert.equal(songAssetId, "song-123");
      assert.equal(activityKey, "missing-numbers");
      return {
        chart: {
          bucket: "Charts",
          path: "dev/Missing_Numbers/song-123.chart",
          signedUrl: "https://app.example/api/song-package/blank?kind=chart&activity=missing-numbers",
        },
        sidecar: {
          bucket: "SidecarJsons",
          path: "dev/Missing_Numbers/song-123.json",
          signedUrl: "https://app.example/api/song-package/blank?kind=sidecar&activity=missing-numbers",
        },
      };
    },
    createSignedUrl: async (bucket, path) => {
      signedTargets.push({ bucket, path });
      return `https://storage.example/${bucket}/${path}`;
    },
  });

  // Only the audio is a real storage object; chart/sidecar come from the
  // blank fallback and must not be signed or persisted.
  assert.deepEqual(signedTargets, [{ bucket: "Songs", path: "albums/waves.mp3" }]);
  assert.deepEqual(resolved, {
    songAssetId: "song-123",
    activityKey: "missing-numbers",
    chart: {
      bucket: "Charts",
      path: "dev/Missing_Numbers/song-123.chart",
      signedUrl: "https://app.example/api/song-package/blank?kind=chart&activity=missing-numbers",
    },
    sidecar: {
      bucket: "SidecarJsons",
      path: "dev/Missing_Numbers/song-123.json",
      signedUrl: "https://app.example/api/song-package/blank?kind=sidecar&activity=missing-numbers",
    },
    audio: {
      bucket: "Songs",
      path: "albums/waves.mp3",
      signedUrl: "https://storage.example/Songs/albums/waves.mp3",
    },
  });
});

