import assert from 'node:assert/strict';
import test from 'node:test';
import { chartToProject } from '../lib/editor/chart-to-project';
import { projectToChart } from '../lib/editor/project-to-chart';

const source = '[Song]\r\n{\r\n Name = "Waves"\r\n Resolution = 192\r\n Offset = -0.125\r\n}\r\n[SyncTrack]\r\n{\r\n 0 = B 120000\r\n 384 = B 150000\r\n}\r\n[MediumSingle]\r\n{\r\n 192 = N 2 96\r\n}\r\n[ExpertSingle]\r\n{\r\n 192 = N 0 0\r\n 384 = S 2 192\r\n}\r\n[UnknownSection]\r\n{\r\n keep = "verbatim"\r\n}\r\n';

test('an unchanged imported chart round trips byte for byte', () => {
  assert.equal(projectToChart(chartToProject({ chartFile: source })), source);
});

test('editing Expert notes preserves other difficulties, sync changes and unknown events', () => {
  const project = chartToProject({ chartFile: source });
  project.notes[0].lane = 4;
  assert.equal(projectToChart(project), source.replace('192 = N 0 0', '192 = N 4 0'));
});

test('deleting and adding notes keeps special chart markers', () => {
  const project = chartToProject({ chartFile: source });
  project.notes = [];
  const removed = projectToChart(project);
  assert.ok(!removed.includes('192 = N 0 0'));
  assert.ok(removed.includes('384 = S 2 192'));
  assert.ok(removed.includes('192 = N 2 96'));
  const next = chartToProject({ chartFile: source });
  next.notes.push({ ...next.notes[0], id: 'new', tick: 768, lane: 3 });
  assert.ok(projectToChart(next).includes('768 = N 3 0'));
  assert.ok(projectToChart(next).includes('384 = S 2 192'));
});
