import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collectionRoute = readFileSync(
  new URL("../app/api/missions/route.ts", import.meta.url),
  "utf8",
);
const detailRoute = readFileSync(
  new URL("../app/api/missions/[id]/route.ts", import.meta.url),
  "utf8",
);

test("legacy mission routes do not authorize from the client-controlled role cookie", () => {
  for (const source of [collectionRoute, detailRoute]) {
    assert.match(source, /getCurrentAppUser/);
    assert.doesNotMatch(source, /getCookieValue|headers\.get\([\"']cookie[\"']\)/);
  }

  assert.match(collectionRoute, /authorId:\s*user\.id/);
});
