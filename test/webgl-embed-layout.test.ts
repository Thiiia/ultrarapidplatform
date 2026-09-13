import assert from "node:assert/strict";
import test from "node:test";
import {
  webglFlexFrameStyle,
  webglLaunchFrameStyle,
  webglViewportHostStyle,
} from "../lib/webgl-embed-layout";

test("WebGL hosts use a fixed dynamic viewport without a document scroll fallback", () => {
  assert.deepEqual(webglViewportHostStyle, {
    height: "100dvh",
    minHeight: "100dvh",
    overflow: "hidden",
  });
  assert.deepEqual(webglFlexFrameStyle, { width: "100%", flex: "1 1 0", minHeight: 0 });
  assert.deepEqual(webglLaunchFrameStyle, {
    width: "min(100%, 1440px)",
    flex: "1 1 0",
    minHeight: 0,
  });
});
