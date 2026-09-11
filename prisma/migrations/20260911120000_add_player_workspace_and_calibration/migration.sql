CREATE TABLE "player_lesson_workspaces" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "songAssetId" TEXT NOT NULL,
  "activityKey" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_lesson_workspaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_lesson_workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_lesson_workspaces_userId_songAssetId_activityKey_authorId_revision_key" ON "player_lesson_workspaces"("userId", "songAssetId", "activityKey", "authorId", "revision");
CREATE INDEX "player_lesson_workspaces_userId_idx" ON "player_lesson_workspaces"("userId");

CREATE TABLE "player_device_calibrations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installationId" UUID NOT NULL,
  "offsetMs" INTEGER NOT NULL,
  "protocolVersion" INTEGER NOT NULL,
  "calibratedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_device_calibrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_device_calibrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_device_calibrations_userId_installationId_key" ON "player_device_calibrations"("userId", "installationId");
CREATE INDEX "player_device_calibrations_userId_idx" ON "player_device_calibrations"("userId");

ALTER TABLE "player_lesson_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_device_calibrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_lesson_workspaces" FROM anon, authenticated;
REVOKE ALL ON TABLE "player_device_calibrations" FROM anon, authenticated;

CREATE TABLE "player_write_rate_limits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "player_write_rate_limits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_write_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_write_rate_limits_userId_action_key" ON "player_write_rate_limits"("userId", "action");
CREATE INDEX "player_write_rate_limits_windowStart_idx" ON "player_write_rate_limits"("windowStart");
ALTER TABLE "player_write_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_write_rate_limits" FROM anon, authenticated;
