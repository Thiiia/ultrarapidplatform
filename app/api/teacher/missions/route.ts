import { NextResponse } from "next/server";
import { resolveActingTeacherId } from "@/lib/teacher-auth";
import {
  createTeacherActivityMission,
  getTeacherMissionsByActivity,
  type ActivityKey,
} from "@/lib/teacher-missions";

export const runtime = "nodejs";

const ACTIVITY_KEYS: ActivityKey[] = [
  "number-bonds",
  "equations",
  "missing-numbers",
  "early-algebra",
];

function parseActivityKey(value: unknown): ActivityKey | null {
  return typeof value === "string" && (ACTIVITY_KEYS as string[]).includes(value)
    ? (value as ActivityKey)
    : null;
}

/**
 * GET /api/teacher/missions?activityKey=...&demoTeacherId=...
 *
 * Lists the acting teacher's own missions tagged with the given activity.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const activityKey = parseActivityKey(url.searchParams.get("activityKey"));
  const demoTeacherId = url.searchParams.get("demoTeacherId");

  if (!activityKey) {
    return NextResponse.json({ error: "A valid activityKey is required." }, { status: 400 });
  }

  const teacherId = await resolveActingTeacherId(demoTeacherId);

  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missions = await getTeacherMissionsByActivity({ teacherId, activityKey });

  return NextResponse.json({ missions });
}

/**
 * POST /api/teacher/missions
 *
 * Creates a new mission authored by the acting teacher, tagged with the
 * given activity so it appears in that activity's assignable list.
 *
 * Body: { title, activityKey, description?, demoTeacherId? }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsedBody: unknown = await request.json();
    if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
      body = parsedBody as Record<string, unknown>;
    }
  } catch {
    // fall through, validated below
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description : undefined;
  const activityKey = parseActivityKey(body.activityKey);
  const demoTeacherId = typeof body.demoTeacherId === "string" ? body.demoTeacherId : null;

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  if (!activityKey) {
    return NextResponse.json({ error: "A valid activityKey is required." }, { status: 400 });
  }

  const teacherId = await resolveActingTeacherId(demoTeacherId);

  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mission = await createTeacherActivityMission({
    teacherId,
    activityKey,
    title,
    description,
  });

  return NextResponse.json({ mission }, { status: 201 });
}
