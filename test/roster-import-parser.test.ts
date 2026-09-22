import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRosterCsv,
  RosterValidationError,
} from "../lib/roster-import-parser";

const header =
  "student_external_id,student_email,student_name,class_external_id,class_name,teacher_external_id,teacher_email,teacher_name,term";

test("parses and normalizes a valid roster", () => {
  const rows = parseRosterCsv(
    `${header}\nSTU-1, Alice@Example.edu ,Alice Smith,7A,Maths 7A,T-1,Teacher@Example.edu,Sam Jones,2026`,
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].student_email, "alice@example.edu");
  assert.equal(rows[0].teacher_email, "teacher@example.edu");
});

test("rejects duplicate enrollments", () => {
  const csv = [
    header,
    "STU-1,alice@example.edu,Alice Smith,7A,Maths 7A,T-1,teacher@example.edu,Sam Jones,2026",
    "STU-1,alice@example.edu,Alice Smith,7A,Maths 7A,T-1,teacher@example.edu,Sam Jones,2026",
  ].join("\n");

  assert.throws(() => parseRosterCsv(csv), RosterValidationError);
});

test("rejects conflicting class teachers", () => {
  const csv = [
    header,
    "STU-1,alice@example.edu,Alice Smith,7A,Maths 7A,T-1,teacher@example.edu,Sam Jones,2026",
    "STU-2,bob@example.edu,Bob Smith,7A,Maths 7A,T-2,other@example.edu,Pat Jones,2026",
  ].join("\n");

  assert.throws(() => parseRosterCsv(csv), RosterValidationError);
});

test("rejects missing canonical columns", () => {
  assert.throws(
    () => parseRosterCsv("student_email\nalice@example.edu"),
    RosterValidationError,
  );
});