-- Drop legacy SongAsset columns no longer used by lesson builder timeline sync.
ALTER TABLE "SongAsset"
  DROP COLUMN IF EXISTS "equation_slots",
  DROP COLUMN IF EXISTS "equation_slot_ticks",
  DROP COLUMN IF EXISTS "hit_count",
  DROP COLUMN IF EXISTS "spin_count",
  DROP COLUMN IF EXISTS "drag_count";
