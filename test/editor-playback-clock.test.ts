import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canCaptureEditorPlayback, readEditorPlaybackSeconds } from "../lib/editor/playback-clock";
import { closeRecordedHold, type RecordedMechanicDraft } from "../lib/editor/recorded-draft";

const move = (id: string, mechanic: RecordedMechanicDraft["mechanic"], tick = 6): RecordedMechanicDraft => ({
  id, mechanic, tick, endTick: tick, equationId: "captured-equation", hitBubbles: [], spinTargets: [], dragTargets: [],
});

test("recording samples audio at input time instead of a stale displayed playhead", () => {
  const audio = { currentTime: 6.24987 };
  assert.equal(readEditorPlaybackSeconds(audio, 6), 6.24987);
  audio.currentTime = 6.29991;
  assert.equal(readEditorPlaybackSeconds(audio, 6), 6.29991);
  audio.currentTime = 0;
  assert.equal(readEditorPlaybackSeconds(audio, 90), 0, "Seeking to zero must not fall back to a stale display.");
});

test("missing or invalid audio uses a finite nonnegative editor position", () => {
  assert.equal(readEditorPlaybackSeconds(null, 12.34), 12.34);
  assert.equal(readEditorPlaybackSeconds({ currentTime: NaN }, 12.34), 12.34);
  assert.equal(readEditorPlaybackSeconds({ currentTime: Infinity }, 12.34), 12.34);
  assert.equal(readEditorPlaybackSeconds(null, NaN), 0);
  assert.equal(readEditorPlaybackSeconds(null, -4), 0);
});

test("a stale playing render cannot accept capture after media pause, seek, end or before data", () => {
  const media = { paused: false, ended: false, seeking: false, readyState: 4 };
  assert.equal(canCaptureEditorPlayback(media, true), true);
  assert.equal(canCaptureEditorPlayback(media, false), false);
  for (const interrupted of [{ paused: true }, { ended: true }, { seeking: true }, { readyState: 0 }, { readyState: 1 }]) {
    assert.equal(canCaptureEditorPlayback({ ...media, ...interrupted }, true), false);
  }
  assert.equal(canCaptureEditorPlayback(null, true), true, "Keep the existing no-media editing clock fallback.");
  assert.equal(canCaptureEditorPlayback(null, false), false);
});

for (const mechanic of ["spin", "drag"] as const) test(`${mechanic} closes at the sampled audio position while preserving the other moves`, () => {
  const owned = move("owned", mechanic);
  const other = move("other", "hit");
  const input = [owned, other];
  const next = closeRecordedHold(input, { draftId: owned.id, startTick: 6 }, readEditorPlaybackSeconds({ currentTime: 6.24987 }, 6));
  assert.equal(next[0].endTick, 6.25);
  assert.equal(next[0].equationId, owned.equationId);
  assert.equal(next[1], other);
  assert.equal(owned.endTick, 6, "Closing a hold must not mutate the recovery snapshot.");
  assert.equal(closeRecordedHold(input, { draftId: owned.id, startTick: 6 }, 3)[0].endTick, 6);
  assert.equal(closeRecordedHold(input, { draftId: owned.id, startTick: 6 }, NaN)[0].endTick, 6);
});

test("the real editor seals active recordings before moving the audio cursor and pauses their ownership", () => {
  const source = readFileSync(new URL("../app/student/lesson-builder/LessonBuilderClient.tsx", import.meta.url), "utf8");
  const seek = source.slice(source.indexOf("  function seekSong("), source.indexOf("  function handleSongPreviewRateChange("));
  assert.ok(seek.indexOf("handleFinalizeRtcmHold();") < seek.indexOf("audio.currentTime = nextSeconds"));
  assert.match(seek, /if \(rtcmPendingHoldRef\.current\) \{[\s\S]*audio\?\.pause\(\);[\s\S]*setIsSongPlaying\(false\)/);
  for (const name of ["handleStartRtcmHold", "handleRtcmAddHitAtPlayhead"]) {
    const start = source.indexOf(`  function ${name}(`);
    assert.match(source.slice(start, source.indexOf("\n  function ", start + 1)), /canCaptureEditorPlayback\(audioRef\.current, isSongPlaying\)/);
  }
  for (const name of ["handleStartRtcmEventCreation", "handleStartRtcmHold", "handleFinalizeRtcmHold", "handleFinalizeRtcmEventCreation", "handleFinalizePendingRangeSelection", "handleRtcmAddHitAtPlayhead", "handleBeginRctm2DragMarker", "handleCompleteRctm2DragMarker"]) {
    const start = source.indexOf(`  function ${name}(`);
    const body = source.slice(start, source.indexOf("\n  function ", start + 1));
    assert.match(body, /readEditorPlaybackSeconds\(audioRef\.current, currentSongSeconds\)/, `${name} must sample the same media clock`);
  }
});
