import assert from "node:assert/strict";
import test from "node:test";

import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import {
  migrateEarlyAlgebraCatalogueSong,
  refreshEarlyAlgebraEquationContent,
  upgradeEarlyAlgebraCatalogueHitPads,
} from "../lib/early-algebra-catalogue-migration";
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
${Array.from({ length: 70 }, (_, index) => `  ${(index + 1) * 192} = N 0 0`).join("\n")}
}`;

test("migrates old hits to the player hex and uses the released phrase for separate hits", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "jazzmaybach", activityKey: "early-algebra",
    authorId: "author", revision: "old", stopAtSeconds: 34,
    equations: [
      { id: "first", state: "x + 2 = 5" },
      { id: "second", state: "X + 7 2 = 1 0 0" },
    ],
    encounters: [
      { id: "first-hit", eventId: "event-1", type: "hit", equationId: "first",
        startTick: 2688, endTick: 2688,
        hitBubbles: ["topLeft", "topRight", "left", "right"].map((pad, tokenIndex) => ({
          tokenIndex: tokenIndex === 0 ? 0 : 2, pads: [pad], positions: [pad],
        })) },
      { id: "first-drag", eventId: "event-2", type: "drag", equationId: "first",
        startTick: 3840, endTick: 9984,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "first-hit" }] },
      { id: "second-hit", eventId: "event-3", type: "hit", equationId: "second",
        startTick: 11520, endTick: 11520,
        hitBubbles: [{ tokenIndex: 0, pads: ["bottomRight"], positions: ["bottomRight"] }] },
    ],
  };
  const migrated = migrateEarlyAlgebraCatalogueSong({ songAssetId: "jazzmaybach", chart, sidecar: JSON.stringify(source) });
  assert.deepEqual(migrated.equations.map((equation) => equation.state), ["x + 1 = 2", "x - 1 = 1"]);
  assert.ok(migrated.encounters.length > source.encounters.length);
  assert.ok(source.encounters.every(({ id }) => migrated.encounters.some((encounter) => encounter.id === id)));
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-drag")?.endTick, 5376);
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-drag")?.dragTargets?.[0]?.sourceHitId, "first-hit");
  assert.ok(migrated.encounters.filter((encounter) => encounter.type === "hit").every((encounter) =>
    encounter.hitBubbles?.length === 1 && encounter.hitBubbles[0].padLayoutVersion === 2));
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-hit")?.hitBubbles?.[0]?.pads?.[0], "top");
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "second-hit")?.hitBubbles?.[0]?.pads?.[0], "upperLeft");
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-hit")?.hitBubbles?.[0]?.pads?.length, 1);
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "second-hit")?.hitBubbles?.[0]?.pads?.length, 2);
  assert.ok(migrated.encounters.filter((encounter) => encounter.type === "hit").some((encounter) => encounter.id.includes("-rhythm-hit-") && encounter.hitBubbles?.[0]?.pads?.length === 2));
  assert.doesNotThrow(() => prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(migrated), previousSidecarContent: JSON.stringify(source),
    identity: { songAssetId: "jazzmaybach", activityKey: "early-algebra", authorId: "author", revision: "new" },
    runtimeClock: createLessonClock(chart),
  }));
  assert.throws(() => migrateEarlyAlgebraCatalogueSong({
    songAssetId: "jazzmaybach", chart, sidecar: JSON.stringify(migrated),
  }), /already been migrated/);
});

test("every catalogue progression has distinct equations with positive integer solutions", () => {
  const counts: Record<string, number> = {
    garden: 10, geminiqueen: 12, grudge: 7, jazzmaybach: 2,
    justbecause: 10, oneone: 8, seven: 10, waves: 18,
  };
  const side = (expression: string) => expression.replace(/\s/g, "")
    .replace(/-/g, "+-").split("+").filter(Boolean)
    .reduce(([coefficient, constant], term) => {
      if (term.endsWith("x")) {
        const raw = term.slice(0, -1);
        return [coefficient + (raw === "" ? 1 : raw === "-" ? -1 : Number(raw)), constant];
      }
      return [coefficient, constant + Number(term)];
    }, [0, 0]);
  for (const [songAssetId, count] of Object.entries(counts)) {
    const source = {
      version: 3, mode: "authored", songAssetId, activityKey: "early-algebra",
      equations: Array.from({ length: count }, (_, index) => ({ id: `eq-${index}`, state: "x + 2 = 5" })),
      encounters: [{ id: "hit", eventId: "event", type: "hit", equationId: "eq-0",
        startTick: 2688, endTick: 2688, hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] }],
    };
    const migrated = migrateEarlyAlgebraCatalogueSong({ songAssetId, chart, sidecar: JSON.stringify(source) });
    assert.ok(migrated.encounters.filter((encounter) => encounter.type === "hit").every((encounter) => (encounter.hitBubbles?.[0]?.pads?.length ?? 0) <= 2), songAssetId);
    assert.equal(new Set(migrated.equations.map((equation) => equation.state)).size, count, songAssetId);
    const solutions = migrated.equations.map((equation) => {
      const [left, right] = equation.state.split("=");
      const [leftCoefficient, leftConstant] = side(left);
      const [rightCoefficient, rightConstant] = side(right);
      return (rightConstant - leftConstant) / (leftCoefficient - rightCoefficient);
    });
    assert.ok(solutions.every((solution) => Number.isSafeInteger(solution) && solution > 0), songAssetId);
    assert.ok(new Set(solutions).size >= Math.min(2, count), songAssetId);
  }
});

test("gives each drag its own small equation row and rewrites the following cue targets", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra",
    equations: [
      { id: "one-step", state: "x^2 - 12x + 36 = 0" },
      { id: "two-step", state: "18x + 44 = 92" },
      { id: "three-step", state: "14x + 24 = 70" },
    ],
    encounters: [
      { id: "hit-one", eventId: "event-1", type: "hit", equationId: "one-step", startTick: 1, endTick: 1,
        hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
      { id: "drag-one", eventId: "event-2", type: "drag", equationId: "one-step", startTick: 2, endTick: 3,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-one" }] },
      { id: "hit-two", eventId: "event-3", type: "hit", equationId: "two-step", startTick: 4, endTick: 4,
        hitBubbles: [{ tokenIndex: 0, pads: ["topRight"] }] },
      { id: "spin-two", eventId: "event-4", type: "spin", equationId: "two-step", startTick: 5, endTick: 6,
        spinTargets: [{ tokenIndex: 0 }] },
      { id: "drag-two", eventId: "event-5", type: "drag", equationId: "two-step", startTick: 7, endTick: 8,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-two" }] },
      { id: "hit-three", eventId: "event-7", type: "hit", equationId: "three-step", startTick: 11, endTick: 11,
        hitBubbles: [{ tokenIndex: 0, pads: ["right"] }] },
      { id: "drag-three", eventId: "event-8", type: "drag", equationId: "three-step", startTick: 12, endTick: 13,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-three" }] },
      { id: "tail-hit", eventId: "event-9", type: "hit", equationId: "three-step", startTick: 14, endTick: 14,
        hitBubbles: [{ tokenIndex: 0, pads: ["bottomLeft"] }] },
    ],
  };
  const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) });

  assert.match(refreshed.equations[0].state, /^x \+/);
  assert.match(refreshed.equations[1].state, /^x \+/);
  assert.match(refreshed.equations[2].state, /^x -/);
  assert.deepEqual(refreshed.equations.map(({ id }) => id), [
    "waves-early-step-01", "waves-early-step-02", "waves-early-step-03",
  ]);
  assert.deepEqual(refreshed.encounters.map(({ id, eventId, type, startTick, endTick }) =>
    [id, eventId, type, startTick, endTick]),
  source.encounters.map(({ id, eventId, type, startTick, endTick }) =>
    [id, eventId, type, startTick, endTick]));
  assert.deepEqual(refreshed.encounters.filter(({ type }) => type === "hit").map((encounter) =>
    encounter.hitBubbles?.[0].pads), source.encounters.filter(({ type }) => type === "hit").map((encounter) =>
    encounter.hitBubbles?.[0].pads));
  assert.ok(refreshed.equations.every((equation) => !/\bx\s*\^\s*2/i.test(equation.state)));
  assert.ok(refreshed.equations.every((equation) => (equation.tokens?.length ?? 0) <= 8));

  for (const encounter of refreshed.encounters) {
    const equation = refreshed.equations.find(({ id }) => id === encounter.equationId)!;
    const targets = encounter.type === "hit" ? encounter.hitBubbles ?? []
      : encounter.type === "spin" ? encounter.spinTargets ?? [] : encounter.dragTargets ?? [];
    for (const target of targets) {
      assert.equal(equation.tokens?.[target.tokenIndex]?.id, target.targetId, encounter.id);
    }
  }
  for (const [index, dragId] of ["drag-one", "drag-two", "drag-three"].entries()) {
    const drag = refreshed.encounters.find(({ id }) => id === dragId)!;
    const step = refreshed.equations[index];
    assert.equal(drag.equationId, step.id);
    assert.equal(refreshed.encounters.filter((encounter) => encounter.type === "drag" && encounter.equationId === step.id).length, 1);
    assert.equal(step.tokens?.[drag.dragTargets?.[0].tokenIndex]?.id, drag.dragTargets?.[0].targetId);
    const sourceHit = refreshed.encounters.find(({ id }) => id === drag.dragTargets?.[0].sourceHitId);
    assert.equal(sourceHit?.hitBubbles?.[0]?.targetId, drag.dragTargets?.[0].targetId, drag.id);
  }
  assert.equal(refreshed.encounters.find(({ id }) => id === "hit-one")?.equationId, "waves-early-step-01");
  assert.equal(refreshed.encounters.find(({ id }) => id === "hit-two")?.equationId, "waves-early-step-02");
  assert.equal(refreshed.encounters.find(({ id }) => id === "hit-three")?.equationId, "waves-early-step-03");
  assert.equal(refreshed.encounters.find(({ id }) => id === "tail-hit")?.equationId, "waves-early-step-03");
  assert.equal(refreshed.encounters.find(({ id }) => id === "drag-one")?.dragTargets?.[0].sourceHitId, "hit-one");
});

test("orders the one-step curriculum by the cue timeline instead of the source equation array", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra",
    // Deliberately keep the serialized equation list out of song order.
    equations: [
      { id: "two-step-after-multiplication", state: "x^2 - 12x + 36 = 0" },
      { id: "one-step-multiplication", state: "x^2 - 12x + 36 = 0" },
      { id: "two-step-additive", state: "x^2 - 12x + 36 = 0" },
      { id: "one-step-additive-two", state: "x^2 - 12x + 36 = 0" },
      { id: "one-step-additive", state: "x^2 - 12x + 36 = 0" },
    ],
    encounters: ["one-step-additive", "one-step-additive-two", "one-step-multiplication", "two-step-additive", "two-step-after-multiplication"]
      .flatMap((equationId, index) => {
        const hitId = `hit-${index}`;
        const startTick = (index + 1) * 3;
        return [
          { id: hitId, eventId: `${hitId}-event`, type: "hit", equationId, startTick, endTick: startTick,
            hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
          { id: `drag-${index}`, eventId: `drag-${index}-event`, type: "drag", equationId,
            startTick: startTick + 1, endTick: startTick + 2,
            dragTargets: [{ tokenIndex: 2, sourceHitId: hitId }] },
        ];
      }),
  };
  const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) });

  assert.equal(refreshed.equations.length, 5);
  assert.deepEqual(refreshed.equations.map(({ state }) =>
    state.startsWith("x +") ? "additive"
      : "subtractive"),
  ["additive", "additive", "additive", "subtractive", "subtractive"]);
  assert.deepEqual(refreshed.equations.map(({ id }) => id), [
    "waves-early-step-01", "waves-early-step-02", "waves-early-step-03", "waves-early-step-04", "waves-early-step-05",
  ]);
  assert.equal(refreshed.encounters.find(({ id }) => id === "drag-0")?.equationId, "waves-early-step-01");
  assert.equal(refreshed.encounters.find(({ id }) => id === "drag-4")?.equationId, "waves-early-step-05");
  assert.ok(refreshed.equations.every(({ state }) => !/\bx\s*\^\s*2/i.test(state)));
});

test("refreshes all 8 songs with one-step equations within 10 and an additive-to-subtractive progression", () => {
  const counts: Record<string, number> = {
    garden: 10, geminiqueen: 12, grudge: 7, jazzmaybach: 2,
    justbecause: 10, oneone: 8, seven: 10, waves: 18,
  };
  const familyFor = (state: string) => state.startsWith("x +") ? "additive" : "subtractive";
  const allStates = new Set<string>();
  for (const [songAssetId, count] of Object.entries(counts)) {
    const equationIds = Array.from({ length: count }, (_, index) => `eq-${index}`);
    const source = {
      version: 3, mode: "authored", songAssetId, activityKey: "early-algebra",
      equations: equationIds.map((id) => ({ id, state: "8x + 9 = 2x + 51" })),
      encounters: equationIds.flatMap((equationId, index) => {
        const hitId = `hit-${index}`;
        const startTick = (index + 1) * 3;
        return [
          { id: hitId, eventId: `${hitId}-event`, type: "hit", equationId, startTick, endTick: startTick,
            hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
          { id: `drag-${index}`, eventId: `drag-${index}-event`, type: "drag", equationId,
            startTick: startTick + 1, endTick: startTick + 2,
            dragTargets: [{ tokenIndex: 2, sourceHitId: hitId }] },
        ];
      }),
    };
    const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId, sidecar: JSON.stringify(source) });
    const additiveCount = Math.ceil(count / 2);
    const subtractiveCount = count - additiveCount;

    assert.equal(refreshed.equations.length, count, songAssetId);
    assert.deepEqual(refreshed.equations.map(({ state }) => familyFor(state)), [
      ...Array(additiveCount).fill("additive"),
      ...Array(subtractiveCount).fill("subtractive"),
    ], songAssetId);
    assert.equal(new Set(refreshed.equations.map(({ state }) => state)).size, count, songAssetId);
    refreshed.equations.forEach(({ state }) => allStates.add(state));
    for (const [family, pattern] of [
      ["additive", /^x \+ (\d+) =/],
      ["subtractive", /^x - (\d+) =/],
    ] as const) {
      const operands = refreshed.equations.filter(({ state }) => familyFor(state) === family)
        .map(({ state }) => state.match(pattern)?.[1]);
      assert.ok(operands.every((operand, index) => index === 0 || operand !== operands[index - 1]),
        `${songAssetId} repeats a ${family} operand in adjacent rows`);
    }

    for (const drag of refreshed.encounters.filter(({ type }) => type === "drag")) {
      const dragTarget = drag.dragTargets?.[0];
      const sourceHit = refreshed.encounters.find(({ id }) => id === dragTarget?.sourceHitId);
      assert.equal(sourceHit?.hitBubbles?.[0]?.targetId, dragTarget?.targetId, `${songAssetId}: ${drag.id}`);
    }

    const solutions = refreshed.equations.map(({ state }) => {
      assert.ok(state.split(/\s+/).length <= 5, `${songAssetId}: ${state}`);
      assert.ok(state.match(/\d+/g)?.every((value) => Number(value) <= 10), `${songAssetId}: ${state}`);
      if (state.startsWith("x +")) {
        const [, addend, total] = state.match(/^x \+ (\d+) = (\d+)$/)!;
        return Number(total) - Number(addend);
      }
      if (state.startsWith("x -")) {
        const [, subtrahend, difference] = state.match(/^x - (\d+) = (\d+)$/)!;
        return Number(difference) + Number(subtrahend);
      }
      assert.match(state, /^x - \d+ = \d+$/, `${songAssetId}: ${state}`);
      const [, subtrahend, difference] = state.match(/^x - (\d+) = (\d+)$/)!;
      return Number(difference) + Number(subtrahend);
    });
    assert.ok(solutions.every((solution) => Number.isSafeInteger(solution) && solution > 0 && solution <= 10), songAssetId);
    for (const family of ["additive", "subtractive"] as const) {
      const familySolutions = refreshed.equations
        .filter(({ state }) => familyFor(state) === family)
        .map(({ state }) => {
          if (state.startsWith("x +")) {
            const [, addend, total] = state.match(/^x \+ (\d+) = (\d+)$/)!;
            return Number(total) - Number(addend);
          }
          const [, subtrahend, difference] = state.match(/^x - (\d+) = (\d+)$/)!;
          return Number(difference) + Number(subtrahend);
        });
      assert.ok(familySolutions.every((solution, index) =>
        index === 0 || solution >= familySolutions[index - 1]),
      `${songAssetId} ${family} solutions should not reset to an easier value`);
    }
  }
  assert.ok(allStates.size >= 40, `expected variety across all songs, got ${allStates.size} distinct equations`);
});

test("rejects a legacy multi-drag row without a fresh hit for the next equation", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra",
    equations: [
      { id: "later-two-step", state: "x^2 - 12x + 36 = 0" },
      { id: "three-step-stretch", state: "x^2 - 12x + 36 = 0" },
      { id: "first-two-step", state: "x^2 - 12x + 36 = 0" },
    ],
    encounters: [
      { id: "hit-first-two", eventId: "first-two-hit-event", type: "hit", equationId: "first-two-step", startTick: 1, endTick: 1,
        hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
      { id: "first-two-drag-a", eventId: "first-two-drag-a-event", type: "drag", equationId: "first-two-step", startTick: 2, endTick: 3,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-first-two" }] },
      { id: "first-two-drag-b", eventId: "first-two-drag-b-event", type: "drag", equationId: "first-two-step", startTick: 4, endTick: 5,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-first-two" }] },
      { id: "hit-stretch", eventId: "stretch-hit-event", type: "hit", equationId: "three-step-stretch", startTick: 6, endTick: 6,
        hitBubbles: [{ tokenIndex: 0, pads: ["topRight"] }] },
      { id: "stretch-drag-a", eventId: "stretch-drag-a-event", type: "drag", equationId: "three-step-stretch", startTick: 7, endTick: 8,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-stretch" }] },
      { id: "stretch-drag-b", eventId: "stretch-drag-b-event", type: "drag", equationId: "three-step-stretch", startTick: 9, endTick: 10,
        dragTargets: [{ tokenIndex: 4, sourceHitId: "hit-stretch" }] },
      { id: "stretch-drag-c", eventId: "stretch-drag-c-event", type: "drag", equationId: "three-step-stretch", startTick: 11, endTick: 12,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-stretch" }] },
      { id: "hit-later-two", eventId: "later-two-hit-event", type: "hit", equationId: "later-two-step", startTick: 13, endTick: 13,
        hitBubbles: [{ tokenIndex: 0, pads: ["right"] }] },
      { id: "later-two-drag-a", eventId: "later-two-drag-a-event", type: "drag", equationId: "later-two-step", startTick: 14, endTick: 15,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-later-two" }] },
      { id: "later-two-drag-b", eventId: "later-two-drag-b-event", type: "drag", equationId: "later-two-step", startTick: 16, endTick: 17,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-later-two" }] },
    ],
  };
  assert.throws(
    () => refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) }),
    /must use a Hit from its own equation row/,
  );
});

test("preserves zero-Drag equations and encounter targets during the math-only refresh", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "jazzmaybach", activityKey: "early-algebra",
    equations: [{
      id: "no-drag", state: "x - 6 = 6",
      tokens: ["x", "-", "6", "=", "6"].map((label, index) => ({ id: `no-drag-token-${index}`, label })),
    }],
    encounters: [{
      id: "no-drag-hit", eventId: "no-drag-event", type: "hit", equationId: "no-drag",
      startTick: 1, endTick: 1,
      hitBubbles: [{ tokenIndex: 0, targetId: "no-drag-token-0", pads: ["topLeft"] }],
    }],
  };
  const refreshed = refreshEarlyAlgebraEquationContent({
    songAssetId: "jazzmaybach", sidecar: JSON.stringify(source),
  });

  assert.deepEqual(refreshed.equations, source.equations);
  assert.deepEqual(refreshed.encounters, source.encounters);
});

test("simplifies an over-range mixed cue-only equation without moving its Hits into a Drag row", () => {
  const cueOnlyEquation = {
    id: "cue-only", state: "x - 6 = 6",
    tokens: ["x", "-", "6", "=", "6"].map((label, index) => ({ id: `cue-only-token-${index}`, label })),
  };
  const cueOnlyHits = Array.from({ length: 7 }, (_, index) => ({
    id: `cue-only-hit-${index + 1}`,
    eventId: `cue-only-hit-event-${index + 1}`,
    type: "hit" as const,
    equationId: cueOnlyEquation.id,
    startTick: index + 4,
    endTick: index + 4,
    hitBubbles: [{ tokenIndex: 0, targetId: "cue-only-token-0", pads: ["topLeft"] }],
  }));
  const source = {
    version: 3, mode: "authored", songAssetId: "jazzmaybach", activityKey: "early-algebra",
    equations: [
      { id: "before", state: "x^2 - 12x + 36 = 0" },
      cueOnlyEquation,
      { id: "after", state: "x^2 - 12x + 36 = 0" },
    ],
    encounters: [
      { id: "before-hit", eventId: "before-hit-event", type: "hit", equationId: "before", startTick: 1, endTick: 1,
        hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
      { id: "before-drag", eventId: "before-drag-event", type: "drag", equationId: "before", startTick: 2, endTick: 3,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "before-hit" }] },
      ...cueOnlyHits,
      { id: "after-hit", eventId: "after-hit-event", type: "hit", equationId: "after", startTick: 11, endTick: 11,
        hitBubbles: [{ tokenIndex: 0, pads: ["topRight"] }] },
      { id: "after-drag", eventId: "after-drag-event", type: "drag", equationId: "after", startTick: 12, endTick: 13,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "after-hit" }] },
    ],
  };

  const refreshed = refreshEarlyAlgebraEquationContent({
    songAssetId: "jazzmaybach", sidecar: JSON.stringify(source),
  });

  const refreshedCueOnly = refreshed.equations.find(({ id }) => id === "cue-only")!;
  assert.equal(refreshedCueOnly.state, "x - 2 = 5");
  assert.deepEqual(refreshedCueOnly.tokens?.map(({ id }) => id), cueOnlyEquation.tokens.map(({ id }) => id));
  const retainedHits = refreshed.encounters.filter((encounter) => encounter.type === "hit" && encounter.equationId === "cue-only");
  assert.equal(retainedHits.length, 7);
  for (const cue of cueOnlyHits) {
    assert.deepEqual(refreshed.encounters.find(({ id }) => id === cue.id), cue);
  }
  const afterHit = refreshed.encounters.find(({ id }) => id === "after-hit");
  const afterDrag = refreshed.encounters.find(({ id }) => id === "after-drag");
  assert.equal(afterHit?.equationId, "jazzmaybach-early-step-02");
  assert.equal(afterDrag?.equationId, afterHit?.equationId);
  assert.notEqual(afterHit?.equationId, "cue-only");
  assert.equal(afterDrag?.type === "drag" ? afterDrag.dragTargets?.[0]?.sourceHitId : undefined, "after-hit");
});

test("all refreshed equation templates stay linear, small, solvable, and targetable", () => {
  const equations: Array<{ id: string; state: string }> = [];
  const encounters: Array<Record<string, unknown>> = [];
  let tick = 1;
  for (let index = 0; index < 16; index += 1) {
    const equationId = `source-${index}`;
    equations.push({ id: equationId, state: "x^2 - 12x + 36 = 0" });
    const hitId = `${equationId}-hit`;
    encounters.push({ id: hitId, eventId: `${hitId}-event`, type: "hit", equationId,
      startTick: tick, endTick: tick, hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] });
    tick += 1;
    encounters.push({ id: `${equationId}-drag`, eventId: `${equationId}-drag-event`,
      type: "drag", equationId, startTick: tick, endTick: tick + 1,
      dragTargets: [{ tokenIndex: 0, sourceHitId: hitId }] });
    tick += 2;
  }
  const refreshed = refreshEarlyAlgebraEquationContent({
    songAssetId: "waves",
    sidecar: JSON.stringify({ version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra", equations, encounters }),
  });
  const oneStepStates = refreshed.equations.map(({ state }) => state);
  const linearSide = (expression: string): [number, number] => expression.replace(/\s/g, "")
    .replace(/-/g, "+-").split("+").filter(Boolean)
    .reduce(([coefficient, constant], term) => {
      if (term.endsWith("x")) {
        const raw = term.slice(0, -1);
        return [coefficient + (raw === "" ? 1 : raw === "-" ? -1 : Number(raw)), constant];
      }
      return [coefficient, constant + Number(term)];
    }, [0, 0]);

  assert.equal(refreshed.equations.length, 16);
  assert.equal(new Set(refreshed.equations.map(({ state }) => state)).size, refreshed.equations.length);
  assert.ok(oneStepStates.slice(0, 8).every((state) => /^x \+/.test(state)));
  assert.ok(oneStepStates.slice(8).every((state) => /^x -/.test(state)));
  assert.equal(new Set(oneStepStates).size, oneStepStates.length);
  for (const equation of refreshed.equations) {
    assert.ok(!/\bx\s*\^\s*2/i.test(equation.state), equation.state);
    assert.ok(!/\b[5-9]\s*x\b/i.test(equation.state), equation.state);
    assert.ok((equation.tokens?.length ?? 0) <= 5, equation.state);
    assert.ok([...equation.state.matchAll(/\d+/g)].every(([literal]) => Number(literal) <= 10), equation.state);
    const [left, right] = equation.state.split("=");
    const [leftCoefficient, leftConstant] = linearSide(left);
    const [rightCoefficient, rightConstant] = linearSide(right);
    assert.equal(rightCoefficient, 0, equation.state);
    const solution = (rightConstant - leftConstant) / (leftCoefficient - rightCoefficient);
    assert.ok(Number.isSafeInteger(solution) && solution > 0 && solution <= 10, equation.state);
    const drags = refreshed.encounters.filter((encounter) => encounter.type === "drag" && encounter.equationId === equation.id);
    assert.equal(drags.length, 1, equation.id);
    const dragTargetIds = drags.map((encounter) => (encounter.dragTargets as Array<{ targetId?: string }>)[0]?.targetId);
    assert.equal(new Set(dragTargetIds).size, dragTargetIds.length, equation.state);
    for (const encounter of refreshed.encounters.filter((candidate) => candidate.equationId === equation.id)) {
      const targets = encounter.type === "hit" ? encounter.hitBubbles as Array<{ tokenIndex: number; targetId?: string }>
        : encounter.type === "spin" ? encounter.spinTargets as Array<{ tokenIndex: number; targetId?: string }>
          : encounter.dragTargets as Array<{ tokenIndex: number; targetId?: string }>;
      assert.ok(targets.every((target) => equation.tokens?.[target.tokenIndex]?.id === target.targetId), encounter.id);
    }
    const dragTargets = drags[0].dragTargets as Array<{ tokenIndex: number; targetId?: string }>;
    assert.equal(dragTargets[0].targetId, equation.tokens?.[dragTargets[0].tokenIndex]?.id, equation.state);
  }
});

test("a published rhythm catalogue can gain two-pad Hits without changing equations or timing", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "garden", activityKey: "early-algebra",
    equations: [{ id: "eq-0", state: "7x + 9 = 3x + 29" }],
    encounters: [
      { id: "featured-hit", eventId: "event-1", type: "hit", equationId: "eq-0", startTick: 2688, endTick: 2688,
        hitBubbles: [{ tokenIndex: 0, padLayoutVersion: 2, pads: ["top"], positions: ["top"] }] },
      { id: "featured-hit-rhythm-hit-1", eventId: "event-2", type: "hit", equationId: "eq-0", startTick: 3456, endTick: 3456,
        hitBubbles: [{ tokenIndex: 2, padLayoutVersion: 2, pads: ["upperRight"], positions: ["upperRight"] }] },
    ],
  };
  const upgraded = upgradeEarlyAlgebraCatalogueHitPads({ songAssetId: "garden", sidecar: JSON.stringify(source) });
  assert.deepEqual(upgraded.equations.map((equation) => equation.state), source.equations.map((equation) => equation.state));
  assert.deepEqual(upgraded.encounters.map((encounter) => [encounter.id, encounter.startTick, encounter.endTick]),
    source.encounters.map((encounter) => [encounter.id, encounter.startTick, encounter.endTick]));
  assert.deepEqual(upgraded.encounters[0].hitBubbles?.[0]?.pads, ["top", "lowerRight"]);
  assert.deepEqual(upgraded.encounters[1].hitBubbles?.[0]?.pads, ["upperRight"]);
  assert.throws(() => upgradeEarlyAlgebraCatalogueHitPads({ songAssetId: "garden", sidecar: JSON.stringify(upgraded) }), /already has its two-pad progression/);
});
