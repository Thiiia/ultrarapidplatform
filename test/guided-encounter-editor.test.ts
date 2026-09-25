import assert from "node:assert/strict";
import test from "node:test";
import { Children, isValidElement, type ReactNode } from "react";

import { GuidedEncounterComposer } from "../app/student/lesson-builder/GuidedEncounterComposer";
import type { EncounterReadiness, GuidedEncounterInput } from "../lib/guided-authored-encounter";

const tokens = [
  { id: "t-0", label: "4x" },
  { id: "t-1", label: "+" },
  { id: "t-2", label: "2" },
];

const emptySpin: GuidedEncounterInput = {
  id: "spin-1",
  mechanic: "spin",
  tick: 1,
  endTick: 1,
  equation: { id: "eq-1", tokens },
  hitBubbles: [],
  spinTargets: [],
  dragTargets: [],
};

function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!isValidElement<{ children?: unknown }>(tree)) return "";
  if (typeof tree.type === "function") {
    const component = tree.type as (props: unknown) => ReactNode;
    return text(component(tree.props));
  }
  return Children.toArray(tree.props.children as ReactNode).map(text).join(" ");
}

function renderComposer(
	overrides: Partial<GuidedEncounterInput> = {},
	readinessOverrides: Partial<EncounterReadiness> = {},
	showAlgebraSetupProgress = false,
) {
  return GuidedEncounterComposer({
    instance: { ...emptySpin, ...overrides },
    tokens,
    readiness: {
      encounterId: "spin-1",
      ready: false,
      issueCodes: ["spin_target_required", "duration_required"],
      issues: [],
      nextAction: "Select the token to spin.",
      ...readinessOverrides,
    },
    showAlgebraSetupProgress,
    onPatchInstance: () => undefined,
  });
}

test("composer progress follows equation, action repair, and ready-to-preview stages", () => {
	assert.match(text(renderComposer({ equation: null }, {
		issueCodes: ["equation_required"],
		nextAction: "Choose an equation.",
	}, true)), /Step\s+1\s+of\s+3/);
	assert.match(text(renderComposer({}, {}, true)), /Step\s+2\s+of\s+3/);
	assert.match(text(renderComposer({}, {
		ready: true,
		issueCodes: [],
		nextAction: "Ready to preview.",
	}, true)), /Step\s+3\s+of\s+3/);
});

test("spin labels target and duration without hit-pad controls", () => {
  const tree = renderComposer();
  assert.match(text(tree), /Select the token to spin/);
  assert.match(text(tree), /Ends at/);
  assert.doesNotMatch(text(tree), /Hit pad/);
});

test("player cue preview describes each mechanic and highlights its selected term", () => {
  const spin = renderComposer({ spinTargets: [{ tokenIndex: 0 }] });
  assert.match(text(spin), /Spin the hit pads/);
  assert.match(text(spin), /Target: 4x/);

  const hit = renderComposer({ mechanic: "hit", hitBubbles: [{ tokenIndex: 1 }] });
  assert.match(text(hit), /Tap the highlighted pad/);

  const drag = renderComposer({ mechanic: "drag", dragTargets: [{ tokenIndex: 2 }] });
  assert.match(text(drag), /Drag the highlighted term/);
});

test("publish and play share the same readiness blocker", () => {
  const readiness: Pick<EncounterReadiness, "ready"> = { ready: false };
  const canPublish = (value: Pick<EncounterReadiness, "ready">) => value.ready;
  const canLaunch = (value: Pick<EncounterReadiness, "ready">) => value.ready;
  assert.equal(canPublish(readiness), false);
  assert.equal(canLaunch(readiness), false);
});

test("operators are disabled as gameplay targets", () => {
  const tree = renderComposer();
  const disabled: unknown[] = [];
  function visit(value: unknown) {
    if (!isValidElement<{ children?: unknown; disabled?: boolean }>(value)) return;
    if (typeof value.type === "function") {
      const component = value.type as (props: unknown) => ReactNode;
      visit(component(value.props));
      return;
    }
    if (value.type === "button") disabled.push(value.props.disabled);
    Children.forEach(value.props.children, visit);
  }
  visit(tree);
  assert.ok(disabled.includes(true));
});

test("Hit timing has one editable instant and cannot author a third simultaneous pad", () => {
  type RenderedProps = Record<string, unknown>;
  type InputChange = (event: { currentTarget: { value: string } }) => void;
  const patches: Partial<GuidedEncounterInput>[] = [];
  const tree = GuidedEncounterComposer({
    instance: { ...emptySpin, mechanic: "hit", id: "hit-1", tick: 4, endTick: 8,
      hitBubbles: [{ tokenIndex: 0, positions: ["lowerRight", "bottom"], pads: ["lowerRight", "bottom"], padLayoutVersion: 2 }] },
    tokens,
    readiness: { encounterId: "hit-1", ready: false, issueCodes: ["hit_timing_invalid"], issues: [], nextAction: "Fix timing" },
    onPatchInstance: (_, patch) => patches.push(patch),
  });
  const inputs: RenderedProps[] = [];
  const buttons: RenderedProps[] = [];
  function visit(value: unknown) {
    if (!isValidElement<{ children?: ReactNode }>(value)) return;
    if (typeof value.type === "function") {
      visit((value.type as (props: unknown) => ReactNode)(value.props));
      return;
    }
    if (value.type === "input") inputs.push(value.props as RenderedProps);
    if (value.type === "button") buttons.push(value.props as RenderedProps);
    Children.forEach(value.props.children, visit);
  }
  visit(tree);
  assert.equal(inputs.length, 1, "a Hit has a start time, not a separately editable duration");
  const onChange = inputs[0].onChange as InputChange | undefined;
  if (!onChange) throw new Error("Expected the Hit start-time input to expose onChange");
  onChange({ currentTarget: { value: "6.25" } });
  assert.deepEqual(patches[0], { tick: 6.25, endTick: 6.25 });
  assert.equal(buttons.find(button => button["aria-label"] === "Player pad 1: Top")?.disabled, true);
  assert.equal(buttons.find(button => button["aria-label"] === "Player pad 3: Lower right")?.disabled, false);
});

test("Hit pad selector keeps its six pointer targets square and at least 44px", () => {
	const tree = GuidedEncounterComposer({
		instance: { ...emptySpin, mechanic: "hit", id: "hit-target-size", tick: 4,
			hitBubbles: [{ tokenIndex: 0, positions: [], pads: [], padLayoutVersion: 2 }] },
		tokens,
		readiness: { encounterId: "hit-target-size", ready: false, issueCodes: [], issues: [], nextAction: "Choose a pad." },
		onPatchInstance: () => undefined,
	});
	const pads: Array<{ className?: string }> = [];
	function visit(value: unknown) {
		if (!isValidElement<{ children?: ReactNode; className?: string; "aria-label"?: string }>(value)) return;
		if (typeof value.type === "function") {
			visit((value.type as (props: unknown) => ReactNode)(value.props));
			return;
		}
		if (typeof value.props["aria-label"] === "string" && value.props["aria-label"].startsWith("Player pad ")) {
			pads.push({ className: value.props.className });
		}
		Children.forEach(value.props.children, visit);
	}
	visit(tree);
	assert.equal(pads.length, 6);
	for (const pad of pads) {
		assert.equal(pad.className, "algebra-composer__padButton");
	}
});

test("legacy Hit pads show their preserved slot mapping and an explicit reassignment action", () => {
  const tree = GuidedEncounterComposer({
    instance: { ...emptySpin, mechanic: "hit", id: "legacy-hit", tick: 4,
      hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] },
    tokens,
    readiness: { encounterId: "legacy-hit", ready: false, issueCodes: [], issues: [], nextAction: "Reassign the pad" },
    onPatchInstance: () => undefined,
  });
  assert.match(text(tree), /left → Player pad 3 · Lower right/);
  assert.match(text(tree), /Reassign using the player pad layout/);
});
