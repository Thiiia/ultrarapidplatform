import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

test("team editor and preview routes enforce server-side access", async () => {
  const [editorPage, gamePage] = await Promise.all([
    readSource("app/team/editor/page.tsx"),
    readSource("app/team/game/page.tsx"),
  ]);

  for (const source of [editorPage, gamePage]) {
    assert.match(source, /getCurrentAppUser/);
    assert.match(source, /canAccessTeamPreview/);
    assert.match(source, /redirect\("\/login"\)/);
  }

  assert.match(gamePage, /getSongLaunchPayload/);
  assert.match(gamePage, /createSongLaunchSearchParams/);
  assert.match(gamePage, /songAssetId/);
  assert.match(gamePage, /notFound\(\)/);
  assert.match(gamePage, /launchSearch=/);
  assert.match(gamePage, /dynamic = "force-dynamic"/);
  assert.match(editorPage, /const navBasePath = user\.role === "admin"/);
  assert.match(editorPage, /navBasePath=\{navBasePath\}/);
});

test("editor navigation carries only the opaque song asset id", async () => {
  const editorClient = await readSource(
    "app/team/editor/TeamEditorClient.tsx",
  );

  assert.match(editorClient, /selectedSongLaunchId/);
  assert.match(
    editorClient,
    /new URLSearchParams\(\{\s*songAssetId: selectedSongLaunchId,\s*\}\)/,
  );
  assert.match(editorClient, /return launchPath \+ "\?" \+ params\.toString\(\)/);
  assert.match(editorClient, /router\.push\(playHref\)/);
  assert.doesNotMatch(editorClient, /createSongLaunchSearchParams/);
  assert.doesNotMatch(editorClient, /setSelectedSongLaunch\(\{[\s\S]*?chartUrl:/);
  assert.match(editorClient, /getTopTabs\(navBasePath, playHref\)/);
  assert.doesNotMatch(editorClient, /href: "\/student\/profile"/);
});

test("team editor replaces and clears stale session song URLs", async () => {
  const editorClient = await readSource(
    "app/team/editor/TeamEditorClient.tsx",
  );

  assert.match(
    editorClient,
    /songs\.find\(\(song\) => song\.id === storedSong\.id\)/,
  );
  assert.match(
    editorClient,
    /sessionStorage\.removeItem\("ultrarapid_selected_song"\)/,
  );
});

test("shared game embed prefers the fresh server launch query", async () => {
  const [gameEmbed, teamGamePage] = await Promise.all([
    readSource("app/student/game/GameEmbedPage.tsx"),
    readSource("app/team/game/page.tsx"),
  ]);

  assert.match(gameEmbed, /launchSearch\?: string/);
  assert.match(gameEmbed, /new URLSearchParams\(launchSearch \?\? ""\)/);
  assert.match(gameEmbed, /launchSearch \? serverLaunchParams : searchParams/);
  assert.match(gameEmbed, /playHref\?: string/);
  assert.match(gameEmbed, /getTopTabs\(navBasePath, playHref\)/);
  assert.match(gameEmbed, /if \(navBasePath === "\/admin"\)/);
  assert.match(gameEmbed, /getUtilityTabs\(navBasePath\)/);
  assert.match(gameEmbed, /utilityTabs=\{utilityTabs\}/);
  assert.match(teamGamePage, /playHref=\{playHref\}/);
  assert.match(teamGamePage, /songAssetId.*requestedSongAssetId/);
});

test("storage lookup signs only an active song selected by id", async () => {
  const storage = await readSource("lib/song-storage.ts");

  assert.match(storage, /export async function getSongLaunchPayload/);
  assert.match(storage, /findFirst/);
  assert.match(storage, /id: songAssetId/);
  assert.match(storage, /isActive: true/);
  assert.match(storage, /createFreshSongLaunchInput/);
});
