import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeChartFile,
  parseChartLaneNotes,
  removeChartLaneNote,
  replaceChartOffset,
  upsertChartLaneNote,
} from "../lib/editor/chart-insights";

const chart = [
  "[Song]",
  "{",
  "  Resolution = 480",
  "  Offset = -0.125",
  "}",
  "[SyncTrack]",
  "{",
  "  0 = TS 4 2",
  "  0 = B 120000",
  "  960 = B 90000",
  "  960 = A 5000000",
  "}",
  "[ExpertSingle]",
  "{",
  "  192 = N 0 24",
  "  192 = N 3 48",
  "  384 = N 4 0",
  "}",
  "[UnknownSection]",
  "{",
  "  keep = \"verbatim\"",
  "}",
  "",
].join("\r\n");

test("chart note lane reads five-lane notes and retains sustain lengths", () => {
  assert.deepEqual(parseChartLaneNotes(chart, "ExpertSingle"), [
    { tick: 192, lane: 0, length: 24 },
    { tick: 192, lane: 3, length: 48 },
    { tick: 384, lane: 4, length: 0 },
  ]);
  assert.equal(parseChartLaneNotes(chart, "EasySingle").length, 0);
});

test("chart diagnostics report usable timing and playable note counts", () => {
  const analysis = analyzeChartFile(chart);
  assert.equal(analysis.resolution, 480);
  assert.equal(analysis.offsetSeconds, -0.125);
  assert.equal(analysis.noteCounts.ExpertSingle, 3);
  assert.equal(analysis.diagnostics.length, 0);
});

test("chart diagnostics explain missing starting tempo and missing playable notes", () => {
  const analysis = analyzeChartFile(chart.replace("  0 = B 120000\r\n", ""));
  assert.ok(analysis.diagnostics.some((diagnostic) => diagnostic.code === "missing-tempo-at-zero"));
  assert.ok(!analysis.diagnostics.some((diagnostic) => diagnostic.code === "no-playable-notes"));
  const empty = analyzeChartFile(chart.replace(/\[ExpertSingle\][\s\S]*?\}\r\n/, ""));
  assert.ok(empty.diagnostics.some((diagnostic) => diagnostic.code === "no-playable-notes"));
});

test("offset changes preserve chart line endings, tempo anchors and unknown sections", () => {
  const updated = replaceChartOffset(chart, 0.0376);
  assert.match(updated, /Offset = 0\.038\r\n/);
  assert.match(updated, /960 = A 5000000\r\n/);
  assert.match(updated, /\[UnknownSection\]\r\n\{\r\n  keep = "verbatim"/);
  assert.throws(() => replaceChartOffset(chart, Number.NaN), /finite number/);
});

test("offset changes add a missing value without rewriting the chart body", () => {
  const withoutOffset = chart.replace("  Offset = -0.125\r\n", "");
  const updated = replaceChartOffset(withoutOffset, -0.25);
  assert.match(updated, /Offset = -0\.250\r\n/);
  assert.match(updated, /960 = A 5000000\r\n/);
});

test("chart note authoring inserts in tick order and preserves unrelated sections", () => {
  const updated = upsertChartLaneNote(chart, "ExpertSingle", { tick: 288, lane: 2, length: 36 });
  assert.deepEqual(parseChartLaneNotes(updated, "ExpertSingle"), [
    { tick: 192, lane: 0, length: 24 },
    { tick: 192, lane: 3, length: 48 },
    { tick: 288, lane: 2, length: 36 },
    { tick: 384, lane: 4, length: 0 },
  ]);
  assert.match(updated, /\[UnknownSection\]\r\n\{\r\n  keep = "verbatim"/);
});

test("chart note authoring updates or removes one note without touching the others", () => {
  const updated = upsertChartLaneNote(chart, "ExpertSingle", { tick: 192, lane: 3, length: 72 });
  assert.deepEqual(parseChartLaneNotes(updated, "ExpertSingle"), [
    { tick: 192, lane: 0, length: 24 },
    { tick: 192, lane: 3, length: 72 },
    { tick: 384, lane: 4, length: 0 },
  ]);
  const removed = removeChartLaneNote(updated, "ExpertSingle", { tick: 192, lane: 0 });
  assert.deepEqual(parseChartLaneNotes(removed, "ExpertSingle"), [
    { tick: 192, lane: 3, length: 72 },
    { tick: 384, lane: 4, length: 0 },
  ]);
  assert.match(removed, /\[ExpertSingle\]\r\n\{\r\n  192 = N 3 72/);
});

test("chart note authoring rejects invalid tick and lane values", () => {
  assert.throws(() => upsertChartLaneNote(chart, "ExpertSingle", { tick: -1, lane: 0, length: 0 }), /non-negative/);
  assert.throws(() => upsertChartLaneNote(chart, "ExpertSingle", { tick: 0, lane: 5, length: 0 }), /between 0 and 4/);
});

test("a chart note can move to a new tick without losing its sustain", () => {
  const removed = removeChartLaneNote(chart, "ExpertSingle", { tick: 192, lane: 3 });
  const moved = upsertChartLaneNote(removed, "ExpertSingle", { tick: 240, lane: 3, length: 48 });
  assert.deepEqual(parseChartLaneNotes(moved, "ExpertSingle"), [
    { tick: 192, lane: 0, length: 24 },
    { tick: 240, lane: 3, length: 48 },
    { tick: 384, lane: 4, length: 0 },
  ]);
});
