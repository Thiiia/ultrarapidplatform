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
const studentCopySource = readFileSync(
  join(process.cwd(), "lib/student-copy.ts"),
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
  assert.match(lessonBuilderSource, /const \[advancedMode, setAdvancedMode\] = useState\(false\)/);
  assert.match(lessonBuilderSource, /const \[isBuilderPanelOpen, setIsBuilderPanelOpen\] = useState\(false\)/);
  assert.match(lessonBuilderSource, /const \[isLibraryPanelOpen, setIsLibraryPanelOpen\] = useState\(false\)/);
  assert.match(
    lessonBuilderSource,
    /function handleNewEquation\(\)[\s\S]*?setIsBuilderPanelOpen\(true\)[\s\S]*?setMode\("equation"\)/,
  );
  assert.match(
    lessonBuilderSource,
    /function beginGuidedEditing\(\)[\s\S]*?setAdvancedMode\(false\)[\s\S]*?setIsBuilderPanelOpen\(false\)/,
  );
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

test("dense readiness blockers remain available in a bounded scroll area", () => {
  assert.match(
    studentStyles,
    /\.editorReadinessDetails\s*\{[^}]*max-height:\s*260px;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
  );
});

test("readiness blockers select the exact cue and seek to its authored time", () => {
  const handler = lessonBuilderSource.match(
    /function handleSelectReadinessEncounter\(encounterId: string\)[\s\S]*?\n  }/,
  )?.[0];
  assert.ok(handler);
  assert.match(handler, /findGuidedEncounterSelection\([\s\S]*timelineEvents[\s\S]*encounterId/);
  assert.match(handler, /setSelectedContextMechanicKey\(`\$\{selection\.mechanic\}:\$\{selection\.instanceIndex\}`\)/);
  assert.match(handler, /seekSong\(timelineTickToSeconds\(selection\.tick\)\)/);
  assert.match(readinessSource, /blocker\.relatedEncounterId/);
});

test("starter copy does not promise Play while the lesson still has blockers", () => {
  assert.match(studentCopySource, /Starter lesson\. Check the Ready panel for any fixes before playing/);
});

test("editor motion respects reduced-motion preferences", () => {
  assert.match(studentStyles, /prefers-reduced-motion: reduce/);
  assert.match(studentStyles, /\.editorToast \{/);
  assert.match(studentStyles, /\.editorToastVisible \{/);
  assert.match(studentStyles, /\.editorReadinessDetails \{/);
  assert.match(studentStyles, /\.editorReadinessDetails\[hidden\] \{[\s\S]*display: none/);
});
