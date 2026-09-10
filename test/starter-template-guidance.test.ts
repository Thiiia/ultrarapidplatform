import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonLaunchStrategy,
  libraryEquationsForTab,
  shouldOfferStarterTemplate,
} from "../lib/starter-template-guidance";

test("offers a loaded encounter as an optional starter template", () => {
  assert.equal(
    shouldOfferStarterTemplate({
      songId: "waves",
      encounterCount: 1,
      dismissedForSongId: null,
    }),
    true,
  );
});

test("does not show a template prompt for blank, dismissed, or unloaded lessons", () => {
  assert.equal(
    shouldOfferStarterTemplate({
      songId: null,
      encounterCount: 4,
      dismissedForSongId: null,
    }),
    false,
  );
  assert.equal(
    shouldOfferStarterTemplate({
      songId: "waves",
      encounterCount: 0,
      dismissedForSongId: null,
    }),
    false,
  );
  assert.equal(
    shouldOfferStarterTemplate({
      songId: "waves",
      encounterCount: 4,
      dismissedForSongId: "waves",
    }),
    false,
  );
});

test("keeps loaded template equations out of My Equations", () => {
  const mine = [{ id: "made-this-session" }];
  const template = [{ id: "loaded-1" }, { id: "loaded-2" }];

  assert.deepEqual(libraryEquationsForTab("mine", mine, template), mine);
  assert.deepEqual(libraryEquationsForTab("premade", mine, template), template);
});

test("plays the safe published template unless there is an authored draft to publish", () => {
  assert.equal(lessonLaunchStrategy(false), "published-template");
  assert.equal(lessonLaunchStrategy(true), "publish-draft");
});
