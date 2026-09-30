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
import {
  getActivityAuthoringCapabilities,
  getAuthoredActivityContractIssues,
} from "../lib/activity-authoring-capabilities";
import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";

type JsonObject = Record<string, any>;

const fixturePath = path.join(process.cwd(), "contracts/number-bonds/sequence-v1/fixtures.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  validLesson: JsonObject;
  malformedCases: Array<{ id: string; mutation: JsonObject }>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
