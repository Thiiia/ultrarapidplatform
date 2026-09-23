import type { LessonPublishReadiness } from "@/lib/guided-authored-encounter";
import { studentCopy } from "@/lib/student-copy";
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
    ? "Pick a song"
    : !contentReady
      ? studentCopy.editor.thingsToFix(readiness.blockers.length)
      : !canPlay
        ? "Play is waiting"
        : !canPublish
          ? "Save is waiting"
          : studentCopy.editor.ready;

  return (
    <aside
      aria-label="Ready check"
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
        <span className={styles.editorReadinessTitle}>{studentCopy.editor.readyCheck}</span>
        <span
          className={`${styles.editorReadinessStatus} experience-status`}
          data-ready={fullyReady ? "true" : "false"}
          data-status={fullyReady ? "success" : "warning"}
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
            {studentCopy.editor.pickSongBeforePlay}
          </div>
        ) : !contentReady ? (
          <div className={styles.editorReadinessBlockers}>
            {readiness.blockers.map((blocker) => {
              const key = `${blocker.encounterId ?? "lesson"}-${blocker.relatedEncounterId ?? ""}-${blocker.code}`;
              const content = <>
                <span>{blocker.message}</span>
                <span>{blocker.nextAction}</span>
              </>;
              return blocker.encounterId ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectEncounter(blocker.encounterId!)}
                  className={styles.editorReadinessBlocker}
                >
                  {content}
                </button>
              ) : (
                <div key={key} className={`${styles.editorReadinessBlocker} ${styles.editorReadinessBlockerStatic}`}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : fullyReady ? (
          <div className={styles.editorReadinessCopy}>{studentCopy.editor.readyToPlay}</div>
        ) : (
          <div className={styles.editorReadinessCopy}>
            {canPublish
              ? studentCopy.editor.gameFilesPreparing
              : studentCopy.editor.finishLoadingBeforeSave}
          </div>
        )}
      </div>
    </aside>
  );
}
