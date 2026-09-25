import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginLessonSaveRequest } from "../lib/lesson-save-origin";

test("allows the public Team Editor to save from the same origin", async () => {
  assert.equal(
    typeof isSameOriginLessonSaveRequest,
    "function",
    "save route must allow same-origin public editor requests",
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
