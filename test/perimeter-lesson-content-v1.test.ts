import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPerimeterMissionAdmissionV1FromCanonicalContent } from "../lib/perimeter-lesson-content-v1";

const fixturePath = new URL("../contracts/perimeter-lesson/v1/valid-pilot.json", import.meta.url);
const canonicalJson = readFileSync(fixturePath, "utf8").replace(/[\r\n]+$/u, "");
const parse = (value: unknown) => buildPerimeterMissionAdmissionV1FromCanonicalContent(
  typeof value === "string" ? value : JSON.stringify(value),
);
const errorCode = (value: ReturnType<typeof buildPerimeterMissionAdmissionV1FromCanonicalContent>) =>
  value.ok ? null : value.code;
const copyLesson = () => JSON.parse(canonicalJson);
const rectangle = (problemId: string, prefix: string, width: number, height: number) => {
  const points = [[0, 0], [width * 1000, 0], [width * 1000, height * 1000], [0, height * 1000]];
  return {
    problemId,
    boundaryEdges: points.map((point, index) => ({
      id: prefix + index,
      startXSubunits: point[0],
      startYSubunits: point[1],
      endXSubunits: points[(index + 1) % points.length][0],
      endYSubunits: points[(index + 1) % points.length][1],
    })),
    constructionEdges: [],
  };
};

test("Unity pilot canonical bytes derive a real, full-lesson server admission", () => {
  const result = parse(canonicalJson);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.canonicalJson, canonicalJson);
  assert.equal(result.contentSha256, "646be0538559f580694a554ee5c9b8c20a4265128398ee2690cd6db678a23098");
  assert.equal(result.admission.contentSha256, result.contentSha256);
  assert.deepEqual(result.admission.checkSequence, {
    scope: "full-lesson",
    initialCheckProblemId: "check-3x4",
    freshAlternativeProblemIds: ["fresh-4x5"],
    requiredCompletionFacts: [
      "practice-boundary",
      "independent-check-boundary",
      "explicit-total",
      "explicit-unit",
      "unassisted-independent-check",
    ],
  });
  assert.deepEqual(result.admission.problems.map(problem => problem.edges.map(edge => edge.lengthSubunits)), [
    [3000, 5000, 3000, 5000],
    [3000, 4000, 3000, 4000],
    [4000, 5000, 4000, 5000],
  ]);
  assert.equal(new Set(result.admission.problems.map(problem => problem.exposureIdentitySha256)).size, 3);
});

test("content identity is computed from exact canonical bytes, not a fixture placeholder", () => {
  const result = parse(canonicalJson);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(errorCode(parse(canonicalJson + "\n")), "noncanonical-content");
  assert.notEqual(result.contentSha256, "a".repeat(64));
});

test("unknown properties, unsupported unit and missing explicit lists fail admission", () => {
  const unknown = copyLesson();
  unknown.serverOwned = true;
  assert.equal(errorCode(parse(unknown)), "invalid-content");

  const unit = copyLesson();
  unit.linearUnit = "unit";
  assert.equal(errorCode(parse(unit)), "invalid-content");

  const noConstructionList = copyLesson();
  delete noConstructionList.practiceProblem.constructionEdges;
  assert.equal(errorCode(parse(noConstructionList)), "invalid-content");
});

test("null edges, diagonal and open boundaries are rejected before admission", () => {
  const nullEdge = copyLesson();
  nullEdge.practiceProblem.boundaryEdges[2] = null;
  assert.equal(errorCode(parse(nullEdge)), "invalid-content");

  const diagonal = copyLesson();
  diagonal.practiceProblem.boundaryEdges[0].endYSubunits = 1;
  assert.equal(errorCode(parse(diagonal)), "invalid-content");

  const open = copyLesson();
  open.practiceProblem.boundaryEdges[0].endXSubunits = 2999;
  assert.equal(errorCode(parse(open)), "invalid-content");
});

test("self-touch and overlap are rejected by the mirrored rectilinear validator", () => {
  const lesson = copyLesson();
  lesson.practiceProblem.boundaryEdges = [
    { id: "a", startXSubunits: 0, startYSubunits: 0, endXSubunits: 4000, endYSubunits: 0 },
    { id: "b", startXSubunits: 4000, startYSubunits: 0, endXSubunits: 4000, endYSubunits: 4000 },
    { id: "c", startXSubunits: 4000, startYSubunits: 4000, endXSubunits: 2000, endYSubunits: 4000 },
    { id: "d", startXSubunits: 2000, startYSubunits: 4000, endXSubunits: 2000, endYSubunits: 0 },
    { id: "e", startXSubunits: 2000, startYSubunits: 0, endXSubunits: 0, endYSubunits: 0 },
  ];
  assert.equal(errorCode(parse(lesson)), "invalid-content");
});

test("invalid unvisited alternatives and semantically repeated answers invalidate the whole lesson", () => {
  const invalidFresh = copyLesson();
  invalidFresh.freshCheckProblems[0].boundaryEdges[1].endXSubunits = 0;
  assert.equal(errorCode(parse(invalidFresh)), "invalid-content");

  const repeatedAnswer = copyLesson();
  repeatedAnswer.freshCheckProblems[0] = rectangle("renamed-but-same-answer", "r", 2, 5);
  const result = parse(repeatedAnswer);
  assert.equal(errorCode(result), "invalid-content");
  if (!result.ok) assert.match(result.details.join(" "), /semantic perimeter answer/u);
});

test("canonical numeric bounds reject coordinates outside the Unity range", () => {
  const outOfRange = copyLesson();
  outOfRange.practiceProblem.boundaryEdges[0].endXSubunits = 1_000_000_000_001;
  assert.equal(errorCode(parse(outOfRange)), "invalid-content");
});

