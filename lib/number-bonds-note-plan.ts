import { createLessonClock } from "./editor/lesson-timing";
import { AUTHORED_MIN_FIRST_CUE_SECONDS } from "./authored-lesson";
import {
  NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS,
  NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS,
} from "./number-bonds-timing";
import type { SupportedRhythmDifficulty } from "./chart-semantics";

export type NumberBondSongNote = {
  tick: number;
  lane: number;
  seconds: number;
};

/** Collect playable chart notes on the same time axis as the editor timeline. */
export function getNumberBondSongNotes(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
): NumberBondSongNote[] {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const body = chart.match(new RegExp(`\\[${difficulty}\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1];
  if (!body) return [];

  const clock = createLessonClock(chart);
  const lastPlayableSecond = durationSeconds - NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS;
  const byTick = new Map<number, NumberBondSongNote>();
  for (const match of body.matchAll(/^\s*(\d+)\s*=\s*N\s+([0-4])\s+\d+\s*$/gm)) {
    const tick = Number(match[1]);
    const seconds = clock.toSeconds(tick);
    if (!Number.isFinite(seconds) || seconds < AUTHORED_MIN_FIRST_CUE_SECONDS || seconds > lastPlayableSecond) continue;
    if (!byTick.has(tick)) byTick.set(tick, { tick, lane: Number(match[2]), seconds });
  }
  return [...byTick.values()].sort((left, right) => left.seconds - right.seconds || left.lane - right.lane);
}

/** Greedy spacing yields the largest possible set of sequential gem encounters. */
export function getSpacedNumberBondNotes(notes: readonly NumberBondSongNote[]): NumberBondSongNote[] {
  const spaced: NumberBondSongNote[] = [];
  for (const note of notes) {
    if (spaced.length && note.seconds - spaced[spaced.length - 1].seconds + 1e-8 < NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS) continue;
    spaced.push(note);
  }
  return spaced;
}

/** Spread a small bond across the track while retaining real chart note times. */
export function planNumberBondNotes(
  notes: readonly NumberBondSongNote[],
  whole: number,
): NumberBondSongNote[] | null {
  if (!Number.isInteger(whole) || whole < 2 || whole > 20) return null;
  const available = getSpacedNumberBondNotes(notes);
  if (available.length < whole) return null;
  if (whole === available.length) return available;
  return Array.from({ length: whole }, (_, index) =>
    available[Math.round(index * (available.length - 1) / (whole - 1))],
  );
}
