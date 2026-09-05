import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLaunchParams } from '../lib/launch-handoff';
import { buildEmbeddedGameUrl, createSongLaunchSearchParams } from '../lib/platform-launch';

test('authored launch explicitly selects its edited difficulty without changing other launch defaults', () => {
  const input = { songAssetId: 'waves', activityKey: 'early-algebra', chartUrl: 'chart', audioUrl: 'audio' };
  assert.equal(createSongLaunchSearchParams({ ...input, rhythmDifficultyKey: 'ExpertSingle' }).get('rhythmDifficultyKey'), 'ExpertSingle');
  assert.equal(createSongLaunchSearchParams(input).has('rhythmDifficultyKey'), false);
});

test('handoff retains activity, difficulty and complete nested signed asset URLs', () => {
  const signed = 'https://storage.example/a.chart?token=a%2Bb%26c&download=1';
  const input = new URLSearchParams({ launch: 'PlayNow', songAssetId: 'waves', activityKey: 'early-algebra', rhythmDifficultyKey: 'ExpertSingle', chartUrl: signed });
  const output = new URL(buildEmbeddedGameUrl('https://game.example/', resolveLaunchParams(input)));
  assert.equal(output.searchParams.get('activityKey'), 'early-algebra');
  assert.equal(output.searchParams.get('rhythmDifficultyKey'), 'ExpertSingle');
  assert.equal(output.searchParams.get('chartUrl'), signed);
});
