ALTER TABLE public.game_content_revisions
  ADD COLUMN publication_request_id text;

CREATE UNIQUE INDEX game_content_revisions_publication_request_id_key
  ON public.game_content_revisions(publication_request_id)
  WHERE publication_request_id IS NOT NULL;
