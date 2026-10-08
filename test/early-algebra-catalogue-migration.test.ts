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
  assert.deepEqual(migrated.equations.map((equation) => equation.state), ["x + 2 = 7", "x + 3 = 11"]);
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

test("refreshes Early Algebra math to match authored Drag steps without changing cue identity or timing", () => {
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
      { id: "drag-two-a", eventId: "event-5", type: "drag", equationId: "two-step", startTick: 7, endTick: 8,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-two" }] },
      { id: "drag-two-b", eventId: "event-6", type: "drag", equationId: "two-step", startTick: 9, endTick: 10,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-two" }] },
      { id: "hit-three", eventId: "event-7", type: "hit", equationId: "three-step", startTick: 11, endTick: 11,
        hitBubbles: [{ tokenIndex: 0, pads: ["right"] }] },
      { id: "drag-three-a", eventId: "event-8", type: "drag", equationId: "three-step", startTick: 12, endTick: 13,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-three" }] },
      { id: "drag-three-b", eventId: "event-9", type: "drag", equationId: "three-step", startTick: 14, endTick: 15,
        dragTargets: [{ tokenIndex: 4, sourceHitId: "hit-three" }] },
      { id: "drag-three-c", eventId: "event-10", type: "drag", equationId: "three-step", startTick: 16, endTick: 17,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-three" }] },
    ],
  };
  const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) });

  assert.match(refreshed.equations[0].state, /^x \+/);
  assert.match(refreshed.equations[1].state, /^x \+/);
  assert.match(refreshed.equations[2].state, /^x \+/);
  assert.deepEqual(refreshed.equations.map(({ id }) => id), source.equations.map(({ id }) => id));
  assert.deepEqual(refreshed.encounters.map(({ id, eventId, type, equationId, startTick, endTick }) =>
    [id, eventId, type, equationId, startTick, endTick]),
  source.encounters.map(({ id, eventId, type, equationId, startTick, endTick }) =>
    [id, eventId, type, equationId, startTick, endTick]));
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
  const twoStepDragIds = refreshed.encounters.filter((encounter) => encounter.type === "drag" && encounter.equationId === "two-step")
    .map((encounter) => encounter.dragTargets?.[0].targetId);
  const threeStepDragIds = refreshed.encounters.filter((encounter) => encounter.type === "drag" && encounter.equationId === "three-step")
    .map((encounter) => encounter.dragTargets?.[0].targetId);
  assert.equal(new Set(twoStepDragIds).size, 2);
  assert.equal(new Set(threeStepDragIds).size, 3);
  assert.equal(refreshed.encounters.find(({ id }) => id === "drag-one")?.dragTargets?.[0].sourceHitId, "hit-one");
});

test("refreshes equations in song order and introduces multiplication before mixed two-step rows", () => {
  const source = {
    version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra",
    // Deliberately keep the serialized equation list out of song order.
    equations: [
      { id: "two-step-after-multiplication", state: "x^2 - 12x + 36 = 0" },
      { id: "one-step-multiplication", state: "x^2 - 12x + 36 = 0" },
      { id: "two-step-additive", state: "x^2 - 12x + 36 = 0" },
      { id: "one-step-additive", state: "x^2 - 12x + 36 = 0" },
    ],
    encounters: [
      { id: "hit-add", eventId: "event-add-hit", type: "hit", equationId: "one-step-additive", startTick: 1, endTick: 1,
        hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] },
      { id: "drag-add", eventId: "event-add-drag", type: "drag", equationId: "one-step-additive", startTick: 2, endTick: 3,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-add" }] },
      { id: "hit-additive-two", eventId: "event-additive-two-hit", type: "hit", equationId: "two-step-additive", startTick: 4, endTick: 4,
        hitBubbles: [{ tokenIndex: 0, pads: ["topRight"] }] },
      { id: "drag-additive-two-a", eventId: "event-additive-two-a", type: "drag", equationId: "two-step-additive", startTick: 5, endTick: 6,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-additive-two" }] },
      { id: "drag-additive-two-b", eventId: "event-additive-two-b", type: "drag", equationId: "two-step-additive", startTick: 7, endTick: 8,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-additive-two" }] },
      { id: "hit-multiplication", eventId: "event-multiplication-hit", type: "hit", equationId: "one-step-multiplication", startTick: 9, endTick: 9,
        hitBubbles: [{ tokenIndex: 0, pads: ["left"] }] },
      { id: "drag-multiplication", eventId: "event-multiplication-drag", type: "drag", equationId: "one-step-multiplication", startTick: 10, endTick: 11,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-multiplication" }] },
      { id: "hit-mixed-two", eventId: "event-mixed-two-hit", type: "hit", equationId: "two-step-after-multiplication", startTick: 12, endTick: 12,
        hitBubbles: [{ tokenIndex: 0, pads: ["right"] }] },
      { id: "drag-mixed-two-a", eventId: "event-mixed-two-a", type: "drag", equationId: "two-step-after-multiplication", startTick: 13, endTick: 14,
        dragTargets: [{ tokenIndex: 2, sourceHitId: "hit-mixed-two" }] },
      { id: "drag-mixed-two-b", eventId: "event-mixed-two-b", type: "drag", equationId: "two-step-after-multiplication", startTick: 15, endTick: 16,
        dragTargets: [{ tokenIndex: 0, sourceHitId: "hit-mixed-two" }] },
    ],
  };
  const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) });
  const stateById = new Map(refreshed.equations.map(({ id, state }) => [id, state]));

  assert.match(stateById.get("one-step-additive") ?? "", /^x [+-] \d+ =/);
  assert.match(stateById.get("two-step-additive") ?? "", /^x \+ \d+ \+ \d+ =/);
  assert.match(stateById.get("one-step-multiplication") ?? "", /^[234]x =/);
  assert.match(stateById.get("two-step-after-multiplication") ?? "", /^[234]x [+-] \d+ =/);
  assert.deepEqual(refreshed.equations.map(({ id }) => id), source.equations.map(({ id }) => id));
});

test("a three-step stretch stays additive until a one-step multiplication row appears", () => {
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
  const refreshed = refreshEarlyAlgebraEquationContent({ songAssetId: "waves", sidecar: JSON.stringify(source) });
  const stateById = new Map(refreshed.equations.map(({ id, state }) => [id, state]));

  assert.match(stateById.get("three-step-stretch") ?? "", /^x \+ \d+ \+ \d+ =/);
  assert.match(stateById.get("later-two-step") ?? "", /^x \+ \d+ \+ \d+ =/);
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

test("all refreshed equation templates stay linear, small, solvable, and targetable", () => {
  const equations: Array<{ id: string; state: string }> = [];
  const encounters: Array<Record<string, unknown>> = [];
  const expectedDragCounts = new Map<string, number>();
  let tick = 1;
  for (const { prefix, equationCount, dragCount } of [
    { prefix: "one", equationCount: 16, dragCount: 1 },
    { prefix: "two", equationCount: 12, dragCount: 2 },
    { prefix: "three", equationCount: 10, dragCount: 3 },
  ]) {
    for (let index = 0; index < equationCount; index += 1) {
      const equationId = `${prefix}-${index}`;
      equations.push({ id: equationId, state: "x^2 - 12x + 36 = 0" });
      expectedDragCounts.set(equationId, dragCount);
      for (let dragIndex = 0; dragIndex < dragCount; dragIndex += 1) {
        const hitId = `${equationId}-hit-${dragIndex}`;
        encounters.push({ id: hitId, eventId: `${hitId}-event`, type: "hit", equationId,
          startTick: tick, endTick: tick, hitBubbles: [{ tokenIndex: 0, pads: ["topLeft"] }] });
        tick += 1;
        encounters.push({ id: `${equationId}-drag-${dragIndex}`, eventId: `${equationId}-drag-${dragIndex}-event`,
          type: "drag", equationId, startTick: tick, endTick: tick + 1,
          dragTargets: [{ tokenIndex: 0, sourceHitId: hitId }] });
        tick += 2;
      }
    }
  }
  const refreshed = refreshEarlyAlgebraEquationContent({
    songAssetId: "waves",
    sidecar: JSON.stringify({ version: 3, mode: "authored", songAssetId: "waves", activityKey: "early-algebra", equations, encounters }),
  });
  const oneStepStates = refreshed.equations.slice(0, 16).map(({ state }) => state);
  const linearSide = (expression: string): [number, number] => expression.replace(/\s/g, "")
    .replace(/-/g, "+-").split("+").filter(Boolean)
    .reduce(([coefficient, constant], term) => {
      if (term.endsWith("x")) {
        const raw = term.slice(0, -1);
        return [coefficient + (raw === "" ? 1 : raw === "-" ? -1 : Number(raw)), constant];
      }
      return [coefficient, constant + Number(term)];
    }, [0, 0]);

  assert.equal(refreshed.equations.length, 38);
  assert.match(oneStepStates[0], /^x \+/);
  assert.match(oneStepStates[1], /^[234]x =/);
  assert.match(oneStepStates[2], /^x -/);
  assert.match(oneStepStates[3], /^[234]x =/);
  for (const equation of refreshed.equations) {
    assert.ok(!/\bx\s*\^\s*2/i.test(equation.state), equation.state);
    assert.ok((equation.tokens?.length ?? 0) <= 7, equation.state);
    assert.ok([...equation.state.matchAll(/\d+/g)].every(([literal]) => Number(literal) <= 12), equation.state);
    const [left, right] = equation.state.split("=");
    const [leftCoefficient, leftConstant] = linearSide(left);
    const [rightCoefficient, rightConstant] = linearSide(right);
    assert.equal(rightCoefficient, 0, equation.state);
    const solution = (rightConstant - leftConstant) / (leftCoefficient - rightCoefficient);
    assert.ok(Number.isSafeInteger(solution) && solution > 0 && solution <= 8, equation.state);
    const drags = refreshed.encounters.filter((encounter) => encounter.type === "drag" && encounter.equationId === equation.id);
    assert.equal(drags.length, expectedDragCounts.get(equation.id), equation.id);
    const dragTargetIds = drags.map((encounter) => (encounter.dragTargets as Array<{ targetId?: string }>)[0]?.targetId);
    assert.equal(new Set(dragTargetIds).size, dragTargetIds.length, equation.state);
    for (const encounter of refreshed.encounters.filter((candidate) => candidate.equationId === equation.id)) {
      const targets = encounter.type === "hit" ? encounter.hitBubbles as Array<{ tokenIndex: number; targetId?: string }>
        : encounter.type === "spin" ? encounter.spinTargets as Array<{ tokenIndex: number; targetId?: string }>
          : encounter.dragTargets as Array<{ tokenIndex: number; targetId?: string }>;
      assert.ok(targets.every((target) => equation.tokens?.[target.tokenIndex]?.id === target.targetId), encounter.id);
    }
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
