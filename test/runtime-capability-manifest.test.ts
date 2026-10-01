import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getActivityAuthoringCapabilities } from "../lib/activity-authoring-capabilities";
import { parseRuntimeCapabilityManifestJson } from "../lib/runtime-capability-manifest";

const EXPECTED_FIXTURE_SHA256_LF = "0bebfb039cb93467648b5b8700916fd6e90a86290248f9b374b32ee0ebba5bbf";
const fixturePath = fileURLToPath(new URL(
  "../contracts/runtime-capabilities/v1/runtime-capabilities.json",
  import.meta.url,
));
const fixtureJson = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureJson) as Record<string, unknown>;
const normalizeLf = (value: string) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

test("Unity runtime capability fixture has the shared normalized-LF digest", () => {
  assert.equal(
    createHash("sha256").update(normalizeLf(fixtureJson)).digest("hex"),
    EXPECTED_FIXTURE_SHA256_LF,
  );
});

test("Unity runtime capability build fixture parses without changing authoring authority", () => {
  const manifest = parseRuntimeCapabilityManifestJson(fixtureJson);

  assert.equal(manifest.manifestVersion, 1);
  assert.deepEqual(manifest.protocolVersions, {
    runtimeProtocolVersion: 1,
    receiptVersion: 1,
    contractVersion: 1,
    completionVersions: [2, 3],
    authoredLessonProtocolVersion: 3,
    calibrationProtocolVersion: 1,
    publicDemoAdapterVersion: 1,
  });
  assert.deepEqual(manifest.activities.map((activity) => activity.activityKey), ["number-bonds", "early-algebra"]);
  assert.deepEqual(manifest.activities[0].runtimeMechanics, ["hit", "catch", "spinout", "drag"]);
  assert.deepEqual(manifest.activities[0].authoredLessonAdapters[0].mechanics, ["hit"]);
  assert.deepEqual(manifest.activities[0].authoredSequenceAdapters, [{
    authoredLessonProtocolVersion: 3,
    sequenceVersion: 1,
    encounterMechanics: ["hit", "spin", "drag"],
  }]);
  assert.deepEqual(manifest.activities[1].runtimeMechanics, ["hit", "spin", "drag"]);
  assert.deepEqual(manifest.activities[1].authoredLessonAdapters[0].mechanics, ["hit", "spin", "drag"]);
  assert.deepEqual(manifest.activities[1].authoredSequenceAdapters, []);

  assert.deepEqual(
    getActivityAuthoringCapabilities("number-bonds").supportedAuthoredMechanics,
    ["hit"],
  );
  assert.equal(
    "runtimeCapabilities" in manifest.activities[0],
    false,
    "receipt runtimeCapabilities are not part of the build capability document",
  );
  assert.deepEqual(
    getActivityAuthoringCapabilities("early-algebra").supportedAuthoredMechanics,
    ["hit", "spin", "drag"],
  );
});

test("runtime capability parser rejects unknown activities and scene-name leakage", () => {
  const activities = fixture.activities as Array<Record<string, unknown>>;
  const changedActivity = { ...activities[1], activityKey: "equations" };
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    activities: [activities[0], changedActivity],
  })), /unsupported activity key/);
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    sceneName: "NumberBondsPrototypeAni",
  })), /unsupported shape/);
});

test("runtime capability parser rejects unknown mechanics and inaccurate declarations", () => {
  const activities = fixture.activities as Array<Record<string, unknown>>;
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    activities: [
      {
        ...activities[0],
        runtimeMechanics: ["hit", "catch", "teleport", "drag"],
      },
      activities[1],
    ],
  })), /unsupported value/);
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    activities: [
      {
        ...activities[0],
        runtimeMechanics: ["hit", "spinout", "drag"],
      },
      activities[1],
    ],
  })), /runtime mechanics do not match/);
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    activities: [
      {
        ...activities[0],
        authoredSequenceAdapters: [{
          authoredLessonProtocolVersion: 3,
          sequenceVersion: 2,
          encounterMechanics: ["hit", "spin", "drag"],
        }],
      },
      activities[1],
    ],
  })), /unsupported lesson or sequence protocol/);
});

test("runtime capability parser rejects protocol-axis and manifest-version drift", () => {
  const protocolVersions = fixture.protocolVersions as Record<string, unknown>;
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    protocolVersions: { ...protocolVersions, receiptVersion: 2 },
  })), /protocol axes do not match Runtime Protocol v1/);
  assert.throws(() => parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    manifestVersion: 2,
  })), /Unsupported runtime capability manifest version/);
});

test("runtime capability parser preserves honest hit-only Number Bonds builds", () => {
  const activities = fixture.activities as Array<Record<string, unknown>>;
  const manifest = parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...fixture,
    activities: [
      { ...activities[0], authoredSequenceAdapters: [] },
      activities[1],
    ],
  }));

  assert.deepEqual(manifest.activities[0].authoredLessonAdapters[0].mechanics, ["hit"]);
  assert.deepEqual(manifest.activities[0].authoredSequenceAdapters, []);
});
