import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { SUPPORTED_RHYTHM_DIFFICULTIES } from "../lib/chart-semantics";
import { isRhythmDifficultyActivityKey } from "../lib/number-bonds-sidecar";
import { getLearnerFacingError, studentCopy } from "../lib/student-copy";
import { getDemoTemplateUnavailableReadiness } from "../lib/demo-template-readiness";
import { SongLaunchRequestError } from "../lib/song-launch-client";

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
  const context = vm.createContext({
    require: createRequire(import.meta.url),
    exports: {},
    studentCopy,
    getLearnerFacingError,
    getDemoTemplateUnavailableReadiness,
    SUPPORTED_RHYTHM_DIFFICULTIES,
    isRhythmDifficultyActivityKey,
    numberBondsRhythmDifficulty: "ExpertSingle",
    selectedSongStorage: null,
    lessonReadiness: null,
    demoLaunchInFlightRef: {current: false},
    setDemoLaunchPhase: () => {},
    ...globals,
  });
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

test("demo header clearly launches the ready lesson and passes the template-only intent", () => {
  const header = load("HeaderBar", {headerBackgroundColor: "black", headerHeight: 64,
    subtleBorderColor: "gray", panelBackgroundColor: "black", pagePanelWidth: "100%",
    algebraStyles: {header: "", headerActionButton: ""}, URIcon: () => null});
  let launchTemplateOnly: boolean | undefined;
  const tree = header({isDemoMode: true, isAlgebraStudio: true, canLaunch: true, isSaving: false,
    onLaunch: (playTemplateOnly?: boolean) => { launchTemplateOnly = playTemplateOnly; },
    selectedActivityKey: "early-algebra"});
  const buttons: Array<ReactElement<{
    children?: ReactNode;
    "aria-label"?: string;
    title?: string;
    onClick?: () => void;
  }>> = [];
  function visit(value: ReactNode) {
    Children.forEach(value, child => {
      if (!isValidElement<{children?: ReactNode; "aria-label"?: string; title?: string; onClick?: () => void}>(child)) return;
      if (child.type === "button") buttons.push(child);
      visit(child.props.children);
    });
  }
  visit(tree as ReactNode);
  const play = buttons.find(button => button.props.children === studentCopy.editor.demoPlayLessonLabel);
  assert.ok(play);
  assert.equal(play.props["aria-label"], studentCopy.editor.demoPlayLessonAriaLabel);
  assert.equal(play.props.title, studentCopy.editor.demoPlayLessonTitle);
  play.props.onClick?.();
  assert.equal(launchTemplateOnly, true);
});

test("an unavailable demo lesson offers a route back to song choice", () => {
  const header = load("HeaderBar", {headerBackgroundColor: "black", headerHeight: 64,
    subtleBorderColor: "gray", panelBackgroundColor: "black", pagePanelWidth: "100%",
    algebraStyles: {header: "", headerActionButton: ""}, URIcon: () => null});
  let songChoiceOpened = false;
  let filePickerOpened = false;
  const tree = header({isDemoMode: true, isAlgebraStudio: true, canLaunch: false,
    launchUnavailableMessage: "No published lesson is ready.", isSaving: false,
    onLaunch: () => assert.fail("an unavailable lesson must not launch"),
    onChooseAnotherSong: () => { songChoiceOpened = true; },
    onOpenFile: () => { filePickerOpened = true; }, selectedActivityKey: "early-algebra"});
  const buttons: Array<ReactElement<{
    children?: ReactNode;
    "aria-label"?: string;
    onClick?: () => void;
    disabled?: boolean;
  }>> = [];
  function visit(value: ReactNode) {
    Children.forEach(value, child => {
      if (!isValidElement<{
        children?: ReactNode;
        "aria-label"?: string;
        onClick?: () => void;
        disabled?: boolean;
      }>(child)) return;
      if (child.type === "button") buttons.push(child);
      visit(child.props.children);
    });
  }
  visit(tree as ReactNode);
  const recovery = buttons.find(button => Children.toArray(button.props.children).includes("Choose song"));
  const play = buttons.find(button => button.props.children === "Unavailable");
  assert.ok(recovery);
  assert.ok(play);
  assert.equal(play.props.disabled, true);
  assert.match(play.props["aria-label"] ?? "", /Lesson unavailable for the selected song and difficulty/);
  recovery.props.onClick?.();
  assert.equal(songChoiceOpened, true);
  assert.equal(filePickerOpened, false);
});

for (const localSaveSucceeds of [true, false]) {
  test(`missing demo revision saves device edits truthfully before showing recovery; save=${localSaveSucceeds}`, async () => {
    const events: string[] = [];
    const readinessUpdates: Array<{canLaunch: boolean; state: string; message: string}> = [];
    let status = "";
    const launch = load("handleLaunchGame", {
      isNumberBondsActivity: false,
      isDemoMode: true,
      selectedSongLaunch: {songAssetId: "garden", activityKey: "early-algebra", rhythmDifficultyKey: "ExpertSingle"},
      selectedSongStorage: {sidecar: null},
      metadata: {songTitle: "Garden"},
      selectedSongAuthorId: "demo-author", lastSavedAuthorId: null, lastSavedRevision: null,
      isSaving: false, hasUnsavedChanges: true,
      lessonPublishReadiness: {ready: true, blockers: []},
      handleSaveToSupabase: async () => { events.push("save-device-draft"); return localSaveSucceeds; },
      requestSongLaunchReadiness: async () => {
        throw new SongLaunchRequestError("revision missing", "REVISION_NOT_FOUND", 404);
      },
      navBasePath: "/demo/student",
      setLessonReadiness: (value: {canLaunch: boolean; state: string; message: string}) => {
        events.push("readiness");
        readinessUpdates.push(value);
      },
      setSaveStatus: (value: string) => { events.push("status"); status = value; },
      loadedSongReadyRef: {current: true},
    });

    await launch(true);

    assert.deepEqual(events, ["save-device-draft", "readiness", "status"]);
    assert.equal(readinessUpdates.at(-1)?.canLaunch, false);
    assert.match(status, /No published lesson is ready for Garden at Expert/);
    assert.match(status, localSaveSucceeds
      ? /saved on this device only; they have not been published/i
      : /could not be saved\. Keep this page open/i);
  });
}

for (const saveFails of [false, true]) test(`student launch previews its saved personal draft only when save succeeds; saveFails=${saveFails}`, async () => {
  const requests: Array<Record<string, unknown>> = [];
  const routes: string[] = [];
  const launch = load("handleLaunchGame", {
    isNumberBondsActivity: false,
    isDemoMode: false,
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
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    getPlayerLaunchRoute: (basePath: string) => `${basePath}/game`,
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

test("launches a ready template at the selected difficulty without asking it to save again", async () => {
  const requests: Array<Record<string, unknown>> = [];
  let saves = 0;
  const launch = load("handleLaunchGame", {
    isNumberBondsActivity: false,
    isDemoMode: false,
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
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    getPlayerLaunchRoute: (basePath: string) => `${basePath}/game`,
    persistLaunchParams: () => {}, router: {push: () => {}}, setSaveStatus: () => {},
    setLessonReadiness: () => {}, loadedSongReadyRef: {current: true},
  });
  await launch();
  assert.equal(saves, 0);
  assert.equal(requests[0].authorId, "template-author");
  assert.equal(requests[0].rhythmDifficultyKey, "ExpertSingle");
  assert.equal(requests[0].revision, null, "the server resolves the ready revision for the selected difficulty");
});

test("demo ready-lesson launch bypasses device edits and routes the published template", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const routes: string[] = [];
  let saves = 0;
  const launch = load("handleLaunchGame", {
    isNumberBondsActivity: false,
    isDemoMode: true,
    selectedSongLaunch: {songAssetId: "song", activityKey: "early-algebra", authorName: "dev"},
    selectedSongAuthorId: "template-author", lastSavedAuthorId: null, lastSavedRevision: null,
    isSaving: false, hasUnsavedChanges: true,
    lessonPublishReadiness: {ready: false, blockers: []},
    requestSongLaunchReadiness: async () => ({canLaunch: true, state: "ready", message: ""}),
    handleSaveToSupabase: async () => { saves += 1; return false; },
    requestFreshSongLaunchPackage: async (request: Record<string, unknown>) => {
      requests.push(request);
      return {songAssetId: "song", activityKey: "early-algebra", authorId: "template-author",
        revision: "ready-revision", chart: {signedUrl: "chart"}, sidecar: {signedUrl: "sidecar"},
        audio: {signedUrl: "audio"}, readiness: {canLaunch: true, state: "ready", message: ""}, ...request};
    },
    createSongLaunchSearchParams: () => new URLSearchParams(), navBasePath: "/demo/student",
    buildEmbeddedGameUrl: () => "game", process: {env: {}}, appendSongFlowDebug: () => {},
    getPlayerLaunchRoute: (basePath: string) => `${basePath}/game`,
    persistLaunchParams: () => {}, router: {push: (route: string) => routes.push(route)}, setSaveStatus: () => {},
    setLessonReadiness: () => {}, loadedSongReadyRef: {current: true},
  });
  await launch(true);
  assert.equal(saves, 0, "demo-only edits must not be published as an official lesson");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].authorId, "template-author");
  assert.equal(requests[0].revision, null, "the server resolves the ready revision for the selected template");
  assert.equal(requests[0].allowDraftPreview, false);
  assert.deepEqual(routes, ["/demo/student/game"]);
});

test("incomplete demo lesson saves locally but never calls server publish", async () => {
  let publishRequests = 0;
  let saveStatus = "";
  const publish = load("handlePublishChanges", {
    navBasePath: "/demo/student",
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
  assert.equal(result, true, "a successful local draft save is reported as successful");
  assert.equal(publishRequests, 0);
  assert.match(saveStatus, /Spin 1 needs a target/);
});

test("Number Bonds Play rebuilds an incomplete mission without requesting a launch package", async () => {
  let rebuilds = 0;
  let requests = 0;
  const launch = load("handleLaunchGame", {
    isNumberBondsActivity: true,
    isSaving: false,
    lessonPublishReadiness: {ready: false, blockers: []},
    numberBondValues: {whole: 5},
    numberBondTargetWhole: 5,
    handleBuildNumberBondMission: (autoLaunch: boolean) => {
      assert.equal(autoLaunch, true);
      rebuilds += 1;
    },
    requestFreshSongLaunchPackage: async () => { requests += 1; return null; },
  });
  await launch();
  assert.equal(rebuilds, 1);
  assert.equal(requests, 0);
});

test("Play skips package request while blockers exist", async () => {
  let requests = 0;
  const launch = load("handleLaunchGame", {
    isNumberBondsActivity: false,
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
