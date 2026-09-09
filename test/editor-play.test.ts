import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { Children, isValidElement } from "react";

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
    const buttons: any[] = [];
    function visit(value: any) {
      Children.forEach(value, child => {
        if (!isValidElement<{children?: any}>(child)) return;
        if (child.type === "button") buttons.push(child);
        visit(child.props.children);
      });
    }
    visit(tree);
    const play = buttons.find(button => button.props.children === "Play");
    assert.ok(play, "Play must be visible beside Save");
    assert.equal(play.props.disabled, disabled);
    if (!disabled) play.props.onClick();
  }
  assert.equal(launches, 1);
});

for (const saveFails of [false, true]) test(`launch uses save response identity; saveFails=${saveFails}`, async () => {
  const requests: any[] = [];
  const routes: string[] = [];
  const launch = load("handleLaunchGame", {
    selectedSongLaunch: {songAssetId: "song", activityKey: "early-algebra", authorName: "dev"},
    lastSavedAuthorId: "old-author", lastSavedRevision: "old-revision", isSaving: false,
    handleSaveToSupabase: async () => saveFails ? false : {authorId: "saved-author", revision: "new-revision"},
    requestFreshSongLaunchPackage: async (request: any) => {
      requests.push(request);
      return {songAssetId: "song", activityKey: "early-algebra", chart: {signedUrl: "chart"},
        sidecar: {signedUrl: "sidecar"}, audio: {signedUrl: "audio"}, ...request};
    },
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/demo/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    persistLaunchParams: () => {}, router: {push: (route: string) => routes.push(route)}, setSaveStatus: () => {},
  });
  await launch();
  assert.equal(requests.length, saveFails ? 0 : 1);
  assert.equal(routes.length, saveFails ? 0 : 1);
  if (!saveFails) {
    assert.equal(requests[0].revision, "new-revision");
    assert.equal(requests[0].authorId, "saved-author");
  }
});
