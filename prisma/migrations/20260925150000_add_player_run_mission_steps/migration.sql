ALTER TABLE "player_run_outcomes"
ADD COLUMN "mission_steps" JSONB;

ALTER TABLE "player_run_outcomes"
DROP CONSTRAINT "player_run_outcomes_completion_version_check";

ALTER TABLE "player_run_outcomes"
ADD CONSTRAINT "player_run_outcomes_completion_version_check"
CHECK ("completionVersion" IS NULL OR "completionVersion" IN (2, 3));
