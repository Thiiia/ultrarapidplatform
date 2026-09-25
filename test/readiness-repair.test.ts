import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEncounterMovePatches,
  evaluateLessonPublishReadiness,
  proposeEncounterMove,
} from "../lib/guided-authored-encounter";
import { createLessonClock } from "../lib/editor/lesson-timing";
import type { AuthoredSavedEquation, AuthoredTimelineEvent } from "../lib/authored-lesson-serialization";
import { groupReadinessBlockers, paginateReadinessBlockers } from "../app/student/lesson-builder/readiness-blocker-list";

const equation: AuthoredSavedEquation = {
  id: "equation-uuid-1",
  tokens: [
    { id: "whole", label: "5" },
    { id: "equals", label: "=" },
    { id: "part-a", label: "2" },
    { id: "plus", label: "+" },
    { id: "part-b", label: "3" },
  ],
};

const generalEquation: AuthoredSavedEquation = {
  id: "equation-uuid-general",
  tokens: [
    { id: "term-a", label: "4x" },
    { id: "operator", label: "+" },
    { id: "term-b", label: "2" },
  ],
};

const tempoChart = [
  "[Song]",
  "{",
  "Resolution = 192",
  "Offset = 0",
  "}",
  "[SyncTrack]",
  "{",
  "0 = B 120000",
  "3072 = B 60000",
  "}",
].join("\n");

const clock = createLessonClock(tempoChart);

function eventFor(
  mechanic: "hit" | "spin" | "drag",
  id: string,
  startSeconds: number,
  endSeconds = startSeconds,
  sourceHitId?: string,
  authoredEquation = generalEquation,
): AuthoredTimelineEvent {
  const instance = {
    id,
    tick: startSeconds,
    endTick: endSeconds,
    equation: authoredEquation,
    hitBubbles: mechanic === "hit" ? [{ tokenIndex: 0, targetId: authoredEquation.tokens[0].id, pads: ["left"] }] : [],
    spinTargets: mechanic === "spin" ? [{ tokenIndex: 0 }] : [],
    dragTargets: mechanic === "drag" ? [{ tokenIndex: 0, ...(sourceHitId ? { sourceHitId } : {}) }] : [],
  };
  return {
    id: `event-${id}`,
    tick: startSeconds,
    endTick: endSeconds,
    counts: { hit: mechanic === "hit" ? 1 : 0, spin: mechanic === "spin" ? 1 : 0, drag: mechanic === "drag" ? 1 : 0 },
    assignments: { hit: authoredEquation, spin: authoredEquation, drag: authoredEquation },
    mechanicInstances: {
      hit: mechanic === "hit" ? [instance] : [],
      spin: mechanic === "spin" ? [instance] : [],
      drag: mechanic === "drag" ? [instance] : [],
    },
  };
}

test("preview uses stable cue IDs, cascades spacing repairs, snaps across tempo changes, and does not mutate the lesson", () => {
  const cueIds = [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004",
    "550e8400-e29b-41d4-a716-446655440005",
  ];
  const events = [1, 4, 13, 22, 31].map((seconds, index) => ({
    ...eventFor("hit", cueIds[index], seconds, seconds, undefined, equation),
    displayLabel: "Catch cue",
  })) as AuthoredTimelineEvent[];
  const before = structuredClone(events);

  const proposal = proposeEncounterMove(events, cueIds[1], clock, {
    activityKey: "number-bonds",
    equationQueue: [equation],
    stopAtSeconds: 45,
    songEndSeconds: 50,
  });

  assert.ok(proposal);
  assert.deepEqual(events, before, "preview must leave authored events unchanged");
  assert.deepEqual(proposal.patches.map((patch) => patch.encounterId), cueIds.slice(1));
  assert.equal(proposal.readiness.ready, true);
  assert.equal(proposal.readiness.blockers.length, 0);
  for (const patch of proposal.patches) {
    assert.equal(patch.eventId, `event-${patch.encounterId}`);
    assert.equal(clock.toTick(patch.toSeconds) % clock.ticksPerBeat, 0, "moves must land on a beat");
    assert.equal(clock.toSeconds(clock.toTick(patch.toSeconds)), patch.toSeconds);
  }
  assert.equal(proposal.patches[0].toSeconds, 9, "the changed tempo at eight seconds uses the one-second beat grid");

  const applied = applyEncounterMovePatches(events, proposal.patches);
  assert.ok(applied);
  assert.equal(applied.find((event) => event.id === proposal.patches[0].eventId)?.tick, 9);
  const undone = applyEncounterMovePatches(applied, proposal.patches, "undo");
  assert.deepEqual(undone, events);
});

test("repair preserves action duration and a valid Drag dependency while reporting occupied intervals", () => {
  const sourceHitId = "hit-source-uuid";
  const hit = eventFor("hit", sourceHitId, 1);
  const firstSpin = eventFor("spin", "spin-uuid-a", 8, 13);
  const secondSpin = eventFor("spin", "spin-uuid-b", 9, 12);
  const drag = eventFor("drag", "drag-uuid", 18, 20, sourceHitId);
  const before = [hit, firstSpin, secondSpin, drag];
  const conflict = evaluateLessonPublishReadiness(before).blockers.find((blocker) =>
    blocker.encounterId === "spin-uuid-b" && blocker.code === "unsupported_concurrency",
  );
  assert.equal(conflict?.conflictIntervals?.length, 2);
  assert.deepEqual(conflict?.conflictIntervals?.map((interval) => interval.label), ["Spin", "Spin"]);

  const proposal = proposeEncounterMove(before, "spin-uuid-b", clock, { songEndSeconds: 40 });
  assert.ok(proposal);
  const spinMove = proposal.patches.find((patch) => patch.encounterId === "spin-uuid-b");
  assert.ok(spinMove);
  assert.equal(spinMove.toSeconds, 14);
  assert.equal(spinMove.toEndSeconds - spinMove.toSeconds, 3);
  assert.equal(proposal.readiness.ready, true);
  const applied = applyEncounterMovePatches(before, proposal.patches);
  const appliedDrag = applied?.find((event) => event.id === drag.id)?.mechanicInstances.drag[0];
  assert.equal(appliedDrag?.dragTargets[0].sourceHitId, sourceHitId);

  const stale = applyEncounterMovePatches(applied ?? [], proposal.patches);
  assert.equal(stale, null, "a preview cannot be applied twice over newer state");
});

test("repair cascades to a dependent Drag when its source Hit moves later", () => {
  const sourceHitId = "source-hit-uuid";
  const spin = eventFor("spin", "blocking-spin", 1, 8);
  const sourceHit = eventFor("hit", sourceHitId, 5);
  const dependentDrag = eventFor("drag", "dependent-drag", 6, 7, sourceHitId);
  const events = [spin, sourceHit, dependentDrag];

  const proposal = proposeEncounterMove(events, sourceHitId, clock, { songEndSeconds: 30 });

  assert.ok(proposal);
  assert.deepEqual(proposal.patches.map((patch) => patch.encounterId), [sourceHitId, "dependent-drag"]);
  assert.equal(proposal.patches[0].toSeconds, 9);
  assert.equal(proposal.patches[1].toSeconds, 11, "the Drag clears the moved Hit's presentation and miss window on a one-second beat");
  assert.equal(proposal.readiness.ready, true);
  const applied = applyEncounterMovePatches(events, proposal.patches);
  const movedDrag = applied?.find((event) => event.id === dependentDrag.id)?.mechanicInstances.drag[0];
  assert.equal(movedDrag?.dragTargets[0].sourceHitId, sourceHitId);
  assert.ok((movedDrag?.tick ?? 0) > (applied?.find((event) => event.id === sourceHit.id)?.mechanicInstances.hit[0].tick ?? Infinity));
});

test("repair refuses a Number Bonds final cue that cannot leave its full 12-second tail before stop", () => {
  const events = [0, 7.5, 15, 22.5, 24].map((seconds, index) =>
    eventFor("hit", `nb-hit-${index + 1}`, seconds, seconds, undefined, equation),
  );
  const proposal = proposeEncounterMove(events, "nb-hit-5", clock, {
    activityKey: "number-bonds",
    equationQueue: [equation],
    stopAtSeconds: 37,
    songEndSeconds: 60,
  });
  assert.equal(proposal, null);
});

test("1,000 sparse authored actions and 250 dense conflicts stay bounded to a small first-page list", () => {
  const sparse = Array.from({ length: 1_000 }, (_, index) =>
    eventFor("hit", `sparse-hit-${index}`, 2 + index * 8),
  );
  assert.equal(evaluateLessonPublishReadiness(sparse).blockers.length, 0);

  const dense = Array.from({ length: 250 }, (_, index) =>
    eventFor("spin", `dense-spin-${index}`, 8, 12),
  );
  const readiness = evaluateLessonPublishReadiness(dense);
  const groups = groupReadinessBlockers(readiness.blockers);
  const firstPage = paginateReadinessBlockers(groups, 0);
  assert.equal(groups.length, 249);
  assert.ok(firstPage.blockers.length < 50);
  assert.equal(firstPage.blockers.length, 12);
});
