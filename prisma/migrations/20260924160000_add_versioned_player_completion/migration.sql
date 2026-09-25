-- Preserve legacy rows without fabricating required-event or solved-set counts.
ALTER TABLE "player_run_outcomes"
  ADD COLUMN "completionVersion" INTEGER,
  ADD COLUMN "requiredEvents" INTEGER,
  ADD COLUMN "solvedSets" INTEGER;

ALTER TABLE "player_run_outcomes"
  ADD CONSTRAINT "player_run_outcomes_completion_version_check"
    CHECK ("completionVersion" IS NULL OR "completionVersion" = 2),
  ADD CONSTRAINT "player_run_outcomes_v2_counts_check"
    CHECK (
      "completionVersion" IS NULL OR (
        "requiredEvents" IS NOT NULL AND "requiredEvents" >= "completedEvents" AND
        "solvedSets" IS NOT NULL AND "solvedSets" <= "completedEvents"
      )
    ),
  ADD CONSTRAINT "player_run_outcomes_v2_completed_check"
    CHECK (
      "completionVersion" IS NULL OR "outcome" <> 'completed' OR
      ("requiredEvents" > 0 AND "completedEvents" = "requiredEvents" AND "solvedSets" > 0)
    );
