import assert from "node:assert/strict";
import test from "node:test";

type TeamPreviewAccessModule = {
  canAccessTeamPreview?: (user: {
    role: "student" | "teacher" | "admin";
    status: "active" | "inactive" | "invited" | "suspended";
  } | null) => boolean;
};

async function loadAccessModule(): Promise<TeamPreviewAccessModule | null> {
  try {
    const modulePath = "../lib/" + "team-preview-access";
    return (await import(modulePath)) as TeamPreviewAccessModule;
  } catch {
    return null;
  }
}

test("allows only active teachers and administrators to preview the game", async () => {
  const access = await loadAccessModule();

  assert.equal(
    typeof access?.canAccessTeamPreview,
    "function",
    "team-preview-access must expose canAccessTeamPreview",
  );

  assert.equal(
    access!.canAccessTeamPreview!({ role: "teacher", status: "active" }),
    true,
  );
  assert.equal(
    access!.canAccessTeamPreview!({ role: "admin", status: "active" }),
    true,
  );
  assert.equal(
    access!.canAccessTeamPreview!({ role: "student", status: "active" }),
    false,
  );
  assert.equal(
    access!.canAccessTeamPreview!({ role: "teacher", status: "suspended" }),
    false,
  );
  assert.equal(access!.canAccessTeamPreview!(null), false);
});
