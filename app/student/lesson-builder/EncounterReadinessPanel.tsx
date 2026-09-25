import { useEffect, useMemo, useRef, useState } from "react";
import type { EncounterMoveProposal, LessonPublishReadiness } from "@/lib/guided-authored-encounter";
import { studentCopy } from "@/lib/student-copy";
import { groupReadinessBlockers, paginateReadinessBlockers } from "./readiness-blocker-list";
import styles from "../student.module.css";

export type EncounterReadinessPanelProps = {
  readiness: LessonPublishReadiness;
  hasSong: boolean;
  canPublish: boolean;
  canPlay: boolean;
  onSelectEncounter: (encounterId: string, issueCode: string) => void;
  onCreateEncounter?: () => void;
  timingRepairPreview?: EncounterMoveProposal | null;
  onPreviewTimingRepair?: () => void;
  onApplyTimingRepair?: () => void;
  onCancelTimingRepair?: () => void;
  onUndoTimingRepair?: () => void;
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
  timingRepairPreview,
  onPreviewTimingRepair,
  onApplyTimingRepair,
  onCancelTimingRepair,
  onUndoTimingRepair,
  isOpen,
  onToggle,
}: EncounterReadinessPanelProps) {
  const blockerGroups = useMemo(() => groupReadinessBlockers(readiness.blockers), [readiness.blockers]);
  const blockerSetKey = blockerGroups.map(({ key, occurrences }) => `${key}:${occurrences}`).join("|");
  const [blockerPageState, setBlockerPageState] = useState<{ key: string; page: number } | null>(null);
  const requestedBlockerPage = blockerPageState?.key === blockerSetKey ? blockerPageState.page : 0;
  const blockerPage = paginateReadinessBlockers(blockerGroups, requestedBlockerPage);
  const firstBlocker = blockerPage.page === 0 ? blockerPage.blockers[0]?.blocker : undefined;
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const focusPreviewAfterCancel = useRef(false);
  const focusUndoAfterApply = useRef(false);

  useEffect(() => {
    if (timingRepairPreview) return;
    if (focusPreviewAfterCancel.current) {
      focusPreviewAfterCancel.current = false;
      previewButtonRef.current?.focus();
      return;
    }
    if (focusUndoAfterApply.current && onUndoTimingRepair) {
      focusUndoAfterApply.current = false;
      undoButtonRef.current?.focus();
      return;
    }
    if (focusUndoAfterApply.current) {
      focusUndoAfterApply.current = false;
      previewButtonRef.current?.focus();
    }
  }, [timingRepairPreview, onUndoTimingRepair]);

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
            <div className={styles.editorReadinessCopy}>Fix one thing at a time. Start with the first issue below.</div>
            {blockerPage.blockers.map(({ key, blocker, occurrences }) => {
              const content = <>
                <span>{blocker.message}</span>
                <span className={styles.editorReadinessBlockerAction}>{blocker.nextAction}</span>
                {blocker.conflictIntervals?.length ? (
                  <span aria-label="Occupied cue intervals" className={styles.editorReadinessBlockerCount}>
                    {blocker.conflictIntervals.map((interval) =>
                      `${interval.label} ${interval.startSeconds.toFixed(2)}–${interval.endSeconds.toFixed(2)}s`,
                    ).join(" · ")}
                  </span>
                ) : null}
                {blocker.code === "unsupported_concurrency" &&
                  Number.isFinite(blocker.conflictStartSeconds) && Number.isFinite(blocker.conflictEndSeconds) ? (
                    <span className={styles.editorReadinessBlockerCount}>
                      Overlap {blocker.conflictStartSeconds!.toFixed(2)}–{blocker.conflictEndSeconds!.toFixed(2)}s
                    </span>
                  ) : null}
                {Number.isFinite(blocker.earliestSafeStartSeconds) ? (
                  <span className={styles.editorReadinessBlockerCount}>
                    Next safe beat starts at or after {blocker.earliestSafeStartSeconds!.toFixed(2)}s
                  </span>
                ) : null}
                {occurrences > 1 ? (
                  <span className={styles.editorReadinessBlockerCount}>{occurrences} related issues for this move</span>
                ) : null}
              </>;
              return blocker.encounterId ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectEncounter(blocker.encounterId!, blocker.code)}
                  className={styles.editorReadinessBlocker}
                >
                  {content}
                </button>
              ) : (
                blocker.code === "lesson_encounter_required" && onCreateEncounter ? (
                  <button key={key} type="button" onClick={onCreateEncounter} className={styles.editorReadinessBlocker}>
                    <span>{blocker.message}</span>
                    <span className={styles.editorReadinessBlockerAction}>Add a Hit at the playhead</span>
                  </button>
                ) : <div key={key} className={`${styles.editorReadinessBlocker} ${styles.editorReadinessBlockerStatic}`}>
                    {content}
                  </div>
              );
            })}
            {firstBlocker && [
              "unsupported_concurrency",
              "activity_hit_spacing",
              "gem_spacing",
              "simultaneous_hits",
              "drag_source_not_earlier",
            ].includes(firstBlocker.code) && onPreviewTimingRepair && !timingRepairPreview ? (
              <button ref={previewButtonRef} type="button" onClick={onPreviewTimingRepair} className={styles.editorReadinessBlocker}>
                Preview move to next clear beat
              </button>
            ) : null}
            {timingRepairPreview ? (
              <section aria-label="Timing repair preview" className={styles.editorReadinessBlocker}>
                <strong>Preview: move {timingRepairPreview.patches.length} cue{timingRepairPreview.patches.length === 1 ? "" : "s"}</strong>
                <ul>
                  {timingRepairPreview.patches.map((patch) => (
                    <li key={patch.encounterId}>
                      {patch.mechanic} cue {patch.fromSeconds.toFixed(2)}s → {patch.toSeconds.toFixed(2)}s
                      {patch.mechanic === "hit" ? "" : ` (duration ${Math.max(0, patch.fromEndSeconds - patch.fromSeconds).toFixed(2)}s preserved)`}
                    </li>
                  ))}
                </ul>
                <span aria-live="polite" aria-atomic="true">
                  {timingRepairPreview.readiness.ready
                    ? "Readiness checks pass after these moves."
                    : `${timingRepairPreview.readiness.blockers.length} readiness issue${timingRepairPreview.readiness.blockers.length === 1 ? " remains" : "s remain"} after these moves; review before publishing.`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    focusUndoAfterApply.current = true;
                    onApplyTimingRepair?.();
                  }}
                  className={styles.editorReadinessBlocker}
                >
                  Apply previewed moves
                </button>
                <button
                  type="button"
                  onClick={() => {
                    focusUndoAfterApply.current = false;
                    focusPreviewAfterCancel.current = true;
                    onCancelTimingRepair?.();
                  }}
                  className={styles.editorReadinessBlocker}
                >
                  Cancel preview
                </button>
              </section>
            ) : null}
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
        {!timingRepairPreview && onUndoTimingRepair ? (
          <button ref={undoButtonRef} type="button" onClick={onUndoTimingRepair} className={styles.editorReadinessBlocker}>
            Undo last timing repair
          </button>
        ) : null}
      </div>
    </aside>
  );
}
