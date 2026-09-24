import assert from "node:assert/strict";
import test from "node:test";

import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { createLessonClock } from "../lib/editor/lesson-timing";
import {
  buildNumberBondsJazzPilotDraft,
  NUMBER_BONDS_JAZZ_PILOT_HIT_TICKS,
  NUMBER_BONDS_JAZZ_RHYTHM_SOURCE,
} from "../lib/number-bonds-jazz-pilot";

const JAZZ_CLOCK = `[Song]\n{\n  Resolution = 480\n}\n[SyncTrack]\n{\n  0 = B 123000\n}\n[Events]\n{\n}\n`;

test("builds a production-shaped Number Bonds Jazz pilot with five HIT-only cues", () => {
  const draft = buildNumberBondsJazzPilotDraft();
  const clock = createLessonClock(JAZZ_CLOCK);
  const publication = prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(draft),
    identity: {
      songAssetId: "jazzmaybach",
      activityKey: "number-bonds",
      authorId: "cmtqk9pzl0000yerq79b2h8y8",
      revision: "11111111-1111-4111-8111-111111111111",
    },
    runtimeClock: clock,
    legacyToTickAfterSeconds: (tick, seconds) =>
      clock.toTick(clock.toSeconds(tick) + seconds),
  });
  const persisted = parseAuthoredLessonDraft(JSON.parse(publication.content));

  assert.deepEqual(publication.counts, { equations: 1, encounters: 5, targets: 5 });
  assert.equal(persisted.activityKey, "number-bonds");
  assert.equal(persisted.equations[0]?.state, "5 = 2 + 3");
  assert.deepEqual(persisted.encounters.map((encounter) => encounter.startTick), [
    ...NUMBER_BONDS_JAZZ_PILOT_HIT_TICKS,
  ]);
  const hitSeconds = persisted.encounters.map((encounter) => clock.toSeconds(encounter.startTick));
  assert.ok(hitSeconds.slice(1).every((seconds, index) => seconds - hitSeconds[index] >= 7.5));
  assert.ok((persisted.stopAtSeconds ?? 0) - hitSeconds[hitSeconds.length - 1] >= 12);
  assert.ok(persisted.encounters.every((encounter) => encounter.type === "hit"));
  assert.ok(persisted.encounters.every((encounter) => encounter.hitBubbles?.length === 1));
  assert.ok(persisted.encounters.every((encounter) => encounter.hitBubbles?.[0]?.targetId === "jazz-nb-bond-5-token-0"));
});

test("pins the pilot to the audited immutable rhythm/audio identities", () => {
  assert.deepEqual(NUMBER_BONDS_JAZZ_RHYTHM_SOURCE, {
    songAssetId: "jazzmaybach",
    sourceActivityKey: "early-algebra",
    sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
    chartSha256: "3cb1af7802af390f661bd9d242e52c85cf845331c9d4f43e58112b2862e55bc3",
    audioSha256: "0b4eeff6cafe9b8608f541f378183e95fa75357f2ab29a9b62f103bfbbe2eeb5",
  });
});

test("publication rejects Number Bonds cues too close for the Unity gem sequence", () => {
  const draft = buildNumberBondsJazzPilotDraft();
  const clock = createLessonClock(JAZZ_CLOCK);
  draft.encounters[1].startTick = draft.encounters[0].startTick + 480;
  draft.encounters[1].endTick = draft.encounters[1].startTick;

  assert.throws(() => prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(draft),
    identity: { songAssetId: "jazzmaybach", activityKey: "number-bonds", authorId: "author-1", revision: "revision-1" },
    runtimeClock: clock,
  }), /previous gem can finish/i);
});

test("publication rejects a Number Bonds stop before the final drag can complete", () => {
  const draft = buildNumberBondsJazzPilotDraft();
  const clock = createLessonClock(JAZZ_CLOCK);
  draft.stopAtSeconds = clock.toSeconds(draft.encounters[draft.encounters.length - 1].startTick) + 11;

  assert.throws(() => prepareAuthoredLessonForPublication({
    sidecarContent: JSON.stringify(draft),
    identity: { songAssetId: "jazzmaybach", activityKey: "number-bonds", authorId: "author-1", revision: "revision-1" },
    runtimeClock: clock,
  }), /final gem/i);
});
