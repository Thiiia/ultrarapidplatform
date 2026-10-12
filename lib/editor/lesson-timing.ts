/** Editor positions are audio seconds; companion positions are chart ticks. */
export type ChartSnapSubdivision = "off" | "quarter" | "eighth" | "sixteenth";

export function createLessonClock(chart: string) {
  const song = chart.match(/\[Song\]\s*\{([\s\S]*?)\}/i)?.[1] ?? "";
  const resolutionMatch = song.match(/^\s*Resolution\s*=\s*(?:"(\d+)"|(\d+))\s*$/im);
  const parsedResolution = Number(resolutionMatch?.[1] ?? resolutionMatch?.[2] ?? NaN);
  const usesDefaultResolution = !Number.isSafeInteger(parsedResolution) || parsedResolution <= 0;
  const resolution = usesDefaultResolution ? 192 : parsedResolution;
  const offsetMatch = song.match(/^\s*Offset\s*=\s*(?:"(-?(?:\d+(?:\.\d*)?|\.\d+))"|(-?(?:\d+(?:\.\d*)?|\.\d+)))\s*$/im);
  const parsedOffset = Number(offsetMatch?.[1] ?? offsetMatch?.[2] ?? 0);
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const sync = chart.match(/\[SyncTrack\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const tempos: Array<{ tick: number; bpm: number; explicit: boolean }> = Array.from(
    sync.matchAll(/^\s*(\d+)\s*=\s*B\s+(\d+)\s*$/gm),
    (m) => ({ tick: Number(m[1]), bpm: Number(m[2]) / 1000, explicit: true }),
  )
    .filter((tempo) => Number.isSafeInteger(tempo.tick) && tempo.tick >= 0 && Number.isFinite(tempo.bpm) && tempo.bpm > 0)
    .sort((a,b) => a.tick-b.tick);
  if (!tempos.length || tempos[0].tick !== 0) tempos.unshift({tick: 0, bpm: 120, explicit: false});
  let seconds = 0;
  const segments = tempos.map((tempo, i) => {
    if (i) seconds += (tempo.tick-tempos[i-1].tick) * 60 / (tempos[i-1].bpm * resolution);
    return {...tempo, seconds};
  });
  return {
    ticksPerBeat: resolution,
    usesDefaultResolution,
    offsetSeconds: offset,
    tempoAt(tick: number) {
      return (segments.findLast(s => s.tick <= tick) ?? segments[0]).bpm;
    },
    isTempoExplicitAt(tick: number) {
      return (segments.findLast(s => s.tick <= tick) ?? segments[0]).explicit;
    },
    toTick(value: number) {
      if (!Number.isFinite(value)) return 0;
      const time = value + offset;
      const segment = segments.findLast(s => s.seconds <= time) ?? segments[0];
      const tick = segment.tick + (time-segment.seconds) * segment.bpm * resolution / 60;
      if (!Number.isFinite(tick)) return 0;
      return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(tick)));
    },
    toSeconds(tick: number) {
      if (!Number.isFinite(tick)) return 0;
      const segment = segments.findLast(s => s.tick <= tick) ?? segments[0];
      const seconds = segment.seconds + (tick-segment.tick) * 60 / (segment.bpm * resolution) - offset;
      return Number.isFinite(seconds) ? seconds : 0;
    },
  };
}

/** Snap an audio-derived chart tick to a musical subdivision without changing its clock. */
export function snapChartTickToGrid(
  tick: number,
  ticksPerBeat: number,
  subdivision: ChartSnapSubdivision,
) {
  if (!Number.isFinite(tick)) return 0;

  const safeTick = Math.max(0, Math.round(tick));
  if (subdivision === "off" || !Number.isFinite(ticksPerBeat) || ticksPerBeat <= 0) {
    return safeTick;
  }

  const divisionsPerQuarter = {
    quarter: 1,
    eighth: 2,
    sixteenth: 4,
  }[subdivision];
  const gridTicks = Math.max(1, Math.round(ticksPerBeat / divisionsPerQuarter));
  return Math.max(0, Math.round(safeTick / gridTicks) * gridTicks);
}

export function mapLessonTimes<T extends {tick: number; endTick?: number}>(rows: T[], convert: (value: number) => number): T[] {
  return rows.map(row => ({...row, tick: convert(row.tick), ...(typeof row.endTick === 'number' ? {endTick: convert(row.endTick)} : {})}));
}
