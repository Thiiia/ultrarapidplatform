import { randomUUID } from "node:crypto";

import {
  parseAuthoredLessonDraft,
  validateAuthoredRuntimePresentationConcurrency,
} from "../lib/authored-lesson";
import { retimeAuthoredLessonToMusic } from "../lib/authored-lesson-retiming";
import { createLessonClock } from "../lib/editor/lesson-timing";
import { repairLegacyMigratedAuthoredLesson } from "../lib/legacy-authored-migration";

const platformOrigin = "https://ultrarapidplatform.vercel.app";
const activityKey = "early-algebra";
const songAssetIds = [
  "garden",
  "geminiqueen",
  "grudge",
  "jazzmaybach",
  "justbecause",
  "oneone",
  "seven",
  "waves",
] as const;
const apply = process.argv.includes("--apply");

type LaunchPackage = {
  source?: string;
  authorId?: string;
  revision?: string;
  chart?: { signedUrl?: string };
  sidecar?: { signedUrl?: string };
  receipt?: {
    source?: string;
    authorId?: string;
    revision?: string;
  };
  error?: string;
};

function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`Launch package is missing ${label}`);
  return value;
}

async function readLaunchPackage(songAssetId: string) {
  const response = await fetch(`${platformOrigin}/api/song-package/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songAssetId, activityKey, rhythmDifficultyKey: "MediumSingle", learningDifficultyKey: activityKey }),
  });
  const payload = await response.json() as LaunchPackage;
  if (!response.ok) throw new Error(payload.error ?? `Launch API returned ${response.status}`);
  if (payload.source !== "authored" || payload.receipt?.source !== "authored") {
    throw new Error(`Expected an authored package, received '${payload.source ?? "unknown"}'`);
  }
  return payload;
}

async function retimeSong(songAssetId: string) {
  const launch = await readLaunchPackage(songAssetId);
  const authorId = required(launch.authorId ?? launch.receipt?.authorId, "authorId");
  const previousRevision = required(launch.revision ?? launch.receipt?.revision, "revision");
  const chartUrl = required(launch.chart?.signedUrl, "chart URL");
  const sidecarUrl = required(launch.sidecar?.signedUrl, "sidecar URL");
  const [chartResponse, sidecarResponse] = await Promise.all([fetch(chartUrl), fetch(sidecarUrl)]);
  if (!chartResponse.ok || !sidecarResponse.ok) {
    throw new Error(`Unable to fetch current authored files (chart=${chartResponse.status}, sidecar=${sidecarResponse.status})`);
  }

  const chart = await chartResponse.text();
  const sourceSidecar = await sidecarResponse.text();
  const clock = createLessonClock(chart);
  const rawLesson = JSON.parse(sourceSidecar);
  // Catalogue revisions created by the original legacy bridge can contain an
  // operator target, an empty HIT pad, or a target for one digit of a
  // whitespace-split multi-digit number. Repair only those known legacy
  // shapes before strict parsing; authored v3 input remains strict elsewhere.
  const repairedLesson = repairLegacyMigratedAuthoredLesson(rawLesson);
  const legacyRepairChanged = JSON.stringify(repairedLesson) !== JSON.stringify(rawLesson);
  const sourceLesson = parseAuthoredLessonDraft(
    repairedLesson,
  );
  const retimed = retimeAuthoredLessonToMusic({ chart, lesson: sourceLesson, clock, preferredDifficulty: "MediumSingle" });
  validateAuthoredRuntimePresentationConcurrency(retimed.lesson.encounters, clock);

  const summary = {
    songAssetId,
    previousRevision,
    anchorDifficulty: retimed.anchorDifficulty,
    encounters: retimed.lesson.encounters.length,
    legacyRepairChanged,
    changed: retimed.changes.length,
    changes: retimed.changes.map(({ encounterId, fromSeconds, toSeconds }) => ({
      encounterId,
      fromSeconds: Number(fromSeconds.toFixed(3)),
      toSeconds: Number(toSeconds.toFixed(3)),
    })),
  };

  if (!apply || (!legacyRepairChanged && retimed.changes.length === 0)) {
    return { ...summary, applied: false };
  }

  const publicationRequestId = randomUUID();
  const saveResponse = await fetch(`${platformOrigin}/api/lesson-builder/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": publicationRequestId,
    },
    body: JSON.stringify({
      songAssetId,
      activityKey,
      authorId,
      revision: previousRevision,
      publicationRequestId,
      chart: { content: chart },
      sidecar: { content: JSON.stringify(retimed.lesson, null, 2) },
    }),
  });
  const saveResult = await saveResponse.json() as { error?: string; revision?: string };
  if (!saveResponse.ok || !saveResult.revision) {
    throw new Error(saveResult.error ?? `Save API returned ${saveResponse.status}`);
  }

  return { ...summary, applied: true, revision: saveResult.revision };
}

async function main() {
  const results: unknown[] = [];
  for (const songAssetId of songAssetIds) {
    try {
      results.push(await retimeSong(songAssetId));
    } catch (error) {
      results.push({ songAssetId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", results }, null, 2));
  if ((results as Array<{ error?: string }>).some((result) => result.error)) process.exitCode = 1;
}

void main();
