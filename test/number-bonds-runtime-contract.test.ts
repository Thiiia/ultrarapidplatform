import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getAuthoredActivityContractIssues,
  getNumberBondsWholeTokenIndex,
  NUMBER_BONDS_TIMING_POLICY,
  validateAuthoredActivityTiming,
  type NumberBondsTimingIssue,
} from "../lib/activity-authoring-capabilities";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import {
  PLAYER_HEX_AUTHORED_HIT_PADS,
  resolveAuthoredHitPadSlot,
  resolvePlayerHexHitPadPixelOffset,
} from "../lib/authored-hit-pad-layout";
import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { serializeAuthoredLesson } from "../lib/authored-lesson-serialization";
import {
  evaluateEncounterReadiness,
  evaluateLessonPublishReadiness,
} from "../lib/guided-authored-encounter";
import {
  buildNumberBondsJazzPilotDraft,
} from "../lib/number-bonds-jazz-pilot";
import type {
  AuthoredSavedEquation,
  AuthoredTimelineEvent,
} from "../lib/authored-lesson-serialization";

type RuntimeContractFixture = {
  version: number;
  activityKey: string;
  timingPolicy: typeof NUMBER_BONDS_TIMING_POLICY;
  targetPolicy: string;
  hitCountPolicy: string;
  hitPadLayouts: Array<{
    layoutVersion: number;
    pad: string;
    expectedSlot: number;
    label?: string;
    xUnit?: number;
    yUnit?: number;
  }>;
  cases: Array<{
    id: string;
    activityKey?: string;
    encounters: Array<{ id: string; type: "hit" | "spin" | "drag"; startSeconds: number }>;
    stopAtSeconds?: number;
    hasStopAtSeconds?: boolean;
    expectedIssues: NumberBondsTimingIssue[];
  }>;
};

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/number-bonds-runtime-contract.json", import.meta.url),
  "utf8",
)) as RuntimeContractFixture;

const JAZZ_CLOCK = `[Song]\n{\n  Resolution = 480\n}\n[SyncTrack]\n{\n  0 = B 123000\n}\n[Events]\n{\n}\n`;
const PUBLICATION_IDENTITY = {
  songAssetId: "jazzmaybach",
  activityKey: "number-bonds",
  authorId: "cmtqk9pzl0000yerq79b2h8y8",
  revision: "11111111-1111-4111-8111-111111111111",
};

function publishNumberBondsDraft(draft: ReturnType<typeof buildNumberBondsJazzPilotDraft>) {
  return prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(draft),
    identity: PUBLICATION_IDENTITY,
    runtimeClock: createLessonClock(JAZZ_CLOCK),
  });
}

function diagnosticDraft(spacingSeconds: number, tailSeconds: number) {
  const draft = buildNumberBondsJazzPilotDraft();
  const clock = createLessonClock(JAZZ_CLOCK);
  const firstStartSeconds = clock.toSeconds(draft.encounters[0].startTick);
  draft.encounters = draft.encounters.map((encounter, index) => {
    const startTick = clock.toTick(firstStartSeconds + index * spacingSeconds);
    return { ...encounter, startTick, endTick: startTick };
  });
  const finalHit = draft.encounters[draft.encounters.length - 1];
  draft.stopAtSeconds = clock.toSeconds(finalHit.startTick) + tailSeconds;
  return draft;
}

test("the shared fixture pins the initial Number Bonds runtime policy", () => {
  assert.equal(fixture.version, 1);
  assert.equal(fixture.activityKey, "number-bonds");
  assert.equal(fixture.targetPolicy, "whole-token");
  assert.equal(fixture.hitCountPolicy, "exactly-one-per-generated-gem");
  assert.deepEqual(NUMBER_BONDS_TIMING_POLICY, fixture.timingPolicy);
});

test("the shared fixture keeps authored hit-pad labels and Unity's measured physical offsets aligned", () => {
  for (const entry of fixture.hitPadLayouts) {
    assert.equal(
      resolveAuthoredHitPadSlot(entry.pad, entry.layoutVersion),
      entry.expectedSlot,
      `${entry.layoutVersion}:${entry.pad}`,
    );
  }

  assert.deepEqual(
    PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad, label, xUnit, yUnit }) => ({ pad, label, xUnit, yUnit })),
    fixture.hitPadLayouts
      .filter(({ layoutVersion }) => layoutVersion === 2)
      .map(({ pad, label, xUnit, yUnit }) => ({ pad, label, xUnit, yUnit })),
  );
});

test("all authoring and playback previews resolve Unity pad geometry in screen space", () => {
  const playerLayout = fixture.hitPadLayouts.filter(({ layoutVersion }) => layoutVersion === 2);
  for (const entry of playerLayout) {
    const offset = resolvePlayerHexHitPadPixelOffset(entry.expectedSlot, 100);
    assert.ok(offset, `${entry.layoutVersion}:${entry.pad}`);
    assert.ok(Math.abs(offset.dx - (entry.xUnit ?? 0) * 100) < 1e-9, entry.pad);
    assert.ok(Math.abs(offset.dy + (entry.yUnit ?? 0) * 100) < 1e-9, entry.pad);
  }
  assert.equal(resolvePlayerHexHitPadPixelOffset(-1, 100), null);
  assert.equal(resolvePlayerHexHitPadPixelOffset(0, Number.POSITIVE_INFINITY), null);
});

test("editor and publication timing consumers match every versioned fixture case", () => {
  for (const fixtureCase of fixture.cases) {
    assert.deepEqual(
      validateAuthoredActivityTiming(
        fixtureCase.activityKey ?? fixture.activityKey,
        fixtureCase.encounters,
        fixtureCase.stopAtSeconds,
      ),
      fixtureCase.expectedIssues,
      fixtureCase.id,
    );
  }
});

for (const spacingSeconds of [0.5, 1.4, 1.425, 1.5, 2, 4, 7.5, 8]) {
  for (const tailSeconds of [0.1, 0.7, 2, 12]) {
    const supported = spacingSeconds >= 7.5 && tailSeconds >= 12;
    test(`publication ${supported ? "accepts" : "rejects"} ${spacingSeconds}s gem spacing and ${tailSeconds}s tail`, () => {
      const publish = () => publishNumberBondsDraft(diagnosticDraft(spacingSeconds, tailSeconds));
      if (supported) {
        assert.doesNotThrow(publish);
      } else {
        assert.throws(publish, /gem_spacing|gem_tail|stop_required/);
      }
    });
  }
}

test("Number Bonds publication rejects simultaneous disjoint Hits and part-token targets", () => {
  const simultaneous = buildNumberBondsJazzPilotDraft();
  for (const encounter of simultaneous.encounters) {
    encounter.startTick = simultaneous.encounters[0].startTick;
    encounter.endTick = encounter.startTick;
  }
  assert.throws(() => publishNumberBondsDraft(simultaneous), /simultaneous_hits/);

  const partTarget = buildNumberBondsJazzPilotDraft();
  partTarget.encounters[0].hitBubbles![0] = {
    ...partTarget.encounters[0].hitBubbles![0],
    tokenIndex: 2,
    targetId: "jazz-nb-bond-5-token-2",
  };
  assert.throws(() => publishNumberBondsDraft(partTarget), /activity_target_shape/);

  const multiplePads = buildNumberBondsJazzPilotDraft();
  multiplePads.encounters[0].hitBubbles![0].pads = ["left", "right"];
  assert.throws(() => publishNumberBondsDraft(multiplePads), /activity_target_shape/);
});

test("Number Bonds requires exactly one authored Hit per generated gem", () => {
  const extraHit = buildNumberBondsJazzPilotDraft();
  const draftEquation = extraHit.equations[0];
  const equation: AuthoredSavedEquation = {
    id: draftEquation.id,
    tokens: (draftEquation.tokens ?? []).map((token) => ({ id: token.id ?? "", label: token.label })),
  };
  const clock = createLessonClock(JAZZ_CLOCK);
  const finalHit = extraHit.encounters[extraHit.encounters.length - 1];
  const unusedHitTick = finalHit.startTick + 10_000;
  extraHit.encounters.push({
    ...finalHit,
    id: `${finalHit.id}-extra`,
    eventId: `${finalHit.eventId}-extra`,
    startTick: unusedHitTick,
    endTick: unusedHitTick,
  });
  extraHit.stopAtSeconds = clock.toSeconds(unusedHitTick) + 12;

  const contractCountIssue = getAuthoredActivityContractIssues(extraHit)
    .find((issue) => issue.code === "activity_hit_count");
  assert.equal(contractCountIssue?.encounterId, `${finalHit.id}-extra`);
  assert.throws(() => publishNumberBondsDraft(extraHit), /activity_hit_count.*jazz-nb-hit-5-extra/);

  const timelineEvents: AuthoredTimelineEvent[] = extraHit.encounters.map((encounter) => ({
    id: encounter.eventId,
    tick: encounter.startTick,
    counts: { hit: 1, spin: 0, drag: 0 },
    assignments: { hit: equation, spin: null, drag: null },
    mechanicInstances: {
      hit: [{
        id: encounter.id,
        tick: encounter.startTick,
        endTick: encounter.endTick,
        equation,
        hitBubbles: encounter.hitBubbles ?? [],
        spinTargets: [],
        dragTargets: [],
      }],
      spin: [],
      drag: [],
    },
  }));
  const readiness = evaluateLessonPublishReadiness(timelineEvents, {
    activityKey: "number-bonds",
    equationQueue: [equation],
    clock,
    stopAtSeconds: extraHit.stopAtSeconds,
  });
  const extraHitIssue = readiness.blockers.find((issue) => issue.code === "activity_hit_count");
  assert.equal(readiness.ready, false);
  assert.equal(extraHitIssue?.encounterId, `${finalHit.id}-extra`);
  assert.match(extraHitIssue?.nextAction ?? "", /remove the extra Hit/);

  const noHits = evaluateLessonPublishReadiness([], {
    activityKey: "number-bonds",
    equationQueue: [equation],
  });
  const missingHitIssue = noHits.blockers.find((issue) => issue.code === "activity_hit_count");
  assert.equal(noHits.ready, false);
  assert.equal(missingHitIssue?.encounterId, null);
  assert.match(missingHitIssue?.nextAction ?? "", /Add 5 Hits/);
});

test("Number Bonds publication requires a finite stop boundary after the final gem", () => {
  const missing = buildNumberBondsJazzPilotDraft();
  delete missing.stopAtSeconds;
  assert.throws(() => publishNumberBondsDraft(missing), /stop_required/);

  const invalid = buildNumberBondsJazzPilotDraft();
  invalid.stopAtSeconds = Number.NaN;
  assert.throws(() => parseAuthoredLessonDraft(invalid), /stopAtSeconds/);

  const finalCuePastStop = diagnosticDraft(8, -1);
  assert.throws(() => publishNumberBondsDraft(finalCuePastStop), /gem_tail/);

  const invalidCue = buildNumberBondsJazzPilotDraft();
  invalidCue.encounters[0].startTick = Number.NaN;
  assert.throws(() => parseAuthoredLessonDraft(invalidCue), /startTick/);

  assert.throws(() => prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(buildNumberBondsJazzPilotDraft()),
    identity: PUBLICATION_IDENTITY,
  }), /requires its chart tempo map/);

  assert.equal(getAuthoredActivityContractIssues({
    activityKey: "unknown-activity",
    equations: [],
    encounters: [],
  })[0]?.code, "activity_unknown");
});

test("the whole target resolves on either side of the equals sign and rejects part tokens", () => {
  const leftToRight = {
    state: "5 = 2 + 3",
    tokens: ["5", "=", "2", "+", "3"].map((label) => ({ label })),
  };
  const rightToLeft = {
    state: "2 + 3 = 5",
    tokens: ["2", "+", "3", "=", "5"].map((label) => ({ label })),
  };
  assert.equal(getNumberBondsWholeTokenIndex(leftToRight), 0);
  assert.equal(getNumberBondsWholeTokenIndex(rightToLeft), 4);

  const partHit = {
    id: "hit-1",
    mechanic: "hit" as const,
    tick: 10,
    endTick: 10,
    equation: {
      id: "bond-5",
      tokens: leftToRight.tokens.map((token, index) => ({ id: `token-${index}`, label: token.label })),
    },
    hitBubbles: [{ tokenIndex: 2, targetId: "token-2", pads: ["left"] }],
    spinTargets: [],
    dragTargets: [],
  };
  assert.ok(evaluateEncounterReadiness(partHit, new Set(), { activityKey: "number-bonds" })
    .issues.some((issue) => issue.code === "activity_target_shape"));
});

test("timing checks sort unsorted cues, reject duplicate IDs, and do not change Algebra chord support", () => {
  const unsorted = validateAuthoredActivityTiming("number-bonds", [
    { id: "hit-2", type: "hit", startSeconds: 15.49 },
    { id: "hit-1", type: "hit", startSeconds: 8 },
  ], 27.49);
  assert.deepEqual(unsorted.map(({ code, encounterId }) => ({ code, encounterId })), [
    { code: "gem_spacing", encounterId: "hit-2" },
  ]);

  assert.deepEqual(validateAuthoredActivityTiming("number-bonds", [
    { id: "hit-invalid", type: "hit", startSeconds: Number.NaN },
  ]), [{ code: "timing_invalid", encounterId: "hit-invalid" }]);

  const duplicateIds = buildNumberBondsJazzPilotDraft();
  duplicateIds.encounters[1].id = duplicateIds.encounters[0].id;
  assert.throws(() => parseAuthoredLessonDraft(duplicateIds), /Duplicate authored encounter id/);

  const equation: AuthoredSavedEquation = {
    id: "bond-2",
    tokens: ["2", "=", "1", "+", "1"].map((label, index) => ({ id: `bond-2-${index}`, label })),
  };
  const hits = ["hit-1", "hit-2"].map((id, index) => ({
    id,
    tick: 10,
    endTick: 10,
    equation,
    hitBubbles: [{ tokenIndex: 0, targetId: "bond-2-0", pads: [index === 0 ? "left" : "right"] }],
    spinTargets: [],
    dragTargets: [],
  }));
  const algebraChord: AuthoredTimelineEvent = {
    id: "algebra-event",
    tick: 10,
    counts: { hit: 2, spin: 0, drag: 0 },
    assignments: { hit: equation, spin: null, drag: null },
    mechanicInstances: { hit: hits, spin: [], drag: [] },
  };
  assert.equal(evaluateLessonPublishReadiness([algebraChord], {
    activityKey: "early-algebra",
    equationQueue: [equation],
  }).ready, true);
});

test("dense overlap readiness returns one repair target per affected cue", () => {
  const equation: AuthoredSavedEquation = {
    id: "bond-2",
    tokens: ["2", "=", "1", "+", "1"].map((label, index) => ({ id: `bond-2-${index}`, label })),
  };
  const events: AuthoredTimelineEvent[] = Array.from({ length: 1_000 }, (_, index) => {
    const id = `stress-hit-${index + 1}`;
    const tick = 8 + index * 0.01;
    return {
      id: `stress-event-${index + 1}`,
      tick,
      counts: { hit: 1, spin: 0, drag: 0 },
      assignments: { hit: equation, spin: null, drag: null },
      mechanicInstances: {
        hit: [{
          id,
          tick,
          endTick: tick,
          equation,
          hitBubbles: [{ tokenIndex: 0, targetId: "bond-2-0", pads: ["left"] }],
          spinTargets: [],
          dragTargets: [],
        }],
        spin: [],
        drag: [],
      },
    };
  });

  const conflicts = evaluateLessonPublishReadiness(events, {
    activityKey: "early-algebra",
    equationQueue: [equation],
  }).blockers.filter((blocker) => blocker.code === "unsupported_concurrency");

  assert.equal(conflicts.length, 999);
  assert.equal(new Set(conflicts.map((blocker) => blocker.encounterId)).size, 999);
});

test("editor and publication agree after an offset, tempo change, and one-tick schedule repair", () => {
  const chart = `[Song]\n{\n Resolution = 480\n Offset = 0.25\n}\n[SyncTrack]\n{\n 0 = B 120000\n 9600 = B 60000\n}`;
  const clock = createLessonClock(chart);
  const equation: AuthoredSavedEquation = {
    id: "bond-2",
    tokens: ["2", "=", "1", "+", "1"].map((label, index) => ({ id: `bond-2-${index}`, label })),
  };
  const makeHit = (id: string, tick: number, pad: string) => ({
    id,
    tick: clock.toSeconds(tick),
    endTick: clock.toSeconds(tick),
    equation,
    hitBubbles: [{ tokenIndex: 0, targetId: "bond-2-0", pads: [pad] }],
    spinTargets: [],
    dragTargets: [],
  });
  const makeEvents = (secondHitTick: number): AuthoredTimelineEvent[] => {
    const hits = [makeHit("hit-1", 9600, "left"), makeHit("hit-2", secondHitTick, "right")];
    return hits.map((hit) => ({
      id: `event-${hit.id}`,
      tick: hit.tick!,
      counts: { hit: 1, spin: 0, drag: 0 },
      assignments: { hit: equation, spin: null, drag: null },
      mechanicInstances: { hit: [hit], spin: [], drag: [] },
    }));
  };
  const acceptedStop = clock.toSeconds(13200) + 12;
  const acceptedEvents = makeEvents(13200);
  const readiness = evaluateLessonPublishReadiness(acceptedEvents, {
    activityKey: "number-bonds",
    equationQueue: [equation],
    clock,
    stopAtSeconds: acceptedStop,
  });
  assert.equal(readiness.ready, true);

  const serialized = serializeAuthoredLesson(acceptedEvents, {
    songAssetId: "jazzmaybach",
    activityKey: "number-bonds",
  }, clock, acceptedStop, [equation], { forPublish: true });
  assert.deepEqual(serialized.encounters.map((encounter) => encounter.startTick), [9600, 13200]);
  assert.doesNotThrow(() => prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(serialized),
    identity: PUBLICATION_IDENTITY,
    runtimeClock: clock,
  }));

  const oneTickShort = makeEvents(13199);
  assert.ok(evaluateLessonPublishReadiness(oneTickShort, {
    activityKey: "number-bonds",
    equationQueue: [equation],
    clock,
    stopAtSeconds: clock.toSeconds(13199) + 12,
  }).blockers.some((blocker) => blocker.code === "activity_hit_spacing"));
});
