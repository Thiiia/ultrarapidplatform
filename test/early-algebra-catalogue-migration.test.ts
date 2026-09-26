import assert from "node:assert/strict";
import test from "node:test";

import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { migrateEarlyAlgebraCatalogueSong } from "../lib/early-algebra-catalogue-migration";
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
  assert.deepEqual(migrated.equations.map((equation) => equation.state), ["x + 4 = 10", "3x + 7 = 31"]);
  assert.ok(migrated.encounters.length > source.encounters.length);
  assert.ok(source.encounters.every(({ id }) => migrated.encounters.some((encounter) => encounter.id === id)));
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-drag")?.endTick, 5376);
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-drag")?.dragTargets?.[0]?.sourceHitId, "first-hit");
  assert.ok(migrated.encounters.filter((encounter) => encounter.type === "hit").every((encounter) =>
    encounter.hitBubbles?.length === 1 && encounter.hitBubbles[0].padLayoutVersion === 2));
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "first-hit")?.hitBubbles?.[0]?.pads?.[0], "top");
  assert.equal(migrated.encounters.find((encounter) => encounter.id === "second-hit")?.hitBubbles?.[0]?.pads?.[0], "upperLeft");
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
