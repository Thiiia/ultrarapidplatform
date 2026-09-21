import {
  inferSongActivityKeyFromChartPath,
  normalizeSongActivityKey,
  type SongActivityKey,
} from "./song-activity-storage";

export type SongActivityIdentitySource =
  | "route"
  | "session"
  | "selected-payload"
  | "legacy-chart-path"
  | "none";

export type ResolvedSongActivityIdentity = {
  activityKey: SongActivityKey | null;
  source: SongActivityIdentitySource;
};

function normalizeExplicitActivity(
  value: string | null | undefined,
  label: string,
): SongActivityKey | null {
  if (value == null || value.trim().length === 0) return null;
  const normalized = normalizeSongActivityKey(value);
  if (!normalized) {
    throw new Error(`Unsupported ${label} activity: ${value}`);
  }
  return normalized;
}

/**
 * Resolve the identity of an opened lesson without allowing a stale payload
 * or chart folder to replace an explicit flow intent.
 *
 * The selected payload is a recovery fallback only. A chart path is the final
 * legacy fallback and never overrides a route/session identity.
 */
export function resolveSongActivityIdentity({
  routeActivityKey,
  sessionActivityKey,
  selectedPayloadActivityKey,
  chartPath,
}: {
  routeActivityKey?: string | null;
  sessionActivityKey?: string | null;
  selectedPayloadActivityKey?: string | null;
  chartPath?: string | null;
}): ResolvedSongActivityIdentity {
  const route = normalizeExplicitActivity(routeActivityKey, "route");
  if (route) return { activityKey: route, source: "route" };

  const session = normalizeExplicitActivity(sessionActivityKey, "session");
  if (session) return { activityKey: session, source: "session" };

  const selectedPayload = normalizeExplicitActivity(
    selectedPayloadActivityKey,
    "selected payload",
  );
  if (selectedPayload) {
    return { activityKey: selectedPayload, source: "selected-payload" };
  }

  const legacy = chartPath ? inferSongActivityKeyFromChartPath(chartPath) : null;
  if (legacy) return { activityKey: legacy, source: "legacy-chart-path" };

  return { activityKey: null, source: "none" };
}

/**
 * Activity identity is a consistency assertion at package/sidecar boundaries,
 * never a value to be adopted from the resource being checked.
 */
export function assertSongActivityMatches({
  expectedActivityKey,
  actualActivityKey,
  boundary,
}: {
  expectedActivityKey: string;
  actualActivityKey: string | null | undefined;
  boundary: string;
}): SongActivityKey {
  const expected = normalizeExplicitActivity(expectedActivityKey, "requested");
  const actual = normalizeExplicitActivity(actualActivityKey, boundary);
  if (!expected || !actual || expected !== actual) {
    throw new Error(
      `Activity identity mismatch at ${boundary}: requested ${expectedActivityKey}, received ${actualActivityKey ?? "none"}`,
    );
  }
  return expected;
}
