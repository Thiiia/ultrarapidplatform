type Judgement = "perfect" | "good" | "early" | "late" | "miss";

const judgementValues = new Set<Judgement>([
  "perfect",
  "good",
  "early",
  "late",
  "miss",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type StudentRunFeedback = {
  onBeatCount: number;
  totalJudgements: number;
  nextTryTip: string | null;
};

/** Summarize only explicit authored judgements; ignore other v3 telemetry rows. */
export function summarizeStudentRunFeedback(value: unknown): StudentRunFeedback | null {
  if (!Array.isArray(value)) return null;

  const counts: Record<Judgement, number> = {
    perfect: 0,
    good: 0,
    early: 0,
    late: 0,
    miss: 0,
  };

  for (const step of value) {
    if (!isRecord(step) || step.recordType !== "authored-judgement") continue;
    if (typeof step.judgement !== "string" || !judgementValues.has(step.judgement as Judgement)) continue;
    counts[step.judgement as Judgement] += 1;
  }

  const totalJudgements = Object.values(counts).reduce((total, count) => total + count, 0);
  if (totalJudgements === 0) return null;

  const directionalCount = counts.early + counts.late;
  let nextTryTip: string | null = null;
  if (directionalCount >= 3 && counts.early * 3 >= directionalCount * 2) {
    nextTryTip = "Next time, try waiting a little longer before your move.";
  } else if (directionalCount >= 3 && counts.late * 3 >= directionalCount * 2) {
    nextTryTip = "Next time, try starting your move a little sooner.";
  }

  return {
    onBeatCount: counts.perfect + counts.good,
    totalJudgements,
    nextTryTip,
  };
}
