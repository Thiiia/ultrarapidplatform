import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

test("student subpage cards use a single readable column on narrow screens", () => {
  const shell = source("app/student/StudentSubpageShell.tsx");
  const styles = source("app/student/student.module.css");

  assert.ok(/className=\{styles\.subpageCardGrid\}/.test(shell), "subpage cards should use the responsive grid class");
  assert.ok(!/gridTemplateColumns:\s*"repeat\(3,/.test(shell), "the grid must not be fixed inline");

  const tabletAndPhoneRules = styles.match(
    /@media\s*\(max-width:\s*860px\)\s*\{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(tabletAndPhoneRules, "the student stylesheet should define its 860px layout breakpoint");
  assert.match(tabletAndPhoneRules, /\.subpageCardGrid/);
  assert.match(tabletAndPhoneRules, /grid-template-columns:\s*1fr/);
});

test("wide student and lesson-builder navigation switches to a compact menu before controls overlap", () => {
  const songChoice = source("app/student/song-choice/SongChoiceClient.tsx");
  const gameEmbed = source("app/student/game/GameEmbedPage.tsx");
  const experienceStyles = source("app/experience/experience-primitives.css");

  assert.ok(
    songChoice.includes("experience-role-header--wide-nav"),
    "song choice should opt into the wider navigation breakpoint",
  );
  assert.ok(
    songChoice.includes("<ExperienceMobileNavigation"),
    "song choice should expose its routes when the desktop tabs are hidden",
  );
  assert.ok(
    gameEmbed.includes("experience-role-header--wide-nav"),
    "the player header should use the same wide navigation breakpoint",
  );

  const wideNavigationRules = experienceStyles.match(
    /@media\s*\(max-width:\s*1300px\)\s*\{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(wideNavigationRules, "wide navigation should switch before its five fixed tabs exceed the header width");
  assert.match(wideNavigationRules, /experience-role-header--wide-nav/);
  assert.match(wideNavigationRules, /experience-desktop-navigation[\s\S]*?display:\s*none/);
  assert.match(wideNavigationRules, /experience-mobile-navigation[\s\S]*?display:\s*block/);
});
