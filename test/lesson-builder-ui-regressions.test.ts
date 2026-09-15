import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const lessonBuilderSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/LessonBuilderClient.tsx"),
  "utf8",
);
const readinessSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/EncounterReadinessPanel.tsx"),
  "utf8",
);
const studentStyles = readFileSync(
  join(process.cwd(), "app/student/student.module.css"),
  "utf8",
);

test("editor status messages use one animated, dismissible toast lifecycle", () => {
  assert.match(lessonBuilderSource, /function EditorToast\(/);
  assert.match(lessonBuilderSource, /requestAnimationFrame/);
  assert.match(lessonBuilderSource, /editorToastHiding/);
  assert.match(lessonBuilderSource, /aria-live=\{kind === "error" \? "assertive" : "polite"\}/);
  assert.doesNotMatch(lessonBuilderSource, /width: "min\(360px, calc\(100vw - 36px\)\)"/);
  assert.doesNotMatch(lessonBuilderSource, /saveNotice \?/);
});

test("editor side panels progressively disclose without removing access", () => {
  assert.match(lessonBuilderSource, /const \[isBuilderPanelOpen, setIsBuilderPanelOpen\] = useState\(true\)/);
  assert.match(lessonBuilderSource, /const \[isLibraryPanelOpen, setIsLibraryPanelOpen\] = useState\(false\)/);
  assert.match(lessonBuilderSource, /<EditorPanelRail label="Build"/);
  assert.match(lessonBuilderSource, /<EditorPanelRail label="Library"/);
  assert.match(lessonBuilderSource, /Collapse equation builder/);
  assert.match(lessonBuilderSource, /Collapse equation library/);
});

test("guided editing names actions and avoids exposing internal action codes", () => {
  assert.match(lessonBuilderSource, /Choose an action/);
  assert.doesNotMatch(lessonBuilderSource, /\$\{item\.mechanic\[0\]\.toUpperCase\(\)\}\$\{item\.instanceIndex \+ 1\}/);
});

test("lesson readiness is an expandable status control", () => {
  assert.match(readinessSource, /isOpen: boolean/);
  assert.match(readinessSource, /aria-expanded=\{isOpen\}/);
  assert.match(readinessSource, /hidden=\{!isOpen\}/);
  assert.match(lessonBuilderSource, /isOpen=\{isReadinessOpen\}/);
});

test("editor motion respects reduced-motion preferences", () => {
  assert.match(studentStyles, /prefers-reduced-motion: reduce/);
  assert.match(studentStyles, /\.editorToast \{/);
  assert.match(studentStyles, /\.editorToastVisible \{/);
  assert.match(studentStyles, /\.editorReadinessDetails \{/);
  assert.match(studentStyles, /\.editorReadinessDetails\[hidden\] \{[\s\S]*display: none/);
});
