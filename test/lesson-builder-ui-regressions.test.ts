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
const composerSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/GuidedEncounterComposer.tsx"),
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
  assert.match(readinessSource, /aria-live="polite"/);
  assert.match(
    studentStyles,
    /\.editorReadinessDetails\s*\{[\s\S]*?max-height:\s*260px;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  );
});

test("lesson-level blockers explain the repair without acting like a cue link", () => {
  assert.match(readinessSource, /blocker\.encounterId\s*\?/);
  assert.match(readinessSource, /editorReadinessBlockerStatic/);
  assert.match(lessonBuilderSource, /if \(blocker\.encounterId\) handleSelectReadinessEncounter\(blocker\.encounterId, blocker\.code\)/);
});

test("Number Bonds recording shows timing guidance and keeps automatic repairs inside the song", () => {
  assert.match(lessonBuilderSource, /\(!isRctm2Mode \|\| \(selectedSongActivity\?\.key \?\? selectedSongLaunch\?\.activityKey\) === "number-bonds"\)/);
  assert.match(readinessSource, /Move this catch cue for me/);
  assert.match(lessonBuilderSource, /nextSeconds \+ NUMBER_BONDS_TIMING_POLICY\.finalInteractionTailSeconds > songEndSeconds/);
  assert.match(lessonBuilderSource, /setRtcmDraftMechanics\(\(current\) => current\.map/);
});

test("readiness blockers select the exact cue and seek to its authored time", () => {
  const handler = lessonBuilderSource.match(
    /function handleSelectReadinessEncounter\(encounterId: string, issueCode: string\)[\s\S]*?\n  }/,
  )?.[0];
  assert.ok(handler);
  assert.match(handler, /findGuidedEncounterSelection\([\s\S]*timelineEvents[\s\S]*encounterId/);
  assert.match(handler, /setSelectedContextMechanicKey\(`\$\{selection\.mechanic\}:\$\{selection\.instanceIndex\}`\)/);
  assert.match(handler, /seekSong\(timelineTickToSeconds\(selection\.tick\)\)/);
  assert.match(readinessSource, /onClick=\{\(\) => onSelectEncounter\(blocker\.encounterId!, blocker\.code\)\}/);
  assert.match(readinessSource, /groupReadinessBlockers\(readiness\.blockers\)/);
  assert.match(readinessSource, /paginateReadinessBlockers\(blockerGroups, requestedBlockerPage\)/);
  assert.match(handler, /setRepairFocus\(\{ code: issueCode/);
  assert.match(readinessSource, /onSelectEncounter\(blocker\.encounterId!, blocker\.code\)/);
});

test("readiness blocker details paginate dense stress lists", () => {
  assert.match(readinessSource, /groupReadinessBlockers\(readiness\.blockers\)/);
  assert.match(readinessSource, /paginateReadinessBlockers\(blockerGroups, requestedBlockerPage\)/);
  assert.match(readinessSource, /aria-label="Readiness issues"/);
  assert.match(readinessSource, /blockerPage\.pageCount - 1/);
});

test("unsupported mechanics focus a removable action and timing conflicts focus start time", () => {
  assert.match(composerSource, /code === "activity_mechanic_unsupported" \? "remove"/);
  assert.match(composerSource, /data-repair-control="remove"/);
  assert.match(composerSource, /code === "single_target_required"/);
  assert.match(composerSource, /code === "unsupported_concurrency" \|\| code === "activity_hit_spacing" \|\| code === "hit_timing_invalid" \? "start"/);
  assert.match(composerSource, /data-repair-control="start"/);
});

test("recorded encounter drafts are dirty, validated, and reachable from readiness", () => {
  const recording = lessonBuilderSource.split("function addRtcmDraftMechanic(")[1]?.split("function handleStartRtcmEventCreation(")[0];
  const finalize = lessonBuilderSource.split("function handleFinalizeRtcmEventCreation(")[1]?.split("function handleBrowsePremadeChoice(")[0];
  assert.ok(recording);
  assert.ok(finalize);
  assert.match(recording, /setRtcmDraftMechanics\([\s\S]*?markDirty\(\)/);
  assert.match(recording, /setAuthoredEquationQueue\(/);
  assert.match(finalize, /if \(selectedDrafts\.length === 0\)/);
  assert.match(finalize, /markDirty\(\)/);
  assert.match(lessonBuilderSource, /evaluateLessonPublishReadiness\(\[\.\.\.timelineEvents, \.\.\.rtcmAuthoredEvents\]/);
  assert.match(lessonBuilderSource, /authoredSidecarFromTimelineEvents\([\s\S]*?\[\.\.\.timelineEvents, \.\.\.rtcmAuthoredEvents\]/);
  assert.match(lessonBuilderSource, /findGuidedEncounterSelection\(rtcmAuthoredEvents, encounterId\)/);
  assert.match(lessonBuilderSource, /function handleStartRtcmHold\([\s\S]*?if \(!draftId\) return;/);
  assert.match(lessonBuilderSource, /function handleBeginRctm2DragMarker\([\s\S]*?if \(!draftId\) return "";/);
  assert.match(lessonBuilderSource, /recordedDrafts: rtcmDraftMechanics/);
  assert.match(lessonBuilderSource, /payload\.recordedDrafts\.filter\(isRecoverableRtcmDraft\)/);
});

test("recording and timeline edits reject newly introduced Unity timing conflicts", () => {
  const recording = lessonBuilderSource.split("function addRtcmDraftMechanic(")[1]?.split("function handleStartRtcmEventCreation(")[0];
  const dragging = lessonBuilderSource.split("function handleRetimeMechanicMarker(")[1]?.split("function handleRetimeEventEdge(")[0];
  assert.ok(recording);
  assert.ok(dragging);
  assert.match(recording, /findNewTimingConflict\(/);
  assert.match(dragging, /retimeGuidedEncounter\(/);
  assert.match(dragging, /findNewTimingConflict\(/);
});

test("a recorded cue warning opens a directly editable repair panel", () => {
  assert.match(lessonBuilderSource, /setRecordedRepairId\(selection\.eventId\)/);
  assert.match(lessonBuilderSource, /aria-label="Recorded move repair"/);
  assert.match(lessonBuilderSource, /onPatchInstance=\{handlePatchRecordedRepair\}/);
  assert.match(lessonBuilderSource, /id="recorded-repair-equation"/);
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
