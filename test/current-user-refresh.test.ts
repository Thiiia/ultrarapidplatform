import assert from "node:assert/strict";
import test from "node:test";

import { shouldRefreshCurrentUser } from "../lib/current-user-refresh";

test("repeat navigation within a minute reuses the current user row", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");
  const user = { email: "student@example.com", normalizedEmail: "student@example.com",
    lastLoginAt: new Date(now.getTime() - 20_000) };
  assert.equal(shouldRefreshCurrentUser(user, "student@example.com", now), false);
  assert.equal(shouldRefreshCurrentUser({ ...user, lastLoginAt: new Date(now.getTime() - 60_000) }, "student@example.com", now), true);
  assert.equal(shouldRefreshCurrentUser({ ...user, lastLoginAt: null }, "student@example.com", now), true);
  assert.equal(shouldRefreshCurrentUser(user, "new@example.com", now), true);
});
