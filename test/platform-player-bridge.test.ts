import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBridgeContext, LaunchAttemptReceiptSchema, needsCalibration, parseCalibrationState, PlatformPlayerBridgeMessageSchema, validateBridgeMessage } from "../lib/platform-player-bridge";

const receipt = {
  receiptVersion: 1 as const, contractVersion: 1 as const, songAssetId: "song", activityKey: "early-algebra", authorId: "author", revision: "rev",
  source: "authored" as const, runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"], launchAttemptId: crypto.randomUUID(),
  chart: { bucket: "Charts", path: "rev/chart" }, sidecar: { bucket: "SidecarJsons", path: "rev/sidecar" }, audio: { bucket: "Songs", path: "song.mp3" },
  counts: { encounters: 1, equations: 1, targets: 1 }, hashes: { chartSha256: "a".repeat(64), sidecarSha256: "b".repeat(64), audioSha256: "c".repeat(64) },
};

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "../contracts/runtime/fixtures");
const runtimeFixture = (name: string) => JSON.parse(readFileSync(join(fixtureRoot, name), "utf8"));
const identityFixture = runtimeFixture("bridge-launch-identity.json");
const runCompleteV2Fixture = runtimeFixture("run-complete-v2.json");
const runCompleteV3Fixture = runtimeFixture("run-complete-v3.json");
const sharedFixtureSha256: Record<string, string> = {
  "bridge-launch-identity.json": "e0bdac0486c8e89a709af44fba5da1cf0f67f0fdfb0729657dd7cfcf2faf309d",
  "completion-v2.json": "2fd4ab889f4bbd4eda90eba85854f9b61ee8fefb452a2097a72eadb35c524b91",
  "completion-v3.json": "61fb7d6334406f1b9a2733f2914455ac4c388ac63bdea58749e0f7d81149e54c",
  "run-complete-v2.json": "1919b99def18950383171b53b438b3bcd429cca37a78a115159e29814a381eda",
  "run-complete-v3.json": "607678f5e63af6a8ee1d21e52b3b9880184c587b590f458157fc6f51806c83df",
};

test("shared runtime fixtures pass Platform bridge validation without drifting", () => {
  for (const [name, expected] of Object.entries(sharedFixtureSha256)) {
    const normalized = readFileSync(join(fixtureRoot, name), "utf8").replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(normalized).digest("hex"), expected, `${name} must match the shared fixture digest`);
  }

  for (const envelope of [runCompleteV2Fixture, runCompleteV3Fixture]) {
    const { message, sourceOrigin } = envelope;
    assert.equal(sourceOrigin, identityFixture.origin);
    assert.equal(message.type, "run-complete");
    assert.equal(message.nonce, identityFixture.nonce);
    assert.deepEqual(message.receipt, identityFixture.receipt);
    const parsed = PlatformPlayerBridgeMessageSchema.safeParse(message);
    assert.equal(parsed.success, true);
    if (parsed.success && parsed.data.type === "run-complete") {
      assert.deepEqual(parsed.data.completion, message.completion);
    }

    const context = {
      nonce: message.nonce,
      installationId: identityFixture.receipt.launchAttemptId,
      receipt: identityFixture.receipt,
      origin: sourceOrigin,
      protocolVersion: 1,
    };
    assert.equal(validateBridgeMessage(message, context).ok, true);
  }
  assert.equal(runCompleteV3Fixture.message.completion.missionSteps[0].signedErrorMs, -12);
});

test("bridge rejects altered receipt identity and malformed run-complete envelopes", () => {
  const { message } = runCompleteV3Fixture;
  const context = createBridgeContext(
    identityFixture.receipt,
    identityFixture.origin + "/game",
    identityFixture.receipt.launchAttemptId,
  );
  const changedReceipts = [
    { ...message.receipt, songAssetId: "other-song" },
    { ...message.receipt, revision: "other-revision" },
    { ...message.receipt, launchAttemptId: "55555555-5555-4555-8555-555555555555" },
    { ...message.receipt, hashes: { ...message.receipt.hashes, chartSha256: "d".repeat(64) } },
    { ...message.receipt, hashes: { ...message.receipt.hashes, sidecarSha256: "d".repeat(64) } },
    { ...message.receipt, hashes: { ...message.receipt.hashes, audioSha256: "d".repeat(64) } },
  ];
  for (const receipt of changedReceipts) {
    assert.equal(validateBridgeMessage({ ...message, receipt }, context).ok, false);
  }

  for (const malformed of [
    { ...message, nonce: undefined },
    { ...message, receipt: undefined },
    { ...message, completion: undefined },
    { ...message, unexpected: true },
  ]) {
    assert.equal(validateBridgeMessage(malformed, context).ok, false);
  }
});

test("completion validation rejects invalid counters, unsupported versions, and non-finite timing", () => {
  const { message } = runCompleteV2Fixture;
  const context = createBridgeContext(
    identityFixture.receipt,
    identityFixture.origin + "/game",
    identityFixture.receipt.launchAttemptId,
  );
  for (const completion of [
    { ...message.completion, completionVersion: 1 },
    { ...message.completion, completedEvents: -1 },
    { ...message.completion, completedEvents: 2, requiredEvents: 1 },
    { ...message.completion, requiredEvents: -1 },
    { ...message.completion, solvedSets: -1 },
    { ...message.completion, hitAttempts: -1 },
    { ...message.completion, solvedSets: 0 },
  ]) {
    assert.equal(validateBridgeMessage({ ...message, completion }, context).ok, false);
  }

  const v3 = PlatformPlayerBridgeMessageSchema.parse(runCompleteV3Fixture.message);
  if (v3.type !== "run-complete" || v3.completion.completionVersion !== 3) {
    throw new Error("run-complete-v3 fixture must be a version 3 completion message");
  }
  const missionSteps = v3.completion.missionSteps.map((step, index) =>
    index === 0 ? { ...step, signedErrorMs: Number.NaN } : step,
  );
  assert.equal(validateBridgeMessage({
    ...v3,
    completion: { ...v3.completion, missionSteps },
  }, context).ok, false);
  const parsedV3 = PlatformPlayerBridgeMessageSchema.parse(runCompleteV3Fixture.message);
  if (parsedV3.type !== "run-complete" || parsedV3.completion.completionVersion !== 3) {
    throw new Error("run-complete-v3 fixture must be a version 3 completion message");
  }
  assert.deepEqual(parsedV3.completion, v3.completion);
  assert.equal(parsedV3.completion.missionSteps[0].signedErrorMs, -12);
});

test("bridge rejects a receipt without the revision Unity requires", () => {
  const unrevisionedReceipt = { ...receipt, revision: undefined };
  assert.throws(() => createBridgeContext(unrevisionedReceipt, "https://game.example/", crypto.randomUUID()), /revision/);
});

test("bridge validates nonce and receipt, and rejects arbitrary navigation", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const valid = { type: "calibration-complete" as const, nonce: context.nonce, receipt, offsetMs: 12, protocolVersion: 1 };
  assert.equal(validateBridgeMessage(valid, context).ok, true);
  assert.equal(validateBridgeMessage({ ...valid, nonce: crypto.randomUUID() }, context).ok, false);
  assert.equal(validateBridgeMessage({ ...valid, type: "navigate", url: "https://evil.example" }, context).ok, false);
});

test("demo bridge accepts attempt-less guest receipts while authenticated receipts keep their attempt ID", () => {
  const { launchAttemptId: _authenticatedAttemptId, ...guestReceipt } = receipt;
  const installationId = crypto.randomUUID();

  assert.throws(
    () => createBridgeContext(guestReceipt, "https://game.example/", installationId),
    /require a player launch attempt ID/,
  );

  const guestContext = createBridgeContext(guestReceipt, "https://game.example/", installationId, {
    allowGuestReceipt: true,
  });
  assert.equal(guestContext.receipt.launchAttemptId, undefined);
  assert.equal(LaunchAttemptReceiptSchema.safeParse(guestContext.receipt).success, false);
  const guestCompletion = {
    type: "run-complete" as const,
    nonce: guestContext.nonce,
    receipt: guestContext.receipt,
    completion: {
      completionVersion: 2 as const,
      outcome: "completed" as const,
      completedEvents: 1,
      requiredEvents: 1,
      solvedSets: 1,
      hitAttempts: 1,
    },
  };
  assert.equal(validateBridgeMessage(guestCompletion, guestContext).ok, true);

  const authenticatedContext = createBridgeContext(receipt, "https://game.example/", installationId);
  assert.equal(authenticatedContext.receipt.launchAttemptId, receipt.launchAttemptId);
  assert.equal(LaunchAttemptReceiptSchema.safeParse(authenticatedContext.receipt).success, true);
});

test("bridge accepts the same receipt when Unity serializes keys in a different order", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const reorderedReceipt = Object.fromEntries(Object.entries(receipt).reverse());
  const valid = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt: reorderedReceipt,
    completion: { completionVersion: 2 as const, outcome: "completed" as const, completedEvents: 1, requiredEvents: 1, solvedSets: 1, hitAttempts: 1 },
  };

  assert.equal(validateBridgeMessage(valid, context).ok, true);
});

test("bridge accepts a bounded, receipt-bound completion summary only", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const completed = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt,
    completion: { completionVersion: 2 as const, outcome: "completed" as const, completedEvents: 4, requiredEvents: 4, solvedSets: 2, hitAttempts: 6 },
  };

  assert.equal(validateBridgeMessage(completed, context).ok, true);
  assert.equal(validateBridgeMessage({ ...completed, completion: { ...completed.completion, completedEvents: -1 } }, context).ok, false);
  assert.equal(validateBridgeMessage({ ...completed, receipt: { ...receipt, songAssetId: "another-song" } }, context).ok, false);
});

test("bridge preserves non-completion outcomes without inventing successful counts", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const abandoned = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt,
    completion: { completionVersion: 2 as const, outcome: "abandoned" as const, completedEvents: 0, requiredEvents: 0, solvedSets: 0, hitAttempts: 0 },
  };

  assert.equal(validateBridgeMessage(abandoned, context).ok, true);
});

test("version 2 completion rejects a success that does not prove a solved set", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const completed = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt,
    completion: { completionVersion: 2 as const, outcome: "completed" as const, completedEvents: 5, requiredEvents: 5, solvedSets: 1, hitAttempts: 7 },
  };

  assert.equal(validateBridgeMessage(completed, context).ok, true);
  assert.equal(validateBridgeMessage({ ...completed, completion: { ...completed.completion, solvedSets: 0 } }, context).ok, false);
  assert.equal(validateBridgeMessage({ ...completed, completion: { ...completed.completion, completedEvents: 4 } }, context).ok, false);
  assert.equal(validateBridgeMessage({ ...completed, completion: { ...completed.completion, completionVersion: 1 } }, context).ok, false);
});

test("version 3 completion carries bounded mission steps with stable equation and encounter identity", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const completed = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt,
    completion: {
      completionVersion: 3 as const,
      outcome: "completed" as const,
      completedEvents: 1,
      requiredEvents: 1,
      solvedSets: 1,
      hitAttempts: 2,
      missionSteps: [
        {
          recordType: "authored-judgement",
          equationId: "eq_001",
          encounterId: "enc_hit_001",
          mechanic: "hit",
          stepIndex: 1,
          slotIndex: 0,
          judgement: "perfect",
          hasTimingError: true,
          signedErrorMs: -12,
          fromEquation: "3x + 6 = 18",
          toEquation: "3x + 6 = 18",
          operation: "",
          equationProgress: 0,
          performanceOutcomes: [],
          recordedAtUtc: "2026-09-25T12:00:00.000Z",
        },
        {
          recordType: "equation-transition",
          equationId: "eq_001",
          encounterId: "",
          mechanic: "equation",
          stepIndex: 1,
          slotIndex: -1,
          judgement: "none",
          hasTimingError: false,
          signedErrorMs: 0,
          fromEquation: "3x + 6 = 18",
          toEquation: "3x = 12",
          operation: "SubtractConstant",
          equationProgress: 0.5,
          performanceOutcomes: ["perfect", "good"],
          recordedAtUtc: "2026-09-25T12:00:01.000Z",
        },
      ],
    },
  };

  assert.equal(validateBridgeMessage(completed, context).ok, true);
  assert.equal(validateBridgeMessage({
    ...completed,
    completion: { ...completed.completion, missionSteps: completed.completion.missionSteps.slice(0, 1).map((step) => ({ ...step, equationId: "" })) },
  }, context).ok, false);
  for (const recordedAtUtc of ["2026-02-30T12:00:00Z", "2026-09-25", "2026-09-25T12:00:00+01:00", "1234"]) {
    assert.equal(validateBridgeMessage({
      ...completed,
      completion: { ...completed.completion, missionSteps: [{ ...completed.completion.missionSteps[0], recordedAtUtc }] },
    }, context).ok, false, `${recordedAtUtc} is not a valid UTC mission timestamp`);
  }
  assert.equal(validateBridgeMessage({
    ...completed,
    completion: { ...completed.completion, missionSteps: [{ ...completed.completion.missionSteps[0], recordedAtUtc: "2026-09-25T12:00:00.1234567Z" }] },
  }, context).ok, true, ".NET round-trip UTC timestamps remain supported");
  assert.equal(validateBridgeMessage({
    ...completed,
    completion: { ...completed.completion, missionSteps: Array.from({ length: 512 }, () => completed.completion.missionSteps[0]) },
  }, context).ok, true);
  assert.equal(validateBridgeMessage({
    ...completed,
    completion: { ...completed.completion, missionSteps: Array.from({ length: 513 }, () => completed.completion.missionSteps[0]) },
  }, context).ok, false);
});

test("calibration is required when protocol is absent or stale", () => {
  assert.equal(needsCalibration({ protocolVersion: 0 }), true);
  assert.equal(needsCalibration({ protocolVersion: 1 }), true);
  assert.equal(needsCalibration({ protocolVersion: 1, offsetMs: 12 }), false);
});

test("calibration is required for missing, malformed, stale, or out-of-range measurements", () => {
  assert.equal(needsCalibration(null), true);
  assert.equal(needsCalibration({ protocolVersion: 1, offsetMs: undefined }), true);
  assert.equal(needsCalibration({ protocolVersion: 1, offsetMs: 12.5 }), true);
  assert.equal(needsCalibration({ protocolVersion: 2, offsetMs: 12 }), true);
  assert.equal(needsCalibration({ protocolVersion: 1, offsetMs: 351 }), true);
  assert.equal(needsCalibration({ protocolVersion: 1, offsetMs: -351 }), true);
});

test("calibration state preserves the exact integer offset for the required protocol", () => {
  assert.deepEqual(parseCalibrationState({ protocolVersion: 1, offsetMs: -37 }, 1), {
    protocolVersion: 1,
    offsetMs: -37,
  });
  assert.equal(parseCalibrationState({ protocolVersion: 2, offsetMs: -37 }, 1), null);
});
