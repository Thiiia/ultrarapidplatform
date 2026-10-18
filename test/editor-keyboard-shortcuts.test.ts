import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { shouldToggleEditorPlayback } from "../lib/editor/keyboard-shortcuts";

const space = { code: "Space", defaultPrevented: false, repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false };
test("unclaimed background Space toggles transport once", () => {
  assert.equal(shouldToggleEditorPlayback(space, null), true);
  assert.equal(shouldToggleEditorPlayback({ ...space, repeat: true }, null), false);
  assert.equal(shouldToggleEditorPlayback({ ...space, code: "Enter" }, null), false);
});
for (const key of ["defaultPrevented", "altKey", "ctrlKey", "metaKey", "shiftKey", "isComposing"] as const) {
  test(`${key} leaves keyboard ownership with the control or browser`, () => {
    assert.equal(shouldToggleEditorPlayback({ ...space, [key]: true }, null), false);
  });
}
test("interactive descendants and dialogs are excluded by the transport policy", () => {
  let selector = "";
  assert.equal(shouldToggleEditorPlayback(space, { closest: (value: string) => { selector = value; return {} as Element; } }), false);
  for (const expected of ["button", "a[href]", "input", "textarea", "select", "contenteditable", '[role="slider"]', '[role="dialog"]']) assert.ok(selector.includes(expected));
  assert.equal(shouldToggleEditorPlayback(space, { closest: () => null }), true);
});
test("the editor shortcut listener stays stable and reads latest transport state", () => {
  const source = readFileSync(new URL("../app/student/lesson-builder/LessonBuilderClient.tsx", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("  const togglePlaybackFromShortcut"), source.indexOf("  function syncTimelineFilesFromEvents"));
  assert.match(body, /useEffectEvent\(handleToggleSongPlayback\)/);
  assert.match(body, /shouldToggleEditorPlayback\(event, event\.target instanceof Element/);
  assert.match(body, /removeEventListener\("keydown", handleDocumentKeyDown\)/);
  assert.doesNotMatch(body, /currentSongSeconds, timelineDurationSeconds/);
});
