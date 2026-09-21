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
} from "./activity-authoring-capabilities";

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
  | "equation_required"
  | "target_required"
  | "target_identity_invalid"
  | "hit_pad_required"
  | "hit_timing_invalid"
  | "spin_target_required"
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
  | "activity_hit_count";

export type EncounterIssue = {
  encounterId: string;
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
  equation_required: "Choose an equation to get started.",
  target_required: "Pick a token for this move.",
  target_identity_invalid: "Choose the token again.",
  hit_pad_required: "Choose at least one button for the token.",
  hit_timing_invalid: "A Hit must begin and end on the same tick.",
  spin_target_required: "Pick the token to spin.",
  drag_source_required: "Choose an earlier Hit to start this Drag.",
  duration_required: "Set when this move ends.",
  operator_target: "Pick a number or variable, not a + or = sign.",
  drag_source_not_ready: "Choose a Hit that comes before this Drag.",
  drag_source_not_earlier: "Move this Drag after its source Hit.",
  unsupported_concurrency: "Move this action so its approach window does not overlap another mechanic.",
  activity_mechanic_unsupported: "Use a Hit for this activity; its later interaction phases are generated at runtime.",
  activity_equation_invalid: "Use one valid Number Bonds equation, such as 5 = 2 + 3.",
  activity_target_shape: "Give this Number Bonds Hit exactly one bubble target.",
  activity_equation_count: "Use exactly one equation for Number Bonds.",
  activity_hit_count: "Add enough Hit cues for the selected Number Bonds equation.",
};

function issue(encounter: GuidedEncounterInput, code: EncounterIssueCode): EncounterIssue {
  const nextAction = ISSUE_ACTIONS[code];
  const labels: Record<EncounterIssueCode, string> = {
    equation_required: "needs an equation",
    target_required: "needs a token",
    target_identity_invalid: "needs its token chosen again",
    hit_pad_required: "needs a button",
    hit_timing_invalid: "must begin and end on the same tick",
    spin_target_required: "needs a token to spin",
    drag_source_required: "needs an earlier Hit",
    duration_required: "needs an end time",
    operator_target: "uses a + or = sign as its target",
    drag_source_not_ready: "needs a Hit that comes first",
    drag_source_not_earlier: "must start after its source Hit",
    unsupported_concurrency: "overlaps an unsupported mechanic",
    activity_mechanic_unsupported: "uses a mechanic that this activity does not author",
    activity_equation_invalid: "uses an equation outside this activity's contract",
    activity_target_shape: "has the wrong target shape for this activity",
    activity_equation_count: "has the wrong number of equations for this activity",
    activity_hit_count: "does not contain enough Hits for this activity",
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
    encounter.hitBubbles.length > 1
  ) {
    issues.push(issue(encounter, "activity_target_shape"));
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
    if (source && source.mechanic === "hit" &&
      (source.input.tick ?? source.event.tick) >= (input.tick ?? event.tick)) {
      blockers.push(issue(input, "drag_source_not_earlier"));
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
      const hitCount = ordered.filter(({ mechanic }) => mechanic === "hit").length;
      if (hitCount < whole && firstInput) {
        blockers.push(issue(firstInput, "activity_hit_count"));
      }
    }
  }

  // Timeline events are already in song seconds here. Unity begins presenting every
  // cue before its hit time, and a Hit remains active through its miss window. The
  // old raw-time overlap check allowed two tick-disjoint cues to fight over the
  // single presenter during that visual window.
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

      const sameHitGroup = left.mechanic === "hit" && right.mechanic === "hit" &&
        leftStart === rightStart && left.event.id === right.event.id &&
        leftInput.equation?.id === rightInput.equation?.id;
      if (sameHitGroup) {
        // Unity's presenter unions `pads` with the legacy-compatible
        // `positions` field before testing ownership. Match it here so an
        // imported payload cannot pass the editor then collide at launch.
        const leftPads = new Set(leftInput.hitBubbles.flatMap((target) => [
          ...(target.pads ?? []),
          ...(target.positions ?? []),
        ]));
        const sharedPad = rightInput.hitBubbles
          .flatMap((target) => [...(target.pads ?? []), ...(target.positions ?? [])])
          .find((pad) => leftPads.has(pad));
        if (!sharedPad) continue;
      }

      blockers.push(issue(rightInput, "unsupported_concurrency"));
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    nextAction: blockers[0]?.nextAction ?? "Ready to play!",
  };
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
