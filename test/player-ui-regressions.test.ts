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

test("guided editing waits until the player chooses an editing action", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");
  const guidedStart = source("app/student/lesson-builder/GuidedTemplateStart.tsx");

  assert.match(builder, /const \[tutorialStep, setTutorialStep\][\s\S]*?= useState<[^>]+>\(null\)/);
  assert.match(builder, /setTutorialStep\(isDemoMode \? "welcome" : null\)/);
  assert.match(guidedStart, /Play the lesson as-is/);
  assert.match(guidedStart, /Make an equation/);
});

test("player-facing equation actions explain what happens to the lesson", () => {
  const builder = source("app/student/lesson-builder/LessonBuilderClient.tsx");

  assert.match(builder, /Hide from my lesson/);
  assert.match(builder, /Show this equation again/);
  assert.match(builder, /Save and use in/);
  assert.doesNotMatch(builder, /Hide source from my version/);
});
