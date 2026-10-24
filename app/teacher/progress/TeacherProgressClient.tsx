"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TeacherClassListItem } from "@/lib/teacher-classes";
import type { StudentProgressSummary } from "@/lib/teacher-progress";

const textStyle = { fontFamily: "Space Grotesk, sans-serif" } as const;

const ACTIVITY_LABELS: Record<string, string> = {
  "number-bonds": "Number Bonds",
  equations: "Equations",
  "missing-numbers": "Missing Numbers",
  "early-algebra": "Early Algebra",
};

function activityLabel(key: string) {
  return ACTIVITY_LABELS[key] ?? key;
}

function formatDateTime(value: string | Date | null) {
  if (!value) {
    return "Never";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) + " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        background: "#191919",
        border: "1px solid #FFFFFF14",
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: "#FFFFFF",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{label}: </span>
      {value}
    </span>
  );
}

function latestRunStateLabel(state: StudentProgressSummary["latestRun"]["state"]) {
  const labels: Record<StudentProgressSummary["latestRun"]["state"], string> = {
    "completed": "Completed outcome (V2/V3 payload)",
    "unverified-completion": "Completed outcome (version unverified)",
    "failed": "Failed outcome",
    "abandoned": "Abandoned outcome",
    "cancelled": "Cancelled outcome",
    "unclassified": "Other saved outcome",
    "no-saved-result": "No linked outcome",
  };
  return labels[state];
}

function latestRunMathLabel(solvedSets: number | null) {
  if (solvedSets === null) return "not reported";
  return `${solvedSets} set${solvedSets === 1 ? "" : "s"} solved`;
}

function latestRunRhythmLabel(completedEvents: number | null, requiredEvents: number | null) {
  if (completedEvents === null) return "not reported";
  if (requiredEvents === null) return `${completedEvents} completed · total not reported`;
  return `${completedEvents}/${requiredEvents} authored encounters`;
}

function latestRunTimingLabel(judgements: StudentProgressSummary["latestRun"]["timingJudgements"]) {
  if (!judgements) return "Not reported";
  return `Perfect ${judgements.perfect} · Good ${judgements.good} · Early ${judgements.early} · Late ${judgements.late} · Miss ${judgements.miss}`;
}

function ClassPicker({
  classes,
  navBasePath,
}: {
  classes: TeacherClassListItem[];
  navBasePath: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return classes;
    }
    return classes.filter((classItem) => classItem.name.toLowerCase().includes(normalized));
  }, [classes, query]);

  return (
    <div style={{ width: "100%", ...textStyle }}>
      <label
        style={{
          height: 46,
          background: "#2B2B2B",
          border: "1px solid #FFFFFF14",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          boxSizing: "border-box",
          color: "#FFFFFF99",
          marginBottom: 18,
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search classes"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: "20px",
            ...textStyle,
          }}
        />
      </label>

      <div
        style={{
          width: "100%",
          borderRadius: 14,
          border: filtered.length > 0 ? "1px solid #FFFFFF14" : "none",
        }}
      >
        {filtered.length > 0 ? (
          filtered.map((classItem, index) => {
            const isFirst = index === 0;
            const isLast = index === filtered.length - 1;

            return (
              <Link
                key={classItem.id}
                href={`${navBasePath}/progress?classId=${classItem.id}`}
                style={{
                  minHeight: 72,
                  background: "#2B2B2B",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 18px",
                  boxSizing: "border-box",
                  borderBottom: isLast ? "none" : "1px solid #FFFFFF14",
                  borderTopLeftRadius: isFirst ? 14 : 0,
                  borderTopRightRadius: isFirst ? 14 : 0,
                  borderBottomLeftRadius: isLast ? 14 : 0,
                  borderBottomRightRadius: isLast ? 14 : 0,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      margin: "0 0 4px 0",
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontWeight: 700,
                      lineHeight: "21px",
                    }}
                  >
                    {classItem.name}
                  </h2>
                  <p style={{ margin: 0, color: "#FFFFFF99", fontSize: 12, fontWeight: 500 }}>
                    {classItem.description ?? "View student activity and progress"}
                  </p>
                </div>
                <div
                  style={{
                    color: "#FFFFFFB3",
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {classItem.studentCount} student{classItem.studentCount === 1 ? "" : "s"}
                </div>
              </Link>
            );
          })
        ) : (
          <div
            style={{
              background: "#2B2B2B",
              border: "1px solid #FFFFFF14",
              borderRadius: 14,
              padding: 24,
              color: "#FFFFFF99",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            No classes found.
          </div>
        )}
      </div>
    </div>
  );
}

function StudentActivityRow({
  student,
  isFirst,
  isLast,
}: {
  student: StudentProgressSummary;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        background: "#2B2B2B",
        color: "#FFFFFF",
        padding: "16px 18px",
        boxSizing: "border-box",
        borderBottom: isLast ? "none" : "1px solid #FFFFFF14",
        borderTopLeftRadius: isFirst ? 14 : 0,
        borderTopRightRadius: isFirst ? 14 : 0,
        borderBottomLeftRadius: isLast ? 14 : 0,
        borderBottomRightRadius: isLast ? 14 : 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 4px 0", color: "#FFFFFF", fontSize: 15, fontWeight: 700 }}>
            {student.name}
          </h2>
          <p style={{ margin: 0, color: "#FFFFFF99", fontSize: 12, fontWeight: 500 }}>
            {student.email}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#FFFFFFB3", fontSize: 12, fontWeight: 700 }}>
            Last on site: {formatDateTime(student.lastLoginAt)}
          </div>
          <div style={{ color: "#FFFFFFB3", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
            Last played:{" "}
            {student.lastPlayed
              ? `${activityLabel(student.lastPlayed.activityKey)} (${student.lastPlayed.songTitle}) · ${formatDateTime(student.lastPlayed.playedAt)}`
              : "Never"}
          </div>
        </div>
      </div>

      <div
        aria-label={`Latest saved learning progress for ${student.name}`}
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#191919",
          border: "1px solid #FFFFFF14",
          color: "#FFFFFFB3",
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: "#FFFFFF" }}>Latest saved outcome:</strong> {latestRunStateLabel(student.latestRun.state)}
        {student.latestRun.resultSaved ? (
          <>
            {" · "}<strong style={{ color: "#FFFFFF" }}>Math:</strong> {latestRunMathLabel(student.latestRun.solvedSets)}
            {" · "}<strong style={{ color: "#FFFFFF" }}>Rhythm:</strong> {latestRunRhythmLabel(student.latestRun.completedEvents, student.latestRun.requiredEvents)}
            {student.latestRun.completedEvents !== null &&
              student.latestRun.requiredEvents !== null &&
              student.latestRun.requiredEvents > student.latestRun.completedEvents && (
                <> · {student.latestRun.requiredEvents - student.latestRun.completedEvents} encounters not yet recorded</>
              )}
            {" · Result saved"}
          </>
        ) : (
          <> · No saved outcome is linked to this latest launch</>
        )}
      </div>

      <details style={{ marginTop: 8, color: "#FFFFFFB3", fontSize: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, padding: "6px 0" }}>
          Saved run details
        </summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
          <StatChip label="Game launches" value={String(student.totalAttempts)} />
          <StatChip label="Completed outcomes (V2/V3)" value={String(student.completedCount)} />
          {student.unverifiedCompletedCount > 0 && (
            <StatChip label="Other-version completed outcomes" value={String(student.unverifiedCompletedCount)} />
          )}
          <StatChip label="Failed" value={String(student.failedCount)} />
          <StatChip label="Abandoned" value={String(student.abandonedCount)} />
          <StatChip label="Cancelled" value={String(student.cancelledCount)} />
          {student.unclassifiedOutcomeCount > 0 && (
            <StatChip label="Unclassified outcomes" value={String(student.unclassifiedOutcomeCount)} />
          )}
          <StatChip label="Recorded events across saved runs" value={String(student.completedEvents)} />
          <StatChip label="Hit attempts across saved runs" value={String(student.hitAttempts)} />
          {student.latestRun.resultSaved && student.latestRun.hitAttempts !== null && (
            <StatChip label="Latest run hit attempts" value={String(student.latestRun.hitAttempts)} />
          )}
          {student.latestRun.resultSaved && (
            <>
              <StatChip label="Authored timing" value={latestRunTimingLabel(student.latestRun.timingJudgements)} />
              <p style={{ flexBasis: "100%", margin: 0 }}>
                Assistance and interruption details are not included in this saved outcome.
              </p>
            </>
          )}
          {student.attemptsByActivity.map((stat) => (
            <StatChip
              key={stat.activityKey}
              label={activityLabel(stat.activityKey)}
              value={`${stat.attempts} launch${stat.attempts === 1 ? "" : "es"}`}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

export default function TeacherProgressClient({
  classes,
  selectedClass,
  navBasePath,
}: {
  classes: TeacherClassListItem[];
  selectedClass: { id: string; name: string; students: StudentProgressSummary[] } | null;
  navBasePath: string;
}) {
  if (!selectedClass) {
    return <ClassPicker classes={classes} navBasePath={navBasePath} />;
  }

  return (
    <div style={{ width: "100%", ...textStyle }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px 0", color: "#FFFFFF", fontSize: 20, fontWeight: 700 }}>
            {selectedClass.name}
          </h1>
          <p style={{ margin: 0, color: "#FFFFFFB3", fontSize: 13, fontWeight: 500 }}>
            Recent game activity and saved progress for each student.
          </p>
        </div>

        {classes.length > 1 && (
          <Link
            href={`${navBasePath}/progress`}
            style={{
              color: "#CFFF04",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Change class
          </Link>
        )}
      </div>

      <div
        style={{
          width: "100%",
          borderRadius: 14,
          border: selectedClass.students.length > 0 ? "1px solid #FFFFFF14" : "none",
        }}
      >
        {selectedClass.students.length > 0 ? (
          selectedClass.students.map((student, index) => (
            <StudentActivityRow
              key={student.id}
              student={student}
              isFirst={index === 0}
              isLast={index === selectedClass.students.length - 1}
            />
          ))
        ) : (
          <div
            style={{
              background: "#2B2B2B",
              border: "1px solid #FFFFFF14",
              borderRadius: 14,
              padding: 24,
              color: "#FFFFFF99",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            No students in this class yet.
          </div>
        )}
      </div>
    </div>
  );
}
