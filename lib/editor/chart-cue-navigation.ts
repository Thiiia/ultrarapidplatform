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

/** Offer only cues that the runtime's minimum positive move window can retain exactly. */
export function getRangeChartCueTargets(cues: readonly number[], start: number | undefined, end: number | undefined) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end! <= start!) {
    return { startSeconds: null, endSeconds: null };
  }
  const starts = cues.filter((cue) => Number.isFinite(cue) && cue >= 0 && cue <= end! - 0.01);
  const ends = cues.filter((cue) => Number.isFinite(cue) && cue >= start! + 0.01);
  const startIndex = findNearestChartCueIndex(starts, start!);
  const endIndex = findNearestChartCueIndex(ends, end!);
  return {
    startSeconds: startIndex < 0 ? null : starts[startIndex],
    endSeconds: endIndex < 0 ? null : ends[endIndex],
  };
}
