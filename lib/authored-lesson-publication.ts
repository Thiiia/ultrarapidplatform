import {
  AUTHORED_MAX_REQUIRED_HIT_PADS,
  authoredLegacyHitInteractionSignature,
  parseAuthoredLessonDraft,
  validateAuthoredLessonPlayability,
  stampAuthoredLessonIdentity,
  validateAuthoredLessonStopBoundary,
  validateAuthoredRuntimePresentationConcurrency,
} from '@/lib/authored-lesson';
import { isLegacyEncounterSidecar } from '@/lib/legacy-encounters';
import { migrateLegacyEncounterSidecar, repairLegacyMigratedAuthoredLesson } from '@/lib/legacy-authored-migration';
import {
  getActivityAuthoringCapabilities,
  getAuthoredActivityContractIssues,
  validateAuthoredActivityTiming,
} from '@/lib/activity-authoring-capabilities';

export type AuthoredLessonPublication = {
  content: string;
  counts: { equations: number; encounters: number; targets: number };
  migratedFromLegacy: boolean;
};

function legacyHitInteractionSignatures(sidecarContent: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(sidecarContent);
  } catch {
    throw new Error('Existing authored lesson sidecar must contain valid JSON');
  }

  const existing = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(raw));
  const signatures = new Map<string, string>();
  for (const encounter of existing.encounters) {
    if (encounter.type !== 'hit') continue;
    const requiredPads = new Set((encounter.hitBubbles ?? []).flatMap((bubble) => [
      ...(bubble.pads ?? []),
      ...(bubble.positions ?? []),
    ]));
    if (requiredPads.size > AUTHORED_MAX_REQUIRED_HIT_PADS) {
      signatures.set(encounter.id, authoredLegacyHitInteractionSignature(encounter));
    }
  }
  return signatures;
}

/**
 * The sole producer boundary for playable authored content. It rejects legacy
 * companions and stamps server-owned identity immediately before persistence.
 */
export function prepareAuthoredLessonForPublication({
  sidecarContent,
  identity,
  legacyToTickAfterSeconds,
  runtimeClock,
  previousSidecarContent,
}: {
  sidecarContent: string;
  identity: { songAssetId: string; activityKey: string; authorId: string; revision: string };
  legacyToTickAfterSeconds?: (tick: number, seconds: number) => number;
  runtimeClock?: { toSeconds(tick: number): number };
  /** Previous immutable revision, used only to preserve existing legacy HIT shapes. */
  previousSidecarContent?: string;
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
    draft = parseAuthoredLessonDraft(repairLegacyMigratedAuthoredLesson(raw), {
      activityKey: identity.activityKey,
    });
  }
  const activityContractIssue = getAuthoredActivityContractIssues(draft)[0];
  if (activityContractIssue) {
    const encounter = activityContractIssue.encounterId
      ? ` for encounter '${activityContractIssue.encounterId}'`
      : "";
    throw new Error(`${activityContractIssue.code}${encounter}: ${activityContractIssue.message}`);
  }
  const capabilities = getActivityAuthoringCapabilities(identity.activityKey);
  if (capabilities.activityKey === 'number-bonds' && !runtimeClock) {
    throw new Error('Number Bonds publication requires its chart tempo map for runtime timing validation.');
  }
  if (runtimeClock) {
    if (capabilities.activityKey === 'number-bonds') {
      const timingIssue = validateAuthoredActivityTiming(
        capabilities.activityKey,
        draft.encounters.map((encounter) => ({
          id: encounter.id,
          type: encounter.type,
          startSeconds: runtimeClock.toSeconds(encounter.startTick),
        })),
        draft.stopAtSeconds,
      )[0];
      if (timingIssue) {
        const related = timingIssue.relatedEncounterId ? ` (${timingIssue.relatedEncounterId})` : '';
        throw new Error(
          `Number Bonds timing ${timingIssue.code} for encounter '${timingIssue.encounterId}'${related}.`,
        );
      }
    }
    validateAuthoredRuntimePresentationConcurrency(draft.encounters, runtimeClock);
    validateAuthoredLessonPlayability(draft.encounters, runtimeClock, {
      stopAtSeconds: draft.stopAtSeconds,
      legacyHitInteractionSignatures: previousSidecarContent
        ? legacyHitInteractionSignatures(previousSidecarContent)
        : undefined,
    });
    validateAuthoredLessonStopBoundary(draft.encounters, runtimeClock, draft.stopAtSeconds);
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
