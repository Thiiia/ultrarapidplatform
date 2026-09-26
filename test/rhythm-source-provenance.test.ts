import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const route = readFileSync(join(process.cwd(), "app/api/lesson-builder/save/route.ts"), "utf8");
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(
  process.cwd(),
  "prisma/migrations/20260924170000_add_rhythm_source_provenance/migration.sql",
), "utf8");

test("shared rhythm publications persist the immutable source revision on the target revision", () => {
  assert.match(
    route,
    /rhythmSourceRevision:\s*resolvedRhythmSource\?\.sourceRevision\s*\?\?\s*null/,
    "the publication transaction must write the verified source revision link",
  );
  assert.match(
    schema,
    /rhythmSourceRevision\s+String\?\s+@map\("rhythm_source_revision"\)\s+@db\.Uuid/,
  );
  assert.match(
    schema,
    /rhythmSource\s+GameContentRevision\?\s+@relation\("GameContentRevisionRhythmSource",[\s\S]*?references:\s*\[revision, songAssetId\],[\s\S]*?onDelete:\s*Restrict/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \(rhythm_source_revision, song_asset_id\)[\s\S]*?REFERENCES public\.game_content_revisions \(revision, song_asset_id\)[\s\S]*?ON DELETE RESTRICT/,
  );
  assert.match(migration, /CREATE INDEX game_content_revisions_rhythm_source_revision_idx/);
});

test("shared rhythm retries replay before the first-publication-only check and match the stored source", () => {
  const replayLookup = route.indexOf("const replayedPublication = await prisma.gameContentRevision.findUnique");
  const firstPublicationGuard = route.indexOf("if (targets.current && hasRhythmSourceRequest)");
  assert.ok(replayLookup >= 0 && firstPublicationGuard > replayLookup);
  assert.match(route, /replayedPublication\.rhythmSource\?\.revision\s*\?\?\s*null/);
  assert.match(route, /replayedPublication\.rhythmSource\?\.activityKey\s*\?\?\s*null/);
});
