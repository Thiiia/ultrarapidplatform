"use client";

import { useMemo, useState } from "react";
import type {
  TeacherAssignableMission,
  TeacherClassStudentListItem,
} from "@/lib/teacher-classes";

type TeacherClassStudentsClientProps = {
  classId: string;
  teacherId: string;
  missions: TeacherAssignableMission[];
  className: string;
  students: TeacherClassStudentListItem[];
  isDemo?: boolean;
};

const textStyle = {
  fontFamily: "Space Grotesk, sans-serif",
} as const;

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M10.8 18.1C14.8317 18.1 18.1 14.8317 18.1 10.8C18.1 6.76832 14.8317 3.5 10.8 3.5C6.76832 3.5 3.5 6.76832 3.5 10.8C3.5 14.8317 6.76832 18.1 10.8 18.1Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.2 16.2L21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TeacherClassStudentsClient({
  classId,
  teacherId,
  missions,
  className,
  students,
  isDemo = false,
}: TeacherClassStudentsClientProps) {
  const [query, setQuery] = useState("");
  const [studentsState, setStudentsState] = useState(students);
  const [selectedMissionByStudent, setSelectedMissionByStudent] = useState<
    Record<string, string>
  >({});
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(
    null,
  );
  const [errorByStudent, setErrorByStudent] = useState<Record<string, string>>(
    {},
  );

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return studentsState;
    }

    return studentsState.filter((student) => {
      return (
        student.name.toLowerCase().includes(normalizedQuery) ||
        student.email.toLowerCase().includes(normalizedQuery) ||
        student.schoolName?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [studentsState, query]);

  const handleAssign = async (studentId: string) => {
    const missionId = selectedMissionByStudent[studentId];

    if (!missionId) {
      setErrorByStudent((previous) => ({
        ...previous,
        [studentId]: "Choose a lesson to assign.",
      }));
      return;
    }

    setAssigningStudentId(studentId);
    setErrorByStudent((previous) => ({ ...previous, [studentId]: "" }));

    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          studentId,
          missionId,
          ...(isDemo ? { demoTeacherId: teacherId } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        assignment?: { id: string; missionId: string };
        error?: string;
      } | null;

      if (!response.ok || !payload?.assignment) {
        throw new Error(payload?.error ?? "Failed to assign lesson.");
      }

      const mission = missions.find((item) => item.id === missionId);

      setStudentsState((previous) =>
        previous.map((student) => {
          if (student.id !== studentId) {
            return student;
          }

          return {
            ...student,
            assignments: [
              ...student.assignments,
              {
                id: payload.assignment!.id,
                missionId,
                missionTitle: mission?.title ?? "Lesson",
                status: "assigned",
              },
            ],
          };
        }),
      );
    } catch (error) {
      setErrorByStudent((previous) => ({
        ...previous,
        [studentId]:
          error instanceof Error ? error.message : "Failed to assign lesson.",
      }));
    } finally {
      setAssigningStudentId(null);
    }
  };

  return (
    <div style={{ width: "100%", ...textStyle }}>
      <div
        style={{
          background: "#2B2B2B",
          border: "1px solid #FFFFFF14",
          borderRadius: 16,
          padding: "22px 24px",
          marginBottom: 18,
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 6px 0",
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: "28px",
          }}
        >
          {className}
        </h1>

        <p
          style={{
            margin: 0,
            color: "#FFFFFFB3",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: "19.5px",
          }}
        >
          Students assigned to this class.
        </p>
      </div>

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
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search students"
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
          border: filteredStudents.length > 0 ? "1px solid #FFFFFF14" : "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student, index) => {
            const isFirst = index === 0;
            const isLast = index === filteredStudents.length - 1;
            const assignedMissionIds = new Set(
              student.assignments.map((assignment) => assignment.missionId),
            );
            const assignableMissions = missions.filter(
              (mission) => !assignedMissionIds.has(mission.id),
            );

            return (
              <div
                key={student.id}
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
                  gap: 12,
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
                    <h2
                      style={{
                        margin: "0 0 4px 0",
                        color: "#FFFFFF",
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: "21px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {student.name}
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        color: "#FFFFFF99",
                        fontSize: 12,
                        fontWeight: 500,
                        lineHeight: "18px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {student.email}
                    </p>
                  </div>

                  <div
                    style={{
                      color: "#FFFFFFB3",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: "18px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {student.schoolName ?? "No school"}
                  </div>
                </div>

                {student.assignments.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {student.assignments.map((assignment) => (
                      <span
                        key={assignment.id}
                        style={{
                          background: "#CFFF041A",
                          color: "#CFFF04",
                          border: "1px solid #CFFF0440",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: "16px",
                        }}
                      >
                        {assignment.missionTitle}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={selectedMissionByStudent[student.id] ?? ""}
                    onChange={(event) =>
                      setSelectedMissionByStudent((previous) => ({
                        ...previous,
                        [student.id]: event.target.value,
                      }))
                    }
                    disabled={assignableMissions.length === 0}
                    style={{
                      flex: "1 1 200px",
                      minWidth: 160,
                      height: 38,
                      background: "#1F1F1F",
                      color: "#FFFFFF",
                      border: "1px solid #FFFFFF1F",
                      borderRadius: 10,
                      padding: "0 10px",
                      fontSize: 13,
                      fontWeight: 500,
                      ...textStyle,
                    }}
                  >
                    <option value="" disabled>
                      {assignableMissions.length > 0
                        ? "Choose a lesson to assign"
                        : "No lessons available"}
                    </option>
                    {assignableMissions.map((mission) => (
                      <option key={mission.id} value={mission.id}>
                        {mission.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleAssign(student.id)}
                    disabled={
                      assigningStudentId === student.id ||
                      assignableMissions.length === 0
                    }
                    style={{
                      height: 38,
                      background: "#CFFF04",
                      color: "#000000",
                      border: "none",
                      borderRadius: 10,
                      padding: "0 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: assigningStudentId === student.id ? 0.6 : 1,
                      ...textStyle,
                    }}
                  >
                    {assigningStudentId === student.id ? "Assigning…" : "Assign"}
                  </button>
                </div>

                {errorByStudent[student.id] && (
                  <p
                    style={{
                      margin: 0,
                      color: "#FF6B6B",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {errorByStudent[student.id]}
                  </p>
                )}
              </div>
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
              lineHeight: "20px",
              textAlign: "center",
            }}
          >
            No students found.
          </div>
        )}
      </div>
    </div>
  );
}