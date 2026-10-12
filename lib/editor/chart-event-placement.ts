export type ChartMechanicCounts = {
  hit: number;
  spin: number;
  drag: number;
};

type ChartEventForAppend<TInstance> = {
  id: string;
  tick: number;
  counts: ChartMechanicCounts;
  mechanicInstances: {
    hit: TInstance[];
    spin: TInstance[];
    drag: TInstance[];
  };
};

/** Add new actions to an occupied chart tick while preserving its authored identity and assignments. */
export function appendChartActionsToEvent<T extends ChartEventForAppend<unknown>>(
  existing: T,
  incoming: Pick<T, "counts" | "mechanicInstances">,
): T {
  return {
    ...existing,
    counts: {
      hit: existing.counts.hit + incoming.counts.hit,
      spin: existing.counts.spin + incoming.counts.spin,
      drag: existing.counts.drag + incoming.counts.drag,
    },
    mechanicInstances: {
      hit: [...existing.mechanicInstances.hit, ...incoming.mechanicInstances.hit],
      spin: [...existing.mechanicInstances.spin, ...incoming.mechanicInstances.spin],
      drag: [...existing.mechanicInstances.drag, ...incoming.mechanicInstances.drag],
    },
  } as T;
}
