-- Remove direct Supabase Data API access to server-owned application tables.
-- Auth0 and server-side Prisma own relational access; Storage remains private
-- and is handled independently. This migration does not enable RLS or add
-- Supabase Auth policies.

DO $migration_role$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'P9 grant migration requires the verified postgres object-owner role; current_user is %', current_user;
  END IF;
END
$migration_role$;

REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."User" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."School" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Class" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."ClassStudent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Assignment" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Mission" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Progress" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."RosterImport" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."TeacherClass" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."SongAsset" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."SongChart" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."player_launch_attempts" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."player_run_outcomes" FROM anon, authenticated;

-- This application-owned function is a trigger, not a PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.enforce_game_content_revision_state_machine()
  FROM PUBLIC, anon, authenticated;

-- Future Prisma-created public tables and sequences must not be exposed to the
-- Data API roles. Use the verified creator role explicitly rather than relying
-- on whichever role a migration runner happens to inherit.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- PostgreSQL's built-in default grants EXECUTE on new functions to PUBLIC.
-- A schema-specific REVOKE cannot cancel that global default, so remove the
-- global grant for functions created by postgres and also clear explicit
-- public-schema defaults for the Data API roles. Existing non-application
-- functions and other creator roles are untouched.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

DO $verify$
DECLARE
  v_table text;
  v_role text;
  v_privilege text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    '_prisma_migrations', 'User', 'School', 'Class', 'ClassStudent',
    'Assignment', 'Mission', 'Progress', 'RosterImport', 'TeacherClass',
    'SongAsset', 'SongChart', 'game_content_revisions',
    'player_launch_attempts', 'player_run_outcomes',
    'player_lesson_workspaces', 'player_device_calibrations',
    'player_write_rate_limits'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
        'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] LOOP
        IF has_table_privilege(v_role, format('public.%I', v_table), v_privilege) THEN
          RAISE EXCEPTION 'P9 grant verification failed: role % retains % on public.%',
            v_role, v_privilege, v_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
      AND (
        (d.defaclnamespace = 'public'::regnamespace
          AND d.defaclobjtype IN ('r', 'S', 'f'))
        OR (d.defaclnamespace = 0 AND d.defaclobjtype = 'f')
      )
      AND acl.grantee IN (
        0,
        (SELECT oid FROM pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
      )
  ) THEN
    RAISE EXCEPTION 'P9 grant verification failed: postgres defaults still expose public tables, sequences, or functions';
  END IF;

  IF has_function_privilege(
    'anon', 'public.enforce_game_content_revision_state_machine()', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.enforce_game_content_revision_state_machine()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'P9 grant verification failed: a Data API role can execute the application trigger function';
  END IF;
END
$verify$;
