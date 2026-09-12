import assert from "node:assert/strict";
import test from "node:test";
import {
  deletePlayerLessonWorkspaceDraft,
  playerLessonWorkspaceKey,
  readPlayerLessonWorkspaceDraft,
  writePlayerLessonWorkspaceDraft,
  type LessonSourceIdentity,
} from "../lib/player-lesson-workspace";

const source: LessonSourceIdentity = { songAssetId: "waves", activityKey: "early-algebra", authorId: "author", revision: "rev-1" };
const storage = () => { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }; };

test("keys drafts by the complete source identity", () => assert.notEqual(playerLessonWorkspaceKey(source), playerLessonWorkspaceKey({ ...source, revision: "rev-2" })));
test("rejects malformed, stale, wrong-source, and credential-bearing drafts", () => {
  const s = storage(); const key = playerLessonWorkspaceKey(source);
  s.setItem(key, "not json"); assert.equal(readPlayerLessonWorkspaceDraft(s, source), null);
  s.setItem(key, JSON.stringify({ version: 1, source, timelineEvents: [], equationEdits: [], updatedAt: 0 })); assert.equal(readPlayerLessonWorkspaceDraft(s, source, 8 * 24 * 60 * 60 * 1000), null);
  s.setItem(key, JSON.stringify({ version: 1, source, timelineEvents: [{ signedUrl: "https://example.test/a?X-Amz-Signature=x" }], equationEdits: [], updatedAt: Date.now() })); assert.equal(readPlayerLessonWorkspaceDraft(s, source), null);
});
test("writes and deletes a valid revision-scoped draft", () => {
  const s = storage(); const draft = { version: 1 as const, source, timelineEvents: [{ id: "event-1" }], equationEdits: [], updatedAt: Date.now() };
  writePlayerLessonWorkspaceDraft(s, draft); assert.deepEqual(readPlayerLessonWorkspaceDraft(s, source)?.timelineEvents, draft.timelineEvents); deletePlayerLessonWorkspaceDraft(s, source); assert.equal(readPlayerLessonWorkspaceDraft(s, source), null);
});

test("keeps gameplay token indexes in an offline recovery draft", () => {
  const s = storage();
  const draft = {
    version: 1 as const,
    source,
    timelineEvents: [{
      id: "event-1",
      mechanicInstances: {
        hit: [{ id: "event-1:hit:0", hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] }],
      },
    }],
    equationEdits: [],
    updatedAt: Date.now(),
  };

  assert.doesNotThrow(() => writePlayerLessonWorkspaceDraft(s, draft));
  assert.deepEqual(readPlayerLessonWorkspaceDraft(s, source)?.timelineEvents, draft.timelineEvents);
});
