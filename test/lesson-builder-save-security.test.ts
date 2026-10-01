import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canPreviewOwnLessonDraft,
  canPublishLessonForAuthor,
  canReadEditorAuthor,
  canSaveLessonForAuthor,
} from "../lib/lesson-save-authorization";
import { readDemoLessonDraft, saveDemoLessonDraft } from "../lib/demo-lesson-drafts";
import { hasPermission } from "../lib/permissions";
import { isSameOriginLessonSaveRequest } from "../lib/lesson-save-origin";

const saveRouteSource = readFileSync(
  join(process.cwd(), "app/api/lesson-builder/save/route.ts"),
  "utf8",
);
const lessonBuilderSource = readFileSync(
  join(process.cwd(), "app/student/lesson-builder/LessonBuilderClient.tsx"),
  "utf8",
);
const songChoiceRouteSource = readFileSync(
  join(process.cwd(), "app/api/song-choice/route.ts"),
  "utf8",
);
const songLaunchRouteSource = readFileSync(
  join(process.cwd(), "app/api/song-package/launch/route.ts"),
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

test("ROLE_PERMISSIONS agree with personal editing and official publishing policy", () => {
  assert.equal(hasPermission("student", "edit_content"), true);
  assert.equal(hasPermission("student", "publish_content"), false);
  assert.equal(hasPermission("teacher", "edit_content"), true);
  assert.equal(hasPermission("teacher", "publish_content"), true);
  assert.equal(hasPermission("admin", "edit_content"), true);
  assert.equal(hasPermission("admin", "publish_content"), true);
});

test("anonymous and demo users cannot create server publications", () => {
  assert.equal(canSaveLessonForAuthor(null, "teacher-1"), false, "anonymous save is denied");
  assert.equal(canPublishLessonForAuthor(null, "teacher-1"), false);
  assert.match(lessonBuilderSource, /if \(isDemoMode\)/);
  assert.match(lessonBuilderSource, /saveDemoLessonDraft\(window\.localStorage/);
  assert.match(songChoiceRouteSource, /canReadEditorAuthor\(user, targetAuthor\?\.id, demoAuthor\?\.id\)/);
});

test("demo lessons save and reopen from browser storage without creating READY content", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const draft = { chart: "[Song]\n{}", sidecar: JSON.stringify({ version: 1, events: [] }) };

  saveDemoLessonDraft(storage, "song-1", "number-bonds", draft);
  assert.deepEqual(readDemoLessonDraft(storage, "song-1", "number-bonds"), draft);
  assert.equal(canPublishLessonForAuthor(null, "demo-author"), false);
});

test("students may save and preview their own personal draft but cannot publish it", () => {
  const student = { id: "student-1", role: "student" };

  assert.equal(canSaveLessonForAuthor(student, "student-1"), true);
  assert.equal(canSaveLessonForAuthor(student, "student-2"), false, "foreign draft is denied");
  assert.equal(canPublishLessonForAuthor(student, "student-1"), false, "student cannot create READY content");
  assert.equal(canPreviewOwnLessonDraft(student, "student-1", "revision-1"), true);
  assert.equal(canPreviewOwnLessonDraft(student, "student-2", "revision-1"), false);
  assert.equal(canPreviewOwnLessonDraft(student, "student-1", null), false);
  assert.match(songLaunchRouteSource, /payload\.allowDraftPreview === true/);
  assert.match(songLaunchRouteSource, /canPreviewOwnLessonDraft\(player, author\.id, requestedRevision\)/);
  assert.match(songLaunchRouteSource, /status: allowDraftPreview \? \{ in: \["ready", "draft"\] \} : "ready"/);
});

test("teachers may draft and publish their own content, while cross-author review is deferred", () => {
  const teacher = { id: "teacher-1", role: "teacher" };
  const student = { id: "student-1", role: "student" };

  assert.equal(canSaveLessonForAuthor(teacher, "teacher-1"), true);
  assert.equal(canPublishLessonForAuthor(teacher, "teacher-1"), true);
  assert.equal(canSaveLessonForAuthor(teacher, "student-1"), false);
  assert.equal(canPublishLessonForAuthor(teacher, "student-1"), false, "foreign and out-of-scope publication is denied");
  // There is no submission/review record or publishedBy field in the current schema,
  // so even an in-scope approval cannot be attributed or authorized yet.
  assert.equal(canPublishLessonForAuthor(teacher, "student-1"), false, "in-scope approval awaits the review workflow slice");
});

test("admin may publish for another permitted author without changing authorship", () => {
  assert.equal(canSaveLessonForAuthor({ id: "admin-1", role: "admin" }, "student-1"), true);
  assert.equal(canPublishLessonForAuthor({ id: "admin-1", role: "admin" }, "student-1"), true);
});

test("editor file browsing keeps private drafts limited to their author and admin", () => {
  assert.equal(canReadEditorAuthor(null, "demo-author", "demo-author"), true);
  assert.equal(canReadEditorAuthor(null, "student-1", "demo-author"), false);
  assert.equal(canReadEditorAuthor({ id: "student-1", role: "student" }, "student-1", "demo-author"), true);
  assert.equal(canReadEditorAuthor({ id: "student-1", role: "student" }, "student-2", "demo-author"), false);
  assert.equal(canReadEditorAuthor({ id: "admin-1", role: "admin" }, "student-2", "demo-author"), true);
});

test("save route authenticates before reading the write payload and checks author ownership", () => {
  const authCheck = saveRouteSource.indexOf("if (!sessionUser)");
  const payloadRead = saveRouteSource.indexOf("await request.json()", authCheck);

  assert.ok(authCheck >= 0, "route has an unauthenticated-session rejection");
  assert.ok(payloadRead > authCheck, "route authenticates before reading write input");
  assert.match(saveRouteSource, /payload\.intent !== "draft" && payload\.intent !== "publish"/);
  assert.match(saveRouteSource, /canSaveLessonForAuthor\(sessionUser,\s*targetAuthor\.id\)/);
  assert.match(saveRouteSource, /canPublishLessonForAuthor\(sessionUser,\s*targetAuthor\.id\)/);
  assert.match(saveRouteSource, /status: intent === "publish" \? "ready" : "draft"/);
  assert.match(saveRouteSource, /publishedAt: intent === "publish" \? new Date\(\) : null/);
});
