import assert from "node:assert/strict";
import test from "node:test";
import { buildNumberBondJourneyViews } from "../lib/editor/number-bond-journey-view";
import type { AuthoredMechanicInstance, AuthoredTimelineEvent } from "../lib/authored-lesson-serialization";
import type { NumberBondSequenceGem } from "../lib/number-bonds-authored-sequence";

function fixture() {
  const move = (id: string, tick: number, endTick: number, sourceHitId?: string): AuthoredMechanicInstance => ({
    id, tick, endTick, hitBubbles: [], spinTargets: [], dragTargets: sourceHitId ? [{ tokenIndex: 2, sourceHitId }] : [],
  });
  const event: AuthoredTimelineEvent = { id: "event", tick: 10, counts: { hit: 1, spin: 1, drag: 1 },
    assignments: { hit: null, spin: null, drag: null }, mechanicInstances: {
      hit: [move("hit-7", 10, 10)], spin: [move("spin-8", 12, 13)], drag: [move("drag-9", 15, 16, "hit-7")],
    } };
  const gem: NumberBondSequenceGem = { gemId: "physical-gem", unitIndex: 4, spinEncounterId: "spin-8", dragEncounterId: "drag-9", destination: { part: "part-b", slotIndex: 1 } };
  return { event, gem };
}

test("projects exact song times and stable gem/destination links without changing input", () => {
  const { event, gem } = fixture(); const before = JSON.stringify({event,gem});
  const [view] = buildNumberBondJourneyViews([gem], [event]);
  assert.equal(view.gemId, "physical-gem"); assert.equal(view.unitIndex, 4);
  assert.deepEqual(view.destination, { part: "part-b", slotIndex: 1 });
  assert.equal(view.hit?.id, "hit-7"); assert.equal(view.spin?.startSeconds, 12); assert.equal(view.drag?.endSeconds, 16);
  assert.deepEqual(view.issues, []); assert.equal(JSON.stringify({event,gem}), before);
});

test("resolves by identity through reordered rows and never by row index", () => {
  const { event, gem } = fixture();
  event.mechanicInstances.hit.unshift({ ...event.mechanicInstances.hit[0], id: "other-hit", tick: 6, endTick: 6 });
  assert.equal(buildNumberBondJourneyViews([gem], [event])[0].hit?.id, "hit-7");
});

test("does not invent missing, wrong-kind, ambiguous or duplicate links", () => {
  for (const change of ["missing", "wrong-kind", "duplicate", "ambiguous"] as const) {
    const { event, gem } = fixture();
    if (change === "missing") event.mechanicInstances.hit = [];
    if (change === "wrong-kind") event.mechanicInstances.drag[0].dragTargets[0].sourceHitId = "spin-8";
    if (change === "duplicate") event.mechanicInstances.hit.push({ ...event.mechanicInstances.hit[0] });
    if (change === "ambiguous") event.mechanicInstances.drag[0].dragTargets.push({ tokenIndex: 4, sourceHitId: "hit-7" });
    const [view] = buildNumberBondJourneyViews([gem], [event]);
    assert.equal(view.hit, null, change); assert.ok(view.issues.length, change);
  }
});

test("reports invalid duration, chronology and shared ownership without repairing them", () => {
  const { event, gem } = fixture();
  event.mechanicInstances.spin[0].endTick = Number.NaN;
  assert.equal(buildNumberBondJourneyViews([gem], [event])[0].spin, null);
  event.mechanicInstances.spin[0].endTick = 15;
  assert.match(buildNumberBondJourneyViews([gem], [event])[0].issues.join(), /out of/);
  event.mechanicInstances.spin[0].endTick = 13;
  const views = buildNumberBondJourneyViews([gem, { ...gem, gemId: "another-gem" }], [event]);
  assert.ok(views.every(view => view.issues.some(issue => issue.includes("shared"))));
});

test("legacy lessons produce no invented journeys", () => assert.deepEqual(buildNumberBondJourneyViews([], []), []));

test("uses an event duration fallback only for held moves", () => {
  const { event, gem } = fixture();
  event.endTick = 13;
  delete event.mechanicInstances.hit[0].endTick;
  delete event.mechanicInstances.spin[0].endTick;
  const [view] = buildNumberBondJourneyViews([gem], [event]);
  assert.equal(view.hit?.endSeconds, 10);
  assert.equal(view.spin?.endSeconds, 13);
});
