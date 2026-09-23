export const LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION = 1 as const;
export const PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION = 2 as const;

export const LEGACY_AUTHORED_HIT_PADS = [
  "topLeft",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottomRight",
] as const;

export const PLAYER_HEX_AUTHORED_HIT_PADS = [
  { pad: "top", label: "Top", xUnit: 0, yUnit: 1 },
  { pad: "upperRight", label: "Upper right", xUnit: 104.5 / 134.5, yUnit: 82.5 / 134.5 },
  { pad: "lowerRight", label: "Lower right", xUnit: 104.5 / 134.5, yUnit: -83.5 / 134.5 },
  { pad: "bottom", label: "Bottom", xUnit: 0, yUnit: -1 },
  { pad: "lowerLeft", label: "Lower left", xUnit: -104.5 / 134.5, yUnit: -83.5 / 134.5 },
  { pad: "upperLeft", label: "Upper left", xUnit: -104.5 / 134.5, yUnit: 82.5 / 134.5 },
] as const;

/** Pixel radius used by the editor's compact six-pad selector. */
export const PLAYER_HEX_AUTHORED_HIT_PAD_PREVIEW_RADIUS_PX = 48;
/** Pixel radius sized to fit the six-pad picker used above a token. */
export const PLAYER_HEX_AUTHORED_HIT_PAD_CHOOSER_RADIUS_PX = 38;

export type AuthoredHitPadLayoutVersion =
  | typeof LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION
  | typeof PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION;

export type AuthoredHitPad =
  | (typeof LEGACY_AUTHORED_HIT_PADS)[number]
  | (typeof PLAYER_HEX_AUTHORED_HIT_PADS)[number]["pad"];

export type AuthoredHitPadPixelOffset = { dx: number; dy: number };

/**
 * Returns screen-space offsets for the measured Unity hex layout. The editor
 * canvas uses positive Y downward, while the authored/player layout uses up.
 */
export function resolvePlayerHexHitPadPixelOffset(
  slot: number,
  touchOffsetPx: number,
): AuthoredHitPadPixelOffset | null {
  const layout = PLAYER_HEX_AUTHORED_HIT_PADS[slot];
  if (!layout || !Number.isFinite(touchOffsetPx) || touchOffsetPx < 0) {
    return null;
  }
  return {
    dx: layout.xUnit * touchOffsetPx,
    dy: -layout.yUnit * touchOffsetPx,
  };
}

/**
 * Version 1 preserves the existing authored ordinal mapping. Version 2 names
 * the six physical Unity pads directly in their Figma order.
 */
export function resolveAuthoredHitPadSlot(
  pad: string,
  layoutVersion: number | undefined,
): number {
  const version = layoutVersion ?? LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION;
  if (version === LEGACY_AUTHORED_HIT_PAD_LAYOUT_VERSION) {
    return LEGACY_AUTHORED_HIT_PADS.indexOf(pad as (typeof LEGACY_AUTHORED_HIT_PADS)[number]);
  }
  if (version === PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION) {
    return PLAYER_HEX_AUTHORED_HIT_PADS.findIndex((entry) => entry.pad === pad);
  }
  return -1;
}

export function resolveAuthoredHitPadTarget(target: {
  pads?: readonly string[];
  positions?: readonly string[];
  padLayoutVersion?: number;
}): number[] {
  return [...new Set([...(target.pads ?? []), ...(target.positions ?? [])]
    .map((pad) => resolveAuthoredHitPadSlot(pad, target.padLayoutVersion))
    .filter((slot) => slot >= 0))];
}

export function authoredHitPadLabelForSlot(slot: number): string | null {
  return PLAYER_HEX_AUTHORED_HIT_PADS[slot]?.label ?? null;
}

export function authoredHitPadForSlot(slot: number): AuthoredHitPad | null {
  return PLAYER_HEX_AUTHORED_HIT_PADS[slot]?.pad ?? null;
}
