import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

type TargetFixture = {
  tokenIndex: number;
  targetId?: string;
  sourceHitId?: string;
  padLayoutVersion?: number;
  positions?: string[];
  pads?: string[];
};

type EncounterFixture = {
  id: string;
  eventId: string;
  type: "hit" | "spin" | "drag";
  equationId: string;
  startTick: number;
  endTick: number;
  hitBubbles?: TargetFixture[];
  spinTargets?: TargetFixture[];
  dragTargets?: TargetFixture[];
};

type GemFixture = {
  gemId: string;
  unitIndex: number;
  spinEncounterId: string;
  dragEncounterId: string;
  destination: { part: "part-a" | "part-b"; slotIndex: number };
};

type Fixture = {
  fixtureVersion: 1;
  testTempoMap: { resolution: number; segments: Array<{ startTick: number; beatsPerMinute: number }> };
  validLesson: {
    version: number;
    mode: string;
    activityKey: string;
    stopAtSeconds: number;
    equations: Array<{
      id: string;
      state: string;
      tokens: Array<{ id: string; label: string }>;
    }>;
    encounters: EncounterFixture[];
    numberBondSequenceVersion: number;
    numberBondGems: GemFixture[];
  };
  malformedCases: Array<{ id: string; mutation: Record<string, unknown> }>;
};

const EXPECTED_FIXTURE_SHA256_LF = "08d47028529c372dc36fc6c6c6b3a8ee714b0efc211aef7e0aa80c339e6f133c";
const fixturePath = fileURLToPath(new URL(
  "../contracts/number-bonds/sequence-v1/fixtures.json",
  import.meta.url,
));
const fixtureJson = readFileSync(fixturePath, "utf8");
const normalizeLf = (value: string) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const fixture = JSON.parse(fixtureJson) as Fixture;

test("Number Bonds sequence v1 fixture has the shared normalized-LF digest", () => {
  assert.equal(
    createHash("sha256").update(normalizeLf(fixtureJson)).digest("hex"),
    EXPECTED_FIXTURE_SHA256_LF,
  );
});

test("the canonical 5 = 2 + 3 package keeps v3 and defines five complete linked unit gems", () => {
  const lesson = fixture.validLesson;
  assert.equal(fixture.fixtureVersion, 1);
  assert.equal(lesson.version, 3);
  assert.equal(lesson.mode, "authored");
  assert.equal(lesson.activityKey, "number-bonds");
  assert.equal(lesson.numberBondSequenceVersion, 1);
  assert.equal(lesson.equations.length, 1);
  assert.equal(lesson.equations[0].state, "5 = 2 + 3");
  assert.equal(lesson.numberBondGems.length, 5);

  const encountersById = new Map(lesson.encounters.map((encounter) => [encounter.id, encounter]));
  const encountersByType = {
    hit: lesson.encounters.filter((encounter) => encounter.type === "hit"),
    spin: lesson.encounters.filter((encounter) => encounter.type === "spin"),
    drag: lesson.encounters.filter((encounter) => encounter.type === "drag"),
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(encountersByType).map(([type, rows]) => [type, rows.length])),
    { hit: 5, spin: 5, drag: 5 },
  );

  const gemIds = lesson.numberBondGems.map((gem) => gem.gemId);
  const unitIndices = lesson.numberBondGems.map((gem) => gem.unitIndex);
  assert.equal(new Set(gemIds).size, 5);
  assert.deepEqual(unitIndices, [0, 1, 2, 3, 4]);

  const referencedSpins = new Set<string>();
  const referencedDrags = new Set<string>();
  const referencedHits = new Set<string>();
  const occupiedSlots = new Set<string>();
  const windows = lesson.encounters.map((encounter) => {
    const startSeconds = encounter.startTick * 60 / fixture.testTempoMap.resolution /
      fixture.testTempoMap.segments[0].beatsPerMinute;
    const endSeconds = encounter.endTick * 60 / fixture.testTempoMap.resolution /
      fixture.testTempoMap.segments[0].beatsPerMinute;
    const leadSeconds = encounter.type === "drag" ? 1.25 : 0.75;
    const activeEndSeconds = encounter.type === "hit" ? startSeconds + 0.675 : endSeconds;
    return {
      id: encounter.id,
      start: Math.max(0, startSeconds - leadSeconds),
      end: activeEndSeconds,
    };
  }).sort((left, right) => left.start - right.start);

  assert.ok(windows[0].start >= 6, "first presented action must begin at or after 6 seconds");
  for (let index = 1; index < windows.length; index += 1) {
    assert.ok(
      windows[index - 1].end <= windows[index].start,
      `${windows[index - 1].id} overlaps ${windows[index].id}`,
    );
  }

  for (const [index, gem] of lesson.numberBondGems.entries()) {
    assert.equal(gem.unitIndex, index);
    assert.ok(gem.gemId.trim().length > 0);

    const spin = encountersById.get(gem.spinEncounterId);
    const drag = encountersById.get(gem.dragEncounterId);
    assert.ok(spin, `missing Spin ${gem.spinEncounterId}`);
    assert.ok(drag, `missing Drag ${gem.dragEncounterId}`);
    assert.equal(spin.type, "spin");
    assert.equal(drag.type, "drag");
    assert.equal(spin.equationId, lesson.equations[0].id);
    assert.equal(drag.equationId, lesson.equations[0].id);
    referencedSpins.add(spin.id);
    referencedDrags.add(drag.id);

    const spinTargets = spin.spinTargets ?? [];
    const dragTargets = drag.dragTargets ?? [];
    assert.equal(spinTargets.length, 1);
    assert.equal(dragTargets.length, 1);
    assert.equal(spinTargets[0].targetId, "whole-five");

    const dragTarget = dragTargets[0];
    assert.ok(dragTarget.sourceHitId);
    const hit = encountersById.get(dragTarget.sourceHitId);
    assert.ok(hit, `missing linked Hit ${dragTarget.sourceHitId}`);
    assert.equal(hit.type, "hit");
    assert.equal(hit.equationId, lesson.equations[0].id);
    assert.ok(hit.startTick < spin.startTick && spin.endTick < drag.startTick);
    referencedHits.add(hit.id);

    const hitTargets = hit.hitBubbles ?? [];
    assert.equal(hitTargets.length, 1);
    assert.equal(hitTargets[0].targetId, "whole-five");
    assert.equal(hitTargets[0].padLayoutVersion, 2);
    assert.deepEqual(hitTargets[0].pads, ["top"]);
    assert.deepEqual(hitTargets[0].positions, ["top"]);

    const expectedPart = index < 2 ? "part-a" : "part-b";
    const expectedSlot = index < 2 ? index : index - 2;
    const expectedTokenIndex = index < 2 ? 2 : 4;
    const expectedTargetId = index < 2 ? "part-a-two" : "part-b-three";
    assert.equal(gem.destination.part, expectedPart);
    assert.equal(gem.destination.slotIndex, expectedSlot);
    assert.equal(dragTarget.tokenIndex, expectedTokenIndex);
    assert.equal(dragTarget.targetId, expectedTargetId);

    const slotKey = `${gem.destination.part}:${gem.destination.slotIndex}`;
    assert.equal(occupiedSlots.has(slotKey), false, `duplicate destination ${slotKey}`);
    occupiedSlots.add(slotKey);
  }

  assert.equal(referencedHits.size, 5);
  assert.equal(referencedSpins.size, 5);
  assert.equal(referencedDrags.size, 5);
  assert.equal(occupiedSlots.size, 5);
  assert.ok(lesson.stopAtSeconds >= 76, "stop time includes the final Hit interaction tail");
});

test("the shared fixture records malformed sequence mutations before adapter implementation", () => {
  const ids = fixture.malformedCases.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set([
    "missing-hit",
    "missing-spin",
    "missing-drag",
    "duplicate-gem-id",
    "duplicate-unit-index",
    "duplicate-destination-slot",
    "orphan-action",
    "wrong-equation",
    "invalid-pad",
    "invalid-destination-part",
    "invalid-destination-slot",
    "backwards-timing",
    "overlapping-actionable-gem",
    "action-after-stop",
    "unknown-extension-version",
  ]));
  for (const item of fixture.malformedCases) {
    assert.equal(typeof item.mutation.kind, "string", `${item.id} has a mutation kind`);
  }
});
