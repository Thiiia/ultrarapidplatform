-- Roll back only before a published lesson depends on this provenance link.
-- Dropping the column discards the source revision history for those lessons.
DROP INDEX IF EXISTS public.game_content_revisions_rhythm_source_revision_idx;

ALTER TABLE public.game_content_revisions
  DROP CONSTRAINT IF EXISTS game_content_revisions_rhythm_source_fk;

ALTER TABLE public.game_content_revisions
  DROP COLUMN IF EXISTS rhythm_source_revision;

ALTER TABLE public.game_content_revisions
  DROP CONSTRAINT IF EXISTS game_content_revisions_revision_song_asset_id_key;
