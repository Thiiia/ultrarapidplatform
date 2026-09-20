/**
 * Producer-fixture generator for the authored-playback contract (K3).
 *
 * Every v3 fixture is produced by the ACTUAL current serializer
 * (lib/authored-lesson-serialization) from realistic editor timeline state, not
 * hand-authored JSON. Run with: `node --import tsx test/fixtures/authored-playback/generate.ts`
 * to regenerate the checked-in *.json fixtures in this directory.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  serializeAuthoredLesson,
  type AuthoredTimelineEvent,
} from "../../../lib/authored-lesson-serialization";
import { createLessonClock } from "../../../lib/editor/lesson-timing";

const here = dirname(fileURLToPath(import.meta.url));

const IDENTITY = {
  songAssetId: "waves",
  activityKey: "early-algebra",
  authorId: "author-dev",
  revision: "rev-fixture-1",
};

// Note-free authored chart: Song + SyncTrack + BPM, no note sections.
export const NOTE_FREE_CHART = [
  "[Song]",
  "{",
  '  Name = "Waves"',
  '  Artist = "Grafix"',
  '  Resolution = "480"',
  '  Offset = "0"',
  "}",
  "[SyncTrack]",
  "{",
  "  0 = B 174000",
  "}",
  "[Events]",
  "{",
  "}",
  "[ExpertSingle]",
  "{",
  "}",
  "",
].join("\n");

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

function event(
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
    mechanicInstances: {
      hit: options.instances?.hit ?? [],
      spin: options.instances?.spin ?? [],
      drag: options.instances?.drag ?? [],
    },
  };
}

const clock = createLessonClock(NOTE_FREE_CHART);

function writeFixture(name: string, payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) + "\n";
  writeFileSync(join(here, name), text);
}

// 1. Simultaneous disjoint Hits followed by serialized mechanics; three ordered equations; explicit stop.
const overlapping = serializeAuthoredLesson(
  [
    event("event-1", 4, { hit: 2 }, {
      equation: equation("eq-1", ["3", "+", "4", "=", "7"]),
      instances: {
        hit: [
          instance("inst-hit-1", { tick: 4, hitBubbles: [{ tokenIndex: 0, positions: ["topLeft"], pads: ["topLeft"] }] }),
          instance("inst-hit-2", { tick: 4, hitBubbles: [{ tokenIndex: 2, positions: ["bottomRight"], pads: ["bottomRight"] }] }),
        ],
      },
    }),
    event("event-2", 6.5, { spin: 1 }, {
      endTick: 9,
      equation: equation("eq-2", ["X", "+", "2", "=", "9"]),
      instances: {
        spin: [instance("inst-spin-1", { tick: 6.5, endTick: 9, spinTargets: [{ tokenIndex: 0 }] })],
      },
    }),
    event("event-3", 10, { drag: 1 }, {
      endTick: 12.5,
      equation: equation("eq-2", ["X", "+", "2", "=", "9"]),
      instances: {
        drag: [instance("inst-drag-1", { tick: 10, endTick: 12.5, dragTargets: [{ tokenIndex: 2, sourceHitId: "inst-hit-1" }] })],
      },
    }),
    event("event-4", 12, {}, { equation: equation("eq-3", ["5", "=", "Y"]) }),
  ],
  IDENTITY,
  clock,
  17,
);
writeFixture("overlapping-mechanics.v3.json", overlapping);
writeFixture("note-free.chart", NOTE_FREE_CHART);

export { overlapping };
console.log("wrote overlapping-mechanics.v3.json + note-free.chart");
