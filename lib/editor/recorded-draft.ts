import { LEGACY_AUTHORED_HIT_PADS, PLAYER_HEX_AUTHORED_HIT_PADS, type AuthoredHitPad, type AuthoredHitPadLayoutVersion } from "../authored-hit-pad-layout";

export type RecordedMechanicDraft = {
  id: string;
  mechanic: "hit" | "spin" | "drag";
  /** Authored identity is preserved through recovery, not inferred on save. */
  equationId?: string;
  tick: number;
  endTick?: number;
  hitBubbles: { tokenIndex: number; targetId?: string; positions?: AuthoredHitPad[]; pads?: AuthoredHitPad[]; padLayoutVersion?: AuthoredHitPadLayoutVersion }[];
  spinTargets: { tokenIndex: number }[];
  dragTargets: { tokenIndex: number; sourceHitId?: string }[];
};

const knownPads = new Set<string>([...LEGACY_AUTHORED_HIT_PADS, ...PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad }) => pad)]);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const index = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const optionalString = (value: unknown) => value === undefined || typeof value === "string";
const optionalPads = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(pad => typeof pad === "string" && knownPads.has(pad)));

/** Structural recovery only. Missing gameplay targets remain editable readiness issues. */
export function isRecoverableRecordedDraft(value: unknown): value is RecordedMechanicDraft {
  if (!record(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && (value.mechanic === "hit" || value.mechanic === "spin" || value.mechanic === "drag")
    && typeof value.tick === "number" && Number.isFinite(value.tick) && value.tick >= 0
    && (value.endTick === undefined || (typeof value.endTick === "number" && Number.isFinite(value.endTick) && value.endTick >= value.tick))
    && optionalString(value.equationId)
    && Array.isArray(value.hitBubbles) && value.hitBubbles.every(target => record(target) && index(target.tokenIndex)
      && optionalString(target.targetId) && optionalPads(target.positions) && optionalPads(target.pads)
      && (target.padLayoutVersion === undefined || target.padLayoutVersion === 1 || target.padLayoutVersion === 2))
    && Array.isArray(value.spinTargets) && value.spinTargets.every(target => record(target) && index(target.tokenIndex))
    && Array.isArray(value.dragTargets) && value.dragTargets.every(target => record(target) && index(target.tokenIndex) && optionalString(target.sourceHitId));
}

/** Commit the captured references and times, never the equation selected later. */
export function groupRecordedDrafts<TEquation extends { id: string }>(drafts: readonly RecordedMechanicDraft[], equations: readonly TEquation[]) {
  const materialize = (draft: RecordedMechanicDraft) => ({
    id: draft.id,
    tick: draft.tick,
    ...(draft.equationId ? { equationId: draft.equationId } : {}),
    ...(draft.mechanic === "hit" ? {} : { endTick: draft.endTick ?? draft.tick }),
    equation: equations.find(equation => equation.id === draft.equationId) ?? null,
    hitBubbles: draft.hitBubbles,
    spinTargets: draft.spinTargets,
    dragTargets: draft.dragTargets,
  });
  type Instance = ReturnType<typeof materialize>;
  const mechanicInstances: Record<RecordedMechanicDraft["mechanic"], Instance[]> = { hit: [], spin: [], drag: [] };
  for (const draft of drafts) mechanicInstances[draft.mechanic].push(materialize(draft));
  const sharedEquation = (instances: Instance[]) => {
    const first = instances[0]?.equation;
    return first && instances.every(instance => instance.equation?.id === first.id) ? first : null;
  };
  return {
    mechanicInstances,
    assignments: { hit: sharedEquation(mechanicInstances.hit), spin: sharedEquation(mechanicInstances.spin), drag: sharedEquation(mechanicInstances.drag) },
  };
}
