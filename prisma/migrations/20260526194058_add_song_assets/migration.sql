-- CreateTable
CREATE TABLE "SongAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "durationSeconds" INTEGER,
    "songBucket" TEXT NOT NULL DEFAULT 'Songs',
    "songPath" TEXT NOT NULL,
    "chartBucket" TEXT NOT NULL DEFAULT 'Charts',
    "chartPath" TEXT NOT NULL,
    "sidecarBucket" TEXT NOT NULL DEFAULT 'SidecarJsons',
    "sidecarPath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongAsset_isActive_idx" ON "SongAsset"("isActive");

-- CreateIndex
CREATE INDEX "SongAsset_title_idx" ON "SongAsset"("title");
