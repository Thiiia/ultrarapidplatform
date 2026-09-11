type GameplayMechanic = "hit" | "spin" | "drag";

type EquationAssignment = {
  id: string;
  tokens: Array<{ id: string; label: string }>;
};

type MechanicInstance = {
  equation?: EquationAssignment | null;
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
