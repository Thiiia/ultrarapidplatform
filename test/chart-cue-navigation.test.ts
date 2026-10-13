import assert from 'node:assert/strict';
import test from 'node:test';
import { findNearestChartCueIndex } from '../lib/editor/chart-cue-navigation';

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
