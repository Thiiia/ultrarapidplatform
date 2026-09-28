export type LessonRhythmSourceProvenance = {
  activityKey: string;
  revision: string;
  chartSha256: string;
  audioSha256: string;
};

export function resolveLessonSaveRhythmSource({
  activityKey,
  chartSource,
  resolvedRhythmSource,
  previousRhythmSource,
}: {
  activityKey: string;
  chartSource: "submitted" | "preserved" | "shared-rhythm";
  resolvedRhythmSource: LessonRhythmSourceProvenance | null;
  previousRhythmSource: LessonRhythmSourceProvenance | null;
}): LessonRhythmSourceProvenance | null {
  if (activityKey !== "number-bonds") {
    return resolvedRhythmSource;
  }

  if (chartSource === "submitted") {
    throw new Error("Number Bonds must reuse a verified Early Algebra rhythm chart");
  }

  const source = resolvedRhythmSource ?? previousRhythmSource;
  if (!source) {
    throw new Error("Choose an Early Algebra rhythm source before saving this Number Bonds lesson");
  }
  if (source.activityKey !== "early-algebra") {
    throw new Error("Number Bonds rhythm provenance must point to an Early Algebra revision");
  }

  return source;
}
