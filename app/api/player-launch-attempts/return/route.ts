import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentAppUser } from "@/lib/current-user";
import { LaunchAttemptReceiptSchema } from "@/lib/platform-player-bridge";
import { prismaPlayerAttemptLifecycleRepository } from "@/lib/prisma-player-attempt-lifecycle";
import { returnPlayerLaunchAttempt } from "@/lib/player-run-lifecycle";

const ReturnMutationSchema = z.object({ receipt: LaunchAttemptReceiptSchema }).strict();

export async function POST(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const body = ReturnMutationSchema.parse(await request.json());
    const result = await returnPlayerLaunchAttempt({
      repository: prismaPlayerAttemptLifecycleRepository,
      userId: user.id,
      receipt: body.receipt,
      fullReceipt: body.receipt,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      launchAttemptId: body.receipt.launchAttemptId,
      terminalStatus: "returned",
      ...(result.idempotent ? { idempotent: true } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 },
    );
  }
}
