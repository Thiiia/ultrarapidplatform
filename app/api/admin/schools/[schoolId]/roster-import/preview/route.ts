import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { previewRosterImport } from "@/lib/roster-import";
import { RosterValidationError } from "@/lib/roster-import-parser";
import { getRosterSchoolId, parseRosterRequest } from "@/lib/roster-import-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schoolId = getRosterSchoolId(request);
  const parsedRequest = await parseRosterRequest(request);
  if (!schoolId || !parsedRequest.ok) {
    return NextResponse.json(
      { error: parsedRequest.ok ? "School ID is required." : parsedRequest.error },
      { status: 400 },
    );
  }

  try {
    const summary = await previewRosterImport({
      schoolId,
      csvText: parsedRequest.csvText,
      mode: parsedRequest.mode,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof RosterValidationError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 400 });
    }
    console.error("Roster preview failed", error);
    return NextResponse.json({ error: "Roster preview failed." }, { status: 500 });
  }
}