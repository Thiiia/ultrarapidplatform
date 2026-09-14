import assert from "node:assert/strict";
import test from "node:test";
import {
  deletePlayerLessonWorkspaceDraft,
	playerLessonWorkspaceKey,
	readPlayerLessonWorkspaceDraft,
	resolveLessonWorkspaceSource,
	writePlayerLessonWorkspaceDraft,
  type LessonSourceIdentity,
} from "../lib/player-lesson-workspace";
import { prepareWorkspaceMutation } from "../lib/player-workspace-client";

const source: LessonSourceIdentity = { songAssetId: "waves", activityKey: "early-algebra", authorId: "author", revision: "rev-1" };
const storage = () => { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }; };

test("uses the saved revision author for a private workspace", () => {
  assert.deepEqual(
    resolveLessonWorkspaceSource({
      songAssetId: "oneone",
      activityKey: "early-algebra",
      lastSavedAuthorId: "author-uuid",
      selectedAuthorId: null,
      selectedAuthorName: "dev",
      revision: "b5515a55-31a6-48fe-9559-ee41e62a1b35",
    }),
    {
      songAssetId: "oneone",
      activityKey: "early-algebra",
      authorId: "author-uuid",
      revision: "b5515a55-31a6-48fe-9559-ee41e62a1b35",
    },
  );
});

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

test("keeps an incomplete local event when remote workspace conversion fails", () => {
  const s = storage();
  const incompleteEvent = {
    id: "spin-draft",
    mechanic: "spin",
    tick: 8,
    mechanicInstances: { spin: [{ id: "spin-draft:spin:0", spinTargets: [] }] },
  };
  const draft = { version: 1 as const, source, timelineEvents: [incompleteEvent], equationEdits: [], updatedAt: Date.now() };
  writePlayerLessonWorkspaceDraft(s, draft);

  const prepared = prepareWorkspaceMutation({
    key: { ...source, revision: "00000000-0000-4000-8000-000000000001" },
    expectedVersion: 0,
    payload: {
      version: 1,
      equations: [],
      hiddenSourceEquationIds: [],
      timelineEdits: [incompleteEvent, ["remote-conversion-failed"]],
      tutorial: { step: "encounter" },
      updatedAt: Date.now(),
    },
  });

  assert.equal(prepared.kind, "invalid-local");
  assert.match(prepared.message, /kept only on this device/);
  assert.deepEqual(readPlayerLessonWorkspaceDraft(s, source)?.timelineEvents, [incompleteEvent]);
});
