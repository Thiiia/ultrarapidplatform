import assert from 'node:assert/strict';
import test from 'node:test';
import {
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

test('lesson validation accepts a note-free authored chart but not a malformed authored payload', () => {
  const chart = '[Song]\n{\n Resolution = 192\n}\n[SyncTrack]\n{\n 0 = B 120000\n}\n[ExpertSingle]\n{\n}';
  assert.doesNotThrow(() => validateLessonContent(chart, JSON.stringify(authored)));
  assert.throws(() => validateLessonContent(chart, JSON.stringify({
    ...authored,
    encounters: [{ ...authored.encounters[0], endTick: undefined }],
  })), /endTick/i);
});
