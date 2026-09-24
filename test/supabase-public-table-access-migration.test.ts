import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260924123000_revoke_public_data_api_grants",
  "migration.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const rollback = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260924123000_revoke_public_data_api_grants",
    "manual-rollback.sql",
  ),
  "utf8",
);

test("P9 migration revokes client grants from every audited server table", () => {
  const tables = [
    "_prisma_migrations",
    "User",
    "School",
    "Class",
    "ClassStudent",
    "Assignment",
    "Mission",
    "Progress",
    "RosterImport",
    "TeacherClass",
    "SongAsset",
    "SongChart",
    "player_launch_attempts",
    "player_run_outcomes",
  ];

  for (const table of tables) {
    assert.ok(
      migration.includes(
        `REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM anon, authenticated;`,
      ),
      `${table} should not be directly reachable through the Data API roles`,
    );
  }
});

test("P9 migration closes current and future client function execution", () => {
  assert.match(
    migration,
    /REVOKE EXECUTE ON FUNCTION public\.enforce_game_content_revision_state_machine\(\)\s+FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;/,
  );
});

test("P9 migration gates on the creator role and verifies effective grants", () => {
  assert.match(migration, /IF current_user <> 'postgres' THEN/);
  assert.match(migration, /has_table_privilege\(v_role, format\('public\.%I', v_table\), v_privilege\)/);
  assert.match(migration, /d\.defaclobjtype IN \('r', 'S', 'f'\)/);
  assert.match(migration, /P9 grant verification failed/);
  assert.doesNotMatch(migration, /\b(?:ENABLE|FORCE) ROW LEVEL SECURITY\b/i);
  assert.doesNotMatch(migration, /\bCREATE POLICY\b/i);
  assert.doesNotMatch(migration, /\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)/i);
});

test("manual rollback exactly documents the prior grants and warns before re-exposure", () => {
  assert.match(rollback, /MANUAL BREAK-GLASS ONLY/);
  assert.match(rollback, /Never attach this file to an automated deploy rollback/);
  assert.match(
    rollback,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+GRANT EXECUTE ON FUNCTIONS TO PUBLIC;/,
  );
  assert.match(
    rollback,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;/,
  );
  assert.match(
    rollback,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+GRANT ALL ON TABLES TO anon, authenticated;/,
  );
});
