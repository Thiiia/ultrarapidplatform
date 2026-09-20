import assert from "node:assert/strict";
import test from "node:test";
import { createBridgeContext, needsCalibration, parseCalibrationState, validateBridgeMessage } from "../lib/platform-player-bridge";

const receipt = {
  receiptVersion: 1 as const, contractVersion: 1 as const, songAssetId: "song", activityKey: "early-algebra", authorId: "author", revision: "rev",
  source: "authored" as const, runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"], launchAttemptId: crypto.randomUUID(),
  chart: { bucket: "Charts", path: "rev/chart" }, sidecar: { bucket: "SidecarJsons", path: "rev/sidecar" }, audio: { bucket: "Songs", path: "song.mp3" },
  counts: { encounters: 1, equations: 1, targets: 1 }, hashes: { chartSha256: "a".repeat(64), sidecarSha256: "b".repeat(64), audioSha256: "c".repeat(64) },
};

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
    completion: { outcome: "completed" as const, completedEvents: 1, hitAttempts: 1 },
  };

  assert.equal(validateBridgeMessage(valid, context).ok, true);
});

test("bridge accepts a bounded, receipt-bound completion summary only", () => {
  const context = createBridgeContext(receipt, "https://game.example/", crypto.randomUUID());
  const completed = {
    type: "run-complete" as const,
    nonce: context.nonce,
    receipt,
    completion: { outcome: "completed" as const, completedEvents: 4, hitAttempts: 6 },
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
    completion: { outcome: "abandoned" as const, completedEvents: 0, hitAttempts: 0 },
  };

  assert.equal(validateBridgeMessage(abandoned, context).ok, true);
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
