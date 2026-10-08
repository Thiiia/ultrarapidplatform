import { z } from "zod";
import {
  LaunchAttemptReceiptSchema,
  PlatformPlayerCompletionSchema,
  type PlatformPlayerCompletion,
} from "@/lib/platform-player-bridge";

const PendingPlayerOutcomeSchema = z.object({
  receipt: LaunchAttemptReceiptSchema,
  completion: PlatformPlayerCompletionSchema,
}).strict();

const StoredPendingPlayerOutcomeSchema = z.object({
  version: z.literal(1),
  savedAt: z.number().int().positive(),
  outcome: PendingPlayerOutcomeSchema,
}).strict();

export type PendingPlayerOutcome = {
  receipt: z.infer<typeof LaunchAttemptReceiptSchema>;
  completion: PlatformPlayerCompletion;
};

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const STORAGE_KEY_PREFIX = "ur:pending-player-outcome:v1:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storageKey(launchAttemptId: string) {
  return `${STORAGE_KEY_PREFIX}${launchAttemptId}`;
}

function readStoredOutcome(storage: KeyValueStorage, launchAttemptId: string, now: number) {
  const key = storageKey(launchAttemptId);
  const raw = storage.getItem(key);
  if (!raw) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    storage.removeItem(key);
    return null;
  }

  const parsed = StoredPendingPlayerOutcomeSchema.safeParse(candidate);
  if (!parsed.success ||
    parsed.data.outcome.receipt.launchAttemptId !== launchAttemptId ||
    parsed.data.savedAt > now + 5 * 60 * 1000 ||
    now - parsed.data.savedAt > MAX_AGE_MS) {
    storage.removeItem(key);
    return null;
  }

  return parsed.data.outcome;
}

function prunePendingOutcomes(storage: KeyValueStorage, now: number) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key?.startsWith(STORAGE_KEY_PREFIX) ?? false);

  for (const key of keys) {
    const attemptId = key.slice(STORAGE_KEY_PREFIX.length);
    readStoredOutcome(storage, attemptId, now);
  }
}

/** Keep a validated, short-lived copy so a reload can retry an unacknowledged POST. */
export function rememberPendingPlayerOutcome(
  storage: KeyValueStorage,
  value: PendingPlayerOutcome,
  now = Date.now(),
): boolean {
  const parsed = PendingPlayerOutcomeSchema.safeParse(value);
  const launchAttemptId = parsed.success ? parsed.data.receipt.launchAttemptId : null;
  if (!parsed.success || !launchAttemptId) return false;

  try {
    storage.setItem(storageKey(launchAttemptId), JSON.stringify({
      version: 1,
      savedAt: now,
      outcome: parsed.data,
    }));
    prunePendingOutcomes(storage, now);
    return true;
  } catch {
    return false;
  }
}

/** Return only the current launch attempt's unexpired, schema-valid outcome. */
export function getPendingPlayerOutcome(
  storage: KeyValueStorage,
  launchAttemptId: string,
  now = Date.now(),
): PendingPlayerOutcome | null {
  try {
    return readStoredOutcome(storage, launchAttemptId, now);
  } catch {
    return null;
  }
}

/** Remove the local copy only after the server acknowledges persistence. */
export function clearPendingPlayerOutcome(storage: KeyValueStorage, launchAttemptId: string) {
  try {
    storage.removeItem(storageKey(launchAttemptId));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
