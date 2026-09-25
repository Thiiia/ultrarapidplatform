import assert from "node:assert/strict";
import test from "node:test";
import { createBridgeContext, needsCalibration, parseCalibrationState, validateBridgeMessage } from "../lib/platform-player-bridge";

const receipt = {
  receiptVersion: 1 as const, contractVersion: 1 as const, songAssetId: "song", activityKey: "early-algebra", authorId: "author", revision: "rev",
  source: "authored" as const, runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"], launchAttemptId: crypto.randomUUID(),
  chart: { bucket: "Charts", path: "rev/chart" }, sidecar: { bucket: "SidecarJsons", path: "rev/sidecar" }, audio: { bucket: "Songs", path: "song.mp3" },
  counts: { encounters: 1, equations: 1, targets: 1 }, hashes: { chartSha256: "a".repeat(64), sidecarSha256: "b".repeat(64), audioSha256: "c".repeat(64) },
};

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
