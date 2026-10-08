import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingPlayerOutcome,
  getPendingPlayerOutcome,
  rememberPendingPlayerOutcome,
  type PendingPlayerOutcome,
} from "@/lib/pending-player-outcome-store";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

function outcome(launchAttemptId: string): PendingPlayerOutcome {
  return {
    receipt: {
      receiptVersion: 1,
      contractVersion: 1,
      songAssetId: "song-a",
      activityKey: "early-algebra",
      authorId: "author-a",
      revision: "revision-a",
      source: "authored",
      runtimeCapabilities: ["authored-v3"],
      launchAttemptId,
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
}

test("a validated pending outcome survives reload and is scoped to its launch attempt", () => {
  const storage = new MemoryStorage();
  const pending = outcome("11111111-1111-4111-8111-111111111111");

  assert.equal(rememberPendingPlayerOutcome(storage, pending, 10_000), true);
  assert.deepEqual(
    getPendingPlayerOutcome(storage, pending.receipt.launchAttemptId, 10_001),
    pending,
  );
  assert.equal(
    getPendingPlayerOutcome(storage, "22222222-2222-4222-8222-222222222222", 10_001),
    null,
  );
});

test("expired or mismatched local outcomes are discarded", () => {
  const storage = new MemoryStorage();
  const attemptId = "11111111-1111-4111-8111-111111111111";
  storage.setItem(`ur:pending-player-outcome:v1:${attemptId}`, JSON.stringify({
    version: 1,
    savedAt: 10_000,
    outcome: outcome("22222222-2222-4222-8222-222222222222"),
  }));

  assert.equal(getPendingPlayerOutcome(storage, attemptId, 10_001), null);
  assert.equal(storage.getItem(`ur:pending-player-outcome:v1:${attemptId}`), null);

  const expired = outcome(attemptId);
  assert.equal(rememberPendingPlayerOutcome(storage, expired, 10_000), true);
  assert.equal(getPendingPlayerOutcome(storage, attemptId, 10_000 + 7 * 24 * 60 * 60 * 1000 + 1), null);
});

test("acknowledgement clears only the matching attempt", () => {
  const storage = new MemoryStorage();
  const first = outcome("11111111-1111-4111-8111-111111111111");
  const second = outcome("22222222-2222-4222-8222-222222222222");
  assert.equal(rememberPendingPlayerOutcome(storage, first, 10_000), true);
  assert.equal(rememberPendingPlayerOutcome(storage, second, 10_001), true);

  clearPendingPlayerOutcome(storage, first.receipt.launchAttemptId);

  assert.equal(getPendingPlayerOutcome(storage, first.receipt.launchAttemptId, 10_002), null);
  assert.deepEqual(getPendingPlayerOutcome(storage, second.receipt.launchAttemptId, 10_002), second);
});
