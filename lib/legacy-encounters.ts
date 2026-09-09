export type LegacyEncounter = Record<string, unknown> & { tick: number; equationId: string; mechanic: string };
export type LegacyEncounterSidecar = Record<string, unknown> & { version: 1; encounters: LegacyEncounter[] };

export function isLegacyEncounterSidecar(value: unknown): value is LegacyEncounterSidecar {
  return Boolean(value && typeof value === "object" &&
    (value as Record<string, unknown>).version === 1 &&
    Array.isArray((value as Record<string, unknown>).encounters));
}

// These sidecars reference Unity's equation catalogue. They do not contain
// authored token states and must not be converted to authored v3 implicitly.
export function validateLegacyEncounters(value: LegacyEncounterSidecar) {
  let previous = -1;
  for (const row of value.encounters) {
    if (!row || typeof row !== "object" || !Number.isSafeInteger(row.tick) || row.tick < 0) {
      throw new Error("Invalid legacy encounter tick");
    }
    if (row.tick < previous) throw new Error("Legacy encounter ticks must be ordered");
    previous = row.tick;
    if (row.expectedSolveSeconds !== undefined && (typeof row.expectedSolveSeconds !== "number" || !Number.isFinite(row.expectedSolveSeconds) || row.expectedSolveSeconds < 0)) {
      throw new Error("Invalid legacy encounter solve duration");
    }
    if (typeof row.equationId !== "string" || !row.equationId.trim() ||
        typeof row.mechanic !== "string" || !row.mechanic.trim()) {
      throw new Error("Legacy encounter requires its equationId and mechanic");
    }
  }
}

export function persistLegacyEncounters(
  source: LegacyEncounterSidecar,
  slots: Array<{ tick: number; legacyEncounter?: LegacyEncounter }>,
  toTick: (seconds: number) => number,
) {
  const encounters = slots.flatMap(slot => slot.legacyEncounter
    ? [{ ...slot.legacyEncounter, tick: toTick(slot.tick) }] : [])
    .sort((a, b) => a.tick - b.tick);
  const result = { ...source, encounters };
  validateLegacyEncounters(result);
  return result;
}
