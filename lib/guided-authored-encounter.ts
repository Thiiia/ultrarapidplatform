import { isAuthoredEquationOperator } from "./authored-lesson";
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
  | "hit_pad_required"
  | "spin_target_required"
  | "drag_source_required"
  | "duration_required"
  | "operator_target"
  | "drag_source_not_ready";

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
  equation_required: "Save or choose an equation for this encounter.",
  target_required: "Select a playable token for this encounter.",
  hit_pad_required: "Choose at least one hit pad for the selected target.",
  spin_target_required: "Select the token to spin.",
  drag_source_required: "Choose an earlier ready Hit as the drag source.",
  duration_required: "Set an end time after the start time.",
  operator_target: "Choose a number or variable; operators cannot be gameplay targets.",
  drag_source_not_ready: "Choose an earlier ready Hit before this Drag.",
};

function issue(encounterId: string, code: EncounterIssueCode): EncounterIssue {
  const nextAction = ISSUE_ACTIONS[code];
  const labels: Record<EncounterIssueCode, string> = {
    equation_required: "needs an equation",
    target_required: "needs a playable target",
    hit_pad_required: "needs a hit pad",
    spin_target_required: "needs a spin target",
    drag_source_required: "needs an earlier ready Hit source",
    duration_required: "needs an end time after its start",
    operator_target: "targets an operator",
    drag_source_not_ready: "needs an earlier ready Hit source",
  };
  return {
    encounterId,
    code,
    message: `${encounterId} ${labels[code]}.`,
    nextAction,
  };
}

function targetIndexes(encounter: GuidedEncounterInput) {
  if (encounter.mechanic === "hit") return encounter.hitBubbles.map((target) => target.tokenIndex);
  if (encounter.mechanic === "spin") return encounter.spinTargets.map((target) => target.tokenIndex);
  return encounter.dragTargets.map((target) => target.tokenIndex);
}

export function evaluateEncounterReadiness(
  encounter: GuidedEncounterInput,
  readyHitIds: ReadonlySet<string>,
): EncounterReadiness {
  const issues: EncounterIssue[] = [];
  if (!encounter.equation || encounter.equation.tokens.length === 0) {
    issues.push(issue(encounter.id, "equation_required"));
  }

  const targets = targetIndexes(encounter);
  if (targets.length === 0) {
    issues.push(issue(encounter.id, encounter.mechanic === "spin" ? "spin_target_required" : "target_required"));
  }

  if (encounter.mechanic === "hit" && !encounter.hitBubbles.some((target) => (target.pads?.length ?? 0) > 0)) {
    issues.push(issue(encounter.id, "hit_pad_required"));
  }

  if (encounter.mechanic !== "hit" && (typeof encounter.endTick !== "number" || encounter.endTick <= (encounter.tick ?? 0))) {
    issues.push(issue(encounter.id, "duration_required"));
  }

  if (encounter.equation) {
    for (const tokenIndex of targets) {
      const token = encounter.equation.tokens[tokenIndex];
      if (!token || isAuthoredEquationOperator(token.label)) {
        issues.push(issue(encounter.id, "operator_target"));
        break;
      }
    }
  }

  if (encounter.mechanic === "drag") {
    const sourceHitId = encounter.dragTargets[0]?.sourceHitId;
    if (!sourceHitId) {
      issues.push(issue(encounter.id, "drag_source_required"));
    } else if (!readyHitIds.has(sourceHitId)) {
      issues.push(issue(encounter.id, "drag_source_not_ready"));
    }
  }

  const issueCodes = issues.map(({ code }) => code);
  return {
    encounterId: encounter.id,
    ready: issues.length === 0,
    issueCodes,
    issues,
    nextAction: issues[0]?.nextAction ?? "Ready to publish and play.",
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
    (left.instance.tick ?? left.event.tick) - (right.instance.tick ?? right.event.tick),
  );

  for (const { event, mechanic, instance } of ordered) {
    const readiness = evaluateEncounterReadiness(inputFromEvent(event, mechanic, instance), readyHitIds);
    blockers.push(...readiness.issues);
    if (mechanic === "hit" && readiness.ready) readyHitIds.add(instance.id);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    nextAction: blockers[0]?.nextAction ?? "Ready to publish and play.",
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
