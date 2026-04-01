using System;

using Shapes;
using UnityEngine;
using UnityEngine.Rendering;

public partial class DragExecutionController
{
	private float GetScaledAlgebraApproachRingStartScale(float baseScale)
	{
		return Mathf.Max(1f, baseScale * Mathf.Max(1f, algebraApproachRingScaleMultiplier));
	}

	private float GetScaledSourceBubbleApproachRingStartScale()
	{
		// Dot-mode already has a full rendered path, so the source cue should stay local to the bubble
		// instead of inheriting the larger equation-wide ring multiplier used for target emphasis.
		if (wispDotSprite != null)
		{
			return Mathf.Max(1f, sourceBubbleApproachRingStartScale);
		}

		return GetScaledAlgebraApproachRingStartScale(sourceBubbleApproachRingStartScale);
	}

	private float GetScaledWispTargetApproachRingStartScale()
	{
		float dampedMultiplier = Mathf.Max(1f, algebraApproachRingScaleMultiplier * Mathf.Clamp(wispTargetApproachRingScaleDampen, 0.35f, 1f));
		return Mathf.Max(1f, wispTargetApproachRingStartScale * dampedMultiplier);
	}

	private float EvaluateApproachRingClosure01(float progress01)
	{
		float clamped = Mathf.Clamp01(progress01);
		float smoothed = Mathf.SmoothStep(0f, 1f, clamped);
		return Mathf.Lerp(clamped, smoothed, 0.35f);
	}

	private float EvaluateApproachRingImminence01(float progress01, float focusStart01)
	{
		float progress = Mathf.Clamp01(progress01);
		if (progress >= focusStart01)
		{
			return 1f;
		}

		float focusT = Mathf.InverseLerp(0f, Mathf.Max(0.0001f, focusStart01), progress);
		return Mathf.SmoothStep(0f, 1f, focusT);
	}

	private float EvaluateApproachRingAmbientPulse01(float progress01, float hz, float phaseScale)
	{
		float phase = (Time.unscaledTime * Mathf.Max(0f, hz) * Mathf.PI * 2f) + (Mathf.Clamp01(progress01) * phaseScale);
		return 0.5f + (0.5f * Mathf.Sin(phase));
	}

	private float EvaluateApproachRingFadeOutAlpha01(float progress01, float fadeNearHit, float latestFadeStart01, float earliestFadeStart01)
	{
		float clampedProgress = Mathf.Clamp01(progress01);
		float fadeStart = Mathf.Lerp(
			Mathf.Clamp01(latestFadeStart01),
			Mathf.Clamp01(earliestFadeStart01),
			Mathf.Clamp01(fadeNearHit));
		float fadeT = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(fadeStart, 1f, clampedProgress));
		return 1f - fadeT;
	}

	private static int GetSourceBubbleApproachStepCount()
	{
		// The source cue should announce the next actionable hit window, not the whole travel profile.
		return 1;
	}

	private void EnsureSourceBubbleApproachRing(EquationBubbleElement source)
	{
		if (!showSourceBubbleApproachRing || source == null)
		{
			ClearSourceBubbleApproachRing();
			return;
		}

		if (sourceBubbleApproachRingOwner == source &&
			sourceBubbleApproachRingRect != null &&
			sourceBubbleApproachRingDisc != null)
		{
			if (!sourceBubbleApproachRingDisc.gameObject.activeSelf)
			{
				sourceBubbleApproachRingDisc.gameObject.SetActive(true);
			}

			return;
		}

		if (sourceBubbleApproachRingDisc == null || sourceBubbleApproachRingRect == null)
		{
			if (equationContainer == null)
			{
				return;
			}

			GameObject ringObject = new GameObject("SourceBubbleApproachDisc", typeof(RectTransform), typeof(Disc));
			ringObject.transform.SetParent(equationContainer, false);
			sourceBubbleApproachRingRect = ringObject.GetComponent<RectTransform>();
			sourceBubbleApproachRingDisc = ringObject.GetComponent<Disc>();

			sourceBubbleApproachRingDisc.Type = DiscType.Ring;
			sourceBubbleApproachRingDisc.RadiusSpace = ThicknessSpace.Meters;
			sourceBubbleApproachRingDisc.ThicknessSpace = ThicknessSpace.Meters;
			sourceBubbleApproachRingDisc.ZTest = CompareFunction.Always;
			sourceBubbleApproachRingDisc.Color = new Color(sourceBubbleApproachRingColor.r, sourceBubbleApproachRingColor.g, sourceBubbleApproachRingColor.b, 0f);
			sourceBubbleApproachRingDisc.gameObject.SetActive(false);
		}

		sourceBubbleApproachRingOwner = source;
		sourceBubbleApproachRingRect.SetParent(source.transform, false);
		sourceBubbleApproachRingRect.SetAsLastSibling();
		sourceBubbleApproachRingRect.anchorMin = new Vector2(0.5f, 0.5f);
		sourceBubbleApproachRingRect.anchorMax = new Vector2(0.5f, 0.5f);
		sourceBubbleApproachRingRect.pivot = new Vector2(0.5f, 0.5f);
		sourceBubbleApproachRingRect.anchoredPosition = Vector2.zero;
		sourceBubbleApproachRingRect.sizeDelta = Vector2.zero;
		sourceBubbleApproachRingRect.localRotation = Quaternion.identity;
		sourceBubbleApproachRingRect.localScale = Vector3.one;

		sourceBubbleApproachRingDisc.gameObject.SetActive(true);
		SyncSourceBubbleApproachRingDiscSorting();
	}

	private void ClearSourceBubbleApproachRing()
	{
		if (sourceBubbleApproachRingDisc != null)
		{
			Color hidden = sourceBubbleApproachRingDisc.Color;
			hidden.a = 0f;
			sourceBubbleApproachRingDisc.Color = hidden;
			sourceBubbleApproachRingDisc.gameObject.SetActive(false);
		}

		if (sourceBubbleApproachRingRect != null)
		{
			sourceBubbleApproachRingRect.localScale = Vector3.one;
			sourceBubbleApproachRingRect.localRotation = Quaternion.identity;
			sourceBubbleApproachRingRect.anchoredPosition = Vector2.zero;
			if (equationContainer != null)
			{
				sourceBubbleApproachRingRect.SetParent(equationContainer, false);
			}
		}

		sourceBubbleApproachRingOwner = null;
		ResetSourceApproachCueState();
	}

	private void UpdateSourceBubbleApproachRing()
	{
		if (!showSourceBubbleApproachRing)
		{
			ClearSourceBubbleApproachRing();
			return;
		}

		// This ring is a pre-drag chart cue, analogous to osu!'s slider start pre-empt.
		// Once the player starts dragging, the moving target and optional drag ring take over.
		if (currentDraggingElement != null)
		{
			ClearSourceBubbleApproachRing();
			return;
		}

		EquationBubbleElement source = GetActiveWispSourceElement();
		if (source == null || !TryGetSourceBubbleApproachProgress(source, out float progress01))
		{
			ClearSourceBubbleApproachRing();
			return;
		}

		EnsureSourceBubbleApproachRing(source);
		if (sourceBubbleApproachRingOwner != source ||
		    sourceBubbleApproachRingRect == null ||
		    sourceBubbleApproachRingDisc == null)
		{
			return;
		}

		float eased = EvaluateApproachRingClosure01(progress01);
		float ringScale = Mathf.Lerp(
			GetScaledSourceBubbleApproachRingStartScale(),
			1f,
			eased);
		float pulse01 = EvaluateApproachRingAmbientPulse01(progress01, 1.6f, 1.3f);
		float polishDepth = Mathf.Lerp(0.04f, 0.012f, eased) * Mathf.Lerp(1f, 0.7f, eased);
		float polishScale = 1f + (((pulse01 * 2f) - 1f) * polishDepth);
		sourceBubbleApproachRingRect.localScale = Vector3.one * polishScale;

		float bubbleRadiusPx = Mathf.Max(4f, GetEquationBubbleVisualRadius(source));
		float targetVisualRadiusPx = Mathf.Max(4f, bubbleRadiusPx * ringScale);
		float d = Mathf.Max(8f, ToWispShapeUnits(targetVisualRadiusPx * 2f));
		float thickness = Mathf.Max(0.75f, d * Mathf.Clamp(sourceBubbleApproachRingThicknessRatio, 0.01f, 0.12f));
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		sourceBubbleApproachRingDisc.Thickness = thickness;
		sourceBubbleApproachRingDisc.Radius = radius;
		SyncSourceBubbleApproachRingDiscSorting();

		Color ringColor = ResolveSourceBubbleApproachRingColor(progress01);
		sourceBubbleApproachRingDisc.Color = ringColor;
		bool visible = ringColor.a > 0.001f;
		SetApproachCueVisibility(ref sourceApproachCueState, visible);
		sourceBubbleApproachRingDisc.gameObject.SetActive(visible);
	}

	private bool TryGetSourceBubbleApproachProgress(EquationBubbleElement source, out float progress01)
	{
		progress01 = 0f;

		if (!isActive)
		{
			return false;
		}

		AudioManager audio = AudioManager.Instance;
		if (audio == null || !audio.HasSongStarted)
		{
			return false;
		}

		double now = NowSongTime();
		if (!sourceApproachCueState.MatchesOwner(source))
		{
			ResetSourceApproachCueState();
			RebindApproachCueOwner(ref sourceApproachCueState, source);
		}

		int steps = GetSourceBubbleApproachStepCount();
		if (!TryResolveWispTimingWindow(
			now,
			steps,
			activeDragTiming: true,
			out double windowStart,
			out double windowEnd,
			out float beatSeconds,
			out int targetIndex,
			out _,
			out string timingSource))
		{
			return false;
		}

		if (windowEnd <= now + 0.0005d)
		{
			double fallbackBeat = Math.Max(0.05d, beatSeconds);
			windowStart = windowEnd;
			windowEnd += fallbackBeat;
		}

		bool needNewWindow = !sourceApproachCueState.isPrepared;
		if (!needNewWindow && now > sourceApproachCueState.endSongTime + 0.0005d)
		{
			needNewWindow = true;
		}

		if (!needNewWindow &&
			targetIndex >= 0 &&
			sourceApproachCueState.targetIndex >= 0 &&
			targetIndex != sourceApproachCueState.targetIndex)
		{
			needNewWindow = true;
		}

		if (!needNewWindow && targetIndex < 0)
		{
			double retargetThreshold = Math.Max(0.05d, beatSeconds * 0.25d);
			if (Math.Abs(windowEnd - sourceApproachCueState.endSongTime) > retargetThreshold)
			{
				needNewWindow = true;
			}
		}

		if (needNewWindow)
		{
			PrepareApproachCueWindow(
				ref sourceApproachCueState,
				ApproachCueKind.SourceBubble,
				source,
				ApproachCueSemantic.NoteHead,
				now,
				windowEnd,
				targetIndex,
				activeWispWindowState.isPrepared ? activeWispWindowState.windowId : -1,
				timingSource);
		}
		else
		{
			RebindApproachCueOwner(ref sourceApproachCueState, source);
		}

		return UpdateApproachCueProgressFromSongTime(ref sourceApproachCueState, now, out progress01);
	}

	private Color ResolveSourceBubbleApproachRingColor(float progress01)
	{
		float progress = Mathf.Clamp01(progress01);
		Color targetColor = Color.Lerp(sourceBubbleApproachRingColor, wispOverlapGoodColor, Mathf.SmoothStep(0f, 0.9f, progress));
		if (progress >= 0.92f)
		{
			float perfectBlend = Mathf.InverseLerp(0.92f, 1f, progress);
			targetColor = Color.Lerp(wispOverlapGoodColor, wispOverlapPerfectColor, perfectBlend);
		}

		float alphaMul = EvaluateApproachRingFadeOutAlpha01(
			progress,
			sourceBubbleApproachRingFadeNearHit,
			latestFadeStart01: 0.84f,
			earliestFadeStart01: 0.58f);
		targetColor.a = Mathf.Clamp01(sourceBubbleApproachRingBaseAlpha * alphaMul);
		return targetColor;
	}
}
