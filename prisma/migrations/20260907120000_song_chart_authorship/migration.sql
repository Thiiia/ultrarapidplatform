-- CreateTable
CREATE TABLE "SongChart" (
    "id" TEXT NOT NULL,
    "songAssetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "chartBucket" TEXT NOT NULL DEFAULT 'Charts',
    "chartPath" TEXT NOT NULL,
    "sidecarBucket" TEXT DEFAULT 'SidecarJsons',
    "sidecarPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SongChart_songAssetId_authorId_activityKey_key" ON "SongChart"("songAssetId", "authorId", "activityKey");

-- CreateIndex
CREATE INDEX "SongChart_songAssetId_idx" ON "SongChart"("songAssetId");

-- CreateIndex
CREATE INDEX "SongChart_authorId_idx" ON "SongChart"("authorId");

-- CreateIndex
CREATE INDEX "SongChart_activityKey_idx" ON "SongChart"("activityKey");

-- AddForeignKey
ALTER TABLE "SongChart" ADD CONSTRAINT "SongChart_songAssetId_fkey" FOREIGN KEY ("songAssetId") REFERENCES "SongAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongChart" ADD CONSTRAINT "SongChart_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn (legacy per-activity chart/sidecar paths moved to SongChart, keyed by author)
ALTER TABLE "SongAsset" DROP COLUMN "chartBucket";
ALTER TABLE "SongAsset" DROP COLUMN "numberBondsChartPath";
ALTER TABLE "SongAsset" DROP COLUMN "equationsChartPath";
ALTER TABLE "SongAsset" DROP COLUMN "missingNumbersChartPath";
ALTER TABLE "SongAsset" DROP COLUMN "earlyAlgebraChartPath";
ALTER TABLE "SongAsset" DROP COLUMN "sidecarBucket";
ALTER TABLE "SongAsset" DROP COLUMN "numberBondsSidecarPath";
ALTER TABLE "SongAsset" DROP COLUMN "equationsSidecarPath";
ALTER TABLE "SongAsset" DROP COLUMN "missingNumbersSidecarPath";
ALTER TABLE "SongAsset" DROP COLUMN "earlyAlgebraSidecarPath";
