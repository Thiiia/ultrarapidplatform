using System;
using System.Collections;
using System.Collections.Generic;
using ChartLoader.NET.Framework;
using DG.Tweening;
using Shapes;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private readonly List<Color> wispPathAccentBaseColors = new List<Color>(256);
	private readonly List<Color> wispPathAccentPeakColors = new List<Color>(256);

	private void StartWispAnimation()
	{
		if (wispCoroutine != null)
		{
			StopCoroutine(wispCoroutine);
		}

		wispProgress = 0f;
		beatCount = -1;
		wispBeatEventPulseCounter = 0;
		ResetWispTargetApproachRingPulseState();
		ResetWispMovingTargetInteractionPulseState();
		algebraTargetImpactFxPreviewQueuedThisWindow = false;
		if (wispRuntimeTravelSteps <= 0)
		{
			wispRuntimeTravelSteps = Mathf.Clamp(Mathf.RoundToInt(wispSpeed), 1, 12);
		}

		InvalidateWispBubbleAvoidZoneCache();
		wispActive = true;
		lastWispBeatTime = Time.unscaledTime;
		EnsureWispIndicatorVisual();
		ResetWispPathHeatVisuals(0.92f);

		if (wispRect != null && currentWispPath.Count > 0)
		{
			if (wispIndicator != null)
			{
				wispIndicator.DOKill();
			}

			if (wispIndicatorDisc != null)
			{
				DOTween.Kill(wispIndicatorDisc);
			}

			SetWispIndicatorVisible(true);
			wispRect.anchoredPosition = currentWispPath[0];
			wispRect.localScale = Vector3.one;
			SetWispIndicatorColor(wispColor);
			UpdateWispMovingTargetZoneVisual();
			PlayWispSpawnReveal();
		}

		if (wispFollowRing != null && showWispFollowRing)
		{
			wispFollowRing.gameObject.SetActive(true);
			UpdateFollowRing();
		}

		UpdateWispTargetApproachRing();

		if (wispTargetApproachRingPulseOnSpawn)
		{
			PulseWispTargetApproachRing(wispTargetApproachRingSeconds);
		}

		if (algebraTargetImpactFxEnable && algebraTargetImpactFxPreviewOnSpawn && !algebraTargetImpactFxPreviewQueuedThisWindow)
		{
			TryPlayAlgebraTargetImpactFxPreview(Mathf.Max(0f, wispTargetApproachRingSeconds * 0.35f));
			algebraTargetImpactFxPreviewQueuedThisWindow = true;
		}

		wispCoroutine = StartCoroutine(AnimateWisp());
	}

	private void PlayWispSpawnReveal()
	{
		if (wispRect == null)
		{
			return;
		}

		wispRect.DOKill();
		wispRect.localScale = Vector3.one * 0.92f;
		wispRect.DOScale(1f, 0.12f).SetEase(Ease.OutCubic).SetUpdate(true);

		if (wispIndicatorDisc != null && !wispIndicatorUsesPrefabMovingTarget)
		{
			DOTween.Kill(wispIndicatorDisc);
			Color target = wispIndicatorDisc.Color;
			Color from = target;
			from.a = 0f;
			wispIndicatorDisc.Color = from;
			DOTween.To(() => from, v =>
			{
				from = v;
				if (wispIndicatorDisc != null)
				{
					wispIndicatorDisc.Color = v;
				}
			}, target, 0.1f).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(wispIndicatorDisc);
		}
		else if (wispIndicatorUsesPrefabMovingTarget && wispIndicator != null)
		{
			wispIndicator.DOKill();
			Color target = wispIndicator.color;
			Color from = target;
			from.a = 0f;
			wispIndicator.color = from;
			wispIndicator.DOColor(target, 0.1f).SetEase(Ease.OutQuad).SetUpdate(true);

			if (wispIndicatorGlass != null)
			{
				float targetOpacity = wispIndicatorGlass.foregroundOpacity;
				wispIndicatorGlass.foregroundOpacity = 0f;
				DOTween.To(() => wispIndicatorGlass != null ? wispIndicatorGlass.foregroundOpacity : 0f, v =>
				{
					if (wispIndicatorGlass != null)
					{
						wispIndicatorGlass.foregroundOpacity = v;
					}
				}, targetOpacity, 0.12f).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(wispIndicatorGlass);
			}
		}

		if (wispIndicatorOutlineDisc != null)
		{
			RectTransform outlineRect = wispIndicatorOutlineDisc.GetComponent<RectTransform>();
			if (outlineRect != null)
			{
				outlineRect.DOKill();
				outlineRect.localScale = Vector3.one * 1.08f;
				outlineRect.DOScale(1f, 0.14f).SetEase(Ease.OutQuad).SetUpdate(true);
			}
		}
	}

	private void PulseWispPathBeatAccent(float duration, float punch)
	{
		if (wispPathPolyline == null || !wispPathPolyline.gameObject.activeInHierarchy)
		{
			return;
		}

		DOTween.Kill(wispPathPolyline);
		float baseThickness = Mathf.Max(1f, GetRenderedWispPathWidth());
		float peakThickness = baseThickness * (1f + Mathf.Clamp(punch * 0.35f, 0.015f, 0.12f));
		wispPathPolyline.Thickness = baseThickness;
		float rise = Mathf.Max(0.02f, duration * 0.45f);
		float fall = Mathf.Max(0.03f, duration * 0.55f);

		DOTween.To(() => baseThickness, v =>
		{
			baseThickness = v;
			if (wispPathPolyline != null)
			{
				wispPathPolyline.Thickness = v;
				RefreshWispPathEndpointCaps();
			}
		}, peakThickness, rise).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(wispPathPolyline).OnComplete(() =>
		{
			if (wispPathPolyline == null)
			{
				return;
			}

			float from = wispPathPolyline.Thickness;
			float target = Mathf.Max(1f, GetRenderedWispPathWidth());
			DOTween.To(() => from, v =>
			{
				from = v;
				if (wispPathPolyline != null)
				{
					wispPathPolyline.Thickness = v;
					RefreshWispPathEndpointCaps();
				}
			}, target, fall).SetEase(Ease.InOutSine).SetUpdate(true).SetTarget(wispPathPolyline);
		});
	}

	private void PulseWispPathTravelAccent(float center01, float duration, float punch)
	{
		if (wispPathPolyline == null || !wispPathPolyline.gameObject.activeInHierarchy)
		{
			return;
		}

		List<PolylinePoint> pts = wispPathPolyline.points;
		int count = pts != null ? pts.Count : 0;
		if (count < 2)
		{
			return;
		}

		wispPathAccentBaseColors.Clear();
		wispPathAccentPeakColors.Clear();

		float clampedCenter = Mathf.Clamp01(center01);
		float accentWidth = Mathf.Lerp(0.07f, 0.19f, Mathf.Clamp01(wispBeatSnapPulseScale * 3.4f));
		float strength = Mathf.Clamp(0.11f + (Mathf.Clamp01(punch) * 0.9f), 0.1f, 0.3f);
		Color accentTint = Color.Lerp(
			GetCurrentWispTargetCueColor(),
			GetWispIndicatorColor(),
			Mathf.Clamp01(wispPathMovingTargetAccentIndicatorBlend * 0.75f));
		accentTint = Color.Lerp(accentTint, Color.white, 0.14f);
		accentTint.a = 1f;

		for (int i = 0; i < count; i++)
		{
			PolylinePoint p = pts[i];
			Color baseColor = p.color;
			float t = i / (float)(count - 1);
			float dist = Mathf.Abs(t - clampedCenter);
			float falloff = 1f - Mathf.Clamp01(dist / Mathf.Max(0.01f, accentWidth));
			falloff = falloff * falloff * (3f - (2f * falloff));

			Color peak = Color.Lerp(baseColor, accentTint, falloff * strength);
			peak.a = Mathf.Clamp01(Mathf.Lerp(baseColor.a, Mathf.Max(baseColor.a, 0.98f), falloff * Mathf.Clamp01(strength * 1.45f)));

			wispPathAccentBaseColors.Add(baseColor);
			wispPathAccentPeakColors.Add(peak);
			p.color = peak;
			pts[i] = p;
		}

		wispPathPolyline.meshOutOfDate = true;
		RefreshWispPathEndpointCaps();

		float blend = 0f;
		float fade = Mathf.Max(0.07f, duration * 1.45f);
		DOTween.To(() => blend, v =>
		{
			blend = v;
			if (wispPathPolyline == null || wispPathPolyline.points == null)
			{
				return;
			}

			List<PolylinePoint> points = wispPathPolyline.points;
			int n = Mathf.Min(points.Count, Mathf.Min(wispPathAccentBaseColors.Count, wispPathAccentPeakColors.Count));
			for (int i = 0; i < n; i++)
			{
				PolylinePoint p = points[i];
				p.color = Color.Lerp(wispPathAccentPeakColors[i], wispPathAccentBaseColors[i], blend);
				points[i] = p;
			}

			wispPathPolyline.meshOutOfDate = true;
			RefreshWispPathEndpointCaps();
		}, 1f, fade).SetEase(Ease.OutSine).SetUpdate(true).SetTarget(wispPathPolyline);
	}

	private void PulseWispGreenZoneBeatAccent(float duration)
	{
		float flashDuration = Mathf.Max(0.05f, duration);
		Color pulseTint = Color.Lerp(greenZoneColor, wispGoodZonePulseColor, 0.7f);
		float pulseStrength = Mathf.Clamp01(wispGoodZonePulseTintStrength);

		for (int i = 0; i < wispTickMarkerDiscs.Count; i++)
		{
			Disc disc = wispTickMarkerDiscs[i];
			if (disc == null)
			{
				continue;
			}

			DOTween.Kill(disc);
			Color from = disc.Color;
			Color to = Color.Lerp(from, pulseTint, 0.38f * pulseStrength);
			to.a = Mathf.Clamp01(Mathf.Max(from.a + 0.22f, 0.3f));
			DOTween.To(() => from, v =>
			{
				from = v;
				if (disc != null)
				{
					disc.Color = v;
				}
			}, to, flashDuration * 0.5f).SetEase(Ease.OutSine).SetLoops(2, LoopType.Yoyo).SetUpdate(true).SetTarget(disc);
		}
	}

	private void RunWispBeatAccent(int pulseIndex, float duration, float punch, bool pulseIndicator)
	{
		float clampedDuration = Mathf.Max(0.02f, duration);
		float clampedPunch = Mathf.Clamp(punch, 0f, 0.26f);
		lastWispBeatTime = Time.unscaledTime;

		if (pulseIndicator && wispRect != null)
		{
			wispRect.DOKill();
			wispRect.localScale = Vector3.one;
			wispRect.DOPunchScale(new Vector3(clampedPunch * 0.7f, clampedPunch * 0.7f, 0f), clampedDuration, 8, 0.75f).SetUpdate(true);
		}

		if (pulseIndicator && wispIndicatorUsesPrefabMovingTarget && wispIndicatorOutlineDisc != null)
		{
			RectTransform outlineRect = wispIndicatorOutlineDisc.GetComponent<RectTransform>();
			if (outlineRect != null)
			{
				outlineRect.DOKill();
				outlineRect.localScale = Vector3.one;
				float pulse = Mathf.Clamp(wispMovingTargetOutlinePulseScale, 1f, 1.4f);
				outlineRect.DOScale(pulse, clampedDuration * 0.45f)
					.SetEase(Ease.OutSine)
					.SetLoops(2, LoopType.Yoyo)
					.SetUpdate(true);
			}
		}

		if (wispFollowRingRect != null && showWispFollowRing)
		{
			wispFollowRingRect.DOKill();
			wispFollowRingRect.localScale = Vector3.one;
			wispFollowRingRect.DOPunchScale(new Vector3(clampedPunch * 0.4f, clampedPunch * 0.4f, 0f), clampedDuration, 6, 0.75f).SetUpdate(true);
		}

		if (wispTargetApproachRingPulseOnBeat)
		{
			float ringDur = Mathf.Max(0.05f, Mathf.Lerp(wispTargetApproachRingSeconds * 0.85f, wispTargetApproachRingSeconds * 1.2f, Mathf.Clamp01(clampedPunch * 3f)));
			PulseWispTargetApproachRing(ringDur, 1f + (clampedPunch * 0.8f), alphaMultiplier: 1f);
		}

		PulseWispSourceDigitApproachRing(clampedDuration, clampedPunch);

		if (algebraTargetImpactFxEnable && algebraTargetImpactFxPreviewOnBeat)
		{
			TryPlayAlgebraTargetImpactFxPreview(Mathf.Max(0f, clampedDuration * 0.25f));
		}

		int count = Mathf.Max(1, wispRuntimeTravelSteps > 0 ? wispRuntimeTravelSteps : Mathf.RoundToInt(wispSpeed));
		int wrapped = Mathf.Max(0, pulseIndex - 1) % count;
		float center01 = count <= 1 ? Mathf.Clamp01(wispProgress) : ((wrapped + 0.5f) / count);

		if (ShouldApplyWispPathBeatAccents())
		{
			PulseWispPathBeatAccent(clampedDuration, clampedPunch);
			PulseWispPathTravelAccent(center01, clampedDuration, clampedPunch);
			PulseWispGreenZoneBeatAccent(clampedDuration);
		}
	}

	private void TryPulseWispBeatSnap()
	{
		if (!wispBeatSnapPulseEnabled || !wispActive || IsWispPathGradientOnlyModeEnabled())
		{
			return;
		}

		int divisions = Mathf.Max(1, wispRuntimeTravelSteps > 0 ? wispRuntimeTravelSteps : Mathf.RoundToInt(wispSpeed));
		int pulseIndex = Mathf.Clamp(Mathf.FloorToInt(wispProgress * divisions), 0, divisions);
		if (pulseIndex <= beatCount)
		{
			return;
		}

		beatCount = pulseIndex;
		float dur = Mathf.Max(0.02f, wispBeatSnapPulseSeconds);
		float punch = GetAdaptiveWispBeatPulseScale(wispBeatSnapPulseScale);
		RunWispBeatAccent(pulseIndex, dur, punch, pulseIndicator: true);
	}

	private IEnumerator AnimateWisp()
	{
		bool holdSpawnCenterFrame = true;
		while (wispActive && wispProgress < 1f)
		{
			if (holdSpawnCenterFrame)
			{
				holdSpawnCenterFrame = false;
				UpdateWispPosition();
				TryPulseWispBeatSnap();
				ApplyWispBubbleOcclusionVisuals();
				yield return null;
				continue;
			}

			if (wispTimingPrepared)
			{
				double now = NowSongTime();
				double denom = Math.Max(0.0001d, wispEndSongTime - wispStartSongTime);
				float targetProgress = Mathf.Clamp01((float)((now - wispStartSongTime) / denom));
				wispProgress = Mathf.Max(wispProgress, targetProgress);
			}
			else
			{
				float totalBeats = Mathf.Max(1f, wispRuntimeTravelSteps > 0 ? wispRuntimeTravelSteps : wispSpeed);
				float deltaProgress = Time.deltaTime / (totalBeats * 0.5f);
				wispProgress = Mathf.Clamp01(wispProgress + deltaProgress);
			}

			UpdateWispPosition();
			TryPulseWispBeatSnap();

			float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
			float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
			float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

			if (wispProgress >= greenStart)
			{
				float pulseScale = 1f + (Mathf.Sin(Time.time * 10f) * 0.1f);
				wispRect.localScale = Vector3.one * pulseScale;

				if (wispProgress >= perfectStart)
				{
					float perfectProgress = (wispProgress - perfectStart) / Mathf.Max(0.001f, greenEnd - perfectStart);
					SetWispIndicatorColor(Color.Lerp(wispColor, Color.green, perfectProgress));
				}
			}

			ApplyWispBubbleOcclusionVisuals();
			yield return null;
		}

		if (wispActive)
		{
			OnWispReachedEnd();
		}
	}

	private void SpawnWispOutcomeTrail(Vector2 worldPos, HitResult hitResult)
	{
		if (!wispOutcomeTrailEnabled || wispPathContainer == null)
		{
			return;
		}

		Color c = hitResult switch
		{
			HitResult.Perfect => wispOverlapPerfectColor,
			HitResult.Good => wispOverlapGoodColor,
			_ => wispOverlapLateColor,
		};
		c.a = 0.88f;

		float size = Mathf.Max(10f, GetRenderedWispPathWidth() * 1.05f);
		GameObject pulseObj = new GameObject("WispOutcomeTrail", typeof(RectTransform), typeof(Disc));
		pulseObj.transform.SetParent(wispPathContainer, false);
		RectTransform rt = pulseObj.GetComponent<RectTransform>();
		rt.anchorMin = new Vector2(0.5f, 0.5f);
		rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.pivot = new Vector2(0.5f, 0.5f);
		rt.anchoredPosition = worldPos;
		rt.sizeDelta = new Vector2(size, size);

		Disc disc = pulseObj.GetComponent<Disc>();
		disc.Type = DiscType.Disc;
		disc.RadiusSpace = ThicknessSpace.Meters;
		disc.Radius = Mathf.Max(1f, size * 0.5f);
		disc.ZTest = CompareFunction.Always;
		disc.Color = c;
		SyncWispTickMarkerDiscSorting(disc);

		float dur = Mathf.Max(0.05f, wispOutcomeTrailSeconds);
		float scale = Mathf.Max(1f, wispOutcomeTrailScale);
		float startRadius = disc.Radius;
		float endRadius = startRadius * scale;
		Color startColor = c;
		Color endColor = c;
		endColor.a = 0f;

		DOTween.To(() => startRadius, v =>
		{
			startRadius = v;
			if (disc != null)
			{
				disc.Radius = v;
			}
		}, endRadius, dur).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(disc);

		DOTween.To(() => startColor, v =>
		{
			startColor = v;
			if (disc != null)
			{
				disc.Color = v;
			}
		}, endColor, dur).SetEase(Ease.InQuad).SetUpdate(true).SetTarget(disc).OnComplete(() =>
		{
			if (pulseObj != null)
			{
				Destroy(pulseObj);
			}
		});
	}

	private void UpdateWispPosition()
	{
		if (currentWispPath.Count < 2 || wispRect == null)
		{
			return;
		}

		Vector2 pos = GetPointOnCurrentWispPath(wispProgress, out _);
		EquationBubbleElement dest = GetActiveWispDestinationElement();
		if (dest != null)
		{
			float snapStart = 0.9f;
			float snapT = Mathf.InverseLerp(snapStart, 1f, Mathf.Clamp01(wispProgress));
			if (snapT > 0f)
			{
				snapT = snapT * snapT * (3f - (2f * snapT));
				Vector2 snapTarget = dest.OriginalPosition;
				bool snapToRuntimeEndpoint = wispDotSprite != null || ShouldForceCanonicalPathForPlaceholderArcSprites();
				if (snapToRuntimeEndpoint && currentWispPath != null && currentWispPath.Count > 0)
				{
					snapTarget = currentWispPath[currentWispPath.Count - 1];
				}

				float snapStrength = snapToRuntimeEndpoint ? 1f : 0.85f;
				pos = Vector2.Lerp(pos, snapTarget, snapT * snapStrength);
			}
		}

		wispRect.anchoredPosition = pos;
		UpdateFollowRing();
		UpdateWispTargetApproachRing();
		UpdateWispMovingTargetZoneVisual();
		UpdateWispPolylineMovingTargetAccent();
	}

	private float EvaluateWispMovingTargetFocus01(float progress01)
	{
		float progress = Mathf.Clamp01(progress01);
		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		if (progress < greenStart)
		{
			return 0f;
		}

		if (progress >= perfectStart)
		{
			float zoneT = Mathf.InverseLerp(perfectStart, Mathf.Max(perfectStart + 0.0001f, greenEnd), progress);
			return Mathf.SmoothStep(0.85f, 1f, zoneT);
		}

		float prePerfectT = Mathf.InverseLerp(greenStart, Mathf.Max(greenStart + 0.0001f, perfectStart), progress);
		return Mathf.SmoothStep(0f, 0.85f, prePerfectT);
	}

	private float GetWispMovingTargetBodyAlpha(float focus01)
	{
		float focus = Mathf.Clamp01(focus01);
		float idle = Mathf.Clamp01(wispMovingTargetBodyIdleAlpha);
		float peak = Mathf.Clamp01(Mathf.Max(idle, wispMovingTargetBodyFocusAlpha));
		return Mathf.Lerp(idle, peak, focus);
	}

	private float GetWispMovingTargetGlassOpacity(float focus01)
	{
		float focus = Mathf.Clamp01(focus01);
		float targetGlassOpacity = Mathf.Lerp(wispMovingTargetGlassIdleOpacity, wispMovingTargetGlassFocusOpacity, focus);
		float pulse01 = 0.5f + (0.5f * Mathf.Sin(Time.unscaledTime * 6.4f));
		targetGlassOpacity = Mathf.Clamp01(targetGlassOpacity + (pulse01 * 0.08f * focus));
		return targetGlassOpacity;
	}

	private Color GetWispMovingTargetZoneColorForProgress(float progress01)
	{
		float progress = Mathf.Clamp01(progress01);
		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		if (progress >= perfectStart && progress <= greenEnd)
		{
			return wispOverlapPerfectColor;
		}

		if (progress >= greenStart && progress <= greenEnd)
		{
			return wispOverlapGoodColor;
		}

		if (progress < greenStart)
		{
			return wispUseDirectionalPathGradient ? wispPathGradientStartColor : wispOverlapEarlyColor;
		}

		return wispOverlapLateColor;
	}

	private void UpdateWispMovingTargetZoneVisual()
	{
		if (!wispIndicatorUsesPrefabMovingTarget)
		{
			return;
		}

		float focus = EvaluateWispMovingTargetFocus01(wispProgress);
		float targetBodyAlpha = GetWispMovingTargetBodyAlpha(focus);
		if (wispIndicator != null)
		{
			Color current = wispIndicator.color;
			Color target = new Color(bubbleBackgroundColor.r, bubbleBackgroundColor.g, bubbleBackgroundColor.b, targetBodyAlpha);
			wispIndicator.color = Color.Lerp(current, target, 0.32f);
		}

		float targetGlassOpacity = GetWispMovingTargetGlassOpacity(focus);
		if (wispIndicatorGlass != null)
		{
			float current = wispIndicatorGlass.foregroundOpacity;
			wispIndicatorGlass.foregroundOpacity = Mathf.Lerp(current, targetGlassOpacity, 0.32f);
		}

		Color zoneColor = GetWispMovingTargetZoneColorForProgress(wispProgress);
		if (wispIndicatorOutlineDisc != null)
		{
			Color current = wispIndicatorOutlineDisc.Color;
			zoneColor.a = Mathf.Lerp(0.34f, 0.94f, Mathf.Clamp01(focus));
			wispIndicatorOutlineDisc.Color = Color.Lerp(current, zoneColor, 0.32f);
		}
		else if (wispIndicatorOutlineGraphic != null)
		{
			zoneColor.a = Mathf.Lerp(0.3f, 0.82f, Mathf.Clamp01(focus));
			wispIndicatorOutlineGraphic.color = Color.Lerp(wispIndicatorOutlineGraphic.color, zoneColor, 0.32f);
		}
	}

	private void ApplyWispBubbleOcclusionVisuals()
	{
		if (!wispAvoidEquationBubbles || wispRect == null)
		{
			return;
		}

		RefreshWispBubbleAvoidZonesThrottled(GetWispPathWidth(), force: false);
		bool nearBubble = IsPointInsideWispBubbleAvoidZone(wispRect.anchoredPosition);

		if (wispFadeIndicatorNearEquationBubbles)
		{
			Color c = GetWispIndicatorColor();
			float focus = EvaluateWispMovingTargetFocus01(wispProgress);
			float baseAlpha = wispIndicatorUsesPrefabMovingTarget
				? GetWispMovingTargetBodyAlpha(focus)
				: Mathf.Clamp01(wispColor.a);
			float multiplier = nearBubble ? Mathf.Clamp(wispIndicatorBubbleAlphaMultiplier, 0.34f, 1f) : 1f;
			c.a = baseAlpha * multiplier;
			SetWispIndicatorColor(c);

			if (wispIndicatorUsesPrefabMovingTarget && wispIndicatorGlass != null)
			{
				float baseOpacity = GetWispMovingTargetGlassOpacity(focus);
				wispIndicatorGlass.foregroundOpacity = baseOpacity * multiplier;
			}

			if (wispIndicatorUsesPrefabMovingTarget && wispIndicatorOutlineDisc != null)
			{
				Color outline = wispIndicatorOutlineDisc.Color;
				outline.a *= multiplier;
				wispIndicatorOutlineDisc.Color = outline;
			}
			else if (wispIndicatorUsesPrefabMovingTarget && wispIndicatorOutlineGraphic != null)
			{
				Color outline = wispIndicatorOutlineGraphic.color;
				outline.a *= multiplier;
				wispIndicatorOutlineGraphic.color = outline;
			}
		}

		if (wispFollowRing != null)
		{
			Color ring = wispFollowRing.Color;
			float baseAlpha = Mathf.Clamp01(wispFollowRingAlpha);
			float speedResponse = Mathf.Clamp01(wispFollowRingSpeedResponse);
			float dragSpeed01 = currentDraggingElement != null ? Mathf.Clamp01(dragSpeedVisual01) : 0f;
			float speedAlphaBoost = Mathf.Lerp(1f, 1f + (0.28f * speedResponse), dragSpeed01);
			float multiplier = nearBubble ? Mathf.Clamp(wispRingBubbleAlphaMultiplier, 0.3f, 1f) : 1f;
			ring.a = Mathf.Clamp01(baseAlpha * speedAlphaBoost * multiplier);
			wispFollowRing.Color = ring;
		}
	}

	private void TryPulseWispMovingTargetInteraction(WispOverlapZone zone, float proximity)
	{
		if (!wispActive || wispRect == null)
		{
			return;
		}

		float minProximity = Mathf.Clamp01(wispMovingTargetInteractionPulseMinProximity);
		float proximity01 = Mathf.Clamp01(proximity);
		bool enteredPulseRange = wispMovingTargetLastInteractionProximity < minProximity && proximity01 >= minProximity;
		bool zoneChanged = zone != wispMovingTargetLastInteractionZone;
		bool proximityJumped = (proximity01 - wispMovingTargetLastInteractionProximity) >= 0.18f;

		wispMovingTargetLastInteractionZone = zone;
		wispMovingTargetLastInteractionProximity = proximity01;

		if (proximity01 < minProximity)
		{
			return;
		}

		float now = Time.unscaledTime;
		if (!enteredPulseRange && !zoneChanged && !proximityJumped && now < wispMovingTargetInteractionPulseCooldownUntil)
		{
			return;
		}

		wispMovingTargetInteractionPulseCooldownUntil = now + Mathf.Max(0f, wispMovingTargetInteractionPulseCooldown);
		float duration = Mathf.Max(0.04f, wispMovingTargetInteractionPulseSeconds);
		float strength = Mathf.Clamp01(Mathf.InverseLerp(minProximity, 1f, proximity01));

		if (wispIndicatorOutlineDisc != null)
		{
			RectTransform outlineRect = wispIndicatorOutlineDisc.GetComponent<RectTransform>();
			if (outlineRect != null)
			{
				float maxScale = Mathf.Clamp(Mathf.Lerp(1.04f, wispMovingTargetOutlinePulseScale, strength), 1f, 1.4f);
				outlineRect.DOKill();
				outlineRect.localScale = Vector3.one;
				outlineRect.DOScale(maxScale, duration * 0.5f)
					.SetEase(Ease.OutQuad)
					.SetLoops(2, LoopType.Yoyo)
					.SetUpdate(true);
			}
		}
		else if (wispIndicatorOutlineGraphic != null)
		{
			RectTransform outlineRect = wispIndicatorOutlineGraphic.rectTransform;
			if (outlineRect != null)
			{
				float maxScale = Mathf.Clamp(Mathf.Lerp(1.03f, 1.16f, strength), 1f, 1.35f);
				outlineRect.DOKill();
				outlineRect.localScale = Vector3.one;
				outlineRect.DOScale(maxScale, duration * 0.5f)
					.SetEase(Ease.OutQuad)
					.SetLoops(2, LoopType.Yoyo)
					.SetUpdate(true);
			}
		}
		else
		{
			float maxScale = Mathf.Clamp(Mathf.Lerp(1.02f, 1.12f, strength), 1f, 1.25f);
			wispRect.DOKill();
			wispRect.localScale = Vector3.one;
			wispRect.DOScale(maxScale, duration * 0.5f)
				.SetEase(Ease.OutQuad)
				.SetLoops(2, LoopType.Yoyo)
				.SetUpdate(true);
		}

		float ringScale = Mathf.Lerp(1f, 1.12f, strength);
		float ringAlphaMul = Mathf.Lerp(0.92f, 1.1f, strength);
		PulseWispTargetApproachRing(duration, startScaleMultiplier: ringScale, alphaMultiplier: ringAlphaMul);
	}

	private void UpdateFollowRing()
	{
		if (!showWispFollowRing || wispFollowRing == null || wispFollowRingRect == null || wispRect == null)
		{
			return;
		}

		float radius = GetWispFollowRingRadius();
		float speedResponse = Mathf.Clamp01(wispFollowRingSpeedResponse);
		float dragSpeed01 = currentDraggingElement != null ? Mathf.Clamp01(dragSpeedVisual01) : 0f;
		float dragSpeedBoost = Mathf.Lerp(1f, 1f + (0.16f * speedResponse), dragSpeed01);
		radius *= dragSpeedBoost;
		if (wispTimingPrepared)
		{
			float greenStart = wispGreenZoneStartRuntime;
			float greenEnd = wispGreenZoneEndRuntime;
			float perfectStart = wispPerfectZoneStartRuntime;
			if (wispProgress >= greenStart)
			{
				float pulse = 1f + (Mathf.Sin(Time.time * 10f) * (wispFollowRingPulseScale - 1f));
				if (wispProgress >= perfectStart)
				{
					radius *= Mathf.Max(1f, pulse);
				}
			}
		}

		wispFollowRingRect.anchoredPosition = wispRect.anchoredPosition;
		float thicknessPx = wispFollowRingThickness * Mathf.Lerp(1f, 1f + (0.35f * speedResponse), dragSpeed01);
		wispFollowRing.Thickness = Mathf.Max(1f, ToWispShapeUnits(thicknessPx));
		wispFollowRing.Radius = Mathf.Max(1f, ToWispShapeUnits(radius));

		Color baseCol = wispFollowRingColor;
		if (wispFollowRingUseZoneColor)
		{
			float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
			float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
			float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

			if (wispProgress >= perfectStart && wispProgress <= greenEnd)
			{
				baseCol = wispOverlapPerfectColor;
			}
			else if (wispProgress >= greenStart && wispProgress <= greenEnd)
			{
				baseCol = wispOverlapGoodColor;
			}
			else if (wispProgress < greenStart)
			{
				baseCol = wispOverlapEarlyColor;
			}
			else
			{
				baseCol = wispOverlapLateColor;
			}
		}

		float speedAlphaBoost = Mathf.Lerp(1f, 1f + (0.28f * speedResponse), dragSpeed01);
		float finalAlpha = Mathf.Clamp01(wispFollowRingAlpha * speedAlphaBoost);
		wispFollowRing.Color = new Color(baseCol.r, baseCol.g, baseCol.b, finalAlpha);

		if (wispTargetApproachRingRect != null && wispTargetApproachRingDisc != null && wispTargetApproachRingDisc.gameObject.activeSelf)
		{
			wispTargetApproachRingRect.anchoredPosition = wispRect.anchoredPosition;
		}
	}

	private void ResetWispWindowLockState()
	{
		hasLockedWindowEquationPathHemisphere = false;
		lockedWindowEquationPathHemisphere = EquationPathHemisphere.Neutral;
		hasLockedWindowTemplateMode = false;
		lockedWindowTemplateMode = WispUniformTemplateMode.Off;
		hasLockedWindowPathStyle = false;
		ClearLockedWispPathUnitVariant();
		ResetWispWindowState();
		CaptureEquationPlacementStateSnapshot();
	}

	private void OnWispReachedEnd()
	{
		TryEmitAlgebraTimingImpactFxOnMiss(passive: true);

		if (wispRect != null)
		{
			if (wispIndicatorDisc != null && !wispIndicatorUsesPrefabMovingTarget)
			{
				DOTween.Kill(wispIndicatorDisc);
				Color startColor = wispIndicatorDisc.Color;
				startColor.a = Mathf.Clamp01(Mathf.Max(startColor.a, wispColor.a));
				wispIndicatorDisc.Color = startColor;
				Color flash = Color.red;
				flash.a = startColor.a;
				DOTween.To(() => startColor, v =>
				{
					startColor = v;
					if (wispIndicatorDisc != null)
					{
						wispIndicatorDisc.Color = v;
					}
				}, flash, AlgebraMotionPresets.PathFlashSeconds)
					.SetEase(AlgebraMotionPresets.UiEaseOut)
					.SetLoops(3, LoopType.Yoyo)
					.SetUpdate(true)
					.SetTarget(wispIndicatorDisc)
					.OnComplete(() =>
					{
						if (wispIndicatorDisc == null)
						{
							return;
						}

						Color fadeFrom = wispIndicatorDisc.Color;
						Color fadeTo = fadeFrom;
						fadeTo.a = 0f;
						DOTween.To(() => fadeFrom, v =>
						{
							fadeFrom = v;
							if (wispIndicatorDisc != null)
							{
								wispIndicatorDisc.Color = v;
							}
						}, fadeTo, AlgebraMotionPresets.UiSoft)
							.SetEase(AlgebraMotionPresets.UiEaseIn)
							.SetUpdate(true)
							.SetTarget(wispIndicatorDisc);
					});
			}
			else if (wispIndicatorUsesPrefabMovingTarget && wispIndicator != null)
			{
				wispIndicator.DOColor(Color.red, AlgebraMotionPresets.PathFlashSeconds)
					.SetEase(AlgebraMotionPresets.UiEaseOut)
					.SetLoops(3, LoopType.Yoyo)
					.OnComplete(() =>
					{
						if (wispIndicator != null)
						{
							wispIndicator.DOFade(0f, AlgebraMotionPresets.UiSoft)
								.SetEase(AlgebraMotionPresets.UiEaseIn)
								.SetLink(wispIndicator.gameObject, LinkBehaviour.KillOnDestroy);
						}
					});

				if (wispIndicatorOutlineDisc != null)
				{
					DOTween.Kill(wispIndicatorOutlineDisc);
					Color from = wispIndicatorOutlineDisc.Color;
					Color to = Color.red;
					to.a = Mathf.Clamp01(Mathf.Max(from.a, 0.5f));
					DOTween.To(() => from, v =>
					{
						from = v;
						if (wispIndicatorOutlineDisc != null)
						{
							wispIndicatorOutlineDisc.Color = v;
						}
					}, to, AlgebraMotionPresets.PathFlashSeconds)
						.SetEase(AlgebraMotionPresets.UiEaseOut)
						.SetLoops(3, LoopType.Yoyo)
						.SetUpdate(true)
						.SetTarget(wispIndicatorOutlineDisc);
				}
			}
		}

		wispActive = false;
		ResetWispWindowLockState();
		ResetTargetApproachCueState();
		ResetActiveDragCueState();
		if (wispHasTimingContext)
		{
			double now = NowSongTime();
			double grace = Mathf.Max(0f, wispLateHoldGraceSeconds);
			wispLateHoldGraceUntilSongTime = Math.Max(wispExpectedDropSongTime, now) + grace;
		}

		wispTimingPrepared = false;
		wispCoroutine = null;
		ResetWispSongClockFallbackState();

		if (pathwayAppearsWithHitZone && currentDraggingElement == null && !tutorialGuidanceVisualOverride)
		{
			ClearWispPathVisuals();
			SetWispPathVisible(false);
		}

		if (wispFollowRing != null)
		{
			wispFollowRing.gameObject.SetActive(false);
		}

		if (enableJourneyGuidance && journeyLoopWispWhileIdle)
		{
			journeyWispRestartPending = true;
			DOVirtual.DelayedCall(journeyRescheduleDelaySeconds, () =>
			{
				journeyWispRestartPending = false;
				if (!isActive || isBubbleAnimating || !equationAtTop)
				{
					return;
				}

				if (currentDraggingElement != null)
				{
					return;
				}

					if (IsEquationRowCompactionRestoreActive())
					{
						return;
					}

				if (journeySuggestedElement == null || journeySuggestedDropZone == null)
				{
					return;
				}

				BeginIdleJourneyPreviewIfReady();
			}).SetUpdate(true);
		}
	}

	private void StopWispAnimation()
	{
		wispActive = false;
		ResetWispWindowLockState();
		ResetTargetApproachCueState();
		ResetActiveDragCueState();
		wispTimingPrepared = false;
		wispHasTimingContext = false;
		wispLateHoldGraceUntilSongTime = double.NegativeInfinity;
		wispBeatEventPulseCounter = 0;
		ResetWispMovingTargetInteractionPulseState();
		wispRuntimeTravelSteps = Mathf.Clamp(Mathf.RoundToInt(wispSpeed), 1, 12);
		ResetWispSongClockFallbackState();
		InvalidateWispBubbleAvoidZoneCache();

		if (wispCoroutine != null)
		{
			StopCoroutine(wispCoroutine);
			wispCoroutine = null;
		}

		if (wispIndicator != null)
		{
			wispIndicator.DOKill();
		}

		if (wispIndicatorDisc != null)
		{
			DOTween.Kill(wispIndicatorDisc);
		}

		if (wispIndicatorOutlineDisc != null)
		{
			DOTween.Kill(wispIndicatorOutlineDisc);
			RectTransform outlineRect = wispIndicatorOutlineDisc.GetComponent<RectTransform>();
			if (outlineRect != null)
			{
				outlineRect.DOKill();
				outlineRect.localScale = Vector3.one;
			}
		}

		SetWispIndicatorVisible(false);

		if (wispFollowRing != null)
		{
			wispFollowRing.gameObject.SetActive(false);
		}

		HideWispTargetApproachRingImmediate();

		algebraTargetImpactFxPreviewQueuedThisWindow = false;
		if (algebraTargetImpactFxInstance != null)
		{
			algebraTargetImpactFxInstance.ResetToPoolState();
			SetAlgebraTargetImpactFxVisible(false);
		}
	}

	public void HideWispGuidanceVisualsImmediate()
	{
		StopWispAnimation();
		ClearWispPathVisuals();
		SetWispPathVisible(false);
		SetAlgebraTargetImpactFxVisible(false);
	}

	private void PulseWispOnBeat()
	{
		if (!wispActive || IsWispPathGradientOnlyModeEnabled())
		{
			return;
		}

		float now = Time.unscaledTime;
		if ((now - lastWispBeatTime) < 0.045f)
		{
			return;
		}

		wispBeatEventPulseCounter = Mathf.Max(1, wispBeatEventPulseCounter + 1);
		float dur = Mathf.Max(AlgebraMotionPresets.PathPulseSeconds, wispBeatSnapPulseSeconds * 1.05f);
		float punch = GetAdaptiveWispBeatPulseScale(Mathf.Max(0.05f, wispBeatSnapPulseScale * 0.9f));
		RunWispBeatAccent(wispBeatEventPulseCounter, dur, punch, pulseIndicator: true);
	}

}
