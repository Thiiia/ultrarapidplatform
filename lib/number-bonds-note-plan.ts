import { getSongChartCues } from "./song-chart-cues";
import { createLessonClock } from "./editor/lesson-timing";
import {
  AUTHORED_HIT_MISS_WINDOW_SECONDS,
  AUTHORED_PRESENTATION_LEAD_SECONDS,
} from "./authored-lesson";
import {
  NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS,
  NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS,
} from "./number-bonds-timing";
import type { SupportedRhythmDifficulty } from "./chart-semantics";
import { NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY } from "./number-bonds-authored-sequence";

const GENERATED_ACTION_CLEARANCE_SECONDS = 0.002;

export type NumberBondSongNote = {
  tick: number;
  lane: number;
  seconds: number;
};

export type NumberBondSequenceCueTiming = {
  note: NumberBondSongNote;
  hitTick: number;
  spinStartTick: number;
  spinEndTick: number;
  dragStartTick: number;
  dragEndTick: number;
  hitSeconds: number;
  spinStartSeconds: number;
  spinEndSeconds: number;
  dragStartSeconds: number;
  dragEndSeconds: number;
};

/** Reserve the worst-case on-chart Hit → Spin → Drag time before the 12s tail. */
export function getNumberBondSequenceTailSeconds(chart: string): number {
  const sync = chart.match(/\[SyncTrack\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const tempos = Array.from(sync.matchAll(/^\s*\d+\s*=\s*B\s+(\d+)\s*$/gm), (match) => Number(match[1]) / 1000)
    .filter((bpm) => Number.isFinite(bpm) && bpm > 0);
  const slowestBpm = tempos.length ? Math.min(...tempos) : 120;
  const slowestBeatSeconds = 60 / slowestBpm;
  // Reserve complete playable stages, never a fraction of a beat that becomes
  // unreadable on a fast chart. Four upward 1/16-beat snaps cover tempo changes.
  return AUTHORED_HIT_MISS_WINDOW_SECONDS +
    AUTHORED_PRESENTATION_LEAD_SECONDS +
    NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.minimumSpinDurationSeconds +
    NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.spinToDragPreparationSeconds +
    NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.minimumDragDurationSeconds +
    (2 * GENERATED_ACTION_CLEARANCE_SECONDS) +
    slowestBeatSeconds / 4;
}

/** Collect playable chart notes on the same time axis as the editor timeline. */
export function getNumberBondSongNotes(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
  sequenceTailSeconds = 0,
): NumberBondSongNote[] {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const lastPlayableSecond = durationSeconds - NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS - Math.max(0, sequenceTailSeconds);
  const byTick = new Map<number, NumberBondSongNote>();
  for (const cue of getSongChartCues(chart, difficulty, durationSeconds)) {
    if (cue.seconds > lastPlayableSecond) continue;
    if (!byTick.has(cue.tick)) byTick.set(cue.tick, cue);
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

function planSequenceCuesFromNotes(
  clock: ReturnType<typeof createLessonClock>,
  durationSeconds: number,
  notes: readonly NumberBondSongNote[],
  whole: number,
): NumberBondSequenceCueTiming[] | null {
  if (!Number.isInteger(whole) || whole < 2 || whole > 20) return null;

  const gridTicks = Math.max(1, Math.floor(clock.ticksPerBeat / 16));
  const snapUp = (tick: number) => Math.ceil(tick / gridTicks) * gridTicks;
  const snapTickAtOrAfterSeconds = (seconds: number, minimumTick: number) => {
    let tick = snapUp(Math.max(minimumTick, clock.toTick(seconds)));
    while (clock.toSeconds(tick) + 1e-8 < seconds) tick += gridTicks;
    return tick;
  };
  const playable: NumberBondSequenceCueTiming[] = [];

  for (const note of notes) {
    const hitTick = note.tick;
    const hitSeconds = clock.toSeconds(hitTick);
    if (!Number.isSafeInteger(hitTick)) return null;

    const minimumSpinStartSeconds = hitSeconds +
      AUTHORED_HIT_MISS_WINDOW_SECONDS +
      AUTHORED_PRESENTATION_LEAD_SECONDS +
      GENERATED_ACTION_CLEARANCE_SECONDS;
    const spinStartTick = snapTickAtOrAfterSeconds(minimumSpinStartSeconds, hitTick + gridTicks);
    const spinStartSeconds = clock.toSeconds(spinStartTick);
    const spinEndTick = snapTickAtOrAfterSeconds(
      spinStartSeconds + NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.minimumSpinDurationSeconds,
      spinStartTick + gridTicks,
    );
    const spinEndSeconds = clock.toSeconds(spinEndTick);
    const dragStartTick = snapTickAtOrAfterSeconds(
      spinEndSeconds + NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.spinToDragPreparationSeconds + GENERATED_ACTION_CLEARANCE_SECONDS,
      spinEndTick + gridTicks,
    );
    const dragStartSeconds = clock.toSeconds(dragStartTick);
    const dragEndTick = snapTickAtOrAfterSeconds(
      dragStartSeconds + NUMBER_BOND_SEQUENCE_PLAYABILITY_POLICY.minimumDragDurationSeconds,
      dragStartTick + gridTicks,
    );
    const dragEndSeconds = clock.toSeconds(dragEndTick);
    const previous = playable[playable.length - 1];
    if (!Number.isFinite(dragEndSeconds) ||
      durationSeconds - dragEndSeconds + 1e-8 < NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS ||
      (previous && (
        hitSeconds - previous.hitSeconds + 1e-8 < NUMBER_BONDS_MINIMUM_HIT_SPACING_SECONDS ||
        hitSeconds <= previous.dragEndSeconds + AUTHORED_PRESENTATION_LEAD_SECONDS + GENERATED_ACTION_CLEARANCE_SECONDS
      ))) continue;
    playable.push({
      note, hitTick, spinStartTick, spinEndTick, dragStartTick, dragEndTick,
      hitSeconds, spinStartSeconds, spinEndSeconds, dragStartSeconds, dragEndSeconds,
    });
  }

  if (playable.length < whole) return null;
  if (playable.length === whole) return playable;
  // Spread a smaller whole only after complete journeys have been budgeted.
  // Dropping intervening journeys increases breathing space without squeezing
  // any stage or moving a Hit away from its real chart note.
  return Array.from({ length: whole }, (_, index) =>
    playable[Math.round(index * (playable.length - 1) / (whole - 1))],
  );
}

/** Find the largest whole whose chart cues can finish every Hit → Spin → Drag. */
export function getNumberBondSequenceCapacity(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
  maxWhole = 20,
): number {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const clock = createLessonClock(chart);
  const notes = getNumberBondSongNotes(
    chart,
    difficulty,
    durationSeconds,
    getNumberBondSequenceTailSeconds(chart),
  );
  const upperBound = Math.min(20, Math.max(0, Math.floor(maxWhole)), getSpacedNumberBondNotes(notes).length);

  for (let whole = upperBound; whole >= 2; whole -= 1) {
    if (planSequenceCuesFromNotes(clock, durationSeconds, notes, whole)) return whole;
  }
  return 0;
}

/**
 * Build chart-quantized Hit, Spin and Drag windows for one physical gem per
 * selected cue. Hit spacing and the final interaction tail are both enforced
 * against the selected song's tempo map.
 */
export function planNumberBondSequenceCues(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
  whole: number,
): NumberBondSequenceCueTiming[] | null {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const clock = createLessonClock(chart);
  const notes = getNumberBondSongNotes(
    chart,
    difficulty,
    durationSeconds,
    getNumberBondSequenceTailSeconds(chart),
  );
  return planSequenceCuesFromNotes(clock, durationSeconds, notes, whole);
}

/** Re-budget a known note selection without changing any of its chart Hits.
 * Used by the checked-in catalogue revision tool before trying a new selection.
 * Every requested tick must still exist in this difficulty and fit a full journey.
 */
export function planNumberBondSequenceCuesForHitTicks(
  chart: string,
  difficulty: SupportedRhythmDifficulty,
  durationSeconds: number,
  hitTicks: readonly number[],
): NumberBondSequenceCueTiming[] | null {
  if (!chart.trim() || !Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
    hitTicks.length < 2 || hitTicks.length > 20 ||
    hitTicks.some((tick, index) => !Number.isSafeInteger(tick) || tick < 0 || (index > 0 && tick <= hitTicks[index - 1]))) return null;
  const requested = new Set(hitTicks);
  const notes = getNumberBondSongNotes(chart, difficulty, durationSeconds).filter((note) => requested.has(note.tick));
  if (notes.length !== hitTicks.length) return null;
  return planSequenceCuesFromNotes(createLessonClock(chart), durationSeconds, notes, hitTicks.length);
}
