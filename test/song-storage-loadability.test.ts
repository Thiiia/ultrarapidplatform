import assert from "node:assert/strict";
import test from "node:test";
import {
  filterAuthorableNumberBondsSongs,
  isEditorSongChoiceLoadable,
  type SongChoice,
} from "../lib/song-storage";

const complete: SongChoice = {
  id: "waves", activityKey: "early-algebra", name: "Waves", title: "Waves", artist: null,
  path: "Waves.mp3", signedUrl: "song", size: null, contentType: "audio/mpeg", updatedAt: null, durationSeconds: null,
  song: { bucket: "Songs", path: "Waves.mp3", signedUrl: "song", contentType: "audio/mpeg" },
  chart: { bucket: "Charts", path: "Waves.chart", signedUrl: "chart", contentType: "text/plain" },
  sidecar: { bucket: "SidecarJsons", path: "Waves.json", signedUrl: "sidecar", contentType: "application/json" },
};

test("editor excludes an authored choice missing its chart or sidecar URL", () => {
  assert.equal(isEditorSongChoiceLoadable(complete), true);
  assert.equal(isEditorSongChoiceLoadable({ ...complete, sidecar: { ...complete.sidecar!, signedUrl: "" } }), false);
  assert.equal(isEditorSongChoiceLoadable({ ...complete, chart: { ...complete.chart, signedUrl: "" } }), false);
});

test("Number Bonds song choice offers verified starters but excludes songs without a rhythm", () => {
  const readySource = {
    activityKey: "early-algebra" as const,
    revision: "revision-1",
    chartSha256: "chart-hash",
    audioSha256: "audio-hash",
    chart: complete.chart,
  };
  const starter: SongChoice = {
    ...complete,
    id: "starter",
    activityKey: "number-bonds",
    requiresRhythmSource: true,
    rhythmSources: [readySource],
  };
  const noRhythm: SongChoice = { ...starter, id: "no-rhythm", rhythmSources: [] };
  const published: SongChoice = { ...starter, id: "published", requiresRhythmSource: false, rhythmSources: [] };
  assert.deepEqual(
    filterAuthorableNumberBondsSongs([starter, noRhythm, published]).map((song) => song.id),
    ["starter", "published"],
  );
});
