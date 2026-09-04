-- Add per-activity chart/sidecar storage path columns to SongAsset.
ALTER TABLE "SongAsset"
  ADD COLUMN "numberBondsChartPath" TEXT,
  ADD COLUMN "equationsChartPath" TEXT,
  ADD COLUMN "missingNumbersChartPath" TEXT,
  ADD COLUMN "earlyAlgebraChartPath" TEXT,
  ADD COLUMN "numberBondsSidecarPath" TEXT,
  ADD COLUMN "equationsSidecarPath" TEXT,
  ADD COLUMN "missingNumbersSidecarPath" TEXT,
  ADD COLUMN "earlyAlgebraSidecarPath" TEXT;

WITH normalized_paths AS (
  SELECT
    "id",
    COALESCE(NULLIF(regexp_replace("chartPath", '^.*/', ''), ''), 'selected.chart') AS chart_file,
    COALESCE(
      NULLIF(regexp_replace(COALESCE("sidecarPath", ''), '^.*/', ''), ''),
      regexp_replace(
        COALESCE(NULLIF(regexp_replace("chartPath", '^.*/', ''), ''), 'selected.chart'),
        '\\.[^./]+$',
        '.json'
      )
    ) AS sidecar_file
  FROM "SongAsset"
)
UPDATE "SongAsset" AS asset
SET
  "numberBondsChartPath" = 'Number_Bonds/' || paths.chart_file,
  "equationsChartPath" = 'Equations/' || paths.chart_file,
  "missingNumbersChartPath" = 'Missing_Numbers/' || paths.chart_file,
  "earlyAlgebraChartPath" = 'Early_Algebra/' || paths.chart_file,
  "numberBondsSidecarPath" = 'Number_Bonds/' || paths.sidecar_file,
  "equationsSidecarPath" = 'Equations/' || paths.sidecar_file,
  "missingNumbersSidecarPath" = 'Missing_Numbers/' || paths.sidecar_file,
  "earlyAlgebraSidecarPath" = 'Early_Algebra/' || paths.sidecar_file
FROM normalized_paths AS paths
WHERE asset."id" = paths."id";

ALTER TABLE "SongAsset"
  ALTER COLUMN "numberBondsChartPath" SET NOT NULL,
  ALTER COLUMN "equationsChartPath" SET NOT NULL,
  ALTER COLUMN "missingNumbersChartPath" SET NOT NULL,
  ALTER COLUMN "earlyAlgebraChartPath" SET NOT NULL;

ALTER TABLE "SongAsset"
  DROP COLUMN "chartPath",
  DROP COLUMN "sidecarPath";
