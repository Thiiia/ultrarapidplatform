import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const tokens = readFileSync(new URL("../app/experience/experience-tokens.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const primitives = readFileSync(new URL("../app/experience/experience-primitives.css", import.meta.url), "utf8");
const studentShell = readFileSync(new URL("../app/student/StudentSubpageShell.tsx", import.meta.url), "utf8");
const teacherShell = readFileSync(new URL("../app/teacher/TeacherSubpageShell.tsx", import.meta.url), "utf8");
const rosterImport = readFileSync(new URL("../app/admin/schools/[schoolId]/roster-import/RosterImportClient.tsx", import.meta.url), "utf8");
const songChoice = readFileSync(new URL("../app/student/song-choice/SongChoiceClient.tsx", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("../app/components/ExperienceMobileNavigation.tsx", import.meta.url), "utf8");
const gameEmbed = readFileSync(new URL("../app/student/game/GameEmbedPage.tsx", import.meta.url), "utf8");

test("copied platform tokens match the pinned contract version and SHA-256 hashes", () => {
  const manifest = JSON.parse(readFileSync(new URL("../app/experience/contract-version.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "ultrarapid.experience");
  assert.equal(manifest.version, "1.1.0");
  for (const [contractPath, localPath] of [
    ["dist/web/experience-tokens.css", "../app/experience/experience-tokens.css"],
    ["dist/web/experience-tokens.ts", "../app/experience/experience-tokens.ts"],
  ]) {
    const contents = readFileSync(new URL(localPath, import.meta.url), "utf8");
    const hash = createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
    assert.equal(manifest.generatedFiles[contractPath], hash, `${contractPath} matches the pinned hash`);
  }
});

test("platform shell consumes the shared dark palette and interface type token", () => {
  assert.ok(rootLayout.includes('import "./globals.css";'));
  assert.ok(globalCss.includes('@import "./experience/experience-tokens.css";'));
  assert.ok(globalCss.includes("var(--ur-font-interface)"));
  assert.ok(tokens.includes("--ur-accent-lime: #CFFF04;"));
  assert.ok(tokens.includes("--color-background: #030E14;"));
});

test("platform controls expose keyboard focus, 44px targets, and reduced motion", () => {
  assert.ok(/:focus-visible/.test(globalCss));
  assert.ok(/min-height:\s*var\(--ur-target-minimum-web\)/.test(globalCss));
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(globalCss));
});

test("shared experience primitives expose semantic states for every common control", () => {
  for (const component of ["button", "field", "card", "status", "dialog", "progress", "navigation"]) {
    assert.ok(primitives.includes(`.experience-${component}`), `missing ${component} primitive`);
  }
  assert.match(primitives, /\.experience-button:disabled/);
  assert.match(primitives, /\.experience-field\[aria-invalid="true"\]/);
  assert.match(primitives, /\.experience-card\[data-state="error"\]/);
  assert.match(primitives, /\.experience-status\[data-status="success"\]/);
  assert.match(primitives, /\.experience-dialog::backdrop/);
  assert.match(primitives, /accent-color:\s*var\(--ur-accent-lime\)/);
  assert.match(primitives, /\.experience-navigation a\[aria-current="page"\]/);
});

test("student and teacher shells mark active navigation and consume the generated foundation", () => {
  for (const [role, shell] of [["student", studentShell], ["teacher", teacherShell]] as const) {
    assert.ok(shell.includes(`data-experience-role="${role}"`));
    assert.ok(shell.includes('className="experience-navigation'));
    assert.ok(shell.includes("aria-current={isActive ? \"page\" : undefined}"));
    assert.ok(shell.includes("<ExperienceMobileNavigation items={mobileItems}"));
    assert.ok(shell.includes("var(--ur-canvas-top)"));
    assert.ok(shell.includes("var(--ur-canvas-deep)"));
  }
});

test("role navigation collapses to an accessible menu at phone and tablet widths", () => {
  assert.match(primitives, /\.experience-mobile-navigation\s*\{\s*display:\s*none/);
  assert.match(primitives, /@media \(max-width:\s*860px\)[\s\S]*\.experience-desktop-navigation,[\s\S]*\.experience-role-utilities/);
  assert.match(primitives, /\.experience-mobile-navigation\s*\{\s*display:\s*block/);
  assert.match(primitives, /\.experience-mobile-navigation:not\(\[open\]\)\s*>\s*\.experience-mobile-navigation__links\s*\{\s*display:\s*none/);
  assert.match(mobileNavigation, /<details className="experience-mobile-navigation">/);
  assert.match(mobileNavigation, /<summary className="experience-button experience-button--secondary">/);
  assert.match(mobileNavigation, /aria-current=\{item\.current \? "page" : undefined\}/);
  assert.ok(gameEmbed.includes("<ExperienceMobileNavigation items={mobileItems}"));
});

test("roster import separates preview, server-confirmed apply, and accessible errors", () => {
  assert.match(rosterImport, /disabled=\{!csvText \|\| busy\}/);
  assert.match(rosterImport, /disabled=\{!summary \|\| busy\}/);
  assert.match(rosterImport, /expectedSummary: action === "apply" \? summary : undefined/);
  assert.match(rosterImport, /setMessage\(action === "apply" \? `Import \$\{result\.importId\} completed\.` : "Preview ready\. No data has been changed\."\)/);
  assert.match(rosterImport, /setSummary\(result\.summary\)/);
  assert.match(rosterImport, /role=\{messageKind === "error" \? "alert" : "status"\}/);
  assert.match(rosterImport, /aria-live=\{messageKind === "error" \? "assertive" : "polite"\}/);
  assert.match(rosterImport, /role="region" aria-label="Roster import preview summary"/);
  assert.match(rosterImport, /role="alert" aria-live="assertive"/);
});

test("song choice keeps the dialog semantics on the shared dialog primitive", () => {
  assert.match(songChoice, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="lesson-entry-title"[\s\S]{0,1000}className="experience-dialog"/);
});
