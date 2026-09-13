import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSongFlowPayload } from '../lib/song-flow-debug';
test('diagnostics never retain signed URLs or nested launch tokens', () => {
  const result = redactSongFlowPayload({ songAssetId: 'waves', chartPath: 'Early_Algebra/waves.chart', launchUrl: '/game?chartUrl=https%3A%2F%2Fs%3Ftoken%3Dsecret', chart: { signedUrl: 'https://s?token=secret' }, sessionToken: 'secret' });
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal((result as Record<string, unknown>).songAssetId, 'waves');
});

test('diagnostics also redact provider signatures and authorization-shaped fields', () => {
  const result = redactSongFlowPayload({
    chart: { 'x-amz-signature': 'provider-secret' },
    headers: { authorization: 'Bearer provider-secret' },
    text: 'https://storage.example/chart?X-Amz-Signature=provider-secret',
  });
  assert.ok(!JSON.stringify(result).includes('provider-secret'));
});
