import {
  parseAuthoredLessonDraft,
  stampAuthoredLessonIdentity,
} from '@/lib/authored-lesson';

export type AuthoredLessonPublication = {
  content: string;
  counts: { equations: number; encounters: number; targets: number };
};

/**
 * The sole producer boundary for playable authored content. It rejects legacy
 * companions and stamps server-owned identity immediately before persistence.
 */
export function prepareAuthoredLessonForPublication({
  sidecarContent,
  identity,
}: {
  sidecarContent: string;
  identity: { songAssetId: string; activityKey: string; authorId: string; revision: string };
}): AuthoredLessonPublication {
  let raw: unknown;
  try {
    raw = JSON.parse(sidecarContent);
  } catch {
    throw new Error('Authored lesson sidecar must contain valid JSON');
  }

  const published = stampAuthoredLessonIdentity(
    parseAuthoredLessonDraft(raw),
    identity,
  );
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
  };
}
