import assert from "node:assert/strict";
import test from "node:test";
import {
  requestFreshSongLaunchPackage,
  requestFreshSongLaunchParams,
  SongLaunchRequestError,
} from "../lib/song-launch-client";

test("refreshes a game package without replacing its launch attempt", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      contractVersion: 1,
      songAssetId: "song-123",
      activityKey: "early-algebra",
      authorId: "author-7",
      revision: "rev-7",
      source: "authored",
      runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
      launchAttemptId: "7c2ebf76-91b4-49e6-b3ba-3132d490fb39",
      readiness: { canLaunch: true, message: "Ready" },
      receipt: { receiptVersion: 1, songAssetId: "song-123", activityKey: "early-algebra", authorId: "author-7", revision: "rev-7" },
      chart: { bucket: "Charts", path: "chart", signedUrl: "chart-fresh" },
      sidecar: { bucket: "SidecarJsons", path: "sidecar", signedUrl: "sidecar-fresh" },
      audio: { bucket: "Songs", path: "song", signedUrl: "audio-fresh" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const params = await requestFreshSongLaunchParams({
      songAssetId: "song-123",
      activityKey: "early-algebra",
      authorId: "author-7",
      revision: "rev-7",
      refreshLaunchAttemptId: "7c2ebf76-91b4-49e6-b3ba-3132d490fb39",
    } as never);

    const capturedRequest = requestBody as Record<string, unknown> | null;
    assert.equal(capturedRequest?.refreshLaunchAttemptId, "7c2ebf76-91b4-49e6-b3ba-3132d490fb39");
    assert.equal(capturedRequest?.refreshOnly, true);
    assert.equal(params.get("chartUrl"), "chart-fresh");
    assert.equal(params.get("launchAttemptId"), "7c2ebf76-91b4-49e6-b3ba-3132d490fb39");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails closed when the package activity does not match the requested activity", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    contractVersion: 1,
    songAssetId: "song-123",
    activityKey: "early-algebra",
    source: "authored",
    runtimeCapabilities: [],
    readiness: { canLaunch: true, message: "Ready" },
    chart: { bucket: "Charts", path: "chart", signedUrl: "chart" },
    sidecar: { bucket: "SidecarJsons", path: "sidecar", signedUrl: "sidecar" },
    audio: { bucket: "Songs", path: "song", signedUrl: "audio" },
  }), { status: 200 })) as typeof fetch;

  try {
    await assert.rejects(
      requestFreshSongLaunchPackage({
        songAssetId: "song-123",
        activityKey: "number-bonds",
        allowBlankPackage: true,
      }),
      /Activity identity mismatch at song-package/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves the hosted runtime capability failure code for learner-facing recovery", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: "RUNTIME_CAPABILITY_UNAVAILABLE",
    error: "The hosted Unity capability manifest could not be loaded.",
  }), { status: 503 })) as typeof fetch;

  try {
    await assert.rejects(
      requestFreshSongLaunchPackage({ songAssetId: "song-123", activityKey: "early-algebra" }),
      (error: unknown) => {
        assert.ok(error instanceof SongLaunchRequestError);
        assert.equal(error.code, "RUNTIME_CAPABILITY_UNAVAILABLE");
        assert.equal(error.status, 503);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
