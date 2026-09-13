import assert from "node:assert/strict";
import test from "node:test";
import { loadLessonAssets } from "../lib/editor/lesson-hydration";

const refs = {
  audioUrl: "audio-old",
  chartUrl: "chart-old",
  sidecarUrl: "sidecar-old",
};

test("loads audio, chart, and sidecar concurrently as one result", async () => {
  const started: string[] = [];
  const result = await loadLessonAssets({
    refs,
    fetchAudio: async (url) => { started.push(url); return "audio"; },
    fetchChart: async (url) => { started.push(url); return "chart"; },
    fetchSidecar: async (url) => { started.push(url); return { events: [] }; },
  });

  assert.deepEqual(started.sort(), ["audio-old", "chart-old", "sidecar-old"]);
  assert.equal(result.retried, false);
  assert.equal(result.chart, "chart");
});

test("refreshes expired signed URLs once and retries the same asset set", async () => {
  let refreshes = 0;
  let chartAttempts = 0;
  const freshRefs = { audioUrl: "audio-new", chartUrl: "chart-new", sidecarUrl: "sidecar-new" };
  const result = await loadLessonAssets({
    refs,
    refresh: async () => { refreshes += 1; return freshRefs; },
    fetchAudio: async (url) => url === "audio-old" ? Promise.reject(new Error("signed URL expired")) : "audio",
    fetchChart: async (url) => { chartAttempts += 1; return url === "chart-new" ? "chart" : Promise.reject(new Error("404")); },
    fetchSidecar: async (url) => url === "sidecar-new" ? { events: [] } : Promise.reject(new Error("403")),
  });

  assert.equal(refreshes, 1);
  assert.equal(chartAttempts, 2);
  assert.equal(result.retried, true);
  assert.deepEqual(result.urls, freshRefs);
});

test("does not refresh invalid content or hide a missing sidecar", async () => {
  let refreshes = 0;
  await assert.rejects(
    loadLessonAssets({
      refs,
      refresh: async () => { refreshes += 1; return refs; },
      fetchAudio: async () => "audio",
      fetchChart: async () => "not-json-but-chart-fetch-is-ok",
      fetchSidecar: async () => Promise.reject(new Error("invalid JSON")),
    }),
    /invalid JSON/,
  );
  assert.equal(refreshes, 0);
});

test("stops before starting a stale hydration", async () => {
  const controller = new AbortController();
  controller.abort();
  let started = 0;
  await assert.rejects(
    loadLessonAssets({
      refs,
      signal: controller.signal,
      fetchAudio: async () => { started += 1; return "audio"; },
      fetchChart: async () => "chart",
      fetchSidecar: async () => ({ events: [] }),
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(started, 0);
});
