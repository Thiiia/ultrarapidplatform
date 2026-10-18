import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getNumberBondEditorAction } from "../lib/editor/number-bond-editor-action";

test("a built journey needing repair cannot implicitly rebuild on play", () => {
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: true, hasSequence: true }), "review");
});
test("ready saved lessons play with either supported content version", () => {
  for (const hasSequence of [true, false]) {
    assert.equal(getNumberBondEditorAction({ ready: true, matchingNotes: true, hasSequence }), "play");
  }
});
test("new targets and legacy incomplete lessons retain explicit building", () => {
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: false, hasSequence: true }), "build");
  assert.equal(getNumberBondEditorAction({ ready: false, matchingNotes: true, hasSequence: false }), "build");
  assert.equal(getNumberBondEditorAction({ ready: true, matchingNotes: false, hasSequence: true }), "build");
});

test("demo playback always uses the published template without rebuilding or validating local edits", () => {
  for (const ready of [true, false]) {
    for (const matchingNotes of [true, false]) {
      for (const hasSequence of [true, false]) {
        assert.equal(getNumberBondEditorAction({ ready, matchingNotes, hasSequence, demo: true }), "published-template");
      }
    }
  }
});

test("demo mission playback saves local edits before using the existing published launch boundary", () => {
  const source = readFileSync("app/student/lesson-builder/LessonBuilderClient.tsx", "utf8");
  const handler = source.slice(source.indexOf("  function handlePlayNumberBondMission()"), source.indexOf("  function handleShuffleNumberBondTarget()"));
  assert.match(handler, /demo: isDemoMode/);
  assert.match(handler, /if \(action === "published-template"\) \{[\s\S]*?if \(hasUnsavedChanges && !savePrivateDraft\(\)\) return;[\s\S]*?handleLaunchGame\(true\);[\s\S]*?return;/);
  assert.ok(handler.indexOf('action === "published-template"') < handler.indexOf('action === "review"'));
  assert.doesNotMatch(handler, /handleSaveToSupabase|fetch\(/);
  const launch = source.slice(source.indexOf("  async function handleLaunchGame("), source.indexOf("  async function handleSaveToSupabase("));
  assert.match(launch, /isDemoMode && !playTemplateOnly/);
  assert.match(launch, /requestFreshSongLaunchPackage\(/);
});

test("demo composer names published playback and keeps its availability separate from draft readiness", () => {
  const source = readFileSync("app/student/lesson-builder/NumberBondsMissionComposer.tsx", "utf8");
  assert.match(source, /Play published lesson/);
  assert.match(source, /publishedLaunchPhase === "checking"/);
  assert.match(source, /primaryAction === "published-template"\s*\? !publishedLessonUnavailable/);
  assert.match(source, /disabled=\{!canPlay \|\| isPreparing \|\| publishedLaunchPending\}/);
  assert.match(source, /number-bonds-published-play-guidance/);
  assert.match(source, /published lesson plays without these edits/);
});
