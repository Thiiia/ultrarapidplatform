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

test('handoff retains the receipt aliases and authored identity needed by Unity bootstrap', () => {
  const receipt = JSON.stringify({
    receiptVersion: 1,
    contractVersion: 1,
    songAssetId: 'waves',
    activityKey: 'early-algebra',
    authorId: 'author-7',
    revision: 'rev-7',
    source: 'authored',
  });
  const input = new URLSearchParams({
    launch: 'PlayNow',
    songAssetId: 'waves',
    activityKey: 'early-algebra',
    authorId: 'author-7',
    revision: 'rev-7',
    launchAttemptId: '00000000-0000-4000-8000-000000000007',
    receipt,
    receiptJson: receipt,
  });

  const output = resolveLaunchParams(input);
  assert.equal(output.get('authorId'), 'author-7');
  assert.equal(output.get('revision'), 'rev-7');
  assert.equal(output.get('launchAttemptId'), '00000000-0000-4000-8000-000000000007');
  assert.equal(output.get('receipt'), receipt);
  assert.equal(output.get('receiptJson'), receipt);
});

test('handoff retains the platform calibration offset alongside its authority fields', () => {
  const input = new URLSearchParams({
    launch: 'PlayNow',
    songAssetId: 'waves',
    activityKey: 'early-algebra',
    installationId: '00000000-0000-4000-8000-000000000008',
    requiresCalibration: 'false',
    calibrationProtocolVersion: '1',
    calibrationOffsetMs: '-37',
  });

  const output = resolveLaunchParams(input);
  assert.equal(output.get('installationId'), '00000000-0000-4000-8000-000000000008');
  assert.equal(output.get('requiresCalibration'), 'false');
  assert.equal(output.get('calibrationProtocolVersion'), '1');
  assert.equal(output.get('calibrationOffsetMs'), '-37');
});
