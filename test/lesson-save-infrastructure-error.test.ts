import assert from "node:assert/strict";
import test from "node:test";
import { mapLessonSaveInfrastructureError } from "../lib/lesson-save-infrastructure-error";

test("reports an unapplied lesson provenance migration as an actionable 503", () => {
  const failure = mapLessonSaveInfrastructureError({
    code: "P2022",
    meta: { column: "game_content_revisions.rhythm_source_revision" },
  });

  assert.equal(failure?.status, 503);
  assert.equal(failure?.body.code, "LESSON_DATABASE_MIGRATION_REQUIRED");
  assert.match(failure?.body.error ?? "", /administrator/i);
  assert.doesNotMatch(failure?.body.error ?? "", /Prisma|P2022|rhythm_source_revision/i);
});

test("does not misclassify unrelated Prisma errors as a migration blocker", () => {
  assert.equal(
    mapLessonSaveInfrastructureError({
      code: "P2022",
      meta: { column: "game_content_revisions.status" },
    }),
    null,
  );
  assert.equal(mapLessonSaveInfrastructureError({ code: "P2002" }), null);
});
