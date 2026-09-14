import type { LessonPublishReadiness } from "@/lib/guided-authored-encounter";
import styles from "../student.module.css";

export type EncounterReadinessPanelProps = {
  readiness: LessonPublishReadiness;
  hasSong: boolean;
  canPublish: boolean;
  canPlay: boolean;
  onSelectEncounter: (encounterId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
};

export function EncounterReadinessPanel({
  readiness,
  hasSong,
  canPublish,
  canPlay,
  onSelectEncounter,
  isOpen,
  onToggle,
}: EncounterReadinessPanelProps) {
  const contentReady = readiness.ready;
  const fullyReady = contentReady && hasSong && canPublish && canPlay;
  const statusLabel = !hasSong
    ? "Choose a song"
    : !contentReady
      ? `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? "" : "s"}`
      : !canPlay
        ? "Play unavailable"
        : !canPublish
          ? "Publish unavailable"
          : "Ready";

  return (
    <aside
      aria-label="Encounter readiness"
      className={`${styles.editorReadiness} ${isOpen ? styles.editorReadinessOpen : ""}`}
      data-open={isOpen ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.editorReadinessToggle}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="lesson-readiness-details"
      >
        <span className={styles.editorReadinessTitle}>Lesson check</span>
        <span
          className={styles.editorReadinessStatus}
          data-ready={fullyReady ? "true" : "false"}
        >
          {statusLabel}
        </span>
        <span className={styles.editorReadinessChevron} aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      <div
        id="lesson-readiness-details"
        className={styles.editorReadinessDetails}
        hidden={!isOpen}
      >
        {!hasSong ? (
          <div className={styles.editorReadinessCopy}>
            Choose a song before publishing or playing this lesson.
          </div>
        ) : !contentReady ? (
          <div className={styles.editorReadinessBlockers}>
            {readiness.blockers.map((blocker) => (
              <button
                key={`${blocker.encounterId}-${blocker.code}`}
                type="button"
                onClick={() => onSelectEncounter(blocker.encounterId)}
                className={styles.editorReadinessBlocker}
              >
                <span>{blocker.message}</span>
                <span>{blocker.nextAction}</span>
              </button>
            ))}
          </div>
        ) : fullyReady ? (
          <div className={styles.editorReadinessCopy}>Publish and Play are available.</div>
        ) : (
          <div className={styles.editorReadinessCopy}>
            {canPublish
              ? "Publishing is available, but Play is waiting for the song files."
              : "Finish loading the selected lesson before publishing."}
          </div>
        )}
      </div>
    </aside>
  );
}
