import type { LessonPublishReadiness } from "@/lib/guided-authored-encounter";
import { useState } from "react";
import { studentCopy } from "@/lib/student-copy";
import styles from "../student.module.css";

const READINESS_BLOCKER_PAGE_SIZE = 25;

export type EncounterReadinessPanelProps = {
  readiness: LessonPublishReadiness;
  hasSong: boolean;
  canPublish: boolean;
  canPlay: boolean;
  onSelectEncounter: (encounterId: string, issueCode: string) => void;
  onCreateEncounter?: () => void;
  onFixFirstTimingIssue?: () => void;
  isOpen: boolean;
  onToggle: () => void;
};

export function EncounterReadinessPanel({
  readiness,
  hasSong,
  canPublish,
  canPlay,
  onSelectEncounter,
  onCreateEncounter,
  onFixFirstTimingIssue,
  isOpen,
  onToggle,
}: EncounterReadinessPanelProps) {
  const firstBlocker = readiness.blockers[0];
  const otherBlockerCount = Math.max(0, readiness.blockers.length - 1);
  const blockerSetKey = `${readiness.blockers.length}:${firstBlocker?.encounterId ?? ""}:${firstBlocker?.relatedEncounterId ?? ""}:${firstBlocker?.code ?? ""}`;
  const [otherBlockerPageState, setOtherBlockerPageState] = useState({ blockerSetKey: "", page: 0 });
  const otherBlockerPageCount = Math.max(1, Math.ceil(otherBlockerCount / READINESS_BLOCKER_PAGE_SIZE));
  const otherBlockerPage = Math.min(
    otherBlockerPageState.blockerSetKey === blockerSetKey ? otherBlockerPageState.page : 0,
    otherBlockerPageCount - 1,
  );
  const otherBlockerStartIndex = otherBlockerPage * READINESS_BLOCKER_PAGE_SIZE;
  const visibleOtherBlockers = readiness.blockers.slice(
    otherBlockerStartIndex + 1,
    otherBlockerStartIndex + 1 + READINESS_BLOCKER_PAGE_SIZE,
  );
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
            {studentCopy.editor.pickSongBeforePlay}
          </div>
        ) : !contentReady ? (
          <div className={styles.editorReadinessBlockers}>
            <div className={styles.editorReadinessCopy}>Fix one thing at a time. Start here:</div>
            {firstBlocker ? [firstBlocker].map((blocker) => blocker.encounterId ? (
              <button
                key={`${blocker.encounterId}-${blocker.relatedEncounterId ?? ""}-${blocker.code}`}
                type="button"
                onClick={() => onSelectEncounter(blocker.encounterId, blocker.code)}
                className={styles.editorReadinessBlocker}
              >
                <span>{blocker.message}</span>
                {blocker.nextAction !== blocker.message ? <span>{blocker.nextAction}</span> : null}
              </button>
            ) : (
              blocker.code === "lesson_encounter_required" && onCreateEncounter ? (
                <button key={blocker.code} type="button" onClick={onCreateEncounter} className={styles.editorReadinessBlocker}>
                  <span>{blocker.message}</span><span>Add a Hit at the playhead</span>
                </button>
              ) : <div key={blocker.code} className={styles.editorReadinessBlocker} role="status">
                <span>{blocker.message}</span>
                {blocker.nextAction !== blocker.message ? <span>{blocker.nextAction}</span> : null}
              </div>
            )) : null}
            {firstBlocker?.code === "activity_hit_spacing" && onFixFirstTimingIssue ? (
              <button
                type="button"
                onClick={onFixFirstTimingIssue}
                className={styles.editorReadinessBlocker}
              >
                Move this catch cue for me
              </button>
            ) : null}
            {otherBlockerCount > 0 ? (
              <details>
                <summary>{`See ${otherBlockerCount} more ${otherBlockerCount === 1 ? "thing" : "things"} to fix`}</summary>
                {visibleOtherBlockers.map((blocker, index) => blocker.encounterId ? (
                  <button
                    key={`${blocker.encounterId}-${blocker.relatedEncounterId ?? ""}-${blocker.code}-${otherBlockerStartIndex + index + 1}`}
                    type="button"
                    onClick={() => {
                      setOtherBlockerPageState({ blockerSetKey, page: 0 });
                      onSelectEncounter(blocker.encounterId, blocker.code);
                    }}
                    className={styles.editorReadinessBlocker}
                  >
                    <span>{blocker.message}</span>
                    {blocker.nextAction !== blocker.message ? <span>{blocker.nextAction}</span> : null}
                  </button>
                ) : (
                  <div key={`${blocker.code}-${otherBlockerStartIndex + index + 1}`} className={styles.editorReadinessBlocker} role="status">
                    <span>{blocker.message}</span>
                    {blocker.nextAction !== blocker.message ? <span>{blocker.nextAction}</span> : null}
                  </div>
                ))}
                {otherBlockerCount > READINESS_BLOCKER_PAGE_SIZE ? (
                  <nav className={styles.editorReadinessPagination} aria-label="Readiness blocker pages">
                    <button
                      type="button"
                      disabled={otherBlockerPage === 0}
                      onClick={() => setOtherBlockerPageState({ blockerSetKey, page: Math.max(0, otherBlockerPage - 1) })}
                    >
                      Previous
                    </button>
                    <span aria-live="polite">
                      {`Showing ${otherBlockerStartIndex + 1}–${Math.min(otherBlockerStartIndex + visibleOtherBlockers.length, otherBlockerCount)} of ${otherBlockerCount} remaining issues`}
                    </span>
                    <button
                      type="button"
                      disabled={otherBlockerPage >= otherBlockerPageCount - 1}
                      onClick={() => setOtherBlockerPageState({ blockerSetKey, page: Math.min(otherBlockerPageCount - 1, otherBlockerPage + 1) })}
                    >
                      Next
                    </button>
                  </nav>
                ) : null}
              </details>
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
