/** Return the cue index closest to a requested song time, preserving earlier ties. */
export function findNearestChartCueIndex(
  cueSeconds: readonly number[],
  targetSeconds: number,
): number {
  if (!Number.isFinite(targetSeconds) || cueSeconds.length === 0) return -1;

  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < cueSeconds.length; index += 1) {
    const cueSecondsAtIndex = cueSeconds[index];
    if (!Number.isFinite(cueSecondsAtIndex) || cueSecondsAtIndex < 0) continue;

    const distance = Math.abs(cueSecondsAtIndex - targetSeconds);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  return nearestIndex;
}
