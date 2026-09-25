export function isSameOriginLessonSaveRequest(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);

  if (!origin) {
    return true;
  }

  return origin === requestUrl.origin;
}
