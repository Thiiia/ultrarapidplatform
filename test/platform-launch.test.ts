import assert from "node:assert/strict";
import test from "node:test";
import { resolveLaunchParams } from "../lib/launch-handoff";
import { buildEmbeddedGameUrl } from "../lib/platform-launch";
import { requestFreshSongLaunchParams } from "../lib/song-launch-client";

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
  assert.deepEqual(JSON.parse(embeddedUrl.searchParams.get("receiptJson") ?? "null"), {
    receiptVersion: 1,
    songAssetId: "song-123",
    activityKey: "early-algebra",
    authorId: "author-7",
    revision: "rev-7",
  });
});

test("editor PlayNow chain preserves the complete identity through the embedded game URL", async () => {
  const originalFetch = globalThis.fetch;
  const launchAttemptId = "00000000-0000-4000-8000-000000000042";
  const receipt = {
    receiptVersion: 1 as const,
    contractVersion: 1 as const,
    songAssetId: "song-123",
    activityKey: "number-bonds",
    authorId: "author-7",
    revision: "rev-7",
    source: "authored" as const,
    launchAttemptId,
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
    chart: { bucket: "Charts", path: "author-7/NumberBonds/song-123.chart" },
    sidecar: { bucket: "SidecarJsons", path: "author-7/NumberBonds/song-123.json" },
    audio: { bucket: "Songs", path: "author-7/song-123.mp3" },
    counts: { encounters: 2, equations: 0, targets: 4 },
    hashes: {
      chartSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      sidecarSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      audioSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  };

  globalThis.fetch = (async () => new Response(JSON.stringify({
    contractVersion: 1,
    songAssetId: receipt.songAssetId,
    activityKey: receipt.activityKey,
    authorId: receipt.authorId,
    revision: receipt.revision,
    source: receipt.source,
    runtimeCapabilities: receipt.runtimeCapabilities,
    launchAttemptId,
    receipt,
    readiness: { canLaunch: true, message: "Ready" },
    chart: { bucket: "Charts", path: receipt.chart.path, signedUrl: "https://storage.example/song.chart?sig=chart" },
    sidecar: { bucket: "SidecarJsons", path: receipt.sidecar.path, signedUrl: "https://storage.example/song.json?sig=sidecar" },
    audio: { bucket: "Songs", path: receipt.audio.path, signedUrl: "https://storage.example/song.mp3?sig=audio" },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  try {
    const editorLaunchState = await requestFreshSongLaunchParams({
      songAssetId: receipt.songAssetId,
      activityKey: receipt.activityKey,
      authorId: receipt.authorId,
      revision: receipt.revision,
    });
    editorLaunchState.set("bridgeNonce", "00000000-0000-4000-8000-000000000043");
    editorLaunchState.set("installationId", "00000000-0000-4000-8000-000000000044");
    editorLaunchState.set("requiresCalibration", "true");
    editorLaunchState.set("calibrationProtocolVersion", "1");
    editorLaunchState.set("platformOrigin", "https://platform.example");

    const finalEmbeddedUrl = new URL(
      buildEmbeddedGameUrl(
        "https://game.example/player?embed=1",
        resolveLaunchParams(editorLaunchState),
      ),
    );

    assert.equal(finalEmbeddedUrl.searchParams.get("launch"), "PlayNow");
    assert.equal(finalEmbeddedUrl.searchParams.get("songAssetId"), receipt.songAssetId);
    assert.equal(finalEmbeddedUrl.searchParams.get("activityKey"), receipt.activityKey);
    assert.equal(finalEmbeddedUrl.searchParams.get("chartUrl"), "https://storage.example/song.chart?sig=chart");
    assert.equal(finalEmbeddedUrl.searchParams.get("sidecarUrl"), "https://storage.example/song.json?sig=sidecar");
    assert.equal(finalEmbeddedUrl.searchParams.get("audioUrl"), "https://storage.example/song.mp3?sig=audio");
    assert.equal(finalEmbeddedUrl.searchParams.get("launchAttemptId"), launchAttemptId);
    assert.equal(finalEmbeddedUrl.searchParams.get("requiresCalibration"), "true");
    assert.equal(finalEmbeddedUrl.searchParams.get("calibrationProtocolVersion"), "1");
    assert.equal(finalEmbeddedUrl.searchParams.get("bridgeNonce"), "00000000-0000-4000-8000-000000000043");
    assert.deepEqual(JSON.parse(finalEmbeddedUrl.searchParams.get("receiptJson") ?? "null"), receipt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ready calibration forwards requiresCalibration false and the exact calibration offset to Unity", () => {
  const input = new URLSearchParams({
    launch: "PlayNow",
    songAssetId: "song-123",
    activityKey: "early-algebra",
    chartUrl: "https://storage.example/song.chart",
    audioUrl: "https://storage.example/song.mp3",
    installationId: "00000000-0000-4000-8000-000000000044",
    requiresCalibration: "false",
    calibrationProtocolVersion: "1",
    calibrationOffsetMs: "-37",
  });

  const output = new URL(buildEmbeddedGameUrl("https://game.example/player?embed=1", input));

  assert.equal(output.searchParams.get("requiresCalibration"), "false");
  assert.equal(output.searchParams.get("calibrationProtocolVersion"), "1");
  assert.equal(output.searchParams.get("calibrationOffsetMs"), "-37");
});

test("iframe launch preserves the Phase 5 identity and provenance field set", () => {
  const input = new URLSearchParams({
    launch: "PlayNow",
    sceneName: "AlgebraEquations SK Tag",
    songAssetId: "jazzmaybach",
    activityKey: "number-bonds",
    authorId: "author-7",
    revision: "rev-7",
    source: "starter-template",
    templateId: "template-7",
    templateLabel: "Verified Number Bonds",
    templateOrigin: "verified-starter-template",
    templateSourceRevision: "template-rev-7",
    launchAttemptId: "00000000-0000-4000-8000-000000000007",
    bridgeNonce: "00000000-0000-4000-8000-000000000008",
    installationId: "00000000-0000-4000-8000-000000000009",
    platformOrigin: "https://platform.example",
    rhythmDifficultyKey: "HardSingle",
    learningDifficultyKey: "number-bonds",
    requiresCalibration: "true",
    calibrationProtocolVersion: "1",
    calibrationOffsetMs: "12",
    chartUrl: "https://storage.example/jazz.chart?sig=chart",
    sidecarUrl: "https://storage.example/jazz.json?sig=sidecar",
    audioUrl: "https://storage.example/jazz.mp3?sig=audio",
    assignmentToken: "assignment-7",
    sessionToken: "session-7",
    callbackTarget: "https://platform.example/callback",
    returnTarget: "https://platform.example/return",
  });
  const output = new URL(buildEmbeddedGameUrl("https://game.example/player?embed=1", input));
  for (const key of [
    "sceneName", "songAssetId", "activityKey", "authorId", "revision", "source",
    "templateId", "templateLabel", "templateOrigin", "templateSourceRevision",
    "launchAttemptId", "bridgeNonce", "installationId", "platformOrigin",
    "rhythmDifficultyKey", "learningDifficultyKey", "requiresCalibration",
    "calibrationProtocolVersion", "calibrationOffsetMs", "chartUrl", "sidecarUrl",
    "audioUrl", "assignmentToken", "sessionToken", "callbackTarget", "returnTarget",
  ]) {
    assert.equal(output.searchParams.get(key), input.get(key), `${key} was lost from the iframe URL`);
  }
});
