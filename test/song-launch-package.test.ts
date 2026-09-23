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
  hashes?: { chartSha256: string; sidecarSha256: string; audioSha256: string };
};

const HASHES = {
  chartSha256: "a".repeat(64), sidecarSha256: "b".repeat(64), audioSha256: "c".repeat(64),
};

test("marks a complete immutable package ready for the editor and Unity", async () => {
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-ready",
    activityKey: "number-bonds",
    authorId: "author-ready",
    revision: "rev-ready",
    loadSongAsset: async () => ({
      id: "song-ready", isActive: true, songBucket: "Songs", songPath: "songs/ready.mp3",
    }),
    loadSongChart: async () => ({
      chartBucket: "Charts", chartPath: "Number_Bonds/revisions/rev-ready/ready.chart",
      sidecarBucket: "SidecarJsons", sidecarPath: "Number_Bonds/revisions/rev-ready/ready.json",
      authorId: "author-ready", revision: "rev-ready",
      counts: { encounters: 3, equations: 2, targets: 3 }, hashes: HASHES,
    }),
    createSignedUrl: async (_bucket, path) => `https://storage.example/${path}`,
  });

  assert.deepEqual(resolved.readiness, {
    state: "ready",
    source: "authored",
    canLaunch: true,
    message: "Your authored lesson is ready for Unity.",
  });
});

test("keeps a known Equations package blocked when the current Unity runtime does not implement it", async () => {
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-equations",
    activityKey: "equations",
    authorId: "author-equations",
    revision: "rev-equations",
    loadSongAsset: async () => ({
      id: "song-equations", isActive: true, songBucket: "Songs", songPath: "songs/equations.mp3",
    }),
    loadSongChart: async () => ({
      chartBucket: "Charts", chartPath: "Equations/revisions/rev-equations/equations.chart",
      sidecarBucket: "SidecarJsons", sidecarPath: "Equations/revisions/rev-equations/equations.json",
      authorId: "author-equations", revision: "rev-equations",
      counts: { encounters: 2, equations: 2, targets: 2 }, hashes: HASHES,
    }),
    createSignedUrl: async (_bucket, path) => `https://storage.example/${path}`,
  });

  assert.equal(resolved.source, "authored");
  assert.equal(resolved.readiness.state, "blocked");
  assert.equal(resolved.readiness.canLaunch, false);
  assert.match(resolved.readiness.message, /Unity runtime does not implement/i);
});

test("keeps a blank editor scaffold blocked from gameplay when no verified template exists", async () => {
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-template",
    activityKey: "number-bonds",
    authorId: "author-template",
    allowBlankPackage: true,
    loadSongAsset: async () => ({
      id: "song-template", isActive: true, songBucket: "Songs", songPath: "songs/template.mp3",
    }),
    loadSongChart: async () => null,
    loadBlankSongChart: async () => ({
      chart: { bucket: "Charts", path: "dev/Number_Bonds/song-template.chart", signedUrl: "chart" },
      sidecar: { bucket: "SidecarJsons", path: "dev/Number_Bonds/song-template.json", signedUrl: "sidecar" },
    }),
    createSignedUrl: async () => "audio",
  });

  assert.deepEqual(resolved.readiness, {
    state: "blocked",
    source: "editor-scaffold",
    canLaunch: false,
    message: "No authored lesson or verified starter template is available. The blank chart is available for editing, but this scaffold cannot be launched as gameplay.",
  });
});

test("blocks swapped legacy assets instead of masquerading as a starter template", async () => {
  const signed: string[] = [];
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-swapped",
    activityKey: "early-algebra",
    authorId: "author-swapped",
    allowBlankPackage: true,
    loadSongAsset: async () => ({
      id: "song-swapped", isActive: true, songBucket: "Songs", songPath: "songs/swapped.mp3",
    }),
    loadSongChart: async () => ({
      chartBucket: "Charts", chartPath: "Early_Algebra/swapped.encounters.json",
      sidecarBucket: "SidecarJsons", sidecarPath: "Early_Algebra/swapped.chart",
      authorId: "author-swapped", counts: { encounters: 1, equations: 1, targets: 1 }, hashes: HASHES,
    }),
    loadBlankSongChart: async () => ({
      chart: { bucket: "Charts", path: "templates/Early_Algebra/default.chart", signedUrl: "template-chart" },
      sidecar: { bucket: "SidecarJsons", path: "templates/Early_Algebra/default.json", signedUrl: "template-sidecar" },
    }),
    createSignedUrl: async (_bucket, path) => {
      signed.push(path);
      return `https://storage.example/${path}`;
    },
  });

  assert.equal(resolved.readiness.state, "blocked");
  assert.match(resolved.readiness.message, /needs repair/i);
  assert.deepEqual(signed, ["songs/swapped.mp3"]);
});

test("launches only a complete verified starter template with its own receipt and audio", async () => {
  const signed: string[] = [];
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-template",
    activityKey: "number-bonds",
    authorId: null,
    allowBlankPackage: true,
    launchAttemptId: "attempt-template",
    loadSongAsset: async () => ({
      id: "song-template", isActive: true, songBucket: "Songs", songPath: "songs/unrelated.mp3",
    }),
    loadSongChart: async () => null,
    loadBlankSongChart: async () => null,
    loadVerifiedStarterTemplate: async () => ({
      songAssetId: "song-template",
      activityKey: "number-bonds",
      authorId: "template-author",
      revision: "template-rev-1",
      chartBucket: "Charts",
      chartPath: "templates/Number_Bonds/revisions/template-rev-1/template.chart",
      sidecarBucket: "SidecarJsons",
      sidecarPath: "templates/Number_Bonds/revisions/template-rev-1/template.json",
      audioBucket: "Songs",
      audioPath: "songs/template.mp3",
      counts: { encounters: 2, equations: 1, targets: 2 },
      hashes: HASHES,
      templateProvenance: {
        templateId: "number-bonds:template-1",
        label: "Number Bonds starter",
        origin: "verified-starter-template" as const,
        sourceRevision: "template-source-rev-1",
      },
    }),
    createSignedUrl: async (_bucket, path) => {
      signed.push(path);
      return `https://storage.example/${path}`;
    },
  });

  assert.equal(resolved.readiness.state, "template-fallback");
  assert.equal(resolved.readiness.canLaunch, true);
  assert.equal(resolved.source, "starter-template");
  assert.equal(resolved.templateProvenance?.sourceRevision, "template-source-rev-1");
  assert.equal(resolved.receipt?.revision, "template-rev-1");
  assert.equal(resolved.receipt?.audio.path, "songs/template.mp3");
  assert.deepEqual(signed, [
    "templates/Number_Bonds/revisions/template-rev-1/template.chart",
    "templates/Number_Bonds/revisions/template-rev-1/template.json",
    "songs/template.mp3",
  ]);
});

test("keeps a verified Missing Numbers starter template blocked by runtime compatibility", async () => {
  const resolved = await resolveFreshSongLaunchPackage({
    songAssetId: "song-missing-numbers",
    activityKey: "missing-numbers",
    authorId: null,
    loadSongAsset: async () => ({
      id: "song-missing-numbers", isActive: true, songBucket: "Songs", songPath: "songs/source.mp3",
    }),
    loadSongChart: async () => null,
    loadVerifiedStarterTemplate: async () => ({
      songAssetId: "song-missing-numbers",
      activityKey: "missing-numbers",
      authorId: "template-author",
      revision: "template-rev-1",
      chartBucket: "Charts",
      chartPath: "templates/Missing_Numbers/revisions/template-rev-1/template.chart",
      sidecarBucket: "SidecarJsons",
      sidecarPath: "templates/Missing_Numbers/revisions/template-rev-1/template.json",
      audioBucket: "Songs",
      audioPath: "songs/template.mp3",
      counts: { encounters: 1, equations: 0, targets: 1 },
      hashes: HASHES,
      templateProvenance: {
        templateId: "missing-numbers:template-1",
        label: "Missing Numbers starter",
        origin: "verified-starter-template" as const,
        sourceRevision: "template-source-rev-1",
      },
    }),
    createSignedUrl: async (_bucket, path) => `https://storage.example/${path}`,
  });

  assert.equal(resolved.source, "starter-template");
  assert.equal(resolved.readiness.state, "blocked");
  assert.equal(resolved.readiness.canLaunch, false);
  assert.match(resolved.readiness.message, /Unity runtime does not implement/i);
});

test("legacy packages cannot bypass the immutable receipt boundary", async () => {
  const input = {
    songAssetId: "jazzmaybach", activityKey: "early-algebra", authorId: "dev-id",
    loadSongAsset: async () => ({id: "jazzmaybach", isActive: true, songBucket: "Songs", songPath: "jazz.mp3"}),
    loadSongChart: async () => ({chartBucket: "Charts", chartPath: "dev/Early_Algebra/Melika.chart", sidecarBucket: "SidecarJsons", sidecarPath: "dev/Early_Algebra/Melika.encounters.json", legacy: true, counts: {encounters: 11, equations: 11, targets: 0}}),
    createSignedUrl: async (_bucket: string, path: string) => `https://example.test/${path}`,
  };
  await assert.rejects(resolveFreshSongLaunchPackage(input), /immutable revision/);
});

test("hash-complete legacy packages still require an immutable revision", async () => {
  await assert.rejects(resolveFreshSongLaunchPackage({
    songAssetId: "jazzmaybach", activityKey: "early-algebra", authorId: "dev-id",
    loadSongAsset: async () => ({ id: "jazzmaybach", isActive: true, songBucket: "Songs", songPath: "jazz.mp3" }),
    loadSongChart: async () => ({
      chartBucket: "Charts", chartPath: "dev/Early_Algebra/Melika.chart",
      sidecarBucket: "SidecarJsons", sidecarPath: "dev/Early_Algebra/Melika.encounters.json",
      legacy: true, counts: { encounters: 11, equations: 11, targets: 0 }, hashes: HASHES,
    }),
    createSignedUrl: async (_bucket, path) => `https://example.test/${path}`,
  }), /immutable revision/);
});

test("revisioned authored packages still require immutable artifact hashes", async () => {
  await assert.rejects(resolveFreshSongLaunchPackage({
    songAssetId: "song-revisioned", activityKey: "early-algebra", authorId: "author-ready", revision: "rev-ready",
    loadSongAsset: async () => ({ id: "song-revisioned", isActive: true, songBucket: "Songs", songPath: "song.mp3" }),
    loadSongChart: async () => ({
      chartBucket: "Charts", chartPath: "Early_Algebra/revisions/rev-ready/song.chart",
      sidecarBucket: "SidecarJsons", sidecarPath: "Early_Algebra/revisions/rev-ready/song.json",
      revision: "rev-ready", counts: { encounters: 1, equations: 1, targets: 1 },
    }),
    createSignedUrl: async (_bucket, path) => `https://example.test/${path}`,
  }), /immutable artifact hashes/);
});

type SongLaunchPackageModule = {
  resolveFreshSongLaunchPackage?: (input: {
    songAssetId: string;
    activityKey: string;
    authorId: string | null;
    revision?: string | null;
    allowBlankPackage?: boolean;
    rhythmDifficultyKey?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle";
    learningDifficultyKey?: string | null;
    launchAttemptId?: string | null;
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
    rhythmDifficultyKey: "HardSingle",
    learningDifficultyKey: "guided",
    launchAttemptId: "attempt-7",
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
        hashes: HASHES,
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
    contractVersion: 1,
    songAssetId: "song-123",
    activityKey: "early-algebra",
    authorId: "author-7",
    revision: "rev-7",
    source: "authored",
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
    rhythmDifficultyKey: "HardSingle",
    learningDifficultyKey: "guided",
    launchAttemptId: "attempt-7",
    receipt: {
      receiptVersion: 1,
      contractVersion: 1,
      songAssetId: "song-123",
      activityKey: "early-algebra",
      authorId: "author-7",
      revision: "rev-7",
      source: "authored",
      runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
      rhythmDifficultyKey: "HardSingle",
      learningDifficultyKey: "guided",
      launchAttemptId: "attempt-7",
      chart: { bucket: "Charts", path: "Early_Algebra/revisions/rev-7/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Early_Algebra/revisions/rev-7/waves.json" },
      audio: { bucket: "Songs", path: "albums/waves.mp3" },
      counts: { encounters: 4, equations: 3, targets: 5 },
      hashes: HASHES,
    },
    readiness: {
      state: "ready",
      source: "authored",
      canLaunch: true,
      message: "Your authored lesson is ready for Unity.",
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
      hashes: HASHES,
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

test("serves a blocked editor scaffold when no chart is authored and a blank fallback is provided", async () => {
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
  // blank editor fallback and must not be presented as playable content.
  assert.deepEqual(signedTargets, [{ bucket: "Songs", path: "albums/waves.mp3" }]);
  assert.deepEqual(resolved, {
    contractVersion: 1,
    songAssetId: "song-123",
    activityKey: "missing-numbers",
    source: "editor-scaffold",
    runtimeCapabilities: ["editor-blank-scaffold"],
    readiness: {
      state: "blocked",
      source: "editor-scaffold",
      canLaunch: false,
      message: "No authored lesson or verified starter template is available. The blank chart is available for editing, but this scaffold cannot be launched as gameplay.",
    },
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

