import assert from "node:assert/strict";
import test from "node:test";
import { Midi } from "@tonejs/midi";
import {
  convertMidiTrackToChart,
  inspectMidiChartSource,
  MAX_MIDI_CHART_FILE_BYTES,
} from "../lib/editor/midi-chart-import";

function createFiveLaneMidi(trackName = "PART GUITAR") {
  const midi = new Midi();
  midi.header.tempos = [
    { ticks: 0, bpm: 100 },
    { ticks: 480, bpm: 150 },
  ];
  midi.header.timeSignatures = [
    { ticks: 0, timeSignature: [4, 4] },
    { ticks: 480, timeSignature: [3, 4] },
  ];
  midi.header.update();

  const track = midi.addTrack();
  track.name = trackName;
  track.addNote({ midi: 60, ticks: 0, durationTicks: 240 });
  track.addNote({ midi: 73, ticks: 480, durationTicks: 120 });
  track.addNote({ midi: 100, ticks: 960, durationTicks: 360 });
  track.addNote({ midi: 59, ticks: 120, durationTicks: 12 });
  track.addNote({ midi: 77, ticks: 240, durationTicks: 12 });
  track.addNote({ midi: 116, ticks: 720, durationTicks: 12 });
  return midi.toArray();
}

test("MIDI inspection only offers named five-lane guitar-family tracks", () => {
  const preview = inspectMidiChartSource(createFiveLaneMidi());
  assert.equal(preview.ppq, 480);
  assert.deepEqual(preview.tempos, [
    { tick: 0, bpm: 100 },
    { tick: 480, bpm: 150 },
  ]);
  assert.deepEqual(preview.timeSignatures, [
    { tick: 0, numerator: 4, denominator: 4 },
    { tick: 480, numerator: 3, denominator: 4 },
  ]);
  assert.equal(preview.tracks.length, 1);
  assert.equal(preview.tracks[0].difficultyCounts.EasySingle, 1);
  assert.equal(preview.tracks[0].difficultyCounts.MediumSingle, 1);
  assert.equal(preview.tracks[0].difficultyCounts.ExpertSingle, 1);
  assert.equal(preview.tracks[0].openNoteCount, 1);
  assert.equal(preview.tracks[0].modifierCount, 1);
  assert.equal(preview.tracks[0].otherNoteCount, 1);
  assert.throws(() => inspectMidiChartSource(createFiveLaneMidi("PART DRUMS")), /No named five-lane guitar track/);
});

test("MIDI conversion preserves PPQ, tempo changes, signatures, difficulty and sustain ticks", () => {
  const converted = convertMidiTrackToChart(createFiveLaneMidi(), "Garden.mid", 0);
  assert.equal(converted.fileName, "Garden.chart");
  assert.equal(converted.trackName, "PART GUITAR");
  assert.equal(converted.noteCount, 3);
  assert.match(converted.chartText, /Resolution = 480/);
  assert.match(converted.chartText, /Offset = 0\.000/);
  assert.match(converted.chartText, /0 = TS 4 2/);
  assert.match(converted.chartText, /480 = TS 3 2/);
  assert.match(converted.chartText, /0 = B 100000/);
  assert.match(converted.chartText, /480 = B 150000/);
  assert.match(converted.chartText, /\[EasySingle\]\n\{\n  0 = N 0 240/);
  assert.match(converted.chartText, /\[MediumSingle\]\n\{\n  480 = N 1 120/);
  assert.match(converted.chartText, /\[ExpertSingle\]\n\{\n  960 = N 4 360/);
  assert.ok(converted.warnings.some((warning) => /open notes will be skipped/.test(warning)));
  assert.ok(converted.warnings.some((warning) => /audio offset/.test(warning)));
});

test("MIDI inspection rejects unsupported timing divisions and oversized data", () => {
  const unsupportedDivision = createFiveLaneMidi();
  unsupportedDivision[12] = 0x80;
  unsupportedDivision[13] = 0x01;
  assert.throws(() => inspectMidiChartSource(unsupportedDivision), /SMPTE-timed/);
  assert.throws(() => inspectMidiChartSource(new Uint8Array(MAX_MIDI_CHART_FILE_BYTES + 1)), /8 MB or smaller/);
});
