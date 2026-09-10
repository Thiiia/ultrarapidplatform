import assert from "node:assert/strict";
import test from "node:test";
import { isEditorSongChoiceLoadable, type SongChoice } from "../lib/song-storage";

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
