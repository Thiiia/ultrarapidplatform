import assert from "node:assert/strict";
import test from "node:test";

type PlatformLaunchModule = {
  buildEmbeddedGameUrl?: (
    gameUrl: string,
    searchParams: URLSearchParams,
  ) => string;
  createSongLaunchSearchParams?: (input: {
    songAssetId: string;
    activityKey: string;
    chartUrl: string;
    sidecarUrl?: string | null;
    audioUrl: string;
    authorId?: string;
    revision?: string;
    receipt?: { receiptVersion: 1; songAssetId: string; activityKey: string; authorId: string; revision?: string };
  }) => URLSearchParams;
};

async function loadPlatformLaunchModule(): Promise<PlatformLaunchModule | null> {
  try {
    const modulePath = "../lib/" + "platform-launch";
    return (await import(modulePath)) as PlatformLaunchModule;
  } catch {
    return null;
  }
}

test("forwards a selected song package from the platform iframe to Unity", async () => {
  const platformLaunch = await loadPlatformLaunchModule();

  assert.equal(
    typeof platformLaunch?.createSongLaunchSearchParams,
    "function",
    "platform-launch must expose createSongLaunchSearchParams",
  );
  assert.equal(
    typeof platformLaunch?.buildEmbeddedGameUrl,
    "function",
    "platform-launch must expose buildEmbeddedGameUrl",
  );

  const launchParams = platformLaunch!.createSongLaunchSearchParams!({
    songAssetId: "song-123",
    activityKey: "early-algebra",
    chartUrl: "https://storage.example/charts/waves.chart?token=chart-token",
    sidecarUrl:
      "https://storage.example/sidecars/waves.json?token=sidecar-token",
    audioUrl: "https://storage.example/songs/waves.mp3?token=audio-token",
    authorId: "author-7",
    revision: "rev-7",
    receipt: { receiptVersion: 1, songAssetId: "song-123", activityKey: "early-algebra", authorId: "author-7", revision: "rev-7" },
  });
  const embeddedUrl = new URL(
    platformLaunch!.buildEmbeddedGameUrl!(
      "https://game.example/player?embed=1",
      launchParams,
    ),
  );

  assert.equal(embeddedUrl.searchParams.get("embed"), "1");
  assert.equal(embeddedUrl.searchParams.get("launch"), "PlayNow");
  assert.equal(embeddedUrl.searchParams.get("songAssetId"), "song-123");
  assert.equal(embeddedUrl.searchParams.get("activityKey"), "early-algebra");
  assert.equal(
    embeddedUrl.searchParams.get("chartUrl"),
    "https://storage.example/charts/waves.chart?token=chart-token",
  );
  assert.equal(
    embeddedUrl.searchParams.get("sidecarUrl"),
    "https://storage.example/sidecars/waves.json?token=sidecar-token",
  );
  assert.equal(
    embeddedUrl.searchParams.get("audioUrl"),
    "https://storage.example/songs/waves.mp3?token=audio-token",
  );
  assert.equal(embeddedUrl.searchParams.get("authorId"), "author-7");
  assert.equal(embeddedUrl.searchParams.get("revision"), "rev-7");
  assert.deepEqual(JSON.parse(embeddedUrl.searchParams.get("receipt") ?? "null"), {
    receiptVersion: 1,
    songAssetId: "song-123",
    activityKey: "early-algebra",
    authorId: "author-7",
    revision: "rev-7",
  });
});
