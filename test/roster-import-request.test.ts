import assert from "node:assert/strict";
import test from "node:test";
import {
  getRosterSchoolId,
  parseRosterRequest,
} from "../lib/roster-import-request";

test("extracts the school ID from a roster route", () => {
  const request = new Request(
    "https://platform.example/api/admin/schools/school-123/roster-import/preview",
  );
  assert.equal(getRosterSchoolId(request), "school-123");
});

test("defaults roster requests to additive mode", async () => {
  const request = new Request("https://platform.example/api", {
    method: "POST",
    body: JSON.stringify({ filename: "roster.csv", csvText: "header\nvalue" }),
  });
  const result = await parseRosterRequest(request);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.mode, "additive");
});

test("accepts reconciliation only when explicitly requested", async () => {
  const request = new Request("https://platform.example/api", {
    method: "POST",
    body: JSON.stringify({
      filename: "roster.csv",
      csvText: "header\nvalue",
      mode: "reconcile",
    }),
  });
  const result = await parseRosterRequest(request);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.mode, "reconcile");
});

test("preserves the preview summary for apply consistency checks", async () => {
  const expectedSummary = { rows: 2, studentsCreated: 1 };
  const request = new Request("https://platform.example/api", {
    method: "POST",
    body: JSON.stringify({
      filename: "roster.csv",
      csvText: "header\nvalue",
      expectedSummary,
    }),
  });
  const result = await parseRosterRequest(request);

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.expectedSummary, expectedSummary);
});

test("rejects malformed JSON", async () => {
  const request = new Request("https://platform.example/api", {
    method: "POST",
    body: "not-json",
  });
  assert.deepEqual(await parseRosterRequest(request), {
    ok: false,
    error: "Invalid JSON body.",
  });
});