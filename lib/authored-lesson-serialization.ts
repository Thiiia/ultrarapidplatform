/**
 * v3 authored-lesson serialization boundary for the lesson builder.
 *
 * The editor timeline stores positions in audio seconds (fractional). The v3
 * wire protocol stores integer chart ticks. Conversion from seconds to ticks
 * happens exactly once, here, through the chart tempo map (resolution, offset
 * and SyncTrack) owned by createLessonClock.
 *
 * Identity is preserved, never derived from array position: event IDs,
 * mechanic instance IDs and equation IDs survive save/reopen/save unchanged.
 * Equations with zero mechanics are still serialized so queue order is kept.
 */

export type AuthoredLessonClock = {
  toTick(seconds: number): number;
  toSeconds(tick: number): number;
};

export type AuthoredEquationToken = {
  id: string;
  label: string;
};

export type AuthoredSavedEquation = {
  id: string;
  tokens: AuthoredEquationToken[];
};

export type AuthoredHitBubble = {
  tokenIndex: number;
  positions?: string[];
  pads?: string[];
};

export type AuthoredMechanicInstance = {
  id: string;
  /** Editor position in audio seconds (fractional). */
  tick?: number;
  /** Editor end position in audio seconds (fractional). */
  endTick?: number;
  hitBubbles: AuthoredHitBubble[];
  spinTargets: Array<{ tokenIndex: number }>;
  dragTargets: Array<{ tokenIndex: number; sourceHitId?: string }>;
};

export type AuthoredTimelineEvent = {
  id: string;
  /** Event start, audio seconds. */
  tick: number;
  /** Event end, audio seconds. */
  endTick?: number;
  counts: Record<"hit" | "spin" | "drag", number>;
  assignments: Record<"hit" | "spin" | "drag", AuthoredSavedEquation | null>;
  mechanicInstances: Record<"hit" | "spin" | "drag", AuthoredMechanicInstance[]>;
};

export type AuthoredSerializeIdentity = {
  songAssetId: string;
  activityKey: string;
  authorId?: string | null;
  revision?: string | null;
};

export type AuthoredDraftEncounter = {
  id: string;
  eventId: string;
  type: "hit" | "spin" | "drag";
  equationId?: string;
  startTick: number;
  endTick: number;
  hitBubbles?: AuthoredHitBubble[];
  spinTargets?: Array<{ tokenIndex: number }>;
  dragTargets?: Array<{ tokenIndex: number; sourceHitId?: string }>;
};

export type AuthoredLessonDraft = {
  version: 3;
  mode: "authored";
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  stopAtSeconds?: number;
  equations: Array<{ id: string; state: string }>;
  encounters: AuthoredDraftEncounter[];
};

const GAMEPLAY_MECHANICS = ["hit", "spin", "drag"] as const;

function tokensToState(tokens: AuthoredEquationToken[]) {
  return tokens.map((token) => token.label).join(" ");
}

/**
 * Convert a fractional editor-seconds position to an integer chart tick using
 * the shared tempo map. Rounds once, only at the tick boundary. Throws when
 * the position is not a finite number so a misinterpreted unit can never reach
 * the wire as a bogus near-zero tick.
 */
function secondsToTick(clock: AuthoredLessonClock, seconds: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    throw new Error(`Authored lesson position must be finite seconds, got ${String(seconds)}`);
  }

  const tick = clock.toTick(seconds);

  if (!Number.isSafeInteger(tick)) {
    throw new Error(`Authored lesson tick must be an integer, got ${String(tick)}`);
  }

  return Math.max(0, tick);
}

function firstAssignedEquation(event: AuthoredTimelineEvent) {
  return (
    event.assignments.hit ?? event.assignments.spin ?? event.assignments.drag ?? null
  );
}

/**
 * Serialize the editor timeline to the v3 authored draft. Every tick field is
 * an integer chart tick converted from editor seconds via the tempo map. IDs
 * are passed through unchanged; equations keep their authored order and are
 * included even when no mechanic references them.
 */
export function serializeAuthoredLesson(
  events: AuthoredTimelineEvent[],
  identity: AuthoredSerializeIdentity,
  clock: AuthoredLessonClock,
  stopAtSeconds?: number,
): AuthoredLessonDraft {
  const equations: AuthoredLessonDraft["equations"] = [];
  const encounters: AuthoredLessonDraft["encounters"] = [];
  const seenEquationIds = new Set<string>();
  const equationIdByState = new Map<string, string>();

  // Stable equation identity: the equation's own id when present; otherwise a
  // deterministic id derived from its authored state (never its array index).
  const resolveEquationId = (equation: AuthoredSavedEquation) => {
    const state = tokensToState(equation.tokens);

    if (equation.id) {
      return { id: equation.id, state };
    }

    const existing = equationIdByState.get(state);
    if (existing) {
      return { id: existing, state };
    }

    const derived = `eq_${state.replace(/\s+/g, "_")}`;
    equationIdByState.set(state, derived);
    return { id: derived, state };
  };

  events.forEach((event) => {
    const equation = firstAssignedEquation(event);

    if (equation && equation.tokens.length > 0) {
      const { id, state } = resolveEquationId(equation);
      if (!seenEquationIds.has(id)) {
        seenEquationIds.add(id);
        equations.push({ id, state });
      }
    }

    GAMEPLAY_MECHANICS.forEach((mechanic) => {
      const count = event.counts?.[mechanic] ?? 0;

      for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
        const instance = event.mechanicInstances?.[mechanic]?.[instanceIndex];
        if (!instance) {
          throw new Error(
            `Authored lesson mechanic instance is missing for event '${event.id}'`,
          );
        }

        const startTick = secondsToTick(clock, instance.tick ?? event.tick);
        const endTick = secondsToTick(
          clock,
          instance.endTick ?? instance.tick ?? event.tick,
        );

        encounters.push({
          id: instance.id,
          eventId: event.id,
          type: mechanic,
          ...(equation && equation.tokens.length > 0
            ? { equationId: resolveEquationId(equation).id }
            : {}),
          startTick,
          endTick,
          ...(mechanic === "hit" ? { hitBubbles: instance.hitBubbles ?? [] } : {}),
          ...(mechanic === "spin" ? { spinTargets: instance.spinTargets ?? [] } : {}),
          ...(mechanic === "drag" ? { dragTargets: instance.dragTargets ?? [] } : {}),
        });
      }
    });
  });

  return {
    version: 3,
    mode: "authored",
    songAssetId: identity.songAssetId,
    activityKey: identity.activityKey,
    ...(identity.authorId ? { authorId: identity.authorId } : {}),
    ...(identity.revision ? { revision: identity.revision } : {}),
    ...(typeof stopAtSeconds === "number" ? { stopAtSeconds } : {}),
    equations,
    encounters,
  };
}

type HydrationEquation = {
  id: string;
  tokens: Array<{ id: string; label: string }>;
};

export type HydratedAuthoredTimeline = {
  events: AuthoredTimelineEvent[];
  /** Every authored equation, including ones no mechanic references. */
  equations: HydrationEquation[];
};

function stateToTokens(equationId: string, state: string) {
  return state
    .split(/\s+/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({ id: `${equationId}-token-${index}`, label }));
}

function emptyAssignments(): Record<"hit" | "spin" | "drag", HydrationEquation | null> {
  return { hit: null, spin: null, drag: null };
}

function emptyCounts(): Record<"hit" | "spin" | "drag", number> {
  return { hit: 0, spin: 0, drag: 0 };
}

function emptyInstances(): Record<"hit" | "spin" | "drag", AuthoredMechanicInstance[]> {
  return { hit: [], spin: [], drag: [] };
}

/**
 * Inverse of serializeAuthoredLesson: rebuild the editor timeline from a v3
 * draft, converting integer ticks back to fractional audio seconds through the
 * same tempo map. Event IDs, instance IDs, equation IDs, targets, sourceHitId
 * and start/end are preserved exactly; equations with zero mechanics are kept
 * in the returned queue. Input must already be validated (parseAuthoredLessonDraft)
 * so invalid data is rejected, never normalized away.
 */
export function timelineEventsFromAuthoredLesson(
  draft: {
    equations: Array<{ id: string; state: string }>;
    encounters: Array<{
      id: string;
      eventId: string;
      type: "hit" | "spin" | "drag";
      equationId?: string;
      startTick: number;
      endTick: number;
      hitBubbles?: unknown[];
      spinTargets?: Array<{ tokenIndex: number }>;
      dragTargets?: Array<{ tokenIndex: number; sourceHitId?: string }>;
    }>;
  },
  clock: AuthoredLessonClock,
): HydratedAuthoredTimeline {
  const equationById = new Map<string, HydrationEquation>();
  const equations = draft.equations.map((entry) => {
    const hydrated: HydrationEquation = {
      id: entry.id,
      tokens: stateToTokens(entry.id, entry.state),
    };
    equationById.set(entry.id, hydrated);
    return hydrated;
  });

  const eventById = new Map<string, AuthoredTimelineEvent>();
  const orderedEvents: AuthoredTimelineEvent[] = [];

  const getEvent = (eventId: string, startTick: number, endTick: number) => {
    const existing = eventById.get(eventId);
    if (existing) {
      if (endTick > (existing.endTick ?? existing.tick)) {
        existing.endTick = clock.toSeconds(endTick);
      }
      return existing;
    }

    const created: AuthoredTimelineEvent = {
      id: eventId,
      tick: clock.toSeconds(startTick),
      ...(endTick > startTick ? { endTick: clock.toSeconds(endTick) } : {}),
      counts: emptyCounts(),
      assignments: emptyAssignments() as AuthoredTimelineEvent["assignments"],
      mechanicInstances: emptyInstances(),
    };
    eventById.set(eventId, created);
    orderedEvents.push(created);
    return created;
  };

  draft.encounters.forEach((encounter) => {
    const event = getEvent(encounter.eventId, encounter.startTick, encounter.endTick);
    const mechanic = encounter.type;

    const instanceEntry: AuthoredMechanicInstance = {
      id: encounter.id,
      tick: clock.toSeconds(encounter.startTick),
      ...(encounter.endTick > encounter.startTick
        ? { endTick: clock.toSeconds(encounter.endTick) }
        : {}),
      hitBubbles: (encounter.hitBubbles ?? []).map((bubble) => {
        const record = (bubble ?? {}) as {
          tokenIndex?: number;
          positions?: string[];
          pads?: string[];
        };
        return {
          tokenIndex: typeof record.tokenIndex === "number" ? record.tokenIndex : 0,
          ...(record.positions ? { positions: record.positions } : {}),
          ...(record.pads ? { pads: record.pads } : {}),
        };
      }),
      spinTargets: (encounter.spinTargets ?? []).map((target) => ({
        tokenIndex: target.tokenIndex,
      })),
      dragTargets: (encounter.dragTargets ?? []).map((target) => ({
        tokenIndex: target.tokenIndex,
        ...(target.sourceHitId ? { sourceHitId: target.sourceHitId } : {}),
      })),
    };

    event.mechanicInstances[mechanic].push(instanceEntry);
    event.counts[mechanic] = event.mechanicInstances[mechanic].length;

    if (encounter.equationId) {
      const equation = equationById.get(encounter.equationId);
      if (equation && !event.assignments[mechanic]) {
        event.assignments[mechanic] = equation;
      }
    }
  });

  // Keep encounters that share an event simultaneous; order is stable by first
  // appearance in the authored draft, which preserves authored order.
  return { events: orderedEvents, equations };
}
