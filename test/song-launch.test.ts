import assert from "node:assert/strict";
import test from "node:test";

type SongLaunchModule = {
  FRESH_SONG_LAUNCH_TTL_SECONDS?: number;
  createFreshSongLaunchInput?: (
    asset: {
      id: string;
      songBucket: string;
      songPath: string;
      chartBucket: string;
      chartPath: string;
      sidecarBucket: string | null;
      sidecarPath: string | null;
    },
    sign: (
      bucket: string,
      path: string,
      expiresInSeconds: number,
    ) => Promise<string>,
  ) => Promise<{
    songAssetId: string;
    chartUrl: string;
    sidecarUrl: string | null;
    audioUrl: string;
  }>;
};

async function loadSongLaunchModule(): Promise<SongLaunchModule | null> {
  try {
    const modulePath = "../lib/" + "song-launch";
    return (await import(modulePath)) as SongLaunchModule;
  } catch {
    return null;
  }
}

test("creates fresh launch URLs with the bounded preview lifetime", async () => {
  const songLaunch = await loadSongLaunchModule();

  assert.equal(
    typeof songLaunch?.createFreshSongLaunchInput,
    "function",
    "song-launch must expose createFreshSongLaunchInput",
  );
  assert.equal(songLaunch?.FRESH_SONG_LAUNCH_TTL_SECONDS, 30 * 60);

  const signed: Array<{
    bucket: string;
    path: string;
    expiresInSeconds: number;
  }> = [];
  const result = await songLaunch!.createFreshSongLaunchInput!(
    {
      id: "song-123",
      songBucket: "Songs",
      songPath: "Grafix_Waves.mp3",
      chartBucket: "Charts",
      chartPath: "Grafix_Waves.chart",
      sidecarBucket: "SidecarJsons",
      sidecarPath: "Grafix_Waves.json",
    },
    async (bucket, path, expiresInSeconds) => {
      signed.push({ bucket, path, expiresInSeconds });
      return `https://storage.example/${bucket}/${path}?fresh=1`;
    },
  );

  assert.deepEqual(result, {
    songAssetId: "song-123",
    chartUrl: "https://storage.example/Charts/Grafix_Waves.chart?fresh=1",
    sidecarUrl:
      "https://storage.example/SidecarJsons/Grafix_Waves.json?fresh=1",
    audioUrl: "https://storage.example/Songs/Grafix_Waves.mp3?fresh=1",
  });
  assert.deepEqual(
    [...signed].sort((left, right) => left.path.localeCompare(right.path)),
    [
      {
        bucket: "SidecarJsons",
        path: "Grafix_Waves.json",
        expiresInSeconds: 1800,
      },
    {
      bucket: "Charts",
      path: "Grafix_Waves.chart",
      expiresInSeconds: 1800,
    },
    {
      bucket: "Songs",
      path: "Grafix_Waves.mp3",
      expiresInSeconds: 1800,
    },
    ].sort((left, right) => left.path.localeCompare(right.path)),
  );
});

test("omits an optional sidecar without inventing a storage request", async () => {
  const songLaunch = await loadSongLaunchModule();
  assert.equal(typeof songLaunch?.createFreshSongLaunchInput, "function");

  const signedPaths: string[] = [];
  const result = await songLaunch!.createFreshSongLaunchInput!(
    {
      id: "song-without-sidecar",
      songBucket: "Songs",
      songPath: "song.mp3",
      chartBucket: "Charts",
      chartPath: "song.chart",
      sidecarBucket: null,
      sidecarPath: null,
    },
    async (_bucket, path) => {
      signedPaths.push(path);
      return `https://storage.example/${path}`;
    },
  );

  assert.equal(result.sidecarUrl, null);
  assert.deepEqual(signedPaths, ["song.chart", "song.mp3"]);
});

test("keeps required launch files when optional sidecar signing fails", async () => {
  const songLaunch = await loadSongLaunchModule();
  assert.equal(typeof songLaunch?.createFreshSongLaunchInput, "function");

  const result = await songLaunch!.createFreshSongLaunchInput!(
    {
      id: "song-with-missing-sidecar",
      songBucket: "Songs",
      songPath: "song.mp3",
      chartBucket: "Charts",
      chartPath: "song.chart",
      sidecarBucket: "SidecarJsons",
      sidecarPath: "missing.json",
    },
    async (_bucket, path) => {
      if (path === "missing.json") {
        throw new Error("Object not found");
      }

      return `https://storage.example/${path}`;
    },
  );

  assert.equal(result.chartUrl, "https://storage.example/song.chart");
  assert.equal(result.audioUrl, "https://storage.example/song.mp3");
  assert.equal(result.sidecarUrl, null);
});
