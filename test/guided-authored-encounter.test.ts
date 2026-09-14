import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateEncounterReadiness,
  evaluateLessonPublishReadiness,
  normalizeStagedMechanic,
  type GuidedEncounterInput,
} from "../lib/guided-authored-encounter";
import type {
  AuthoredSavedEquation,
  AuthoredTimelineEvent,
} from "../lib/authored-lesson-serialization";

const equation: AuthoredSavedEquation = {
  id: "eq-1",
  tokens: [
    { id: "token-0", label: "4x" },
    { id: "token-1", label: "+" },
    { id: "token-2", label: "2" },
  ],
};

function encounter(
  mechanic: GuidedEncounterInput["mechanic"],
  overrides: Partial<GuidedEncounterInput> = {},
): GuidedEncounterInput {
  return {
    id: `${mechanic}-1`,
    mechanic,
    tick: 8,
    endTick: mechanic === "hit" ? 8 : 12,
    equation,
    hitBubbles: mechanic === "hit" ? [{ tokenIndex: 0, pads: ["left"] }] : [],
    spinTargets: mechanic === "spin" ? [{ tokenIndex: 0 }] : [],
    dragTargets: mechanic === "drag" ? [{ tokenIndex: 0, sourceHitId: "hit-1" }] : [],
    ...overrides,
  };
}

function eventWith(...instances: GuidedEncounterInput[]): AuthoredTimelineEvent {
  return {
    id: "event-1",
    tick: 8,
    counts: {
      hit: instances.filter((instance) => instance.mechanic === "hit").length,
      spin: instances.filter((instance) => instance.mechanic === "spin").length,
      drag: instances.filter((instance) => instance.mechanic === "drag").length,
    },
    assignments: { hit: equation, spin: equation, drag: equation },
    mechanicInstances: {
      hit: instances.filter((instance) => instance.mechanic === "hit") as never,
      spin: instances.filter((instance) => instance.mechanic === "spin") as never,
      drag: instances.filter((instance) => instance.mechanic === "drag") as never,
    },
  };
}

test("spin is a draft until it has equation, target, and duration", () => {
  const result = evaluateEncounterReadiness({
    id: "spin-1", mechanic: "spin", tick: 8, endTick: 8,
    equation: null, spinTargets: [], hitBubbles: [], dragTargets: [],
  }, new Set());
  assert.deepEqual(result.issueCodes, [
    "equation_required", "spin_target_required", "duration_required",
  ]);
  assert.equal(result.ready, false);
});

test("hit requires playable targets and at least one pad", () => {
  const result = evaluateEncounterReadiness(encounter("hit", {
    hitBubbles: [{ tokenIndex: 1, pads: [] }],
  }), new Set());
  assert.deepEqual(result.issueCodes, ["hit_pad_required", "operator_target"]);
});

test("drag source must be an earlier ready Hit", () => {
  const events = [
    eventWith(encounter("drag", { id: "drag-1", tick: 12, endTick: 16, dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-1" }] })),
    eventWith(encounter("hit", { id: "hit-1", tick: 16 })),
  ];
  const result = evaluateLessonPublishReadiness(events);
  assert.equal(result.ready, false);
  assert.match(result.blockers[0].message, /Hit that comes first/);
});

test("RCTM without saved equation remains a visible non-publishable draft", () => {
  const result = normalizeStagedMechanic({ id: "r-1", mechanic: "spin", tick: 12 }, null);
  assert.equal(result.publishable, false);
  assert.equal(result.readiness.issueCodes[0], "equation_required");
});

test("a complete mixed lesson is ready", () => {
  const hit = encounter("hit", { id: "hit-1", tick: 4 });
  const spin = encounter("spin", { id: "spin-1", tick: 8 });
  const drag = encounter("drag", { id: "drag-1", tick: 12, endTick: 16 });
  const result = evaluateLessonPublishReadiness([
    eventWith(hit),
    eventWith(spin),
    eventWith(drag),
  ]);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});
