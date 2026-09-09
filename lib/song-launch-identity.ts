export type LaunchIdentity = {
  songAssetId: string;
  activityKey: string;
  authorId: string;
  revision: string;
};

export function extractRevisionFromStoragePath(path: string): string | null {
  const match = path.match(/(?:^|\/)revisions\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function requireMatchingRevision(
  chartPath: string,
  sidecarPath: string,
  requestedRevision?: string | null,
): string {
  const chartRevision = extractRevisionFromStoragePath(chartPath);
  const sidecarRevision = extractRevisionFromStoragePath(sidecarPath);

  if (!chartRevision || !sidecarRevision) {
    throw new Error("Authored chart and sidecar must belong to an immutable revision");
  }

  if (chartRevision !== sidecarRevision) {
    throw new Error("Authored chart and sidecar revisions do not match");
  }

  if (requestedRevision && requestedRevision !== chartRevision) {
    throw new Error(`Requested revision ${requestedRevision} is not the published revision`);
  }

  return chartRevision;
}

export type SaveRevisionPrecondition =
  | { ok: true; currentRevision: string | null }
  | { ok: false; expected: string | null; found: string | null };

/**
 * Concurrency precondition for a save: the previous revision carried by the
 * edited draft must equal the revision currently published in storage. A first
 * save (no published revision yet) only proceeds when no previous revision was
 * supplied. Pure and side-effect free so the repeat-save / stale-save / first-save
 * decisions can be route-tested without storage.
 */
export function checkSaveRevisionPrecondition(
  currentChartPath: string,
  requestedRevision: string | null,
): SaveRevisionPrecondition {
  const currentRevision = extractRevisionFromStoragePath(currentChartPath);

  if (currentRevision !== requestedRevision) {
    return { ok: false, expected: requestedRevision, found: currentRevision };
  }

  return { ok: true, currentRevision };
}
