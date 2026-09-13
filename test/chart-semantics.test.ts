import assert from "node:assert/strict";
import test from "node:test";
import { parseSupportedChartSemantics } from "../lib/chart-semantics";

const chart = `[Song]\n{\n  Resolution = "480"\n  Offset = "0.25"\n}\n[SyncTrack]\n{\n  0 = B 120000\n  960 = B 90000\n}\n[ExpertSingle]\n{\n  120 = N 2 0\n}`;

test("parses tempo segments and selected difficulty semantics", () => {
  const result = parseSupportedChartSemantics(chart, { selectedDifficulty: "ExpertSingle", requireRhythmNotes: true });
  assert.equal(result.resolution, 480);
  assert.equal(result.offsetSeconds, 0.25);
  assert.deepEqual(result.tempos, [{ tick: 0, bpm: 120 }, { tick: 960, bpm: 90 }]);
  assert.equal(result.difficulties.ExpertSingle.noteCount, 1);
});

test("rejects invalid tempo order and missing selected difficulty", () => {
  assert.throws(() => parseSupportedChartSemantics(chart.replace("960 = B 90000", "-1 = B 90000")), /tempo/i);
  assert.throws(() => parseSupportedChartSemantics(chart, { selectedDifficulty: "HardSingle" }), /selected difficulty/i);
});

test("allows an authored note-free chart when rhythm notes are not required", () => {
  const noteFree = chart.replace("  120 = N 2 0\n", "");
  assert.doesNotThrow(() => parseSupportedChartSemantics(noteFree, { selectedDifficulty: "ExpertSingle" }));
  assert.throws(() => parseSupportedChartSemantics(noteFree, { selectedDifficulty: "ExpertSingle", requireRhythmNotes: true }), /no playable notes/i);
});
