import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestedAuthor } from "../lib/song-author";

test("fails explicitly when an author id is unknown", async () => {
  await assert.rejects(
    resolveRequestedAuthor({
      authorId: "missing-author",
      findById: async () => null,
      findByName: async () => null,
      getDefault: async () => ({ id: "dev", name: "dev" }),
    }),
    /author.*not found/i,
  );
});

test("does not let a supplied author name override a different stable author id", async () => {
  await assert.rejects(
    resolveRequestedAuthor({
      authorId: "author-a",
      authorName: "Kameron",
      findById: async () => ({ id: "author-a", name: "Felix" }),
      findByName: async () => ({ id: "author-b", name: "Kameron" }),
      getDefault: async () => ({ id: "dev", name: "dev" }),
    }),
    /do not identify the same author/i,
  );
});

test("uses the default author only when no author was explicitly requested", async () => {
  const author = await resolveRequestedAuthor({
    findById: async () => null,
    findByName: async () => null,
    getDefault: async () => ({ id: "dev", name: "dev" }),
  });

  assert.deepEqual(author, { id: "dev", name: "dev" });
});
