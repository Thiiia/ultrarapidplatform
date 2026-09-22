import { parse } from "csv-parse/sync";
import { z } from "zod";

export const ROSTER_HEADERS = [
  "student_external_id",
  "student_email",
  "student_name",
  "class_external_id",
  "class_name",
  "teacher_external_id",
  "teacher_email",
  "teacher_name",
  "term",
] as const;

const MAX_ROSTER_ROWS = 5_000;

const rosterRowSchema = z.object({
  student_external_id: z.string().trim().min(1).max(100),
  student_email: z.string().trim().email().max(320),
  student_name: z.string().trim().min(1).max(200),
  class_external_id: z.string().trim().min(1).max(100),
  class_name: z.string().trim().min(1).max(200),
  teacher_external_id: z.string().trim().max(100),
  teacher_email: z.string().trim().email().max(320),
  teacher_name: z.string().trim().min(1).max(200),
  term: z.string().trim().max(100),
});

export type RosterRow = z.infer<typeof rosterRowSchema>;

export type RosterValidationIssue = {
  row: number;
  message: string;
};

export class RosterValidationError extends Error {
  constructor(public readonly issues: RosterValidationIssue[]) {
    super("The roster contains validation errors.");
  }
}

export function normalizeRosterEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseRosterCsv(csvText: string): RosterRow[] {
  let rawRows: Record<string, string>[];

  try {
    rawRows = parse(csvText, {
      bom: true,
      columns(header: string[]) {
        return header.map((value) => value.trim().toLowerCase());
      },
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    throw new RosterValidationError([
      { row: 1, message: error instanceof Error ? error.message : "Invalid CSV." },
    ]);
  }

  if (rawRows.length === 0) {
    throw new RosterValidationError([{ row: 1, message: "The roster is empty." }]);
  }

  if (rawRows.length > MAX_ROSTER_ROWS) {
    throw new RosterValidationError([
      { row: 1, message: `A roster may contain at most ${MAX_ROSTER_ROWS} rows.` },
    ]);
  }

  const actualHeaders = Object.keys(rawRows[0]);
  const missingHeaders = ROSTER_HEADERS.filter((header) => !actualHeaders.includes(header));
  const unknownHeaders = actualHeaders.filter(
    (header) => !ROSTER_HEADERS.includes(header as (typeof ROSTER_HEADERS)[number]),
  );

  if (missingHeaders.length || unknownHeaders.length) {
    const messages = [
      missingHeaders.length ? `Missing columns: ${missingHeaders.join(", ")}.` : "",
      unknownHeaders.length ? `Unknown columns: ${unknownHeaders.join(", ")}.` : "",
    ].filter(Boolean);
    throw new RosterValidationError([{ row: 1, message: messages.join(" ") }]);
  }

  const issues: RosterValidationIssue[] = [];
  const rows: RosterRow[] = [];
  const enrollmentRows = new Map<string, number>();
  const students = new Map<string, { email: string; name: string; row: number }>();
  const classes = new Map<
    string,
    { name: string; teacherKey: string; term: string; row: number }
  >();
  const studentEmails = new Map<string, string>();
  const teacherEmails = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const parsed = rosterRowSchema.safeParse(rawRow);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ row: rowNumber, message: `${issue.path.join(".")}: ${issue.message}` });
      }
      return;
    }

    const row = {
      ...parsed.data,
      student_email: normalizeRosterEmail(parsed.data.student_email),
      teacher_email: normalizeRosterEmail(parsed.data.teacher_email),
    };
    const enrollmentKey = `${row.student_external_id}\0${row.class_external_id}`;
    const previousEnrollmentRow = enrollmentRows.get(enrollmentKey);

    if (previousEnrollmentRow) {
      issues.push({ row: rowNumber, message: `Duplicate enrollment from row ${previousEnrollmentRow}.` });
    } else {
      enrollmentRows.set(enrollmentKey, rowNumber);
    }

    const previousStudent = students.get(row.student_external_id);
    if (
      previousStudent &&
      (previousStudent.email !== row.student_email || previousStudent.name !== row.student_name)
    ) {
      issues.push({ row: rowNumber, message: `Student details conflict with row ${previousStudent.row}.` });
    } else if (!previousStudent) {
      students.set(row.student_external_id, {
        email: row.student_email,
        name: row.student_name,
        row: rowNumber,
      });
    }

    const otherStudentId = studentEmails.get(row.student_email);
    if (otherStudentId && otherStudentId !== row.student_external_id) {
      issues.push({ row: rowNumber, message: "Student email is assigned to multiple external IDs." });
    } else {
      studentEmails.set(row.student_email, row.student_external_id);
    }

    const teacherKey = row.teacher_external_id || row.teacher_email;
    const previousClass = classes.get(row.class_external_id);
    if (
      previousClass &&
      (previousClass.name !== row.class_name ||
        previousClass.teacherKey !== teacherKey ||
        previousClass.term !== row.term)
    ) {
      issues.push({ row: rowNumber, message: `Class details conflict with row ${previousClass.row}.` });
    } else if (!previousClass) {
      classes.set(row.class_external_id, {
        name: row.class_name,
        teacherKey,
        term: row.term,
        row: rowNumber,
      });
    }

    teacherEmails.add(row.teacher_email);
    rows.push(row);
  });

  for (const email of teacherEmails) {
    if (studentEmails.has(email)) {
      issues.push({ row: 1, message: `${email} is listed as both a student and a teacher.` });
    }
  }

  if (issues.length) {
    throw new RosterValidationError(issues);
  }

  return rows;
}