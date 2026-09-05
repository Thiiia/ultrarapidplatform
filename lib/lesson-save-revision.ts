type StorageTarget = {
  bucket: string;
  path: string;
};

type RevisionContent = {
  chart: string;
  sidecar: string;
};

function toRevisionPath(path: string, revisionId: string) {
  const segments = path.split("/");
  const fileName = segments.pop();

  if (!fileName) {
    throw new Error("Storage target path is required");
  }

  const previousRevisionIndex = segments.lastIndexOf("revisions");
  const parentPath = (previousRevisionIndex >= 0
    ? segments.slice(0, previousRevisionIndex)
    : segments
  ).join("/");
  const revisionPath = `revisions/${revisionId}/${fileName}`;

  return parentPath ? `${parentPath}/${revisionPath}` : revisionPath;
}

export function buildLessonSaveRevisionTargets({
  targets,
  revisionId,
}: {
  targets: { chart: StorageTarget; sidecar: StorageTarget };
  revisionId: string;
}) {
  if (!revisionId.trim()) {
    throw new Error("Revision identifier is required");
  }

  return {
    chart: {
      ...targets.chart,
      path: toRevisionPath(targets.chart.path, revisionId),
    },
    sidecar: {
      ...targets.sidecar,
      path: toRevisionPath(targets.sidecar.path, revisionId),
    },
  };
}

export async function publishLessonSaveRevision({
  targets,
  revisionId,
  content,
  upload,
  updatePointers,
}: {
  targets: { chart: StorageTarget; sidecar: StorageTarget };
  revisionId: string;
  content: RevisionContent;
  upload: (file: StorageTarget & { content: string; contentType: string }) => Promise<void>;
  updatePointers: (next: { chartPath: string; sidecarPath: string }) => Promise<boolean>;
}) {
  const revisionTargets = buildLessonSaveRevisionTargets({ targets, revisionId });

  await upload({
    ...revisionTargets.chart,
    content: content.chart,
    contentType: "text/plain;charset=utf-8",
  });
  await upload({
    ...revisionTargets.sidecar,
    content: content.sidecar,
    contentType: "application/json;charset=utf-8",
  });

  const pointersUpdated = await updatePointers({
    chartPath: revisionTargets.chart.path,
    sidecarPath: revisionTargets.sidecar.path,
  });

  if (!pointersUpdated) {
    throw new Error("Song activity changed before this revision could be saved");
  }

  return revisionTargets;
}
