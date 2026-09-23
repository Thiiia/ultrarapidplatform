import assert from "node:assert/strict";
import test from "node:test";

import { emptySidecar, useEditorStore, type SidecarPayload } from "../lib/editor/editor-store";

test("editor sidecar storage preserves the versioned player pad through load and save", () => {
  const sidecar = {
    version: 1,
    events: [{
      tick: 192,
      type: "ALG_MECHANIC",
      mechanic: "hit",
      hitBubbles: [
        {
          tokenIndex: 0,
          targetId: "equation-token-0",
          positions: ["top"],
          pads: ["top"],
          padLayoutVersion: 2,
        },
        { tokenIndex: 2, pads: ["left"] },
      ],
    }],
  } as unknown as SidecarPayload;

  useEditorStore.getState().setSidecar(sidecar);
  try {
    const event = useEditorStore.getState().sidecar.events[0];
    assert.equal(event?.type, "ALG_MECHANIC");
    if (event?.type !== "ALG_MECHANIC") return;
    assert.deepEqual(event.hitBubbles, [
      {
        tokenIndex: 0,
        targetId: "equation-token-0",
        positions: ["top"],
        pads: ["top"],
        padLayoutVersion: 2,
      },
      { tokenIndex: 2, positions: [], pads: ["left"] },
    ]);
  } finally {
    useEditorStore.getState().setSidecar(emptySidecar);
  }
});
