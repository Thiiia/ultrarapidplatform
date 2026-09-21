import assert from "node:assert/strict";
import test from "node:test";
import { shouldCreatePlayerLaunchAttempt } from "../lib/player-launch-attempt-policy";

test("does not create a player launch attempt for a known activity blocked by Unity runtime compatibility", () => {
  assert.equal(shouldCreatePlayerLaunchAttempt({
    hasAuthenticatedPlayer: true,
    refreshLaunchAttemptId: null,
    source: "authored",
    canLaunch: false,
    hasReceipt: true,
    hasLaunchAttemptId: true,
  }), false);
});

test("creates a player launch attempt only for a fresh playable package", () => {
  assert.equal(shouldCreatePlayerLaunchAttempt({
    hasAuthenticatedPlayer: true,
    refreshLaunchAttemptId: null,
    source: "authored",
    canLaunch: true,
    hasReceipt: true,
    hasLaunchAttemptId: true,
  }), true);
});
