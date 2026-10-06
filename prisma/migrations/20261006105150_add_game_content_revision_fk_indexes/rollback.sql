-- Restore the prior rhythm-source index before removing its composite replacement.
CREATE INDEX IF NOT EXISTS game_content_revisions_rhythm_source_revision_idx
  ON public.game_content_revisions (rhythm_source_revision);

DROP INDEX IF EXISTS public.game_content_revisions_author_id_idx;
DROP INDEX IF EXISTS public.game_content_revisions_rhythm_source_revision_song_asset_id_idx;
DROP INDEX IF EXISTS public.game_content_revisions_song_chart_id_idx;
