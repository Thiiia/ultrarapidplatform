import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentAppUser } from "@/lib/current-user";
import { BridgeReceiptSchema, PlatformPlayerCompletionSchema } from "@/lib/platform-player-bridge";
import { prisma } from "@/lib/prisma";
import { prismaPlayerAttemptLifecycleRepository } from "@/lib/prisma-player-attempt-lifecycle";
import { persistPlayerRunOutcome, type PlayerRunOutcomeRecord } from "@/lib/player-run-lifecycle";

const LaunchAttemptIdSchema = z.string().uuid();
const OutcomeMutationSchema = z.object({
  receipt: BridgeReceiptSchema,
  completion: PlatformPlayerCompletionSchema,
}).strict();

function responseForOutcome(outcome: Omit<PlayerRunOutcomeRecord, "userId">) {
  return {
    ok: true,
    outcome: {
      launchAttemptId: outcome.launchAttemptId,
      outcome: outcome.outcome,
      completionVersion: outcome.completionVersion,
      completedEvents: outcome.completedEvents,
      requiredEvents: outcome.requiredEvents,
      solvedSets: outcome.solvedSets,
      hitAttempts: outcome.hitAttempts,
      ...(outcome.completionVersion === 3 && Array.isArray(outcome.missionSteps)
        ? { missionSteps: outcome.missionSteps }
        : {}),
      createdAt: outcome.createdAt.toISOString(),
    },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const launchAttemptId = LaunchAttemptIdSchema.parse(
      new URL(request.url).searchParams.get("launchAttemptId"),
    );
    const outcome = await prisma.playerRunOutcome.findFirst({
      where: { launchAttemptId, userId: user.id },
      select: { launchAttemptId: true, outcome: true, completionVersion: true, completedEvents: true, requiredEvents: true, solvedSets: true, hitAttempts: true, missionSteps: true, createdAt: true },
    });
    return NextResponse.json(outcome ? responseForOutcome(outcome) : { outcome: null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const body = OutcomeMutationSchema.parse(await request.json());
    const result = await persistPlayerRunOutcome({
      repository: prismaPlayerAttemptLifecycleRepository,
      userId: user.id,
      receipt: body.receipt,
      completion: body.completion,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ...responseForOutcome(result.outcome),
      ...(result.idempotent ? { idempotent: true } : {}),
    }, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 },
    );
  }
}
