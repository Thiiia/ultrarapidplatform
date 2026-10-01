import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PlayerAttemptLifecycleRepository,
  PlayerAttemptLifecycleTransaction,
  PlayerLaunchAttemptStatus,
  PlayerRunOutcomeRecord,
} from "@/lib/player-run-lifecycle";

const outcomeSelect = {
  launchAttemptId: true,
  userId: true,
  outcome: true,
  completionVersion: true,
  completedEvents: true,
  requiredEvents: true,
  solvedSets: true,
  hitAttempts: true,
  missionSteps: true,
  createdAt: true,
} as const;

export const prismaPlayerAttemptLifecycleRepository: PlayerAttemptLifecycleRepository = {
  transaction<T>(work: (transaction: PlayerAttemptLifecycleTransaction) => Promise<T>) {
    return prisma.$transaction(async (db) => work({
      async findLaunchAttempt(launchAttemptId) {
        return db.playerLaunchAttempt.findUnique({
          where: { launchAttemptId },
          select: { userId: true, receipt: true, status: true },
        });
      },
      async findRunOutcome(launchAttemptId) {
        return db.playerRunOutcome.findUnique({
          where: { launchAttemptId },
          select: outcomeSelect,
        }) as Promise<PlayerRunOutcomeRecord | null>;
      },
      async transitionLaunchAttempt(launchAttemptId, from, to) {
        const changed = await db.playerLaunchAttempt.updateMany({
          where: { launchAttemptId, status: { in: [...from] } },
          data: { status: to as PlayerLaunchAttemptStatus },
        });
        return changed.count === 1;
      },
      async createRunOutcome(input) {
        return db.playerRunOutcome.create({
          data: {
            launchAttemptId: input.launchAttemptId,
            userId: input.userId,
            outcome: input.outcome,
            completionVersion: input.completionVersion,
            completedEvents: input.completedEvents,
            requiredEvents: input.requiredEvents,
            solvedSets: input.solvedSets,
            hitAttempts: input.hitAttempts,
            missionSteps: input.missionSteps == null
              ? Prisma.DbNull
              : input.missionSteps as Prisma.InputJsonValue,
          },
          select: outcomeSelect,
        }) as Promise<PlayerRunOutcomeRecord>;
      },
    }));
  },
};
