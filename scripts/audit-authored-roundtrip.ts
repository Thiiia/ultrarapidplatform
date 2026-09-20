import assert from "node:assert/strict";
import { parseAuthoredLessonDraft } from "../lib/authored-lesson";
import { serializeAuthoredLesson, timelineEventsFromAuthoredLesson } from "../lib/authored-lesson-serialization";
import { evaluateLessonPublishReadiness } from "../lib/guided-authored-encounter";
import { createLessonClock } from "../lib/editor/lesson-timing";

// Read-only: never calls save/publish or logs signed asset URLs.
const songs = ["garden", "geminiqueen", "grudge", "jazzmaybach", "justbecause", "oneone", "seven", "waves"];
async function audit(songAssetId: string) {
  const response = await fetch("https://ultrarapidplatform.vercel.app/api/song-package/launch", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songAssetId, activityKey: "early-algebra", rhythmDifficultyKey: "MediumSingle", learningDifficultyKey: "early-algebra" }),
  });
  assert.ok(response.ok, `Launch HTTP ${response.status}`);
  const launch = await response.json();
  assert.equal(launch.source, "authored");
  const [chart, sidecar] = await Promise.all([fetch(launch.chart.signedUrl), fetch(launch.sidecar.signedUrl)]);
  assert.ok(chart.ok && sidecar.ok, "Asset fetch failed");
  const clock = createLessonClock(await chart.text());
  const lesson = parseAuthoredLessonDraft(await sidecar.json());
  const hydrated = timelineEventsFromAuthoredLesson(lesson, clock);
  const readiness = evaluateLessonPublishReadiness(hydrated.events);
  const saved = serializeAuthoredLesson(hydrated.events, lesson, clock, lesson.stopAtSeconds, hydrated.equations);
  const reparsed = parseAuthoredLessonDraft(saved);
  const byId = new Map(reparsed.encounters.map(item => [item.id, item]));
  const changes: string[] = [];
  for (const original of lesson.encounters) {
    const after = byId.get(original.id);
    if (!after || ["eventId", "type", "equationId", "startTick", "endTick"].some(key =>
      original[key as keyof typeof original] !== after[key as keyof typeof after])) changes.push(original.id);
    const field = original.type === "hit" ? "hitBubbles" : original.type === "spin" ? "spinTargets" : "dragTargets";
    // targetId can be added on first hydration; token indexes and dependencies cannot change.
    const semanticTargets = (targets: any[] = []) => targets.map(({ targetId, ...target }) => target);
    assert.deepEqual(semanticTargets(after?.[field]), semanticTargets(original[field]), `${original.id}: targets changed`);
  }
  assert.equal(reparsed.encounters.length, lesson.encounters.length);
  const playableTargets = lesson.encounters.filter(item => item.type !== "hit").map(item => {
    const equation = lesson.equations.find(eq => eq.id === item.equationId)!;
    const targets = item.type === "spin" ? item.spinTargets : item.dragTargets;
    return { id: item.id, type: item.type, equation: equation.state, tokens: targets?.map(target => equation.tokens?.[target.tokenIndex]?.label ?? target.tokenIndex) };
  });
  return { songAssetId, encounters: lesson.encounters.length, ready: readiness.ready,
    blockers: readiness.blockers.map(item => ({ id: item.encounterId, reason: item.nextAction })),
    timingOrIdentityChanges: changes, playableTargets };
}
async function main() {
  for (const song of songs) {
    try { console.log(JSON.stringify(await audit(song))); }
    catch (error) {
      // Error messages may include fetch URLs. Never expose launch credentials.
      console.log(JSON.stringify({ songAssetId: song, error: String(error).replace(/https?:\/\/\S+/g, "[redacted URL]") }));
      process.exitCode = 1;
    }
  }
}
void main();
