import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationDirectory = "prisma/migrations/20260924120000_lock_down_public_table_access";
const migration = readFileSync(join(process.cwd(), `${migrationDirectory}/migration.sql`), "utf8");
const rollback = readFileSync(join(process.cwd(), `${migrationDirectory}/rollback.sql`), "utf8");
const normalize = (source: string) => source
  .replace(/^--.*$/gm, "")
  .replace(/\s+/g, " ")
  .toLowerCase();
const sql = normalize(migration);
const rollbackSql = normalize(rollback);

const broadAclTables = [
  "_prisma_migrations",
  "User",
  "Mission",
  "Progress",
  "School",
  "Class",
  "ClassStudent",
  "Assignment",
  "SongChart",
  "player_launch_attempts",
  "player_run_outcomes",
  "RosterImport",
  "TeacherClass",
];

const applicationTables = [
  ...broadAclTables,
  "SongAsset",
  "game_content_revisions",
  "player_lesson_workspaces",
  "player_device_calibrations",
  "player_write_rate_limits",
];

test("revoke broad Data API grants from every table observed with anon/authenticated access", () => {
  for (const table of broadAclTables) {
    const relation = `public."${table.toLowerCase()}"`;
    assert.ok(
      sql.includes(`revoke all privileges on table ${relation} from anon, authenticated`),
      `${table} must lose all direct Data API privileges`,
    );
  }
});

test("keeps SongAsset separate and removes only its observed SELECT grant", () => {
  assert.match(
    migration,
    /-- SongAsset is revoked separately[\s\S]*?REVOKE ALL PRIVILEGES ON TABLE public\."SongAsset" FROM anon, authenticated;/,
  );
  assert.ok(rollbackSql.includes(
    "grant select on table public.\"songasset\" to anon, authenticated",
  ));
});

test("verifies effective grants for every application table, including inherited access", () => {
  for (const table of applicationTables) {
    assert.ok(sql.includes(`'${table.toLowerCase()}'`), `${table} must be in the post-migration verification`);
  }
  assert.ok(sql.includes("has_table_privilege"));
  assert.ok(sql.includes("'maintain'"), "PostgreSQL 17 MAINTAIN must also be checked");
  assert.ok(sql.includes("aclexplode"), "future table and sequence defaults must be checked");
});

test("changes only reviewed grants; broad RLS and unrelated function ACLs stay behind later gates", () => {
  assert.doesNotMatch(sql, /enable row level security|force row level security|create policy|revoke execute on all functions/);
  assert.ok(sql.includes("if current_user <> 'postgres' then"), "the migration must fail closed unless run as the verified owner role");
  assert.ok(sql.includes("revoke execute on function public.enforce_game_content_revision_state_machine() from public, anon, authenticated"));
  assert.ok(sql.includes("has_function_privilege('anon', 'public.enforce_game_content_revision_state_machine()', 'execute')"));
  assert.ok(sql.includes("alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated"));
  assert.ok(sql.includes("alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated"));
  assert.ok(sql.includes("alter default privileges for role postgres revoke execute on functions from public, anon, authenticated"));
  assert.ok(sql.includes("alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated"));
  assert.ok(sql.includes("d.defaclnamespace = 0 and d.defaclobjtype = 'f'"), "the global PUBLIC EXECUTE default must be verified");
});

test("rollback restores the observed table grants and defaults", () => {
  for (const table of broadAclTables) {
    assert.ok(rollbackSql.includes(
      `grant all privileges on table public."${table.toLowerCase()}" to anon, authenticated`,
    ), `${table} needs an explicit rollback grant`);
  }
  assert.ok(rollbackSql.includes("alter default privileges for role postgres in schema public grant all on tables to anon, authenticated"));
  assert.ok(rollbackSql.includes("alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated"));
  assert.ok(rollbackSql.includes("alter default privileges for role postgres grant execute on functions to public"));
  assert.ok(rollbackSql.includes("alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated"));
  assert.ok(rollbackSql.includes("grant execute on function public.enforce_game_content_revision_state_machine() to anon, authenticated"));
});
