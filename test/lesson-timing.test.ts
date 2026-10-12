import assert from 'node:assert/strict';
import test from 'node:test';
import { createLessonClock, mapLessonTimes, snapChartTickToGrid } from '../lib/editor/lesson-timing';
import { validateLessonContent } from '../lib/lesson-content';
test('recorded seconds round trip through chart ticks including tempo changes', () => {
  const clock = createLessonClock('[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n 384 = B 60000\n}');
  assert.equal(clock.toTick(1.5), 480);
  assert.equal(clock.toSeconds(480), 1.5);
  assert.equal(clock.tempoAt(383), 120);
  assert.equal(clock.tempoAt(384), 60);
  assert.equal(clock.isTempoExplicitAt(383), true);
  const rows = [{tick: 8.49, endTick: 9.25, state: 'x=2'}];
  const saved = mapLessonTimes(rows, clock.toTick);
  assert.ok(Number.isInteger(saved[0].tick));
  assert.ok(Math.abs(mapLessonTimes(saved, clock.toSeconds)[0].tick - 8.49) < 0.003);
  assert.equal(saved[0].state, 'x=2');
});
test('fractional recorded positions become a valid save payload', () => {
  const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n 192 = N 1 0\n}';
  const events = [{type: 'ALG_MECHANIC', mechanic: 'hit', tick: 8.49, hits: 1}];
  assert.throws(() => validateLessonContent(chart, JSON.stringify({version: 1, events})), /tick/);
  const saved = mapLessonTimes(events, createLessonClock(chart).toTick);
  assert.doesNotThrow(() => validateLessonContent(chart, JSON.stringify({version: 1, events: saved})));
});
test('chart offset uses the same audio axis as Unity scheduling', () => {
  const clock = createLessonClock('[Song]\n{\n Resolution = 192\n Offset = 0.25\n}\n[SyncTrack]\n{\n 0 = B 120000\n}');
  assert.equal(clock.toSeconds(192), 0.25);
  assert.equal(clock.toTick(0.25), 192);
});
test('invalid chart resolution and zero tempo fall back to a finite default clock', () => {
  const clock = createLessonClock('[Song]\n{\n Resolution = 0\n Offset = .\n}\n[SyncTrack]\n{\n 0 = B 0\n}');
  assert.equal(clock.ticksPerBeat, 192);
  assert.equal(clock.usesDefaultResolution, true);
  assert.equal(clock.tempoAt(192), 120);
  assert.equal(clock.isTempoExplicitAt(192), false);
  assert.equal(clock.toSeconds(192), 0.5);
  assert.equal(clock.toTick(0.5), 192);
});
test('chart event snap uses the selected quarter-note subdivision', () => {
  assert.equal(snapChartTickToGrid(110, 192, 'quarter'), 192);
  assert.equal(snapChartTickToGrid(110, 192, 'eighth'), 96);
  assert.equal(snapChartTickToGrid(70, 192, 'sixteenth'), 48);
  assert.equal(snapChartTickToGrid(70, 192, 'off'), 70);
  assert.equal(snapChartTickToGrid(-2, 192, 'sixteenth'), 0);
});
