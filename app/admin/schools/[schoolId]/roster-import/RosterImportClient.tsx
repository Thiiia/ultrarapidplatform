"use client";

import { useState } from "react";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import type { RosterImportSummary } from "@/lib/roster-import";
import styles from "./roster-import.module.css";

type Issue = { row: number; message: string };
type Mode = "additive" | "reconcile";

const template = [
  "student_external_id,student_email,student_name,class_external_id,class_name,teacher_external_id,teacher_email,teacher_name,term",
  "STU-001,alice@example.edu,Alice Smith,MATH-7A,Maths 7A,T-001,teacher@example.edu,Sam Jones,2026",
].join("\n");

const summaryLabels: Record<keyof RosterImportSummary, string> = {
  rows: "CSV rows",
  teachersCreated: "Teachers to create",
  teachersUpdated: "Teachers to update",
  studentsCreated: "Students to create",
  studentsUpdated: "Students to update",
  classesCreated: "Classes to create",
  classesUpdated: "Classes to update",
  enrollmentsAdded: "Enrollments to add",
  enrollmentsRemoved: "Enrollments to remove",
  studentsDeactivated: "Students to deactivate",
};

export default function RosterImportClient({ schoolId }: { schoolId: string }) {
  const [filename, setFilename] = useState("");
  const [csvText, setCsvText] = useState("");
  const [mode, setMode] = useState<Mode>("additive");
  const [summary, setSummary] = useState<RosterImportSummary | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "school-roster-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File | undefined) {
    setSummary(null);
    setIssues([]);
    setMessage("");
    if (!file) {
      setFilename("");
      setCsvText("");
      return;
    }
    setFilename(file.name);
    setCsvText(await file.text());
  }

  async function submit(action: "preview" | "apply") {
    if (!csvText) return;
    if (
      action === "apply" &&
      mode === "reconcile" &&
      !window.confirm("Reconciliation removes missing class enrollments and deactivates missing students. Continue?")
    ) {
      return;
    }

    setBusy(true);
    setIssues([]);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/schools/${schoolId}/roster-import/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csvText,
            filename,
            mode,
            expectedSummary: action === "apply" ? summary : undefined,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setIssues(Array.isArray(result.issues) ? result.issues : []);
        setMessage(typeof result.error === "string" ? result.error : "Request failed.");
        return;
      }
      setSummary(result.summary);
      setMessage(action === "apply" ? `Import ${result.importId} completed.` : "Preview ready. No data has been changed.");
    } catch {
      setMessage("The roster request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <label className={styles.fileButton}>
          <UploadFileOutlined fontSize="small" />
          <span>{filename || "Choose CSV"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
        <button type="button" className={styles.secondaryButton} onClick={downloadTemplate}>
          <DownloadOutlined fontSize="small" />
          Download template
        </button>
      </div>

      <fieldset className={styles.modeGroup}>
        <legend>Import mode</legend>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "additive"}
            onChange={() => { setMode("additive"); setSummary(null); }}
          />
          <span><strong>Additive</strong><small>Add or update records without removing enrollments.</small></span>
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "reconcile"}
            onChange={() => { setMode("reconcile"); setSummary(null); }}
          />
          <span><strong>Full reconciliation</strong><small>Remove missing memberships and deactivate students absent from this roster.</small></span>
        </label>
      </fieldset>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!csvText || busy}
          onClick={() => void submit("preview")}
        >
          Preview changes
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!summary || busy}
          onClick={() => void submit("apply")}
        >
          {busy ? "Working…" : "Apply import"}
        </button>
      </div>

      {message && <p className={issues.length ? styles.errorMessage : styles.message}>{message}</p>}
      {issues.length > 0 && (
        <div className={styles.issueList}>
          {issues.map((issue, index) => (
            <p key={`${issue.row}-${index}`}><strong>Row {issue.row}:</strong> {issue.message}</p>
          ))}
        </div>
      )}
      {summary && (
        <div className={styles.summary}>
          {Object.entries(summary).map(([key, value]) => (
            <div key={key}>
              <span>{summaryLabels[key as keyof RosterImportSummary]}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}