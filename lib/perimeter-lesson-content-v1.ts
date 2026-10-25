import { createHash } from "node:crypto";
import { z } from "zod";

const MAX_IDENTITY_LENGTH = 128;
const MAX_CONTENT_BYTES = 4 * 1024 * 1024;
const MAX_COORDINATE = 1_000_000_000_000;
const MAX_BOUNDARY_EDGES = 256;
const MAX_CONSTRUCTION_EDGES = 512;
const MAX_FRESH_CHECKS = 16;

const IdentitySchema = z.string().min(1).max(MAX_IDENTITY_LENGTH).refine(value => value.trim().length > 0);
const CoordinateSchema = z.number().int().safe().min(-MAX_COORDINATE).max(MAX_COORDINATE);
const EdgeSchema = z.object({
  id: IdentitySchema,
  startXSubunits: CoordinateSchema,
  startYSubunits: CoordinateSchema,
  endXSubunits: CoordinateSchema,
  endYSubunits: CoordinateSchema,
}).strict();
const ProblemSchema = z.object({
  problemId: IdentitySchema,
  boundaryEdges: z.array(EdgeSchema).min(4).max(MAX_BOUNDARY_EDGES),
  constructionEdges: z.array(EdgeSchema).max(MAX_CONSTRUCTION_EDGES),
}).strict();
const LessonSchema = z.object({
  contentSchemaVersion: z.literal(1),
  missionId: z.literal("perimeter-secure-boundary"),
  lessonId: IdentitySchema,
  contentRevision: IdentitySchema,
  geometryKind: z.literal("rectilinear-closed-polygon"),
  linearUnit: z.enum(["millimetre", "centimetre", "metre", "kilometre"]),
  practiceProblem: ProblemSchema,
  initialCheckProblem: ProblemSchema,
  freshCheckProblems: z.array(ProblemSchema).max(MAX_FRESH_CHECKS),
}).strict();

type Lesson = z.infer<typeof LessonSchema>;
type Edge = z.infer<typeof EdgeSchema>;
type Problem = z.infer<typeof ProblemSchema>;
type Unit = Lesson["linearUnit"];
type CheckFact = "practice-boundary" | "independent-check-boundary" | "explicit-total" | "explicit-unit" | "unassisted-independent-check";

export type PerimeterMissionAdmissionV1 = {
  missionId: "perimeter-secure-boundary";
  contentSchemaVersion: 1;
  lessonId: string;
  contentRevision: string;
  contentSha256: string;
  scorePolicyId: "none";
  checkSequence: {
    scope: "full-lesson";
    initialCheckProblemId: string;
    freshAlternativeProblemIds: string[];
    requiredCompletionFacts: CheckFact[];
  };
  problems: Array<{
    problemId: string;
    role: "practice" | "check";
    linearUnit: Unit;
    exposureIdentitySha256: string;
    edges: Array<{ id: string; lengthSubunits: number }>;
  }>;
};

export type PerimeterLessonContentV1Result =
  | {
      ok: true;
      canonicalJson: string;
      contentSha256: string;
      admission: PerimeterMissionAdmissionV1;
    }
  | { ok: false; code: "invalid-content" | "noncanonical-content"; details: string[] };

type Intersection =
  | { kind: "none" }
  | { kind: "point"; x: number; y: number }
  | { kind: "overlap" };

const unitMicrometresPerSubunit: Record<Unit, number> = {
  millimetre: 1,
  centimetre: 10,
  metre: 1_000,
  kilometre: 1_000_000,
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalProblem(problem: Problem) {
  return {
    problemId: problem.problemId,
    boundaryEdges: problem.boundaryEdges.map(edge => ({
      id: edge.id,
      startXSubunits: edge.startXSubunits,
      startYSubunits: edge.startYSubunits,
      endXSubunits: edge.endXSubunits,
      endYSubunits: edge.endYSubunits,
    })),
    constructionEdges: problem.constructionEdges.map(edge => ({
      id: edge.id,
      startXSubunits: edge.startXSubunits,
      startYSubunits: edge.startYSubunits,
      endXSubunits: edge.endXSubunits,
      endYSubunits: edge.endYSubunits,
    })),
  };
}

function canonicalLesson(lesson: Lesson): string {
  return JSON.stringify({
    contentSchemaVersion: lesson.contentSchemaVersion,
    missionId: lesson.missionId,
    lessonId: lesson.lessonId,
    contentRevision: lesson.contentRevision,
    geometryKind: lesson.geometryKind,
    linearUnit: lesson.linearUnit,
    practiceProblem: canonicalProblem(lesson.practiceProblem),
    initialCheckProblem: canonicalProblem(lesson.initialCheckProblem),
    freshCheckProblems: lesson.freshCheckProblems.map(canonicalProblem),
  });
}

function classifyIntersection(a: Edge, b: Edge): Intersection {
  const aHorizontal = a.startYSubunits === a.endYSubunits;
  const bHorizontal = b.startYSubunits === b.endYSubunits;
  if (aHorizontal && bHorizontal) {
    if (a.startYSubunits !== b.startYSubunits) return { kind: "none" };
    const low = Math.max(Math.min(a.startXSubunits, a.endXSubunits), Math.min(b.startXSubunits, b.endXSubunits));
    const high = Math.min(Math.max(a.startXSubunits, a.endXSubunits), Math.max(b.startXSubunits, b.endXSubunits));
    if (low > high) return { kind: "none" };
    return low === high ? { kind: "point", x: low, y: a.startYSubunits } : { kind: "overlap" };
  }
  if (!aHorizontal && !bHorizontal) {
    if (a.startXSubunits !== b.startXSubunits) return { kind: "none" };
    const low = Math.max(Math.min(a.startYSubunits, a.endYSubunits), Math.min(b.startYSubunits, b.endYSubunits));
    const high = Math.min(Math.max(a.startYSubunits, a.endYSubunits), Math.max(b.startYSubunits, b.endYSubunits));
    if (low > high) return { kind: "none" };
    return low === high ? { kind: "point", x: a.startXSubunits, y: low } : { kind: "overlap" };
  }

  const horizontal = aHorizontal ? a : b;
  const vertical = aHorizontal ? b : a;
  const x = vertical.startXSubunits;
  const y = horizontal.startYSubunits;
  const crosses =
    x >= Math.min(horizontal.startXSubunits, horizontal.endXSubunits) &&
    x <= Math.max(horizontal.startXSubunits, horizontal.endXSubunits) &&
    y >= Math.min(vertical.startYSubunits, vertical.endYSubunits) &&
    y <= Math.max(vertical.startYSubunits, vertical.endYSubunits);
  return crosses ? { kind: "point", x, y } : { kind: "none" };
}

function validateProblem(problem: Problem, label: string): { ok: true; edgeLengths: number[]; totalSubunits: number } | { ok: false; detail: string } {
  const seenEdgeIds = new Set<string>();
  const allEdges = [...problem.boundaryEdges, ...problem.constructionEdges];
  for (let index = 0; index < allEdges.length; index++) {
    const edge = allEdges[index];
    if (seenEdgeIds.has(edge.id)) return { ok: false, detail: `${label} has a duplicate edge ID at index ${index}.` };
    seenEdgeIds.add(edge.id);
    const dx = edge.endXSubunits - edge.startXSubunits;
    const dy = edge.endYSubunits - edge.startYSubunits;
    if (dx === 0 && dy === 0) return { ok: false, detail: `${label} has a zero-length edge at index ${index}.` };
    if (dx !== 0 && dy !== 0) return { ok: false, detail: `${label} has a diagonal edge at index ${index}.` };
  }

  for (let index = 0; index < problem.boundaryEdges.length; index++) {
    const edge = problem.boundaryEdges[index];
    const next = problem.boundaryEdges[(index + 1) % problem.boundaryEdges.length];
    if (edge.endXSubunits !== next.startXSubunits || edge.endYSubunits !== next.startYSubunits) {
      return { ok: false, detail: `${label} boundary is not one ordered closed loop at edge ${index}.` };
    }
  }

  for (let i = 0; i < problem.boundaryEdges.length; i++) {
    for (let j = i + 1; j < problem.boundaryEdges.length; j++) {
      const intersection = classifyIntersection(problem.boundaryEdges[i], problem.boundaryEdges[j]);
      if (intersection.kind === "none") continue;
      const adjacent = j === i + 1;
      const closing = i === 0 && j === problem.boundaryEdges.length - 1;
      const allowed =
        intersection.kind === "point" &&
        ((adjacent &&
          intersection.x === problem.boundaryEdges[i].endXSubunits &&
          intersection.y === problem.boundaryEdges[i].endYSubunits) ||
          (closing &&
            intersection.x === problem.boundaryEdges[0].startXSubunits &&
            intersection.y === problem.boundaryEdges[0].startYSubunits));
      if (!allowed) return { ok: false, detail: `${label} boundary self-intersects, touches or overlaps.` };
    }
  }

  const edgeLengths = problem.boundaryEdges.map(edge =>
    Math.abs(edge.endXSubunits - edge.startXSubunits) + Math.abs(edge.endYSubunits - edge.startYSubunits),
  );
  const totalSubunits = edgeLengths.reduce((total, length) => total + length, 0);
  if (!Number.isSafeInteger(totalSubunits)) return { ok: false, detail: `${label} perimeter total exceeds the safe integer range.` };
  return { ok: true, edgeLengths, totalSubunits };
}

function issueDetails(error: z.ZodError): string[] {
  return error.issues.map(issue => `${issue.path.join(".") || "content"}: ${issue.message}`);
}

/**
 * Parses only canonical Unity-compatible V1 lesson bytes, validates every problem
 * eagerly, hashes the exact UTF-8 bytes, then derives a server-side admission.
 * This helper is intentionally disconnected from live launch and credit routes.
 */
export function buildPerimeterMissionAdmissionV1FromCanonicalContent(rawCanonicalJson: unknown): PerimeterLessonContentV1Result {
  if (typeof rawCanonicalJson !== "string" || rawCanonicalJson.length === 0) {
    return { ok: false, code: "invalid-content", details: ["Canonical content must be a non-empty JSON string."] };
  }
  if (Buffer.byteLength(rawCanonicalJson, "utf8") > MAX_CONTENT_BYTES) {
    return { ok: false, code: "invalid-content", details: ["Canonical content exceeds the V1 byte limit."] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawCanonicalJson);
  } catch {
    return { ok: false, code: "invalid-content", details: ["Canonical lesson JSON is malformed."] };
  }
  const parsed = LessonSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid-content", details: issueDetails(parsed.error) };

  const lesson = parsed.data;
  const canonicalJson = canonicalLesson(lesson);
  if (rawCanonicalJson !== canonicalJson) {
    return { ok: false, code: "noncanonical-content", details: ["Lesson JSON does not use the exact canonical V1 encoding."] };
  }

  const authoredProblems: Array<{ source: Problem; role: "practice" | "check" }> = [
    { source: lesson.practiceProblem, role: "practice" },
    { source: lesson.initialCheckProblem, role: "check" },
    ...lesson.freshCheckProblems.map(source => ({ source, role: "check" as const })),
  ];
  const problemIds = new Set<string>();
  const exposureIdentities = new Set<string>();
  const admittedProblems: PerimeterMissionAdmissionV1["problems"] = [];

  for (let index = 0; index < authoredProblems.length; index++) {
    const { source, role } = authoredProblems[index];
    if (problemIds.has(source.problemId)) {
      return { ok: false, code: "invalid-content", details: [`Problem identity '${source.problemId}' is duplicated.`] };
    }
    problemIds.add(source.problemId);

    const geometry = validateProblem(source, source.problemId);
    if (!geometry.ok) return { ok: false, code: "invalid-content", details: [geometry.detail] };
    const micrometres = geometry.totalSubunits * unitMicrometresPerSubunit[lesson.linearUnit];
    if (!Number.isSafeInteger(micrometres)) {
      return { ok: false, code: "invalid-content", details: [`Problem '${source.problemId}' exceeds the canonical answer range.`] };
    }
    const exposureIdentitySha256 = sha256(`perimeter-answer-v1|${micrometres}um`);
    if (exposureIdentities.has(exposureIdentitySha256)) {
      return {
        ok: false,
        code: "invalid-content",
        details: [`Problem '${source.problemId}' repeats a previously exposed semantic perimeter answer.`],
      };
    }
    exposureIdentities.add(exposureIdentitySha256);
    admittedProblems.push({
      problemId: source.problemId,
      role,
      linearUnit: lesson.linearUnit,
      exposureIdentitySha256,
      edges: source.boundaryEdges.map((edge, edgeIndex) => ({ id: edge.id, lengthSubunits: geometry.edgeLengths[edgeIndex] })),
    });
  }

  const contentSha256 = sha256(rawCanonicalJson);
  return {
    ok: true,
    canonicalJson,
    contentSha256,
    admission: {
      missionId: lesson.missionId,
      contentSchemaVersion: lesson.contentSchemaVersion,
      lessonId: lesson.lessonId,
      contentRevision: lesson.contentRevision,
      contentSha256,
      scorePolicyId: "none",
      checkSequence: {
        scope: "full-lesson",
        initialCheckProblemId: lesson.initialCheckProblem.problemId,
        freshAlternativeProblemIds: lesson.freshCheckProblems.map(problem => problem.problemId),
        requiredCompletionFacts: [
          "practice-boundary",
          "independent-check-boundary",
          "explicit-total",
          "explicit-unit",
          "unassisted-independent-check",
        ],
      },
      problems: admittedProblems,
    },
  };
}

