import { parseAuthoredLessonDraft, type AuthoredLessonDraft } from "../authored-lesson";
import {
  serializeAuthoredLesson,
  type AuthoredLessonClock,
  type AuthoredNumberBondSequenceV1,
  type AuthoredSavedEquation,
  type AuthoredTimelineEvent,
} from "../authored-lesson-serialization";

type WorkspaceSource = { songAssetId: string; activityKey: string };

export type LessonWorkspaceRestorePayload = {
  equations?: unknown[];
  hiddenSourceEquationIds?: unknown[];
  timelineEdits?: unknown[];
  recordedDrafts?: unknown[];
  authoredLesson?: unknown;
  updatedAt?: number;
};

/** A recovery copy carries the same complete contract as an explicit save. */
export function readWorkspaceAuthoredLesson(value: unknown, source?: WorkspaceSource): AuthoredLessonDraft | null {
  try {
    const lesson = parseAuthoredLessonDraft(value, { allowEmpty: true });
    if (source && (lesson.songAssetId !== source.songAssetId || lesson.activityKey !== source.activityKey)) return null;
    return lesson;
  } catch {
    return null;
  }
}

/** Incomplete drafts keep their raw timeline; never compact away an unfinished move. */
export function captureAuthoredWorkspaceLesson(input: {
  events: AuthoredTimelineEvent[];
  source: WorkspaceSource & { authorId?: string | null; revision?: string | null };
  clock: AuthoredLessonClock;
  equationQueue: AuthoredSavedEquation[];
  stopAtSeconds?: number;
  numberBondSequenceV1?: AuthoredNumberBondSequenceV1;
}): AuthoredLessonDraft | undefined {
  try {
    let expectedEncounters = 0;
    for (const event of input.events) {
      if ((event as AuthoredTimelineEvent & { legacyEncounter?: unknown }).legacyEncounter) return undefined;
      for (const mechanic of ["hit", "spin", "drag"] as const) {
        const count = event.counts?.[mechanic] ?? 0;
        const instances = event.mechanicInstances?.[mechanic] ?? [];
        if (!Number.isSafeInteger(count) || count < 0 || count !== instances.length) return undefined;
        expectedEncounters += count;
      }
    }
    const draft = serializeAuthoredLesson(input.events, input.source, input.clock, input.stopAtSeconds,
      input.equationQueue, { numberBondSequenceV1: input.numberBondSequenceV1 });
    if (draft.encounters.length !== expectedEncounters) return undefined;
    return readWorkspaceAuthoredLesson(draft, input.source) ?? undefined;
  } catch {
    return undefined;
  }
}

/** An explicit save wins ties and unknown historical timestamps. */
export function shouldRestoreLessonWorkspace(input: {
  demoDraft: { sidecar: string; updatedAt?: number } | null;
  updatedAt?: number;
  authoredLesson?: unknown;
}): boolean {
  if (!input.demoDraft) return true;
  if (!Number.isSafeInteger(input.demoDraft.updatedAt) || !Number.isSafeInteger(input.updatedAt)
      || input.updatedAt! <= input.demoDraft.updatedAt!) return false;
  try {
    const saved = JSON.parse(input.demoDraft.sidecar) as { numberBondSequenceVersion?: unknown };
    // Old Hit-only workspaces cannot replace a complete authored gem journey.
    if (saved.numberBondSequenceVersion === 1
        && readWorkspaceAuthoredLesson(input.authoredLesson)?.numberBondSequenceVersion !== 1) return false;
  } catch {
    return false;
  }
  return true;
}
