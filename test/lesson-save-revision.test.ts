import assert from "node:assert/strict";
import test from "node:test";

type LessonSaveRevisionModule = {
  publishLessonSaveRevision?: (input: {
    targets: {
      chart: { bucket: string; path: string };
      sidecar: { bucket: string; path: string };
    };
    revisionId: string;
    content: { chart: string; sidecar: string };
    upload: (file: {
      bucket: string;
      path: string;
      content: string;
      contentType: string;
    }) => Promise<void>;
    commitRevision?: (next: {
      revisionId: string;
      chart: { bucket: string; path: string; content: string };
      sidecar: { bucket: string; path: string; content: string };
    }) => Promise<void>;
    recordRevision?: (next: {
      revisionId: string;
      chart: { bucket: string; path: string; content: string };
      sidecar: { bucket: string; path: string; content: string };
    }) => Promise<void>;
    updatePointers: (next: {
      chartPath: string;
      sidecarPath: string;
    }) => Promise<boolean>;
  }) => Promise<{
    chart: { bucket: string; path: string };
    sidecar: { bucket: string; path: string };
  }>;
};

async function loadLessonSaveRevisionModule(): Promise<LessonSaveRevisionModule | null> {
  try {
    return (await import("../lib/lesson-save-revision")) as LessonSaveRevisionModule;
  } catch {
    return null;
  }
}

test("does not move song asset pointers when a revision sidecar upload fails", async () => {
  const revision = await loadLessonSaveRevisionModule();

  assert.equal(
    typeof revision?.publishLessonSaveRevision,
    "function",
    "lesson saves must publish a paired immutable revision",
  );

  const uploadedPaths: string[] = [];
  let pointerUpdateAttempts = 0;

  await assert.rejects(
    revision!.publishLessonSaveRevision!({
      targets: {
        chart: { bucket: "Charts", path: "Early_Algebra/revisions/current/waves.chart" },
        sidecar: {
          bucket: "SidecarJsons",
          path: "Early_Algebra/revisions/current/waves.json",
        },
      },
      revisionId: "revision-123",
      content: { chart: "[Song]", sidecar: "{\"events\":[]}" },
      upload: async (file) => {
        uploadedPaths.push(file.path);
        if (file.contentType.startsWith("application/json")) {
          throw new Error("sidecar write failed");
        }
      },
      updatePointers: async () => {
        pointerUpdateAttempts += 1;
        return true;
      },
    }),
    /sidecar write failed/,
  );

  assert.deepEqual(uploadedPaths, [
    "Early_Algebra/revisions/revision-123/waves.chart",
    "Early_Algebra/revisions/revision-123/waves.json",
  ]);
  assert.equal(pointerUpdateAttempts, 0);
});

test("moves both pointers to the same immutable revision after both uploads succeed", async () => {
  const revision = await loadLessonSaveRevisionModule();
  const pointerUpdates: Array<{ chartPath: string; sidecarPath: string }> = [];

  const published = await revision!.publishLessonSaveRevision!({
    targets: {
      chart: { bucket: "Charts", path: "Early_Algebra/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Early_Algebra/waves.json" },
    },
    revisionId: "revision-456",
    content: { chart: "[Song]", sidecar: "{\"events\":[]}" },
    upload: async () => undefined,
    updatePointers: async (next) => {
      pointerUpdates.push(next);
      return true;
    },
  });

  assert.deepEqual(published, {
    chart: {
      bucket: "Charts",
      path: "Early_Algebra/revisions/revision-456/waves.chart",
    },
    sidecar: {
      bucket: "SidecarJsons",
      path: "Early_Algebra/revisions/revision-456/waves.json",
    },
  });
  assert.deepEqual(pointerUpdates, [
    {
      chartPath: "Early_Algebra/revisions/revision-456/waves.chart",
      sidecarPath: "Early_Algebra/revisions/revision-456/waves.json",
    },
  ]);
});

test("uses one atomic commit callback after both immutable assets upload", async () => {
  const revision = await loadLessonSaveRevisionModule();
  let legacyRecordCalls = 0;
  let legacyPointerCalls = 0;
  const commits: string[] = [];

  const published = await revision!.publishLessonSaveRevision!({
    targets: {
      chart: { bucket: "Charts", path: "Early_Algebra/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Early_Algebra/waves.json" },
    },
    revisionId: "revision-atomic",
    content: { chart: "[Song]", sidecar: "{\"events\":[]}" },
    upload: async () => undefined,
    commitRevision: async (next) => {
      commits.push(`${next.revisionId}:${next.chart.path}:${next.sidecar.path}`);
    },
    recordRevision: async () => { legacyRecordCalls += 1; },
    updatePointers: async () => {
      legacyPointerCalls += 1;
      return true;
    },
  });

  assert.equal(published.chart.path, "Early_Algebra/revisions/revision-atomic/waves.chart");
  assert.deepEqual(commits, [
    "revision-atomic:Early_Algebra/revisions/revision-atomic/waves.chart:Early_Algebra/revisions/revision-atomic/waves.json",
  ]);
  assert.equal(legacyRecordCalls, 0);
  assert.equal(legacyPointerCalls, 0);
});
