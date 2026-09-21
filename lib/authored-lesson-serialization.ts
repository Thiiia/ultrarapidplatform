import { tokenizeAuthoredEquationState } from "./authored-lesson";
import { evaluateLessonPublishReadiness } from "./guided-authored-encounter";
import { getAuthoredActivityContractIssues } from "./activity-authoring-capabilities";

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
  targetId?: string;
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
  spinTargets: Array<{ tokenIndex: number; targetId?: string }>;
  dragTargets: Array<{ tokenIndex: number; targetId?: string; sourceHitId?: string }>;
  /** Optional per-instance binding; event assignment is only the legacy fallback. */
  equation?: AuthoredSavedEquation | null;
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
  // The serializer always emits this for playable mechanics; optional here
  // keeps its draft shape compatible with the parsed transport DTO.
  equationId?: string;
  startTick: number;
  endTick: number;
  hitBubbles?: AuthoredHitBubble[];
  spinTargets?: Array<{ tokenIndex: number; targetId?: string }>;
  dragTargets?: Array<{ tokenIndex: number; targetId?: string; sourceHitId?: string }>;
};

export type AuthoredLessonDraft = {
  version: 3;
  mode: "authored";
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  stopAtSeconds?: number;
  equations: Array<{ id: string; state: string; tokens?: AuthoredEquationToken[] }>;
  encounters: AuthoredDraftEncounter[];
};

const GAMEPLAY_MECHANICS = ["hit", "spin", "drag"] as const;

function tokensToState(tokens: AuthoredEquationToken[]) {
  return tokens.map((token) => token.label).join(" ");
}

/**
 * A targetId is a durable reference only while it belongs to the equation
 * assigned to this mechanic. Reassigning an event used to retain the old
 * equation's token ID, which made an otherwise valid target impossible to
 * save. Keep valid stable IDs (so inserted-token edits remain safe), but
 * rebind stale IDs to the editor's current token index.
 */
function bindTargetToEquation<T extends { tokenIndex: number; targetId?: string }>(
  target: T,
  equation: AuthoredSavedEquation,
): T {
  const targetId = target.targetId && equation.tokens.some((token) => token.id === target.targetId)
    ? target.targetId
    : equation.tokens[target.tokenIndex]?.id;
  const reboundTarget = { ...target };
  if (targetId) reboundTarget.targetId = targetId;
  else delete reboundTarget.targetId;
  return reboundTarget;
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
  if (seconds < 0) {
    throw new Error(`Authored lesson position must be non-negative seconds, got ${String(seconds)}`);
  }

  const tick = clock.toTick(seconds);

  if (!Number.isSafeInteger(tick)) {
    throw new Error(`Authored lesson tick must be an integer, got ${String(tick)}`);
  }

  if (tick < 0) {
    throw new Error(`Authored lesson tick must be non-negative, got ${String(tick)}`);
  }
  return tick;
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
  equationQueue: AuthoredSavedEquation[] = [],
  options: { forPublish?: boolean; activityKey?: string | null } = {},
): AuthoredLessonDraft {
  if (options.forPublish) {
    const readiness = evaluateLessonPublishReadiness(events, {
      activityKey: options.activityKey ?? identity.activityKey,
      equationQueue,
    });
    if (!readiness.ready) {
      const firstBlocker = readiness.blockers[0];
      throw new Error(
        `Authored lesson is not ready to publish: ${firstBlocker.encounterId} ${firstBlocker.nextAction}`,
      );
    }
  }

  const equations: Array<{ id: string; state: string; tokens: AuthoredEquationToken[] }> = [];
  const encounters: AuthoredLessonDraft["encounters"] = [];
  const equationById = new Map<string, { id: string; state: string; tokens: AuthoredEquationToken[] }>();

  // Stable equation identity: the equation's own id when present; otherwise a
  // deterministic id derived from its authored state (never its array index).
  const resolveEquationId = (equation: AuthoredSavedEquation) => {
    const state = tokensToState(equation.tokens);

    if (!equation.id.trim()) {
      throw new Error("Authored lesson equation id is required");
    }
    return { id: equation.id, state, tokens: equation.tokens.map((token) => ({ ...token })) };
  };

  const registerEquation = (equation: AuthoredSavedEquation | null | undefined) => {
    if (!equation) return null;
    if (equation.tokens.length === 0) {
      throw new Error(`Authored lesson equation '${equation.id}' must contain at least one token`);
    }
    const resolved = resolveEquationId(equation);
    const existing = equationById.get(resolved.id);
    if (existing && existing.state !== resolved.state) {
      throw new Error(`Authored lesson equation id '${resolved.id}' has conflicting states`);
    }
    if (!existing) {
      equationById.set(resolved.id, resolved);
      equations.push(resolved);
    }
    return resolved;
  };

  // The editor's ordered lesson queue is authoritative. It is intentionally
  // separate from encounter assignment discovery so an equation with no
  // mechanic (and two equations with identical state) survives round-trip.
  equationQueue.forEach((equation) => registerEquation(equation));

  events.forEach((event) => {
    GAMEPLAY_MECHANICS.forEach((mechanic) => {
      registerEquation(event.assignments[mechanic]);
      const count = event.counts?.[mechanic] ?? 0;

      for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
        const instance = event.mechanicInstances?.[mechanic]?.[instanceIndex];
        if (!instance) {
          throw new Error(
            `Authored lesson mechanic instance is missing for event '${event.id}'`,
          );
        }

        const equation = registerEquation(instance.equation ?? event.assignments[mechanic]);
        if (!equation) {
          throw new Error(`Authored lesson ${mechanic} mechanic for event '${event.id}' requires an assigned equation`);
        }

        // Historical data can contain a mechanic count without a declared
        // instance. Keep that targetless skip for backwards compatibility.
        // A declared empty instance is author intent and is blocked by the
        // publish readiness check above instead of being silently hidden.
        const targetCount = mechanic === "hit"
          ? instance.hitBubbles?.length ?? 0
          : mechanic === "spin"
            ? instance.spinTargets?.length ?? 0
            : instance.dragTargets?.length ?? 0;
        if (targetCount === 0) continue;

        const startTick = secondsToTick(clock, instance.tick ?? event.tick);
        const endTick = secondsToTick(
          clock,
          instance.endTick ?? instance.tick ?? event.tick,
        );

        encounters.push({
          id: instance.id,
          eventId: event.id,
          type: mechanic,
          equationId: equation.id,
          startTick,
          endTick,
          ...(mechanic === "hit" ? { hitBubbles: (instance.hitBubbles ?? []).map((target) => bindTargetToEquation(target, equation)) } : {}),
          ...(mechanic === "spin" ? { spinTargets: (instance.spinTargets ?? []).map((target) => bindTargetToEquation(target, equation)) } : {}),
          ...(mechanic === "drag" ? { dragTargets: (instance.dragTargets ?? []).map((target) => bindTargetToEquation(target, equation)) } : {}),
        });
      }
    });
  });

  const draft: AuthoredLessonDraft = {
    version: 3,
    mode: "authored",
    songAssetId: identity.songAssetId,
    activityKey: identity.activityKey,
    ...(identity.authorId ? { authorId: identity.authorId } : {}),
    ...(identity.revision ? { revision: identity.revision } : {}),
    ...(typeof stopAtSeconds === "number" ? { stopAtSeconds } : {}),
    equations: equations.map((equation) => ({ ...equation, tokens: equation.tokens.map((token) => ({ ...token })) })),
    encounters,
  };

  if (options.forPublish) {
    const contractIssue = getAuthoredActivityContractIssues(draft)[0];
    if (contractIssue) {
      throw new Error(`Authored lesson is not ready to publish: ${contractIssue.message}`);
    }
  }

  return draft;
}

type HydrationEquation = AuthoredSavedEquation;

export type HydratedAuthoredTimeline = {
  events: AuthoredTimelineEvent[];
  /** Every authored equation, including ones no mechanic references. */
  equations: HydrationEquation[];
};

function stateToTokens(equationId: string, state: string) {
  return tokenizeAuthoredEquationState(state)
    .map((label, index) => ({ id: `${equationId}-token-${index}`, label }));
}

function equationTokens(entry: { id: string; state: string; tokens?: AuthoredEquationToken[] }) {
  return entry.tokens?.map((token) => ({ ...token })) ?? stateToTokens(entry.id, entry.state);
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
    equations: Array<{ id: string; state: string; tokens?: AuthoredEquationToken[] }>;
    encounters: Array<{
      id: string;
      eventId: string;
      type: "hit" | "spin" | "drag";
      equationId?: string;
      startTick: number;
      endTick: number;
      hitBubbles?: unknown[];
      spinTargets?: Array<{ tokenIndex: number; targetId?: string }>;
      dragTargets?: Array<{ tokenIndex: number; targetId?: string; sourceHitId?: string }>;
    }>;
  },
  clock: AuthoredLessonClock,
): HydratedAuthoredTimeline {
  const equationById = new Map<string, HydrationEquation>();
  const equations = draft.equations.map((entry) => {
    const hydrated: HydrationEquation = {
      id: entry.id,
      tokens: equationTokens(entry),
    };
    equationById.set(entry.id, hydrated);
    return hydrated;
  });

  const eventById = new Map<string, AuthoredTimelineEvent>();
  const eventStartTickById = new Map<string, number>();
  const eventEndTickById = new Map<string, number>();
  const orderedEvents: AuthoredTimelineEvent[] = [];

  const getEvent = (eventId: string, startTick: number, endTick: number) => {
    const existing = eventById.get(eventId);
    if (existing) {
      const nextStartTick = Math.min(eventStartTickById.get(eventId) ?? startTick, startTick);
      const nextEndTick = Math.max(eventEndTickById.get(eventId) ?? endTick, endTick);
      eventStartTickById.set(eventId, nextStartTick);
      eventEndTickById.set(eventId, nextEndTick);
      existing.tick = clock.toSeconds(nextStartTick);
      existing.endTick = nextEndTick > nextStartTick ? clock.toSeconds(nextEndTick) : undefined;
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
    eventStartTickById.set(eventId, startTick);
    eventEndTickById.set(eventId, endTick);
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
      hitBubbles: (encounter.hitBubbles ?? []).map((bubble, bubbleIndex) => {
        if (!bubble || typeof bubble !== "object" || !Number.isSafeInteger((bubble as { tokenIndex?: unknown }).tokenIndex)) {
          throw new Error(`Authored encounter '${encounter.id}' hitBubbles[${bubbleIndex}].tokenIndex is required`);
        }
        const record = bubble as {
          tokenIndex: number;
          targetId?: string;
          positions?: string[];
          pads?: string[];
        };
        return {
          tokenIndex: record.tokenIndex,
          ...(typeof record.targetId === "string" ? { targetId: record.targetId } : {}),
          ...(record.positions ? { positions: record.positions } : {}),
          ...(record.pads ? { pads: record.pads } : {}),
        };
      }),
      spinTargets: (encounter.spinTargets ?? []).map((target) => ({
          tokenIndex: target.tokenIndex,
          ...(typeof target.targetId === "string" ? { targetId: target.targetId } : {}),
      })),
      dragTargets: (encounter.dragTargets ?? []).map((target) => ({
        tokenIndex: target.tokenIndex,
        ...(typeof target.targetId === "string" ? { targetId: target.targetId } : {}),
        ...(target.sourceHitId ? { sourceHitId: target.sourceHitId } : {}),
      })),
    };

    event.mechanicInstances[mechanic].push(instanceEntry);
    event.counts[mechanic] = event.mechanicInstances[mechanic].length;

    if (encounter.equationId) {
      const equation = equationById.get(encounter.equationId);
      if (equation) {
        instanceEntry.equation = {
          id: equation.id,
          tokens: equation.tokens.map((token) => ({ ...token })),
        };
        if (!event.assignments[mechanic]) {
          event.assignments[mechanic] = equation;
        }
      }
    }
  });

  // Keep encounters that share an event simultaneous; order is stable by first
  // appearance in the authored draft, which preserves authored order.
  return { events: orderedEvents, equations };
}
