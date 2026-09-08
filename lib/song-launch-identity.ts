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
