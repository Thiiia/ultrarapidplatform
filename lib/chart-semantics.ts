export const SUPPORTED_RHYTHM_DIFFICULTIES = [
  "EasySingle",
  "MediumSingle",
  "HardSingle",
  "ExpertSingle",
] as const;

export type SupportedRhythmDifficulty = (typeof SUPPORTED_RHYTHM_DIFFICULTIES)[number];

export type ChartSemantics = {
  resolution: number;
  offsetSeconds: number;
  tempos: Array<{ tick: number; bpm: number }>;
  difficulties: Record<SupportedRhythmDifficulty, { noteCount: number; lastTick: number | null }>;
};

function sectionBody(chart: string, name: string) {
  return chart.match(new RegExp(`\\[${name}\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? null;
}

export function parseSupportedChartSemantics(
  chart: string,
  options: { selectedDifficulty?: SupportedRhythmDifficulty; requireRhythmNotes?: boolean } = {},
): ChartSemantics {
  if (typeof chart !== "string" || !chart.trim()) throw new Error("Invalid chart: chart content is empty");
  const song = sectionBody(chart, "Song");
  const syncTrack = sectionBody(chart, "SyncTrack");
  if (!song || !syncTrack) throw new Error("Invalid chart: Song and SyncTrack sections are required");

  const resolutionMatch = song.match(/(?:^|\n)\s*Resolution\s*=\s*"?(\d+)"?/i);
  const resolution = Number(resolutionMatch?.[1] ?? NaN);
  if (!Number.isSafeInteger(resolution) || resolution <= 0) throw new Error("Invalid chart: Resolution must be a positive integer");

  const offsetMatch = song.match(/(?:^|\n)\s*Offset\s*=\s*"?(-?(?:\d+(?:\.\d*)?|\.\d+))"?/i);
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) : 0;
  if (!Number.isFinite(offsetSeconds)) throw new Error("Invalid chart: Offset must be finite");

  const tempos: ChartSemantics["tempos"] = [];
  for (const match of syncTrack.matchAll(/^\s*(-?\d+)\s*=\s*B\s+(-?(\d+))\s*$/gim)) {
    const tick = Number(match[1]);
    const bpm = Number(match[2]) / 1000;
    if (!Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(bpm) || bpm <= 0) {
      throw new Error(`Invalid chart: tempo at tick ${match[1]} must have a positive BPM`);
    }
    if (tempos.length && tick <= tempos[tempos.length - 1].tick) {
      throw new Error("Invalid chart: tempo ticks must be strictly increasing");
    }
    tempos.push({ tick, bpm });
  }
  if (tempos.length === 0 || tempos[0].tick !== 0) throw new Error("Invalid chart: SyncTrack needs a positive tempo at tick zero");

  const difficulties = Object.fromEntries(SUPPORTED_RHYTHM_DIFFICULTIES.map((difficulty) => {
    const body = sectionBody(chart, difficulty);
    const notes: number[] = [];
    let previous = -1;
    if (body) {
      for (const match of body.matchAll(/^\s*(\d+)\s*=\s*N\s+(\d+)\s+(\d+)\s*$/gm)) {
        const tick = Number(match[1]);
        const lane = Number(match[2]);
        const length = Number(match[3]);
        if (tick < previous) throw new Error(`Invalid chart: ${difficulty} note ticks must be ordered`);
        if (lane < 0 || lane > 4 || length < 0) throw new Error(`Invalid chart: ${difficulty} contains an unsupported note`);
        previous = tick;
        notes.push(tick);
      }
    }
    return [difficulty, { noteCount: notes.length, lastTick: notes.length ? notes[notes.length - 1] : null }];
  })) as ChartSemantics["difficulties"];

  if (options.selectedDifficulty && !sectionBody(chart, options.selectedDifficulty)) {
    throw new Error(`Invalid chart: selected difficulty ${options.selectedDifficulty} is missing`);
  }
  if (options.requireRhythmNotes && options.selectedDifficulty && difficulties[options.selectedDifficulty].noteCount === 0) {
    throw new Error(`Invalid chart: selected difficulty ${options.selectedDifficulty} has no playable notes`);
  }

  return { resolution, offsetSeconds, tempos, difficulties };
}
