import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultNumberBondForSong,
  createNumberBondEquation,
  getNumberBondValues,
} from "../lib/number-bonds-authoring";
import {
  getNumberBondSongNotes,
  getSpacedNumberBondNotes,
  planNumberBondNotes,
} from "../lib/number-bonds-note-plan";

test("Number Bonds song defaults are stable, valid, and vary by reroll", () => {
  const first = createDefaultNumberBondForSong("jazzmaybach", 5);
  const repeated = createDefaultNumberBondForSong("jazzmaybach", 5);
  const rerolled = createDefaultNumberBondForSong("jazzmaybach", 5, 1);

  assert.deepEqual(first, repeated);
  assert.equal(first.whole, 5);
  assert.ok(first.partA > 0 && first.partA < first.whole);
  assert.equal(first.partA + first.partB, first.whole);
  assert.notEqual(first.partA, rerolled.partA);
});

test("Number Bonds editor data supports the Unity one-gem-per-unit range", () => {
  const equation = createNumberBondEquation(20, 7, "song-bond");

  assert.deepEqual(getNumberBondValues(equation), {
    whole: 20,
    partA: 7,
    partB: 13,
  });
  assert.throws(() => createNumberBondEquation(21, 7, "too-large"), /between 2 and 20/);
  assert.throws(() => createNumberBondEquation(5, 5, "empty-part"), /positive parts/);
});

test("Number Bonds selects spaced notes from the chosen chart difficulty and leaves an interaction tail", () => {
  const chart = `[Song]\n{\n Resolution = 192\n Offset = 0\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n 192 = N 0 0\n 384 = N 1 0\n 3264 = N 2 0\n 6336 = N 3 0\n 9408 = N 4 0\n 12672 = N 0 0\n}`;
  const notes = getNumberBondSongNotes(chart, "ExpertSingle", 43);
  const available = getSpacedNumberBondNotes(notes);
  assert.deepEqual(available.map((note) => note.seconds), [8.5, 16.5, 24.5]);
  assert.deepEqual(planNumberBondNotes(notes, 2)?.map((note) => note.lane), [2, 4]);
  assert.equal(planNumberBondNotes(notes, 4), null);
  assert.deepEqual(getNumberBondSongNotes(chart, "EasySingle", 43), []);
});
