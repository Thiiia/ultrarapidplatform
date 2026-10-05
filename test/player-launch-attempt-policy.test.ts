import assert from "node:assert/strict";
import test from "node:test";
import {
  canRefreshPlayerLaunchAttempt,
  parsePlayerLaunchRefreshRequest,
  resolveLaunchAttemptIdForPackage,
  shouldCreatePlayerLaunchAttempt,
} from "../lib/player-launch-attempt-policy";

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

test("does not mint a resumable attempt id for anonymous demo packages", () => {
  let generated = false;

  assert.equal(resolveLaunchAttemptIdForPackage(
    false,
    null,
    () => {
      generated = true;
      return "anonymous-attempt";
    },
  ), null);
  assert.equal(generated, false);
});

test("authenticated packages get one attempt id and refreshes retain the active id", () => {
  let generatedCount = 0;

  assert.equal(resolveLaunchAttemptIdForPackage(true, null, () => {
    generatedCount += 1;
    return "attempt-1";
  }), "attempt-1");
  assert.equal(resolveLaunchAttemptIdForPackage(true, "attempt-existing", () => {
    generatedCount += 1;
    return "unexpected";
  }), "attempt-existing");
  assert.equal(generatedCount, 1);
});

test("refresh only revalidates the same active attempt and refuses terminal attempts", () => {
  assert.equal(canRefreshPlayerLaunchAttempt("active"), true);
  assert.equal(canRefreshPlayerLaunchAttempt("completed"), false);
  assert.equal(canRefreshPlayerLaunchAttempt("returned"), false);
  assert.equal(canRefreshPlayerLaunchAttempt("unknown"), false);
});

test("refresh requests cannot silently turn into fresh launch attempts", () => {
  assert.deepEqual(parsePlayerLaunchRefreshRequest(true, " attempt-1 "), {
    ok: true,
    launchAttemptId: "attempt-1",
  });
  assert.deepEqual(parsePlayerLaunchRefreshRequest(false, null), {
    ok: true,
    launchAttemptId: null,
  });
  assert.deepEqual(parsePlayerLaunchRefreshRequest(true, null), { ok: false });
  assert.deepEqual(parsePlayerLaunchRefreshRequest(false, "attempt-1"), { ok: false });
});
