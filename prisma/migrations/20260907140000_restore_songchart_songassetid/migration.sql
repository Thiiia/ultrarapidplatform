ALTER TABLE "SongChart"
  ADD COLUMN IF NOT EXISTS "songAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SongChart'
      AND column_name = 'song'
  ) THEN
    UPDATE "SongChart"
    SET "songAssetId" = "song"
    WHERE "songAssetId" IS NULL
      AND "song" IS NOT NULL;
  END IF;
END $$;

ALTER TABLE "SongChart"
  ALTER COLUMN "songAssetId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SongChart_songAssetId_fkey'
  ) THEN
    ALTER TABLE "SongChart"
      ADD CONSTRAINT "SongChart_songAssetId_fkey"
      FOREIGN KEY ("songAssetId") REFERENCES "SongAsset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SongChart_songAssetId_authorId_activityKey_key"
  ON "SongChart"("songAssetId", "authorId", "activityKey");

CREATE INDEX IF NOT EXISTS "SongChart_songAssetId_idx"
  ON "SongChart"("songAssetId");

CREATE INDEX IF NOT EXISTS "SongChart_authorId_idx"
  ON "SongChart"("authorId");

CREATE INDEX IF NOT EXISTS "SongChart_activityKey_idx"
  ON "SongChart"("activityKey");

ALTER TABLE "SongChart"
  DROP COLUMN IF EXISTS "song";
