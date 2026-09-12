import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAuthoredEquationOperator,
  parseAuthoredLessonDraft,
  stampAuthoredLessonIdentity,
} from '../lib/authored-lesson';
import { validateLessonContent } from '../lib/lesson-content';

const authored = {
  version: 3,
  mode: 'authored',
  songAssetId: 'song-a',
  activityKey: 'early-algebra',
  equations: [{ id: 'eq-a', state: 'x+1=2' }],
  encounters: [{
    id: 'event-a:hit:0',
    eventId: 'event-a',
    type: 'hit',
    equationId: 'eq-a',
    startTick: 192,
    endTick: 192,
    hitBubbles: [{ tokenIndex: 0, positions: ['left'], pads: ['left'] }],
  }],
};

test('operator classification matches every token Unity rejects as non-playable', () => {
  for (const token of ['+', '-', '=', '*', '/', '^', '(', ')', '×', '÷', '−']) {
    assert.equal(isAuthoredEquationOperator(token), true, `${token} should be an operator`);
  }
  assert.equal(isAuthoredEquationOperator('x'), false);
  assert.equal(isAuthoredEquationOperator('12'), false);
});

test('authored payload is stamped with the selected identity and revision', () => {
  const draft = parseAuthoredLessonDraft(authored);
  const stamped = stampAuthoredLessonIdentity(draft, {
    songAssetId: 'song-a',
    activityKey: 'early-algebra',
    authorId: 'author-a',
    revision: 'rev-1',
  });
  assert.equal(stamped.authorId, 'author-a');
  assert.equal(stamped.revision, 'rev-1');
  assert.equal(stamped.encounters[0].eventId, 'event-a');
});

test('authored payload rejects mismatched identity instead of falling back', () => {
  const draft = parseAuthoredLessonDraft(authored);
  assert.throws(() => stampAuthoredLessonIdentity(draft, {
    songAssetId: 'song-b',
    activityKey: 'early-algebra',
    authorId: 'author-a',
    revision: 'rev-1',
  }), /songAssetId/);
});

test('second save: previous revision is a precondition, new revision is stamped', () => {
  // R1 saved and published.
  const firstDraft = parseAuthoredLessonDraft(authored);
  const r1 = stampAuthoredLessonIdentity(firstDraft, {
    songAssetId: 'song-a',
    activityKey: 'early-algebra',
    authorId: 'author-a',
    revision: 'rev-1',
  });
  assert.equal(r1.revision, 'rev-1');

  // Editor reopens, edits, and the draft now carries the previous revision R1.
  const secondDraft = parseAuthoredLessonDraft({ ...authored, revision: 'rev-1' });

  // Stamping with the NEW revision R2 must succeed (this was the F02 defect).
  const r2 = stampAuthoredLessonIdentity(secondDraft, {
    songAssetId: 'song-a',
    activityKey: 'early-algebra',
    authorId: 'author-a',
    revision: 'rev-2',
  });
  assert.equal(r2.revision, 'rev-2');
  assert.equal(r2.authorId, 'author-a');
});

test('mismatched author still rejected on repeat save', () => {
  const draft = parseAuthoredLessonDraft({ ...authored, authorId: 'author-a', revision: 'rev-1' });
  assert.throws(() => stampAuthoredLessonIdentity(draft, {
    songAssetId: 'song-a',
    activityKey: 'early-algebra',
    authorId: 'author-b',
    revision: 'rev-2',
  }), /authorId/);
});

test('lesson validation accepts a note-free authored chart but not a malformed authored payload', () => {
  const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n}';
  assert.doesNotThrow(() => validateLessonContent(chart, JSON.stringify(authored)));
  assert.throws(() => validateLessonContent(chart, JSON.stringify({
    ...authored,
    encounters: [{ ...authored.encounters[0], endTick: undefined }],
  })), /endTick/i);
});

test('authored v3 allows simultaneous spin and drag (legacy restriction must not leak in)', () => {
  const overlap = {
    ...authored,
    encounters: [
      { id: 'e1:spin:0', eventId: 'e1', type: 'spin', equationId: 'eq-a', startTick: 192, endTick: 384, spinTargets: [{ tokenIndex: 0 }] },
      { id: 'e1:drag:0', eventId: 'e1', type: 'drag', equationId: 'eq-a', startTick: 192, endTick: 384, dragTargets: [{ tokenIndex: 2 }] },
    ],
  };
  assert.doesNotThrow(() => parseAuthoredLessonDraft(overlap));
  const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n}';
  assert.doesNotThrow(() => validateLessonContent(chart, JSON.stringify(overlap)));
});

test('rejects start > end and non-instantaneous hit durations', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ id: 'e:spin:0', eventId: 'e', type: 'spin', equationId: 'eq-a', startTick: 384, endTick: 192, spinTargets: [{ tokenIndex: 0 }] }],
  }), /startTick must not exceed endTick/i);

  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ id: 'e:hit:0', eventId: 'e', type: 'hit', equationId: 'eq-a', startTick: 192, endTick: 200, hitBubbles: [{ tokenIndex: 0 }] }],
  }), /instantaneous/i);

  for (const type of ['spin', 'drag'] as const) {
    assert.throws(() => parseAuthoredLessonDraft({
      ...authored,
      encounters: [{
        id: `e:${type}:0`,
        eventId: 'e',
        type,
        equationId: 'eq-a',
        startTick: 192,
        endTick: 192,
        ...(type === 'spin'
          ? { spinTargets: [{ tokenIndex: 0 }] }
          : { dragTargets: [{ tokenIndex: 0 }] }),
      }],
    }), /positive duration/i);
  }
});

test('requires published identity only when the published profile is requested', () => {
  assert.doesNotThrow(() => parseAuthoredLessonDraft(authored));
  assert.throws(
    () => parseAuthoredLessonDraft(authored, { requirePublishedIdentity: true }),
    /authorId and revision/i,
  );
  assert.doesNotThrow(() => parseAuthoredLessonDraft(
    { ...authored, authorId: 'author-a', revision: 'rev-1' },
    { requirePublishedIdentity: true },
  ));
});

test('rejects a missing target tokenIndex instead of defaulting it to zero', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ ...authored.encounters[0], hitBubbles: [{}] }],
  }), /tokenIndex/i);
});

test('rejects invalid hit pads and non-array targets', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ id: 'e:hit:0', eventId: 'e', type: 'hit', equationId: 'eq-a', startTick: 192, endTick: 192, hitBubbles: [{ tokenIndex: 0, pads: ['middle'] }] }],
  }), /one of/i);

  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ id: 'e:spin:0', eventId: 'e', type: 'spin', equationId: 'eq-a', startTick: 192, endTick: 384, spinTargets: 'nope' }],
  }), /spinTargets must be an array/i);
});

test('rejects empty playable target collections and dangling target references', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ id: 'e:spin:0', eventId: 'e', type: 'spin', equationId: 'eq-a', startTick: 192, endTick: 384, spinTargets: [] }],
  }), /requires at least one target/i);

  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [
      ...authored.encounters,
      { id: 'e:drag:0', eventId: 'e', type: 'drag', equationId: 'eq-a', startTick: 192, endTick: 384, dragTargets: [{ tokenIndex: 0, sourceHitId: 'missing-hit' }] },
    ],
  }), /sourceHitId.*missing/i);
});

test('rejects target token indexes outside the referenced equation', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{ ...authored.encounters[0], hitBubbles: [{ tokenIndex: 99 }] }],
  }), /tokenIndex.*equation/i);
});

test('rejects targets aimed at non-playable operator tokens', () => {
  assert.throws(() => parseAuthoredLessonDraft({
    ...authored,
    encounters: [{
      id: 'event-a:spin:0',
      eventId: 'event-a',
      type: 'spin',
      equationId: 'eq-a',
      startTick: 192,
      endTick: 384,
      spinTargets: [{ tokenIndex: 1 }],
    }],
  }), /non-playable operator/i);
});

test('rejects coerced stopAtSeconds strings and negative values', () => {
  assert.throws(() => parseAuthoredLessonDraft({ ...authored, stopAtSeconds: '12' }), /stopAtSeconds/);
  assert.throws(() => parseAuthoredLessonDraft({ ...authored, stopAtSeconds: -1 }), /stopAtSeconds/);
  assert.doesNotThrow(() => parseAuthoredLessonDraft({ ...authored, stopAtSeconds: 12.5 }));
});
