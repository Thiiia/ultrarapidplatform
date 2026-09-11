import assert from "node:assert/strict";
import test from "node:test";
import { PlayerWorkspacePayloadSchema, mergeWorkspacePayload } from "../lib/player-workspace-contract";

const payload = {
  version: 1,
  equations: [{ id: "mine-1", tokens: [{ id: "x", label: "x" }] }],
  hiddenSourceEquationIds: [],
  timelineEdits: [],
  tutorial: { step: "welcome" as const },
  updatedAt: 1,
};

test("workspace payload is strict and rejects credential-like fields", () => {
  assert.equal(PlayerWorkspacePayloadSchema.safeParse(payload).success, true);
  assert.equal(PlayerWorkspacePayloadSchema.safeParse({ ...payload, signedUrl: "https://secret" }).success, false);
  assert.equal(PlayerWorkspacePayloadSchema.safeParse({ ...payload, equations: [{ id: "mine-1", tokens: [{ id: "x", label: "x" }, { id: "x", label: "duplicate" }] }] }).success, false);
});

test("merge reports concurrent edits instead of silently overwriting", () => {
  const remote = { ...payload, updatedAt: 2 };
  const local = { ...payload, updatedAt: 3 };
  assert.equal(mergeWorkspacePayload(payload, remote, local).conflict, true);
});
