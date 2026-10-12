import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { POST } from "../app/api/song-package/launch/route";

test("readiness-only launch responses omit signed assets and skip attempt persistence", () => {
  const routeSource = readFileSync(join(process.cwd(), "app/api/song-package/launch/route.ts"), "utf8");
  const readinessStart = routeSource.indexOf("if (payload.readinessOnly === true)");
  const attemptStart = routeSource.indexOf("if (shouldCreatePlayerLaunchAttempt(");

  assert.ok(readinessStart >= 0);
  assert.ok(attemptStart > readinessStart);
  const readinessResponse = routeSource.slice(readinessStart, attemptStart);
  assert.match(readinessResponse, /readiness: songPackage\.readiness/);
  assert.doesNotMatch(readinessResponse, /signedUrl/);
});

test("malformed launch JSON receives a controlled JSON 400 response", async () => {
  const response = await POST(new Request("http://localhost/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad",
  }));

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), {
    code: "INVALID_JSON",
    error: "The launch request must contain a valid JSON object.",
  });
});

test("a valid JSON request without a song is an input error", async () => {
  const response = await POST(new Request("http://localhost/api/song-package/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activityKey: "number-bonds" }),
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_REQUEST");
});
