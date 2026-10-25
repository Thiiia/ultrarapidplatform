import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PerimeterCompletionV4Schema,
  validatePerimeterCompletionV4AgainstAdmission,
} from "../lib/perimeter-completion-v4";
import { buildPerimeterMissionAdmissionV1FromCanonicalContent } from "../lib/perimeter-lesson-content-v1";

const fixture = (name: string) => JSON.parse(readFileSync(
  new URL(`../contracts/perimeter-completion/v4/${name}`, import.meta.url),
  "utf8",
));

const lessonBytes = readFileSync(
  new URL("../contracts/perimeter-lesson/v1/valid-pilot.json", import.meta.url),
  "utf8",
).replace(/[\r\n]+$/u, "");
const derivedAdmission = buildPerimeterMissionAdmissionV1FromCanonicalContent(lessonBytes);
assert.equal(derivedAdmission.ok, true, derivedAdmission.ok ? undefined : derivedAdmission.details.join("; "));
if (!derivedAdmission.ok) throw new Error("The checked-in Perimeter lesson fixture did not produce a server admission.");
const admission = derivedAdmission.admission;

const errorCode = (input: unknown): string | null => {
  const result = validatePerimeterCompletionV4AgainstAdmission(input, admission);
  return result.ok ? null : result.code;
};

test("a revealed initial check followed by a fresh independent check projects server-derived totals", () => {
  const result = validatePerimeterCompletionV4AgainstAdmission(
    fixture("valid-assisted-fresh-check.json"),
    admission,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.completion.practice.accountedTotalSubunits, 16000);
  assert.equal(result.completion.practice.isComplete, true);
  assert.equal(result.completion.checkAttempts[0].mathematicallyCorrect, true);
  assert.equal(result.completion.checkAttempts[0].independentlyCorrect, false);
  assert.equal(result.completion.checkAttempts[0].unitSelectionSequence, 3);
  assert.equal(result.completion.checkAttempts[1].sequence, 6);
  assert.equal(result.completion.checkAttempts[1].unitSelectionSequence, 5);
  assert.equal(result.completion.checkAttempts[1].expectedTotalSubunits, 18000);
  assert.equal(result.completion.checkAttempts[1].independentlyCorrect, true);
  assert.deepEqual(result.completion.unitSelections.map(item => item.sequence), [3, 5]);
  assert.deepEqual(result.completion.timing, { status: "not-measured" });
  assert.equal(result.completion.scorePolicyId, "none");
});

test("partial practice remains an honest abandoned result", () => {
  const raw = fixture("valid-assisted-fresh-check.json");
  raw.outcome = "abandoned";
  raw.practice.acceptedEdgeIds = ["p0", "p1"];
  raw.practice.checkStartedSequence = null;
  raw.checkAttempts = [];
  raw.unitSelections = [];
  raw.guidanceEvents = [];
  const result = validatePerimeterCompletionV4AgainstAdmission(raw, admission);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.completion.practice.accountedTotalSubunits, 8000);
  assert.equal(result.completion.practice.isComplete, false);

  const prematureStart = fixture("valid-assisted-fresh-check.json");
  prematureStart.outcome = "abandoned";
  prematureStart.practice.acceptedEdgeIds = ["p0"];
  prematureStart.checkAttempts = [];
  prematureStart.unitSelections = [];
  prematureStart.guidanceEvents = [];
  assert.equal(errorCode(prematureStart), "false-completion");
});

test("duplicate accepted edges are rejected before projecting a result", () => {
  const result = validatePerimeterCompletionV4AgainstAdmission(
    fixture("invalid-duplicate-edge.json"),
    admission,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid-completion");
});

test("unknown edges and problem IDs cannot be supplied by the client", () => {
  const unknownEdge = fixture("valid-assisted-fresh-check.json");
  unknownEdge.practice.acceptedEdgeIds[0] = "forged-edge";
  assert.equal(errorCode(unknownEdge), "invalid-work");

  const unknownProblem = fixture("valid-assisted-fresh-check.json");
  unknownProblem.checkAttempts[1].problemId = "client-invented-problem";
  assert.equal(errorCode(unknownProblem), "invalid-work");
});

test("check start, guidance, unit choice and attempts share one collision-free timeline", () => {
  const collidingUnitChoice = fixture("valid-assisted-fresh-check.json");
  collidingUnitChoice.unitSelections[0].sequence = 4;
  assert.equal(PerimeterCompletionV4Schema.safeParse(collidingUnitChoice).success, false);

  const mismatchedAttemptChoice = fixture("valid-assisted-fresh-check.json");
  mismatchedAttemptChoice.checkAttempts[1].unitSelectionSequence = 3;
  assert.equal(errorCode(mismatchedAttemptChoice), "invalid-work");

  const selectionBeforeStart = fixture("valid-assisted-fresh-check.json");
  selectionBeforeStart.practice.checkStartedSequence = 4;
  selectionBeforeStart.checkAttempts = [];
  selectionBeforeStart.unitSelections = [{ sequence: 3, problemId: "check-3x4", unit: "centimetre" }];
  selectionBeforeStart.guidanceEvents = [];
  selectionBeforeStart.outcome = "abandoned";
  assert.equal(errorCode(selectionBeforeStart), "invalid-work");

  const selectionWithoutStart = fixture("valid-assisted-fresh-check.json");
  selectionWithoutStart.practice.checkStartedSequence = null;
  selectionWithoutStart.checkAttempts = [];
  selectionWithoutStart.guidanceEvents = [];
  assert.equal(errorCode(selectionWithoutStart), "false-completion");
});

test("completed outcomes require a correct independent final problem and matching content identity", () => {
  const assistedFinal = fixture("valid-assisted-fresh-check.json");
  assistedFinal.guidanceEvents.push({
    sequence: 7,
    stage: "check",
    problemId: "fresh-4x5",
    kind: "answer-reveal",
  });
  assert.equal(errorCode(assistedFinal), "false-completion");

  const staleUnitEvidence = fixture("valid-assisted-fresh-check.json");
  staleUnitEvidence.unitSelections.pop();
  assert.equal(errorCode(staleUnitEvidence), "invalid-work");

  const conflictingUnit = fixture("valid-assisted-fresh-check.json");
  conflictingUnit.unitSelections[1].unit = "millimetre";
  assert.equal(errorCode(conflictingUnit), "invalid-work");

  const wrongAnswer = fixture("valid-assisted-fresh-check.json");
  wrongAnswer.checkAttempts[1].submittedTotalSubunits = 17000;
  assert.equal(errorCode(wrongAnswer), "false-completion");

  const staleContent = fixture("valid-assisted-fresh-check.json");
  staleContent.contentRevision = "older-revision";
  assert.equal(errorCode(staleContent), "content-mismatch");
});

test("an independent success is terminal and cannot be followed by another attempt", () => {
  const result = validatePerimeterCompletionV4AgainstAdmission(
    fixture("invalid-independent-success-followed-by-attempt.json"),
    admission,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "false-completion");
});

test("equivalent millimetre answers use the same exact canonical length as Unity", () => {
  const result = validatePerimeterCompletionV4AgainstAdmission(
    fixture("valid-equivalent-millimetre-answer.json"),
    admission,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const finalAttempt = result.completion.checkAttempts.at(-1);
  assert.equal(finalAttempt?.expectedTotalSubunits, 18000);
  assert.equal(finalAttempt?.expectedUnit, "centimetre");
  assert.equal(finalAttempt?.submittedTotalSubunits, 180000);
  assert.equal(finalAttempt?.submittedUnit, "millimetre");
  assert.equal(finalAttempt?.mathematicallyCorrect, true);
  assert.equal(finalAttempt?.independentlyCorrect, true);

  const inexact = fixture("valid-equivalent-millimetre-answer.json");
  inexact.checkAttempts[1].submittedTotalSubunits = 180001;
  assert.equal(errorCode(inexact), "false-completion");
});

test("the unit sentinel cannot establish a physical linear answer", () => {
  const raw = fixture("valid-assisted-fresh-check.json");
  const finalAttempt = raw.checkAttempts.at(-1);
  finalAttempt.submittedUnit = "unit";
  assert.equal(errorCode(raw), "invalid-work");
});

test("unsupported scoring, timing, and extra payload fields remain rejected", () => {
  const timed = fixture("valid-assisted-fresh-check.json");
  timed.timing = { status: "scored", points: 200 };
  assert.equal(PerimeterCompletionV4Schema.safeParse(timed).success, false);

  const withSteps = { ...fixture("valid-assisted-fresh-check.json"), missionSteps: [] };
  assert.equal(PerimeterCompletionV4Schema.safeParse(withSteps).success, false);

  const wrongPolicy = fixture("valid-assisted-fresh-check.json");
  wrongPolicy.scorePolicyId = "perimeter-rhythm-v1";
  assert.equal(errorCode(wrongPolicy), "invalid-completion");
});

test("an already independent result cannot be relabelled as abandoned", () => {
  const raw = fixture("valid-assisted-fresh-check.json");
  raw.outcome = "abandoned";
  assert.equal(errorCode(raw), "false-completion");
});

test("V2 and V3 completion payloads cannot be mistaken for Perimeter V4", () => {
  assert.equal(PerimeterCompletionV4Schema.safeParse({ completionVersion: 2 }).success, false);
  assert.equal(PerimeterCompletionV4Schema.safeParse({ completionVersion: 3 }).success, false);
});

