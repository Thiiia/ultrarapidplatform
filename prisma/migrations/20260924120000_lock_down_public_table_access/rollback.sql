-- Use only if the grant-reduction migration is rolled back after review.
-- These grants reproduce the observed pre-migration ACLs: full table rights on
-- the listed server-only tables, and SELECT only on SongAsset.

GRANT ALL PRIVILEGES ON TABLE public."_prisma_migrations" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."User" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."Mission" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."Progress" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."School" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."Class" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."ClassStudent" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."Assignment" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."SongChart" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."player_launch_attempts" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."player_run_outcomes" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."RosterImport" TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."TeacherClass" TO anon, authenticated;
GRANT SELECT ON TABLE public."SongAsset" TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_game_content_revision_state_machine() TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
