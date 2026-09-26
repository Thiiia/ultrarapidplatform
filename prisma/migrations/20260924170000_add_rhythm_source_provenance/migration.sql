-- Persist the exact immutable rhythm revision used to bootstrap a lesson.
-- Target chart/audio hashes are already recorded on the published revision;
-- the save service verifies both against this source before commit.
ALTER TABLE public.game_content_revisions
  ADD CONSTRAINT game_content_revisions_revision_song_asset_id_key
  UNIQUE (revision, song_asset_id);

ALTER TABLE public.game_content_revisions
  ADD COLUMN rhythm_source_revision UUID;

ALTER TABLE public.game_content_revisions
  ADD CONSTRAINT game_content_revisions_rhythm_source_fk
  FOREIGN KEY (rhythm_source_revision, song_asset_id)
  REFERENCES public.game_content_revisions (revision, song_asset_id)
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

CREATE INDEX game_content_revisions_rhythm_source_revision_idx
  ON public.game_content_revisions (rhythm_source_revision);
