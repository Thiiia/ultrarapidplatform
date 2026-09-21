import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  serializeAuthoredLesson,
  timelineEventsFromAuthoredLesson,
  type AuthoredTimelineEvent,
} from "../lib/authored-lesson-serialization";
import { applyEquationToEvent } from "../lib/authored-lesson-event-assignment";
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
    equation?: ReturnType<typeof equation> | null;
    hitBubbles: Array<{ tokenIndex: number; targetId?: string; positions: string[]; pads: string[] }>;
    spinTargets: Array<{ tokenIndex: number; targetId?: string }>;
    dragTargets: Array<{ tokenIndex: number; targetId?: string; sourceHitId?: string }>;
  }> = {},
) {
  return {
    id,
    tick: overrides.tick,
    endTick: overrides.endTick,
    hitBubbles: overrides.hitBubbles ?? [{ tokenIndex: 0, positions: ["left"], pads: ["left"] }],
    spinTargets: overrides.spinTargets ?? [{ tokenIndex: 0 }],
    dragTargets: overrides.dragTargets ?? [{ tokenIndex: 0 }],
    ...(overrides.equation ? { equation: overrides.equation } : {}),
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
      hit: options.equation ?? equation("eq-default", ["1", "+", "1", "=", "2"]),
      spin: options.equation ?? equation("eq-default", ["1", "+", "1", "=", "2"]),
      drag: options.equation ?? equation("eq-default", ["1", "+", "1", "=", "2"]),
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

test("preserves distinct encounter equations and simultaneous source order", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const hitEquation = equation("eq-hit-a", ["1", "+", "1", "=", "2"]);
  const spinEquation = equation("eq-spin-b", ["7", "=", "X"]);
  const dragEquation = equation("eq-drag-c", ["Y", "+", "3", "=", "9"]);

  const draft = serializeAuthoredLesson([
    {
      ...makeEvent("event-a", 1, { hit: 1, spin: 1, drag: 1 }),
      assignments: {
        hit: hitEquation,
        spin: spinEquation,
        drag: dragEquation,
      },
      mechanicInstances: {
        hit: [instance("hit-a", { tick: 1, equation: hitEquation })],
        spin: [instance("spin-a", { tick: 1, equation: spinEquation })],
        drag: [instance("drag-a", { tick: 1.5, equation: dragEquation })],
      },
    },
  ], IDENTITY, clock);

  assert.deepEqual(
    draft.encounters.map(({ id, eventId, type, equationId, startTick }) =>
      ({ id, eventId, type, equationId, startTick })),
    [
      { id: "hit-a", eventId: "event-a", type: "hit", equationId: "eq-hit-a", startTick: 960 },
      { id: "spin-a", eventId: "event-a", type: "spin", equationId: "eq-spin-b", startTick: 960 },
      { id: "drag-a", eventId: "event-a", type: "drag", equationId: "eq-drag-c", startTick: 1440 },
    ],
  );
});

test("event-level assignment updates every concrete mechanic equation", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const updatedEvent = applyEquationToEvent(
    {
      ...makeEvent("event-a", 1, { hit: 1, spin: 1, drag: 1 }),
      assignments: {
        hit: equation("eq-old-hit", ["1", "=", "1"]),
        spin: equation("eq-old-spin", ["2", "=", "2"]),
        drag: equation("eq-old-drag", ["3", "=", "3"]),
      },
      mechanicInstances: {
        hit: [instance("hit-a", { equation: equation("eq-old-hit", ["1", "=", "1"]) })],
        spin: [instance("spin-a", { equation: equation("eq-old-spin", ["2", "=", "2"]) })],
        drag: [instance("drag-a", { equation: equation("eq-old-drag", ["3", "=", "3"]) })],
      },
    },
    equation("eq-new", ["7", "=", "X"]),
  );

  assert.deepEqual(
    serializeAuthoredLesson([updatedEvent], IDENTITY, clock).encounters.map(({ equationId }) => equationId),
    ["eq-new", "eq-new", "eq-new"],
  );
});

test("rebinds stale target identities when an event receives a new equation", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const newEquation = equation("eq-new", ["7", "=", "X"]);
  const updatedEvent = applyEquationToEvent(
    makeEvent("event-a", 1, { hit: 1 }, {
      equation: equation("eq-old", ["1", "=", "1"]),
      instances: {
        hit: [instance("hit-a", {
          tick: 1,
          hitBubbles: [{
            tokenIndex: 2,
            targetId: "eq-old-token-0",
            positions: ["topLeft"],
            pads: ["topLeft"],
          }],
        })],
      },
    }),
    newEquation,
  );

  const draft = serializeAuthoredLesson([updatedEvent], IDENTITY, clock);
  assert.equal(
    updatedEvent.mechanicInstances.hit[0].hitBubbles[0]?.targetId,
    "eq-new-token-2",
  );
  const target = draft.encounters[0].hitBubbles?.[0];

  assert.equal(target?.targetId, "eq-new-token-2");
  assert.doesNotThrow(() => parseAuthoredLessonDraft(draft));
});

test("does not serialize an unconfigured spin placeholder", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const draft = serializeAuthoredLesson(
    [
      makeEvent("event-a", 1, { spin: 1 }, {
        equation: equation("eq-spin", ["7", "=", "X"]),
        instances: {
          spin: [instance("spin-placeholder", {
            tick: 1,
            endTick: 2,
            spinTargets: [],
          })],
        },
      }),
    ],
    IDENTITY,
    clock,
  );

  assert.deepEqual(draft.encounters, []);
  assert.doesNotThrow(() => parseAuthoredLessonDraft(draft));
});

test("publish serialization rejects a declared incomplete encounter", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );

  assert.throws(
    () => serializeAuthoredLesson(
      [makeEvent("event-draft", 1, { spin: 1 }, {
        instances: {
          spin: [instance("spin-draft", {
            tick: 1,
            endTick: 1,
            hitBubbles: [],
            spinTargets: [],
            dragTargets: [],
          })],
        },
      })],
      IDENTITY,
      clock,
      undefined,
      [],
      { forPublish: true },
    ),
    /Authored lesson is not ready to publish/,
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
        drag: [instance("inst-drag-a", { tick: 2.25, endTick: 4, dragTargets: [{ tokenIndex: 2, sourceHitId: "inst-hit-a" }] })],
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
    { tokenIndex: 0, targetId: "eq-1-token-0", positions: ["topLeft"], pads: ["topLeft"] },
  ]);
  assert.deepEqual(hydrated.events[0].mechanicInstances.drag[0].dragTargets, [
    { tokenIndex: 2, targetId: "eq-1-token-2", sourceHitId: "inst-hit-a" },
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

test("round-trip preserves an explicit equation queue including an orphan equation", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const eq1 = equation("eq-1", ["3", "+", "4", "=", "7"]);
  const eq2 = equation("eq-2", ["X", "+", "2", "=", "9"]);
  const eq3 = equation("eq-3", ["5", "=", "Y"]);
  const events = [
    makeEvent("event-1", 4, { hit: 1 }, {
      equation: eq1,
      instances: { hit: [instance("inst-hit-1", { tick: 4 })] },
    }),
    makeEvent("event-2", 6.5, { drag: 1 }, {
      equation: eq2,
      instances: { drag: [instance("inst-drag-1", { tick: 6.5, endTick: 9, dragTargets: [{ tokenIndex: 2, sourceHitId: "inst-hit-1" }] })] },
    }),
  ];

  const draft = serializeAuthoredLesson(events, IDENTITY, clock, undefined, [eq1, eq2, eq3]);
  const hydrated = timelineEventsFromAuthoredLesson(parseAuthoredLessonDraft(draft), clock);
  const redraft = serializeAuthoredLesson(
    hydrated.events,
    IDENTITY,
    clock,
    undefined,
    hydrated.equations,
  );

  assert.deepEqual(redraft.equations.map((entry) => entry.id), ["eq-1", "eq-2", "eq-3"]);
});

test("preserves equation assignment independently for each mechanic", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const draft = serializeAuthoredLesson([
    {
      ...makeEvent("event-1", 2, { hit: 1, drag: 1 }, {
        equation: equation("eq-hit", ["1", "=", "1"]),
        instances: {
          hit: [instance("inst-hit", { tick: 2 })],
          drag: [instance("inst-drag", { tick: 2, endTick: 3 })],
        },
      }),
      assignments: {
        hit: equation("eq-hit", ["1", "=", "1"]),
        spin: null,
        drag: equation("eq-drag", ["X", "=", "2"]),
      },
    },
  ], IDENTITY, clock);

  assert.deepEqual(
    draft.encounters.map((entry) => [entry.id, entry.equationId]),
    [["inst-hit", "eq-hit"], ["inst-drag", "eq-drag"]],
  );
});

test("aggregates a shared event end from all encounters regardless of input order", () => {
  const clock = { toTick: (seconds: number) => Math.round(seconds * 1000), toSeconds: (tick: number) => tick / 1000 };
  const draft = {
    equations: [{ id: "eq-1", state: "1 = 1" }],
    encounters: [
      { id: "late", eventId: "event-1", type: "spin" as const, equationId: "eq-1", startTick: 1000, endTick: 12528, spinTargets: [{ tokenIndex: 0 }] },
      { id: "early", eventId: "event-1", type: "drag" as const, equationId: "eq-1", startTick: 500, endTick: 20000, dragTargets: [{ tokenIndex: 0 }] },
    ],
  };
  const hydrated = timelineEventsFromAuthoredLesson(draft, clock);

  assert.equal(hydrated.events[0].tick, 0.5);
  assert.equal(hydrated.events[0].endTick, 20);
});

test("hydrates the canonical authored fixture and preserves per-mechanic RTCM assignments", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const raw = JSON.parse(
    readFileSync(new URL("./fixtures/authored-playback/overlapping-mechanics.v3.json", import.meta.url), "utf8"),
  );
  const draft = parseAuthoredLessonDraft(raw, { requirePublishedIdentity: true });
  const hydrated = timelineEventsFromAuthoredLesson(draft, clock);

  assert.deepEqual(hydrated.equations.map((entry) => entry.id), ["eq-1", "eq-2", "eq-3"]);
  assert.deepEqual(hydrated.events.map((event) => event.id), ["event-1", "event-2", "event-3"]);
  assert.deepEqual(
    hydrated.events[0].mechanicInstances.hit.map((instance) => instance.id),
    ["inst-hit-1", "inst-hit-2"],
  );
  assert.equal(hydrated.events[1].mechanicInstances.spin[0]?.equation?.id, "eq-2");
  assert.equal(hydrated.events[2].mechanicInstances.drag[0]?.equation?.id, "eq-2");

  const redraft = serializeAuthoredLesson(
    hydrated.events,
    { ...IDENTITY, authorId: raw.authorId, revision: raw.revision },
    clock,
    raw.stopAtSeconds,
    hydrated.equations,
  );

  assert.deepEqual(redraft.equations.map((entry) => entry.id), ["eq-1", "eq-2", "eq-3"]);
  assert.deepEqual(
    redraft.encounters.map((encounter) => [encounter.id, encounter.eventId, encounter.type]),
    [
      ["inst-hit-1", "event-1", "hit"],
      ["inst-hit-2", "event-1", "hit"],
      ["inst-spin-1", "event-2", "spin"],
      ["inst-drag-1", "event-3", "drag"],
    ],
  );
  assert.equal(redraft.authorId, "author-dev");
  assert.equal(redraft.revision, "rev-fixture-1");
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

test("hydrates compact equations with the operator-aware token contract", () => {
  const clock = { toTick: (seconds: number) => Math.round(seconds * 1000), toSeconds: (tick: number) => tick / 1000 };
  const hydrated = timelineEventsFromAuthoredLesson({
    equations: [{ id: "eq-compact", state: "X+2=9" }],
    encounters: [{
      id: "hit-compact",
      eventId: "event-compact",
      type: "hit",
      equationId: "eq-compact",
      startTick: 100,
      endTick: 100,
      hitBubbles: [{ tokenIndex: 1 }],
    }],
  }, clock);

  assert.deepEqual(hydrated.equations[0].tokens.map((token) => token.label), ["X", "+", "2", "=", "9"]);
  assert.equal(hydrated.events[0].mechanicInstances.hit[0].hitBubbles[0].tokenIndex, 1);
});

test("preserves per-instance equation bindings within one event", () => {
  const clock = { toTick: (seconds: number) => Math.round(seconds * 1000), toSeconds: (tick: number) => tick / 1000 };
  const draft = {
    equations: [
      { id: "eq-one", state: "1 = 1" },
      { id: "eq-two", state: "2 = 2" },
    ],
    encounters: [
      { id: "hit-one", eventId: "shared", type: "hit" as const, equationId: "eq-one", startTick: 100, endTick: 100, hitBubbles: [{ tokenIndex: 0 }] },
      { id: "hit-two", eventId: "shared", type: "hit" as const, equationId: "eq-two", startTick: 100, endTick: 100, hitBubbles: [{ tokenIndex: 0 }] },
    ],
  };
  const hydrated = timelineEventsFromAuthoredLesson(draft, clock);
  const redraft = serializeAuthoredLesson(hydrated.events, IDENTITY, clock, undefined, hydrated.equations);

  assert.deepEqual(redraft.encounters.map((encounter) => [encounter.id, encounter.equationId]), [
    ["hit-one", "eq-one"],
    ["hit-two", "eq-two"],
  ]);
});

test("does not silently drop an empty queued equation", () => {
  const clock = { toTick: (seconds: number) => Math.round(seconds * 1000), toSeconds: (tick: number) => tick / 1000 };
  assert.throws(
    () => serializeAuthoredLesson([], IDENTITY, clock, undefined, [{ id: "empty", tokens: [] }]),
    /at least one token/i,
  );
});

test("Number Bonds published content hydrates and serializes without changing its contract", () => {
  const clock = createLessonClock(
    `[Song]\n{\n  Resolution = "480"\n  Offset = "0"\n}\n[SyncTrack]\n{\n  0 = B 120000\n}\n[Events]\n{\n}\n`,
  );
  const numberBondsIdentity = {
    ...IDENTITY,
    activityKey: "number-bonds",
  };
  const numberBondsEquation = equation("bond-5", ["5", "=", "2", "+", "3"]);
  const events = Array.from({ length: 5 }, (_, index) => makeEvent(
    `event-${index}`,
    10 + index * 10,
    { hit: 1 },
    {
      equation: numberBondsEquation,
      instances: {
        hit: [instance(`hit-${index}`, {
          tick: 10 + index * 10,
          equation: numberBondsEquation,
          hitBubbles: [{ tokenIndex: 0, targetId: "bond-5-token-0", positions: ["left"], pads: ["left"] }],
        })],
      },
    },
  ));

  const first = serializeAuthoredLesson(
    events,
    numberBondsIdentity,
    clock,
    undefined,
    [numberBondsEquation],
    { forPublish: true, activityKey: "number-bonds" },
  );
  const parsed = parseAuthoredLessonDraft(first);
  const hydrated = timelineEventsFromAuthoredLesson(parsed, clock);
  const second = serializeAuthoredLesson(
    hydrated.events,
    numberBondsIdentity,
    clock,
    undefined,
    hydrated.equations,
    { forPublish: true, activityKey: "number-bonds" },
  );

  assert.deepEqual(second, first);
  assert.equal(second.activityKey, "number-bonds");
  assert.equal(second.encounters.length, 5);

  const editedEvents = hydrated.events.map((event, index) => {
    if (index !== 1) return event;
    return {
      ...event,
      mechanicInstances: {
        ...event.mechanicInstances,
        hit: event.mechanicInstances.hit.map((hitInstance) => ({
          ...hitInstance,
          tick: (hitInstance.tick ?? event.tick) + 1,
        })),
      },
    };
  });
  const edited = serializeAuthoredLesson(
    editedEvents,
    numberBondsIdentity,
    clock,
    undefined,
    hydrated.equations,
    { forPublish: true, activityKey: "number-bonds" },
  );
  assert.equal(
    edited.encounters.find((encounter) => encounter.id === "hit-1")?.startTick,
    clock.toTick(21),
  );
  assert.deepEqual(
    edited.encounters.filter((encounter) => encounter.id !== "hit-1"),
    first.encounters.filter((encounter) => encounter.id !== "hit-1"),
  );
});

test("never serializes a foreign target identity after an equation edit", () => {
  const clock = { toTick: (seconds: number) => Math.round(seconds * 1000), toSeconds: (tick: number) => tick / 1000 };
  const draft = serializeAuthoredLesson(
    [makeEvent("event-stale-target", 1, { hit: 1 }, {
      equation: equation("eq-current", ["3", "=", "3"]),
      instances: {
        hit: [instance("hit-stale-target", {
          tick: 1,
          hitBubbles: [{ tokenIndex: 99, targetId: "eq-previous-token-0", positions: ["left"], pads: ["left"] }],
        })],
      },
    })],
    IDENTITY,
    clock,
  );

  assert.equal(draft.encounters[0].hitBubbles?.[0]?.targetId, undefined);
});
