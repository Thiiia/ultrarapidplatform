import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  parseAuthoredLessonDraft,
  stampAuthoredLessonIdentity,
} from "../lib/authored-lesson";
import {
  serializeAuthoredLesson,
  timelineEventsFromAuthoredLesson,
} from "../lib/authored-lesson-serialization";
import { loadLessonAssets } from "../lib/editor/lesson-hydration";
import {
  getActivityAuthoringCapabilities,
  getAuthoredActivityContractIssues,
} from "../lib/activity-authoring-capabilities";
import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { publishLessonSaveRevision } from "../lib/lesson-save-revision";
import {
  validateNumberBondSequenceV1,
  type NumberBondSequenceLesson,
} from "../lib/number-bonds-authored-sequence";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The fixture helpers mutate JSON payload shapes across versions.
type JsonObject = Record<string, any>;

const fixturePath = path.join(process.cwd(), "contracts/number-bonds/sequence-v1/fixtures.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  validLesson: JsonObject;
  malformedCases: Array<{ id: string; mutation: JsonObject }>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableSequenceProjection(lesson: JsonObject) {
  return {
    songAssetId: lesson.songAssetId,
    activityKey: lesson.activityKey,
    stopAtSeconds: lesson.stopAtSeconds,
    equations: lesson.equations.map((equation: JsonObject) => ({
      id: equation.id,
      state: equation.state,
      tokens: equation.tokens,
    })),
    encounters: lesson.encounters.map((encounter: JsonObject) => ({
      id: encounter.id,
      eventId: encounter.eventId,
      type: encounter.type,
      equationId: encounter.equationId,
      startTick: encounter.startTick,
      endTick: encounter.endTick,
      hitBubbles: encounter.hitBubbles,
      spinTargets: encounter.spinTargets,
      dragTargets: encounter.dragTargets,
    })),
    numberBondSequenceVersion: lesson.numberBondSequenceVersion,
    numberBondGems: lesson.numberBondGems,
  };
}

function applyMutation(lesson: JsonObject, mutation: JsonObject) {
  switch (mutation.kind) {
    case "remove-encounter":
      lesson.encounters = lesson.encounters.filter((encounter: JsonObject) => encounter.id !== mutation.encounterId);
      break;
    case "set-gem-id":
      lesson.numberBondGems.find((gem: JsonObject) => gem.gemId === mutation.gemId).gemId = mutation.value;
      break;
    case "set-unit-index":
      lesson.numberBondGems.find((gem: JsonObject) => gem.gemId === mutation.gemId).unitIndex = mutation.value;
      break;
    case "set-destination": {
      const gem = lesson.numberBondGems.find((item: JsonObject) => item.gemId === mutation.gemId);
      gem.destination = { part: mutation.part, slotIndex: mutation.slotIndex };
      break;
    }
    case "add-encounter":
      lesson.encounters.push(clone(mutation.encounter));
      break;
    case "set-encounter-equation":
      lesson.encounters.find((encounter: JsonObject) => encounter.id === mutation.encounterId).equationId = mutation.equationId;
      break;
    case "set-hit-pad": {
      const hit = lesson.encounters.find((encounter: JsonObject) => encounter.id === mutation.encounterId);
      hit.hitBubbles[0].pads = [mutation.pad];
      hit.hitBubbles[0].positions = [mutation.pad];
      break;
    }
    case "set-encounter-timing": {
      const encounter = lesson.encounters.find((item: JsonObject) => item.id === mutation.encounterId);
      encounter.startTick = mutation.startTick;
      encounter.endTick = mutation.endTick;
      break;
    }
    case "set-sequence-version":
      lesson.numberBondSequenceVersion = mutation.value;
      break;
    default:
      assert.fail(`Unknown malformed fixture mutation '${mutation.kind}'`);
  }
}

function createExpandedBondLesson(whole: number, partA: number, partB: number): JsonObject {
  const lesson = clone(fixture.validLesson);
  const equationId = `bond-${whole}-${partA}-${partB}`;
  const equation = lesson.equations[0] as JsonObject;
  equation.id = equationId;
  equation.state = `${whole} = ${partA} + ${partB}`;
  equation.tokens = [`${whole}`, "=", `${partA}`, "+", `${partB}`].map((label, index) => ({
    id: `${equationId}-token-${index}`,
    label,
  }));

  const templateGems = lesson.numberBondGems as JsonObject[];
  const templateEncounters = lesson.encounters as JsonObject[];
  const encountersById = new Map(templateEncounters.map((encounter) => [encounter.id as string, encounter]));
  const encounters: JsonObject[] = [];
  const gems: JsonObject[] = [];

  for (let unitIndex = 0; unitIndex < whole; unitIndex += 1) {
    const template = templateGems[unitIndex % templateGems.length];
    const templateHitId = templateEncounters.find((encounter) =>
      encounter.type === "hit" &&
      templateEncounters.some((drag) =>
        drag.id === template.dragEncounterId &&
        drag.dragTargets?.[0]?.sourceHitId === encounter.id))?.id as string;
    const templateHit = encountersById.get(templateHitId);
    const templateSpin = encountersById.get(template.spinEncounterId as string);
    const templateDrag = encountersById.get(template.dragEncounterId as string);
    assert.ok(templateHit && templateSpin && templateDrag, "fixture should contain a complete unit journey");

    const suffix = `unit-${unitIndex + 1}`;
    const hitId = `${equationId}-${suffix}-hit`;
    const spinId = `${equationId}-${suffix}-spin`;
    const dragId = `${equationId}-${suffix}-drag`;
    const hitStart = 1_000 + unitIndex * 3_000;
    const inPartA = unitIndex < partA;
    const partTokenIndex = inPartA ? 2 : 4;
    const partTokenId = equation.tokens[partTokenIndex].id;

    const hit = clone(templateHit);
    hit.id = hitId;
    hit.eventId = `${equationId}-${suffix}-hit-event`;
    hit.equationId = equationId;
    hit.startTick = hitStart;
    hit.endTick = hitStart;
    hit.hitBubbles[0].tokenIndex = 0;
    hit.hitBubbles[0].targetId = equation.tokens[0].id;

    const spin = clone(templateSpin);
    spin.id = spinId;
    spin.eventId = `${equationId}-${suffix}-spin-event`;
    spin.equationId = equationId;
    spin.startTick = hitStart + 800;
    spin.endTick = hitStart + 1_000;
    spin.spinTargets[0].tokenIndex = 0;
    spin.spinTargets[0].targetId = equation.tokens[0].id;

    const drag = clone(templateDrag);
    drag.id = dragId;
    drag.eventId = `${equationId}-${suffix}-drag-event`;
    drag.equationId = equationId;
    drag.startTick = hitStart + 1_600;
    drag.endTick = hitStart + 2_000;
    drag.dragTargets[0].tokenIndex = partTokenIndex;
    drag.dragTargets[0].targetId = partTokenId;
    drag.dragTargets[0].sourceHitId = hitId;

    encounters.push(hit, spin, drag);
    gems.push({
      gemId: `${equationId}-${suffix}-gem`,
      unitIndex,
      spinEncounterId: spinId,
      dragEncounterId: dragId,
      destination: {
        part: inPartA ? "part-a" : "part-b",
        slotIndex: inPartA ? unitIndex : unitIndex - partA,
      },
    });
  }

  lesson.encounters = encounters;
  lesson.numberBondGems = gems;
  lesson.stopAtSeconds = 300;
  return lesson;
}

test("Number Bonds sequence v1 parses and retains the full linked 5 = 2 + 3 journey", () => {
  const parsed = parseAuthoredLessonDraft(clone(fixture.validLesson));
  assert.equal(parsed.numberBondSequenceVersion, 1);
  assert.equal(parsed.numberBondGems?.length, 5);
  assert.deepEqual(getAuthoredActivityContractIssues(parsed), []);
  const stamped = stampAuthoredLessonIdentity(parsed, {
    songAssetId: parsed.songAssetId,
    activityKey: parsed.activityKey,
    authorId: "runtime-contract-fixture",
    revision: "number-bonds-sequence-v1-published",
  });
  assert.deepEqual(stamped.numberBondGems, parsed.numberBondGems);
  assert.equal(stamped.numberBondSequenceVersion, 1);

  const publication = prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(parsed),
    identity: {
      songAssetId: parsed.songAssetId,
      activityKey: parsed.activityKey,
      authorId: "runtime-contract-fixture",
      revision: "number-bonds-sequence-v1-published",
    },
    runtimeClock: { toSeconds: (tick) => tick },
  });
  const published = parseAuthoredLessonDraft(JSON.parse(publication.content));
  assert.equal(published.numberBondSequenceVersion, 1);
  assert.deepEqual(published.numberBondGems, parsed.numberBondGems);
});

test("Number Bonds sequence v1 generalizes equation tokens, gem counts, and part slots for 15 = 11 + 4", () => {
  const lesson = createExpandedBondLesson(15, 11, 4);
  const gems = validateNumberBondSequenceV1(lesson as unknown as NumberBondSequenceLesson);

  assert.equal(gems?.length, 15);
  assert.deepEqual(gems?.[10].destination, { part: "part-a", slotIndex: 10 });
  assert.deepEqual(gems?.[11].destination, { part: "part-b", slotIndex: 0 });
  assert.deepEqual(gems?.[14].destination, { part: "part-b", slotIndex: 3 });
  assert.equal(lesson.encounters.length, 45);
});

test("Number Bonds sequence v1 survives editor hydration and save with encounter edits validated", () => {
  const parsed = parseAuthoredLessonDraft(clone(fixture.validLesson));
  const identityClock = {
    toTick: (seconds: number) => seconds,
    toSeconds: (tick: number) => tick,
  };
  const hydrated = timelineEventsFromAuthoredLesson(parsed, identityClock);

  assert.equal(hydrated.numberBondSequenceVersion, 1);
  assert.deepEqual(hydrated.numberBondGems, parsed.numberBondGems);

  const saved = serializeAuthoredLesson(
    hydrated.events,
    {
      songAssetId: parsed.songAssetId,
      activityKey: parsed.activityKey,
      authorId: parsed.authorId,
      revision: parsed.revision,
    },
    identityClock,
    parsed.stopAtSeconds,
    hydrated.equations,
    {
      forPublish: true,
      activityKey: "number-bonds",
      numberBondSequenceV1: {
        version: 1,
        gems: hydrated.numberBondGems ?? [],
      },
    },
  );

  assert.equal(saved.numberBondSequenceVersion, 1);
  assert.deepEqual(saved.numberBondGems, parsed.numberBondGems);
  assert.deepEqual(
    parseAuthoredLessonDraft(saved).numberBondGems,
    parsed.numberBondGems,
  );

  const changed = structuredClone(hydrated.events);
  const lastGemDrag = changed
    .flatMap((event) => event.mechanicInstances.drag)
    .find((instance) => instance.id === parsed.numberBondGems![4].dragEncounterId);
  assert.ok(lastGemDrag);
  lastGemDrag!.tick = parsed.encounters.find(
    (encounter) => encounter.id === parsed.numberBondGems![4].spinEncounterId,
  )!.endTick;
  assert.throws(
    () => serializeAuthoredLesson(
      changed,
      {
        songAssetId: parsed.songAssetId,
        activityKey: parsed.activityKey,
        authorId: parsed.authorId,
        revision: parsed.revision,
      },
      identityClock,
      parsed.stopAtSeconds,
      hydrated.equations,
      {
        numberBondSequenceV1: {
          version: 1,
          gems: hydrated.numberBondGems ?? [],
        },
      },
    ),
    /Number Bonds sequence v1/,
  );
});

test("canonical 5 = 2 + 3 survives editor create, save, reopen, publish and immutable revision reload", async () => {
  const created = parseAuthoredLessonDraft(clone(fixture.validLesson));
  const clock = {
    toTick: (seconds: number) => seconds,
    toSeconds: (tick: number) => tick,
  };
  const expected = stableSequenceProjection(created);

  const hydrated = timelineEventsFromAuthoredLesson(created, clock);
  const savedDraft = serializeAuthoredLesson(
    hydrated.events,
    {
      songAssetId: created.songAssetId,
      activityKey: created.activityKey,
      authorId: created.authorId,
      revision: created.revision,
    },
    clock,
    created.stopAtSeconds,
    hydrated.equations,
    {
      numberBondSequenceV1: {
        version: 1,
        gems: hydrated.numberBondGems ?? [],
      },
    },
  );
  assert.deepEqual(stableSequenceProjection(savedDraft), expected, "Save preserves all encounter and gem identity/timing/target data");

  const reopened = parseAuthoredLessonDraft(JSON.parse(JSON.stringify(savedDraft)));
  const reopenedHydration = timelineEventsFromAuthoredLesson(reopened, clock);
  assert.deepEqual(reopenedHydration.numberBondGems, created.numberBondGems, "Reopen restores stable gem journeys");
  assert.deepEqual(
    stableSequenceProjection(serializeAuthoredLesson(
      reopenedHydration.events,
      {
        songAssetId: reopened.songAssetId,
        activityKey: reopened.activityKey,
        authorId: reopened.authorId,
        revision: reopened.revision,
      },
      clock,
      reopened.stopAtSeconds,
      reopenedHydration.equations,
      {
        numberBondSequenceV1: {
          version: 1,
          gems: reopenedHydration.numberBondGems ?? [],
        },
      },
    )),
    expected,
    "The reopened editor state serializes to the same v1 representation",
  );

  const revisionId = "number-bonds-sequence-v1-5-2-3-published";
  const publication = prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(savedDraft),
    identity: {
      songAssetId: created.songAssetId,
      activityKey: created.activityKey,
      authorId: "runtime-contract-fixture",
      revision: revisionId,
    },
    runtimeClock: { toSeconds: (tick) => tick },
  });
  const published = parseAuthoredLessonDraft(JSON.parse(publication.content));
  assert.deepEqual(stableSequenceProjection(published), expected, "Publish keeps stable sequence fields while stamping revision identity");

  const storage = new Map<string, string>();
  const savedRevision = await publishLessonSaveRevision({
    targets: {
      chart: { bucket: "Charts", path: "Number_Bonds/5-2-3.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/5-2-3.json" },
    },
    revisionId,
    content: { chart: "canonical-sequence-v1-test-chart", sidecar: publication.content },
    upload: async (file) => { storage.set(file.path, file.content); },
    commitRevision: async (revision) => {
      assert.equal(revision.revisionId, revisionId);
      assert.equal(storage.get(revision.sidecar.path), publication.content);
    },
  });
  const reloadedAssets = await loadLessonAssets({
    refs: {
      audioUrl: "fixture-audio",
      chartUrl: savedRevision.chart.path,
      sidecarUrl: savedRevision.sidecar.path,
    },
    fetchAudio: async (url) => url,
    fetchChart: async (url) => storage.get(url) ?? Promise.reject(new Error(`missing immutable chart ${url}`)),
    fetchSidecar: async (url) => JSON.parse(storage.get(url) ?? "null"),
  });
  const reloadedPublishedRevision = parseAuthoredLessonDraft(reloadedAssets.sidecar);
  assert.equal(reloadedPublishedRevision.revision, revisionId);
  assert.deepEqual(stableSequenceProjection(reloadedPublishedRevision), expected);
  assert.deepEqual(
    timelineEventsFromAuthoredLesson(reloadedPublishedRevision, clock).numberBondGems,
    created.numberBondGems,
    "Unity-facing published reload restores the same five gem journeys",
  );
});

test("shared malformed sequence mutations are rejected by parse or publication timing", () => {
  for (const item of fixture.malformedCases) {
    const lesson = clone(fixture.validLesson);
    applyMutation(lesson, item.mutation);
    if (item.id === "action-after-stop") {
      assert.throws(() => prepareAuthoredLessonForPublication({
        sidecarContent: JSON.stringify(lesson),
        identity: {
          songAssetId: lesson.songAssetId,
          activityKey: lesson.activityKey,
          authorId: lesson.authorId,
          revision: "invalid-sequence",
        },
        runtimeClock: { toSeconds: (tick) => tick },
      }), /stop|boundary|ends/i, item.id);
    } else {
      assert.throws(() => parseAuthoredLessonDraft(lesson), (error: unknown) => error instanceof Error, item.id);
    }
  }
});

test("legacy Number Bonds remains Hit-only and generic authoring capabilities stay unchanged", () => {
  const legacy = clone(fixture.validLesson);
  delete legacy.numberBondSequenceVersion;
  delete legacy.numberBondGems;
  legacy.encounters = legacy.encounters.filter((encounter: JsonObject) => encounter.type === "hit");

  const parsed = parseAuthoredLessonDraft(legacy);
  assert.deepEqual(getAuthoredActivityContractIssues(parsed), []);
  assert.deepEqual(getActivityAuthoringCapabilities("number-bonds").supportedAuthoredMechanics, ["hit"]);
});
