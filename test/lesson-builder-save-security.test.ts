import assert from "node:assert/strict";
import test from "node:test";

type SaveRouteSecurity = {
  getLessonSaveAuthorizationError?: (user: {
    role: "student" | "teacher" | "admin";
    status: "active" | "inactive" | "invited" | "suspended";
  } | null) => { error: "Unauthorized" | "Forbidden"; status: 401 | 403 } | null;
  getAllowedLessonSaveTargets?: (
    songAsset: Record<string, unknown>,
    activityKey: "number-bonds" | "equations" | "missing-numbers" | "early-algebra",
  ) => {
    chart: { bucket: string; path: string };
    sidecar: { bucket: string; path: string };
  };
  hasAllowedLessonSaveTargets?: (
    files: {
      chart: { bucket: unknown; path: unknown };
      sidecar: { bucket: unknown; path: unknown };
    },
    targets: {
      chart: { bucket: string; path: string };
      sidecar: { bucket: string; path: string };
    },
  ) => boolean;
};

const songAsset = {
  chartBucket: "Charts",
  sidecarBucket: "SidecarJsons",
  numberBondsChartPath: "Number_Bonds/waves.chart",
  equationsChartPath: "Equations/waves.chart",
  missingNumbersChartPath: "Missing_Numbers/waves.chart",
  earlyAlgebraChartPath: "Early_Algebra/waves.chart",
  numberBondsSidecarPath: "Number_Bonds/waves.json",
  equationsSidecarPath: "Equations/waves.json",
  missingNumbersSidecarPath: "Missing_Numbers/waves.json",
  earlyAlgebraSidecarPath: "Early_Algebra/waves.json",
};

async function loadSaveRoute(): Promise<SaveRouteSecurity> {
  return (await import("../app/api/lesson-builder/save/route")) as SaveRouteSecurity;
}

test("rejects unauthenticated and non-editor lesson saves", async () => {
  const saveRoute = await loadSaveRoute();

  assert.equal(
    typeof saveRoute.getLessonSaveAuthorizationError,
    "function",
    "save route must expose its authorization guard",
  );
  assert.deepEqual(saveRoute.getLessonSaveAuthorizationError!(null), {
    error: "Unauthorized",
    status: 401,
  });
  assert.deepEqual(
    saveRoute.getLessonSaveAuthorizationError!({
      role: "student",
      status: "active",
    }),
    { error: "Forbidden", status: 403 },
  );
  assert.deepEqual(
    saveRoute.getLessonSaveAuthorizationError!({
      role: "teacher",
      status: "suspended",
    }),
    { error: "Forbidden", status: 403 },
  );
});

test("allows active teacher and admin lesson saves", async () => {
  const saveRoute = await loadSaveRoute();

  assert.equal(
    typeof saveRoute.getLessonSaveAuthorizationError,
    "function",
    "save route must expose its authorization guard",
  );
  assert.equal(
    saveRoute.getLessonSaveAuthorizationError!({
      role: "teacher",
      status: "active",
    }),
    null,
  );
  assert.equal(
    saveRoute.getLessonSaveAuthorizationError!({
      role: "admin",
      status: "active",
    }),
    null,
  );
});

test("derives lesson save targets from the selected song asset activity", async () => {
  const saveRoute = await loadSaveRoute();

  assert.equal(
    typeof saveRoute.getAllowedLessonSaveTargets,
    "function",
    "save route must expose server-owned storage target resolution",
  );
  assert.deepEqual(
    saveRoute.getAllowedLessonSaveTargets!(songAsset, "number-bonds"),
    {
      chart: { bucket: "Charts", path: "Number_Bonds/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/waves.json" },
    },
  );
  assert.deepEqual(
    saveRoute.getAllowedLessonSaveTargets!(songAsset, "equations"),
    {
      chart: { bucket: "Charts", path: "Equations/waves.chart" },
      sidecar: { bucket: "SidecarJsons", path: "Equations/waves.json" },
    },
  );
});

test("rejects client bucket or path values outside the selected song targets", async () => {
  const saveRoute = await loadSaveRoute();
  const targets = saveRoute.getAllowedLessonSaveTargets!(songAsset, "number-bonds");

  assert.equal(
    typeof saveRoute.hasAllowedLessonSaveTargets,
    "function",
    "save route must validate client targets against the selected song asset",
  );
  assert.equal(
    saveRoute.hasAllowedLessonSaveTargets!(
      {
        chart: { bucket: "OtherCharts", path: "Number_Bonds/waves.chart" },
        sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/waves.json" },
      },
      targets,
    ),
    false,
  );
  assert.equal(
    saveRoute.hasAllowedLessonSaveTargets!(
      {
        chart: { bucket: undefined, path: "Number_Bonds/waves.chart" },
        sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/waves.json" },
      },
      targets,
    ),
    false,
  );
  assert.equal(
    saveRoute.hasAllowedLessonSaveTargets!(
      {
        chart: { bucket: "Charts", path: "Number_Bonds/waves.chart" },
        sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/other.json" },
      },
      targets,
    ),
    false,
  );
  assert.equal(
    saveRoute.hasAllowedLessonSaveTargets!(
      {
        chart: { bucket: "Charts", path: "Number_Bonds/waves.chart" },
        sidecar: { bucket: "SidecarJsons", path: "Number_Bonds/waves.json" },
      },
      targets,
    ),
    true,
  );
});
