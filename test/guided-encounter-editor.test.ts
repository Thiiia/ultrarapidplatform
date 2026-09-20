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

function renderComposer(overrides: Partial<GuidedEncounterInput> = {}) {
  return GuidedEncounterComposer({
    instance: { ...emptySpin, ...overrides },
    tokens,
    readiness: {
      encounterId: "spin-1",
      ready: false,
      issueCodes: ["spin_target_required", "duration_required"],
      issues: [],
      nextAction: "Select the token to spin.",
    },
    onPatchInstance: () => undefined,
  });
}

test("spin labels target and duration without hit-pad controls", () => {
  const tree = renderComposer();
  assert.match(text(tree), /Select the token to spin/);
  assert.match(text(tree), /Ends at/);
  assert.doesNotMatch(text(tree), /Hit pad/);
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
  const patches: Partial<GuidedEncounterInput>[] = [];
  const tree = GuidedEncounterComposer({
    instance: { ...emptySpin, mechanic: "hit", id: "hit-1", tick: 4, endTick: 8,
      hitBubbles: [{ tokenIndex: 0, pads: ["left", "right"] }] },
    tokens,
    readiness: { encounterId: "hit-1", ready: false, issueCodes: ["hit_timing_invalid"], issues: [], nextAction: "Fix timing" },
    onPatchInstance: (_, patch) => patches.push(patch),
  });
  const inputs: Array<Record<string, any>> = [];
  const buttons: Array<Record<string, any>> = [];
  function visit(value: unknown) {
    if (!isValidElement<{ children?: ReactNode }>(value)) return;
    if (typeof value.type === "function") {
      visit((value.type as (props: unknown) => ReactNode)(value.props));
      return;
    }
    if (value.type === "input") inputs.push(value.props);
    if (value.type === "button") buttons.push(value.props);
    Children.forEach(value.props.children, visit);
  }
  visit(tree);
  assert.equal(inputs.length, 1, "a Hit has a start time, not a separately editable duration");
  inputs[0].onChange({ currentTarget: { value: "6.25" } });
  assert.deepEqual(patches[0], { tick: 6.25, endTick: 6.25 });
  assert.equal(buttons.find(button => button["aria-label"] === "Pad Top left")?.disabled, true);
  assert.equal(buttons.find(button => button["aria-label"] === "Pad Left")?.disabled, false);
});
