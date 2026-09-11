import assert from "node:assert/strict";
import test from "node:test";
import { createBridgeContext, needsCalibration, validateBridgeMessage } from "../lib/platform-player-bridge";

const receipt = {
  receiptVersion: 1 as const, songAssetId: "song", activityKey: "early-algebra", authorId: "author", revision: "rev",
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

test("calibration is required when protocol is absent or stale", () => {
  assert.equal(needsCalibration({ protocolVersion: 0 }), true);
  assert.equal(needsCalibration({ protocolVersion: 1 }), false);
});
