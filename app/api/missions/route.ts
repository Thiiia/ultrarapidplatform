import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MISSION_CONTENT,
  validateMissionContent,
} from "@/lib/contracts/missionContent";

export const runtime = "nodejs";

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/**
 * GET /api/missions
 * - student/teacher: list published missions (metadata)
 */
export async function GET(request: Request) {
  const role = getCookieValue(request.headers.get("cookie"), "role");

  if (role !== "student" && role !== "teacher") {
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
  const role = getCookieValue(request.headers.get("cookie"), "role");

  if (role !== "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
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

  // Mock auth has no user identity yet: pick any teacher as the author.
  const teacher = await prisma.user.findFirst({
    where: { role: "teacher" },
    select: { id: true },
  });

  if (!teacher) {
    return NextResponse.json(
      { error: "No teacher user found to assign as author" },
      { status: 500 }
    );
  }

  const mission = await prisma.mission.create({
    data: {
      title,
      description,
      published,
      contentJson: validation.data as any,
      authorId: teacher.id,
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