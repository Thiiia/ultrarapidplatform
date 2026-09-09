import { isLegacyEncounterSidecar, validateLegacyEncounters } from "./legacy-encounters";

export function countLegacySidecar(value: unknown): { encounters: number; equations: number; targets: number } {
  if (!value || typeof value !== "object") {
    throw new Error("Authored sidecar uses an unsupported sidecar format");
  }

  const payload = value as Record<string, unknown>;
  if (isLegacyEncounterSidecar(payload)) {
    validateLegacyEncounters(payload);
    const additional = payload.events === undefined
      ? { encounters: 0, equations: 0, targets: 0 }
      : countLegacySidecar({ version: 1, events: payload.events });
    return {
      encounters: payload.encounters.length + additional.encounters,
      equations: new Set(payload.encounters.map(row => row.equationId)).size + additional.equations,
      // Legacy mechanics resolve targets from the runtime equation catalogue.
      targets: additional.targets,
    };
  }
  if (payload.version === 1 && Array.isArray(payload.events)) {
    let encounters = 0;
    let targets = 0;
    const equations = new Set<string>();

    for (const rawEvent of payload.events) {
      if (!rawEvent || typeof rawEvent !== "object") continue;
      const event = rawEvent as Record<string, unknown>;
      if (event.type === "ALG_EQUATION_STATE") {
        if (typeof event.equationId === "string") equations.add(event.equationId);
        continue;
      }
      if (event.type !== "ALG_MECHANIC") continue;

      encounters += 1;
      const mechanic = event.mechanic;
      const targetField = mechanic === "hit"
        ? "hitBubbles"
        : mechanic === "spin"
          ? "spinTargets"
          : mechanic === "drag"
            ? "dragTargets"
            : null;
      if (targetField && Array.isArray(event[targetField])) {
        targets += event[targetField].length;
      }
    }

    return { encounters, equations: equations.size, targets };
  }

  if (payload.version === 2 && Array.isArray(payload.equations)) {
    let encounters = 0;
    let targets = 0;

    for (const rawEquation of payload.equations) {
      if (!rawEquation || typeof rawEquation !== "object") continue;
      const equation = rawEquation as Record<string, unknown>;
      const counts = equation.counts && typeof equation.counts === "object"
        ? equation.counts as Record<string, unknown>
        : {};

      for (const mechanic of ["hit", "spin", "drag"] as const) {
        const instances = equation[`${mechanic}s`];
        const count = counts[mechanic] ?? counts[`${mechanic}s`] ?? (Array.isArray(instances) ? instances.length : 0);
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
          throw new Error("Legacy sidecar has an invalid mechanic count");
        }
        encounters += count;
        if (!Array.isArray(instances)) continue;
        const targetField = mechanic === "hit" ? "bubbles" : "targets";
        targets += instances.reduce((sum, rawInstance) => {
          if (!rawInstance || typeof rawInstance !== "object") return sum;
          const instance = rawInstance as Record<string, unknown>;
          const targetList = instance[targetField];
          return sum + (Array.isArray(targetList) ? targetList.length : 0);
        }, 0);
      }
    }

    return { encounters, equations: payload.equations.length, targets };
  }

  throw new Error("Authored sidecar uses an unsupported sidecar format");
}
