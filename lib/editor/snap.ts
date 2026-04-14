import { SnapMode, SnapSubdivision } from "./types"

export function secondsToTicks(seconds: number, bpm: number, resolution: number) {
  return Math.round((seconds * bpm * resolution) / 60)
}

export function ticksToSeconds(ticks: number, bpm: number, resolution: number) {
  return (ticks * 60) / (bpm * resolution)
}

export function getSnapGrid(resolution: number, subdivision: SnapSubdivision) {
  return Math.max(1, resolution / subdivision)
}

export function snapTick(
  tick: number,
  resolution: number,
  subdivision: SnapSubdivision,
  mode: SnapMode = "nearest",
) {
  const grid = getSnapGrid(resolution, subdivision)

  if (mode === "floor") return Math.floor(tick / grid) * grid
  if (mode === "ceil") return Math.ceil(tick / grid) * grid
  return Math.round(tick / grid) * grid
}