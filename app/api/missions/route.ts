import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  DEFAULT_MISSION_CONTENT,
  validateMissionContent,
} from "@/lib/contracts/missionContent";

export const runtime = "nodejs";

/**
 * GET /api/missions
 * - student/teacher: list published missions (metadata)
 */
export async function GET() {
  const user = await getCurrentAppUser().catch(() => null);

  if (!user || (user.role !== "student" && user.role !== "teacher")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missions = await prisma.mission.findMany({
    where: { published: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ missions });
}

/**
 * POST /api/missions
 * - teacher only: create a mission (defaults to draft + default content)
 *
 * Body (all optional):
 * {
 *   "title": string,
 *   "description": string,
 *   "contentJson": any,
 *   "published": boolean
 * }
 */
export async function POST(request: Request) {
  const user = await getCurrentAppUser().catch(() => null);

  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsedBody: unknown = await request.json();
    if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
      body = parsedBody as Record<string, unknown>;
    }
  } catch {
    // allow empty body
  }

  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim()
      : "Untitled mission";

  const description =
    typeof body.description === "string" ? body.description : "";

  const published = typeof body.published === "boolean" ? body.published : false;

  const contentCandidate =
    body.contentJson !== undefined ? body.contentJson : DEFAULT_MISSION_CONTENT;

  const validation = validateMissionContent(contentCandidate);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Invalid contentJson", details: validation.errors },
      { status: 400 }
    );
  }

  const mission = await prisma.mission.create({
    data: {
      title,
      description,
      published,
      contentJson: validation.data as Prisma.InputJsonValue,
      authorId: user.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      contentJson: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ mission }, { status: 201 });
}
