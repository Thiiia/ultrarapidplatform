import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { canSaveLessonForAuthor } from "../lib/lesson-save-authorization";
import { isSameOriginLessonSaveRequest } from "../lib/lesson-save-origin";

const saveRouteSource = readFileSync(
  join(process.cwd(), "app/api/lesson-builder/save/route.ts"),
  "utf8",
);

test("same-origin validation does not replace lesson-save authentication", () => {
  assert.equal(
    typeof isSameOriginLessonSaveRequest,
    "function",
    "same-origin save guard is available to the save route",
  );
  assert.equal(
    isSameOriginLessonSaveRequest(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://platform.example" },
      }),
    ),
    true,
  );
  assert.equal(
    isSameOriginLessonSaveRequest(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://other.example" },
      }),
    ),
    false,
  );

  assert.equal(
    isSameOriginLessonSaveRequest(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
      }),
    ),
    true,
  );
});

test("lesson saves require an authenticated author identity", () => {
  assert.equal(canSaveLessonForAuthor(null, "teacher-1"), false);
  assert.equal(canSaveLessonForAuthor({ id: null, role: "teacher" }, "teacher-1"), false);
  assert.equal(canSaveLessonForAuthor({ id: "teacher-1", role: "teacher" }, "teacher-1"), true);
  assert.equal(canSaveLessonForAuthor({ id: "student-1", role: "student" }, "teacher-1"), false);
  assert.equal(canSaveLessonForAuthor({ id: "admin-1", role: "admin" }, "teacher-1"), true);
});

test("save route authenticates before reading the write payload and checks author ownership", () => {
  const authCheck = saveRouteSource.indexOf("if (!sessionUser)");
  const payloadRead = saveRouteSource.indexOf("await request.json()", authCheck);

  assert.ok(authCheck >= 0, "route has an unauthenticated-session rejection");
  assert.ok(payloadRead > authCheck, "route authenticates before reading write input");
  assert.match(saveRouteSource, /canSaveLessonForAuthor\(sessionUser,\s*targetAuthor\.id\)/);
});
