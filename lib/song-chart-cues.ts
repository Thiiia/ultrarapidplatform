import { AUTHORED_MIN_FIRST_CUE_SECONDS } from "./authored-lesson";
import { createLessonClock } from "./editor/lesson-timing";
import type { SupportedRhythmDifficulty } from "./chart-semantics";

export type SongChartCue = {
  tick: number;
  lane: number;
  seconds: number;
};

/** Return playable notes on the editor's audio-second clock for one chart difficulty. */
export function getSongChartCues(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
): SongChartCue[] {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const body = chart.match(new RegExp(`\\[${difficulty}\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1];
  if (!body) return [];

  const clock = createLessonClock(chart);
  const byTickAndLane = new Map<string, SongChartCue>();
  for (const match of body.matchAll(/^\s*(\d+)\s*=\s*N\s+([0-4])\s+\d+\s*$/gm)) {
    const tick = Number(match[1]);
    const lane = Number(match[2]);
    const seconds = clock.toSeconds(tick);
    if (!Number.isFinite(seconds) || seconds < AUTHORED_MIN_FIRST_CUE_SECONDS || seconds > durationSeconds) continue;
    const key = `${tick}:${lane}`;
    if (!byTickAndLane.has(key)) byTickAndLane.set(key, { tick, lane, seconds });
  }

  return [...byTickAndLane.values()].sort((left, right) => left.seconds - right.seconds);
}
