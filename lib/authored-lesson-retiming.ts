import {
  AUTHORED_HIT_MISS_WINDOW_SECONDS,
  AUTHORED_PRESENTATION_LEAD_SECONDS,
  type AuthoredLessonClock,
  type AuthoredLessonDraft,
  type AuthoredLessonEncounter,
} from "./authored-lesson";
import {
  SUPPORTED_RHYTHM_DIFFICULTIES,
  type SupportedRhythmDifficulty,
} from "./chart-semantics";

const RETIMING_EPSILON_SECONDS = 0.001;

export type AuthoredRetimingChange = {
  encounterId: string;
  fromTick: number;
  toTick: number;
  fromSeconds: number;
  toSeconds: number;
};

export type AuthoredLessonRetimingResult = {
  lesson: AuthoredLessonDraft;
  changes: AuthoredRetimingChange[];
  anchorDifficulty: SupportedRhythmDifficulty;
};

type AuthoredLessonRetimingClock = AuthoredLessonClock & {
  toTick(seconds: number): number;
};

function chartSection(chart: string, name: string) {
  return chart.match(new RegExp(`\\[${name}\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? null;
}

function noteTicks(chart: string, difficulty: SupportedRhythmDifficulty) {
  const body = chartSection(chart, difficulty);
  if (!body) return [];
  return [...new Set(Array.from(body.matchAll(/^\s*(\d+)\s*=\s*N\s+\d+\s+\d+\s*$/gm), (match) => Number(match[1])))]
    .sort((left, right) => left - right);
}

/**
 * Authored algebra cues share the rhythm chart's presentation space. The
 * shipped player currently uses MediumSingle when it is available, so use it
 * first and fall back deterministically for charts which do not contain it.
 */
export function musicalAnchorTicks(
  chart: string,
  preferredDifficulty: SupportedRhythmDifficulty = "MediumSingle",
) {
  const difficultyOrder = [
    preferredDifficulty,
    ...SUPPORTED_RHYTHM_DIFFICULTIES.filter((difficulty) => difficulty !== preferredDifficulty),
  ];

  for (const difficulty of difficultyOrder) {
    const ticks = noteTicks(chart, difficulty);
    if (ticks.length) return { difficulty, ticks };
  }

  throw new Error("Authored lesson retiming requires at least one playable rhythm-note anchor");
}

function releaseSeconds(encounter: AuthoredLessonEncounter, clock: AuthoredLessonClock) {
  const startSeconds = clock.toSeconds(encounter.startTick);
  return encounter.type === "hit"
    ? startSeconds + AUTHORED_HIT_MISS_WINDOW_SECONDS
    : clock.toSeconds(encounter.endTick);
}

function isSameHitGroup(left: AuthoredLessonEncounter, right: AuthoredLessonEncounter) {
  return left.type === "hit" && right.type === "hit" &&
    left.startTick === right.startTick &&
    left.eventId === right.eventId &&
    left.equationId === right.equationId;
}

function nextAnchorAtOrAfter(
  anchors: readonly number[],
  minimumSeconds: number,
  clock: AuthoredLessonClock,
) {
  const tick = anchors.find((candidate) => clock.toSeconds(candidate) + RETIMING_EPSILON_SECONDS >= minimumSeconds);
  if (tick == null) {
    throw new Error(
      `No remaining rhythm-note anchor is available at or after ${minimumSeconds.toFixed(3)}s for an authored encounter`,
    );
  }
  return tick;
}

/**
 * Retimes only later cues that would contest Unity's single authored
 * presenter. Moved cues snap to the next playable chart note, while non-HIT
 * durations are preserved in song seconds. Caller must validate and publish
 * the returned immutable revision.
 */
export function retimeAuthoredLessonToMusic({
  chart,
  lesson,
  clock,
  preferredDifficulty,
  minimumFirstCueSeconds,
}: {
  chart: string;
  lesson: AuthoredLessonDraft;
  clock: AuthoredLessonRetimingClock;
  preferredDifficulty?: SupportedRhythmDifficulty;
  /** Optional learner-facing floor for the first authored action. */
  minimumFirstCueSeconds?: number;
}): AuthoredLessonRetimingResult {
  const anchors = musicalAnchorTicks(chart, preferredDifficulty);
  const ordered = [...lesson.encounters].sort((left, right) =>
    left.startTick - right.startTick ||
    left.endTick - right.endTick ||
    left.id.localeCompare(right.id),
  );
  const retimed = new Map<string, AuthoredLessonEncounter>();
  const releaseById = new Map<string, number>();
  const changes: AuthoredRetimingChange[] = [];
  let previousReleaseSeconds = -Infinity;
  const firstCueFloorSeconds = Number.isFinite(minimumFirstCueSeconds)
    ? Math.max(0, Number(minimumFirstCueSeconds))
    : 0;

  for (let index = 0; index < ordered.length;) {
    const isFirstGroup = index === 0;
    const group = [ordered[index]];
    while (index + group.length < ordered.length && isSameHitGroup(group[0], ordered[index + group.length])) {
      group.push(ordered[index + group.length]);
    }
    index += group.length;

    const originalStartSeconds = clock.toSeconds(group[0].startTick);
    const dependencyReleaseSeconds = group[0].type === "drag"
      ? group[0].dragTargets
        ?.map((target) => target.sourceHitId ? releaseById.get(target.sourceHitId) : undefined)
        .find((release): release is number => typeof release === "number")
      : undefined;
    const requiredStartSeconds = Math.max(
      originalStartSeconds,
      isFirstGroup ? firstCueFloorSeconds : -Infinity,
      previousReleaseSeconds + AUTHORED_PRESENTATION_LEAD_SECONDS + RETIMING_EPSILON_SECONDS,
      (dependencyReleaseSeconds ?? -Infinity) + AUTHORED_PRESENTATION_LEAD_SECONDS + RETIMING_EPSILON_SECONDS,
    );
    const startTick = requiredStartSeconds > originalStartSeconds + RETIMING_EPSILON_SECONDS
      ? nextAnchorAtOrAfter(anchors.ticks, requiredStartSeconds, clock)
      : group[0].startTick;
    const startSeconds = clock.toSeconds(startTick);

    const nextGroup = group.map((encounter) => {
      const oldStartSeconds = clock.toSeconds(encounter.startTick);
      const originalDurationSeconds = encounter.type === "hit"
        ? 0
        : clock.toSeconds(encounter.endTick) - oldStartSeconds;
      const endTick = encounter.type === "hit"
        ? startTick
        : Math.max(startTick + 1, clock.toTick(startSeconds + originalDurationSeconds));
      const next = { ...encounter, startTick, endTick };
      retimed.set(next.id, next);
      if (next.startTick !== encounter.startTick) {
        changes.push({
          encounterId: next.id,
          fromTick: encounter.startTick,
          toTick: next.startTick,
          fromSeconds: oldStartSeconds,
          toSeconds: startSeconds,
        });
      }
      releaseById.set(next.id, releaseSeconds(next, clock));
      return next;
    });
    previousReleaseSeconds = Math.max(...nextGroup.map((encounter) => releaseSeconds(encounter, clock)));
  }

  return {
    lesson: {
      ...lesson,
      encounters: lesson.encounters.map((encounter) => retimed.get(encounter.id) ?? encounter),
    },
    changes,
    anchorDifficulty: anchors.difficulty,
  };
}
