import assert from "node:assert/strict";
import test from "node:test";

import { parseAuthoredLessonDraft, validateAuthoredRuntimePresentationConcurrency } from "../lib/authored-lesson";
import { retimeAuthoredLessonToMusic } from "../lib/authored-lesson-retiming";
import { createLessonClock } from "../lib/editor/lesson-timing";

const chart = `[Song]
{
  Resolution = 192
}
[SyncTrack]
{
  0 = B 120000
}
[MediumSingle]
{
  192 = N 0 0
  576 = N 1 0
  768 = N 2 0
  1152 = N 3 0
}`;

function lesson(encounters: unknown[]) {
  return parseAuthoredLessonDraft({
    version: 3,
    mode: "authored",
    songAssetId: "song",
    activityKey: "early-algebra",
    equations: [{ id: "eq", state: "x+2=4" }],
    encounters,
  });
}

test("retimes a conflicting later hit to the next musical anchor", () => {
  const source = lesson([
    { id: "hit-1", eventId: "event-1", type: "hit", equationId: "eq", startTick: 192, endTick: 192, hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] },
    { id: "hit-2", eventId: "event-2", type: "hit", equationId: "eq", startTick: 384, endTick: 384, hitBubbles: [{ tokenIndex: 0, pads: ["right"] }] },
  ]);
  const clock = createLessonClock(chart);
  const result = retimeAuthoredLessonToMusic({ chart, lesson: source, clock });

  assert.equal(result.anchorDifficulty, "MediumSingle");
  assert.deepEqual(result.changes.map(({ encounterId, fromTick, toTick }) => ({ encounterId, fromTick, toTick })), [
    { encounterId: "hit-2", fromTick: 384, toTick: 768 },
  ]);
  assert.doesNotThrow(() => validateAuthoredRuntimePresentationConcurrency(result.lesson.encounters, clock));
});

test("keeps a valid disjoint same-event hit group together", () => {
  const source = lesson([
    { id: "hit-left", eventId: "event-1", type: "hit", equationId: "eq", startTick: 192, endTick: 192, hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] },
    { id: "hit-right", eventId: "event-1", type: "hit", equationId: "eq", startTick: 192, endTick: 192, hitBubbles: [{ tokenIndex: 2, pads: ["right"] }] },
    { id: "hit-later", eventId: "event-2", type: "hit", equationId: "eq", startTick: 384, endTick: 384, hitBubbles: [{ tokenIndex: 0, pads: ["bottomLeft"] }] },
  ]);
  const clock = createLessonClock(chart);
  const result = retimeAuthoredLessonToMusic({ chart, lesson: source, clock });

  assert.equal(result.lesson.encounters.find((encounter) => encounter.id === "hit-left")?.startTick, 192);
  assert.equal(result.lesson.encounters.find((encounter) => encounter.id === "hit-right")?.startTick, 192);
  assert.equal(result.lesson.encounters.find((encounter) => encounter.id === "hit-later")?.startTick, 768);
  assert.doesNotThrow(() => validateAuthoredRuntimePresentationConcurrency(result.lesson.encounters, clock));
});

test("retimes the opening authored cue to the requested learner-safe floor", () => {
  const chartWithSixSecondAnchor = chart.replace(
    "  1152 = N 3 0\n}",
    "  1152 = N 3 0\n  2304 = N 0 0\n}",
  );
  const source = lesson([
    { id: "hit-1", eventId: "event-1", type: "hit", equationId: "eq", startTick: 192, endTick: 192, hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] },
  ]);
  const clock = createLessonClock(chartWithSixSecondAnchor);
  const result = retimeAuthoredLessonToMusic({
    chart: chartWithSixSecondAnchor,
    lesson: source,
    clock,
    minimumFirstCueSeconds: 6,
  });

  assert.deepEqual(result.changes.map(({ encounterId, fromTick, toTick }) => ({ encounterId, fromTick, toTick })), [
    { encounterId: "hit-1", fromTick: 192, toTick: 2304 },
  ]);
  assert.equal(result.lesson.encounters[0]?.startTick, 2304);
});
