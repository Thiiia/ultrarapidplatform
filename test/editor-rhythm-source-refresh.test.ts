import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEditorRhythmSourceRefreshQuery,
  resolveEditorRhythmSourceRefreshUrls,
} from "../lib/editor/rhythm-source-refresh";

test("Number Bonds rhythm refresh asks for the target activity and selected author", () => {
  assert.equal(
    buildEditorRhythmSourceRefreshQuery({ activityKey: "number-bonds", authorName: "dev / team" }),
    "/api/song-choice?context=editor&activity=number-bonds&author=dev+%2F+team",
  );
});

test("Number Bonds refresh keeps the exact immutable rhythm and its target sidecar", () => {
  const urls = resolveEditorRhythmSourceRefreshUrls([
    {
      id: "song-1",
      activityKey: "number-bonds",
      song: { signedUrl: "fresh-audio" },
      sidecar: { signedUrl: "number-bonds-sidecar" },
      rhythmSources: [
        {
          activityKey: "early-algebra",
          revision: "newer-revision",
          chartSha256: "chart-new",
          audioSha256: "audio-hash",
          chart: { signedUrl: "chart-new" },
        },
        {
          activityKey: "early-algebra",
          revision: "selected-revision",
          chartSha256: "chart-selected",
          audioSha256: "audio-hash",
          chart: { signedUrl: "chart-selected" },
        },
      ],
    },
  ], {
    songAssetId: "song-1",
    targetActivityKey: "number-bonds",
    sourceActivityKey: "early-algebra",
    sourceRevision: "selected-revision",
    sourceChartSha256: "chart-selected",
    sourceAudioSha256: "audio-hash",
  });

  assert.deepEqual(urls, {
    audioUrl: "fresh-audio",
    chartUrl: "chart-selected",
    sidecarUrl: "number-bonds-sidecar",
  });
});

test("Number Bonds refresh fails closed when the exact rhythm revision disappeared", () => {
  assert.throws(
    () => resolveEditorRhythmSourceRefreshUrls([
      {
        id: "song-1",
        activityKey: "number-bonds",
        song: { signedUrl: "fresh-audio" },
        sidecar: { signedUrl: "number-bonds-sidecar" },
        rhythmSources: [],
      },
    ], {
      songAssetId: "song-1",
      targetActivityKey: "number-bonds",
      sourceActivityKey: "early-algebra",
      sourceRevision: "selected-revision",
      sourceChartSha256: "chart-selected",
      sourceAudioSha256: "audio-hash",
    }),
    /selected rhythm source changed/,
  );
});
