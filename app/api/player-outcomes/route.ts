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

const TRANSIENT_DATABASE_ERROR_CODES = new Set([
  "P1001", // database server is unreachable
  "P1002", // database response timed out
  "P1008", // database operation timed out
  "P1017", // database connection was closed
  "P2024", // connection pool timed out
  "P2034", // transaction conflict; this endpoint is idempotent
  "08000", "08003", "08006", // connection exceptions
  "40001", "40P01", // serialization failure or deadlock
  "53300", "57P01", // too many connections or server shutdown
]);

function databaseErrorCodes(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const value = error as { code?: unknown; meta?: unknown; cause?: unknown };
  const codes = [value.code];
  if (typeof value.meta === "object" && value.meta !== null && "code" in value.meta) {
    codes.push((value.meta as { code?: unknown }).code);
  }
  if (typeof value.cause === "object" && value.cause !== null && "code" in value.cause) {
    codes.push((value.cause as { code?: unknown }).code);
  }
  return [...new Set(codes.filter((code): code is string => typeof code === "string"))];
}

function safeCaughtResponse(error: unknown) {
  if (error instanceof Error && error.message === "User is not authenticated.") {
    return NextResponse.json({ error: "Sign in is required to sync this result." }, { status: 401 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "The result request failed validation." },
      { status: 422 },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "The result request was not valid JSON." }, { status: 400 });
  }

  const codes = databaseErrorCodes(error);
  if (codes.some((code) => TRANSIENT_DATABASE_ERROR_CODES.has(code))) {
    console.warn("[player-outcomes] database temporarily unavailable", { codes });
    return NextResponse.json(
      { error: "The result service is temporarily unavailable. Please retry shortly." },
      { status: 503, headers: { "Retry-After": "2" } },
    );
  }

  console.error("[player-outcomes] request failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    ...(codes.length > 0 ? { codes } : {}),
  });
  return NextResponse.json(
    { error: "The result service could not save this run. Please retry." },
    { status: 500 },
  );
}

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
    return safeCaughtResponse(error);
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
    return safeCaughtResponse(error);
  }
}
