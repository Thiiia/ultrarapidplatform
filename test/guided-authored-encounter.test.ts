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

test("a stale target identity asks the author to choose the token again", () => {
  const result = evaluateEncounterReadiness(encounter("hit", {
    hitBubbles: [{ tokenIndex: 0, targetId: "removed-token", pads: ["left"] }],
  }), new Set());

  assert.equal(result.ready, false);
  assert.deepEqual(result.issueCodes, ["target_identity_invalid"]);
  assert.equal(result.nextAction, "Choose the token again.");
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

test("drag cannot share the source Hit's tick", () => {
  const hit = encounter("hit", { id: "hit-1", tick: 12 });
  const drag = encounter("drag", {
    id: "drag-1", tick: 12, endTick: 16,
    dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-1" }],
  });
  const result = evaluateLessonPublishReadiness([eventWith(hit), eventWith(drag)]);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "drag_source_not_earlier"));
});

test("publish readiness blocks overlapping mechanics but permits disjoint multi-hit", () => {
  const spin = encounter("spin", { id: "spin-1", tick: 8, endTick: 12 });
  const drag = encounter("drag", { id: "drag-1", tick: 9, endTick: 13 });
  const overlap = evaluateLessonPublishReadiness([eventWith(spin), eventWith(drag)]);
  assert.equal(overlap.ready, false);
  assert.ok(overlap.blockers.some((blocker) => blocker.code === "unsupported_concurrency"));

  const firstHit = encounter("hit", { id: "hit-1", tick: 8, hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] });
  const secondHit = encounter("hit", { id: "hit-2", tick: 8, hitBubbles: [{ tokenIndex: 2, pads: ["right"] }] });
  const multiHit = evaluateLessonPublishReadiness([eventWith(firstHit, secondHit)]);
  assert.equal(multiHit.ready, true);

  const legacyPadCollision = evaluateLessonPublishReadiness([eventWith(
    encounter("hit", {
      id: "hit-left-and-right",
      tick: 8,
      hitBubbles: [{ tokenIndex: 0, pads: ["left"], positions: ["right"] }],
    }),
    secondHit,
  )]);
  assert.ok(legacyPadCollision.blockers.some((blocker) => blocker.code === "unsupported_concurrency"));
});

test("RCTM without saved equation remains a visible non-publishable draft", () => {
  const result = normalizeStagedMechanic({ id: "r-1", mechanic: "spin", tick: 12 }, null);
  assert.equal(result.publishable, false);
  assert.equal(result.readiness.issueCodes[0], "equation_required");
});

test("a complete mixed lesson is ready", () => {
  const hit = encounter("hit", { id: "hit-1", tick: 4, endTick: 4 });
  const spin = encounter("spin", { id: "spin-1", tick: 8 });
  const drag = encounter("drag", { id: "drag-1", tick: 13, endTick: 16 });
  const result = evaluateLessonPublishReadiness([
    eventWith(hit),
    eventWith(spin),
    eventWith(drag),
  ]);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});
