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

test("workspace timeline edits permit gameplay token indexes but reject credential fields", () => {
  const timelineEdits = [{
    id: "event-1",
    mechanicInstances: {
      hit: [{
        id: "event-1:hit:0",
        hitBubbles: [{ tokenIndex: 0, positions: ["topLeft"], pads: ["topLeft"] }],
      }],
    },
  }];
  assert.equal(PlayerWorkspacePayloadSchema.safeParse({ ...payload, timelineEdits }).success, true);
  assert.equal(PlayerWorkspacePayloadSchema.safeParse({
    ...payload,
    timelineEdits: [{ ...timelineEdits[0], accessToken: "not-a-workspace-field" }],
  }).success, false);
});

test("workspace keeps the authored player hit-pad layout version", () => {
  const result = PlayerWorkspacePayloadSchema.safeParse({
    ...payload,
    timelineEdits: [{
      id: "event-pad-layout",
      mechanicInstances: {
        hit: [{
          id: "hit-pad-layout",
          hitBubbles: [{
            tokenIndex: 0,
            positions: ["top"],
            pads: ["top"],
            padLayoutVersion: 2,
          }],
        }],
      },
    }],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  const firstEdit = result.data.timelineEdits[0] as {
    mechanicInstances?: {
      hit?: Array<{ hitBubbles?: Array<{ padLayoutVersion?: number }> }>;
    };
  };
  assert.equal(firstEdit.mechanicInstances?.hit?.[0]?.hitBubbles?.[0]?.padLayoutVersion, 2);
});

test("merge reports concurrent edits instead of silently overwriting", () => {
  const remote = { ...payload, updatedAt: 2 };
  const local = { ...payload, updatedAt: 3 };
  assert.equal(mergeWorkspacePayload(payload, remote, local).conflict, true);
});
