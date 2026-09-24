import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateEncounterReadiness,
  evaluateLessonPublishReadiness,
  findNewTimingConflict,
  retimeGuidedEncounter,
  findGuidedEncounterSelection,
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

test("a lesson without a playable move is not ready to publish", () => {
  for (const events of [[], [eventWith()]]) {
    const result = evaluateLessonPublishReadiness(events);
    assert.equal(result.ready, false);
    assert.deepEqual(result.blockers.map((blocker) => blocker.code), ["lesson_encounter_required"]);
    assert.match(result.nextAction, /Add at least one encounter/);
  }
});

test("editing cannot introduce a new Unity presenter collision, but can repair an old one", () => {
  const first = encounter("hit", { id: "hit-1", tick: 8, endTick: 8 });
  const second = encounter("hit", { id: "hit-2", tick: 10, endTick: 10 });
  const before = [eventWith(first), eventWith(second)];
  const collided = [eventWith(first), eventWith({ ...second, tick: 8.5, endTick: 8.5 })];
  assert.equal(findNewTimingConflict(before, collided)?.code, "unsupported_concurrency");
  assert.equal(findNewTimingConflict(collided, before), null);
  assert.equal(findNewTimingConflict(collided, collided), null);
});

test("timeline drags keep Hit instantaneous and Spin or Drag ranges playable", () => {
  assert.deepEqual(retimeGuidedEncounter({ mechanic: "hit", tick: 8, endTick: 8 }, "start", 10), { tick: 10, endTick: 10 });
  assert.deepEqual(retimeGuidedEncounter({ mechanic: "spin", tick: 8, endTick: 12 }, "start", 15), { tick: 11.99, endTick: 12 });
  assert.deepEqual(retimeGuidedEncounter({ mechanic: "drag", tick: 8, endTick: 12 }, "end", 4), { tick: 8, endTick: 8.01 });
});

test("standalone Drag matches the optional dependency in the published runtime contract", () => {
  const standalone = encounter("drag", { dragTargets: [{ tokenIndex: 2 }] });
  assert.equal(evaluateEncounterReadiness(standalone, new Set()).ready, true);
  assert.equal(evaluateLessonPublishReadiness([eventWith(standalone)]).ready, true);
  const brokenDependency = encounter("drag", { dragTargets: [{ tokenIndex: 2, sourceHitId: "missing" }] });
  assert.equal(evaluateEncounterReadiness(brokenDependency, new Set()).ready, false);
});

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

test("Spin and Drag cannot be marked ready with multiple target bubbles", () => {
  for (const mechanic of ["spin", "drag"] as const) {
    const input = encounter(mechanic, mechanic === "spin"
      ? { spinTargets: [{ tokenIndex: 0 }, { tokenIndex: 2 }] }
      : { dragTargets: [{ tokenIndex: 0 }, { tokenIndex: 2 }] });
    const readiness = evaluateEncounterReadiness(input, new Set());
    assert.equal(readiness.ready, false);
    assert.ok(readiness.issueCodes.includes("single_target_required"));
  }
});

test("an instantaneous Hit does not inherit its event's longer mechanic window", () => {
  const hit = encounter("hit", { id: "hit-1", tick: 8, endTick: undefined });
  const event: AuthoredTimelineEvent = {
    ...eventWith(hit),
    // Hydrated authored events aggregate their longest child interval here.
    // A hit has no separate endTick, so this must not make it non-instant.
    endTick: 12,
  };

  const result = evaluateLessonPublishReadiness([event]);

  assert.equal(result.ready, true);
  assert.equal(result.blockers.some((blocker) => blocker.code === "hit_timing_invalid"), false);
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
  const overlapBlocker = overlap.blockers.find((blocker) => blocker.code === "unsupported_concurrency");
  assert.ok(overlapBlocker);
  assert.match(overlapBlocker.message, /Drag 1 overlaps Spin 1/);
  assert.match(overlapBlocker.nextAction, /Move Drag 1 later/);
  assert.equal(overlapBlocker.relatedEncounterId, spin.id);

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

test("readiness navigation resolves the exact mechanic instance and its timeline tick", () => {
  const first = encounter("hit", { id: "hit-1", tick: 4 });
  const second = encounter("hit", { id: "hit-2", tick: 7 });
  const spin = encounter("spin", { id: "spin-1", tick: 10, endTick: 13 });
  const events = [eventWith(first, second, spin)];

  assert.deepEqual(findGuidedEncounterSelection(events, "hit-2"), {
    eventId: "event-1",
    mechanic: "hit",
    instanceIndex: 1,
    tick: 7,
  });
  assert.equal(findGuidedEncounterSelection(events, "missing-hit"), null);
});

test("publish readiness blocks sequential cues whose Unity presentation windows overlap", () => {
  const firstHit = encounter("hit", { id: "hit-1", tick: 8 });
  const tooSoon = encounter("hit", { id: "hit-2", tick: 9, endTick: 9 });
  const overlap = evaluateLessonPublishReadiness([eventWith(firstHit), eventWith(tooSoon)]);
  assert.equal(overlap.ready, false);
  assert.ok(overlap.blockers.some((blocker) => blocker.code === "unsupported_concurrency"));

  const enoughTime = encounter("hit", { id: "hit-2", tick: 10, endTick: 10 });
  const ready = evaluateLessonPublishReadiness([eventWith(firstHit), eventWith(enoughTime)]);
  assert.equal(ready.ready, true);
});

test("stress fixture identifies each overlapping Hit pair without blaming the later Spin", () => {
  const hits = [3.5, 4.8, 5.9, 6.6].map((tick, index) =>
    encounter("hit", { id: `hit-${index + 1}`, tick, endTick: tick }),
  );
  const spin = encounter("spin", { id: "spin-1", tick: 9.42, endTick: 13.94 });
  const result = evaluateLessonPublishReadiness([eventWith(...hits), eventWith(spin)]);
  const timingBlockers = result.blockers.filter((blocker) => blocker.code === "unsupported_concurrency");

  assert.deepEqual(timingBlockers.map((blocker) => blocker.message), [
    "Hit 2 overlaps Hit 1.",
    "Hit 3 overlaps Hit 2.",
    "Hit 4 overlaps Hit 3.",
  ]);
  assert.ok(timingBlockers.every((blocker) => blocker.relatedEncounterId?.startsWith("hit-")));
});

test("250 simultaneous Hits retain every pairwise conflict behind one repair target per cue", () => {
  const hits = Array.from({ length: 250 }, (_, index) =>
    encounter("hit", { id: `stress-hit-${index + 1}`, tick: 8, endTick: 8 }),
  );
  const result = evaluateLessonPublishReadiness([eventWith(...hits)]);
  const timingBlockers = result.blockers.filter((blocker) => blocker.code === "unsupported_concurrency");

  assert.equal(timingBlockers.length, 249);
  const pairs = timingBlockers.flatMap((blocker) =>
    (blocker.relatedEncounterIds ?? []).map((relatedId) => `${relatedId}:${blocker.encounterId}`),
  );
  assert.equal(pairs.length, (250 * 249) / 2);
  assert.equal(new Set(pairs).size, pairs.length);
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
