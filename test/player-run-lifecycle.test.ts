import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type {
  PlayerAttemptLifecycleRepository,
  PlayerAttemptLifecycleTransaction,
  PlayerLaunchAttemptRecord,
  PlayerLaunchAttemptStatus,
  PlayerRunOutcomeRecord,
} from "../lib/player-run-lifecycle";
import {
  persistPlayerRunOutcome,
  returnPlayerLaunchAttempt,
} from "../lib/player-run-lifecycle";

class InMemoryAttemptLifecycleStore implements PlayerAttemptLifecycleRepository {
  readonly attempts = new Map<string, PlayerLaunchAttemptRecord>();
  readonly outcomes = new Map<string, PlayerRunOutcomeRecord>();

  async transaction<T>(work: (transaction: PlayerAttemptLifecycleTransaction) => Promise<T>): Promise<T> {
    return work({
      findLaunchAttempt: async (launchAttemptId) => this.attempts.get(launchAttemptId) ?? null,
      findRunOutcome: async (launchAttemptId) => this.outcomes.get(launchAttemptId) ?? null,
      transitionLaunchAttempt: async (launchAttemptId, from, to) => {
        const attempt = this.attempts.get(launchAttemptId);
        if (!attempt || !from.includes(attempt.status as PlayerLaunchAttemptStatus)) return false;
        this.attempts.set(launchAttemptId, { ...attempt, status: to });
        return true;
      },
      createRunOutcome: async (input) => {
        if (this.outcomes.has(input.launchAttemptId)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        const outcome: PlayerRunOutcomeRecord = { ...input, createdAt: new Date() };
        this.outcomes.set(input.launchAttemptId, outcome);
        return outcome;
      },
    });
  }
}

const launchAttemptId = randomUUID();
const receipt = {
  receiptVersion: 1 as const,
  contractVersion: 1 as const,
  songAssetId: "number-bonds-contract-fixture-5-2-3",
  activityKey: "number-bonds",
  authorId: "runtime-contract-fixture",
  revision: "number-bonds-sequence-v1-5-2-3",
  source: "authored" as const,
  runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
  launchAttemptId,
  chart: { bucket: "Charts", path: "runtime-contract-fixture/number-bonds/5-2-3.chart" },
  sidecar: { bucket: "SidecarJsons", path: "runtime-contract-fixture/number-bonds/5-2-3.json" },
  audio: { bucket: "Songs", path: "number-bonds-contract-fixture-5-2-3.mp3" },
  counts: { encounters: 15, equations: 1, targets: 5 },
  hashes: { chartSha256: "a".repeat(64), sidecarSha256: "b".repeat(64), audioSha256: "c".repeat(64) },
};
const completion = {
  completionVersion: 2 as const,
  outcome: "completed" as const,
  completedEvents: 15,
  requiredEvents: 15,
  solvedSets: 1,
  hitAttempts: 7,
};

function createStore() {
  const store = new InMemoryAttemptLifecycleStore();
  store.attempts.set(launchAttemptId, {
    userId: "student-1",
    receipt,
    status: "active",
  });
  return store;
}

test("canonical five-gem completion persists one receipt-bound outcome and is idempotent", async () => {
  const store = createStore();
  const first = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.status, 201);
  assert.equal(first.idempotent, false);
  assert.equal(first.outcome.launchAttemptId, launchAttemptId);
  assert.equal(first.outcome.completionVersion, 2);
  assert.equal(first.outcome.completedEvents, 15);
  assert.equal(first.outcome.requiredEvents, 15);
  assert.equal(first.outcome.solvedSets, 1);
  assert.equal(store.outcomes.size, 1);
  assert.equal(store.attempts.get(launchAttemptId)?.status, "completed");

  const replay = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion,
  });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.status, 200);
  assert.equal(replay.idempotent, true);
  assert.equal(store.outcomes.size, 1);
});

test("outcome persistence rejects changed completion fields and altered receipt identity", async () => {
  const store = createStore();
  const first = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion,
  });
  assert.equal(first.ok, true);

  const alteredCompletion = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion: { ...completion, hitAttempts: 8 },
  });
  assert.deepEqual(alteredCompletion, {
    ok: false,
    status: 409,
    error: "A different outcome is already recorded for this launch attempt",
  });

  const alteredReceipt = {
    ...receipt,
    hashes: { ...receipt.hashes, sidecarSha256: "d".repeat(64) },
  };
  const wrongReceipt = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt: alteredReceipt,
    completion,
  });
  assert.deepEqual(wrongReceipt, {
    ok: false,
    status: 409,
    error: "Outcome receipt does not match the launch attempt",
  });
  assert.equal(store.outcomes.size, 1);
});

test("Return terminalizes the same attempt and rejects late completion without changing its result", async () => {
  const store = createStore();
  const saved = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion,
  });
  assert.equal(saved.ok, true);

  const returned = await returnPlayerLaunchAttempt({
    repository: store,
    userId: "student-1",
    receipt,
    fullReceipt: receipt,
  });
  assert.deepEqual(returned, { ok: true, idempotent: false });
  assert.equal(store.attempts.get(launchAttemptId)?.status, "returned");

  const lateCompletion = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-1",
    receipt,
    completion,
  });
  assert.deepEqual(lateCompletion, {
    ok: false,
    status: 409,
    error: "Launch attempt has already been returned",
  });
  const duplicateReturn = await returnPlayerLaunchAttempt({
    repository: store,
    userId: "student-1",
    receipt,
    fullReceipt: receipt,
  });
  assert.deepEqual(duplicateReturn, { ok: true, idempotent: true });
  assert.equal(store.outcomes.size, 1);
});

test("a learner cannot complete or return another learner's launch attempt", async () => {
  const store = createStore();
  const wrongUserCompletion = await persistPlayerRunOutcome({
    repository: store,
    userId: "student-2",
    receipt,
    completion,
  });
  assert.deepEqual(wrongUserCompletion, {
    ok: false,
    status: 403,
    error: "Launch attempt does not belong to this user",
  });
  const wrongUserReturn = await returnPlayerLaunchAttempt({
    repository: store,
    userId: "student-2",
    receipt,
    fullReceipt: receipt,
  });
  assert.deepEqual(wrongUserReturn, {
    ok: false,
    status: 403,
    error: "Launch attempt does not belong to this user",
  });
  assert.equal(store.outcomes.size, 0);
});
