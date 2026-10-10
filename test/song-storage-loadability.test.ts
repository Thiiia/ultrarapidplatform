import assert from "node:assert/strict";
import test from "node:test";
import {
  createSongStorageSignedUrl,
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

test("signed song assets remain valid through calibration and the lesson intro", async () => {
  const requestedTtls: number[] = [];
  const supabaseAdmin = {
    storage: {
      from: () => ({
        info: async () => ({ data: {}, error: null }),
        createSignedUrl: async (_path: string, expiresIn: number) => {
          requestedTtls.push(expiresIn);
          return { data: { signedUrl: "https://storage.example/lesson-asset" }, error: null };
        },
      }),
    },
  } as unknown as Parameters<typeof createSongStorageSignedUrl>[2];

  const signedUrl = await createSongStorageSignedUrl("Charts", "lesson/chart.chart", supabaseAdmin);

  assert.equal(signedUrl, "https://storage.example/lesson-asset");
  assert.deepEqual(requestedTtls, [60 * 60]);
});

test("Number Bonds song choice requires an Early Algebra rhythm, including for legacy lessons", () => {
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
  const wrongActivity: SongChoice = {
    ...starter,
    id: "wrong-activity",
    rhythmSources: [{ ...readySource, activityKey: "equations" }],
  };
  const published: SongChoice = { ...starter, id: "published", requiresRhythmSource: false, rhythmSources: [] };
  const legacy: SongChoice = { ...complete, id: "legacy", activityKey: "number-bonds" };
  assert.deepEqual(
    filterAuthorableNumberBondsSongs([starter, noRhythm, wrongActivity, published, legacy]).map((song) => song.id),
    ["starter"],
  );
});
