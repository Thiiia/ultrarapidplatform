import assert from "node:assert/strict";
import test from "node:test";
import { resolveFreshSongLaunchPackage } from "../lib/song-launch-package";

type SongChartTargets = {
  chartBucket: string;
  chartPath: string;
  sidecarBucket: string;
  sidecarPath: string;
  authorId?: string;
  revision?: string;
  counts?: { encounters: number; equations: number; targets: number };
};

test("existing unrevisioned legacy encounters launch, but authored and mixed revisions still fail", async () => {
  const input = {
    songAssetId: "jazzmaybach", activityKey: "early-algebra", authorId: "dev-id",
    loadSongAsset: async () => ({id: "jazzmaybach", isActive: true, songBucket: "Songs", songPath: "jazz.mp3"}),
    loadSongChart: async () => ({chartBucket: "Charts", chartPath: "dev/Early_Algebra/Melika.chart", sidecarBucket: "SidecarJsons", sidecarPath: "dev/Early_Algebra/Melika.encounters.json", legacy: true, counts: {encounters: 11, equations: 11, targets: 0}}),
    createSignedUrl: async (_bucket: string, path: string) => `https://example.test/${path}`,
  };
  const result = await resolveFreshSongLaunchPackage(input);
  assert.equal(result.revision, undefined);
  assert.equal(result.sidecar.path, "dev/Early_Algebra/Melika.encounters.json");
  await assert.rejects(resolveFreshSongLaunchPackage({...input, revision: "r1"}), /immutable revision/);
  await assert.rejects(resolveFreshSongLaunchPackage({...input, loadSongChart: async () => ({...await input.loadSongChart(), legacy: false})}), /immutable revision/);
  await assert.rejects(resolveFreshSongLaunchPackage({...input, loadSongChart: async () => ({...await input.loadSongChart(), chartPath: "dev/Early_Algebra/revisions/r1/Melika.chart"})}), /immutable revision/);
});

type SongLaunchPackageModule = {
  resolveFreshSongLaunchPackage?: (input: {
    songAssetId: string;
    activityKey: string;
    authorId: string | null;
    revision?: string | null;
    allowBlankPackage?: boolean;
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
    authorId: string;
    revision: string;
    receipt?: {
      receiptVersion: 1;
      songAssetId: string;
      activityKey: string;
      authorId: string;
      revision?: string;
      chart: { bucket: string; path: string };
      sidecar: { bucket: string; path: string };
      audio: { bucket: string; path: string };
      counts?: { encounters: number; equations: number; targets: number };
    };
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
    revision: "rev-7",
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
        authorId: "author-7",
        revision: "rev-7",
        counts: { encounters: 4, equations: 3, targets: 5 },
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
    authorId: "author-7",
    revision: "rev-7",
    receipt: {
      receiptVersion: 1,
      songAssetId: "song-123",
      activityKey: "early-algebra",
      authorId: "author-7",
      revision: "rev-7",
      chart: { bucket: "Charts", path: "Early_Algebra/revisions/rev-7/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Early_Algebra/revisions/rev-7/waves.json" },
      audio: { bucket: "Songs", path: "albums/waves.mp3" },
      counts: { encounters: 4, equations: 3, targets: 5 },
    },
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

test("receipt carries stable identity + refs without signed-URL credentials", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();

  const resolved = await songLaunchPackage!.resolveFreshSongLaunchPackage!({
    songAssetId: "song-9",
    activityKey: "missing-numbers",
    authorId: "author-2",
    loadSongAsset: async () => ({
      id: "song-9",
      isActive: true,
      songBucket: "Songs",
      songPath: "garden.mp3",
    }),
    loadSongChart: async () => ({
      chartBucket: "Charts",
      chartPath: "Missing_Numbers/revisions/rev-1/song.chart",
      sidecarBucket: "SidecarJsons",
      sidecarPath: "Missing_Numbers/revisions/rev-1/song.json",
      authorId: "author-2",
      counts: { encounters: 0, equations: 0, targets: 0 },
    }),
    createSignedUrl: async (bucket, path) => `https://storage.example/${bucket}/${path}?token=secret`,
  });

  assert.equal(resolved.receipt?.receiptVersion, 1);
  assert.equal(resolved.receipt?.authorId, "author-2");
  assert.equal(resolved.receipt?.revision, "rev-1");
  // Receipt must not leak signed-URL credentials.
  assert.equal(JSON.stringify(resolved.receipt).includes("token=secret"), false);
});

test("rejects an authored package when receipt counts are omitted", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();

  await assert.rejects(
    songLaunchPackage!.resolveFreshSongLaunchPackage!({
      songAssetId: "song-9",
      activityKey: "missing-numbers",
      authorId: "author-2",
      loadSongAsset: async () => ({
        id: "song-9",
        isActive: true,
        songBucket: "Songs",
        songPath: "garden.mp3",
      }),
      loadSongChart: async () => ({
        chartBucket: "Charts",
        chartPath: "Missing_Numbers/revisions/rev-1/song.chart",
        sidecarBucket: "SidecarJsons",
        sidecarPath: "Missing_Numbers/revisions/rev-1/song.json",
        authorId: "author-2",
      } as SongChartTargets),
      createSignedUrl: async () => "signed",
    }),
    /receipt counts/i,
  );
});

test("rejects a launch chart that does not match the requested immutable revision", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();

  await assert.rejects(
    songLaunchPackage!.resolveFreshSongLaunchPackage!({
      songAssetId: "song-123",
      activityKey: "early-algebra",
      authorId: "author-7",
      revision: "rev-7",
      loadSongAsset: async () => ({
        id: "song-123",
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/song.mp3",
      }),
      loadSongChart: async () => ({
        chartBucket: "Charts",
        chartPath: "author/Early_Algebra/revisions/rev-8/song.chart",
        sidecarBucket: "SidecarJsons",
        sidecarPath: "author/Early_Algebra/revisions/rev-8/song.json",
        authorId: "author-7",
        revision: "rev-8",
      }),
      createSignedUrl: async () => "unused",
    }),
    /requested revision/i,
  );
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
    allowBlankPackage: true,
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

test("does not treat an editor blank package as playable content by default", async () => {
  const songLaunchPackage = await loadSongLaunchPackageModule();

  await assert.rejects(
    songLaunchPackage!.resolveFreshSongLaunchPackage!({
      songAssetId: "song-123",
      activityKey: "missing-numbers",
      authorId: null,
      loadSongAsset: async () => ({
        id: "song-123",
        isActive: true,
        songBucket: "Songs",
        songPath: "albums/song.mp3",
      }),
      loadSongChart: async () => null,
      loadBlankSongChart: async () => ({
        chart: { bucket: "Charts", path: "blank.chart", signedUrl: "blank" },
        sidecar: { bucket: "SidecarJsons", path: "blank.json", signedUrl: "blank" },
      }),
      createSignedUrl: async () => "audio",
    }),
    /blank.*playable|No chart has been authored/i,
  );
});

