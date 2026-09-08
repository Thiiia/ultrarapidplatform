import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { validateLessonContent } from "../lib/lesson-content";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "authored-playback");

function readFixture(name: string) {
  return readFileSync(join(fixtures, name), "utf8");
}

test("producer fixture: note-free chart with authored overlapping content validates", () => {
  const chart = readFixture("note-free.chart");
  const sidecar = readFixture("overlapping-mechanics.v3.json");

  assert.doesNotThrow(() => validateLessonContent(chart, sidecar));

  const parsed = parseAuthoredLessonDraft(JSON.parse(sidecar));
  // 2 hits + 1 spin + 1 drag = 4 encounters; 3 ordered equations; explicit stop.
  assert.equal(parsed.encounters.length, 4);
  assert.equal(parsed.equations.length, 3);
  assert.equal(parsed.stopAtSeconds, 17);
  assert.deepEqual(
    parsed.encounters.map((encounter) => encounter.type),
    ["hit", "hit", "spin", "drag"],
  );
  // 174 BPM, resolution 480: 4s -> 5568 ticks.
  assert.equal(parsed.encounters[0].startTick, 5568);
  // Simultaneous spin and drag coexist at the same event and tick.
  const spin = parsed.encounters.find((encounter) => encounter.type === "spin");
  const drag = parsed.encounters.find((encounter) => encounter.type === "drag");
  assert.equal(spin?.eventId, drag?.eventId);
  assert.equal(spin?.startTick, drag?.startTick);
});

test("malformed counterparts are rejected explicitly", () => {
  const base = JSON.parse(readFixture("overlapping-mechanics.v3.json"));

  const cases: Array<[string, unknown, RegExp]> = [
    ["missing mode", { ...base, mode: undefined }, /version or mode/i],
    ["unsupported version", { ...base, version: 1 }, /version or mode/i],
    ["missing encounters array", { ...base, encounters: undefined }, /encounters must be an array/i],
    ["missing equations array", { ...base, equations: undefined }, /equations must be an array/i],
    ["fractional tick", { ...base, encounters: [{ ...base.encounters[0], startTick: 5568.5 }] }, /non-negative integer/i],
    ["duplicate encounter id", { ...base, encounters: [...base.encounters, base.encounters[0]] }, /duplicate authored encounter id/i],
    ["missing equation reference", { ...base, encounters: [{ ...base.encounters[0], equationId: "eq-missing" }] }, /references missing equation/i],
    ["invalid pad", { ...base, encounters: [{ ...base.encounters[0], hitBubbles: [{ tokenIndex: 0, pads: ["center"] }] }] }, /one of/i],
    ["start after end", { ...base, encounters: [{ ...base.encounters[2], startTick: 99999 }] }, /startTick must not exceed endTick/i],
  ];

  for (const [label, payload, matcher] of cases) {
    assert.throws(() => parseAuthoredLessonDraft(payload), matcher, label);
  }
});

test("legacy v1 fixture content is rejected as an authored payload", () => {
  // A version-1 sidecar shape (events array, no mode) must fail v3 authored parse.
  const legacyV1 = { version: 1, events: [{ tick: 192, type: "ALG_MECHANIC", mechanic: "hit" }] };
  assert.throws(() => parseAuthoredLessonDraft(legacyV1), /version or mode/i);
});
