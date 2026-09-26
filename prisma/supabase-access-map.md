# Supabase relational access map

Audit date: 2026-09-24. Project ref: `hshovrqtmzvpjggqcpya` (PostgreSQL 17.6). The initial inventory was read-only. A later live migration is recorded below; it was already present when this session rechecked Supabase.

## Application access contract

The platform authenticates through Auth0, reads and writes relational data through server-side Prisma, and uses the Supabase service-role key from server code for Storage operations. The public web client and Unity runtime contain no direct Supabase table client or PostgREST/RPC call in the audited source. Browser flows call platform routes and receive filtered response payloads.

Evidence:

- `prisma/schema.prisma` declares the application models and uses PostgreSQL.
- `lib/supabase-admin.ts` constructs a service-role client in server code.
- `lib/song-storage.ts`, `lib/storage-media.ts`, `app/api/lesson-builder/save/route.ts`, and `app/api/song-package/launch/route.ts` use that client for Storage files, signed URLs, and hashes. Relational reads in these flows use Prisma.
- `app/api/player-outcomes/route.ts`, `app/api/player-workspace/route.ts`, `app/api/player-calibration/route.ts`, and `lib/teacher-progress.ts` use Prisma for launch/result/workspace/calibration/progress data.
- Source searches across platform `app/` and `lib/`, public web `src/`, and Unity runtime scripts found no browser-facing `createClient`, `supabase.from(table)`, `supabase.rpc`, or direct `/rest/v1` requests. The platform Supabase `.from(bucket)` calls found are Storage calls.

`service_role` has effective CRUD ACLs on all 18 listed tables. The application does not use its service-role key to query these tables; it is used for server-side Storage. The service role remains privileged by design and must never enter a browser bundle.

| Table | Browser direct read | Browser direct write | Server Prisma | Service-role Data API ACL | Intended public exposure |
| --- | --- | --- | --- | --- | --- |
| `User` | No | No | Yes | CRUD | None; Auth0-protected platform routes |
| `School` | No | No | Yes | CRUD | None; admin server routes |
| `Class` | No | No | Yes | CRUD | None; teacher/admin server routes |
| `ClassStudent` | No | No | Yes | CRUD | None; teacher/admin server routes |
| `Assignment` | No | No | Yes | CRUD | None; authenticated platform routes |
| `Mission` | No | No | Yes | CRUD | None; authenticated platform routes |
| `Progress` | No | No | Yes | CRUD | None; authenticated platform routes |
| `RosterImport` | No | No | Yes | CRUD | None; teacher roster server flow |
| `TeacherClass` | No | No | Yes | CRUD | None; teacher/admin server routes |
| `SongAsset` | No direct table read; listing is server-backed | No | Yes | CRUD ACL, although only SELECT is granted to `anon`/`authenticated` | No direct table exposure; return only the song fields needed by the authenticated app |
| `SongChart` | No | No | Yes | CRUD | None; authored chart data stays behind platform APIs |
| `game_content_revisions` | No | No | Yes | CRUD | None; immutable revision identity stays server-owned |
| `player_launch_attempts` | No | No | Yes | CRUD | None; launch receipt is server-owned |
| `player_run_outcomes` | No | No | Yes | CRUD | None; receipt-validated submission and filtered results only |
| `player_lesson_workspaces` | No | No | Yes | CRUD | None; Auth0 user identity is enforced by server routes |
| `player_device_calibrations` | No | No | Yes | CRUD | None; calibration is read/written by platform routes |
| `player_write_rate_limits` | No | No | Yes | CRUD | None; rate-limit state is server-only |
| `_prisma_migrations` | No | No | Prisma migration engine only | CRUD ACL | None; migration metadata is private |

“Service-role Data API ACL” describes effective PostgreSQL grants, not an observed application call. For the four tables with RLS already enabled and no policies, service-role bypass behavior is separate from public Data API access. The deployed Prisma connection role has not been verified from deployment configuration; no secret environment values were read.

## Initial live database observations (pre-migration snapshot)

Read-only Supabase queries on 2026-09-24 established:

- All 18 requested tables exist in `public`.
- 14 tables have RLS disabled: `_prisma_migrations`, `User`, `Mission`, `Progress`, `School`, `Class`, `ClassStudent`, `Assignment`, `SongAsset`, `SongChart`, `player_launch_attempts`, `player_run_outcomes`, `RosterImport`, and `TeacherClass`.
- Of those 14, 13 grant `anon` and `authenticated` all table privileges. `SongAsset` grants those roles SELECT only. PostgreSQL 17's observed ACL set also includes `MAINTAIN` in the broad grants.
- `game_content_revisions`, `player_lesson_workspaces`, `player_device_calibrations`, and `player_write_rate_limits` already have RLS enabled, have no policies, and have no effective `anon` or `authenticated` table privileges.
- `service_role` has effective CRUD privileges on every listed table.
- Default ACLs for objects created by `postgres` in `public` grant tables and sequences to `anon`, `authenticated`, and `service_role`; function defaults grant EXECUTE to those roles. `supabase_admin` also has broad defaults in `public`. The draft migration changes only defaults for the role that executes it; the deployed Prisma migration role and ownership behavior still require safe-environment verification.
- The only application-owned public function found is `enforce_game_content_revision_state_machine()`. It returns `trigger`, is not `SECURITY DEFINER`, and currently grants EXECUTE to `anon` and `authenticated`; the app has no browser RPC calls. The draft removes only those two grants from this trigger function. Global default `PUBLIC EXECUTE` behavior for future functions is intentionally not changed in this table-focused package and needs a separate role/default-privilege review.
- Storage buckets `Songs`, `Charts`, `SidecarJsons`, `Icons`, and `Videos` are all marked private.
- The read-only Number Bonds revision query returned no rows for the audited project. P9.5 cannot be declared complete from current production data; no revision was inserted or published during this audit.
- The Supabase Security Advisor reports 14 RLS-disabled tables at critical priority and four `rls_enabled_no_policy` informational findings. No advisor remediation was applied.

The Data API relies on both PostgreSQL grants and RLS. Removing a role's table privileges blocks direct Data API table access without changing Prisma's owner connection. RLS is deliberately handled in a later package because Prisma's deployed role and bypass behavior are not established. See [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api) and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## P9.2 migration status

`prisma/migrations/20260924120000_lock_down_public_table_access/migration.sql` is the local Prisma migration source. It removes current `anon`/`authenticated` grants from the server-only tables, handles `SongAsset` in its own section, hardens defaults for the verified `postgres` migration role, and aborts if post-migration privilege checks fail. `rollback.sql` restores the observed prior grants and defaults.

At the initial audit, this migration had not been run against Supabase. A later read-only recheck found the live Supabase migration ledger entry `version=20260924113034`, `name=20260924123000_revoke_public_data_api_grants`. Its recorded SQL requires `current_user = 'postgres'`, revokes direct table grants and the trigger function grant, and hardens `postgres` defaults for tables, sequences, and functions. The local Prisma source now includes the same guards and privilege changes. The two migration ledgers are separate; no matching entry was found in Prisma's `_prisma_migrations` table.

P9.2's exit gate remains open until the required application regression suite is exercised against a safe database. The live change was already present when this session rechecked it; this session made no database writes. No Supabase database branches are available, and no local PostgreSQL or Supabase CLI is installed in the current environment. P9.3 RLS work remains gated on verifying the actual deployed Prisma role and its RLS behavior. Signed URL success/expiry and immutable refresh behavior also remain unverified; private bucket metadata alone does not establish those runtime paths.

## Post-migration recheck — 2026-09-24 12:08 UTC

Read-only checks after the Supabase migration ledger entry above established:

- All 18 listed application tables deny `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` to both `anon` and `authenticated`; the `service_role` retains CRUD on all 18. RLS is still disabled on 14 tables. A broader check of all public relations also found no anon/authenticated `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `MAINTAIN` privileges, and no column-level grants.
- `anon` and `authenticated` retain `USAGE` on `public` but do not have `CREATE`. Neither has privileges on the existing public sequences or `EXECUTE` on public functions. The application trigger function is no longer executable by either role. The fresh 12:06 UTC Security Advisor output reports four informational RLS-enabled/no-policy findings; the 14 critical findings recorded at 11:28 UTC predate the grant change.
- Default ACLs created by `postgres` no longer grant public-schema tables or sequences, and no longer grant `EXECUTE` on new functions to `PUBLIC`, `anon`, or `authenticated`.
- `supabase_admin` remains a separate superuser and its public-schema defaults still grant table, sequence, and function privileges to `anon`, `authenticated`, and `service_role`. `postgres` is not a member of `supabase_admin`, so the application migration role cannot alter those defaults. Existing app tables are currently protected by the grant revokes, but objects created by `supabase_admin` may still inherit broad defaults; confirm the intended schema-creation owner and address this through Supabase administration if that role creates application objects.
- The private Storage bucket flags remain `false` for `Songs`, `Charts`, `SidecarJsons`, `Icons`, and `Videos`. The database has 39 READY `early-algebra` revisions and zero Number Bonds revisions; `player_launch_attempts` and `player_run_outcomes` both remain empty.
- P9.5 and P9.6 remain open. P9.7 has local generator code and deterministic fixture tests, but the tests use synthetic chart fixtures; generation from multiple real immutable song revisions and publication through the normal service remain unverified.

## Number Bonds authoring and release gates

`lib/number-bonds-content-generator.ts` now provides a reusable six-entry 2–5 bond catalogue and generates strict v3 lessons from note ticks in a selected difficulty of an immutable rhythm chart. It uses the source chart's tempo map, the shared 7.5-second cue spacing and 12-second final tail, stable whole-token targets, and the current six-pad player layout. The lesson builder exposes the catalogue and difficulty selector only for an empty Number Bonds lesson with a verified rhythm source. The generator does not read or copy the source sidecar; publication still sends the selected source revision and is checked server-side against its chart and audio hashes.

Local tests cover deterministic schedules across a tempo change, separate song rhythms, all catalogued bonds, reordered equation token order, pad validity, insufficient chart space, and v3 publication round-trip. This is code validation, not proof of publication into multiple existing songs. The audited project currently has no Number Bonds revision, and P9.2, P9.4, P9.5, and P9.6 remain open pending safe-database, storage, authoring, and authenticated-journey evidence.

The local P9.7 follow-up persists the exact source revision on each generated lesson revision. A composite foreign key ties the source revision to the same `SongAsset`, and `ON DELETE RESTRICT` preserves the audit link. The save route writes this provenance in the publication transaction. Idempotent retries now replay before the first-publication guard and reject reuse of a request ID with a different source revision or activity. These changes are in `prisma/schema.prisma`, `app/api/lesson-builder/save/route.ts`, and the local migration `20260924170000_add_rhythm_source_provenance`; that migration has not been applied to Supabase. The tests exercise synthetic source revisions and route/schema contracts only.
