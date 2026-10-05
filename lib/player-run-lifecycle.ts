import type { PlatformPlayerCompletion } from "@/lib/platform-player-bridge";

export type PlayerLaunchAttemptStatus = "active" | "completed" | "returned";

export type PlayerLaunchAttemptRecord = {
  userId: string;
  receipt: unknown;
  status: string;
};

export type PlayerRunOutcomeRecord = {
  launchAttemptId: string;
  userId: string;
  outcome: string;
  completionVersion: number | null;
  completedEvents: number;
  requiredEvents: number | null;
  solvedSets: number | null;
  hitAttempts: number;
  missionSteps: unknown | null;
  createdAt: Date;
};

export type PlayerAttemptLifecycleTransaction = {
  findLaunchAttempt(launchAttemptId: string): Promise<PlayerLaunchAttemptRecord | null>;
  findRunOutcome(launchAttemptId: string): Promise<PlayerRunOutcomeRecord | null>;
  transitionLaunchAttempt(
    launchAttemptId: string,
    from: readonly PlayerLaunchAttemptStatus[],
    to: PlayerLaunchAttemptStatus,
  ): Promise<boolean>;
  createRunOutcome(input: {
    launchAttemptId: string;
    userId: string;
    outcome: string;
    completionVersion: number;
    completedEvents: number;
    requiredEvents: number;
    solvedSets: number;
    hitAttempts: number;
    missionSteps: unknown | null;
  }): Promise<PlayerRunOutcomeRecord>;
};

export type PlayerAttemptLifecycleRepository = {
  transaction<T>(
    work: (transaction: PlayerAttemptLifecycleTransaction) => Promise<T>,
  ): Promise<T>;
};

export type PlayerRunLifecycleResult =
  | { ok: true; status: 200 | 201; idempotent: boolean; outcome: PlayerRunOutcomeRecord }
  | { ok: false; status: 404 | 403 | 409; error: string };

export type PlayerAttemptReturnResult =
  | { ok: true; idempotent: boolean }
  | { ok: false; status: 404 | 403 | 409; error: string };

export function canonicalPlayerJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPlayerJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalPlayerJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function matchesCompletion(
  existing: PlayerRunOutcomeRecord,
  userId: string,
  completion: PlatformPlayerCompletion,
): boolean {
  return existing.userId === userId &&
    existing.outcome === completion.outcome &&
    existing.completionVersion === completion.completionVersion &&
    existing.completedEvents === completion.completedEvents &&
    existing.requiredEvents === completion.requiredEvents &&
    existing.solvedSets === completion.solvedSets &&
    existing.hitAttempts === completion.hitAttempts &&
    canonicalPlayerJson(existing.missionSteps ?? null) === canonicalPlayerJson(
      completion.completionVersion === 3 ? completion.missionSteps : null,
    );
}

function conflict(error: string): PlayerRunLifecycleResult {
  return { ok: false, status: 409, error };
}

export async function persistPlayerRunOutcome(input: {
  repository: PlayerAttemptLifecycleRepository;
  userId: string;
  receipt: { launchAttemptId: string };
  completion: PlatformPlayerCompletion;
}): Promise<PlayerRunLifecycleResult> {
  return input.repository.transaction(async (transaction) => {
    const launchAttemptId = input.receipt.launchAttemptId;
    const attempt = await transaction.findLaunchAttempt(launchAttemptId);

    if (!attempt) {
      return { ok: false, status: 404, error: "Launch attempt is not registered" };
    }
    if (attempt.userId !== input.userId) {
      return { ok: false, status: 403, error: "Launch attempt does not belong to this user" };
    }
    if (canonicalPlayerJson(attempt.receipt) !== canonicalPlayerJson(input.receipt)) {
      return conflict("Outcome receipt does not match the launch attempt");
    }
    if (attempt.status === "returned") {
      return conflict("Launch attempt has already been returned");
    }

    const existing = await transaction.findRunOutcome(launchAttemptId);
    if (existing) {
      if (!matchesCompletion(existing, input.userId, input.completion)) {
        return conflict("A different outcome is already recorded for this launch attempt");
      }
      if (attempt.status === "active") {
        const transitioned = await transaction.transitionLaunchAttempt(
          launchAttemptId,
          ["active"],
          "completed",
        );
        if (!transitioned) {
          const current = await transaction.findLaunchAttempt(launchAttemptId);
          if (current?.status === "returned") {
            return conflict("Launch attempt has already been returned");
          }
          if (current?.status !== "completed") {
            return conflict("Launch attempt is no longer active");
          }
        }
      } else if (attempt.status !== "completed") {
        return conflict("Launch attempt is no longer active");
      }
      return { ok: true, status: 200, idempotent: true, outcome: existing };
    }

    if (attempt.status !== "active") {
      return conflict("Launch attempt is no longer active");
    }

    const transitioned = await transaction.transitionLaunchAttempt(
      launchAttemptId,
      ["active"],
      "completed",
    );
    if (!transitioned) {
      const current = await transaction.findLaunchAttempt(launchAttemptId);
      if (current?.status === "returned") {
        return conflict("Launch attempt has already been returned");
      }
      const racedOutcome = await transaction.findRunOutcome(launchAttemptId);
      if (current?.status === "completed" && racedOutcome &&
        matchesCompletion(racedOutcome, input.userId, input.completion)) {
        return { ok: true, status: 200, idempotent: true, outcome: racedOutcome };
      }
      return conflict("Launch attempt is no longer active");
    }

    const outcome = await transaction.createRunOutcome({
      launchAttemptId,
      userId: input.userId,
      outcome: input.completion.outcome,
      completionVersion: input.completion.completionVersion,
      completedEvents: input.completion.completedEvents,
      requiredEvents: input.completion.requiredEvents,
      solvedSets: input.completion.solvedSets,
      hitAttempts: input.completion.hitAttempts,
      missionSteps: input.completion.completionVersion === 3
        ? input.completion.missionSteps
        : null,
    });
    return { ok: true, status: 201, idempotent: false, outcome };
  });
}

export async function returnPlayerLaunchAttempt(input: {
  repository: PlayerAttemptLifecycleRepository;
  userId: string;
  receipt: { launchAttemptId: string };
  fullReceipt: unknown;
}): Promise<PlayerAttemptReturnResult> {
  return input.repository.transaction(async (transaction) => {
    const attempt = await transaction.findLaunchAttempt(input.receipt.launchAttemptId);
    if (!attempt) {
      return { ok: false, status: 404, error: "Launch attempt is not registered" };
    }
    if (attempt.userId !== input.userId) {
      return { ok: false, status: 403, error: "Launch attempt does not belong to this user" };
    }
    if (canonicalPlayerJson(attempt.receipt) !== canonicalPlayerJson(input.fullReceipt)) {
      return { ok: false, status: 409, error: "Return receipt does not match the launch attempt" };
    }
    if (attempt.status === "returned") {
      return { ok: true, idempotent: true };
    }
    if (attempt.status !== "active" && attempt.status !== "completed") {
      return { ok: false, status: 409, error: "Launch attempt cannot be returned" };
    }

    const transitioned = await transaction.transitionLaunchAttempt(
      input.receipt.launchAttemptId,
      ["active", "completed"],
      "returned",
    );
    if (transitioned) return { ok: true, idempotent: false };

    const current = await transaction.findLaunchAttempt(input.receipt.launchAttemptId);
    return current?.status === "returned"
      ? { ok: true, idempotent: true }
      : { ok: false, status: 409, error: "Launch attempt is no longer returnable" };
  });
}
