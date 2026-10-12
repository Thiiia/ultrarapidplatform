import assert from 'node:assert/strict';
import test from 'node:test';
import { appendChartActionsToEvent } from '../lib/editor/chart-event-placement';

test('adding at an occupied tick keeps its assignment and appends action instances', () => {
  type Instance = { id: string };
  type Event = {
    id: string;
    tick: number;
    counts: { hit: number; spin: number; drag: number };
    assignments: { hit: Instance; spin: null; drag: null };
    mechanicInstances: { hit: Instance[]; spin: Instance[]; drag: Instance[] };
  };
  const assignment = { id: 'equation-1' };
  const existing: Event = {
    id: 'existing-event',
    tick: 192,
    counts: { hit: 1, spin: 0, drag: 0 },
    assignments: { hit: assignment, spin: null, drag: null },
    mechanicInstances: {
      hit: [{ id: 'hit-1' }],
      spin: [],
      drag: [],
    },
  };
  const incoming: Pick<Event, 'counts' | 'mechanicInstances'> = {
    counts: { hit: 1, spin: 1, drag: 0 },
    mechanicInstances: {
      hit: [{ id: 'hit-2' }],
      spin: [{ id: 'spin-1' }],
      drag: [],
    },
  };

  const merged = appendChartActionsToEvent(existing, incoming);

  assert.equal(merged.id, existing.id);
  assert.equal(merged.tick, existing.tick);
  assert.equal(merged.assignments.hit, assignment);
  assert.deepEqual(merged.counts, { hit: 2, spin: 1, drag: 0 });
  assert.deepEqual(merged.mechanicInstances, {
    hit: [{ id: 'hit-1' }, { id: 'hit-2' }],
    spin: [{ id: 'spin-1' }],
    drag: [],
  });
});
