import {
  LaunchAttemptReceiptSchema,
  PlatformPlayerCompletionSchema,
} from "@/lib/platform-player-bridge";
import type { PendingPlayerOutcome } from "@/lib/pending-player-outcome-store";

type ExistingOutcomeLookup = {
  ok: boolean;
  outcome?: unknown | null;
};

type RefreshedAttempt<T> = {
  receipt: unknown;
  value: T;
};

export type PendingPlayerOutcomeRecovery<T> =
  | { kind: "already-saved"; completion: PendingPlayerOutcome["completion"] }
  | { kind: "active"; value: T }
  | { kind: "blocked" };

export type RoutePlayerOutcomeRecovery<T> =
  | { kind: "already-saved"; completion: PendingPlayerOutcome["completion"] }
  | { kind: "launched"; value: T }
  | { kind: "launch-failed"; error: unknown };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parseStoredPlayerOutcome(launchAttemptId: string, value: unknown) {
  const candidate = value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
  if (!candidate || candidate.launchAttemptId !== launchAttemptId) return null;

  const parsed = PlatformPlayerCompletionSchema.safeParse({
    completionVersion: candidate.completionVersion,
    outcome: candidate.outcome,
    completedEvents: candidate.completedEvents,
    requiredEvents: candidate.requiredEvents,
    solvedSets: candidate.solvedSets,
    hitAttempts: candidate.hitAttempts,
    ...(candidate.completionVersion === 3 ? { missionSteps: candidate.missionSteps } : {}),
  });
  return parsed.success ? parsed.data : null;
}

function parseMatchingStoredCompletion(pending: PendingPlayerOutcome, value: unknown) {
  const completion = parseStoredPlayerOutcome(pending.receipt.launchAttemptId, value);
  if (!completion || canonicalJson(completion) !== canonicalJson(pending.completion)) return null;
  return completion;
}

async function safelyReadExistingOutcome(read: () => Promise<ExistingOutcomeLookup>) {
  try {
    return await read();
  } catch {
    return { ok: false } satisfies ExistingOutcomeLookup;
  }
}

/**
 * Restore a route's persisted result before refreshing its launch. If a
 * terminal refresh races with the first empty lookup, check once more for the
 * outcome that made the attempt terminal.
 */
export async function recoverRoutePlayerOutcome<T>(input: {
  launchAttemptId: string | null;
  readExistingOutcome: () => Promise<ExistingOutcomeLookup>;
  refreshAttempt: () => Promise<T>;
  isTerminalRefreshError: (error: unknown) => boolean;
}): Promise<RoutePlayerOutcomeRecovery<T>> {
  const readSavedCompletion = async () => {
    if (!input.launchAttemptId) return null;
    const lookup = await safelyReadExistingOutcome(input.readExistingOutcome);
    return lookup.ok
      ? parseStoredPlayerOutcome(input.launchAttemptId, lookup.outcome)
      : null;
  };

  const existing = await readSavedCompletion();
  if (existing) return { kind: "already-saved", completion: existing };

  try {
    return { kind: "launched", value: await input.refreshAttempt() };
  } catch (error) {
    if (input.launchAttemptId && input.isTerminalRefreshError(error)) {
      const racedOutcome = await readSavedCompletion();
      if (racedOutcome) return { kind: "already-saved", completion: racedOutcome };
    }
    return { kind: "launch-failed", error };
  }
}

/**
 * Reconcile a browser-queued completion before replaying it. A successful
 * refresh proves the attempt is still active; a matching GET proves it was
 * already saved. Terminal or ambiguous attempts are never blindly reposted.
 */
export async function recoverPendingPlayerOutcome<T>(input: {
  pending: PendingPlayerOutcome;
  readExistingOutcome: () => Promise<ExistingOutcomeLookup>;
  refreshAttempt: () => Promise<RefreshedAttempt<T>>;
}): Promise<PendingPlayerOutcomeRecovery<T>> {
  const readSavedCompletion = async () => {
    const lookup = await safelyReadExistingOutcome(input.readExistingOutcome);
    if (!lookup.ok || lookup.outcome == null) return { kind: "none" as const };
    const completion = parseMatchingStoredCompletion(input.pending, lookup.outcome);
    return completion
      ? { kind: "matching" as const, completion }
      : { kind: "different" as const };
  };

  const firstLookup = await readSavedCompletion();
  if (firstLookup.kind === "matching") {
    return { kind: "already-saved", completion: firstLookup.completion };
  }
  if (firstLookup.kind === "different") return { kind: "blocked" };

  try {
    const refreshed = await input.refreshAttempt();
    const receipt = LaunchAttemptReceiptSchema.safeParse(refreshed.receipt);
    if (receipt.success &&
      canonicalJson(receipt.data) === canonicalJson(input.pending.receipt)) {
      return { kind: "active", value: refreshed.value };
    }
  } catch {
    // Recheck below in case the outcome committed between the first GET and refresh.
  }

  const secondLookup = await readSavedCompletion();
  if (secondLookup.kind === "matching") {
    return { kind: "already-saved", completion: secondLookup.completion };
  }
  return { kind: "blocked" };
}
