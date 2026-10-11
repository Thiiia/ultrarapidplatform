import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseAuthoredLessonDraft } from "../../lib/authored-lesson";
import { timelineEventsFromAuthoredLesson } from "../../lib/authored-lesson-serialization";
import { evaluateLessonPublishReadiness } from "../../lib/guided-authored-encounter";
import { createLessonClock } from "../../lib/editor/lesson-timing";

const root = resolve(process.argv[2] ?? "content-candidates/early-algebra-corrective-upload-20261011");
const [header, ...lines] = readFileSync(resolve(root, "manifest.csv"), "utf8").trim().split(/\r?\n/);
const keys = header.split(",");
for (const line of lines) {
  const row = Object.fromEntries(line.split(",").map((value, index) => [keys[index], value]));
  const chart = readFileSync(resolve(root, "charts", row.chartPath));
  const sidecar = readFileSync(resolve(root, "sidecars", row.sidecarPath));
  for (const [bytes, digest, size] of [[chart, row.chartSha256, row.chartBytes], [sidecar, row.sidecarSha256, row.sidecarBytes]] as const) {
    assert.equal(bytes.length, Number(size));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  }
  assert.ok(row.chartPath.includes(`/revisions/${row.newRevision}/`));
  assert.ok(row.sidecarPath.includes(`/revisions/${row.newRevision}/`));
  const lesson = parseAuthoredLessonDraft(JSON.parse(sidecar.toString()));
  assert.equal(lesson.songAssetId, row.songAssetId);
  assert.equal(lesson.revision, row.newRevision);
  assert.equal(lesson.activityKey, "early-algebra");
  assert.equal(lesson.equations.length, Number(row.equationCount));
  assert.equal(lesson.encounters.length, Number(row.encounterCount));
  // This publication is the introductory set: one positive integer unknown,
  // small addition/subtraction, and no coefficients, powers or fractions.
  for (const equation of lesson.equations) {
    const match = /^x ([+-]) (\d+) = (\d+)$/.exec(equation.state);
    assert.ok(match, `Unexpected introductory equation: ${equation.state}`);
    const term = Number(match[2]);
    const result = Number(match[3]);
    const solution = match[1] === "+" ? result - term : result + term;
    assert.ok(term <= 10 && result <= 20 && solution > 0 && solution <= 20);
  }
  const hydrated = timelineEventsFromAuthoredLesson(lesson, createLessonClock(chart.toString()));
  const readiness = evaluateLessonPublishReadiness(hydrated.events, { activityKey: "early-algebra", equationQueue: hydrated.equations });
  assert.equal(readiness.ready, true, JSON.stringify(readiness.blockers));
  console.log(JSON.stringify({ songAssetId: row.songAssetId, revision: row.newRevision, equations: lesson.equations.length, encounters: lesson.encounters.length, ready: true }));
}
