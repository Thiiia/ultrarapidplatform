import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

test("launch visual is decorative and game sizing stays route-local", () => {
  const launchPage = source("app/components/LaunchEmbedPage.tsx");
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");

  assert.doesNotMatch(gameEmbed, /height:\s*"100dvh"[\s\S]{0,500}overflowY:\s*"hidden"/);
  assert.match(launchPage, /pointerEvents:\s*"none"/);
  assert.doesNotMatch(launchPage, /\bcontrols\b/);
});

test("game embed refreshes its signed song package before loading Unity", () => {
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");

  assert.match(gameEmbed, /requestFreshSongLaunchParams/);
  assert.match(gameEmbed, /setLaunchParams\(freshLaunchParams\)/);
  assert.match(gameEmbed, /studentCopy\.game\.preparingTitle/);
  assert.match(gameEmbed, /resolveLaunchParams\(new URLSearchParams\(serializedSearchParams\)\)/);
  assert.match(gameEmbed, /studentCopy\.game\.chooseSongTitle/);
  assert.match(gameEmbed, /Try again/);
});

test("game embed waits for the verified bridge and reports result-sync failures", () => {
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");

  assert.match(gameEmbed, /canRenderEmbeddedGame/);
  assert.match(gameEmbed, /calibrationStatus !== "loading"/);
  assert.match(gameEmbed, /studentCopy\.game\.syncAgain/);
  assert.match(gameEmbed, /studentCopy\.game\.resultSyncFailed/);
});

test("the demo game keeps calibration and completion state local instead of calling private player APIs", () => {
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");

  assert.match(gameEmbed, /const isDemoMode = navBasePath\.startsWith\("\/demo\/"\)/);
  assert.match(gameEmbed, /if \(isDemoMode\) \{[\s\S]{0,700}demoCalibrationStorageKey[\s\S]{0,700}setCalibrationStatus/);
  assert.match(gameEmbed, /if \(!isDemoMode && launchAttemptId\)/);
  assert.match(gameEmbed, /if \(isDemoMode\) \{[\s\S]{0,500}setCompletedRun/);
  assert.match(gameEmbed, /if \(isDemoMode \|\| !pendingOutcome\) return;/);
});

test("demo calibration stores a structured offset and protocol record", () => {
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");
  assert.match(gameEmbed, /JSON\.stringify\([\s\S]{0,240}offsetMs/);
  assert.match(gameEmbed, /parseCalibrationState/);
  assert.match(gameEmbed, /calibrationOffsetMs/);
});

test("song choice does not present a package that is still loading as ready", () => {
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");

  assert.match(songChoice, /selectionStatusById/);
  assert.match(songChoice, /selectedSongStatus === "loading"/);
  assert.match(songChoice, /selectedSongStatus === "error"/);
  assert.match(songChoice, /studentCopy\.songChoice\.preparing/);
  assert.match(songChoice, /Try again/);
});

test("demo song choice defaults to the published Early Algebra catalogue", () => {
  const demoSongChoice = source("app/demo/student/song-choice/page.tsx");

  assert.match(demoSongChoice, /getSongChoices\(activityParam \?\? "early-algebra"\)/);
});

test("builder readiness reflects song, publish, and play prerequisites", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const panel = source("app/student/lesson-builder/EncounterReadinessPanel.tsx");

  assert.match(builder, /canPublish=\{Boolean\(selectedSongStorage\) && isLessonLoaded && !loadError && lessonPublishReadiness\.ready\}/);
  assert.match(builder, /hasSong=\{Boolean\(selectedSongStorage \|\| selectedSongLaunch\)\}/);
  assert.match(panel, /studentCopy\.editor\.pickSongBeforePlay/);
  assert.match(panel, /studentCopy\.editor\.gameFilesPreparing/);
});

test("the unauthenticated demo keeps its recovery draft local and does not call private workspace sync", () => {
  const demoPage = source("app/demo/student/lesson-builder/page.tsx");
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(demoPage, /enableWorkspaceSync=\{false\}/);
  assert.match(builder, /const canSyncWorkspace = enableWorkspaceSync && !isDemoMode;/);
  assert.match(builder, /if \(!canSyncWorkspace\) \{[\s\S]{0,900}readPlayerLessonWorkspaceDraft/);
  assert.match(builder, /writePlayerLessonWorkspaceDraft\([\s\S]{0,900}if \(!canSyncWorkspace\)/);
});

test("a ready lesson does not reserve a permanent readiness panel", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /const needsReadinessCheck = !lessonPublishReadiness\.ready/);
  assert.match(builder, /needsReadinessCheck && !isGuidedStart/);
});

test("hit placement uses a spatial icon grid instead of a row of location words", () => {
  const composer = source("app/student/lesson-builder/GuidedEncounterComposer.tsx");

  assert.match(composer, /NorthWestRoundedIcon/);
  assert.match(composer, /SouthEastRoundedIcon/);
  assert.match(composer, /gridTemplateColumns: "repeat\(3, 42px\)"/);
  assert.match(composer, /title=\{label\}/);
  assert.match(composer, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
});

test("guided editing waits until the player chooses an editing action", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const guidedStart = source("app/student/lesson-builder/GuidedTemplateStart.tsx");

  assert.match(builder, /const \[tutorialStep, setTutorialStep\][\s\S]*?= useState<[^>]+>\(null\)/);
  assert.match(builder, /setTutorialStep\(isDemoMode \? "welcome" : null\)/);
  assert.match(guidedStart, /Play this lesson/);
  assert.match(guidedStart, /Add an equation/);
  assert.match(guidedStart, /Encounter/);
  assert.match(guidedStart, /encounter group/);
  assert.match(guidedStart, /game action/);
  assert.match(builder, /actionCount=\{timelineEvents\.reduce/);
  assert.match(guidedStart, /A Hit, Spin, or Drag is an action you set inside an encounter\./);
  assert.match(guidedStart, /After these encounters, the game can use its own questions if it needs more\./);
});

test("player-facing equation actions explain what happens to the lesson", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /Hide from my lesson/);
  assert.match(builder, /Show again:/);
  assert.match(builder, /studentCopy\.editor\.useEquationForGroup/);
  assert.match(builder, /Assign to every move in this encounter/);
  assert.match(builder, /Every move in \$\{studentCopy\.editor\.moveGroup/);
  assert.match(builder, /Encounter \(timed\)/);
  assert.match(builder, /Each Hit, Spin, or Drag becomes its own move in the game when you save\./);
  assert.match(builder, /studentCopy\.editor\.saveEquation/);
  assert.match(builder, /Added your equation to this lesson\./);
  assert.match(builder, /Loaded \$\{authoredDraft\.encounters\.length\} move/);
  assert.doesNotMatch(builder, /Unity encounter/);
  assert.doesNotMatch(builder, /Last action/);
  assert.doesNotMatch(builder, /Changes are only used in Unity after you publish\./);
  assert.doesNotMatch(builder, /Equation added to Event/);
  assert.doesNotMatch(builder, /Hide source from my version/);
  assert.doesNotMatch(builder, /Use in this encounter/);
});

test("publish failures distinguish browser recovery from the Unity version", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /studentCopy\.editor\.lessonSaveFailed/);
  assert.match(builder, /A backup stays in this browser\./);
  assert.match(builder, /if \(!response\.ok\) \{[\s\S]*setWorkspaceStatus\("offline"\)/);
});
