"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TeacherClassListItem } from "@/lib/teacher-classes";

type TeacherClassesClientProps = {
  classes: TeacherClassListItem[];
  navBasePath: string;
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

export default function TeacherClassesClient({
  classes,
  navBasePath,
}: TeacherClassesClientProps) {
  const [query, setQuery] = useState("");

  const filteredClasses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return classes;
    }

    return classes.filter((classItem) => {
      return (
        classItem.name.toLowerCase().includes(normalizedQuery) ||
        classItem.description?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [classes, query]);

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
          Classes
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
          Select a class to view its students.
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
          maxHeight: "52vh",
          overflowY: "auto",
          borderRadius: 14,
          border: filteredClasses.length > 0 ? "1px solid #FFFFFF14" : "none",
        }}
      >
        {filteredClasses.length > 0 ? (
          filteredClasses.map((classItem, index) => {
            const isFirst = index === 0;
            const isLast = index === filteredClasses.length - 1;

            return (
              <Link
                key={classItem.id}
                href={`${navBasePath}/classes/${classItem.id}`}
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
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(207, 255, 4, 0.12)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "#2B2B2B";
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
                    {classItem.name}
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
                    {classItem.description ?? "Class roster and assignments"}
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
                  {classItem.studentCount} student
                  {classItem.studentCount === 1 ? "" : "s"} ·{" "}
                  {classItem.assignmentCount} assignment
                  {classItem.assignmentCount === 1 ? "" : "s"}
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
              lineHeight: "20px",
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