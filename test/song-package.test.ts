import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingSongAsset, normalizeSongStoragePath } from "../lib/song-storage";

type SongPackageLoader = {
  loadSongPackageAssets?: (input: {
    chartUrl: string;
    sidecarUrl?: string | null;
    audioUrl?: string | null;
  }, fetcher?: (url: string) => Promise<Response>) => Promise<{
    chartText: string;
    sidecarJson: unknown | null;
    audioBlob: Blob | null;
    audioError: string | null;
  }>;
};

async function loadSongPackageModule(): Promise<SongPackageLoader | null> {
  try {
    const modulePath = "../lib/editor/" + "song-package";
    return (await import(modulePath)) as SongPackageLoader;
  } catch {
    return null;
  }
}

test("normalizes storage paths before matching song assets", () => {
  const songs = [
    { id: "waves", title: "Waves", songPath: "Folder/EOF_Metrik_Grafix_Waves.mp3" },
    { id: "garden", title: "Garden", songPath: "Garden.mp3" },
  ];

  assert.equal(
    normalizeSongStoragePath("/Folder/EOF_Metrik_Grafix_Waves.mp3"),
    "folder/eof_metrik_grafix_waves.mp3",
  );
  assert.equal(findMatchingSongAsset(songs, "/folder/eof_metrik_grafix_waves.mp3")?.id, "waves");
  assert.equal(findMatchingSongAsset(songs, "Garden.mp3")?.id, "garden");
});

test("loads chart and sidecar data when the audio request is unavailable", async () => {
  const songPackage = await loadSongPackageModule();

  assert.equal(
    typeof songPackage?.loadSongPackageAssets,
    "function",
    "song-package must expose a loadSongPackageAssets loader",
  );

  const result = await songPackage!.loadSongPackageAssets!(
    {
      chartUrl: "https://storage.example/chart.chart",
      sidecarUrl: "https://storage.example/chart.json",
      audioUrl: "https://storage.example/song.mp3",
    },
    async (url) => {
      if (url.endsWith(".chart")) {
        return new Response("[Song]\n{", { status: 200 });
      }

      if (url.endsWith(".json")) {
        return new Response(JSON.stringify({ version: 1, events: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Forbidden", { status: 403 });
    },
  );

  assert.equal(result.chartText, "[Song]\n{");
  assert.deepEqual(result.sidecarJson, { version: 1, events: [] });
  assert.equal(result.audioBlob, null);
  assert.match(result.audioError ?? "", /Unable to load audio file: 403/);
});
