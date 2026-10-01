CREATE TYPE "player_launch_attempt_status" AS ENUM ('active', 'completed', 'returned');

ALTER TABLE "player_launch_attempts"
ADD COLUMN "status" "player_launch_attempt_status" NOT NULL DEFAULT 'active';
