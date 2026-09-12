import {
  parseAuthoredLessonDraft,
  stampAuthoredLessonIdentity,
} from '@/lib/authored-lesson';
import { isLegacyEncounterSidecar } from '@/lib/legacy-encounters';
import { migrateLegacyEncounterSidecar, repairLegacyMigratedAuthoredLesson } from '@/lib/legacy-authored-migration';

export type AuthoredLessonPublication = {
  content: string;
  counts: { equations: number; encounters: number; targets: number };
  migratedFromLegacy: boolean;
};

/**
 * The sole producer boundary for playable authored content. It rejects legacy
 * companions and stamps server-owned identity immediately before persistence.
 */
export function prepareAuthoredLessonForPublication({
  sidecarContent,
  identity,
  legacyToTickAfterSeconds,
}: {
  sidecarContent: string;
  identity: { songAssetId: string; activityKey: string; authorId: string; revision: string };
  legacyToTickAfterSeconds?: (tick: number, seconds: number) => number;
}): AuthoredLessonPublication {
  let raw: unknown;
  try {
    raw = JSON.parse(sidecarContent);
  } catch {
    throw new Error('Authored lesson sidecar must contain valid JSON');
  }

  const migratedFromLegacy = isLegacyEncounterSidecar(raw);
  let draft;
  if (isLegacyEncounterSidecar(raw)) {
    if (!legacyToTickAfterSeconds) throw new Error('Legacy authored migration requires a chart tempo map');
    draft = migrateLegacyEncounterSidecar({
      source: raw,
      identity,
      toTickAfterSeconds: legacyToTickAfterSeconds,
    });
  } else {
    draft = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(raw));
  }
  const published = stampAuthoredLessonIdentity(draft, identity);
  const targets = published.encounters.reduce((total, encounter) => {
    const group = encounter.type === 'hit'
      ? encounter.hitBubbles
      : encounter.type === 'spin'
        ? encounter.spinTargets
        : encounter.dragTargets;
    return total + (group?.length ?? 0);
  }, 0);

  return {
    content: JSON.stringify(published, null, 2),
    counts: {
      equations: published.equations.length,
      encounters: published.encounters.length,
      targets,
    },
    migratedFromLegacy,
  };
}
