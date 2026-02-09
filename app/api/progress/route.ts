import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ProgressStatus = "not_started" | "in_progress" | "complete";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const missionId: string | undefined = body?.missionId;
  const status: ProgressStatus | undefined = body?.status;
  const scoreRaw = body?.score;

  const allowed: ProgressStatus[] = ["not_started", "in_progress", "complete"];

  if (!missionId || typeof missionId !== "string") {
    return NextResponse.json({ error: "missionId is required" }, { status: 400 });
  }

  if (!status || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowed.join(", ")}` },
      { status: 400 }
    );
  }

  const score = Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : 0;

  // Mock stage: apply progress to the first student user
  const student = await prisma.user.findFirst({
    where: { role: "student" },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "No student found" }, { status: 404 });
  }

  // Ensure mission exists
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  const progress = await prisma.progress.upsert({
    where: {
      userId_missionId: {
        userId: student.id,
        missionId,
      },
    },
    update: {
      status,
      score,
    },
    create: {
      userId: student.id,
      missionId,
      status,
      score,
    },
    select: {
      id: true,
      status: true,
      score: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, progress });
}
