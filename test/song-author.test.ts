import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestedAuthor } from "../lib/song-author";
import { isFelixAuthor } from "../lib/song-storage";

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

test("recognizes Felix as a valid author even before any chart rows exist", () => {
  assert.equal(
    isFelixAuthor({ id: "cmndltqyc0000ju04s0i4en9r", name: "Felix", email: "felix@example.com" }),
    true,
  );
  assert.equal(
    isFelixAuthor({ id: "other-user", name: "Felix", email: null }),
    true,
  );
  assert.equal(
    isFelixAuthor({ id: "other-user", name: "Kameron", email: "kameron@example.com" }),
    false,
  );
});
