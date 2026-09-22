import type { RosterImportMode } from "@prisma/client";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export function getRosterSchoolId(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const schoolsIndex = parts.indexOf("schools");
  return schoolsIndex >= 0 ? parts[schoolsIndex + 1] ?? null : null;
}

export async function parseRosterRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const, error: "Invalid JSON body." };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const, error: "Invalid request body." };
  }

  const values = body as Record<string, unknown>;
  const csvText = typeof values.csvText === "string" ? values.csvText : "";
  const filename = typeof values.filename === "string" ? values.filename.trim() : "";
  const mode: RosterImportMode = values.mode === "reconcile" ? "reconcile" : "additive";
  const expectedSummary =
    values.expectedSummary &&
    typeof values.expectedSummary === "object" &&
    !Array.isArray(values.expectedSummary)
      ? values.expectedSummary as Record<string, unknown>
      : null;

  if (!csvText || !filename) {
    return { ok: false as const, error: "csvText and filename are required." };
  }

  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    return { ok: false as const, error: "Roster files may not exceed 2 MB." };
  }

  return {
    ok: true as const,
    csvText,
    filename: filename.slice(0, 255),
    mode,
    expectedSummary,
  };
}