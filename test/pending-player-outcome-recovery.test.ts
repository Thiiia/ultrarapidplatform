import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredPlayerOutcome, recoverPendingPlayerOutcome, recoverRoutePlayerOutcome } from "@/lib/pending-player-outcome-recovery";
import type { PendingPlayerOutcome } from "@/lib/pending-player-outcome-store";

const attemptId = "11111111-1111-4111-8111-111111111111";

const pending: PendingPlayerOutcome = {
  receipt: {
    receiptVersion: 1,
    contractVersion: 1,
    songAssetId: "song-a",
    activityKey: "early-algebra",
    authorId: "author-a",
    revision: "revision-a",
    source: "authored",
    runtimeCapabilities: ["authored-v3"],
    launchAttemptId: attemptId,
    chart: { bucket: "songs", path: "chart.chart" },
    sidecar: { bucket: "songs", path: "chart.encounters.json" },
    audio: { bucket: "songs", path: "song.mp3" },
    counts: { encounters: 1, equations: 1, targets: 1 },
    hashes: {
      chartSha256: "a".repeat(64),
      sidecarSha256: "b".repeat(64),
      audioSha256: "c".repeat(64),
    },
  },
  completion: {
    completionVersion: 2,
    outcome: "completed",
    completedEvents: 1,
    requiredEvents: 1,
    solvedSets: 1,
    hitAttempts: 1,
  },
};

const storedCompletion = {
  completionVersion: 2,
  outcome: "completed",
  completedEvents: 1,
  requiredEvents: 1,
  solvedSets: 1,
  hitAttempts: 1,
  launchAttemptId: attemptId,
  createdAt: "2026-10-08T00:00:00.000Z",
};

test("a saved result readback is accepted only for the route's launch attempt", () => {
  assert.deepEqual(parseStoredPlayerOutcome(attemptId, storedCompletion), pending.completion);
  assert.equal(
    parseStoredPlayerOutcome("22222222-2222-4222-8222-222222222222", storedCompletion),
    null,
  );
});

test("a terminal refresh rechecks an initially empty route outcome lookup", async () => {
  const calls: string[] = [];
  let lookupCount = 0;
  const result = await recoverRoutePlayerOutcome({
    launchAttemptId: attemptId,
    readExistingOutcome: async () => {
      calls.push("get");
      lookupCount += 1;
      return { ok: true, outcome: lookupCount === 1 ? null : storedCompletion };
    },
    refreshAttempt: async () => {
      calls.push("refresh");
      throw new Error("attempt is terminal");
    },
    isTerminalRefreshError: (error) => error instanceof Error && error.message === "attempt is terminal",
  });

  assert.deepEqual(calls, ["get", "refresh", "get"]);
  assert.deepEqual(result, { kind: "already-saved", completion: pending.completion });
});

test("an active attempt is refreshed before a queued result becomes eligible to POST", async () => {
  const calls: string[] = [];
  const result = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => {
      calls.push("get");
      return { ok: true, outcome: null };
    },
    refreshAttempt: async () => {
      calls.push("refresh");
      return { receipt: pending.receipt, value: "fresh package" };
    },
  });

  assert.deepEqual(calls, ["get", "refresh"]);
  assert.deepEqual(result, { kind: "active", value: "fresh package" });
});

test("a matching saved result is acknowledged without replaying the POST", async () => {
  let refreshCalls = 0;
  const result = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => ({ ok: true, outcome: storedCompletion }),
    refreshAttempt: async () => {
      refreshCalls += 1;
      return { receipt: pending.receipt, value: "must not be used" };
    },
  });

  assert.deepEqual(result, { kind: "already-saved", completion: pending.completion });
  assert.equal(refreshCalls, 0);
});

test("a matching result found after terminal refresh covers a commit race", async () => {
  let getCalls = 0;
  const result = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => {
      getCalls += 1;
      return { ok: true, outcome: getCalls === 1 ? null : storedCompletion };
    },
    refreshAttempt: async () => {
      throw new Error("attempt is terminal");
    },
  });

  assert.equal(getCalls, 2);
  assert.deepEqual(result, { kind: "already-saved", completion: pending.completion });
});

test("a conflicting outcome or ambiguous terminal attempt is never replayed", async () => {
  let refreshCalls = 0;
  const conflict = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => ({
      ok: true,
      outcome: { ...storedCompletion, hitAttempts: 2 },
    }),
    refreshAttempt: async () => {
      refreshCalls += 1;
      return { receipt: pending.receipt, value: "unexpected" };
    },
  });
  assert.deepEqual(conflict, { kind: "blocked" });

  const ambiguous = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => ({ ok: false }),
    refreshAttempt: async () => {
      refreshCalls += 1;
      throw new Error("network unavailable");
    },
  });
  assert.deepEqual(ambiguous, { kind: "blocked" });
  assert.equal(refreshCalls, 1);
});

test("an active refresh with a changed immutable receipt is blocked", async () => {
  const result = await recoverPendingPlayerOutcome({
    pending,
    readExistingOutcome: async () => ({ ok: true, outcome: null }),
    refreshAttempt: async () => ({
      receipt: { ...pending.receipt, revision: "different-revision" },
      value: "must not be used",
    }),
  });

  assert.deepEqual(result, { kind: "blocked" });
});
