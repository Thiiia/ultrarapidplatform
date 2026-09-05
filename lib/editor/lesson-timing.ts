/** Editor positions are audio seconds; companion positions are chart ticks. */
export function createLessonClock(chart: string) {
  const resolution = Number(chart.match(/\bResolution\s*=\s*"?(\d+)/)?.[1] ?? 192);
  const offset = Number(chart.match(/\bOffset\s*=\s*"?(-?[\d.]+)/)?.[1] ?? 0);
  const sync = chart.match(/\[SyncTrack\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const tempos = Array.from(sync.matchAll(/^\s*(\d+)\s*=\s*B\s+(\d+)/gm), m => ({tick: Number(m[1]), bpm: Number(m[2]) / 1000})).sort((a,b) => a.tick-b.tick);
  if (!tempos.length || tempos[0].tick !== 0) tempos.unshift({tick: 0, bpm: 120});
  let seconds = 0;
  const segments = tempos.map((tempo, i) => {
    if (i) seconds += (tempo.tick-tempos[i-1].tick) * 60 / (tempos[i-1].bpm * resolution);
    return {...tempo, seconds};
  });
  return {
    toTick(value: number) {
      const time = value + offset;
      const segment = segments.findLast(s => s.seconds <= time) ?? segments[0];
      return Math.max(0, Math.round(segment.tick + (time-segment.seconds) * segment.bpm * resolution / 60));
    },
    toSeconds(tick: number) {
      const segment = segments.findLast(s => s.tick <= tick) ?? segments[0];
      return segment.seconds + (tick-segment.tick) * 60 / (segment.bpm * resolution) - offset;
    },
  };
}

export function mapLessonTimes<T extends {tick: number; endTick?: number}>(rows: T[], convert: (value: number) => number): T[] {
  return rows.map(row => ({...row, tick: convert(row.tick), ...(typeof row.endTick === 'number' ? {endTick: convert(row.endTick)} : {})}));
}
