const AUTHORING_VALIDATION_MESSAGE_LIMIT = 280;

/** Keep validation actionable for authors without exposing server failures. */
export function getAuthoringLessonSaveFailureMessage(
  status: number,
  serverError: unknown,
): string | null {
  if (status !== 400 && status !== 409) return null;

  const detail = typeof serverError === "string"
    ? serverError.trim().replace(/\s+/g, " ")
    : "";
  if (status === 409) {
    return detail
      ? `Save conflict: ${detail.slice(0, AUTHORING_VALIDATION_MESSAGE_LIMIT)}${detail.length > AUTHORING_VALIDATION_MESSAGE_LIMIT ? "…" : ""}`
      : "This lesson changed since you opened it. Reload the lesson before saving again.";
  }

  return detail
    ? `Could not save yet: ${detail.slice(0, AUTHORING_VALIDATION_MESSAGE_LIMIT)}${detail.length > AUTHORING_VALIDATION_MESSAGE_LIMIT ? "…" : ""}`
    : "Could not save yet. Review the lesson and try again.";
}
