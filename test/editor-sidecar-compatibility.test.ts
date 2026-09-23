import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import {
  LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION,
  resolveAuthoredHitPadSlot,
} from "../lib/authored-hit-pad-layout";
import { repairLegacyMigratedAuthoredLesson } from "../lib/legacy-authored-migration";
import { isLegacyEncounterSidecar, validateLegacyEncounters } from "../lib/legacy-encounters";

// Execute the editor's actual pure normalizer without booting Next/React.
const source = readFileSync(new URL("../app/student/lesson-builder/LessonBuilderClient.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["isObject", "normalizeTick", "normalizeMechanic", "normalizeTokenIndex", "normalizeHitBubblePad", "normalizeHitBubblePlacements", "normalizeTokenTargets", "normalizeSidecar", "sortEvents", "mergeTimelineSidecarSources"]);
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text));
const code = ts.transpileModule(functions.map(node => node.getText(ast)).join("\n"), {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
const context = vm.createContext({emptySidecar: {version: 1, events: []}, parseAuthoredLessonDraft, repairLegacyMigratedAuthoredLesson, isLegacyEncounterSidecar, validateLegacyEncounters, LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION, resolveAuthoredHitPadSlot,
  sidecarFromChartFile: () => { throw new Error("Authoritative sidecars must not be replaced with chart-derived events"); },
});
vm.runInContext(code, context);
const normalize = (value: unknown) => JSON.parse(JSON.stringify(context.normalizeSidecar(value)));

test("editor normalizer preserves catalogue encounters including same-tick entries", () => {
  const raw = {version: 1, encounters: [
    {tick: 6241, equationId: "eq-a", mechanic: "SingleHitUnlockThenTimedDrag", expectedSolveSeconds: 9.55},
    {tick: 6241, equationId: "eq-b", mechanic: "MultiHitUnlock", hits: 2},
  ]};
  const normalized = normalize(raw);
  assert.equal(normalized.events.length, 2);
  assert.deepEqual(normalized.legacySource, raw);
  assert.deepEqual(normalize(normalized), normalized);
});

test("authored v3 survives normalization with its original IDs and orphan equations", () => {
  const raw = {version: 3, mode: "authored", songAssetId: "song", activityKey: "early-algebra", equations: [{id: "orphan", state: "x+1=2"}], encounters: []};
  assert.deepEqual(normalize(raw).authoredSource, parseAuthoredLessonDraft(raw));
  assert.deepEqual(normalize(normalize(raw)).authoredSource, parseAuthoredLessonDraft(raw));
});

test("editor normalizer rehydrates historical legacy-migrated operator targets", () => {
  const raw = {version: 3, mode: "authored", songAssetId: "song", activityKey: "early-algebra", equations: [{id: "eq", state: "6x+5=35"}], encounters: [{id: "legacy-0-hit", eventId: "legacy-0", type: "hit", equationId: "eq", startTick: 0, endTick: 0, hitBubbles: [{tokenIndex: 1, pads: ["topLeft"], positions: ["topLeft"]}]}]};
  const normalized = normalize(raw);
  assert.equal(normalized.authoredSource.encounters[0].hitBubbles[0].tokenIndex, 2);
});

test("empty saved sidecar stays empty instead of resurrecting deleted chart events", () => {
  const result = context.mergeTimelineSidecarSources({version: 1, events: []}, "chart content");
  assert.equal(result.events.length, 0);
});
