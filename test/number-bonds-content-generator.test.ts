import assert from "node:assert/strict";
import test from "node:test";

import { createLessonClock } from "../lib/editor/lesson-timing";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { resolveAuthoredHitPadTarget } from "../lib/authored-hit-pad-layout";
import {
  generateNumberBondsAuthoredLesson,
  getNumberBondsCatalogueEquation,
  NUMBER_BONDS_EQUATION_CATALOGUE,
  type NumberBondsLessonDefinition,
  type NumberBondsRhythmSource,
} from "../lib/number-bonds-content-generator";
import type { SupportedRhythmDifficulty } from "../lib/chart-semantics";

type Tempo = { tick: number; bpmMilli: number };

function chartForCueSeconds(
  cueSeconds: readonly number[],
  options: { tempos?: readonly Tempo[]; difficulty?: SupportedRhythmDifficulty } = {},
) {
  const tempos = options.tempos ?? [{ tick: 0, bpmMilli: 120000 }];
  const difficulty = options.difficulty ?? "ExpertSingle";
  const makeChart = (notes: string) => [
    "[Song]",
    "{",
    "  Resolution = 480",
    "  Offset = 0",
    "}",
    "[SyncTrack]",
    "{",
    ...tempos.map((tempo) => `  ${tempo.tick} = B ${tempo.bpmMilli}`),
    "}",
    `[${difficulty}]`,
    "{",
    notes,
    "}",
  ].join("\n");
  const clock = createLessonClock(makeChart(""));
  const ticks = cueSeconds.map((seconds) => clock.toTick(seconds));
  return {
    content: makeChart(ticks.map((tick) => `  ${tick} = N 0 0`).join("\n")),
    ticks,
    clock,
  };
}

function source(songAssetId: string, revision: string, sourceActivityKey: "early-algebra" | "equations" = "early-algebra"): NumberBondsRhythmSource {
  return {
    songAssetId,
    activityKey: sourceActivityKey,
    revision,
    chartSha256: "a".repeat(64),
    audioSha256: "b".repeat(64),
  };
}

function definition(overrides: Partial<NumberBondsLessonDefinition> = {}): NumberBondsLessonDefinition {
  const chart = chartForCueSeconds([2, 8, 15.5, 23, 30.5], {
    tempos: [{ tick: 0, bpmMilli: 120000 }, { tick: 7680, bpmMilli: 60000 }],
  });
  return {
    songAssetId: "song-jazz",
    equation: getNumberBondsCatalogueEquation("bond-3-1-2"),
    rhythmSource: source("song-jazz", "c9587d12-9a90-4509-9b74-5655caa05ea9"),
    rhythmDifficulty: "ExpertSingle",
    chartContent: chart.content,
    durationSeconds: 42.5,
    cueSelectionConstraints: { minimumStartSeconds: 8 },
    ...overrides,
  };
}

test("the reusable catalogue covers every ordered positive-part bond through 20", () => {
  assert.equal(NUMBER_BONDS_EQUATION_CATALOGUE.length, 190);
  assert.ok(NUMBER_BONDS_EQUATION_CATALOGUE.some(({ id }) => id === "bond-20-1-19"));
  assert.ok(NUMBER_BONDS_EQUATION_CATALOGUE.some(({ id }) => id === "bond-13-10-3"));
  const first = getNumberBondsCatalogueEquation("bond-5-2-3");
  first.tokens[0].label = "99";
  const next = getNumberBondsCatalogueEquation("bond-5-2-3");
  assert.equal(next.tokens[0].label, "5");
  assert.equal(next.tokens[0].id, "bond-5-2-3-token-0");
});

test("generates deterministic cues from the selected difficulty across a tempo change and preserves source provenance", () => {
  const input = definition();
  const generated = generateNumberBondsAuthoredLesson(input);
  const repeated = generateNumberBondsAuthoredLesson(input);

  assert.deepEqual(generated, repeated);
  assert.deepEqual(generated.provenance.selectedCueSeconds, [8, 15.5, 23]);
  assert.deepEqual(generated.provenance.selectedCueTicks, [7680, 11280, 14880]);
  assert.deepEqual(
    generated.provenance.selectedCueTicks.map((tick) => createLessonClock(input.chartContent).toSeconds(tick)),
    generated.provenance.selectedCueSeconds,
  );
  assert.equal(generated.provenance.sourceRevision, input.rhythmSource.revision);
  assert.equal(generated.provenance.chartSha256, input.rhythmSource.chartSha256);
  assert.equal(generated.provenance.audioSha256, input.rhythmSource.audioSha256);
  assert.equal(generated.provenance.rhythmDifficulty, "ExpertSingle");
  assert.equal(generated.draft.activityKey, "number-bonds");
  assert.equal(generated.draft.version, 3);
  assert.equal(generated.draft.encounters.length, 3);
  assert.deepEqual(generated.draft.encounters.map((encounter) => encounter.startTick), generated.provenance.selectedCueTicks);
});

test("generates valid lessons for separate synthetic chart rhythms without making new chart timing", () => {
  const firstChart = chartForCueSeconds([8, 15.5, 23, 30.5], {
    tempos: [{ tick: 0, bpmMilli: 120000 }, { tick: 7680, bpmMilli: 60000 }],
  });
  const secondChart = chartForCueSeconds([3, 11, 19, 27, 35, 43], {
    tempos: [{ tick: 0, bpmMilli: 90000 }],
    difficulty: "MediumSingle",
  });
  const first = generateNumberBondsAuthoredLesson(definition({
    songAssetId: "song-one",
    rhythmSource: source("song-one", "c9587d12-9a90-4509-9b74-5655caa05ea9"),
    chartContent: firstChart.content,
    durationSeconds: 42.5,
  }));
  const second = generateNumberBondsAuthoredLesson(definition({
    songAssetId: "song-two",
    equation: getNumberBondsCatalogueEquation("bond-5-2-3"),
    rhythmSource: source("song-two", "11111111-1111-4111-8111-111111111111", "equations"),
    rhythmDifficulty: "MediumSingle",
    chartContent: secondChart.content,
    durationSeconds: 47,
    cueSelectionConstraints: { minimumStartSeconds: 0 },
  }));

  assert.equal(first.draft.encounters.length, 3);
  assert.deepEqual(second.provenance.selectedCueSeconds, [3, 11, 19, 27, 35]);
  assert.equal(second.draft.encounters.length, 5);
  assert.equal(second.draft.songAssetId, "song-two");
  assert.equal(second.provenance.sourceActivityKey, "equations");
});

test("reordered equations target the whole token and use only valid current player pads", () => {
  const chart = chartForCueSeconds([8, 15.5, 23, 30.5, 38], {
    tempos: [{ tick: 0, bpmMilli: 120000 }, { tick: 7680, bpmMilli: 60000 }],
  });
  const reorderedEquation = {
    id: "bond-5-reordered",
    tokens: ["3", "+", "2", "=", "5"].map((label, index) => ({ id: `reordered-${index}`, label })),
  };
  const generated = generateNumberBondsAuthoredLesson(definition({
    equation: reorderedEquation,
    chartContent: chart.content,
    durationSeconds: 50,
    padChoreography: "alternating-hex",
  }));

  assert.equal(generated.draft.encounters.length, 5);
  for (const [index, encounter] of generated.draft.encounters.entries()) {
    const bubble = encounter.hitBubbles?.[0];
    assert.equal(bubble?.tokenIndex, 4);
    assert.equal(bubble?.targetId, "reordered-4");
    assert.deepEqual(resolveAuthoredHitPadTarget(bubble ?? {}), [index === 0 ? 0 : index === 1 ? 3 : index === 2 ? 1 : index === 3 ? 4 : 2]);
  }
});

test("the generated v3 sidecar publishes and round-trips without rhythm sidecar data", () => {
  const input = definition();
  const generated = generateNumberBondsAuthoredLesson(input);
  const published = prepareAuthoredLessonForPublication({
    sidecarContent: generated.sidecarContent,
    identity: {
      songAssetId: input.songAssetId,
      activityKey: "number-bonds",
      authorId: "author-1",
      revision: "22222222-2222-4222-8222-222222222222",
    },
    runtimeClock: createLessonClock(input.chartContent),
  });
  const parsed = parseAuthoredLessonDraft(JSON.parse(published.content), { activityKey: "number-bonds" });

  assert.equal(parsed.authorId, "author-1");
  assert.equal(parsed.revision, "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(parsed.encounters.map((encounter) => encounter.startTick), generated.provenance.selectedCueTicks);
  assert.equal(published.counts.encounters, 3);
  assert.equal(generated.sidecarContent.includes("sourceSidecar"), false);
  assert.equal(generated.sidecarContent.includes(input.rhythmSource.revision), false);
  assert.equal(generated.sidecarContent.includes(input.rhythmSource.chartSha256), false);
});

test("a 20-bond lesson keeps one unit gem and one authored Hit per number unit", () => {
  const cueSeconds = Array.from({ length: 20 }, (_, index) => 8 + (index * 7.5));
  const chart = chartForCueSeconds(cueSeconds);
  const equation = getNumberBondsCatalogueEquation("bond-20-1-19");
  const generated = generateNumberBondsAuthoredLesson(definition({
    equation,
    chartContent: chart.content,
    durationSeconds: 165,
  }));

  assert.equal(generated.draft.equations[0]?.tokens?.[0]?.label, "20");
  assert.equal(generated.draft.encounters.length, 20);
  assert.ok(generated.draft.encounters.every((encounter) =>
    encounter.hitBubbles?.[0]?.targetId === equation.tokens[0]?.id));
  assert.equal(generated.draft.encounters[0]?.hitBubbles?.[0]?.tokenIndex, 0);
  assert.deepEqual(
    generated.draft.encounters.map((encounter) =>
      resolveAuthoredHitPadTarget(encounter.hitBubbles?.[0] ?? {})),
    Array.from({ length: 20 }, (_, index) => [index % 6]),
  );
  assert.equal(generated.provenance.selectedCueSeconds.length, 20);
  assert.ok(generated.provenance.selectedCueSeconds.every((seconds, index, values) =>
    index === 0 || seconds - values[index - 1]! >= 7.5));
});

test("refuses insufficient cue space, above-20 bonds, and unverifiable rhythm provenance", () => {
  const shortChart = chartForCueSeconds([1, 8, 14, 21]);
  assert.throws(() => generateNumberBondsAuthoredLesson(definition({
    chartContent: shortChart.content,
    durationSeconds: 33,
  })), /does not contain 3/);

  const aboveTwenty = {
    id: "bond-21",
    tokens: ["21", "=", "1", "+", "20"].map((label, index) => ({ id: `bond-21-${index}`, label })),
  };
  assert.throws(() => generateNumberBondsAuthoredLesson(definition({ equation: aboveTwenty })), /whole 2–20/);
  assert.throws(() => generateNumberBondsAuthoredLesson(definition({
    rhythmSource: { ...source("song-jazz", "c9587d12-9a90-4509-9b74-5655caa05ea9"), chartSha256: "missing" },
  })), /verified chart or audio hash/);
  assert.throws(() => generateNumberBondsAuthoredLesson(definition({
    rhythmSource: { ...source("song-jazz", "c9587d12-9a90-4509-9b74-5655caa05ea9"), activityKey: "number-bonds" },
  })), /another activity/);
  assert.throws(() => generateNumberBondsAuthoredLesson(definition({
    rhythmSource: source("different-song", "c9587d12-9a90-4509-9b74-5655caa05ea9"),
  })), /same song/);
});
