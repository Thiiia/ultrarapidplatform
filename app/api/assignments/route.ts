import { NextResponse } from "next/server";
import { resolveActingTeacherId } from "@/lib/teacher-auth";
import { assignMissionToClass, assignMissionToStudent } from "@/lib/school-class-admin";

export const runtime = "nodejs";

/**
 * POST /api/assignments
 *
 * Creates an Assignment on behalf of a teacher, either for one student or
 * (when studentId is omitted) for the whole class. Auth: an authenticated
 * teacher session, OR (for the public demo) a `demoTeacherId` matching the
 * fixed DEMO_TEACHER_USER_ID env var — this mirrors the rest of the /demo
 * route tree, which is intentionally scoped to that single seeded
 * teacher/class/student.
 *
 * Body: { classId, missionId, studentId?, demoTeacherId? }
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

  const classId = typeof body.classId === "string" ? body.classId : null;
  const studentId = typeof body.studentId === "string" ? body.studentId : null;
  const missionId = typeof body.missionId === "string" ? body.missionId : null;
  const demoTeacherId =
    typeof body.demoTeacherId === "string" ? body.demoTeacherId : null;

  if (!classId || !missionId) {
    return NextResponse.json(
      { error: "classId and missionId are required." },
      { status: 400 },
    );
  }

  const teacherId = await resolveActingTeacherId(demoTeacherId);

  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = studentId
    ? await assignMissionToStudent({ teacherId, classId, studentId, missionId })
    : await assignMissionToClass({ teacherId, classId, missionId });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ assignment: result.assignment }, { status: 201 });
}
