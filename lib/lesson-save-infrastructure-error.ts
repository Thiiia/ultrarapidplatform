export const LESSON_DATABASE_MIGRATION_REQUIRED = "LESSON_DATABASE_MIGRATION_REQUIRED" as const;

const LESSON_MIGRATION_ERROR =
  "Lesson saving is temporarily unavailable. Please ask an administrator to complete the required platform database migration.";

type PrismaColumnError = {
  code?: unknown;
  message?: unknown;
  meta?: { column?: unknown } | null;
};

export function mapLessonSaveInfrastructureError(error: unknown) {
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as PrismaColumnError;
  const column = String(candidate.meta?.column ?? "").toLowerCase();
  const message = String(candidate.message ?? "").toLowerCase();
  const missingRhythmSourceColumn =
    column.includes("rhythm_source_revision") || message.includes("rhythm_source_revision");

  if (candidate.code !== "P2022" || !missingRhythmSourceColumn) return null;

  return {
    status: 503 as const,
    body: {
      code: LESSON_DATABASE_MIGRATION_REQUIRED,
      error: LESSON_MIGRATION_ERROR,
    },
  };
}
