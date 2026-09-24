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

test("embedded Unity grants fullscreen without a duplicate iframe permission", () => {
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");
  assert.match(gameEmbed, /allow="gamepad; autoplay"/);
  assert.match(gameEmbed, /allowFullScreen/);
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

test("song choice offers Play only for a ready lesson and guards the fresh launch handoff", () => {
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");

  assert.match(songChoice, /selectedSongCanPlay \? <button[\s\S]{0,240}songChoicePlayButton/);
  assert.match(songChoice, /if \(!selectedSong \|\| launchInFlightRef\.current \|\| !selectedSongCanPlay\)/);
  assert.match(songChoice, /freshPackage\.songAssetId !== selectedSong\.id/);
  assert.match(songChoice, /boundary: "song-choice-play"/);
  assert.match(songChoice, /aria-live="polite"/);
  assert.match(songChoice, /prefers-reduced-motion: reduce/);
});

test("an empty Number Bonds catalogue explains the rhythm prerequisite and offers recovery", () => {
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");

  assert.match(songChoice, /songs\.length === 0[\s\S]{0,180}No Number Bonds songs are ready yet/);
  assert.match(songChoice, /Number Bonds needs a song with a verified rhythm/);
  assert.match(songChoice, /Browse Early Algebra songs/);
  assert.match(songChoice, /setSearchQuery\(""\)/);
});

test("song choice keeps direct entry activity-bound and makes previews interactive", () => {
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");

  assert.match(songChoice, /const catalogueActivityKey =/);
  assert.match(songChoice, /routeActivityKey \?\? catalogueActivityKey/);
  assert.match(songChoice, /activeSelectionKeyRef/);
  assert.doesNotMatch(songChoice, /selectionTokenRef/);
  assert.match(songChoice, /handlePreview/);
  assert.match(songChoice, /aria-label=\{[\s\S]{0,220}studentCopy\.songChoice\.(pausePreview|preview)/);
  assert.match(songChoice, /previewUnavailable/);
});

test("optional landing media stays quiet without storage credentials and reports playback failures accessibly", () => {
  const storage = source("lib/storage-media.ts");
  const landingSound = source("app/LandingSoundButton.tsx");

  assert.match(storage, /export function isStorageConfigured/);
  assert.match(storage, /if \(!isStorageConfigured\(\)\) \{[\s\S]{0,120}return null;/);
  assert.doesNotMatch(landingSound, /console\.error/);
  assert.match(landingSound, /playbackError/);
  assert.match(landingSound, /aria-describedby=\{playbackError/);
});

test("the Unity web wrapper forwards launch payload updates after the runtime is ready", () => {
  const unityPlayer = source("app/components/UnityPlayer.tsx");

  assert.match(unityPlayer, /const launchPayloadRef = useRef\(launchPayload\)/);
  assert.match(unityPlayer, /\}, \[launchPayload\]\);/);
  assert.match(unityPlayer, /JSON\.stringify\(launchPayloadRef\.current\)/);
});

test("demo song choice defaults to Early Algebra while allowing Number Bonds starters", () => {
  const demoSongChoice = source("app/demo/student/song-choice/page.tsx");

  assert.match(demoSongChoice, /getSongChoicesForCreation\(activityParam \?\? "early-algebra"\)/);
});

test("a Number Bonds starter carries its verified rhythm into the builder", () => {
  const studentPage = source("app/student/song-choice/page.tsx");
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(studentPage, /getSongChoicesForCreation\(activityParam\)/);
  assert.match(songChoice, /const rhythmSource = song\.requiresRhythmSource[\s\S]{0,110}song\.rhythmSources\?\.\[0\]/);
  assert.match(songChoice, /const chart = rhythmSource\?\.chart \?\? song\.chart/);
  assert.match(builder, /setSelectedRhythmSource\(selectedSong\.rhythmSource \?\? null\)/);
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

test("hit placement mirrors the player pad layout and keeps legacy assignments explicit", () => {
  const composer = source("app/student/lesson-builder/GuidedEncounterComposer.tsx");
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(composer, /PLAYER_HEX_AUTHORED_HIT_PADS/);
  assert.match(composer, /Reassign using the player pad layout/);
  assert.match(composer, /PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION/);
  assert.match(composer, /resolvePlayerHexHitPadPixelOffset/);
  assert.doesNotMatch(composer, /gridTemplateColumns: "repeat\(3, 42px\)"/);
  assert.match(builder, /function getHitPadNumberFromPlacement[\s\S]{0,240}resolveAuthoredHitPadTarget/);
  assert.match(builder, /function getHitBubblePadStyle[\s\S]{0,240}resolveAuthoredHitPadSlot/);
  assert.match(builder, /resolvePlayerHexHitPadPixelOffset/);
  assert.match(builder, /onQuickAddHit\?\.\(pad\);[\s\S]{0,100}else\s*\{\s*onSelectHitPad\?\.\(pad\);/);
  assert.match(builder, /function handleAddHitAtPlayhead\(hitPad\?: HitBubblePad\)[\s\S]{0,120}hitPad \? \{ hitPad \}/);
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

test("Number Bonds presents one authored mechanic and explains its runtime expansion", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const composer = source("app/student/lesson-builder/GuidedEncounterComposer.tsx");

  assert.match(builder, /supportedAuthoredMechanics/);
  assert.match(builder, /isNumberBondsTimeline \? "Catch cues" : "Hits"/);
  assert.doesNotMatch(builder, /selectedActivityKey === "number-bonds"[\s\S]{0,160}onToggleRctm2Mode/);
  assert.match(composer, /Place a catch cue/);
  assert.match(composer, /catch → spinout → drag/);
});

test("advanced recorder exposes one tool at a time and makes draft commit explicit", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /const \[selectedTool, setSelectedTool\] = useState<GameplayMechanic>\("hit"\)/);
  assert.match(builder, /Start encounter/);
  assert.match(builder, /Save encounter/);
  assert.match(builder, /recorded in this encounter draft/);
  assert.match(builder, /rtcmPendingHoldRef\.current = pendingHold/);
});

test("first Number Bonds publication requires an explicit verified rhythm source", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const storage = source("lib/song-storage.ts");

  assert.match(builder, /Choose a verified rhythm/);
  assert.match(builder, /Your Number Bonds equation and catches start fresh/);
  assert.match(builder, /rhythmSource: selectedRhythmSource/);
  assert.match(storage, /preferredActivityKey === "number-bonds"/);
  assert.match(storage, /status: "ready"/);
  assert.match(storage, /source\.chartSha256 === revision\.chartSha256/);
});
