import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLessonContent } from '../lib/lesson-content';
import { projectToSidecarJson } from '../lib/editor/project-to-chart';
const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n 192 = N 1 0\n}';
test('validates all encounters beyond historical equation slot count', () => {
  validateLessonContent(chart, JSON.stringify({ version: 2, maxEquationSlots: 5, equations: Array.from({length: 12}, (_, i) => ({id: `eq${i}`, tick:i*192, state:'x+1=2', hits:[{}]})) }));
});
test('rejects unsupported simultaneous spin and drag and malformed packages', () => {
  assert.throws(() => validateLessonContent(chart, JSON.stringify({version:2,equations:[{tick:192,state:'x=1',spins:[{}],drags:[{}]}]})), /spin.*drag/i);
  assert.throws(() => validateLessonContent('[Song]', '{}'), /chart/i);
  assert.throws(() => validateLessonContent(chart, JSON.stringify({version:1})), /encounter/i);
  assert.throws(() => validateLessonContent(chart, JSON.stringify({version:2,equations:[{tick:-1,state:'x=1'}]})), /tick/i);
});

test('saves an explicitly empty editor sidecar for either supported format', () => {
  for (const sidecar of [
    { version: 1 as const, events: [] },
    { version: 2 as const, maxEquationSlots: 5, equations: [] },
  ]) {
    const json = projectToSidecarJson(sidecar);
    assert.doesNotThrow(() => validateLessonContent(chart, json));
    assert.deepEqual(JSON.parse(json), sidecar);
  }
});

test('rejects missing or malformed encounter collections instead of treating them as empty', () => {
  for (const sidecar of [
    { version: 1 }, { version: 1, events: null }, { version: 1, events: {} },
    { version: 2 }, { version: 2, equations: null }, { version: 2, equations: '[]' },
  ]) {
    assert.throws(() => validateLessonContent(chart, JSON.stringify(sidecar)), /encounter/i);
  }
});
