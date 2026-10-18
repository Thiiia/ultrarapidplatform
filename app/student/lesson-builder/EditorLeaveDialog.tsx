"use client";

import { useEffect, useId, useRef, useState } from "react";
import { studentCopy } from "@/lib/student-copy";
import styles from "./EditorLeaveDialog.module.css";

/** Shared by both activities. The browser owns modality and focus containment. */
export function EditorLeaveDialog({ isSaving, failureMessage, onSaveAndLeave, onLeaveWithoutSaving, onStay }: {
  isSaving: boolean;
  failureMessage: string;
  onSaveAndLeave: () => Promise<boolean>;
  onLeaveWithoutSaving: () => void;
  onStay: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unexpectedFailure, setUnexpectedFailure] = useState(false);
  const id = useId();
  const busy = isSaving || pending;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    active.current = true;
    dialog?.showModal();
    stayRef.current?.focus();
    return () => {
      active.current = false;
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (failed && !busy) saveRef.current?.focus();
  }, [failed, busy]);

  async function save() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    setUnexpectedFailure(false);
    try {
      const saved = await onSaveAndLeave();
      if (active.current) setFailed(!saved);
    } catch {
      if (active.current) { setUnexpectedFailure(true); setFailed(true); }
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-body${failed ? ` ${id}-error` : ""}`} aria-busy={busy}
    data-phase={busy ? "saving" : failed ? "error" : "unsaved"}
    onCancel={event => { event.preventDefault(); if (!busy && !inFlight.current) onStay(); }}>
    <div className={styles.content}>
      <h2 id={`${id}-title`}>{studentCopy.editor.unsavedTitle}</h2>
      <p id={`${id}-body`}>{studentCopy.editor.unsavedBody}</p>
      <p className={styles.saveState} role="status">{busy ? "Saving your lesson. Keep this page open…" : "Your changes stay here while you decide."}</p>
      {failed ? <p id={`${id}-error`} className={styles.error} role="alert">
        {(!unexpectedFailure && failureMessage) || "Your lesson could not be saved. Try again, or keep editing. Your changes are still here."}
      </p> : null}
      <div className={styles.actions}>
        <button ref={stayRef} type="button" disabled={busy} onClick={() => { if (!inFlight.current) onStay(); }}>{studentCopy.editor.keepEditing}</button>
        <button type="button" className={styles.discard} disabled={busy} onClick={() => { if (!inFlight.current) onLeaveWithoutSaving(); }}>{studentCopy.editor.leaveWithoutSaving}</button>
        <button ref={saveRef} type="button" className={styles.save} disabled={busy} onClick={() => { void save(); }}>
          {busy ? "Saving…" : failed ? "Try saving again" : studentCopy.editor.saveAndLeave}
        </button>
      </div>
    </div>
  </dialog>;
}
