import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareAuthoredLessonForPublication } from "../lib/authored-lesson-publication";
import { migrateEarlyAlgebraCatalogueSong } from "../lib/early-algebra-catalogue-migration";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { validateLessonContent } from "../lib/lesson-content";

const origin = "https://ultrarapidplatform.vercel.app";
const songs = ["garden", "geminiqueen", "grudge", "jazzmaybach", "justbecause", "oneone", "seven", "waves"];
const argument = (name: string) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const snapshotDir = argument("--snapshot-dir") ?? "/tmp/early-algebra-catalogue-20260926";
const outputDir = argument("--output-dir") ?? "/tmp/early-algebra-catalogue-migrated-20260926";
const apply = process.argv.includes("--apply");
const capture = process.argv.includes("--capture");

type Source = { chart: string; sidecar: string; authorId: string; revision: string };

async function snapshot(songAssetId: string): Promise<Source> {
  const [chart, sidecar, receiptText] = await Promise.all([
    readFile(join(snapshotDir, `${songAssetId}.chart`), "utf8"),
    readFile(join(snapshotDir, `${songAssetId}.json`), "utf8"),
    readFile(join(snapshotDir, `${songAssetId}.receipt.json`), "utf8"),
  ]);
  const receipt = JSON.parse(receiptText) as { authorId: string; revision: string };
  return { chart, sidecar, authorId: receipt.authorId, revision: receipt.revision };
}

async function live(songAssetId: string): Promise<Source> {
  const response = await fetch(`${origin}/api/song-package/launch`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songAssetId, activityKey: "early-algebra",
      rhythmDifficultyKey: "MediumSingle", learningDifficultyKey: "early-algebra" }),
  });
  const packageData = await response.json() as {
    error?: string; authorId?: string; revision?: string;
    chart?: { signedUrl?: string }; sidecar?: { signedUrl?: string };
    receipt?: { authorId?: string; revision?: string };
  };
  if (!response.ok || !packageData.chart?.signedUrl || !packageData.sidecar?.signedUrl) {
    throw new Error(`${songAssetId}: ${packageData.error ?? `launch ${response.status}`}`);
  }
  const [chartResponse, sidecarResponse] = await Promise.all([
    fetch(packageData.chart.signedUrl), fetch(packageData.sidecar.signedUrl),
  ]);
  if (!chartResponse.ok || !sidecarResponse.ok) throw new Error(`${songAssetId}: source download failed`);
  const authorId = packageData.authorId ?? packageData.receipt?.authorId;
  const revision = packageData.revision ?? packageData.receipt?.revision;
  if (!authorId || !revision) throw new Error(`${songAssetId}: missing source identity`);
  return { chart: await chartResponse.text(), sidecar: await sidecarResponse.text(), authorId, revision };
}

async function main() {
  if (capture && apply) throw new Error("Capture and apply must run separately");
  if (capture) {
    await mkdir(snapshotDir, { recursive: true });
    for (const songAssetId of songs) {
      const source = await live(songAssetId);
      await Promise.all([
        writeFile(join(snapshotDir, `${songAssetId}.chart`), source.chart),
        writeFile(join(snapshotDir, `${songAssetId}.json`), source.sidecar),
        writeFile(join(snapshotDir, `${songAssetId}.receipt.json`), JSON.stringify({
          songAssetId, authorId: source.authorId, revision: source.revision,
        }, null, 2)),
      ]);
    }
    console.log(JSON.stringify({ mode: "capture", snapshotDir, songs: songs.length }));
    return;
  }
  await mkdir(outputDir, { recursive: true });
  const results = [];
  const prepared: Array<{ songAssetId: string; source: Source; content: string; summary: Record<string, unknown> }> = [];
  for (const songAssetId of songs) {
    try {
      const reference = await snapshot(songAssetId);
      const source = apply ? await live(songAssetId) : reference;
      if (source.revision !== reference.revision || source.sidecar !== reference.sidecar || source.chart !== reference.chart) {
        throw new Error(`${songAssetId}: current published revision differs from the reviewed snapshot`);
      }
      const draft = migrateEarlyAlgebraCatalogueSong({ songAssetId, chart: source.chart, sidecar: source.sidecar });
      const publication = prepareAuthoredLessonForPublication({
        sidecarContent: JSON.stringify(draft),
        identity: { songAssetId, activityKey: "early-algebra", authorId: source.authorId, revision: randomUUID() },
        runtimeClock: createLessonClock(source.chart),
        previousSidecarContent: source.sidecar,
      });
      validateLessonContent(source.chart, publication.content, { forSave: true });
      await writeFile(join(outputDir, `${songAssetId}.json`), JSON.stringify(draft, null, 2));
      const old = JSON.parse(source.sidecar) as { encounters: Array<{ type: string }> };
      const summary = {
        songAssetId, previousRevision: source.revision,
        originalEncounters: old.encounters.length,
        newEncounters: draft.encounters.length,
        originalHits: old.encounters.filter((item) => item.type === "hit").length,
        newHits: draft.encounters.filter((item) => item.type === "hit").length,
        equations: draft.equations.length,
      };
      prepared.push({ songAssetId, source, content: JSON.stringify(draft, null, 2), summary });
      if (!apply) results.push({ ...summary, applied: false });
    } catch (error) {
      results.push({ songAssetId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  // A failed preflight must prevent a partial eight-song migration.
  if (apply && results.length === 0) for (const { songAssetId, source, content, summary } of prepared) {
    try {
      const publicationRequestId = randomUUID();
      const saved = await fetch(`${origin}/api/lesson-builder/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": publicationRequestId },
        body: JSON.stringify({ songAssetId, activityKey: "early-algebra", authorId: source.authorId,
          revision: source.revision, publicationRequestId,
          chart: { content: source.chart }, sidecar: { content } }),
      });
      const saveResult = await saved.json() as { error?: string; revision?: string };
      if (!saved.ok || !saveResult.revision) throw new Error(`${songAssetId}: ${saveResult.error ?? `save ${saved.status}`}`);
      results.push({ ...summary, applied: true, revision: saveResult.revision });
    } catch (error) {
      results.push({ songAssetId, error: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", outputDir, results }, null, 2));
  if (results.some((item) => "error" in item)) process.exitCode = 1;
}

void main();
