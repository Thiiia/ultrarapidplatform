using System;
using System.Collections.Generic;

using UnityEngine;

using ChartLoader.NET.Framework;

public partial class DragExecutionController
{
	private float GetWispStreak01()
	{
		if (!wispStreakModulationEnabled || wispStreakModulationTargetStreak <= 0)
		{
			return 0f;
		}

		return Mathf.Clamp01(scoreStreak / (float)wispStreakModulationTargetStreak);
	}

	private float GetAdaptiveWispOverlapDistanceMultiplier()
	{
		float baseValue = Mathf.Clamp(wispOverlapDistanceMultiplier, 0.4f, 2f);
		if (!wispStreakModulationEnabled)
		{
			return baseValue;
		}

		float streak01 = GetWispStreak01();
		float assistScale = 1f + Mathf.Clamp(wispStreakAssistDistanceBoost, 0f, 0.35f);
		float tightenScale = 1f - Mathf.Clamp(wispStreakTightenDistance, 0f, 0.2f);
		float modulatedScale = Mathf.Lerp(assistScale, tightenScale, streak01);
		return Mathf.Clamp(baseValue * modulatedScale, 0.35f, 2.4f);
	}

	private float GetAdaptiveWispOverlapGoodMin()
	{
		float baseMin = Mathf.Clamp01(wispOverlapResultGoodMin);
		if (!wispStreakModulationEnabled)
		{
			return baseMin;
		}

		float streak01 = GetWispStreak01();
		float assistMin = Mathf.Clamp01(baseMin - Mathf.Clamp(wispStreakAssistGoodRelax, 0f, 0.2f));
		float tightenMin = Mathf.Clamp01(baseMin + Mathf.Clamp(wispStreakTightenGood, 0f, 0.15f));
		return Mathf.Lerp(assistMin, tightenMin, streak01);
	}

	private float GetAdaptiveWispOverlapPerfectMin(float resolvedGoodMin)
	{
		float baseMin = Mathf.Clamp01(wispOverlapResultPerfectMin);
		float goodMin = Mathf.Clamp01(resolvedGoodMin);
		if (!wispStreakModulationEnabled)
		{
			return Mathf.Clamp(baseMin, goodMin, 1f);
		}

		float streak01 = GetWispStreak01();
		float assistMin = Mathf.Clamp01(baseMin - Mathf.Clamp(wispStreakAssistPerfectRelax, 0f, 0.25f));
		float tightenMin = Mathf.Clamp01(baseMin + Mathf.Clamp(wispStreakTightenPerfect, 0f, 0.2f));
		float modulated = Mathf.Lerp(assistMin, tightenMin, streak01);
		return Mathf.Clamp(modulated, goodMin, 1f);
	}

	private float GetAdaptiveWispBeatPulseScale(float baseScale)
	{
		float clampedBase = Mathf.Clamp(baseScale, 0f, 0.35f);
		if (!wispStreakModulationEnabled)
		{
			return clampedBase;
		}

		float bonus = Mathf.Clamp01(GetWispStreak01()) * Mathf.Clamp(wispStreakBeatPulseBonus, 0f, 0.3f);
		return Mathf.Clamp(clampedBase * (1f + bonus), 0f, 0.35f);
	}

	private static bool IsFiniteDouble(double value)
	{
		return !double.IsNaN(value) && !double.IsInfinity(value);
	}

	private void ResetWispSongClockFallbackState()
	{
		wispClockLastRealtime = double.NaN;
		wispClockLastRawSongTime = double.NaN;
		wispClockLastResolvedSongTime = double.NaN;
		wispClockStallElapsed = 0d;
		wispClockUsingRealtimeFallback = false;
	}

	private double NowSongTime()
	{
		double realtimeNow = Time.unscaledTimeAsDouble;
		AudioManager audio = AudioManager.Instance;
		bool hasRawSongTime = false;
		bool isPlaying = false;
		bool isPaused = false;
		double rawSongTime = 0d;

		if (audio != null)
		{
			rawSongTime = audio.GetAdjustedSongTime();
			hasRawSongTime = IsFiniteDouble(rawSongTime);
			isPlaying = audio.IsPlaying;
			isPaused = audio.IsPaused;
		}

		if (!IsFiniteDouble(wispClockLastRealtime) || !IsFiniteDouble(wispClockLastResolvedSongTime))
		{
			double seed = hasRawSongTime ? Math.Max(0d, rawSongTime) : realtimeNow;
			wispClockLastRealtime = realtimeNow;
			wispClockLastRawSongTime = hasRawSongTime ? rawSongTime : seed;
			wispClockLastResolvedSongTime = seed;
			wispClockStallElapsed = 0d;
			wispClockUsingRealtimeFallback = !hasRawSongTime;
			return seed;
		}

		double realtimeDelta = Math.Max(0d, realtimeNow - wispClockLastRealtime);
		double resolved = wispClockLastResolvedSongTime;
		double stallThreshold = Math.Max(0.02d, wispSongClockStallFallbackSeconds);
		const double songAdvanceEpsilon = 0.0005d;

		if (!hasRawSongTime)
		{
			wispClockUsingRealtimeFallback = true;
			wispClockStallElapsed += realtimeDelta;
			resolved += realtimeDelta;
		}
		else
		{
			double rawDelta = rawSongTime - wispClockLastRawSongTime;
			bool progressed = rawDelta > songAdvanceEpsilon;
			bool jumpedBack = rawDelta < -0.02d;
			bool prePlaybackClock = !isPlaying && !isPaused;

			if (progressed && !jumpedBack)
			{
				wispClockStallElapsed = 0d;
			}
			else
			{
				wispClockStallElapsed += realtimeDelta;
			}

			bool stalled = wispClockStallElapsed >= stallThreshold && !isPaused;
			if (jumpedBack || prePlaybackClock || stalled)
			{
				wispClockUsingRealtimeFallback = true;
			}
			else if (progressed || isPaused)
			{
				wispClockUsingRealtimeFallback = false;
			}

			if (wispClockUsingRealtimeFallback)
			{
				resolved = Math.Max(rawSongTime, wispClockLastResolvedSongTime + realtimeDelta);
			}
			else
			{
				resolved = rawSongTime;
			}
		}

		if (resolved < wispClockLastResolvedSongTime)
		{
			resolved = wispClockLastResolvedSongTime;
		}

		wispClockLastRealtime = realtimeNow;
		wispClockLastRawSongTime = hasRawSongTime ? rawSongTime : resolved;
		wispClockLastResolvedSongTime = resolved;
		return resolved;
	}

	private void EnsureWispBeatCache()
	{
		Note[] notes = ChartSystem.CachedNotes;
		if (ReferenceEquals(notes, wispCachedNotesRef) && wispBeatTimes != null && wispBeatNotes != null)
		{
			return;
		}

		wispCachedNotesRef = notes;
		wispTargetBeatIndex = -1;

		if (notes == null || notes.Length == 0)
		{
			wispBeatTimes = null;
			wispBeatNotes = null;
			return;
		}

		List<(double t, Note n)> pairs = new List<(double, Note)>(notes.Length);
		for (int i = 0; i < notes.Length; i++)
		{
			Note n = notes[i];
			if (n == null) continue;
			double hit = ChartSystem.GetNoteHitTime(n);
			if (hit <= 0d) continue;
			pairs.Add((hit, n));
		}

		if (pairs.Count == 0)
		{
			wispBeatTimes = null;
			wispBeatNotes = null;
			return;
		}

		pairs.Sort((a, b) => a.t.CompareTo(b.t));

		const double eps = 0.0001d;
		List<double> times = new List<double>(Mathf.Min(1024, pairs.Count));
		List<Note> reps = new List<Note>(Mathf.Min(1024, pairs.Count));

		static Note PickRep(Note a, Note b)
		{
			if (a == null) return b;
			if (b == null) return a;

			// Prefer chords (more "intense" -> more interesting path).
			if (b.IsChord && !a.IsChord) return b;
			if (a.IsChord && !b.IsChord) return a;

			// When two notes share the same hit time, prefer the one with the longer sustain so
			// the wisp timing window can reflect holds instead of flattening to tap-note timing.
			float aDur = Mathf.Max(0f, a.DurationSeconds);
			float bDur = Mathf.Max(0f, b.DurationSeconds);
			if (Mathf.Abs(bDur - aDur) > 0.0001f)
			{
				return bDur > aDur ? b : a;
			}

			// Prefer higher lane when tied.
			return b.HighestFret > a.HighestFret ? b : a;
		}

		for (int i = 0; i < pairs.Count; i++)
		{
			double t = pairs[i].t;
			Note n = pairs[i].n;
			if (times.Count == 0 || Math.Abs(t - times[times.Count - 1]) > eps)
			{
				times.Add(t);
				reps.Add(n);
			}
			else
			{
				reps[reps.Count - 1] = PickRep(reps[reps.Count - 1], n);
			}
		}

		wispBeatTimes = times.ToArray();
		wispBeatNotes = reps.ToArray();
	}

	private bool TryGetNoteBeatWindow(double now, int steps, bool extendToSustainTail, out double start, out double end, out float beatSeconds, out int targetIndex)
	{
		start = now;
		end = now;
		beatSeconds = cachedBeatSeconds;
		targetIndex = -1;

		EnsureWispBeatCache();
		if (wispBeatTimes == null || wispBeatTimes.Length == 0)
		{
			return false;
		}

		double[] times = wispBeatTimes;
		int len = times.Length;
		const double eps = 0.0001d;

		// Find first index > now.
		int idx = Array.BinarySearch(times, now);
		if (idx < 0) idx = ~idx;

		int lastIdx = idx - 1;
		if (lastIdx >= 0 && lastIdx < len)
		{
			start = times[lastIdx];
		}
		else
		{
			// Before the first note: start now, end at the Nth upcoming note time.
			start = now;
			lastIdx = -1;
		}

		// Compute a reasonable beatSeconds from local spacing when possible.
		if (lastIdx >= 0)
		{
			int nextDistinct = lastIdx + 1;
			if (nextDistinct < len)
			{
				double dt = times[nextDistinct] - times[lastIdx];
				if (dt > 0.0005d)
				{
					beatSeconds = Mathf.Clamp((float)dt, 0.05f, 3f);
					cachedBeatSeconds = beatSeconds;
				}
			}
		}

		int s = Mathf.Clamp(steps, 1, 16);
		if (lastIdx < 0)
		{
			targetIndex = Mathf.Clamp(s - 1, 0, len - 1);
			end = times[targetIndex];
			if (extendToSustainTail && TryGetRepresentativeNoteEndTime(targetIndex, out double noteEndTime))
			{
				end = Math.Max(end, noteEndTime);
			}
			if (end <= start + eps)
			{
				end = start + (beatSeconds * s);
				targetIndex = -1;
			}
			return true;
		}

		targetIndex = Mathf.Clamp(lastIdx + s, 0, len - 1);
		end = times[targetIndex];
		if (extendToSustainTail && TryGetRepresentativeNoteEndTime(targetIndex, out double sustainedEnd))
		{
			end = Math.Max(end, sustainedEnd);
		}

		// If we're at the last note, synthesize a future end time.
		if (targetIndex == lastIdx || end <= start + eps)
		{
			end = start + (beatSeconds * s);
			targetIndex = -1;
		}

		return true;
	}

	private bool TryGetRepresentativeNoteEndTime(int index, out double endSongTime)
	{
		endSongTime = 0d;
		if (wispBeatNotes == null || index < 0 || index >= wispBeatNotes.Length)
		{
			return false;
		}

		Note note = wispBeatNotes[index];
		if (note == null)
		{
			return false;
		}

		double hit = ChartSystem.GetNoteHitTime(note);
		if (hit <= 0d)
		{
			return false;
		}

		double sustain = Math.Max(0d, (double)Mathf.Max(0f, note.DurationSeconds));
		endSongTime = hit + sustain;
		return sustain > 0.001d;
	}

	private bool TryGetScheduledBeatWindow(double now, int steps, out double start, out double end, out float beatSeconds, out int targetIndex)
	{
		start = now;
		end = now;
		beatSeconds = cachedBeatSeconds;
		targetIndex = -1;

		if (ResolveChartSystem() == null)
		{
			return false;
		}

		return chartSystem.TryGetScheduledBeatWindow(now, steps, out start, out end, out beatSeconds, out targetIndex);
	}

	private bool TryResolveWispTimingWindow(
		double now,
		int steps,
		bool activeDragTiming,
		out double start,
		out double end,
		out float beatSeconds,
		out int targetIndex,
		out bool usedNoteWindowTiming,
		out string timingSource)
	{
		start = now;
		end = now;
		beatSeconds = cachedBeatSeconds;
		targetIndex = -1;
		usedNoteWindowTiming = false;
		timingSource = "none";

		ResolveChartSystem();

		bool preferSyncTrackBeats =
			chartSystem != null &&
			chartSystem.BeatMode == ChartSystem.BeatScheduleMode.FromSyncTrackQuarterNotes;
		bool extendNoteWindowToSustainTail = !activeDragTiming || !wispActiveDragChartTimingHitOnly;

		// Gameplay drag timing should prefer authored note windows over scheduled quarter-note beats.
		// That keeps sustains/chords meaningful instead of flattening all cues to a metronome.
		bool useNoteTimingFirst = activeDragTiming;

		if (useNoteTimingFirst &&
			TryGetNoteBeatWindow(now, steps, extendNoteWindowToSustainTail, out start, out end, out beatSeconds, out targetIndex))
		{
			usedNoteWindowTiming = true;
			timingSource = "note-primary";
			return true;
		}

		if (preferSyncTrackBeats &&
			TryGetScheduledBeatWindow(now, steps, out start, out end, out beatSeconds, out targetIndex))
		{
			timingSource = "scheduled-sync";
			return true;
		}

		if (TryGetNoteBeatWindow(now, steps, extendNoteWindowToSustainTail, out start, out end, out beatSeconds, out targetIndex))
		{
			usedNoteWindowTiming = true;
			timingSource = "note-fallback";
			return true;
		}

		if (TryGetScheduledBeatWindow(now, steps, out start, out end, out beatSeconds, out targetIndex))
		{
			timingSource = "scheduled-fallback";
			return true;
		}

		timingSource = "legacy-static";
		double lastBeat = ChartSystem.LastBeatSequenceIndex >= 0 ? ChartSystem.LastBeatSongTime : 0d;
		double nextBeat = ChartSystem.NextBeatSequenceIndex >= 0 ? ChartSystem.NextBeatSongTime : 0d;

		if (nextBeat > lastBeat + 0.0005d)
		{
			beatSeconds = Mathf.Clamp((float)(nextBeat - lastBeat), 0.05f, 3f);
		}

		start = lastBeat > 0d ? lastBeat : now;
		end = start + (beatSeconds * Mathf.Clamp(steps, 1, 16));
		targetIndex = -1;
		return true;
	}

	private void PrepareWispTiming()
	{
		wispTimingPrepared = false;
		wispHasTimingContext = false;
		wispLateHoldGraceUntilSongTime = double.NegativeInfinity;
		hasActiveDragBeatPayload = false;
		wispTargetBeatIndex = -1;
		ResetWispSongClockFallbackState();

		double now = NowSongTime();
		int steps = GetAdaptiveWispTravelStepCount();
		wispRuntimeTravelSteps = steps;
		bool activeDragTiming = currentDraggingElement != null;
		bool usedNoteWindowTiming;
		string timingSource;
		TryResolveWispTimingWindow(
			now,
			steps,
			activeDragTiming,
			out wispStartSongTime,
			out wispEndSongTime,
			out float resolvedBeatSeconds,
			out int resolvedTargetIndex,
			out usedNoteWindowTiming,
			out timingSource);
		wispExpectedDropSongTime = wispEndSongTime;
		cachedBeatSeconds = Mathf.Clamp(resolvedBeatSeconds, 0.05f, 3f);
		wispTargetBeatIndex = resolvedTargetIndex;

		// The scheduled window start can legitimately be in the past (last beat/note), but for drag UX
		// the moving target should always begin at the start of the path when the player starts dragging.
		// Keep the beat-aligned expected drop time, but anchor the animation start to "now".
		double beatAlignedExpectedDrop = wispExpectedDropSongTime;
		if (beatAlignedExpectedDrop <= now + 0.0005d)
		{
			double fallbackLead = Math.Max(0.1d, (double)Mathf.Clamp(cachedBeatSeconds, 0.05f, 3f));
			beatAlignedExpectedDrop = now + fallbackLead;
		}

		wispStartSongTime = Math.Max(wispStartSongTime, now);
		wispEndSongTime = Math.Max(beatAlignedExpectedDrop, wispStartSongTime + 0.05d);
		wispExpectedDropSongTime = wispEndSongTime;

		double total = wispEndSongTime - wispStartSongTime;
		float totalSeconds = total > 0.001d ? (float)total : 0.001f;
		float unclampedTotalSeconds = totalSeconds;
		float minTravel = Mathf.Max(0.05f, wispTravelDurationMinSeconds);
		// Preserve beat alignment for active drag timing; a long visual minimum can otherwise
		// push the moving target past the intended beat and make "on-time" hits feel late.
		if (wispExpectedDropSongTime > now + 0.0005d)
		{
			minTravel = 0.05f;
		}
		float maxTravel = Mathf.Max(minTravel, wispTravelDurationMaxSeconds);
		if (usedNoteWindowTiming)
		{
			// Chart-authored note windows (including sustains) are authoritative. Do not flatten them
			// back to a generic visual max, otherwise sparse charts feel like "auto" timing.
			maxTravel = Mathf.Max(maxTravel, totalSeconds);
		}
		else if (!activeDragTiming && wispPreserveIdleChartNoteDurations)
		{
			// Non-note timing (scheduled beats / fallback) can still use a broader idle cap if desired.
			maxTravel = Mathf.Max(maxTravel, Mathf.Max(0.05f, wispIdleChartNoteDurationMaxSeconds));
		}
		float clampedDuration = Mathf.Clamp(totalSeconds, minTravel, maxTravel);
		if (!Mathf.Approximately(clampedDuration, totalSeconds))
		{
			wispEndSongTime = wispStartSongTime + clampedDuration;
			wispExpectedDropSongTime = wispEndSongTime;
			totalSeconds = clampedDuration;
		}

		HitWindows windows = JudgementService.Windows;
		wispGreenZoneStartRuntime = Mathf.Clamp01(1f - (Mathf.Max(0.001f, windows.good) / totalSeconds));
		wispPerfectZoneStartRuntime = Mathf.Clamp01(1f - (Mathf.Max(0.001f, windows.perfect) / totalSeconds));
		wispGreenZoneEndRuntime = 1f;

		wispTimingPrepared = true;
		wispHasTimingContext = true;

		if (wispLogTimingDiagnostics)
		{
			bool chartLoaded = ChartSystem.CachedNotes != null && ChartSystem.CachedNotes.Length > 0;
			double remaining = Math.Max(0d, wispExpectedDropSongTime - now);
			Debug.Log(
				$"[AlgebraWispTiming] source={timingSource} activeDrag={activeDragTiming} chartLoaded={chartLoaded} " +
				$"sustainTail={!activeDragTiming || !wispActiveDragChartTimingHitOnly} " +
				$"steps={steps} targetIdx={wispTargetBeatIndex} beat={cachedBeatSeconds:F3}s " +
				$"windowRaw={unclampedTotalSeconds:F3}s windowFinal={totalSeconds:F3}s " +
				$"start={wispStartSongTime:F3} end={wispEndSongTime:F3} now={now:F3} lead={remaining:F3}");
		}

		// Optional: broadcast a scheduled timing event so any rhythm UI hooks can react (safe no-op if no listeners).
		float lead = Mathf.Max(0.1f, (float)(wispExpectedDropSongTime - now));
		activeDragBeatPayload = new BeatPayload(wispExpectedDropSongTime, ++dragBeatSequenceCounter, cachedBeatSeconds, lead);
		hasActiveDragBeatPayload = true;
		GameplayEventBus.RaiseBeatScheduled(activeDragBeatPayload);
	}

	private bool TryEvaluateChartTimingWithGrace(out JudgementService.HitInfo hit)
	{
		hit = new JudgementService.HitInfo();
		double now = NowSongTime();
		if (wispTimingPrepared)
		{
			hit = JudgementService.JudgeDetailed(wispExpectedDropSongTime, now);
			return true;
		}

		if (!wispHasTimingContext)
		{
			return false;
		}

		if (now <= wispLateHoldGraceUntilSongTime)
		{
			hit = JudgementService.JudgeDetailed(wispExpectedDropSongTime, now);
			return true;
		}

		float signedErrorMs = (float)((now - wispExpectedDropSongTime) * 1000d);
		hit = new JudgementService.HitInfo
		{
			result = HitResult.Miss,
			signedErrorMs = signedErrorMs,
			absErrorMs = Mathf.Abs(signedErrorMs),
			normalizedToMiss = 1f
		};
		return true;
	}

	private static void ApplyTimingFeedbackFromHit(JudgementService.HitInfo hit, out string label, out Color color, out float score)
	{
		switch (hit.result)
		{
			case HitResult.Perfect:
				label = "Perfect!";
				color = Color.green;
				score = 1f;
				return;
			case HitResult.Good:
				label = "Good!";
				color = new Color(0.7f, 1f, 0.3f);
				score = 0.85f;
				return;
			default:
				bool early = hit.signedErrorMs < 0f;
				label = early ? "Early!" : "Late!";
				color = early ? Color.yellow : new Color(1f, 0.5f, 0.2f);
				float normalized = float.IsNaN(hit.normalizedToMiss) ? 1f : Mathf.Clamp01(hit.normalizedToMiss);
				score = Mathf.Lerp(0.55f, 0.2f, normalized);
				return;
		}
	}

	private JudgementService.HitInfo EvaluateTimingDetailed(out string label, out Color color, out float score, out HitResult hitResult)
	{
		label = "Nice!";
		color = Color.green;
		score = 1f;
		hitResult = HitResult.None;

		if (!TryEvaluateChartTimingWithGrace(out JudgementService.HitInfo hit))
		{
			// Legacy fallback: no chart window prepared. No meaningful signed ms.
			label = GetTimingFeedback();
			color = GetTimingFeedbackColor();
			score = CalculateTimingScore();
			hitResult = HitResult.None;
			return new JudgementService.HitInfo
			{
				result = HitResult.None,
				signedErrorMs = float.NaN,
				absErrorMs = float.NaN,
				normalizedToMiss = float.NaN
			};
		}

		hitResult = hit.result;
		ApplyTimingFeedbackFromHit(hit, out label, out color, out score);
		return hit;
	}

	private bool IsLegacyTimingExpired()
	{
		float end = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		return wispProgress >= Mathf.Clamp01(end - 0.0005f);
	}

	private float CalculateTimingScore()
	{
		// Calculate score based on wisp progress when player lands
		// Perfect: wisp is in perfect zone (0.85-0.95)
		// Good: wisp is in green zone (0.7-0.95)
		// Early: wisp hasn't reached green zone yet
		// Late: wisp has passed the end

		if (IsLegacyTimingExpired())
		{
			return 0.3f; // Late
		}
		else if (wispProgress >= perfectZoneStart && wispProgress < greenZoneEnd)
		{
			return 1f; // Perfect timing
		}
		else if (wispProgress >= greenZoneStart && wispProgress < greenZoneEnd)
		{
			return 0.8f; // Good timing
		}
		else if (wispProgress < greenZoneStart)
		{
			return 0.5f; // Early
		}
		else
		{
			return 0.3f; // Late
		}
	}

	private string GetTimingFeedback()
	{
		if (IsLegacyTimingExpired())
		{
			return "Late!";
		}
		else if (wispProgress >= perfectZoneStart && wispProgress < greenZoneEnd)
		{
			return "Perfect!";
		}
		else if (wispProgress >= greenZoneStart && wispProgress < greenZoneEnd)
		{
			return "Good!";
		}
		else if (wispProgress < greenZoneStart)
		{
			return "Early!";
		}
		else
		{
			return "Late!";
		}
	}

	private Color GetTimingFeedbackColor()
	{
		if (IsLegacyTimingExpired())
		{
			return new Color(1f, 0.5f, 0.2f);
		}
		else if (wispProgress >= perfectZoneStart && wispProgress < greenZoneEnd)
		{
			return Color.green;
		}
		else if (wispProgress >= greenZoneStart && wispProgress < greenZoneEnd)
		{
			return new Color(0.7f, 1f, 0.3f);
		}
		else if (wispProgress < greenZoneStart)
		{
			return Color.yellow;
		}
		else
		{
			return new Color(1f, 0.5f, 0.2f);
		}
	}
}
