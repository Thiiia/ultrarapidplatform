import assert from "node:assert/strict";
import test from "node:test";
import { platformSecurityHeaders } from "../lib/security-headers";

test("the platform shell applies browser security headers without blocking its Unity player", () => {
  const headers = new Map<string, string>(
    platformSecurityHeaders.map(({ key, value }) => [key, value]),
  );

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  assert.equal(headers.has("Content-Security-Policy"), false);
});
