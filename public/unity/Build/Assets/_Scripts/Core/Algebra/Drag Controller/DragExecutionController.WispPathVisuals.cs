using System.Collections.Generic;
using DG.Tweening;
using Shapes;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private readonly List<Disc> wispTickMarkerDiscs = new List<Disc>(8);
	private readonly Stack<Disc> wispTickMarkerDiscPool = new Stack<Disc>(8);

	private static Color GetPerfectZoneColor()
	{
		return new Color(0.3f, 1f, 0.4f, 0.7f);
	}

	private Color EvaluateWispDirectionalGradient(float normalizedT)
	{
		float t = Mathf.Clamp01(normalizedT);
		float expo = Mathf.Clamp(wispPathGradientExponent, 0.35f, 2.4f);
		float shaped = Mathf.Pow(t, expo);

		float midPos = Mathf.Clamp(wispPathGradientMiddlePosition, 0.05f, 0.95f);
		float midBlend = Mathf.Clamp01(wispPathGradientMiddleBlendStrength);
		Color baselineMid = Color.Lerp(wispPathGradientStartColor, wispPathGradientEndColor, midPos);
		Color mid = Color.Lerp(baselineMid, wispPathGradientMiddleColor, midBlend);

		if (shaped <= midPos)
		{
			float local = Mathf.InverseLerp(0f, midPos, shaped);
			return Color.Lerp(wispPathGradientStartColor, mid, local);
		}

		float tail = Mathf.InverseLerp(midPos, 1f, shaped);
		return Color.Lerp(mid, wispPathGradientEndColor, tail);
	}

	private Color EvaluateWispBasePathColor(float normalizedT)
	{
		float t = Mathf.Clamp01(normalizedT);
		if (IsWispPathGradientOnlyModeEnabled() || wispUseDirectionalPathGradient)
		{
			return EvaluateWispDirectionalGradient(t);
		}

		return wispPathColor;
	}

	private float GetWispBehindPathAlphaFloor()
	{
		if (!wispRenderBehindEquationBubbles)
		{
			return 0f;
		}

		return Mathf.Clamp01(wispPathMinAlphaWhenBehind + wispPathAlphaLiftWhenBehind);
	}

	private float GetWispBehindZoneAlphaFloor(bool perfectZone)
	{
		if (!wispRenderBehindEquationBubbles)
		{
			return 0f;
		}

		float baseFloor = GetWispBehindPathAlphaFloor();
		float zoneBonus = perfectZone ? 0.04f : 0.02f;
		return Mathf.Clamp01(baseFloor + Mathf.Clamp(wispZoneAlphaLiftWhenBehind, 0f, 0.35f) + zoneBonus);
	}

	private Color GetWispSegmentColor(bool inGreenZone, bool inPerfectZone, float normalizedT)
	{
		Color c;
		float t = Mathf.Clamp01(normalizedT);
		float greenStartT = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float perfectStartT = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;
		float zoneT = Mathf.InverseLerp(greenStartT, 1f, t);
		Color zoneGradient = Color.Lerp(
			wispGoodZoneGradientStartColor,
			wispGoodZoneGradientEndColor,
			Mathf.SmoothStep(0f, 1f, zoneT));

		if (IsWispPathGradientOnlyModeEnabled())
		{
			c = EvaluateWispBasePathColor(t);
		}
		else if (wispUseDirectionalPathGradient)
		{
			c = EvaluateWispBasePathColor(t);

			float preGreenRamp = Mathf.Clamp(wispPathPreGreenRampWidth, 0f, 0.45f);
			if (!inGreenZone && !inPerfectZone && preGreenRamp > 0.0005f)
			{
				float rampStart = Mathf.Clamp01(greenStartT - preGreenRamp);
				if (t >= rampStart && t < greenStartT)
				{
					float rampT = Mathf.InverseLerp(rampStart, greenStartT, t);
					float strength = Mathf.Clamp01(wispPathPreGreenRampStrength) * rampT;
					c = Color.Lerp(c, zoneGradient, strength);
				}
			}

			if (inPerfectZone)
			{
				float perfectStrength = Mathf.Clamp01(wispPathPerfectZoneTintStrength);
				float perfectRamp = Mathf.InverseLerp(greenStartT, Mathf.Max(greenStartT + 0.0001f, perfectStartT), t);
				Color perfectTarget = Color.Lerp(zoneGradient, wispOverlapPerfectColor, 0.72f);
				c = Color.Lerp(c, perfectTarget, perfectStrength * Mathf.Lerp(0.85f, 1f, perfectRamp));
			}
			else if (inGreenZone)
			{
				float zoneStrength = Mathf.Clamp01(wispPathGreenZoneTintStrength + wispGoodZoneGradientStrength);
				if (wispGoodZoneShimmerStrength > 0.0001f)
				{
					float phase = (Time.unscaledTime * Mathf.Max(0.1f, wispGoodZoneShimmerHz) * Mathf.PI * 2f) + (t * Mathf.PI * 3.2f);
					float shimmer = (0.5f + (0.5f * Mathf.Sin(phase))) * Mathf.Clamp01(wispGoodZoneShimmerStrength);
					zoneStrength = Mathf.Clamp01(zoneStrength + shimmer);
				}

				c = Color.Lerp(c, zoneGradient, zoneStrength);
			}
		}
		else if (inPerfectZone)
		{
			Color perfect = GetPerfectZoneColor();
			if (wispRenderBehindEquationBubbles)
			{
				float floor = GetWispBehindZoneAlphaFloor(perfectZone: true);
				perfect.a = Mathf.Max(perfect.a, floor);
			}
			c = perfect;
		}
		else
		{
			c = inGreenZone ? zoneGradient : wispPathColor;
		}

		if (wispRenderBehindEquationBubbles)
		{
			if (!IsWispPathGradientOnlyModeEnabled() && !inGreenZone && !inPerfectZone)
			{
				Color liftTint = wispPathBehindLiftColor;
				liftTint.a = c.a;
				c = Color.Lerp(c, liftTint, Mathf.Clamp01(wispPathTintLiftWhenBehind));
			}

			float floor = (inGreenZone || inPerfectZone)
				? GetWispBehindZoneAlphaFloor(inPerfectZone)
				: GetWispBehindPathAlphaFloor();
			c.a = Mathf.Max(c.a, floor);
		}

		return c;
	}

	private void AddWispTimingTickMarker(float t, float pathWidth, Color color, int markerIndex)
	{
		if (!ShouldRenderWispTimingMarkers() || currentWispPath == null || currentWispPath.Count < 2)
		{
			return;
		}

		float clampedT = Mathf.Clamp01(t);
		float pathPos = clampedT * (currentWispPath.Count - 1);
		int idx = Mathf.Clamp(Mathf.RoundToInt(pathPos), 0, currentWispPath.Count - 1);
		Vector2 pos = currentWispPath[idx];

		float markerSize = Mathf.Max(3f, pathWidth * Mathf.Clamp(wispTimingTickSizeRatio, 0.08f, 0.4f));
		Color tickColor = color;
		tickColor.a = Mathf.Clamp01(wispTimingTickAlpha);

		Disc disc = CreateWispTimingTickDisc(pos, markerSize, tickColor, markerIndex);
		if (disc != null)
		{
			wispTickMarkerDiscs.Add(disc);
		}
	}

	private Disc CreateWispTimingTickDisc(Vector2 position, float diameter, Color color, int markerIndex)
	{
		if (wispPathContainer == null)
		{
			return null;
		}

		Disc disc = AcquireWispTimingTickDisc();
		if (disc == null)
		{
			return null;
		}

		GameObject markerObj = disc.gameObject;
		markerObj.name = $"PathTick_{markerIndex}";
		RectTransform markerRect = markerObj.GetComponent<RectTransform>();
		markerRect.anchorMin = new Vector2(0.5f, 0.5f);
		markerRect.anchorMax = new Vector2(0.5f, 0.5f);
		markerRect.pivot = new Vector2(0.5f, 0.5f);
		markerRect.anchoredPosition = position;
		markerRect.sizeDelta = new Vector2(diameter, diameter);
		disc.Type = DiscType.Disc;
		disc.RadiusSpace = ThicknessSpace.Meters;
		disc.Radius = Mathf.Max(1f, diameter * 0.5f);
		disc.ZTest = CompareFunction.Always;
		disc.Color = color;
		SyncWispTickMarkerDiscSorting(disc);
		return disc;
	}

	private Disc AcquireWispTimingTickDisc()
	{
		while (wispTickMarkerDiscPool.Count > 0)
		{
			Disc pooled = wispTickMarkerDiscPool.Pop();
			if (pooled == null)
			{
				continue;
			}

			pooled.transform.SetParent(wispPathContainer, false);
			pooled.gameObject.SetActive(true);
			return pooled;
		}

		GameObject markerObj = new GameObject("PathTick_Pooled", typeof(RectTransform), typeof(Disc));
		markerObj.transform.SetParent(wispPathContainer, false);
		return markerObj.GetComponent<Disc>();
	}

	private void ReleaseWispTimingTickDisc(Disc disc)
	{
		if (disc == null)
		{
			return;
		}

		DOTween.Kill(disc);
		disc.gameObject.SetActive(false);
		wispTickMarkerDiscPool.Push(disc);
	}

	private void AddWispSegmentVisuals(float greenStart, float greenEnd, float perfectStart)
	{
		float pathWidth = GetRenderedWispPathWidth();
		bool useArcSprite = ShouldUseWispArcSpriteForCurrentPath();
		bool runtimePathWillBeRebuiltByRefresh = currentWispPathRuntimeMode == WispPathRuntimeMode.AdaptiveDot;

		if (!useArcSprite && !runtimePathWillBeRebuiltByRefresh)
		{
			SetWispRuntimeEndpointSeating(0f, 0f);
			RenderWispPathAsShapesPolyline(greenStart, greenEnd, perfectStart);
		}

		if (ShouldRenderWispTimingMarkers() && !useArcSprite && !runtimePathWillBeRebuiltByRefresh)
		{
			AddWispTimingTickMarker(greenStart, pathWidth, greenZoneColor, 9901);
			AddWispTimingTickMarker(perfectStart, pathWidth, GetPerfectZoneColor(), 9902);
			AddWispTimingTickMarker(greenEnd, pathWidth, Color.white, 9903);
		}
	}

	private Color EvaluateWispPathHeatColor(float quality01)
	{
		float q = Mathf.Clamp01(quality01);
		if (q < 0.5f)
		{
			return Color.Lerp(wispPathHeatLowColor, wispPathHeatMidColor, q / 0.5f);
		}

		return Color.Lerp(wispPathHeatMidColor, wispPathHeatHighColor, (q - 0.5f) / 0.5f);
	}

	private void ApplyWispHeatToImageList(List<Image> images, Color color, float alphaFloor)
	{
		if (images == null)
		{
			return;
		}

		for (int i = 0; i < images.Count; i++)
		{
			Image img = images[i];
			if (img == null)
			{
				continue;
			}

			Color target = color;
			target.a = Mathf.Max(alphaFloor, target.a);
			img.color = Color.Lerp(img.color, target, Mathf.Clamp(wispPathHeatLerp, 0.05f, 0.65f));
		}
	}

	private void ApplyWispHeatToPolyline(Color color, float alphaFloor)
	{
		if (wispPathPolyline == null || wispPathPolyline.points == null || wispPathPolyline.points.Count <= 0)
		{
			return;
		}

		float tintLerp = Mathf.Clamp(wispPathHeatLerp * 0.7f, 0.04f, 0.38f);
		List<PolylinePoint> pts = wispPathPolyline.points;
		for (int i = 0; i < pts.Count; i++)
		{
			Color baseColor = i < wispPathBaseColors.Count ? wispPathBaseColors[i] : pts[i].color;
			Color target = Color.Lerp(baseColor, color, tintLerp);
			target.a = Mathf.Max(alphaFloor, baseColor.a);
			if (i < wispPathEndpointFadeMask.Count)
			{
				target.a = Mathf.Min(target.a, wispPathEndpointFadeMask[i]);
			}

			PolylinePoint p = pts[i];
			p.color = target;
			pts[i] = p;
		}

		wispPathPolyline.meshOutOfDate = true;
		RefreshWispPathEndpointCaps();
	}

	private void RestoreWispPolylineBaseColors()
	{
		if (wispPathPolyline == null || wispPathPolyline.points == null || wispPathPolyline.points.Count <= 0)
		{
			return;
		}

		List<PolylinePoint> pts = wispPathPolyline.points;
		int count = Mathf.Min(pts.Count, wispPathBaseColors.Count);
		if (count <= 0)
		{
			return;
		}

		for (int i = 0; i < count; i++)
		{
			PolylinePoint p = pts[i];
			p.color = wispPathBaseColors[i];
			pts[i] = p;
		}

		wispPathPolyline.meshOutOfDate = true;
		RefreshWispPathEndpointCaps();
	}

	private void UpdateWispPolylineMovingTargetAccent()
	{
		if (!ShouldApplyWispMovingTargetPathAccent() || wispPathPolyline == null || wispPathPolyline.points == null)
		{
			if (IsWispPathGradientOnlyModeEnabled())
			{
				RestoreWispPolylineBaseColors();
			}
			return;
		}

		List<PolylinePoint> pts = wispPathPolyline.points;
		int count = pts.Count;
		if (count < 2 || wispPathBaseColors.Count <= 0)
		{
			return;
		}

		float center01 = Mathf.Clamp01(wispProgress);
		float width01 = Mathf.Clamp(wispPathMovingTargetAccentWidth, 0.02f, 0.4f);
		float followLerp = Mathf.Clamp(wispPathMovingTargetAccentFollowLerp, 0.05f, 1f);
		float strength = Mathf.Clamp01(wispPathMovingTargetAccentStrength);
		if (strength <= 0.001f)
		{
			return;
		}

		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;
		float focus = 0f;
		if (wispProgress < greenStart)
		{
			focus = 0f;
		}
		else if (wispProgress >= perfectStart)
		{
			float zoneT = Mathf.InverseLerp(perfectStart, Mathf.Max(perfectStart + 0.0001f, greenEnd), wispProgress);
			focus = Mathf.SmoothStep(0.8f, 1f, zoneT);
		}
		else
		{
			float zoneT = Mathf.InverseLerp(greenStart, Mathf.Max(greenStart + 0.0001f, perfectStart), wispProgress);
			focus = Mathf.SmoothStep(0f, 0.8f, zoneT);
		}

		float shimmerHz = Mathf.Max(0f, wispPathMovingTargetAccentPulseHz);
		float shimmerBase = shimmerHz > 0.001f
			? (0.78f + (0.22f * (0.5f + (0.5f * Mathf.Sin(Time.unscaledTime * shimmerHz * Mathf.PI * 2f)))))
			: 1f;
		float dynamicStrength = Mathf.Clamp01(strength * Mathf.Lerp(0.72f, 1.2f, Mathf.Clamp01(focus)) * shimmerBase);

		Color cue = GetCurrentWispTargetCueColor();
		Color indicator = GetWispIndicatorColor();
		Color headTint = Color.Lerp(cue, indicator, Mathf.Clamp01(wispPathMovingTargetAccentIndicatorBlend));
		headTint = Color.Lerp(headTint, cue, 0.15f);
		headTint.a = 1f;

		Color heat = ShouldApplyWispPathHeatFeedback() ? EvaluateWispPathHeatColor(wispGuidanceHeat01) : Color.clear;
		float heatTintLerp = Mathf.Clamp(wispPathHeatLerp * 0.7f, 0.04f, 0.38f);
		float alphaFloor = GetWispBehindPathAlphaFloor();
		float greenAlphaFloor = GetWispBehindZoneAlphaFloor(perfectZone: false);

		for (int i = 0; i < count; i++)
		{
			float t = i / (float)(count - 1);
			float dist = Mathf.Abs(t - center01);
			float falloff = 1f - Mathf.Clamp01(dist / Mathf.Max(0.01f, width01));
			if (falloff > 0f)
			{
				falloff = falloff * falloff * (3f - (2f * falloff));
			}

			Color baseColor = i < wispPathBaseColors.Count ? wispPathBaseColors[i] : pts[i].color;
			Color baseline = ShouldApplyWispPathHeatFeedback() ? Color.Lerp(baseColor, heat, heatTintLerp) : baseColor;
			float floor = (t >= greenStart && t <= greenEnd) ? Mathf.Max(alphaFloor, greenAlphaFloor) : alphaFloor;
			baseline.a = Mathf.Max(baseline.a, floor);

			float localWave = shimmerHz > 0.001f
				? (0.88f + (0.12f * (0.5f + (0.5f * Mathf.Sin((Time.unscaledTime * shimmerHz * Mathf.PI * 2f) + (t * 9.5f))))))
				: 1f;
			float localStrength = Mathf.Clamp01(dynamicStrength * falloff * localWave);
			Color target = Color.Lerp(baseline, headTint, localStrength);
			target.a = Mathf.Max(baseline.a, Mathf.Lerp(baseline.a, 0.98f, localStrength));
			if (i < wispPathEndpointFadeMask.Count)
			{
				target.a = Mathf.Min(target.a, wispPathEndpointFadeMask[i]);
			}

			PolylinePoint p = pts[i];
			p.color = Color.Lerp(p.color, target, followLerp);
			pts[i] = p;
		}

		wispPathPolyline.meshOutOfDate = true;
		RefreshWispPathEndpointCaps();
	}

	private void ResetWispPathHeatVisuals(float quality01 = 0.92f)
	{
		wispGuidanceHeat01 = Mathf.Clamp01(quality01);
		if (!ShouldApplyWispPathHeatFeedback())
		{
			if (IsWispPathGradientOnlyModeEnabled())
			{
				RestoreWispPolylineBaseColors();
			}
			return;
		}

		Color heat = EvaluateWispPathHeatColor(wispGuidanceHeat01);
		float pathAlphaFloor = GetWispBehindPathAlphaFloor();
		float greenAlphaFloor = GetWispBehindZoneAlphaFloor(perfectZone: false);
		ApplyWispHeatToImageList(wispPathImages, heat, pathAlphaFloor);
		ApplyWispHeatToPolyline(heat, Mathf.Max(pathAlphaFloor, greenAlphaFloor));
	}

	private void UpdateWispPathHeatFromAccuracy(float quality01)
	{
		if (!ShouldApplyWispPathHeatFeedback())
		{
			if (IsWispPathGradientOnlyModeEnabled())
			{
				RestoreWispPolylineBaseColors();
			}
			return;
		}

		float target = Mathf.Clamp01(quality01);
		wispGuidanceHeat01 = Mathf.Lerp(wispGuidanceHeat01, target, Mathf.Clamp(wispPathHeatLerp, 0.05f, 0.65f));
		Color heat = EvaluateWispPathHeatColor(wispGuidanceHeat01);

		float pathAlphaFloor = GetWispBehindPathAlphaFloor();
		float greenAlphaFloor = GetWispBehindZoneAlphaFloor(perfectZone: false);
		ApplyWispHeatToImageList(wispPathImages, heat, pathAlphaFloor);
		ApplyWispHeatToPolyline(heat, Mathf.Max(pathAlphaFloor, greenAlphaFloor));
	}

	private bool ShowWispPath(Vector2 startPos, Vector2 endPos, WispPathStyle styleOverride, bool animateSpawnVisuals = true)
	{
		return ShowWispPathInternal(startPos, endPos, animateSpawnVisuals, useStyleOverride: true, styleOverride);
	}

	private bool ShowWispPath(Vector2 startPos, Vector2 endPos, bool animateSpawnVisuals = true)
	{
		return ShowWispPathInternal(startPos, endPos, animateSpawnVisuals, useStyleOverride: false, WispPathStyle.ArcUp);
	}

	private bool ShowWispPathInternal(
		Vector2 startPos,
		Vector2 endPos,
		bool animateSpawnVisuals,
		bool useStyleOverride,
		WispPathStyle styleOverride)
	{
		ClearWispPathVisuals();
		EnsureWispContainerOrder();
		EnsureWispIndicatorVisual();

		if (wispRect != null)
		{
			float size = GetRenderedWispIndicatorSize();
			wispRect.sizeDelta = new Vector2(size, size);
			if (wispIndicatorDisc != null)
			{
				wispIndicatorDisc.Radius = Mathf.Max(1f, size * 0.5f);
			}
		}

		BuildRuntimeWispPath(startPos, endPos, useStyleOverride, styleOverride);
		if (currentWispPath.Count < 2)
		{
			ClearWispPathVisuals();
			return false;
		}
		CaptureResolvedWispPathState();

		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		AddWispSegmentVisuals(greenStart, greenEnd, perfectStart);
		RefreshWispArcSprites(startPos, endPos);
		if (currentWispPath.Count < 2)
		{
			ClearWispPathVisuals();
			return false;
		}
		CaptureResolvedWispPathState();
		ResetWispPathHeatVisuals();
		if (animateSpawnVisuals)
		{
			AnimateWispPathSpawnVisuals();
		}

		if (wispFollowRing != null && wispFollowRingRect != null)
		{
			wispFollowRingRect.SetAsLastSibling();
		}

		Transform indicatorTransform = GetWispIndicatorTransform();
		if (indicatorTransform != null)
		{
			indicatorTransform.SetAsLastSibling();
		}

		return true;
	}

	private void ClearWispPathVisuals()
	{
		HideWispTargetApproachRingImmediate();

		if (wispPathPolyline != null)
		{
			DOTween.Kill(wispPathPolyline);
		}

		ClearWispPathPolylineVisuals();
		for (int i = 0; i < wispTickMarkerDiscs.Count; i++)
		{
			Disc disc = wispTickMarkerDiscs[i];
			if (disc == null)
			{
				continue;
			}

			ReleaseWispTimingTickDisc(disc);
		}
		wispTickMarkerDiscs.Clear();

		foreach (Image img in wispPathImages)
		{
			if (img != null)
			{
				if (!img.gameObject.activeSelf)
				{
					continue;
				}

				img.DOKill();
				img.rectTransform.DOKill();
				Destroy(img.gameObject);
			}
		}
		wispPathImages.Clear();

		if (wispArcFrameRect != null)
		{
			if (wispArcFrameRect.gameObject.activeSelf)
			{
				DOTween.Kill(wispArcFrameRect);
				wispArcFrameRect.DOKill();
			}

			Destroy(wispArcFrameRect.gameObject);
		}
		wispArcFrameRect = null;
		wispArcLeftArm = null;

		currentWispPath.Clear();
		currentWispPathUnitBucket = WispPathUnitBucket.None;
		currentWispPathUnitFlipX = false;
		currentWispPathUnitFlipY = false;
		currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
		currentWispPathResolvedUnitPitch = 0f;
		currentWispPathResolvedUnitDistance = 0f;
		wispGuidanceHeat01 = 1f;
		wispBeatEventPulseCounter = 0;
		InvalidateWispBubbleAvoidZoneCache();
		wispPathBaseColors.Clear();
		wispPathAccentBaseColors.Clear();
		wispPathAccentPeakColors.Clear();
	}

	private void SetWispPathVisible(bool visible)
	{
		bool showPathBody = visible && ShouldShowJourneyPathBodyWhileActive();

		if (wispPathContainer != null)
		{
			wispPathContainer.gameObject.SetActive(visible);
		}

		if (wispFrontVisualContainer != null)
		{
			wispFrontVisualContainer.gameObject.SetActive(visible);
		}

		SetWispIndicatorVisible(visible);

		if (wispFollowRing != null)
		{
			wispFollowRing.gameObject.SetActive(visible && showWispFollowRing);
		}

		if (wispTargetApproachRingDisc != null)
		{
			bool showApproachRing = visible && wispTargetApproachRingEnabled && wispTargetApproachRingDisc.Color.a > 0.001f;
			wispTargetApproachRingDisc.gameObject.SetActive(showApproachRing);
		}

		if (wispPathPolyline != null)
		{
			bool showPolyline = showPathBody && wispPathPolyline.points.Count >= 2;
			wispPathPolyline.gameObject.SetActive(showPolyline);
		}

		if (wispPathUnderlayPolyline != null)
		{
			bool showUnderlay = showPathBody && wispPathUnderlayPolyline.points.Count >= 2;
			wispPathUnderlayPolyline.gameObject.SetActive(showUnderlay);
		}

		bool showCaps = showPathBody &&
			wispShapesPolylineRoundJoins &&
			!wispRenderBehindEquationBubbles &&
			wispPathPolyline != null &&
			wispPathPolyline.points != null &&
			wispPathPolyline.points.Count >= 2;
		if (wispPathStartCapDisc != null)
		{
			wispPathStartCapDisc.gameObject.SetActive(showCaps);
		}

		if (wispPathEndCapDisc != null)
		{
			wispPathEndCapDisc.gameObject.SetActive(showCaps);
		}

		OnWispPathVisibilityChangedForDragOriginGhost(visible);
	}
}
