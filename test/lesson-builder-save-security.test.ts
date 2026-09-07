import assert from "node:assert/strict";
import test from "node:test";

type SaveRouteSecurity = {
  isSameOriginLessonSaveRequest?: (request: Request) => boolean;
};

async function loadSaveRoute(): Promise<SaveRouteSecurity> {
  return (await import("../app/api/lesson-builder/save/route")) as SaveRouteSecurity;
}

test("allows the public Team Editor to save from the same origin", async () => {
  const saveRoute = await loadSaveRoute();

  assert.equal(
    typeof saveRoute.isSameOriginLessonSaveRequest,
    "function",
    "save route must allow same-origin public editor requests",
  );
  assert.equal(
    saveRoute.isSameOriginLessonSaveRequest!(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://platform.example" },
      }),
    ),
    true,
  );
  assert.equal(
    saveRoute.isSameOriginLessonSaveRequest!(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://other.example" },
      }),
    ),
    false,
  );
});
