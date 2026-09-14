import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSongSelectionCacheKey,
  getPlayerLaunchRoute,
  getSongLaunchErrorMessage,
  isPlayableSongLaunchPackage,
} from "../lib/song-choice-flow";
import type { FreshSongLaunchPackage } from "../lib/song-launch-client";

const packageBase: FreshSongLaunchPackage = {
  contractVersion: 1 as const,
  songAssetId: "song-1",
  activityKey: "number-bonds",
  source: "authored" as const,
  runtimeCapabilities: [],
  readiness: { state: "ready" as const, source: "authored" as const, canLaunch: true, message: "Ready" },
  audio: { bucket: "Songs", path: "song.mp3", signedUrl: "audio" },
  chart: { bucket: "Charts", path: "song.chart", signedUrl: "chart" },
  sidecar: { bucket: "SidecarJsons", path: "song.json", signedUrl: "sidecar" },
};

test("only complete playable packages enable song choice continuation", () => {
  assert.equal(isPlayableSongLaunchPackage(packageBase), true);
  assert.equal(isPlayableSongLaunchPackage({ ...packageBase, source: "editor-scaffold" }), false);
  assert.equal(isPlayableSongLaunchPackage({ ...packageBase, audio: { ...packageBase.audio, signedUrl: "" } }), false);
  assert.equal(isPlayableSongLaunchPackage({ ...packageBase, readiness: { ...packageBase.readiness, state: "blocked", canLaunch: false } }), false);
});

test("song choice replaces infrastructure details with recoverable player copy", () => {
  assert.equal(
    getSongLaunchErrorMessage(new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.")),
    "We couldn’t load this song’s lesson files. Try again or choose another song.",
  );
  assert.equal(
    getSongLaunchErrorMessage(new Error("No authored lesson or verified starter template is available. The blank chart is available for editing.")),
    "No authored lesson or verified starter template is available. The blank chart is available for editing.",
  );
});

test("song package cache keys include activity identity", () => {
  assert.notEqual(
    buildSongSelectionCacheKey("song-1", "number-bonds"),
    buildSongSelectionCacheKey("song-1", "early-algebra"),
  );
});

test("all player entry points use the route-local game flow", () => {
  assert.equal(getPlayerLaunchRoute("/demo/student"), "/demo/student/game");
  assert.equal(getPlayerLaunchRoute("/student"), "/student/game");
});
