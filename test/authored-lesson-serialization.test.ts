import assert from "node:assert/strict";
import test from "node:test";

import {
  serializeAuthoredLesson,
  timelineEventsFromAuthoredLesson,
  type AuthoredTimelineEvent,
} from "../lib/authored-lesson-serialization";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";

const IDENTITY = {
  songAssetId: "waves",
  activityKey: "early-algebra",
  authorId: "author-1",
  revision: "rev-1",
};

function equation(id: string, labels: string[]) {
  return {
    id,
    tokens: labels.map((label, index) => ({ id: `${id}-token-${index}`, label })),
  };
}

function instance(
  id: string,
  overrides: Partial<{
    tick: number;
    endTick: number;
    hitBubbles: Array<{ tokenIndex: number; positions: string[]; pads: string[] }>;
    spinTargets: Array<{ tokenIndex: number }>;
    dragTargets: Array<{ tokenIndex: number; sourceHitId?: string }>;
  }> = {},
) {
  return {
    id,
    tick: overrides.tick,
    endTick: overrides.endTick,
    hitBubbles: overrides.hitBubbles ?? [],
    spinTargets: overrides.spinTargets ?? [],
    dragTargets: overrides.dragTargets ?? [],
  };
}

function makeEvent(
  id: string,
  tick: number,
  counts: { hit?: number; spin?: number; drag?: number },
  options: {
    endTick?: number;
    equation?: ReturnType<typeof equation> | null;
    instances?: Partial<Record<"hit" | "spin" | "drag", ReturnType<typeof instance>[]>>;
  } = {},
): AuthoredTimelineEvent {
  const normalizedCounts = {
    hit: counts.hit ?? 0,
    spin: counts.spin ?? 0,
    drag: counts.drag ?? 0,
  };

  const mechanicInstances = {
    hit: options.instances?.hit ?? [],
    spin: options.instances?.spin ?? [],
    drag: options.instances?.drag ?? [],
  };

  return {
    id,
    tick,
    ...(typeof options.endTick === "number" ? { endTick: options.endTick } : {}),
    counts: normalizedCounts,
    assignments: {
      hit: options.equation ?? null,
      spin: options.equation ?? null,
      drag: options.equation ?? null,
    },
    mechanicInstances,
  };
}

test("serializes fractional editor seconds to integer chart ticks exactly once", () => {
  // 123 BPM, resolution 480, offset 0: 10 seconds -> tick 9840.
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 123000\n}\n[Events]\n{\n}\n`,
  );

  const draft = serializeAuthoredLesson(
    [
      makeEvent("event-1", 10, { hit: 1 }, {
        equation: equation("eq-a", ["1", "+", "1", "=", "2"]),
        instances: { hit: [instance("inst-hit-1", { tick: 10 })] },
      }),
    ],
    IDENTITY,
    clock,
  );

  assert.equal(draft.encounters.length, 1);
  assert.equal(draft.encounters[0].startTick, 9840);
  assert.equal(draft.encounters[0].endTick, 9840);
  assert.equal(Number.isSafeInteger(draft.encounters[0].startTick), true);
  // parseAuthoredLessonDraft (requireTick) must accept the result.
  assert.doesNotThrow(() => parseAuthoredLessonDraft(draft));
});

test("uses the tempo map for timing after a tempo change", () => {
  // 174 BPM, resolution 480, offset 0: 10 seconds -> tick 13920.
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 174000\n}\n[Events]\n{\n}\n`,
  );

  const draft = serializeAuthoredLesson(
    [makeEvent("event-1", 10, { spin: 1 }, { instances: { spin: [instance("inst-spin-1", { tick: 10, endTick: 12 })] } })],
    IDENTITY,
    clock,
  );

  assert.equal(draft.encounters[0].startTick, 13920);
  assert.equal(draft.encounters[0].endTick, 16704);
});

test("preserves event, instance and equation identity instead of deriving from index", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );

  const draft = serializeAuthoredLesson(
    [
      makeEvent("event-beta", 5, { hit: 1 }, {
        equation: equation("eq-custom", ["2", "=", "X", "+", "1"]),
        instances: { hit: [instance("inst-keep-me", { tick: 5 })] },
      }),
      makeEvent("event-alpha", 2.5, { drag: 1 }, {
        equation: equation("eq-custom", ["2", "=", "X", "+", "1"]),
        instances: { drag: [instance("inst-drag-7", { tick: 2.5, endTick: 4 })] },
      }),
    ],
    IDENTITY,
    clock,
  );

  const ids = draft.encounters.map((encounter) => encounter.id);
  assert.deepEqual(ids, ["inst-keep-me", "inst-drag-7"]);
  assert.deepEqual(
    draft.encounters.map((encounter) => encounter.eventId),
    ["event-beta", "event-alpha"],
  );
  // Same authored equation state shares one equation identity, authored order kept.
  assert.deepEqual(
    draft.equations.map((entry) => entry.id),
    ["eq-custom"],
  );
});

test("serializes equations with zero mechanics so queue order is preserved", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );

  const draft = serializeAuthoredLesson(
    [
      makeEvent("event-1", 1, { hit: 1 }, {
        equation: equation("eq-first", ["1", "+", "1", "=", "2"]),
        instances: { hit: [instance("inst-1", { tick: 1 })] },
      }),
      makeEvent("event-2", 2, {}, { equation: equation("eq-orphan", ["3", "=", "X"]) }),
      makeEvent("event-3", 3, {}, { equation: equation("eq-third", ["4", "=", "Y"]) }),
    ],
    IDENTITY,
    clock,
  );

  assert.deepEqual(
    draft.equations.map((entry) => entry.id),
    ["eq-first", "eq-orphan", "eq-third"],
  );
  assert.equal(draft.encounters.length, 1);
});

test("round-trips timing within one chart tick and rejects fractional output", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 123000\n}\n[Events]\n{\n}\n`,
  );

  const draft = serializeAuthoredLesson(
    [makeEvent("event-1", 3.75, { spin: 1 }, { instances: { spin: [instance("inst-s", { tick: 3.75, endTick: 6.25 })] } })],
    IDENTITY,
    clock,
  );

  const encounter = draft.encounters[0];
  assert.equal(Number.isSafeInteger(encounter.startTick), true);
  assert.equal(Number.isSafeInteger(encounter.endTick), true);

  const roundTripStart = clock.toSeconds(encounter.startTick);
  const roundTripEnd = clock.toSeconds(encounter.endTick);
  const tickSeconds = 60 / (123 * 480);

  assert.ok(Math.abs(roundTripStart - 3.75) <= tickSeconds);
  assert.ok(Math.abs(roundTripEnd - 6.25) <= tickSeconds);
});

test("editor -> v3 -> editor round-trip preserves identity, targets and queue order", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );

  const events: AuthoredTimelineEvent[] = [
    makeEvent("event-1", 2, { hit: 1, drag: 1 }, {
      equation: equation("eq-1", ["2", "+", "3", "=", "5"]),
      instances: {
        hit: [instance("inst-hit-a", { tick: 2, hitBubbles: [{ tokenIndex: 0, positions: ["topLeft"], pads: ["topLeft"] }] })],
        drag: [instance("inst-drag-a", { tick: 2, endTick: 4, dragTargets: [{ tokenIndex: 1, sourceHitId: "inst-hit-a" }] })],
      },
    }),
    makeEvent("event-2", 6, {}, { equation: equation("eq-2", ["7", "=", "X"]) }),
  ];

  const draft = serializeAuthoredLesson(events, IDENTITY, clock);

  // Strictly validated before hydration.
  const validated = parseAuthoredLessonDraft(draft);
  const hydrated = timelineEventsFromAuthoredLesson(validated, clock);

  // Mechanic-bearing events keep their identity; an equation-only event has no
  // encounter, so only its equation is preserved (in the queue), matching the
  // v3 protocol where encounters carry mechanics.
  assert.deepEqual(
    hydrated.events.map((event) => event.id),
    ["event-1"],
  );
  assert.deepEqual(
    hydrated.events[0].mechanicInstances.hit.map((inst) => inst.id),
    ["inst-hit-a"],
  );
  assert.deepEqual(
    hydrated.events[0].mechanicInstances.drag.map((inst) => inst.id),
    ["inst-drag-a"],
  );

  // Targets and sourceHitId preserved.
  assert.deepEqual(hydrated.events[0].mechanicInstances.hit[0].hitBubbles, [
    { tokenIndex: 0, positions: ["topLeft"], pads: ["topLeft"] },
  ]);
  assert.deepEqual(hydrated.events[0].mechanicInstances.drag[0].dragTargets, [
    { tokenIndex: 1, sourceHitId: "inst-hit-a" },
  ]);

  // Unreferenced equation kept in the queue.
  assert.deepEqual(
    hydrated.equations.map((entry) => entry.id),
    ["eq-1", "eq-2"],
  );

  // Re-serialize and compare identity + ticks stay stable across save/reopen/save.
  const redraft = serializeAuthoredLesson(
    hydrated.events,
    IDENTITY,
    clock,
  );
  assert.deepEqual(
    redraft.encounters.map((encounter) => [encounter.id, encounter.eventId, encounter.startTick, encounter.endTick]),
    draft.encounters.map((encounter) => [encounter.id, encounter.eventId, encounter.startTick, encounter.endTick]),
  );
});

test("rejects a non-finite position instead of coercing it to a near-zero tick", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );

  assert.throws(
    () =>
      serializeAuthoredLesson(
        [makeEvent("event-1", Number.NaN, { hit: 1 }, { instances: { hit: [instance("inst-bad", { tick: Number.NaN })] } })],
        IDENTITY,
        clock,
      ),
    /must be finite seconds/,
  );
});
