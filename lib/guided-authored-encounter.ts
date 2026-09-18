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
  | "unsupported_concurrency";

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
): EncounterReadiness {
  const issues: EncounterIssue[] = [];
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

  if (encounter.mechanic === "drag") {
    const sourceHitId = encounter.dragTargets[0]?.sourceHitId;
    if (!sourceHitId) {
      issues.push(issue(encounter, "drag_source_required"));
    } else if (!readyHitIds.has(sourceHitId)) {
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

function inputFromEvent(
  event: AuthoredTimelineEvent,
  mechanic: GuidedMechanic,
  instance: AuthoredMechanicInstance,
): GuidedEncounterInput {
  return {
    id: instance.id,
    mechanic,
    tick: instance.tick ?? event.tick,
    endTick: instance.endTick ?? event.endTick,
    equation: instance.equation ?? event.assignments[mechanic],
    hitBubbles: instance.hitBubbles ?? [],
    spinTargets: instance.spinTargets ?? [],
    dragTargets: instance.dragTargets ?? [],
  };
}

export function evaluateLessonPublishReadiness(
  events: readonly AuthoredTimelineEvent[],
): LessonPublishReadiness {
  const blockers: EncounterIssue[] = [];
  const readyHitIds = new Set<string>();
  const ordered = events.flatMap((event) =>
    (["hit", "spin", "drag"] as const).flatMap((mechanic) =>
      (event.mechanicInstances?.[mechanic] ?? []).map((instance) => ({ event, mechanic, instance })),
    ),
  ).sort((left, right) =>
    (left.instance.tick ?? left.event.tick) - (right.instance.tick ?? right.event.tick) ||
    (left.instance.endTick ?? left.event.endTick ?? left.instance.tick ?? left.event.tick) -
      (right.instance.endTick ?? right.event.endTick ?? right.instance.tick ?? right.event.tick) ||
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
    const readiness = evaluateEncounterReadiness(input, readyHitIds);
    blockers.push(...readiness.issues);

    const sourceHitId = mechanic === "drag" ? input.dragTargets[0]?.sourceHitId : undefined;
    const source = sourceHitId ? inputById.get(sourceHitId) : undefined;
    if (source && source.mechanic === "hit" &&
      (source.input.tick ?? source.event.tick) >= (input.tick ?? event.tick)) {
      blockers.push(issue(input, "drag_source_not_earlier"));
    }

    if (mechanic === "hit" && readiness.ready) readyHitIds.add(instance.id);
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
  const readiness = evaluateEncounterReadiness(encounter, new Set());
  return { encounter, readiness, publishable: readiness.ready };
}
