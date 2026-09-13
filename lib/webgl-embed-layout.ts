export const webglViewportHostStyle = {
  height: "100dvh",
  minHeight: "100dvh",
  overflow: "hidden",
} as const;

export const webglFlexFrameStyle = {
  width: "100%",
  // A 100%-height iframe is sized before sibling status text in a flex column
  // is accounted for, then gets compressed unpredictably. Fill the remaining
  // viewport instead, matching the standalone WebGL shell's sizing contract.
  flex: "1 1 0",
  minHeight: 0,
} as const;

export const webglLaunchFrameStyle = {
  ...webglFlexFrameStyle,
  width: "min(100%, 1440px)",
} as const;
