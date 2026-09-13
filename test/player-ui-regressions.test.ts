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
  assert.match(gameEmbed, /Preparing your game files/);
});

test("guided editing waits until the player chooses an editing action", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const guidedStart = source("app/student/lesson-builder/GuidedTemplateStart.tsx");

  assert.match(builder, /const \[tutorialStep, setTutorialStep\][\s\S]*?= useState<[^>]+>\(null\)/);
  assert.match(builder, /setTutorialStep\(isDemoMode \? "welcome" : null\)/);
  assert.match(guidedStart, /Play the lesson as-is/);
  assert.match(guidedStart, /Make an equation/);
  assert.match(guidedStart, /An event is a timed moment in the song\. Each part inside it is an encounter Unity plays\./);
  assert.match(guidedStart, /After these authored encounters, Unity can continue with its built-in equation bank if the run needs more questions\./);
});

test("player-facing equation actions explain what happens to the lesson", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /Hide from my lesson/);
  assert.match(builder, /Show again:/);
  assert.match(builder, /Use this equation for every move in/);
  assert.match(builder, /Assign to every move in this event/);
  assert.match(builder, /Every move in Event/);
  assert.match(builder, /Event \(timed group\)/);
  assert.match(builder, /Each hit, spin, or drag becomes a separate Unity encounter when you publish\./);
  assert.match(builder, /Last action/);
  assert.match(builder, /Changes are only used in Unity after you publish\./);
  assert.match(builder, /Added your equation to this draft\./);
  assert.match(builder, /Unity encounter\$\{authoredDraft\.encounters\.length === 1 \? "" : "s"\} across/);
  assert.match(builder, /from this chart\./);
  assert.doesNotMatch(builder, /Equation added to Event/);
  assert.doesNotMatch(builder, /Hide source from my version/);
  assert.doesNotMatch(builder, /Use in this encounter/);
});

test("publish failures distinguish browser recovery from the Unity version", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.doesNotMatch(builder, /Your changes are saved on this device/);
  assert.match(builder, /Could not publish this lesson\. Unity is still using the last published version\./);
  assert.match(builder, /A recovery copy stays in this browser\./);
  assert.match(builder, /if \(!response\.ok\) \{[\s\S]*setWorkspaceStatus\("offline"\)/);
});
