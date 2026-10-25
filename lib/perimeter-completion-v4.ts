import { z } from "zod";

const MAX_SAFE_TOTAL = Number.MAX_SAFE_INTEGER;
const MAX_EVIDENCE_SEQUENCE = 100_000;
const LinearUnitSchema = z.enum(["unit", "millimetre", "centimetre", "metre", "kilometre"]);
const TerminalOutcomeSchema = z.enum(["completed", "failed", "abandoned", "cancelled"]);
const EvidenceSequenceSchema = z.number().int().min(1).max(MAX_EVIDENCE_SEQUENCE);
const PhysicalUnitSchema = z.enum(["millimetre", "centimetre", "metre", "kilometre"]);
const MICROMETRES_PER_SUBUNIT: Record<Exclude<z.infer<typeof LinearUnitSchema>, "unit">, number> = {
  millimetre: 1,
  centimetre: 10,
  metre: 1_000,
  kilometre: 1_000_000,
};

const EdgeWorkSchema = z.object({
  problemId: z.string().min(1).max(120),
  acceptedEdgeIds: z.array(z.string().min(1).max(128)).max(256),
  checkStartedSequence: EvidenceSequenceSchema.nullable(),
}).strict().superRefine((work, context) => {
  if (new Set(work.acceptedEdgeIds).size !== work.acceptedEdgeIds.length) {
    context.addIssue({ code: "custom", path: ["acceptedEdgeIds"], message: "Accepted edge IDs must be unique." });
  }
});

const CheckAttemptSchema = z.object({
  sequence: EvidenceSequenceSchema,
  unitSelectionSequence: EvidenceSequenceSchema,
  problemId: z.string().min(1).max(120),
  acceptedEdgeIds: z.array(z.string().min(1).max(128)).max(256),
  submittedTotalSubunits: z.number().int().min(0).max(MAX_SAFE_TOTAL),
  submittedUnit: LinearUnitSchema,
  usedAnswerReveal: z.boolean(),
}).strict().superRefine((attempt, context) => {
  if (new Set(attempt.acceptedEdgeIds).size !== attempt.acceptedEdgeIds.length) {
    context.addIssue({ code: "custom", path: ["acceptedEdgeIds"], message: "Accepted edge IDs must be unique." });
  }
});

const CheckUnitSelectionSchema = z.object({
  sequence: EvidenceSequenceSchema,
  problemId: z.string().min(1).max(120),
  unit: PhysicalUnitSchema,
}).strict();

const GuidanceEventSchema = z.object({
  sequence: EvidenceSequenceSchema,
  stage: z.enum(["practice", "check"]),
  problemId: z.string().min(1).max(120),
  kind: z.enum(["boundary-focus", "hint", "worked-example", "answer-reveal"]),
}).strict();

export const PerimeterCompletionV4Schema = z.object({
  completionVersion: z.literal(4),
  missionId: z.literal("perimeter-secure-boundary"),
  contentSchemaVersion: z.literal(1),
  lessonId: z.string().min(1).max(120),
  contentRevision: z.string().min(1).max(120),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  outcome: TerminalOutcomeSchema,
  practice: EdgeWorkSchema,
  checkAttempts: z.array(CheckAttemptSchema).max(64),
  unitSelections: z.array(CheckUnitSelectionSchema).max(128),
  guidanceEvents: z.array(GuidanceEventSchema).max(512),
  timing: z.object({ status: z.literal("not-measured") }).strict(),
  scorePolicyId: z.literal("none"),
}).strict().superRefine((completion, context) => {
  let previous = 0;
  completion.guidanceEvents.forEach((event, index) => {
    if (event.sequence <= previous) {
      context.addIssue({
        code: "custom",
        path: ["guidanceEvents", index, "sequence"],
        message: "Guidance events must have unique, increasing sequence numbers.",
      });
    }
    previous = event.sequence;
  });

  previous = 0;
  completion.checkAttempts.forEach((attempt, index) => {
    if (attempt.sequence <= previous) {
      context.addIssue({
        code: "custom",
        path: ["checkAttempts", index, "sequence"],
        message: "Check attempts must have unique, increasing sequence numbers.",
      });
    }
    previous = attempt.sequence;
  });

  previous = 0;
  completion.unitSelections.forEach((selection, index) => {
    if (selection.sequence <= previous) {
      context.addIssue({
        code: "custom",
        path: ["unitSelections", index, "sequence"],
        message: "Unit selections must have unique, increasing sequence numbers.",
      });
    }
    previous = selection.sequence;
  });

  const evidenceSequences = [
    ...(completion.practice.checkStartedSequence === null ? [] : [completion.practice.checkStartedSequence]),
    ...completion.checkAttempts.map(attempt => attempt.sequence),
    ...completion.unitSelections.map(selection => selection.sequence),
    ...completion.guidanceEvents.map(event => event.sequence),
  ];
  if (new Set(evidenceSequences).size !== evidenceSequences.length) {
    context.addIssue({
      code: "custom",
      path: ["practice", "checkStartedSequence"],
      message: "Check start, attempts, unit selections, and guidance must share unique sequence numbers.",
    });
  }
});

export const PerimeterMissionAdmissionV1Schema = z.object({
  missionId: z.literal("perimeter-secure-boundary"),
  contentSchemaVersion: z.literal(1),
  lessonId: z.string().min(1).max(120),
  contentRevision: z.string().min(1).max(120),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  scorePolicyId: z.literal("none"),
  checkSequence: z.object({
    scope: z.literal("full-lesson"),
    initialCheckProblemId: z.string().min(1).max(120),
    freshAlternativeProblemIds: z.array(z.string().min(1).max(120)).max(16),
    requiredCompletionFacts: z.tuple([
      z.literal("practice-boundary"),
      z.literal("independent-check-boundary"),
      z.literal("explicit-total"),
      z.literal("explicit-unit"),
      z.literal("unassisted-independent-check"),
    ]),
  }).strict(),
  problems: z.array(z.object({
    problemId: z.string().min(1).max(120),
    role: z.enum(["practice", "check"]),
    linearUnit: LinearUnitSchema,
    exposureIdentitySha256: z.string().regex(/^[a-f0-9]{64}$/),
    edges: z.array(z.object({
      id: z.string().min(1).max(128),
      lengthSubunits: z.number().int().min(1).max(MAX_SAFE_TOTAL),
    }).strict()).min(4).max(256),
  }).strict()).min(2).max(17),
}).strict().superRefine((admission, context) => {
  const problemIds = admission.problems.map(problem => problem.problemId);
  if (new Set(problemIds).size !== problemIds.length) {
    context.addIssue({ code: "custom", path: ["problems"], message: "Admitted problem IDs must be unique." });
  }
  if (admission.problems.filter(problem => problem.role === "practice").length !== 1) {
    context.addIssue({ code: "custom", path: ["problems"], message: "Admission requires exactly one practice problem." });
  }
  if (!admission.problems.some(problem => problem.role === "check")) {
    context.addIssue({ code: "custom", path: ["problems"], message: "Admission requires at least one independent check problem." });
  }
  const checkIds = [admission.checkSequence.initialCheckProblemId, ...admission.checkSequence.freshAlternativeProblemIds];
  if (new Set(checkIds).size !== checkIds.length) {
    context.addIssue({ code: "custom", path: ["checkSequence"], message: "Initial and alternative check IDs must be unique." });
  }
  const problemById = new Map(admission.problems.map(problem => [problem.problemId, problem]));
  if (admission.problems.filter(problem => problem.role === "check").length !== checkIds.length ||
      checkIds.some(id => problemById.get(id)?.role !== "check")) {
    context.addIssue({ code: "custom", path: ["checkSequence"], message: "The admitted check sequence must name every check exactly once." });
  }
  if (!checkIds.length || checkIds[0] !== admission.checkSequence.initialCheckProblemId) {
    context.addIssue({ code: "custom", path: ["checkSequence"], message: "A check sequence must begin with its initial check." });
  }
  const exposureIdentities = admission.problems.map(problem => problem.exposureIdentitySha256);
  if (new Set(exposureIdentities).size !== exposureIdentities.length) {
    context.addIssue({ code: "custom", path: ["problems"], message: "Every admitted problem must have a distinct semantic answer exposure identity." });
  }
  admission.problems.forEach((problem, index) => {
    const edgeIds = problem.edges.map(edge => edge.id);
    if (new Set(edgeIds).size !== edgeIds.length) {
      context.addIssue({ code: "custom", path: ["problems", index, "edges"], message: "Admitted edge IDs must be unique within a problem." });
    }
    let total = 0;
    for (const edge of problem.edges) {
      total += edge.lengthSubunits;
      if (!Number.isSafeInteger(total)) {
        context.addIssue({ code: "custom", path: ["problems", index, "edges"], message: "Admitted perimeter total exceeds safe integer range." });
        break;
      }
    }
  });
});

export type PerimeterCompletionV4 = z.infer<typeof PerimeterCompletionV4Schema>;
export type PerimeterMissionAdmissionV1 = z.infer<typeof PerimeterMissionAdmissionV1Schema>;

export type PerimeterCompletionV4Projection = {
  completionVersion: 4;
  missionId: "perimeter-secure-boundary";
  contentSchemaVersion: 1;
  lessonId: string;
  contentRevision: string;
  contentSha256: string;
  outcome: PerimeterCompletionV4["outcome"];
  practice: {
    problemId: string;
    requiredEdgeIds: string[];
    acceptedEdgeIds: string[];
    accountedTotalSubunits: number;
    isComplete: boolean;
    checkStartedSequence: number | null;
  };
  checkAttempts: Array<{
    sequence: number;
    unitSelectionSequence: number;
    problemId: string;
    requiredEdgeIds: string[];
    acceptedEdgeIds: string[];
    accountedTotalSubunits: number;
    expectedTotalSubunits: number;
    submittedTotalSubunits: number;
    expectedUnit: z.infer<typeof LinearUnitSchema>;
    submittedUnit: z.infer<typeof LinearUnitSchema>;
    boundaryComplete: boolean;
    mathematicallyCorrect: boolean;
    independentlyCorrect: boolean;
  }>;
  unitSelections: PerimeterCompletionV4["unitSelections"];
  guidanceEvents: PerimeterCompletionV4["guidanceEvents"];
  timing: { status: "not-measured" };
  scorePolicyId: "none";
};

export type PerimeterCompletionV4Validation =
  | { ok: true; completion: PerimeterCompletionV4Projection }
  | { ok: false; code: "invalid-completion" | "invalid-admission" | "content-mismatch" | "invalid-work" | "false-completion"; details?: string[] };

function sumAcceptedEdges(problem: PerimeterMissionAdmissionV1["problems"][number], acceptedIds: string[]) {
  const edgesById = new Map(problem.edges.map(edge => [edge.id, edge.lengthSubunits]));
  let total = 0;
  for (const id of acceptedIds) {
    const length = edgesById.get(id);
    if (length === undefined) return null;
    total += length;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

function canonicalLengthsMatch(
  expectedSubunits: number,
  expectedUnit: z.infer<typeof LinearUnitSchema>,
  submittedSubunits: number,
  submittedUnit: z.infer<typeof LinearUnitSchema>,
): boolean {
  if (
    !Number.isSafeInteger(expectedSubunits) || expectedSubunits < 0 || expectedUnit === "unit" ||
    !Number.isSafeInteger(submittedSubunits) || submittedSubunits < 0 || submittedUnit === "unit"
  ) return false;

  const expectedFactor = MICROMETRES_PER_SUBUNIT[expectedUnit];
  const submittedFactor = MICROMETRES_PER_SUBUNIT[submittedUnit];
  if (expectedFactor === submittedFactor) return expectedSubunits === submittedSubunits;

  // The factors are powers of ten. Divide the larger-unit subunit count by
  // their exact ratio instead of multiplying and risking an unsafe integer.
  if (expectedFactor > submittedFactor) {
    const ratio = expectedFactor / submittedFactor;
    return submittedSubunits % ratio === 0 && submittedSubunits / ratio === expectedSubunits;
  }

  const ratio = submittedFactor / expectedFactor;
  return expectedSubunits % ratio === 0 && expectedSubunits / ratio === submittedSubunits;
}

function canonicalAcceptedIds(problem: PerimeterMissionAdmissionV1["problems"][number], acceptedIds: string[]) {
  const accepted = new Set(acceptedIds);
  return problem.edges.filter(edge => accepted.has(edge.id)).map(edge => edge.id);
}

export function validatePerimeterCompletionV4AgainstAdmission(
  rawCompletion: unknown,
  rawAdmission: unknown,
): PerimeterCompletionV4Validation {
  const parsedCompletion = PerimeterCompletionV4Schema.safeParse(rawCompletion);
  if (!parsedCompletion.success) {
    return { ok: false, code: "invalid-completion", details: parsedCompletion.error.issues.map(issue => issue.message) };
  }
  const parsedAdmission = PerimeterMissionAdmissionV1Schema.safeParse(rawAdmission);
  if (!parsedAdmission.success) {
    return { ok: false, code: "invalid-admission", details: parsedAdmission.error.issues.map(issue => issue.message) };
  }

  const completion = parsedCompletion.data;
  const admission = parsedAdmission.data;
  if (
    completion.missionId !== admission.missionId ||
    completion.lessonId !== admission.lessonId ||
    completion.contentRevision !== admission.contentRevision ||
    completion.contentSha256 !== admission.contentSha256 ||
    completion.scorePolicyId !== admission.scorePolicyId
  ) {
    return { ok: false, code: "content-mismatch" };
  }

  const practiceProblem = admission.problems.find(problem => problem.role === "practice");
  if (!practiceProblem || completion.practice.problemId !== practiceProblem.problemId) {
    return { ok: false, code: "invalid-work", details: ["Practice problem does not match the server-admitted lesson."] };
  }
  const practiceTotal = sumAcceptedEdges(practiceProblem, completion.practice.acceptedEdgeIds);
  if (practiceTotal === null) return { ok: false, code: "invalid-work", details: ["Practice contains an unknown edge or unsafe total."] };
  const practiceAcceptedIds = canonicalAcceptedIds(practiceProblem, completion.practice.acceptedEdgeIds);
  const practiceComplete = practiceAcceptedIds.length === practiceProblem.edges.length;

  const problemById = new Map(admission.problems.map(problem => [problem.problemId, problem]));
  for (const event of completion.guidanceEvents) {
    const problem = problemById.get(event.problemId);
    if (!problem || problem.role !== event.stage) {
      return { ok: false, code: "invalid-work", details: ["Guidance event is not attached to an admitted problem and stage."] };
    }
  }

  const checkStartedSequence = completion.practice.checkStartedSequence;
  const hasCheckActivity = completion.checkAttempts.length > 0 ||
    completion.unitSelections.length > 0 ||
    completion.guidanceEvents.some(event => event.stage === "check");
  if (checkStartedSequence !== null && !practiceComplete) {
    return { ok: false, code: "false-completion", details: ["The independent check cannot start before practice covers the full boundary."] };
  }
  if (hasCheckActivity && (!practiceComplete || checkStartedSequence === null)) {
    return { ok: false, code: "false-completion", details: ["Check history requires a completed practice boundary and an ordered check start."] };
  }
  for (const event of completion.guidanceEvents) {
    if (event.stage === "practice" && checkStartedSequence !== null && event.sequence >= checkStartedSequence) {
      return { ok: false, code: "invalid-work", details: ["Practice guidance cannot occur after the check starts."] };
    }
    if (event.stage === "check" && (checkStartedSequence === null || event.sequence <= checkStartedSequence)) {
      return { ok: false, code: "invalid-work", details: ["Check guidance must occur after the ordered check start."] };
    }
  }
  if (completion.checkAttempts.some(attempt => checkStartedSequence === null || attempt.sequence <= checkStartedSequence)) {
    return { ok: false, code: "invalid-work", details: ["Check attempts must occur after the ordered check start."] };
  }
  if (completion.unitSelections.some(selection => checkStartedSequence === null || selection.sequence <= checkStartedSequence)) {
    return { ok: false, code: "invalid-work", details: ["Unit selections must occur after the ordered check start."] };
  }

  const attemptFacts: Array<{
    problemId: string;
    usedAnswerReveal: boolean;
    unitSelectionSequence: number;
    projection: PerimeterCompletionV4Projection["checkAttempts"][number];
  }> = [];
  for (const attempt of completion.checkAttempts) {
    const problem = problemById.get(attempt.problemId);
    if (!problem || problem.role !== "check") {
      return { ok: false, code: "invalid-work", details: ["Check attempt is not attached to an admitted check problem."] };
    }
    const accountedTotal = sumAcceptedEdges(problem, attempt.acceptedEdgeIds);
    if (accountedTotal === null) {
      return { ok: false, code: "invalid-work", details: ["Check attempt contains an unknown edge or unsafe total."] };
    }
    const acceptedIds = canonicalAcceptedIds(problem, attempt.acceptedEdgeIds);
    const boundaryComplete = acceptedIds.length === problem.edges.length;
    const expectedTotal = problem.edges.reduce((total, edge) => total + edge.lengthSubunits, 0);
    if (!Number.isSafeInteger(expectedTotal)) {
      return { ok: false, code: "invalid-admission", details: ["Admitted perimeter total exceeds safe integer range."] };
    }
    const mathematicallyCorrect = boundaryComplete &&
      canonicalLengthsMatch(expectedTotal, problem.linearUnit, attempt.submittedTotalSubunits, attempt.submittedUnit);
    attemptFacts.push({
      problemId: problem.problemId,
      usedAnswerReveal: attempt.usedAnswerReveal,
      unitSelectionSequence: attempt.unitSelectionSequence,
      projection: {
        sequence: attempt.sequence,
        unitSelectionSequence: attempt.unitSelectionSequence,
        problemId: problem.problemId,
        requiredEdgeIds: problem.edges.map(edge => edge.id),
        acceptedEdgeIds: acceptedIds,
        accountedTotalSubunits: accountedTotal,
        expectedTotalSubunits: expectedTotal,
        submittedTotalSubunits: attempt.submittedTotalSubunits,
        expectedUnit: problem.linearUnit,
        submittedUnit: attempt.submittedUnit,
        boundaryComplete,
        mathematicallyCorrect,
        independentlyCorrect: false,
      },
    });
  }

  let currentCheckProblemId = admission.checkSequence.initialCheckProblemId;
  let nextFreshAlternativeIndex = 0;
  const visitedCheckProblemIds = new Set<string>([currentCheckProblemId]);
  let currentAnswerRevealed = false;
  let currentCheckSolvedWithGuidance = false;
  let terminalIndependentSuccess = false;
  let currentSelectedUnit: PerimeterCompletionV4["unitSelections"][number]["unit"] | null = null;
  let currentUnitSelectionSequence: number | null = null;
  const timeline = [
    ...completion.guidanceEvents.map((event, index) => ({ sequence: event.sequence, kind: "guidance" as const, index })),
    ...completion.unitSelections.map((selection, index) => ({ sequence: selection.sequence, kind: "unit-selection" as const, index })),
    ...completion.checkAttempts.map((attempt, index) => ({ sequence: attempt.sequence, kind: "attempt" as const, index })),
  ].sort((left, right) => left.sequence - right.sequence);

  const advanceToFreshAlternative = (problemId: string): boolean => {
    const expectedAlternative = admission.checkSequence.freshAlternativeProblemIds[nextFreshAlternativeIndex];
    if (!currentAnswerRevealed || problemId !== expectedAlternative || visitedCheckProblemIds.has(problemId)) return false;
    currentCheckProblemId = problemId;
    visitedCheckProblemIds.add(problemId);
    nextFreshAlternativeIndex++;
    currentAnswerRevealed = false;
    currentCheckSolvedWithGuidance = false;
    currentSelectedUnit = null;
    currentUnitSelectionSequence = null;
    return true;
  };

  for (const item of timeline) {
    if (item.kind === "unit-selection") {
      const selection = completion.unitSelections[item.index];
      if (terminalIndependentSuccess) {
        return { ok: false, code: "false-completion", details: ["A unit selection cannot be appended after an independent success."] };
      }
      if (selection.problemId !== currentCheckProblemId && !advanceToFreshAlternative(selection.problemId)) {
        return { ok: false, code: "invalid-work", details: ["Unit selections do not follow the admitted initial-to-fresh check sequence or an earlier answer reveal."] };
      }
      if (currentCheckSolvedWithGuidance) {
        return { ok: false, code: "invalid-work", details: ["A guided correct check is terminal for that problem; continue with admitted fresh content."] };
      }
      currentSelectedUnit = selection.unit;
      currentUnitSelectionSequence = selection.sequence;
      continue;
    }

    if (item.kind === "guidance") {
      const event = completion.guidanceEvents[item.index];
      if (event.stage !== "check") continue;
      if (terminalIndependentSuccess) {
        return { ok: false, code: "false-completion", details: ["Check guidance cannot be appended after an independent success."] };
      }
      if (event.problemId !== currentCheckProblemId && !advanceToFreshAlternative(event.problemId)) {
        return { ok: false, code: "invalid-work", details: ["Check guidance does not follow the admitted initial-to-fresh sequence or an earlier answer reveal."] };
      }
      if (currentCheckSolvedWithGuidance) {
        return { ok: false, code: "invalid-work", details: ["A guided correct check is terminal for that problem; continue with admitted fresh content."] };
      }
      if (event.kind === "answer-reveal") {
        currentAnswerRevealed = true;
        currentSelectedUnit = null;
        currentUnitSelectionSequence = null;
      }
      continue;
    }

    if (terminalIndependentSuccess) {
      return { ok: false, code: "false-completion", details: ["An independent success is terminal; later check attempts cannot be appended."] };
    }
    const fact = attemptFacts[item.index];
    if (fact.problemId !== currentCheckProblemId && !advanceToFreshAlternative(fact.problemId)) {
      return { ok: false, code: "invalid-work", details: ["Check attempts do not follow the admitted initial-to-fresh sequence or require an earlier answer reveal."] };
    }
    if (currentCheckSolvedWithGuidance) {
      return { ok: false, code: "invalid-work", details: ["A guided correct check is terminal for that problem; continue with admitted fresh content."] };
    }
    if (fact.usedAnswerReveal !== currentAnswerRevealed) {
      return { ok: false, code: "invalid-work", details: ["Answer-reveal provenance does not match the ordered guidance history."] };
    }
    if (fact.unitSelectionSequence !== currentUnitSelectionSequence ||
        fact.projection.submittedUnit !== currentSelectedUnit) {
      return { ok: false, code: "invalid-work", details: ["Each answer must use the latest explicit unit choice made for the active check problem."] };
    }
    fact.projection.independentlyCorrect = fact.projection.mathematicallyCorrect && !currentAnswerRevealed;
    if (fact.projection.independentlyCorrect) terminalIndependentSuccess = true;
    else if (fact.projection.mathematicallyCorrect && currentAnswerRevealed) currentCheckSolvedWithGuidance = true;
  }

  const checkAttempts = attemptFacts.map(fact => fact.projection);

  const lastCheck = checkAttempts.at(-1);
  if (completion.outcome === "completed" && (
    !practiceComplete ||
    !lastCheck?.independentlyCorrect
  )) {
    return { ok: false, code: "false-completion", details: ["Completion requires all practice edges and a fresh, fully accounted, unassisted check with the admitted total and unit."] };
  }
  if (completion.outcome !== "completed" && lastCheck?.independentlyCorrect) {
    return { ok: false, code: "false-completion", details: ["A completed independent check must use the completed terminal outcome."] };
  }

  return {
    ok: true,
    completion: {
      completionVersion: 4,
      missionId: admission.missionId,
      contentSchemaVersion: admission.contentSchemaVersion,
      lessonId: admission.lessonId,
      contentRevision: admission.contentRevision,
      contentSha256: admission.contentSha256,
      outcome: completion.outcome,
      practice: {
        problemId: practiceProblem.problemId,
        requiredEdgeIds: practiceProblem.edges.map(edge => edge.id),
        acceptedEdgeIds: practiceAcceptedIds,
        accountedTotalSubunits: practiceTotal,
        isComplete: practiceComplete,
        checkStartedSequence,
      },
      checkAttempts,
      unitSelections: completion.unitSelections,
      guidanceEvents: completion.guidanceEvents,
      timing: { status: "not-measured" },
      scorePolicyId: "none",
    },
  };
}

