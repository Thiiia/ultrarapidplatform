import assert from "node:assert/strict";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { serializeAuthoredLesson, timelineEventsFromAuthoredLesson } from "../lib/authored-lesson-serialization";
import { evaluateLessonPublishReadiness } from "../lib/guided-authored-encounter";
import { createLessonClock } from "../lib/editor/lesson-timing";

// Read-only: never calls save/publish or logs signed asset URLs. The default
// catalogue sweep remains available, while --song/--activity make this useful
// for a specific published revision (including a Number Bonds pilot package).
const defaultSongs = ["garden", "geminiqueen", "grudge", "jazzmaybach", "justbecause", "oneone", "seven", "waves"];
type AuditOptions = {
  songAssetId: string;
  activityKey: string;
  authorId?: string;
  revision?: string;
  baseUrl: string;
  rhythmDifficultyKey: string;
  learningDifficultyKey: string;
};

type LaunchPackage = {
  error?: string;
  source?: string;
  activityKey?: string;
  authorId?: string;
  revision?: string;
  chart?: { signedUrl?: string };
  sidecar?: { signedUrl?: string };
  audio?: { signedUrl?: string };
  receipt?: {
    authorId?: string;
    revision?: string;
    hashes?: { chartSha256?: string; sidecarSha256?: string; audioSha256?: string };
    counts?: { encounters?: number; equations?: number; targets?: number };
  };
};

function parseArgs(argv: string[]): { options: Omit<AuditOptions, "songAssetId">; songs: string[] } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    values.set(key, value);
    index += 1;
  }

  const activityKey = values.get("activity") ?? "early-algebra";
  const baseUrl = (values.get("baseUrl") ?? process.env.ULTRARAPID_AUDIT_BASE_URL ?? "https://ultrarapidplatform.vercel.app")
    .replace(/\/$/, "");
  const selectedSong = values.get("song") ?? values.get("songAssetId");
  return {
    songs: selectedSong ? [selectedSong] : defaultSongs,
    options: {
      activityKey,
      authorId: values.get("authorId"),
      revision: values.get("revision"),
      baseUrl,
      rhythmDifficultyKey: values.get("rhythmDifficultyKey") ?? "MediumSingle",
      learningDifficultyKey: values.get("learningDifficultyKey") ?? activityKey,
    },
  };
}

function safeError(error: unknown) {
  return String(error)
    .replace(/https?:\/\/\S+/g, "[redacted URL]")
    .replace(/(?:token|signature|sig|access_token)=[^&\s]+/gi, "$1=[redacted]");
}

type SemanticEncounter = {
  id: string;
  type: "hit" | "spin" | "drag";
  equationId?: string;
  startTick: number;
  endTick: number;
  hitBubbles?: unknown[];
  spinTargets?: unknown[];
  dragTargets?: unknown[];
};

function semanticSnapshot(encounter: SemanticEncounter) {
  const targetSnapshot = (targets: unknown[] = []) => targets.map((target) => {
    if (!target || typeof target !== "object") return target;
    const snapshot = { ...(target as Record<string, unknown>) };
    delete snapshot.targetId;
    return snapshot;
  });
  const targets = encounter.type === "hit" ? encounter.hitBubbles : encounter.type === "spin" ? encounter.spinTargets : encounter.dragTargets;
  return {
    id: encounter.id,
    type: encounter.type,
    equationId: encounter.equationId,
    startTick: encounter.startTick,
    endTick: encounter.endTick,
    targets: targetSnapshot(targets),
  };
}

function blockers(readiness: ReturnType<typeof evaluateLessonPublishReadiness>) {
  return readiness.blockers.map(item => ({
    encounterId: item.encounterId,
    code: item.code,
    reason: item.nextAction,
  }));
}

function mechanicCount(events: Array<{ counts: Record<"hit" | "spin" | "drag", number> }>) {
  return events.reduce((total, event) => total + event.counts.hit + event.counts.spin + event.counts.drag, 0);
}

function semanticEquationSnapshot(equation: { id: string; state: string }) {
  // Parsed legacy equations may omit token metadata. Hydration derives those
  // tokens from state, and the serializer emits them for the editor. Token
  // IDs are transport metadata; id + state is the equation semantic contract.
  return { id: equation.id, state: equation.state };
}

async function audit(options: AuditOptions) {
  const response = await fetch(`${options.baseUrl}/api/song-package/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      songAssetId: options.songAssetId,
      activityKey: options.activityKey,
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.revision ? { revision: options.revision } : {}),
      rhythmDifficultyKey: options.rhythmDifficultyKey,
      learningDifficultyKey: options.learningDifficultyKey,
    }),
  });
  const launch = await response.json() as LaunchPackage;
  assert.ok(response.ok, `Launch HTTP ${response.status}: ${safeError(launch.error ?? "unknown launch failure")}`);
  assert.equal(launch.source, "authored", `Expected an authored package, received ${launch.source ?? "unknown"}`);
  assert.equal(launch.activityKey, options.activityKey, "Launch package activity changed from the requested activity");
  const chartUrl = launch.chart?.signedUrl;
  const sidecarUrl = launch.sidecar?.signedUrl;
  const audioUrl = launch.audio?.signedUrl;
  assert.ok(chartUrl && sidecarUrl && audioUrl, "Launch package is missing a chart, sidecar, or audio URL");
  const [chart, sidecar] = await Promise.all([fetch(chartUrl), fetch(sidecarUrl)]);
  let audio = await fetch(audioUrl, { method: "HEAD" });
  if (!audio.ok) {
    // Some object-store proxies do not expose HEAD. A one-byte range keeps
    // the fallback bounded while still proving the signed audio object works.
    audio = await fetch(audioUrl, { headers: { Range: "bytes=0-0" } });
    await audio.body?.cancel();
  }
  assert.ok(chart.ok && sidecar.ok && audio.ok, "Asset fetch failed");
  const clock = createLessonClock(await chart.text());
  const lesson = parseAuthoredLessonDraft(await sidecar.json());
  assert.equal(lesson.activityKey, options.activityKey, "Sidecar activity changed from the requested activity");
  const hydrated = timelineEventsFromAuthoredLesson(lesson, clock);
  const readinessBefore = evaluateLessonPublishReadiness(hydrated.events, {
    activityKey: options.activityKey,
    equationQueue: hydrated.equations,
  });

  let serialization: {
    ok: boolean;
    error?: string;
    serializedEncounterCount?: number;
    serializedActivityKey?: string;
  };
  let semanticEquivalent = false;
  let semanticChanges: string[] = [];
  let readinessAfterNoOp: ReturnType<typeof evaluateLessonPublishReadiness> | null = null;
  try {
    const saved = serializeAuthoredLesson(
      hydrated.events,
      lesson,
      clock,
      lesson.stopAtSeconds,
      hydrated.equations,
      { activityKey: options.activityKey },
    );
    const reparsed = parseAuthoredLessonDraft(saved);
    const rehydrated = timelineEventsFromAuthoredLesson(reparsed, clock);
    readinessAfterNoOp = evaluateLessonPublishReadiness(rehydrated.events, {
      activityKey: options.activityKey,
      equationQueue: rehydrated.equations,
    });
    const before = lesson.encounters.map(semanticSnapshot);
    const after = reparsed.encounters.map(semanticSnapshot);
    semanticChanges = before.length === after.length && before.every((item, index) => JSON.stringify(item) === JSON.stringify(after[index]))
      ? []
      : reparsed.encounters.map((item, index) => JSON.stringify(semanticSnapshot(lesson.encounters[index])) === JSON.stringify(semanticSnapshot(item)) ? "" : item.id).filter(Boolean);
    const equationsSemanticallyEquivalent =
      lesson.equations.length === reparsed.equations.length &&
      lesson.equations.every((equation, index) =>
        JSON.stringify(semanticEquationSnapshot(equation)) ===
        JSON.stringify(semanticEquationSnapshot(reparsed.equations[index])),
      );
    semanticEquivalent = semanticChanges.length === 0 && equationsSemanticallyEquivalent;
    serialization = {
      ok: true,
      serializedEncounterCount: reparsed.encounters.length,
      serializedActivityKey: reparsed.activityKey,
    };
  } catch (error) {
    serialization = { ok: false, error: safeError(error) };
  }

  const receipt = launch.receipt;
  return {
    songAssetId: options.songAssetId,
    requestedActivityKey: options.activityKey,
    packageActivityKey: launch.activityKey,
    sidecarActivityKey: lesson.activityKey,
    source: launch.source,
    authorId: launch.authorId ?? receipt?.authorId ?? options.authorId ?? null,
    inputRevision: launch.revision ?? receipt?.revision ?? options.revision ?? null,
    chartSha256: receipt?.hashes?.chartSha256 ?? null,
    sidecarSha256: receipt?.hashes?.sidecarSha256 ?? null,
    audioSha256: receipt?.hashes?.audioSha256 ?? null,
    receiptCounts: receipt?.counts ?? null,
    audioHttpStatus: audio.status,
    sourceEncounterCount: lesson.encounters.length,
    hydratedEventCount: hydrated.events.length,
    hydratedMechanicCount: mechanicCount(hydrated.events),
    readinessBefore: { ready: readinessBefore.ready, blockers: blockers(readinessBefore) },
    serialization,
    semanticEquivalence: semanticEquivalent,
    semanticChanges,
    readinessAfterNoOp: readinessAfterNoOp
      ? { ready: readinessAfterNoOp.ready, blockers: blockers(readinessAfterNoOp) }
      : null,
  };
}

async function main() {
  const { songs, options } = parseArgs(process.argv.slice(2));
  for (const songAssetId of songs) {
    try {
      console.log(JSON.stringify(await audit({ ...options, songAssetId })));
    } catch (error) {
      // Errors may include fetch URLs. Never expose launch credentials.
      console.log(JSON.stringify({ songAssetId, requestedActivityKey: options.activityKey, error: safeError(error) }));
      process.exitCode = 1;
    }
  }
}

void main();
