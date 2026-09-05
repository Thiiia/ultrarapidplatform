import assert from "node:assert/strict";
import test from "node:test";

type SaveRouteSecurity = {
  isSameOriginLessonSaveRequest?: (request: Request) => boolean;
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

test("allows the public Team Editor to save from the same origin", async () => {
  const saveRoute = await loadSaveRoute();

  assert.equal(
    typeof saveRoute.isSameOriginLessonSaveRequest,
    "function",
    "save route must allow same-origin public editor requests",
  );
  assert.equal(
    saveRoute.isSameOriginLessonSaveRequest!(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://platform.example" },
      }),
    ),
    true,
  );
  assert.equal(
    saveRoute.isSameOriginLessonSaveRequest!(
      new Request("https://platform.example/api/lesson-builder/save", {
        method: "POST",
        headers: { origin: "https://other.example" },
      }),
    ),
    false,
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

test("rejects an activity missing its own sidecar package instead of using legacy paths", async () => {
  const saveRoute = await loadSaveRoute();
  const assetWithoutEquationsSidecar = {
    ...songAsset,
    chartPath: "Legacy/waves.chart",
    sidecarPath: "Legacy/waves.json",
    equationsSidecarPath: undefined,
  };

  assert.throws(
    () =>
      saveRoute.getAllowedLessonSaveTargets!(
        assetWithoutEquationsSidecar,
        "equations",
      ),
    /Song activity sidecar path is missing/,
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
