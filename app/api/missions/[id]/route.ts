import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateMissionContent } from "@/lib/contracts/missionContent";

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

function getMissionIdFromUrl(request: Request) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

/**
 * GET /api/missions/[id]
 * - student: only published
 * - teacher: any
 */
export async function GET(request: Request) {
  const role = getCookieValue(request.headers.get("cookie"), "role");

  if (role !== "student" && role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missionId = getMissionIdFromUrl(request);
  if (!missionId) {
    return NextResponse.json({ error: "Missing mission id" }, { status: 400 });
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      contentJson: true,
      updatedAt: true,
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  if (role === "student" && !mission.published) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const validation = validateMissionContent(mission.contentJson);

  return NextResponse.json({
    mission,
    contentJsonValidation: validation.ok
      ? { ok: true }
      : { ok: false, errors: validation.errors },
  });
}

/**
 * PATCH /api/missions/[id]
 * - teacher only: update mission metadata and/or contentJson and/or published flag
 *
 * Body (all optional):
 * {
 *   "title": string,
 *   "description": string,
 *   "contentJson": any,
 *   "published": boolean
 * }
 */
export async function PATCH(request: Request) {
  const role = getCookieValue(request.headers.get("cookie"), "role");

  if (role !== "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const missionId = getMissionIdFromUrl(request);
  if (!missionId) {
    return NextResponse.json({ error: "Missing mission id" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, any> = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.published === "boolean") data.published = body.published;

  if (body.contentJson !== undefined) {
    const validation = validateMissionContent(body.contentJson);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid contentJson", details: validation.errors },
        { status: 400 }
      );
    }
    data.contentJson = validation.data as any;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.mission.update({
    where: { id: missionId },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      contentJson: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ mission: updated });
}