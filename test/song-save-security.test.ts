import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type SongSaveModule = {
  resolveSongSaveTargets?: (asset: {
    chartBucket: string;
    chartPath: string;
    sidecarBucket: string | null;
    sidecarPath: string | null;
  }) => {
    chart: { bucket: string; path: string };
    sidecar: { bucket: string; path: string };
  };
};

async function loadSongSaveModule(): Promise<SongSaveModule | null> {
  try {
    const modulePath = "../lib/" + "song-save";
    return (await import(modulePath)) as SongSaveModule;
  } catch {
    return null;
  }
}

test("derives save destinations from the server song record", async () => {
  const songSave = await loadSongSaveModule();

  assert.equal(
    typeof songSave?.resolveSongSaveTargets,
    "function",
    "song-save must expose resolveSongSaveTargets",
  );

  assert.deepEqual(
    songSave!.resolveSongSaveTargets!({
      chartBucket: "CanonicalCharts",
      chartPath: "school/waves.chart",
      sidecarBucket: "CanonicalSidecars",
      sidecarPath: "school/waves.json",
    }),
    {
      chart: { bucket: "CanonicalCharts", path: "school/waves.chart" },
      sidecar: {
        bucket: "CanonicalSidecars",
        path: "school/waves.json",
      },
    },
  );
});

test("uses a bounded server fallback for a song without a sidecar", async () => {
  const songSave = await loadSongSaveModule();
  assert.equal(typeof songSave?.resolveSongSaveTargets, "function");

  assert.deepEqual(
    songSave!.resolveSongSaveTargets!({
      chartBucket: "Charts",
      chartPath: "school/new-song.chart",
      sidecarBucket: null,
      sidecarPath: null,
    }),
    {
      chart: { bucket: "Charts", path: "school/new-song.chart" },
      sidecar: {
        bucket: "SidecarJsons",
        path: "school/new-song.json",
      },
    },
  );
});

test("save API authenticates before parsing and ignores client storage targets", async () => {
  const [route, editorClient] = await Promise.all([
    readFile(
      new URL("../app/api/lesson-builder/save/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/team/editor/TeamEditorClient.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  const authIndex = route.indexOf("getCurrentAppUser()");
  const parseIndex = route.indexOf("request.json()");

  assert.ok(authIndex >= 0, "save API must resolve the authenticated user");
  assert.ok(
    parseIndex > authIndex,
    "authorization must happen before parsing or processing save content",
  );
  assert.match(route, /canAccessTeamPreview/);
  assert.match(route, /findFirst/);
  assert.match(route, /isActive: true/);
  assert.match(route, /resolveSongSaveTargets/);
  assert.doesNotMatch(route, /readRequiredString\(file\.bucket/);
  assert.doesNotMatch(route, /readRequiredString\(file\.path/);
  assert.doesNotMatch(
    route,
    /file\.contentType/,
    "save API must use server-owned content types",
  );
  assert.match(route, /text\/plain;charset=utf-8/);
  assert.match(route, /application\/json;charset=utf-8/);
  assert.doesNotMatch(
    route,
    /\? error\.message/,
    "save API must not return storage or server error details",
  );
  assert.doesNotMatch(editorClient, /\.\.\.selectedSongStorage\.chart/);
  assert.doesNotMatch(editorClient, /\.\.\.\(selectedSongStorage\.sidecar/);
});
