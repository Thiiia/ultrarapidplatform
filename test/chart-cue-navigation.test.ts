import assert from 'node:assert/strict';
import test from 'node:test';
import { findNearestChartCueIndex, getRangeChartCueTargets } from '../lib/editor/chart-cue-navigation';
import { retimeGuidedEncounter } from '../lib/guided-authored-encounter';

test('finds the closest cue for exact and between-cue song times', () => {
  const cues = [0.5, 1, 2.25, 4];

  assert.equal(findNearestChartCueIndex(cues, 2.25), 2);
  assert.equal(findNearestChartCueIndex(cues, 3), 2);
  assert.equal(findNearestChartCueIndex(cues, 3.4), 3);
});

test('prefers the earlier cue on an exact tie', () => {
  assert.equal(findNearestChartCueIndex([1, 2], 1.5), 0);
});

test('ignores invalid cue times and returns no result for invalid targets', () => {
  assert.equal(findNearestChartCueIndex([Number.NaN, -1, 3], 2.8), 2);
  assert.equal(findNearestChartCueIndex([0, 1], Number.POSITIVE_INFINITY), -1);
  assert.equal(findNearestChartCueIndex([], 1), -1);
  assert.equal(findNearestChartCueIndex([Number.NaN, -1], 1), -1);
});

test('range snapping offers only cues the move can retain without clamping', () => {
  const move = { mechanic: 'spin' as const, tick: 12.5, endTick: 13 };
  const targets = getRangeChartCueTargets([10, 12, 14, 16], move.tick, move.endTick);
  assert.deepEqual(targets, { startSeconds: 12, endSeconds: 14 });
  assert.deepEqual(retimeGuidedEncounter(move, 'start', targets.startSeconds!), { tick: 12, endTick: 13 });
  assert.deepEqual(retimeGuidedEncounter(move, 'end', targets.endSeconds!), { tick: 12.5, endTick: 14 });
});

test('range snapping leaves incomplete windows and unavailable edges unset', () => {
  assert.deepEqual(getRangeChartCueTargets([1, 2], undefined, 3), { startSeconds: null, endSeconds: null });
  assert.deepEqual(getRangeChartCueTargets([1, 2], 3, 2), { startSeconds: null, endSeconds: null });
  assert.deepEqual(getRangeChartCueTargets([Number.NaN, -1, 8], 2, 3), { startSeconds: null, endSeconds: 8 });
  assert.deepEqual(getRangeChartCueTargets([], 2, 3), { startSeconds: null, endSeconds: null });
});
