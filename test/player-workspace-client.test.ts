import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyWorkspaceResponse,
  prepareWorkspaceMutation,
} from "../lib/player-workspace-client";

const key = {
  songAssetId: "song-1",
  activityKey: "equations" as const,
  authorId: "author-1",
  revision: "00000000-0000-4000-8000-000000000001",
};

const payload = {
  version: 1,
  equations: [],
  hiddenSourceEquationIds: [],
  timelineEdits: [],
  tutorial: { step: "welcome" as const },
  updatedAt: 1,
};

test("invalid local workspace never issues PUT and remains recoverable", () => {
  const result = prepareWorkspaceMutation({
    key,
    expectedVersion: 0,
    payload: {
      ...payload,
      timelineEdits: [{ id: "encounter-1", signedUrl: "https://example.test/private" }],
    },
  });

  assert.equal(result.kind, "invalid-local");
  assert.match(result.message, /credential-like data/);
});

test("422 is permanent and 429 is retryable", async () => {
  const permanent = await classifyWorkspaceResponse(new Response(JSON.stringify({
    error: { code: "invalid_workspace_payload", message: "Payload rejected", paths: ["payload"] },
  }), { status: 422, headers: { "content-type": "application/json" } }));
  assert.equal(permanent.kind, "permanent");
  assert.equal(permanent.code, "invalid_workspace_payload");
  assert.deepEqual(permanent.paths, ["payload"]);

  const retryable = await classifyWorkspaceResponse(new Response(JSON.stringify({
    error: { code: "rate_limited", message: "Try again later" },
  }), { status: 429, headers: { "Retry-After": "7" } }));
  assert.equal(retryable.kind, "retryable");
  assert.equal(retryable.code, "rate_limited");
  assert.equal(retryable.retryAfterMs, 7_000);
});

test("409 remains a mergeable workspace conflict", async () => {
  const result = await classifyWorkspaceResponse(new Response(JSON.stringify({
    error: { code: "workspace_version_conflict", message: "Workspace changed elsewhere" },
    current: { version: 2, payload },
  }), { status: 409 }));

  assert.equal(result.kind, "conflict");
  assert.equal(result.current?.version, 2);
});

test("unexpected 5xx responses are bounded retry candidates", async () => {
  const result = await classifyWorkspaceResponse(new Response(null, { status: 503 }));

  assert.equal(result.kind, "retryable");
  assert.equal(result.code, "workspace_unavailable");
  assert.equal(result.retryAfterMs, undefined);
});
