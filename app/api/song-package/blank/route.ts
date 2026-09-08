import { BLANK_CHART_TEXT, BLANK_SIDECAR_JSON } from "@/lib/editor/blank-chart";

/**
 * Serves the blank starter chart/sidecar content for a song activity. Used as
 * the chart/sidecar URL in launch packages when the dev author has not
 * authored (saved) a chart for the requested song + activity yet — nothing is
 * persisted until the user saves from the lesson builder.
 *
 * `GET /api/song-package/blank?kind=chart|sidecar&activity=<activityKey>`
 *
 * The `activity` parameter is accepted for future per-activity blanks; the
 * blank content is currently activity-agnostic. CORS is open because the
 * embedded game fetches these URLs cross-origin like Supabase signed URLs.
 */
export function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  const isSidecar = kind === "sidecar";

  return new Response(isSidecar ? BLANK_SIDECAR_JSON : BLANK_CHART_TEXT, {
    headers: {
      "Content-Type": isSidecar
        ? "application/json;charset=utf-8"
        : "text/plain;charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
