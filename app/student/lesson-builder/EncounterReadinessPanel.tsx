import { useMemo, useState } from "react";
import type { LessonPublishReadiness } from "@/lib/guided-authored-encounter";
import { studentCopy } from "@/lib/student-copy";
import { groupReadinessBlockers, paginateReadinessBlockers } from "./readiness-blocker-list";
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
  const blockerGroups = useMemo(() => groupReadinessBlockers(readiness.blockers), [readiness.blockers]);
  const blockerSetKey = blockerGroups.map(({ key, occurrences }) => `${key}:${occurrences}`).join("|");
  const [blockerPageState, setBlockerPageState] = useState<{ key: string; page: number } | null>(null);
  const requestedBlockerPage = blockerPageState?.key === blockerSetKey ? blockerPageState.page : 0;
  const blockerPage = paginateReadinessBlockers(blockerGroups, requestedBlockerPage);

  const contentReady = readiness.ready;
  const fullyReady = contentReady && hasSong && canPublish && canPlay;
  const statusLabel = !hasSong
    ? "Pick a song"
    : !contentReady
      ? studentCopy.editor.thingsToFix(blockerGroups.length)
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
            {blockerPage.blockers.map(({ key, blocker, occurrences }) => {
              const content = <>
                <span>{blocker.message}</span>
                <span className={styles.editorReadinessBlockerAction}>{blocker.nextAction}</span>
                {occurrences > 1 ? (
                  <span className={styles.editorReadinessBlockerCount}>{occurrences} related issues for this move</span>
                ) : null}
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
            {blockerPage.total > 0 ? (
              <nav className={styles.editorReadinessBlockerPagination} aria-label="Readiness issues">
                <button
                  type="button"
                  disabled={blockerPage.page === 0}
                  onClick={() => setBlockerPageState({ key: blockerSetKey, page: blockerPage.page - 1 })}
                >
                  Previous
                </button>
                <span aria-live="polite" aria-atomic="true">
                  Showing {blockerPage.start}–{blockerPage.end} of {blockerPage.total}
                </span>
                <button
                  type="button"
                  disabled={blockerPage.page >= blockerPage.pageCount - 1}
                  onClick={() => setBlockerPageState({ key: blockerSetKey, page: blockerPage.page + 1 })}
                >
                  Next
                </button>
              </nav>
            ) : null}
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
