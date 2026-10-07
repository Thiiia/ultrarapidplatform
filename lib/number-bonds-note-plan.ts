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
  // Keep both approach windows clear: Hit miss + lead before Spin, then a full
  // lead before Drag. Reserve two half-beat actions and two 1/16-beat snaps.
  return AUTHORED_HIT_MISS_WINDOW_SECONDS +
    (2 * AUTHORED_PRESENTATION_LEAD_SECONDS) +
    (2 * GENERATED_ACTION_CLEARANCE_SECONDS) +
    slowestBeatSeconds * 1.125;
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
  const selected = planNumberBondNotes(notes, whole);
  if (!selected) return null;

  const gridTicks = Math.max(1, Math.floor(clock.ticksPerBeat / 16));
  const snapUp = (tick: number) => Math.ceil(tick / gridTicks) * gridTicks;
  const snapTickAtOrAfterSeconds = (seconds: number, minimumTick: number) => {
    let tick = snapUp(Math.max(minimumTick, clock.toTick(seconds)));
    while (clock.toSeconds(tick) + 1e-8 < seconds) tick += gridTicks;
    return tick;
  };
  const defaultStageTicks = Math.max(gridTicks, Math.floor((clock.ticksPerBeat / 2) / gridTicks) * gridTicks);
  const cues: NumberBondSequenceCueTiming[] = [];

  for (let index = 0; index < selected.length; index += 1) {
    const note = selected[index];
    const hitTick = note.tick;
    const hitSeconds = clock.toSeconds(hitTick);
    if (!Number.isSafeInteger(hitTick)) return null;

    const minimumSpinStartSeconds = hitSeconds +
      AUTHORED_HIT_MISS_WINDOW_SECONDS +
      AUTHORED_PRESENTATION_LEAD_SECONDS +
      GENERATED_ACTION_CLEARANCE_SECONDS;
    const spinStartTick = snapTickAtOrAfterSeconds(minimumSpinStartSeconds, hitTick + gridTicks);
    const nextHitTick = selected[index + 1]?.tick;
    const nextHitSeconds = nextHitTick === undefined ? undefined : clock.toSeconds(nextHitTick);
    let cue: NumberBondSequenceCueTiming | null = null;

    for (let stageTicks = defaultStageTicks; stageTicks >= gridTicks; stageTicks -= gridTicks) {
      const spinEndTick = spinStartTick + stageTicks;
      const spinEndSeconds = clock.toSeconds(spinEndTick);
      const minimumDragStartSeconds = spinEndSeconds +
        AUTHORED_PRESENTATION_LEAD_SECONDS +
        GENERATED_ACTION_CLEARANCE_SECONDS;
      const dragStartTick = snapTickAtOrAfterSeconds(minimumDragStartSeconds, spinEndTick + gridTicks);
      const dragEndTick = dragStartTick + stageTicks;
      const dragEndSeconds = clock.toSeconds(dragEndTick);
      const clearsNextHit = nextHitSeconds === undefined ||
        dragEndSeconds + AUTHORED_PRESENTATION_LEAD_SECONDS + GENERATED_ACTION_CLEARANCE_SECONDS < nextHitSeconds;

      if (
        !Number.isFinite(dragEndSeconds) ||
        !clearsNextHit ||
        durationSeconds - dragEndSeconds + 1e-8 < NUMBER_BONDS_FINAL_INTERACTION_TAIL_SECONDS
      ) {
        continue;
      }

      cue = {
        note,
        hitTick,
        spinStartTick,
        spinEndTick,
        dragStartTick,
        dragEndTick,
        hitSeconds,
        spinStartSeconds: clock.toSeconds(spinStartTick),
        spinEndSeconds,
        dragStartSeconds: clock.toSeconds(dragStartTick),
        dragEndSeconds,
      };
      break;
    }

    if (!cue) return null;
    cues.push(cue);
  }

  return cues;
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
