-- Support revision foreign-key checks and lookups without changing table access.
CREATE INDEX IF NOT EXISTS game_content_revisions_author_id_idx
  ON public.game_content_revisions (author_id);

CREATE INDEX IF NOT EXISTS game_content_revisions_rhythm_source_revision_song_asset_id_idx
  ON public.game_content_revisions (rhythm_source_revision, song_asset_id);

CREATE INDEX IF NOT EXISTS game_content_revisions_song_chart_id_idx
  ON public.game_content_revisions (song_chart_id);

-- The new composite index keeps the old index's left-prefix lookup capability.
DROP INDEX IF EXISTS public.game_content_revisions_rhythm_source_revision_idx;
