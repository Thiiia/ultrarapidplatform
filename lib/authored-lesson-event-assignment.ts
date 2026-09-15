type GameplayMechanic = "hit" | "spin" | "drag";

type EquationAssignment = {
  id: string;
  tokens: Array<{ id: string; label: string }>;
};

type MechanicInstance = {
  equation?: EquationAssignment | null;
  hitBubbles?: Array<{ tokenIndex: number; targetId?: string }>;
  spinTargets?: Array<{ tokenIndex: number; targetId?: string }>;
  dragTargets?: Array<{ tokenIndex: number; targetId?: string; sourceHitId?: string }>;
};

type TimelineEvent = {
  assignments: Record<GameplayMechanic, EquationAssignment | null>;
  mechanicInstances: Record<GameplayMechanic, MechanicInstance[]>;
};

function cloneEquation<TEquation extends EquationAssignment>(equation: TEquation): TEquation {
  return {
    ...equation,
    tokens: equation.tokens.map((token) => ({ ...token })),
  } as TEquation;
}

function rebindTargets<TTarget extends { tokenIndex: number; targetId?: string }>(
  targets: TTarget[] | undefined,
  equation: EquationAssignment,
) {
  return targets?.map((target) => {
    const reboundTarget = { ...target };
    const targetId = equation.tokens[target.tokenIndex]?.id;
    if (targetId) reboundTarget.targetId = targetId;
    else delete reboundTarget.targetId;
    return reboundTarget;
  });
}

/** Applies one authored equation to every concrete mechanic instance in an event. */
export function applyEquationToEvent<
  TEquation extends EquationAssignment,
  TInstance extends MechanicInstance & { equation?: TEquation | null },
  TEvent extends TimelineEvent & {
    assignments: Record<GameplayMechanic, TEquation | null>;
    mechanicInstances: Record<GameplayMechanic, TInstance[]>;
  },
>(event: TEvent, equation: TEquation): TEvent {
  const applyToMechanic = (mechanic: GameplayMechanic) =>
    event.mechanicInstances[mechanic].map((instance) => ({
      ...instance,
      equation: cloneEquation(equation),
      ...(instance.hitBubbles ? { hitBubbles: rebindTargets(instance.hitBubbles, equation) } : {}),
      ...(instance.spinTargets ? { spinTargets: rebindTargets(instance.spinTargets, equation) } : {}),
      ...(instance.dragTargets ? { dragTargets: rebindTargets(instance.dragTargets, equation) } : {}),
    }));

  return {
    ...event,
    assignments: {
      hit: cloneEquation(equation),
      spin: cloneEquation(equation),
      drag: cloneEquation(equation),
    },
    mechanicInstances: {
      hit: applyToMechanic("hit"),
      spin: applyToMechanic("spin"),
      drag: applyToMechanic("drag"),
    },
  } as TEvent;
}
