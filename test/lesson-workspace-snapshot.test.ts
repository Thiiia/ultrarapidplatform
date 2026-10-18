import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { timelineEventsFromAuthoredLesson } from "../lib/authored-lesson-serialization";
import { captureAuthoredWorkspaceLesson, readWorkspaceAuthoredLesson, shouldRestoreLessonWorkspace } from "../lib/editor/lesson-workspace-snapshot";
import { demoLessonDraftStorageKey, readDemoLessonDraft, saveDemoLessonDraft } from "../lib/demo-lesson-drafts";
import { readPlayerLessonWorkspaceDraft, writePlayerLessonWorkspaceDraft } from "../lib/player-lesson-workspace";
import { prepareWorkspaceMutation } from "../lib/player-workspace-client";

const lesson = parseAuthoredLessonDraft(JSON.parse(readFileSync("contracts/number-bonds/sequence-v1/fixtures.json", "utf8")).validLesson);
const source = { songAssetId: lesson.songAssetId, activityKey: lesson.activityKey, authorId: "author", revision: "00000000-0000-4000-8000-000000000001" };
const clock = { toTick: (seconds: number) => Math.round(seconds), toSeconds: (tick: number) => tick };
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};

test("explicit demo saves win over older, tied and undated recovery copies", () => {
  const demoDraft = { sidecar: JSON.stringify(lesson), updatedAt: 200 };
  for (const updatedAt of [undefined, 100, 200]) {
    assert.equal(shouldRestoreLessonWorkspace({ demoDraft, updatedAt, authoredLesson: lesson }), false);
  }
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft: { sidecar: demoDraft.sidecar }, updatedAt: 300, authoredLesson: lesson }), false);
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft: null, updatedAt: 100 }), true);
});

test("newer complete workspace wins while a Hit-only copy cannot strip sequence metadata", () => {
  const demoDraft = { sidecar: JSON.stringify(lesson), updatedAt: 200 };
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft, updatedAt: 300, authoredLesson: lesson }), true);
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft, updatedAt: 300 }), false);
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft, updatedAt: 300, authoredLesson: { ...lesson, numberBondGems: [] } }), false);
  assert.equal(shouldRestoreLessonWorkspace({ demoDraft: { sidecar: "{}", updatedAt: 200 }, updatedAt: 300 }), true);
});

test("demo timestamps survive storage and legacy saves remain readable", () => {
  const storage = memoryStorage();
  const draft = { chart: "chart", sidecar: JSON.stringify(lesson) };
  saveDemoLessonDraft(storage, source.songAssetId, source.activityKey, draft, 1234);
  assert.deepEqual(readDemoLessonDraft(storage, source.songAssetId, source.activityKey), { ...draft, updatedAt: 1234 });
  storage.setItem(demoLessonDraftStorageKey(source.songAssetId, source.activityKey), JSON.stringify(draft));
  assert.deepEqual(readDemoLessonDraft(storage, source.songAssetId, source.activityKey), draft);
});

function capture() {
  const hydrated = timelineEventsFromAuthoredLesson(lesson, clock);
  const captured = captureAuthoredWorkspaceLesson({
    source, clock, events: hydrated.events,
    equationQueue: hydrated.equations, stopAtSeconds: 123,
    numberBondSequenceV1: { version: 1, gems: lesson.numberBondGems! },
  });
  assert.ok(captured);
  return { captured, hydrated };
}

test("canonical recovery preserves complete journeys, destinations, queue and stop together", () => {
  const { captured } = capture();
  assert.deepEqual(captured.encounters, lesson.encounters);
  assert.deepEqual(captured.numberBondGems, lesson.numberBondGems);
  assert.equal(captured.numberBondSequenceVersion, 1);
  assert.equal(captured.stopAtSeconds, 123);
  assert.deepEqual(captured.equations.map((equation) => equation.id), lesson.equations.map((equation) => equation.id));
  assert.deepEqual(timelineEventsFromAuthoredLesson(captured, clock).equations.map((equation) => equation.id), captured.equations.map((equation) => equation.id));
});

test("Algebra recovery preserves queue order including equations with no encounters", () => {
  const { hydrated } = capture();
  const unassigned = { id: "next-equation", tokens: [{ id: "next-token", label: "8" }] };
  const captured = captureAuthoredWorkspaceLesson({ source: { ...source, activityKey: "early-algebra" },
    clock, events: hydrated.events, equationQueue: [unassigned, ...hydrated.equations], stopAtSeconds: 123 });
  assert.ok(captured);
  assert.deepEqual(captured.equations.map((equation) => equation.id), ["next-equation", lesson.equations[0].id]);
});

test("incomplete mechanics keep their original raw recovery format", () => {
  const { hydrated } = capture();
  const events = structuredClone(hydrated.events);
  events[0].mechanicInstances.hit[0].hitBubbles = [];
  assert.equal(captureAuthoredWorkspaceLesson({ source, clock, events, equationQueue: hydrated.equations }), undefined);
});

test("local and remote recovery compact repeated timeline equations without raising 48 KB", () => {
  const { captured, hydrated } = capture();
  const timelineEvents = Array.from({ length: 20 }, () => hydrated.events).flat();
  assert.ok(JSON.stringify(timelineEvents).length > 48_000);
  const recordedDrafts = [{ id: "pending-hit", mechanic: "hit", tick: 120 }];
  const storage = memoryStorage();
  writePlayerLessonWorkspaceDraft(storage, { version: 1, source, timelineEvents, authoredLesson: captured,
    recordedDrafts, equationEdits: [], updatedAt: 300 });
  const restored = readPlayerLessonWorkspaceDraft(storage, source, 300)!;
  assert.ok(restored);
  assert.deepEqual(restored.timelineEvents, []);
  assert.deepEqual(restored.recordedDrafts, recordedDrafts);
  assert.deepEqual(restored.authoredLesson, captured);
  assert.ok([...storage.values.values()].every((value) => new TextEncoder().encode(value).byteLength <= 48_000));
  const remote = prepareWorkspaceMutation({ key: source, expectedVersion: 0, payload: {
    version: 1, equations: [], hiddenSourceEquationIds: [], timelineEdits: timelineEvents,
    authoredLesson: captured, recordedDrafts, tutorial: { step: "done" }, updatedAt: 300,
  } });
  assert.equal(remote.kind, "ready");
  if (remote.kind !== "ready") return;
  assert.deepEqual(remote.mutation.payload.timelineEdits, []);
  assert.deepEqual(remote.mutation.payload.authoredLesson, captured);
  assert.deepEqual(remote.mutation.payload.recordedDrafts, recordedDrafts);
});

test("canonical recovery rejects wrong source and credential transports, including discarded raw edits", () => {
  const { captured } = capture();
  assert.equal(readWorkspaceAuthoredLesson(captured, { ...source, songAssetId: "another-song" }), null);
  const storage = memoryStorage();
  const base = { version: 1 as const, source, timelineEvents: [], authoredLesson: captured, equationEdits: [], updatedAt: 300 };
  assert.throws(() => writePlayerLessonWorkspaceDraft(storage, { ...base, authoredLesson: { ...captured, songAssetId: "another-song" } }));
  assert.throws(() => writePlayerLessonWorkspaceDraft(storage, { ...base, timelineEvents: [{ signedUrl: "https://example.test" }] }));
  const remote = prepareWorkspaceMutation({ key: source, expectedVersion: 0, payload: {
    version: 1, equations: [], hiddenSourceEquationIds: [], timelineEdits: [{ signedUrl: "https://example.test" }],
    authoredLesson: captured, tutorial: { step: "done" }, updatedAt: 300,
  } });
  assert.equal(remote.kind, "invalid-local");
});
