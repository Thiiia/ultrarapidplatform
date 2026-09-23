import assert from "node:assert/strict";
import test from "node:test";
import {
  getActivityAuthoringCapabilities,
  getAuthoredActivityContractIssues,
  getNumberBondsWhole,
} from "../lib/activity-authoring-capabilities";
import {
  evaluateEncounterReadiness,
  evaluateLessonPublishReadiness,
  type GuidedEncounterInput,
} from "../lib/guided-authored-encounter";
import type {
  AuthoredSavedEquation,
  AuthoredTimelineEvent,
} from "../lib/authored-lesson-serialization";

const equation: AuthoredSavedEquation = {
  id: "bond-5",
  tokens: [
    { id: "whole", label: "5" },
    { id: "equals", label: "=" },
    { id: "known", label: "2" },
    { id: "plus", label: "+" },
    { id: "complement", label: "3" },
  ],
};

function hit(id: string, tick: number): GuidedEncounterInput {
  return {
    id,
    mechanic: "hit",
    tick,
    endTick: tick,
    equation,
    hitBubbles: [{ tokenIndex: 0, targetId: "whole", pads: ["topLeft"] }],
    spinTargets: [],
    dragTargets: [],
  };
}

function timelineEvent(id: string, encounter: GuidedEncounterInput): AuthoredTimelineEvent {
  return {
    id,
    tick: encounter.tick ?? 0,
    counts: { hit: 1, spin: 0, drag: 0 },
    assignments: { hit: equation, spin: null, drag: null },
    mechanicInstances: {
      hit: [{
        id: encounter.id,
        tick: encounter.tick,
        endTick: encounter.endTick,
        equation,
        hitBubbles: encounter.hitBubbles,
        spinTargets: [],
        dragTargets: [],
      }],
      spin: [],
      drag: [],
    },
  };
}

test("Number Bonds exposes authored Hit only and documents runtime expansion", () => {
  const capabilities = getActivityAuthoringCapabilities("number-bonds");
  assert.deepEqual(capabilities.supportedAuthoredMechanics, ["hit"]);
  assert.deepEqual(capabilities.runtimeExpandedMechanics, ["hit", "catch", "spinout", "drag"]);
  assert.equal(getNumberBondsWhole(equation), 5);
});

test("Number Bonds blocks authored Spin and multi-bubble Hits", () => {
  const spin: GuidedEncounterInput = {
    ...hit("spin-1", 10),
    mechanic: "spin",
    endTick: 11,
    hitBubbles: [],
    spinTargets: [{ tokenIndex: 0, targetId: "whole" }],
  };
  assert.equal(
    evaluateEncounterReadiness(spin, new Set(), { activityKey: "number-bonds" }).issueCodes.includes("activity_mechanic_unsupported"),
    true,
  );
  assert.equal(
    evaluateEncounterReadiness({
      ...hit("hit-1", 10),
      hitBubbles: [
        { tokenIndex: 0, targetId: "whole", pads: ["topLeft"] },
        { tokenIndex: 2, targetId: "known", pads: ["topRight"] },
      ],
    }, new Set(), { activityKey: "number-bonds" }).issueCodes.includes("activity_target_shape"),
    true,
  );
});

test("Number Bonds publish readiness enforces one equation and enough authored Hits", () => {
  const events = Array.from({ length: 5 }, (_, index) => timelineEvent(`event-${index}`, hit(`hit-${index}`, 10 + index * 10)));
  assert.equal(
    evaluateLessonPublishReadiness(events, {
      activityKey: "number-bonds",
      equationQueue: [equation],
      stopAtSeconds: 62,
    }).ready,
    true,
  );
  assert.equal(
    evaluateLessonPublishReadiness(events.slice(0, 2), {
      activityKey: "number-bonds",
      equationQueue: [equation],
    }).blockers.some((blocker) => blocker.code === "activity_hit_count"),
    true,
  );
});

test("serialized Number Bonds contract reports unsupported historical mechanics without rewriting them", () => {
  const issues = getAuthoredActivityContractIssues({
    activityKey: "number-bonds",
    equations: [{ id: equation.id, state: "5 = 2 + 3", tokens: equation.tokens }],
    encounters: [{
      id: "spin-1",
      eventId: "event-1",
      type: "spin",
      equationId: equation.id,
      startTick: 10,
      endTick: 20,
      spinTargets: [{ tokenIndex: 0, targetId: "whole" }],
    }],
  });
  assert.equal(issues.some((issue) => issue.code === "activity_mechanic_unsupported"), true);
});

test("Early Algebra retains its authored HIT/SPIN/DRAG contract", () => {
  assert.deepEqual(
    getActivityAuthoringCapabilities("early-algebra").supportedAuthoredMechanics,
    ["hit", "spin", "drag"],
  );
});

test("unknown activity identity never falls back to Algebra authoring", () => {
  assert.throws(
    () => getActivityAuthoringCapabilities("future-activity"),
    /Unsupported song activity for authoring/,
  );

  const issues = getAuthoredActivityContractIssues({
    activityKey: "future-activity",
    equations: [],
    encounters: [],
  });
  assert.deepEqual(issues.map((issue) => issue.code), ["activity_unknown"]);
});
