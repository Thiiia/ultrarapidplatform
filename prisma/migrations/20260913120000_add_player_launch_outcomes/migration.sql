CREATE TABLE "player_launch_attempts" (
    "id" TEXT NOT NULL,
    "launchAttemptId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "songAssetId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "revision" TEXT,
    "source" TEXT NOT NULL,
    "templateId" TEXT,
    "receipt" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_launch_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_launch_attempts_launchAttemptId_key" ON "player_launch_attempts"("launchAttemptId");
CREATE UNIQUE INDEX "player_launch_attempts_launchAttemptId_userId_key" ON "player_launch_attempts"("launchAttemptId", "userId");
CREATE INDEX "player_launch_attempts_userId_createdAt_idx" ON "player_launch_attempts"("userId", "createdAt");
CREATE INDEX "player_launch_attempts_songAssetId_activityKey_revision_idx" ON "player_launch_attempts"("songAssetId", "activityKey", "revision");

CREATE TABLE "player_run_outcomes" (
    "id" TEXT NOT NULL,
    "launchAttemptId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "completedEvents" INTEGER NOT NULL DEFAULT 0,
    "hitAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_run_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_run_outcomes_launchAttemptId_key" ON "player_run_outcomes"("launchAttemptId");
CREATE UNIQUE INDEX "player_run_outcomes_launchAttemptId_userId_key" ON "player_run_outcomes"("launchAttemptId", "userId");
CREATE INDEX "player_run_outcomes_userId_createdAt_idx" ON "player_run_outcomes"("userId", "createdAt");
CREATE INDEX "player_run_outcomes_userId_outcome_idx" ON "player_run_outcomes"("userId", "outcome");

ALTER TABLE "player_launch_attempts" ADD CONSTRAINT "player_launch_attempts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_run_outcomes" ADD CONSTRAINT "player_run_outcomes_launchAttemptId_userId_fkey"
    FOREIGN KEY ("launchAttemptId", "userId") REFERENCES "player_launch_attempts"("launchAttemptId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_run_outcomes" ADD CONSTRAINT "player_run_outcomes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
