import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireCurrentAppUser } from "@/lib/current-user";
import { BridgeReceiptSchema, PlatformPlayerCompletionSchema } from "@/lib/platform-player-bridge";
import { prisma } from "@/lib/prisma";

const LaunchAttemptIdSchema = z.string().uuid();
const OutcomeMutationSchema = z.object({
  receipt: BridgeReceiptSchema,
  completion: PlatformPlayerCompletionSchema,
}).strict();

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

function responseForOutcome(outcome: {
  launchAttemptId: string;
  outcome: string;
  completedEvents: number;
  completionVersion: number | null;
  requiredEvents: number | null;
  solvedSets: number | null;
  hitAttempts: number;
  createdAt: Date;
}) {
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
      select: { launchAttemptId: true, outcome: true, completionVersion: true, completedEvents: true, requiredEvents: true, solvedSets: true, hitAttempts: true, createdAt: true },
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
    const launchAttemptId = body.receipt.launchAttemptId;
    const launch = await prisma.playerLaunchAttempt.findUnique({
      where: { launchAttemptId },
      select: { userId: true, receipt: true },
    });

    if (!launch) {
      return NextResponse.json({ error: "Launch attempt is not registered" }, { status: 404 });
    }
    if (launch.userId !== user.id) {
      return NextResponse.json({ error: "Launch attempt does not belong to this user" }, { status: 403 });
    }
    if (canonicalJson(launch.receipt) !== canonicalJson(body.receipt)) {
      return NextResponse.json({ error: "Outcome receipt does not match the launch attempt" }, { status: 409 });
    }

    const existing = await prisma.playerRunOutcome.findUnique({
      where: { launchAttemptId },
      select: { launchAttemptId: true, userId: true, outcome: true, completionVersion: true, completedEvents: true, requiredEvents: true, solvedSets: true, hitAttempts: true, createdAt: true },
    });
    if (existing) {
      const sameOutcome = existing.userId === user.id &&
        existing.outcome === body.completion.outcome &&
        existing.completionVersion === body.completion.completionVersion &&
        existing.completedEvents === body.completion.completedEvents &&
        existing.requiredEvents === body.completion.requiredEvents &&
        existing.solvedSets === body.completion.solvedSets &&
        existing.hitAttempts === body.completion.hitAttempts;
      if (!sameOutcome) {
        return NextResponse.json({ error: "A different outcome is already recorded for this launch attempt" }, { status: 409 });
      }
      return NextResponse.json({ ...responseForOutcome(existing), idempotent: true });
    }

    try {
      const created = await prisma.playerRunOutcome.create({
        data: {
          launchAttemptId,
          userId: user.id,
          outcome: body.completion.outcome,
          completionVersion: body.completion.completionVersion,
          completedEvents: body.completion.completedEvents,
          requiredEvents: body.completion.requiredEvents,
          solvedSets: body.completion.solvedSets,
          hitAttempts: body.completion.hitAttempts,
        },
        select: { launchAttemptId: true, outcome: true, completionVersion: true, completedEvents: true, requiredEvents: true, solvedSets: true, hitAttempts: true, createdAt: true },
      });
      return NextResponse.json(responseForOutcome(created), { status: 201 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const raced = await prisma.playerRunOutcome.findUniqueOrThrow({
        where: { launchAttemptId },
        select: { launchAttemptId: true, userId: true, outcome: true, completionVersion: true, completedEvents: true, requiredEvents: true, solvedSets: true, hitAttempts: true, createdAt: true },
      });
      const sameOutcome = raced.userId === user.id &&
        raced.outcome === body.completion.outcome &&
        raced.completionVersion === body.completion.completionVersion &&
        raced.completedEvents === body.completion.completedEvents &&
        raced.requiredEvents === body.completion.requiredEvents &&
        raced.solvedSets === body.completion.solvedSets &&
        raced.hitAttempts === body.completion.hitAttempts;
      if (!sameOutcome) {
        return NextResponse.json({ error: "A different outcome is already recorded for this launch attempt" }, { status: 409 });
      }
      return NextResponse.json({ ...responseForOutcome(raced), idempotent: true });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 },
    );
  }
}
