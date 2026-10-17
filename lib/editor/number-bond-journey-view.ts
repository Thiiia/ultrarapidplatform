import type { AuthoredTimelineEvent } from "../authored-lesson-serialization";
import type { NumberBondSequenceGem } from "../number-bonds-authored-sequence";

export type NumberBondJourneyStage = Readonly<{
  id: string;
  mechanic: "hit" | "spin" | "drag";
  startSeconds: number;
  endSeconds: number;
}>;

export type NumberBondJourneyView = Readonly<{
  gemId: string;
  unitIndex: number;
  sourceHitId: string | null;
  destination: NumberBondSequenceGem["destination"];
  hit: NumberBondJourneyStage | null;
  spin: NumberBondJourneyStage | null;
  drag: NumberBondJourneyStage | null;
  issues: readonly string[];
}>;

/** Read the editor's song-second timeline through the same stable links Unity consumes.
 * This projection never retimes content or replaces the save/play validators.
 */
export function buildNumberBondJourneyViews(
  gems: readonly NumberBondSequenceGem[],
  events: readonly AuthoredTimelineEvent[],
): NumberBondJourneyView[] {
  const moves = new Map<string, {
    stage: NumberBondJourneyStage;
    sourceHitIds: readonly (string | undefined)[];
  } | null>();
  for (const event of events) {
    for (const mechanic of ["hit", "spin", "drag"] as const) {
      for (const instance of event.mechanicInstances[mechanic]) {
        const startSeconds = instance.tick ?? event.tick;
        const endSeconds = instance.endTick ?? (mechanic === "hit" ? startSeconds : event.endTick ?? startSeconds);
        const valid = Number.isFinite(startSeconds) && startSeconds >= 0 &&
          Number.isFinite(endSeconds) && (mechanic === "hit" ? endSeconds === startSeconds : endSeconds > startSeconds);
        const move = valid ? {
          stage: { id: instance.id, mechanic, startSeconds, endSeconds },
          sourceHitIds: instance.dragTargets.map(target => target.sourceHitId),
        } : null;
        // Duplicate identities must never resolve to whichever row happened to win.
        moves.set(instance.id, moves.has(instance.id) ? null : move);
      }
    }
  }
  const resolve = (id: string, mechanic: NumberBondJourneyStage["mechanic"]) => {
    const move = moves.get(id);
    return move?.stage.mechanic === mechanic ? move : null;
  };
  const references = new Map<string, number>();
  for (const gem of gems) {
    for (const id of [gem.spinEncounterId, gem.dragEncounterId]) references.set(id, (references.get(id) ?? 0) + 1);
  }
  return gems.map(gem => {
    const spin = resolve(gem.spinEncounterId, "spin")?.stage ?? null;
    const dragMove = resolve(gem.dragEncounterId, "drag");
    const sourceHitId = dragMove?.sourceHitIds.length === 1 ? dragMove.sourceHitIds[0] ?? null : null;
    const hit = sourceHitId ? resolve(sourceHitId, "hit")?.stage ?? null : null;
    const drag = dragMove?.stage ?? null;
    const issues: string[] = [];
    if (!hit) issues.push("The source Hit is missing, duplicated or has invalid timing.");
    if (!spin) issues.push("The linked Spin is missing, duplicated or has invalid timing.");
    if (!drag) issues.push("The linked Drag is missing, duplicated or has invalid timing.");
    if ((references.get(gem.spinEncounterId) ?? 0) > 1 || (references.get(gem.dragEncounterId) ?? 0) > 1) {
      issues.push("A linked move is shared by more than one gem.");
    }
    if (hit && spin && drag && (hit.endSeconds >= spin.startSeconds || spin.endSeconds >= drag.startSeconds)) {
      issues.push("The linked moves are out of Hit → Spin → Drag order.");
    }
    return { gemId: gem.gemId, unitIndex: gem.unitIndex, sourceHitId, destination: { ...gem.destination }, hit, spin, drag, issues };
  });
}
