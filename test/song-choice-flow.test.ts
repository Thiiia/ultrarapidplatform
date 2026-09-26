import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSongSelectionCacheKey,
  getPlayerLaunchRoute,
  getSongLaunchErrorMessage,
  isPlayableSongLaunchPackage,
} from "../lib/song-choice-flow";
import {
  assertSongActivityMatches,
  resolveSongActivityIdentity,
} from "../lib/song-activity-authority";
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
    "This lesson is not ready to play yet. Try another song or ask your teacher for help.",
  );
  assert.equal(
    getSongLaunchErrorMessage(new Error("This Number Bonds lesson has not been published yet. Open Lesson Builder.")),
    "This Number Bonds lesson is being built. Choose Build Number Bonds lesson to finish it, or try another song.",
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

test("explicit route activity wins over stale session and selected-song payload", () => {
  assert.deepEqual(
    resolveSongActivityIdentity({
      routeActivityKey: "number-bonds",
      sessionActivityKey: "early-algebra",
      selectedPayloadActivityKey: "early-algebra",
      chartPath: "dev/Early_Algebra/jazzmaybach.chart",
    }),
    { activityKey: "number-bonds", source: "route" },
  );
  assert.deepEqual(
    resolveSongActivityIdentity({
      routeActivityKey: "early-algebra",
      sessionActivityKey: "number-bonds",
      selectedPayloadActivityKey: "number-bonds",
      chartPath: "dev/Number_Bonds/jazzmaybach.chart",
    }),
    { activityKey: "early-algebra", source: "route" },
  );
});

test("legacy chart inference is used only when no explicit identity exists", () => {
  assert.deepEqual(
    resolveSongActivityIdentity({
      selectedPayloadActivityKey: null,
      chartPath: "dev/Early_Algebra/jazzmaybach.chart",
    }),
    { activityKey: "early-algebra", source: "legacy-chart-path" },
  );
});

test("an invalid explicit route cannot fall through to stale session or chart identity", () => {
  assert.throws(
    () => resolveSongActivityIdentity({
      routeActivityKey: "not-an-activity",
      sessionActivityKey: "early-algebra",
      chartPath: "dev/Early_Algebra/jazzmaybach.chart",
    }),
    /Unsupported route activity/,
  );
  assert.deepEqual(
    resolveSongActivityIdentity({ chartPath: "shared/jazzmaybach.chart" }),
    { activityKey: null, source: "none" },
  );
});

test("a package activity mismatch fails closed instead of changing the current activity", () => {
  assert.throws(
    () => assertSongActivityMatches({
      expectedActivityKey: "number-bonds",
      actualActivityKey: "early-algebra",
      boundary: "song-package",
    }),
    /Activity identity mismatch at song-package/,
  );
  assert.equal(
    assertSongActivityMatches({
      expectedActivityKey: "early-algebra",
      actualActivityKey: "early-algebra",
      boundary: "sidecar",
    }),
    "early-algebra",
  );
});
