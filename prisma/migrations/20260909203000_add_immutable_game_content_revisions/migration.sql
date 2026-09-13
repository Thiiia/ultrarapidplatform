CREATE TYPE public.game_content_revision_status AS ENUM ('draft', 'publishing', 'ready', 'failed');

CREATE TABLE public.game_content_revisions (
  revision uuid PRIMARY KEY,
  song_chart_id text NOT NULL REFERENCES public."SongChart"(id) ON DELETE RESTRICT,
  song_asset_id text NOT NULL REFERENCES public."SongAsset"(id) ON DELETE RESTRICT,
  activity_key text NOT NULL,
  author_id text NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
  chart_bucket text NOT NULL,
  chart_path text NOT NULL,
  sidecar_bucket text NOT NULL,
  sidecar_path text NOT NULL,
  audio_bucket text NOT NULL,
  audio_path text NOT NULL,
  chart_sha256 text,
  sidecar_sha256 text,
  audio_sha256 text,
  authored_lesson_version integer,
  authored_mode text,
  equation_count integer,
  encounter_count integer,
  target_count integer,
  publication_request_id text UNIQUE,
  status public.game_content_revision_status NOT NULL DEFAULT 'draft',
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT game_content_revision_ready_complete CHECK (
    status <> 'ready' OR (
      chart_sha256 IS NOT NULL AND sidecar_sha256 IS NOT NULL AND audio_sha256 IS NOT NULL AND
      authored_lesson_version = 3 AND authored_mode = 'authored' AND
      equation_count IS NOT NULL AND encounter_count IS NOT NULL AND target_count IS NOT NULL AND
      published_at IS NOT NULL
    )
  ),
  CONSTRAINT game_content_revision_target_count_valid CHECK (target_count IS NULL OR target_count >= 0),
  CONSTRAINT game_content_revision_failed_has_code CHECK (status <> 'failed' OR failure_code IS NOT NULL)
);

CREATE INDEX game_content_revisions_launch_idx
  ON public.game_content_revisions (song_asset_id, activity_key, author_id, status, published_at DESC);

ALTER TABLE public.game_content_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_content_revisions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_game_content_revision_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('ready', 'failed') THEN
      RAISE EXCEPTION 'immutable game content revision cannot be changed after %', OLD.status;
    END IF;
    IF NEW.revision <> OLD.revision THEN
      RAISE EXCEPTION 'revision identity is immutable';
    END IF;
  END IF;

  IF NEW.status = 'ready' THEN
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = NEW.chart_bucket AND name = NEW.chart_path) OR
       NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = NEW.sidecar_bucket AND name = NEW.sidecar_path) OR
       NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = NEW.audio_bucket AND name = NEW.audio_path) THEN
      RAISE EXCEPTION 'ready revision requires chart, sidecar, and audio storage objects';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_game_content_revision_transition() FROM PUBLIC;

CREATE TRIGGER guard_game_content_revision_transition
BEFORE INSERT OR UPDATE ON public.game_content_revisions
FOR EACH ROW EXECUTE FUNCTION public.guard_game_content_revision_transition();
