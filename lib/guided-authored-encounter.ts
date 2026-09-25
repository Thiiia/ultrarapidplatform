import {
  AUTHORED_HIT_MISS_WINDOW_SECONDS,
  AUTHORED_PRESENTATION_LEAD_SECONDS,
  isAuthoredEquationOperator,
} from "./authored-lesson";
import type {
  AuthoredMechanicInstance,
  AuthoredSavedEquation,
  AuthoredTimelineEvent,
} from "./authored-lesson-serialization";
import {
  getActivityAuthoringCapabilities,
  getNumberBondsWhole,
  getNumberBondsWholeTokenIndex,
  NUMBER_BONDS_TIMING_POLICY,
  validateAuthoredActivityTiming,
  type NumberBondsTimingIssue,
} from "./activity-authoring-capabilities";
import { resolveAuthoredHitPadTarget } from "./authored-hit-pad-layout";

export type GuidedMechanic = "hit" | "spin" | "drag";

export type GuidedEncounterInput = {
  id: string;
  mechanic: GuidedMechanic;
  tick?: number;
  endTick?: number;
  equation?: AuthoredSavedEquation | null;
  hitBubbles: AuthoredMechanicInstance["hitBubbles"];
  spinTargets: AuthoredMechanicInstance["spinTargets"];
  dragTargets: AuthoredMechanicInstance["dragTargets"];
};

export type EncounterIssueCode =
  | "lesson_encounter_required"
  | "equation_required"
  | "target_required"
  | "target_identity_invalid"
  | "hit_pad_required"
  | "hit_timing_invalid"
  | "spin_target_required"
  | "single_target_required"
  | "drag_source_required"
  | "duration_required"
  | "operator_target"
  | "drag_source_not_ready"
  | "drag_source_not_earlier"
  | "unsupported_concurrency"
  | "activity_mechanic_unsupported"
  | "activity_equation_invalid"
  | "activity_target_shape"
  | "activity_equation_count"
  | "activity_hit_count"
  | "activity_hit_spacing"
  | "gem_spacing"
  | "gem_tail"
  | "simultaneous_hits"
  | "stop_required"
  | "timing_invalid";

export type EncounterIssue = {
  encounterId: string | null;
  relatedEncounterId?: string;
  relatedEncounterIds?: string[];
  conflictStartSeconds?: number;
  conflictEndSeconds?: number;
  earliestSafeStartSeconds?: number;
  conflictIntervals?: Array<{
    encounterId: string;
    label: string;
    startSeconds: number;
    endSeconds: number;
  }>;
  code: EncounterIssueCode;
  message: string;
  nextAction: string;
};

export type EncounterReadiness = {
  encounterId: string;
  ready: boolean;
  issueCodes: EncounterIssueCode[];
  issues: EncounterIssue[];
  nextAction: string;
};

export type LessonPublishReadiness = {
  ready: boolean;
  blockers: EncounterIssue[];
  nextAction: string;
};

export type StagedMechanicInput = {
  id: string;
  mechanic: GuidedMechanic;
  tick: number;
  endTick?: number;
  equationId?: string;
  hitBubbles?: AuthoredMechanicInstance["hitBubbles"];
  spinTargets?: AuthoredMechanicInstance["spinTargets"];
  dragTargets?: AuthoredMechanicInstance["dragTargets"];
};

export type NormalizedStagedMechanic = {
  encounter: GuidedEncounterInput;
  readiness: EncounterReadiness;
  publishable: boolean;
};

const ISSUE_ACTIONS: Record<EncounterIssueCode, string> = {
  lesson_encounter_required: "Add at least one encounter with a playable move.",
  equation_required: "Choose an equation to get started.",
  target_required: "Pick a token for this move.",
  target_identity_invalid: "Choose the token again.",
  hit_pad_required: "Choose at least one button for the token.",
  hit_timing_invalid: "A Hit must begin and end on the same tick.",
  spin_target_required: "Pick the token to spin.",
  single_target_required: "Choose exactly one target token for this move.",
  drag_source_required: "Choose an earlier Hit to start this Drag.",
  duration_required: "Set when this move ends.",
  operator_target: "Pick a number or variable, not a + or = sign.",
  drag_source_not_ready: "Choose a Hit that comes before this Drag.",
  drag_source_not_earlier: "Move this Drag after its source Hit.",
  unsupported_concurrency: "Move either action so their approach windows do not overlap.",
  activity_mechanic_unsupported: "Use a Hit for this activity; its later interaction phases are generated at runtime.",
  activity_equation_invalid: "Use one valid Number Bonds equation, such as 5 = 2 + 3.",
  activity_target_shape: "Give this Number Bonds Hit exactly one bubble target.",
  activity_equation_count: "Use exactly one equation for Number Bonds.",
  activity_hit_count: "Use exactly one authored Hit for each generated Number Bonds gem.",
  activity_hit_spacing: "Leave time for the previous gem's catch, spin and drag before the next Hit.",
  gem_spacing: "Move this Hit farther from the previous Hit.",
  gem_tail: "Extend the lesson stop time after the final Hit.",
  simultaneous_hits: "Move this Hit so Number Bonds Hits do not happen together.",
  stop_required: "Set a lesson stop time after the final Hit.",
  timing_invalid: "Set a valid chart time for this Hit.",
};

function issue(encounter: GuidedEncounterInput, code: EncounterIssueCode): EncounterIssue {
  const nextAction = ISSUE_ACTIONS[code];
  const labels: Record<EncounterIssueCode, string> = {
    lesson_encounter_required: "needs a playable move",
    equation_required: "needs an equation",
    target_required: "needs a token",
    target_identity_invalid: "needs its token chosen again",
    hit_pad_required: "needs a button",
    hit_timing_invalid: "must begin and end on the same tick",
    spin_target_required: "needs a token to spin",
    single_target_required: "has more than one target token",
    drag_source_required: "needs an earlier Hit",
    duration_required: "needs an end time",
    operator_target: "uses a + or = sign as its target",
    drag_source_not_ready: "needs a Hit that comes first",
    drag_source_not_earlier: "must start after its source Hit",
    unsupported_concurrency: "overlaps another move",
    activity_mechanic_unsupported: "uses a mechanic that this activity does not author",
    activity_equation_invalid: "uses an equation outside this activity's contract",
    activity_target_shape: "has the wrong target shape for this activity",
    activity_equation_count: "has the wrong number of equations for this activity",
    activity_hit_count: "does not match the generated gem count",
    activity_hit_spacing: "starts before the previous Number Bonds Hit is ready",
    gem_spacing: "starts before the next Number Bonds Hit is available",
    gem_tail: "does not leave enough time after the final Number Bonds Hit",
    simultaneous_hits: "happens at the same time as another Number Bonds Hit",
    stop_required: "needs a lesson stop time after the final Number Bonds Hit",
    timing_invalid: "has an invalid chart time",
  };
  const mechanicLabel = encounter.mechanic[0].toUpperCase() + encounter.mechanic.slice(1);
  const numberMatch = encounter.id.match(/(?:hit|spin|drag)[-_ ]?(\d+)/i);
  const moveLabel = `${mechanicLabel}${numberMatch ? ` ${numberMatch[1]}` : ""}`;
  return {
    encounterId: encounter.id,
    code,
    message: `${moveLabel} ${labels[code]}.`,
    nextAction,
  };
}

function moveLabel(id: string, mechanic: GuidedMechanic) {
  const numberMatch = id.match(/(?:hit|spin|drag)[-_ ]?(\d+)/i);
  const label = mechanic[0].toUpperCase() + mechanic.slice(1);
  return `${label}${numberMatch ? ` ${numberMatch[1]}` : ""}`;
}

function activityHitCountIssue(
  hitCount: number,
  requiredCount: number,
  encounterId: string | null,
): EncounterIssue {
  if (hitCount > requiredCount) {
    const label = encounterId ? moveLabel(encounterId, "hit") : "This Hit";
    return {
      encounterId,
      code: "activity_hit_count",
      message: `${label} is extra for a ${requiredCount}-gem Number Bonds equation.`,
      nextAction: `Keep exactly ${requiredCount} authored Hits; remove the extra Hit.`,
    };
  }

  const missingCount = requiredCount - hitCount;
  return {
    encounterId,
    code: "activity_hit_count",
    message: `This Number Bonds equation has ${hitCount} of ${requiredCount} required Hits.`,
    nextAction: `Add ${missingCount} Hit${missingCount === 1 ? "" : "s"} so each generated gem has one cue.`,
  };
}

function timingIssueToEncounterIssue(timingIssue: NumberBondsTimingIssue): EncounterIssue {
  const label = moveLabel(timingIssue.encounterId, "hit");
  const previousLabel = timingIssue.relatedEncounterId
    ? moveLabel(timingIssue.relatedEncounterId, "hit")
    : "the previous Hit";
  const earliestStart = timingIssue.earliestStartSeconds?.toFixed(1);
  const minimumStop = timingIssue.minimumStopSeconds?.toFixed(1);

  switch (timingIssue.code) {
    case "gem_spacing":
      return {
        encounterId: timingIssue.encounterId,
        relatedEncounterId: timingIssue.relatedEncounterId,
        conflictStartSeconds: timingIssue.conflictStartSeconds,
        conflictEndSeconds: timingIssue.conflictEndSeconds,
        conflictIntervals: timingIssue.relatedEncounterId &&
          Number.isFinite(timingIssue.relatedStartSeconds) && Number.isFinite(timingIssue.encounterStartSeconds)
          ? [
            { encounterId: timingIssue.relatedEncounterId, label: previousLabel, startSeconds: timingIssue.relatedStartSeconds!, endSeconds: timingIssue.relatedStartSeconds! },
            { encounterId: timingIssue.encounterId, label, startSeconds: timingIssue.encounterStartSeconds!, endSeconds: timingIssue.encounterStartSeconds! },
          ]
          : undefined,
        earliestSafeStartSeconds: timingIssue.earliestSafeStartSeconds ?? timingIssue.earliestStartSeconds,
        code: "activity_hit_spacing",
        message: `${label} starts too soon after ${previousLabel}.`,
        nextAction: `Move ${label} to ${earliestStart}s or later.`,
      };
    case "simultaneous_hits":
      return {
        encounterId: timingIssue.encounterId,
        relatedEncounterId: timingIssue.relatedEncounterId,
        conflictStartSeconds: timingIssue.conflictStartSeconds,
        conflictEndSeconds: timingIssue.conflictEndSeconds,
        conflictIntervals: timingIssue.relatedEncounterId &&
          Number.isFinite(timingIssue.relatedStartSeconds) && Number.isFinite(timingIssue.encounterStartSeconds)
          ? [
            { encounterId: timingIssue.relatedEncounterId, label: previousLabel, startSeconds: timingIssue.relatedStartSeconds!, endSeconds: timingIssue.relatedStartSeconds! },
            { encounterId: timingIssue.encounterId, label, startSeconds: timingIssue.encounterStartSeconds!, endSeconds: timingIssue.encounterStartSeconds! },
          ]
          : undefined,
        earliestSafeStartSeconds: timingIssue.earliestSafeStartSeconds,
        code: timingIssue.code,
        message: `${label} happens at the same time as ${previousLabel}.`,
        nextAction: `Move ${label} so each Number Bonds Hit has its own time.`,
      };
    case "gem_tail":
      return {
        encounterId: timingIssue.encounterId,
        code: timingIssue.code,
        message: `The lesson stops too soon after ${label}.`,
        nextAction: `Set the lesson stop time to at least ${minimumStop}s.`,
      };
    case "stop_required":
      return {
        encounterId: timingIssue.encounterId,
        code: timingIssue.code,
        message: `The lesson needs a stop time after ${label}.`,
        nextAction: `Set the lesson stop time to at least ${minimumStop}s.`,
      };
    case "timing_invalid":
      return {
        encounterId: timingIssue.encounterId,
        code: timingIssue.code,
        message: label + " has an invalid chart time.",
        nextAction: "Set a valid time for " + label + ".",
      };
  }
}

function targetIndexes(encounter: GuidedEncounterInput) {
  if (encounter.mechanic === "hit") return encounter.hitBubbles.map((target) => target.tokenIndex);
  if (encounter.mechanic === "spin") return encounter.spinTargets.map((target) => target.tokenIndex);
  return encounter.dragTargets.map((target) => target.tokenIndex);
}

function targetIds(encounter: GuidedEncounterInput) {
  if (encounter.mechanic === "hit") return encounter.hitBubbles.map((target) => target.targetId);
  if (encounter.mechanic === "spin") return encounter.spinTargets.map((target) => target.targetId);
  return encounter.dragTargets.map((target) => target.targetId);
}

export function evaluateEncounterReadiness(
  encounter: GuidedEncounterInput,
  readyHitIds: ReadonlySet<string>,
  options: { activityKey?: string | null } = {},
): EncounterReadiness {
  const issues: EncounterIssue[] = [];
  const capabilities = getActivityAuthoringCapabilities(options.activityKey);
  if (!capabilities.supportedAuthoredMechanics.includes(encounter.mechanic)) {
    issues.push(issue(encounter, "activity_mechanic_unsupported"));
  }
  if (!encounter.equation || encounter.equation.tokens.length === 0) {
    issues.push(issue(encounter, "equation_required"));
  }

  const targets = targetIndexes(encounter);
  if (targets.length === 0) {
    issues.push(issue(encounter, encounter.mechanic === "spin" ? "spin_target_required" : "target_required"));
  }
  if (
    (encounter.mechanic === "spin" && encounter.spinTargets.length > 1) ||
    (encounter.mechanic === "drag" && encounter.dragTargets.length > 1)
  ) {
    issues.push(issue(encounter, "single_target_required"));
  }

  if (encounter.mechanic === "hit" && !encounter.hitBubbles.some((target) =>
    (target.pads?.length ?? 0) > 0 || (target.positions?.length ?? 0) > 0,
  )) {
    issues.push(issue(encounter, "hit_pad_required"));
  }

  if (encounter.mechanic === "hit" &&
    typeof encounter.endTick === "number" && encounter.endTick !== (encounter.tick ?? 0)) {
    issues.push(issue(encounter, "hit_timing_invalid"));
  }

  if (encounter.mechanic !== "hit" && (typeof encounter.endTick !== "number" || encounter.endTick <= (encounter.tick ?? 0))) {
    issues.push(issue(encounter, "duration_required"));
  }

  if (encounter.equation) {
    if (
      capabilities.activityKey === "number-bonds" &&
      getNumberBondsWhole(encounter.equation) == null
    ) {
      issues.push(issue(encounter, "activity_equation_invalid"));
    }
    const stableTokenIds = new Set(encounter.equation.tokens.map((token) => token.id));
    if (targetIds(encounter).some((targetId) => targetId && !stableTokenIds.has(targetId))) {
      issues.push(issue(encounter, "target_identity_invalid"));
    }

    for (const tokenIndex of targets) {
      const token = encounter.equation.tokens[tokenIndex];
      if (!token || isAuthoredEquationOperator(token.label)) {
        issues.push(issue(encounter, "operator_target"));
        break;
      }
    }
  }

  if (
    capabilities.activityKey === "number-bonds" &&
    encounter.mechanic === "hit" &&
    (encounter.hitBubbles.length !== 1 ||
      new Set(encounter.hitBubbles.flatMap(resolveAuthoredHitPadTarget)).size !== 1)
  ) {
    issues.push(issue(encounter, "activity_target_shape"));
  }
  if (capabilities.activityKey === "number-bonds" && encounter.mechanic === "hit" && encounter.equation) {
    const wholeTokenIndex = getNumberBondsWholeTokenIndex(encounter.equation);
    if (wholeTokenIndex != null && encounter.hitBubbles.some((target) => target.tokenIndex !== wholeTokenIndex)) {
      issues.push(issue(encounter, "activity_target_shape"));
    }
  }

  if (encounter.mechanic === "drag") {
    const sourceHitId = encounter.dragTargets[0]?.sourceHitId;
    // The v3 transport and Unity support standalone timed Drags. Only an
    // explicitly linked Drag depends on an earlier successful Hit.
    if (sourceHitId && !readyHitIds.has(sourceHitId)) {
      issues.push(issue(encounter, "drag_source_not_ready"));
    }
  }

  const issueCodes = issues.map(({ code }) => code);
  return {
    encounterId: encounter.id,
    ready: issues.length === 0,
    issueCodes,
    issues,
    nextAction: issues[0]?.nextAction ?? "Ready to play!",
  };
}

export function inputFromEvent(
  event: AuthoredTimelineEvent,
  mechanic: GuidedMechanic,
  instance: AuthoredMechanicInstance,
): GuidedEncounterInput {
  const tick = instance.tick ?? event.tick;
  // `event.endTick` is the aggregate end of every mechanic in an event after
  // hydration. A Hit is intrinsically instantaneous, so inheriting that
  // aggregate duration turns a valid hit into an impossible-to-fix draft.
  // Preserve an explicitly authored hit end so malformed input still receives
  // the normal same-tick validation error.
  const endTick = mechanic === "hit"
    ? instance.endTick ?? tick
    : instance.endTick ?? event.endTick;

  return {
    id: instance.id,
    mechanic,
    tick,
    endTick,
    equation: instance.equation ?? event.assignments[mechanic],
    hitBubbles: instance.hitBubbles ?? [],
    spinTargets: instance.spinTargets ?? [],
    dragTargets: instance.dragTargets ?? [],
  };
}

export type GuidedEncounterSelection = {
  eventId: string;
  mechanic: GuidedMechanic;
  instanceIndex: number;
  tick: number;
};

/** Resolve a readiness blocker back to the exact mechanic tab and timeline cue. */
export function findGuidedEncounterSelection(
  events: readonly AuthoredTimelineEvent[],
  encounterId: string,
): GuidedEncounterSelection | null {
  for (const event of events) {
    for (const mechanic of ["hit", "spin", "drag"] as const) {
      const instances = event.mechanicInstances?.[mechanic] ?? [];
      const instanceIndex = instances.findIndex((instance) => instance.id === encounterId);
      if (instanceIndex < 0) continue;
      const instance = instances[instanceIndex];
      return {
        eventId: event.id,
        mechanic,
        instanceIndex,
        tick: instance.tick ?? event.tick,
      };
    }
  }
  return null;
}

function effectiveEndTick(
  event: AuthoredTimelineEvent,
  mechanic: GuidedMechanic,
  instance: AuthoredMechanicInstance,
) {
  const input = inputFromEvent(event, mechanic, instance);
  return input.endTick ?? input.tick ?? event.tick;
}

export function evaluateLessonPublishReadiness(
  events: readonly AuthoredTimelineEvent[],
  options: {
    activityKey?: string | null;
    equationQueue?: readonly AuthoredSavedEquation[];
    clock?: { toTick(seconds: number): number; toSeconds(tick: number): number };
    stopAtSeconds?: number;
  } = {},
): LessonPublishReadiness {
  const blockers: EncounterIssue[] = [];
  const readyHitIds = new Set<string>();
  const ordered = events.flatMap((event) =>
    (["hit", "spin", "drag"] as const).flatMap((mechanic) =>
      (event.mechanicInstances?.[mechanic] ?? []).map((instance) => ({ event, mechanic, instance })),
    ),
  ).sort((left, right) =>
    (left.instance.tick ?? left.event.tick) - (right.instance.tick ?? right.event.tick) ||
    effectiveEndTick(left.event, left.mechanic, left.instance) -
      effectiveEndTick(right.event, right.mechanic, right.instance) ||
    left.event.id.localeCompare(right.event.id) ||
    left.instance.id.localeCompare(right.instance.id),
  );

  if (ordered.length === 0) {
    blockers.push({
      encounterId: null,
      code: "lesson_encounter_required",
      message: "This lesson has no playable encounters yet.",
      nextAction: ISSUE_ACTIONS.lesson_encounter_required,
    });
  }

  const inputById = new Map(
    ordered.map(({ event, mechanic, instance }) => [
      instance.id,
      { event, mechanic, input: inputFromEvent(event, mechanic, instance) },
    ]),
  );

  for (const { event, mechanic, instance } of ordered) {
    const input = inputFromEvent(event, mechanic, instance);
    const readiness = evaluateEncounterReadiness(input, readyHitIds, options);
    blockers.push(...readiness.issues);

    const sourceHitId = mechanic === "drag" ? input.dragTargets[0]?.sourceHitId : undefined;
    const source = sourceHitId ? inputById.get(sourceHitId) : undefined;
    if (sourceHitId && source && source.mechanic === "hit" &&
      (source.input.tick ?? source.event.tick) >= (input.tick ?? event.tick)) {
      const sourceStartSeconds = source.input.tick ?? source.event.tick;
      const dragStartSeconds = input.tick ?? event.tick;
      blockers.push({
        ...issue(input, "drag_source_not_earlier"),
        relatedEncounterId: sourceHitId,
        conflictStartSeconds: sourceStartSeconds,
        conflictEndSeconds: dragStartSeconds,
        earliestSafeStartSeconds: sourceStartSeconds + 0.001,
        conflictIntervals: [
          {
            encounterId: sourceHitId,
            label: moveLabel(sourceHitId, "hit"),
            startSeconds: sourceStartSeconds,
            endSeconds: sourceStartSeconds,
          },
          {
            encounterId: instance.id,
            label: moveLabel(instance.id, "drag"),
            startSeconds: dragStartSeconds,
            endSeconds: input.endTick ?? dragStartSeconds,
          },
        ],
      });
    }

    if (mechanic === "hit" && readiness.ready) readyHitIds.add(instance.id);
  }

  const capabilities = getActivityAuthoringCapabilities(options.activityKey);
  if (capabilities.activityKey === "number-bonds") {
    const equations = [
      ...(options.equationQueue ?? []),
      ...ordered
        .map(({ event, mechanic, instance }) => inputFromEvent(event, mechanic, instance).equation)
        .filter((equation): equation is AuthoredSavedEquation => Boolean(equation)),
    ];
    const equationIds = new Set(equations.map((equation) => equation.id));
    const firstInput = ordered.length > 0
      ? inputFromEvent(ordered[0].event, ordered[0].mechanic, ordered[0].instance)
      : null;
    if (equationIds.size !== 1 && firstInput) {
      blockers.push(issue(firstInput, "activity_equation_count"));
    }
    const firstEquation = equations[0];
    const whole = firstEquation ? getNumberBondsWhole(firstEquation) : null;
    if (firstEquation && whole == null && firstInput) {
      blockers.push(issue(firstInput, "activity_equation_invalid"));
    }
    if (whole != null) {
      const hits = ordered.filter(({ mechanic }) => mechanic === "hit");
      if (hits.length !== whole) {
        const affected = hits.length > whole ? hits[whole] : hits[0];
        blockers.push(activityHitCountIssue(
          hits.length,
          whole,
          affected?.instance.id ?? null,
        ));
      }
    }

    const toRuntimeSeconds = (seconds: number) => {
      if (!options.clock) return seconds;
      return options.clock.toSeconds(options.clock.toTick(seconds));
    };
    const timingIssues = validateAuthoredActivityTiming(
      capabilities.activityKey,
      ordered.map(({ event, mechanic, instance }) => {
        const input = inputFromEvent(event, mechanic, instance);
        return {
          id: instance.id,
          type: mechanic,
          startSeconds: toRuntimeSeconds(input.tick ?? event.tick),
        };
      }),
      options.stopAtSeconds,
    );
    for (const timingIssue of timingIssues) {
      blockers.push(timingIssueToEncounterIssue(timingIssue));
    }
  }

  // Timeline events are already in song seconds here. Unity begins presenting every
  // cue before its hit time, and a Hit remains active through its miss window. The
  // old raw-time overlap check allowed two tick-disjoint cues to fight over the
  // single presenter during that visual window.
  const concurrencyIssuesByEncounterId = new Map<string, EncounterIssue>();
  for (let index = 0; index < ordered.length; index += 1) {
    const left = ordered[index];
    const leftInput = inputFromEvent(left.event, left.mechanic, left.instance);
    const leftStart = leftInput.tick ?? left.event.tick;
    const leftEnd = leftInput.endTick ?? leftStart;
    const leftRelease = left.mechanic === "hit"
      ? leftStart + AUTHORED_HIT_MISS_WINDOW_SECONDS
      : leftEnd;
    for (let candidateIndex = index + 1; candidateIndex < ordered.length; candidateIndex += 1) {
      const right = ordered[candidateIndex];
      const rightInput = inputFromEvent(right.event, right.mechanic, right.instance);
      const rightStart = rightInput.tick ?? right.event.tick;
      const rightPresentationStart = Math.max(0, rightStart - AUTHORED_PRESENTATION_LEAD_SECONDS);
      if (rightPresentationStart > leftRelease) break;

      // Number Bonds has a stricter one-at-a-time authored contract. Its shared
      // timing validator reports the pair with stable gem_* codes below.
      if (capabilities.activityKey === "number-bonds" &&
          left.mechanic === "hit" && right.mechanic === "hit") continue;

      const sameHitGroup = left.mechanic === "hit" && right.mechanic === "hit" &&
        leftStart === rightStart && left.event.id === right.event.id &&
        leftInput.equation?.id === rightInput.equation?.id;
      if (sameHitGroup) {
        // Unity's presenter unions `pads` with the legacy-compatible
        // `positions` field before testing ownership. Match it here so an
        // imported payload cannot pass the editor then collide at launch.
        const leftPads = new Set(leftInput.hitBubbles.flatMap(resolveAuthoredHitPadTarget));
        const sharedPad = rightInput.hitBubbles
          .flatMap(resolveAuthoredHitPadTarget)
          .find((pad) => leftPads.has(pad));
        if (sharedPad === undefined) continue;
      }

      const rightLabel = moveLabel(right.instance.id, right.mechanic);
      const leftLabel = moveLabel(left.instance.id, left.mechanic);
      const leftPresentationStart = Math.max(0, leftStart - AUTHORED_PRESENTATION_LEAD_SECONDS);
      const rightRelease = right.mechanic === "hit"
        ? rightStart + AUTHORED_HIT_MISS_WINDOW_SECONDS
        : rightInput.endTick ?? rightStart;
      const priorConflict = concurrencyIssuesByEncounterId.get(right.instance.id);
      if (priorConflict) {
        const relatedEncounterIds = priorConflict.relatedEncounterIds ?? [left.instance.id];
        relatedEncounterIds.push(left.instance.id);
        priorConflict.relatedEncounterIds = relatedEncounterIds;
        const firstRelated = inputById.get(relatedEncounterIds[0]);
        const firstRelatedLabel = firstRelated
          ? moveLabel(relatedEncounterIds[0], firstRelated.mechanic)
          : leftLabel;
        priorConflict.message = `${rightLabel} overlaps ${relatedEncounterIds.length} other moves, including ${firstRelatedLabel}.`;
        priorConflict.nextAction = `Move ${rightLabel} later until its approach window clears all ${relatedEncounterIds.length} overlapping moves.`;
        continue;
      }
      const conflict = issue(rightInput, "unsupported_concurrency");
      const blocker: EncounterIssue = {
        ...conflict,
        relatedEncounterId: left.instance.id,
        relatedEncounterIds: [left.instance.id],
        conflictStartSeconds: Math.max(leftPresentationStart, rightPresentationStart),
        conflictEndSeconds: Math.min(leftRelease, rightRelease),
        conflictIntervals: [
          { encounterId: left.instance.id, label: leftLabel, startSeconds: leftPresentationStart, endSeconds: leftRelease },
          { encounterId: right.instance.id, label: rightLabel, startSeconds: rightPresentationStart, endSeconds: rightRelease },
        ],
        earliestSafeStartSeconds: leftRelease + AUTHORED_PRESENTATION_LEAD_SECONDS + 0.001,
        message: `${rightLabel} overlaps ${leftLabel}.`,
        nextAction: `Move ${rightLabel} later so its approach window does not overlap ${leftLabel}.`,
      };
      blockers.push(blocker);
      concurrencyIssuesByEncounterId.set(right.instance.id, blocker);
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    nextAction: blockers[0]?.nextAction ?? "Ready to play!",
  };
}

/** Reject a newly-created Unity presenter collision without trapping old drafts in place. */
export function findNewTimingConflict(
  before: readonly AuthoredTimelineEvent[],
  after: readonly AuthoredTimelineEvent[],
  options: { activityKey?: string | null; equationQueue?: readonly AuthoredSavedEquation[] } = {},
): EncounterIssue | null {
  const isTimingConflict = (blocker: EncounterIssue) =>
    blocker.code === "unsupported_concurrency" || blocker.code === "activity_hit_spacing";
  const key = (blocker: EncounterIssue, relatedEncounterId?: string) =>
    `${blocker.code}\u0000${blocker.encounterId}\u0000${relatedEncounterId ?? ""}`;
  const relatedIds = (blocker: EncounterIssue) =>
    blocker.code === "unsupported_concurrency"
      ? blocker.relatedEncounterIds ?? [blocker.relatedEncounterId]
      : [blocker.relatedEncounterId];
  const existing = new Set(evaluateLessonPublishReadiness(before, options).blockers
    .filter(isTimingConflict)
    .flatMap((blocker) => relatedIds(blocker).map((relatedId) => key(blocker, relatedId))));
  return evaluateLessonPublishReadiness(after, options).blockers.find((blocker) =>
    isTimingConflict(blocker) && relatedIds(blocker).some((relatedId) => !existing.has(key(blocker, relatedId))),
  ) ?? null;
}

export type EncounterMoveClock = {
  ticksPerBeat: number;
  toTick(seconds: number): number;
  toSeconds(tick: number): number;
};

export type EncounterMovePatch = {
  encounterId: string;
  eventId: string;
  mechanic: GuidedMechanic;
  fromSeconds: number;
  toSeconds: number;
  fromEndSeconds: number;
  toEndSeconds: number;
};

export type EncounterMoveProposal = {
  patches: EncounterMovePatch[];
  readiness: LessonPublishReadiness;
};

const MAX_REPAIR_MOVED_ENCOUNTERS = 16;
const MAX_REPAIR_BEAT_SEARCH = 4096;
const MOVE_TIME_EPSILON_SECONDS = 0.000001;

/** Apply a preview only while every cue still matches the position it was based on. */
export function applyEncounterMovePatches(
  events: readonly AuthoredTimelineEvent[],
  patches: readonly EncounterMovePatch[],
  direction: "apply" | "undo" = "apply",
): AuthoredTimelineEvent[] | null {
  if (patches.length === 0) return events.map((event) => event);
  const patchesById = new Map(patches.map((patch) => [patch.encounterId, patch]));
  if (patchesById.size !== patches.length) return null;

  let matchedPatches = 0;
  let stalePatch = false;
  const updatedEvents = events.map((event) => {
    let eventChanged = false;
    const nextMechanics = { ...event.mechanicInstances };

    for (const mechanic of ["hit", "spin", "drag"] as const) {
      const instances = event.mechanicInstances?.[mechanic] ?? [];
      const updatedInstances = instances.map((instance) => {
        const patch = patchesById.get(instance.id);
        if (!patch || patch.eventId !== event.id || patch.mechanic !== mechanic) return instance;

        const expectedStart = direction === "apply" ? patch.fromSeconds : patch.toSeconds;
        const expectedEnd = direction === "apply" ? patch.fromEndSeconds : patch.toEndSeconds;
        const currentStart = instance.tick ?? event.tick;
        const currentEnd = mechanic === "hit"
          ? instance.endTick ?? currentStart
          : instance.endTick ?? event.endTick ?? currentStart;
        if (Math.abs(currentStart - expectedStart) > MOVE_TIME_EPSILON_SECONDS ||
            Math.abs(currentEnd - expectedEnd) > MOVE_TIME_EPSILON_SECONDS) {
          stalePatch = true;
          return instance;
        }

        matchedPatches += 1;
        eventChanged = true;
        return {
          ...instance,
          tick: direction === "apply" ? patch.toSeconds : patch.fromSeconds,
          endTick: direction === "apply" ? patch.toEndSeconds : patch.fromEndSeconds,
        };
      });

      if (updatedInstances.some((instance, index) => instance !== instances[index])) {
        nextMechanics[mechanic] = updatedInstances;
      }
    }

    if (!eventChanged) return event;
    const onlyCueInSlot = Object.values(event.counts).reduce((total, count) => total + count, 0) === 1;
    const firstPatch = patches.find((patch) => patch.eventId === event.id);
    const nextStart = firstPatch
      ? (direction === "apply" ? firstPatch.toSeconds : firstPatch.fromSeconds)
      : event.tick;
    const nextEnd = firstPatch
      ? (direction === "apply" ? firstPatch.toEndSeconds : firstPatch.fromEndSeconds)
      : event.endTick;
    return {
      ...event,
      ...(onlyCueInSlot ? { tick: nextStart, endTick: nextEnd } : {}),
      mechanicInstances: nextMechanics,
    };
  });

  if (stalePatch || matchedPatches !== patches.length) return null;
  return updatedEvents;
}

/**
 * Build an immutable, tempo-snapped repair proposal for an existing timing
 * conflict. Later cues are moved only as needed to preserve the sequence, and
 * no more than sixteen cues are changed in one proposal.
 */
export function proposeEncounterMove(
  events: readonly AuthoredTimelineEvent[],
  encounterId: string,
  clock: EncounterMoveClock,
  options: {
    activityKey?: string | null;
    equationQueue?: readonly AuthoredSavedEquation[];
    stopAtSeconds?: number;
    songEndSeconds?: number;
  } = {},
): EncounterMoveProposal | null {
  if (!Number.isFinite(clock.ticksPerBeat) || clock.ticksPerBeat <= 0) return null;

  const baselineOptions = { ...options, clock };
  let proposedEvents: readonly AuthoredTimelineEvent[] = events.map((event) => event);
  const originalReadiness = evaluateLessonPublishReadiness(proposedEvents, baselineOptions);
  const initialIssue = originalReadiness.blockers.find((blocker) =>
    blocker.encounterId === encounterId &&
    isRepairTimingIssue(blocker) &&
    Number.isFinite(blocker.earliestSafeStartSeconds),
  );
  if (!initialIssue) return null;

  const patchesById = new Map<string, EncounterMovePatch>();
  const maxSongEnd = Number.isFinite(options.songEndSeconds)
    ? Math.max(0, Number(options.songEndSeconds))
    : Number.POSITIVE_INFINITY;

  for (let step = 0; step < MAX_REPAIR_MOVED_ENCOUNTERS; step += 1) {
    const currentReadiness = evaluateLessonPublishReadiness(proposedEvents, baselineOptions);
    const unresolved = currentReadiness.blockers.find((blocker) =>
      isRepairTimingIssue(blocker) && (
        blocker.encounterId === encounterId ||
        (blocker.relatedEncounterIds ?? [blocker.relatedEncounterId]).some((relatedId) =>
          relatedId != null && patchesById.has(relatedId),
        )
      ),
    );
    if (!unresolved) {
      return { patches: Array.from(patchesById.values()), readiness: currentReadiness };
    }

    const targetId = unresolved.encounterId;
    if (!targetId) return null;
    const selection = findGuidedEncounterSelection(proposedEvents, targetId);
    if (!selection) return null;
    const targetEvent = proposedEvents.find((event) => event.id === selection.eventId);
    const targetInstance = targetEvent?.mechanicInstances?.[selection.mechanic]?.[selection.instanceIndex];
    if (!targetEvent || !targetInstance) return null;

    const relatedIssues = currentReadiness.blockers.filter((blocker) =>
      blocker.encounterId === targetId && isRepairTimingIssue(blocker),
    );
    const minimumSafeSeconds = Math.max(
      ...relatedIssues.map((blocker) => blocker.earliestSafeStartSeconds ?? Number.NEGATIVE_INFINITY),
    );
    if (!Number.isFinite(minimumSafeSeconds)) return null;

    const oldStartSeconds = targetInstance.tick ?? targetEvent.tick;
    const oldEndSeconds = selection.mechanic === "hit"
      ? targetInstance.endTick ?? oldStartSeconds
      : targetInstance.endTick ?? targetEvent.endTick ?? oldStartSeconds;
    if (!Number.isFinite(oldStartSeconds) || !Number.isFinite(oldEndSeconds)) return null;
    const durationSeconds = selection.mechanic === "hit"
      ? 0
      : oldEndSeconds - oldStartSeconds;
    if (selection.mechanic !== "hit" && durationSeconds <= 0) return null;
    const earliestAfterCurrent = Math.max(
      minimumSafeSeconds,
      oldStartSeconds + MOVE_TIME_EPSILON_SECONDS,
    );
    let candidateTick = clock.toTick(earliestAfterCurrent);
    if (!Number.isFinite(candidateTick)) return null;
    const beatTicks = Math.max(1, Math.round(clock.ticksPerBeat));
    candidateTick = Math.max(
      Math.ceil((clock.toTick(oldStartSeconds) + 1) / beatTicks) * beatTicks,
      Math.ceil(candidateTick / beatTicks) * beatTicks,
    );

    let acceptedEvents: readonly AuthoredTimelineEvent[] | null = null;
    let acceptedStartSeconds = 0;
    const capabilities = getActivityAuthoringCapabilities(options.activityKey);
    const orderedHits = proposedEvents.flatMap((event) =>
      (event.mechanicInstances?.hit ?? []).map((instance) => ({ event, instance })),
    ).sort((left, right) =>
      (left.instance.tick ?? left.event.tick) - (right.instance.tick ?? right.event.tick) ||
      left.event.id.localeCompare(right.event.id) ||
      left.instance.id.localeCompare(right.instance.id),
    );
    const isFinalNumberBondsHit = capabilities.activityKey === "number-bonds" &&
      selection.mechanic === "hit" && orderedHits.at(-1)?.instance.id === targetId;
    let candidateLimitSeconds = maxSongEnd;
    if (Number.isFinite(options.stopAtSeconds)) {
      candidateLimitSeconds = Math.min(candidateLimitSeconds, Number(options.stopAtSeconds));
    }
    if (isFinalNumberBondsHit) {
      if (!Number.isFinite(options.stopAtSeconds)) return null;
      candidateLimitSeconds = Math.min(
        candidateLimitSeconds,
        Number(options.stopAtSeconds) - NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds,
      );
    }
    for (let candidateIndex = 0; candidateIndex < MAX_REPAIR_BEAT_SEARCH; candidateIndex += 1) {
      const candidateSeconds = clock.toSeconds(candidateTick);
      if (!Number.isFinite(candidateSeconds)) return null;
      if (candidateSeconds + MOVE_TIME_EPSILON_SECONDS >= earliestAfterCurrent &&
          candidateSeconds <= candidateLimitSeconds &&
          candidateSeconds + durationSeconds <= candidateLimitSeconds) {
        const nextEndSeconds = candidateSeconds + durationSeconds;
        let targetUpdated = false;
        const nextEvents = proposedEvents.map((event) => {
          if (event.id !== selection.eventId) return event;
          const nextInstances = event.mechanicInstances[selection.mechanic].map((instance) => {
            if (instance.id !== targetId) return instance;
            targetUpdated = true;
            return { ...instance, tick: candidateSeconds, endTick: nextEndSeconds };
          });
          const onlyCueInSlot = Object.values(event.counts).reduce((total, count) => total + count, 0) === 1;
          return {
            ...event,
            ...(onlyCueInSlot ? { tick: candidateSeconds, endTick: nextEndSeconds } : {}),
            mechanicInstances: { ...event.mechanicInstances, [selection.mechanic]: nextInstances },
          };
        });
        if (!targetUpdated) return null;
        const readiness = evaluateLessonPublishReadiness(nextEvents, baselineOptions);
        const targetStillConflicts = readiness.blockers.some((blocker) =>
          blocker.encounterId === targetId && isRepairTimingIssue(blocker),
        );
        if (!targetStillConflicts) {
          acceptedEvents = nextEvents;
          acceptedStartSeconds = candidateSeconds;
          break;
        }
      }
      candidateTick += beatTicks;
    }

    if (!acceptedEvents) return null;
    patchesById.set(targetId, {
      encounterId: targetId,
      eventId: selection.eventId,
      mechanic: selection.mechanic,
      fromSeconds: oldStartSeconds,
      toSeconds: acceptedStartSeconds,
      fromEndSeconds: oldEndSeconds,
      toEndSeconds: acceptedStartSeconds + durationSeconds,
    });
    proposedEvents = acceptedEvents;
  }

  const finalReadiness = evaluateLessonPublishReadiness(proposedEvents, baselineOptions);
  const stillRelated = finalReadiness.blockers.some((blocker) =>
    isRepairTimingIssue(blocker) && (
      blocker.encounterId === encounterId ||
      (blocker.relatedEncounterIds ?? [blocker.relatedEncounterId]).some((relatedId) =>
        relatedId != null && patchesById.has(relatedId),
      )
    ),
  );
  return stillRelated ? null : { patches: Array.from(patchesById.values()), readiness: finalReadiness };
}

function isRepairTimingIssue(blocker: EncounterIssue): boolean {
  return blocker.code === "unsupported_concurrency" ||
    blocker.code === "activity_hit_spacing" ||
    blocker.code === "gem_spacing" ||
    blocker.code === "simultaneous_hits" ||
    blocker.code === "drag_source_not_earlier";
}

/** Keep every timeline drag inside the timing shape accepted by Unity. */
export function retimeGuidedEncounter(
  encounter: Pick<GuidedEncounterInput, "mechanic" | "tick" | "endTick">,
  edge: "start" | "end",
  seconds: number,
): { tick: number; endTick: number } {
  const next = Math.max(0, Number(seconds.toFixed(3)));
  if (encounter.mechanic === "hit") return { tick: next, endTick: next };
  const start = Math.max(0, encounter.tick ?? 0);
  const end = Math.max(start + 0.01, encounter.endTick ?? start + 0.01);
  if (edge === "start") {
    const tick = Math.min(next, end - 0.01);
    return { tick, endTick: end };
  }
  return { tick: start, endTick: Math.max(next, start + 0.01) };
}

export function normalizeStagedMechanic(
  staged: StagedMechanicInput,
  selectedEquation: AuthoredSavedEquation | null | undefined,
  options: { activityKey?: string | null } = {},
): NormalizedStagedMechanic {
  const encounter: GuidedEncounterInput = {
    id: staged.id,
    mechanic: staged.mechanic,
    tick: staged.tick,
    endTick: staged.endTick,
    equation: selectedEquation ?? null,
    hitBubbles: staged.hitBubbles ?? [],
    spinTargets: staged.spinTargets ?? [],
    dragTargets: staged.dragTargets ?? [],
  };
  const readiness = evaluateEncounterReadiness(encounter, new Set(), options);
  return { encounter, readiness, publishable: readiness.ready };
}
