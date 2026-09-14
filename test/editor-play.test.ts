import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

const source = readFileSync(new URL("../app/student/lesson-builder/LessonBuilderClient.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function load(name: string, globals: Record<string, unknown>) {
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found);
  const code = ts.transpileModule(found.getText(ast), {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const context = vm.createContext({require: createRequire(import.meta.url), exports: {}, ...globals});
  vm.runInContext(code, context);
  return context[name];
}

test("header exposes Play wired to launch, disabled during save or without a song", () => {
  const header = load("HeaderBar", {headerBackgroundColor: "black", headerHeight: 64,
    subtleBorderColor: "gray", panelBackgroundColor: "black", pagePanelWidth: "100%", URIcon: () => null});
  let launches = 0;
  for (const [canLaunch, isSaving, disabled] of [[true, false, false], [false, false, true], [true, true, true]]) {
    const tree = header({canLaunch, isSaving, onLaunch: () => launches++, selectedActivityKey: "early-algebra"});
    const buttons: Array<ReactElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>> = [];
    function visit(value: ReactNode) {
      Children.forEach(value, child => {
        if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(child)) return;
        if (child.type === "button") buttons.push(child);
        visit(child.props.children);
      });
    }
    visit(tree as ReactNode);
    const play = buttons.find(button => button.props.children === "Play");
    assert.ok(play, "Play must be visible beside Save");
    assert.equal(play.props.disabled, disabled);
    if (!disabled) play.props.onClick?.();
  }
  assert.equal(launches, 1);
});

for (const saveFails of [false, true]) test(`launch publishes a draft only when publication succeeds; saveFails=${saveFails}`, async () => {
  const requests: Array<Record<string, unknown>> = [];
  const routes: string[] = [];
  const launch = load("handleLaunchGame", {
    selectedSongLaunch: {songAssetId: "song", activityKey: "early-algebra", authorName: "dev"},
    lastSavedAuthorId: "old-author", lastSavedRevision: "old-revision", isSaving: false, hasUnsavedChanges: true,
    lessonPublishReadiness: {ready: true, blockers: []},
    handleSaveToSupabase: async () => saveFails ? false : {authorId: "saved-author", revision: "new-revision"},
    lessonLaunchStrategy: (hasUnsavedChanges: boolean) => hasUnsavedChanges ? "publish-draft" : "published-template",
    requestFreshSongLaunchPackage: async (request: Record<string, unknown>) => {
      requests.push(request);
      return {songAssetId: "song", activityKey: "early-algebra", chart: {signedUrl: "chart"},
        sidecar: {signedUrl: "sidecar"}, audio: {signedUrl: "audio"}, readiness: {canLaunch: true, state: "ready", message: ""}, ...request};
    },
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/demo/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    persistLaunchParams: () => {}, router: {push: (route: string) => routes.push(route)}, setSaveStatus: () => {},
    setLessonReadiness: () => {}, loadedSongReadyRef: {current: true},
  });
  await launch();
  if (!saveFails) {
    assert.equal(requests.length, 1);
    assert.equal(routes.length, 1);
    assert.equal(requests[0].revision, "new-revision");
    assert.equal(requests[0].authorId, "saved-author");
  } else {
    assert.equal(requests.length, 0);
    assert.equal(routes.length, 0);
  }
});

test("launches a published template without asking it to save again", async () => {
  const requests: Array<Record<string, unknown>> = [];
  let saves = 0;
  const launch = load("handleLaunchGame", {
    selectedSongLaunch: {songAssetId: "song", activityKey: "early-algebra", authorName: "dev"},
    selectedSongAuthorId: "template-author", lastSavedAuthorId: null, lastSavedRevision: "template-revision",
    isSaving: false, hasUnsavedChanges: false,
    lessonPublishReadiness: {ready: true, blockers: []},
    handleSaveToSupabase: async () => { saves += 1; return false; },
    lessonLaunchStrategy: (hasUnsavedChanges: boolean) => hasUnsavedChanges ? "publish-draft" : "published-template",
    requestFreshSongLaunchPackage: async (request: Record<string, unknown>) => {
      requests.push(request);
      return {songAssetId: "song", activityKey: "early-algebra", chart: {signedUrl: "chart"}, sidecar: {signedUrl: "sidecar"}, audio: {signedUrl: "audio"}, readiness: {canLaunch: true, state: "ready", message: ""}, ...request};
    },
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/demo/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    persistLaunchParams: () => {}, router: {push: () => {}}, setSaveStatus: () => {},
    setLessonReadiness: () => {}, loadedSongReadyRef: {current: true},
  });
  await launch();
  assert.equal(saves, 0);
  assert.equal(requests[0].authorId, "template-author");
  assert.equal(requests[0].revision, "template-revision");
});

test("incomplete lesson saves locally but never calls publish", async () => {
  let publishRequests = 0;
  let saveStatus = "";
  const publish = load("handlePublishChanges", {
    lessonPublishReadiness: {
      ready: false,
      blockers: [{ encounterId: "spin-1", code: "spin_target_required", message: "Spin 1 needs a target.", nextAction: "Select the token to spin." }],
    },
    savePrivateDraft: () => true,
    handleSelectReadinessEncounter: () => undefined,
    setSaveStatus: (value: string) => { saveStatus = value; },
    handleSaveToSupabase: async () => { publishRequests += 1; return false; },
  });
  const result = await publish({});
  assert.equal(result, false);
  assert.equal(publishRequests, 0);
  assert.match(saveStatus, /Spin 1 needs a target/);
});

test("Play skips package request while blockers exist", async () => {
  let requests = 0;
  const launch = load("handleLaunchGame", {
    lessonPublishReadiness: {
      ready: false,
      blockers: [{ encounterId: "spin-1", code: "spin_target_required", message: "Spin 1 needs a target.", nextAction: "Select the token to spin." }],
    },
    isSaving: false,
    savePrivateDraft: () => true,
    handleSelectReadinessEncounter: () => undefined,
    setSaveStatus: () => undefined,
    selectedSongLaunch: {songAssetId: "song", activityKey: "early-algebra"},
    requestFreshSongLaunchPackage: async () => { requests += 1; return null; },
  });
  await launch();
  assert.equal(requests, 0);
});
