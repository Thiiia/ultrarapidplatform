export const webglViewportHostStyle = {
  height: "100dvh",
  minHeight: "100dvh",
  overflow: "hidden",
} as const;

export const webglFlexFrameStyle = {
  width: "100%",
  height: "100%",
  minHeight: 0,
} as const;

export const webglLaunchFrameStyle = {
  ...webglFlexFrameStyle,
  width: "min(100%, 1440px)",
} as const;
