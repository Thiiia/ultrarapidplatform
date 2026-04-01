using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

using TMPro;

using DG.Tweening;

using Shapes;
using LeTai.Asset.TranslucentImage;

public partial class DragExecutionController
{
	private void EnsureWispIndicatorVisual()
	{
		if (wispPathContainer == null)
		{
			return;
		}

		float size = GetRenderedWispIndicatorSize();
		if (ShouldUseWispPrefabMovingTargetVisual())
		{
			if (EnsureWispPrefabMovingTargetVisual(size))
			{
				if (wispIndicatorDisc != null)
				{
					wispIndicatorDisc.gameObject.SetActive(false);
				}
				return;
			}
		}

		wispIndicatorUsesPrefabMovingTarget = false;
		wispIndicatorGlass = null;
		wispIndicatorOutlineGraphic = null;
		if (wispIndicatorOutlineDisc != null)
		{
			wispIndicatorOutlineDisc.gameObject.SetActive(false);
		}

		if (wispIndicatorDisc == null)
		{
			GameObject discObj = new GameObject("WispIndicatorDisc", typeof(RectTransform), typeof(Disc));
			discObj.transform.SetParent(wispFrontVisualContainer != null ? wispFrontVisualContainer : wispPathContainer, false);
			wispIndicatorDisc = discObj.GetComponent<Disc>();
		}

		RectTransform rect = wispIndicatorDisc.GetComponent<RectTransform>();
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = new Vector2(size, size);
		wispRect = rect;

		wispIndicatorDisc.Type = DiscType.Disc;
		wispIndicatorDisc.RadiusSpace = ThicknessSpace.Meters;
		wispIndicatorDisc.Radius = Mathf.Max(1f, size * 0.5f);
		wispIndicatorDisc.ZTest = CompareFunction.Always;
		wispIndicatorDisc.Color = wispColor;
		SyncWispIndicatorDiscSorting();
		wispIndicatorDisc.gameObject.SetActive(false);

		if (wispIndicatorDisc != null)
		{
			wispIndicatorDisc.gameObject.SetActive(false);
		}

		if (wispIndicator != null)
		{
			wispIndicator.gameObject.SetActive(false);
		}
	}

	private bool ShouldUseWispPrefabMovingTargetVisual()
	{
		return wispUsePrefabMovingTarget;
	}

	private Disc EnsureWispIndicatorOutlineDisc(RectTransform markerRect, float diameter)
	{
		if (markerRect == null)
		{
			return null;
		}

		Transform existing = markerRect.Find("WispIndicatorOutlineDisc");
		Disc disc;
		RectTransform discRect;
		if (existing == null)
		{
			GameObject outlineObj = new GameObject("WispIndicatorOutlineDisc", typeof(RectTransform), typeof(Disc));
			outlineObj.transform.SetParent(markerRect, false);
			disc = outlineObj.GetComponent<Disc>();
			discRect = outlineObj.GetComponent<RectTransform>();
		}
		else
		{
			disc = existing.GetComponent<Disc>();
			discRect = existing as RectTransform;
			if (disc == null || discRect == null)
			{
				return null;
			}
		}

		discRect.anchorMin = new Vector2(0.5f, 0.5f);
		discRect.anchorMax = new Vector2(0.5f, 0.5f);
		discRect.pivot = new Vector2(0.5f, 0.5f);
		discRect.anchoredPosition = Vector2.zero;
		discRect.sizeDelta = Vector2.zero;
		discRect.localRotation = Quaternion.identity;
		discRect.localScale = Vector3.one;

		float d = Mathf.Max(8f, ToWispShapeUnits(diameter));
		float thickness = Mathf.Max(1f, d * 0.065f);
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		Color outline = Color.Lerp(bubbleOutlineColor, Color.white, 0.16f);
		outline.a = Mathf.Clamp01(Mathf.Max(wispMovingTargetGlassFocusOpacity, 0.2f));

		disc.Type = DiscType.Ring;
		disc.RadiusSpace = ThicknessSpace.Meters;
		disc.ThicknessSpace = ThicknessSpace.Meters;
		disc.Radius = radius;
		disc.Thickness = thickness;
		disc.ZTest = CompareFunction.Always;
		disc.Color = outline;
		return disc;
	}

	private bool EnsureWispPrefabMovingTargetVisual(float size)
	{
		if (wispPathContainer == null)
		{
			return false;
		}

		GameObject sourcePrefab = wispMovingTargetPrefab != null ? wispMovingTargetPrefab : bubbleElementPrefab;
		if (sourcePrefab == null)
		{
			return false;
		}

		if (wispIndicator == null || !wispIndicatorUsesPrefabMovingTarget)
		{
			if (wispIndicator != null && !wispIndicatorUsesPrefabMovingTarget)
			{
				GameObject oldRoot = wispRect != null ? wispRect.gameObject : wispIndicator.gameObject;
				if (oldRoot != null)
				{
					Destroy(oldRoot);
				}
				wispIndicator = null;
				wispRect = null;
			}

			Transform parent = wispFrontVisualContainer != null ? wispFrontVisualContainer : wispPathContainer;
			GameObject indicatorObj = Instantiate(sourcePrefab, parent);
			indicatorObj.name = "WispMovingTarget";
			wispIndicatorUsesPrefabMovingTarget = true;

			EquationBubbleElement bubbleElement = indicatorObj.GetComponent<EquationBubbleElement>();
			if (bubbleElement != null)
			{
				Destroy(bubbleElement);
			}

			RectTransform markerRect = indicatorObj.GetComponent<RectTransform>();
			if (markerRect == null)
			{
				markerRect = indicatorObj.AddComponent<RectTransform>();
			}

			Image rootImage = indicatorObj.GetComponent<Image>();
			if (rootImage == null)
			{
				rootImage = indicatorObj.AddComponent<Image>();
			}
			Graphic rootGraphic = rootImage;

			wispIndicator = rootImage;
			wispRect = markerRect;
			wispIndicatorGlass = rootGraphic as TranslucentImage;
			wispIndicatorOutlineGraphic = null;
			wispIndicatorOutlineDisc = null;

			Graphic[] graphics = indicatorObj.GetComponentsInChildren<Graphic>(true);
			for (int i = 0; i < graphics.Length; i++)
			{
				Graphic g = graphics[i];
				if (g == null)
				{
					continue;
				}

				g.raycastTarget = false;
			}

			TextMeshProUGUI[] texts = indicatorObj.GetComponentsInChildren<TextMeshProUGUI>(true);
			for (int i = 0; i < texts.Length; i++)
			{
				TextMeshProUGUI tmp = texts[i];
				if (tmp == null)
				{
					continue;
				}

				tmp.text = string.Empty;
				tmp.enabled = false;
				if (tmp.gameObject != indicatorObj)
				{
					tmp.gameObject.SetActive(false);
				}
			}

			Transform outlineT = indicatorObj.transform.Find("Outline");
			if (outlineT != null)
			{
				wispIndicatorOutlineGraphic = outlineT.GetComponent<Graphic>();
				if (wispIndicatorOutlineGraphic != null)
				{
					wispIndicatorOutlineGraphic.enabled = false;
				}
			}
		}

		if (wispRect == null || wispIndicator == null)
		{
			return false;
		}

		wispRect.anchorMin = new Vector2(0.5f, 0.5f);
		wispRect.anchorMax = new Vector2(0.5f, 0.5f);
		wispRect.pivot = new Vector2(0.5f, 0.5f);
		wispRect.sizeDelta = new Vector2(size, size);
		wispRect.localScale = Vector3.one;

		float baseFocus = EvaluateWispMovingTargetFocus01(wispProgress);
		float bodyAlpha = GetWispMovingTargetBodyAlpha(baseFocus);
		wispIndicator.color = new Color(bubbleBackgroundColor.r, bubbleBackgroundColor.g, bubbleBackgroundColor.b, bodyAlpha);
		if (wispIndicatorGlass != null)
		{
			EnsureStepPerformanceSource();
			if (wispIndicatorGlass.source == null && cachedStepPerformanceSource != null)
			{
				wispIndicatorGlass.source = cachedStepPerformanceSource;
			}
			wispIndicatorGlass.foregroundOpacity = GetWispMovingTargetGlassOpacity(baseFocus);
		}

		TryConfigureTranslucentCircle(wispRect.gameObject, wispRect);
		wispIndicatorOutlineDisc = EnsureWispIndicatorOutlineDisc(wispRect, size);
		SyncWispIndicatorOutlineDiscSorting();
		wispRect.gameObject.SetActive(false);
		return true;
	}

	private void SyncWispIndicatorDiscSorting()
	{
		if (wispIndicatorDisc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			wispIndicatorDisc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		wispIndicatorDisc.SortingOrder = GetWispShapeSortingBaseOrder() + 3;
	}

	private void SyncWispIndicatorOutlineDiscSorting()
	{
		if (wispIndicatorOutlineDisc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			wispIndicatorOutlineDisc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		wispIndicatorOutlineDisc.SortingOrder = GetWispShapeSortingBaseOrder() + 4;
	}

	private void SyncWispFollowRingSorting()
	{
		if (wispFollowRing == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			wispFollowRing.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		wispFollowRing.SortingOrder = GetWispShapeSortingBaseOrder() + 2;
	}

	private void SyncWispTargetApproachRingSorting()
	{
		if (wispTargetApproachRingDisc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			wispTargetApproachRingDisc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		// Keep this above the follow ring but below the active drag approach ring.
		wispTargetApproachRingDisc.SortingOrder = GetWispShapeSortingBaseOrder() + 3;
	}

	private void SetWispIndicatorVisible(bool visible)
	{
		bool showPrefabMovingTarget = visible && wispIndicatorUsesPrefabMovingTarget;
		if (wispIndicatorUsesPrefabMovingTarget && wispRect != null)
		{
			wispRect.gameObject.SetActive(showPrefabMovingTarget);
		}

		if (wispIndicator != null)
		{
			wispIndicator.gameObject.SetActive(showPrefabMovingTarget);
		}

		if (wispIndicatorDisc != null)
		{
			wispIndicatorDisc.gameObject.SetActive(visible && !wispIndicatorUsesPrefabMovingTarget);
		}

		if (wispIndicatorOutlineDisc != null)
		{
			wispIndicatorOutlineDisc.gameObject.SetActive(showPrefabMovingTarget);
		}
	}

	private void HideWispMotionVisualsForStaticPreview()
	{
		if (wispRect != null)
		{
			wispRect.DOKill();
			wispRect.localScale = Vector3.one;
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
	}

	private Color GetWispIndicatorColor()
	{
		if (wispIndicatorDisc != null && !wispIndicatorUsesPrefabMovingTarget)
		{
			return wispIndicatorDisc.Color;
		}

		return wispIndicatorUsesPrefabMovingTarget && wispIndicator != null ? wispIndicator.color : wispColor;
	}

	private void SetWispIndicatorColor(Color color)
	{
		if (wispIndicatorDisc != null && !wispIndicatorUsesPrefabMovingTarget)
		{
			wispIndicatorDisc.Color = color;
			return;
		}

		if (wispIndicatorUsesPrefabMovingTarget && wispIndicator != null)
		{
			wispIndicator.color = color;
		}
	}

	private Transform GetWispIndicatorTransform()
	{
		if (wispIndicatorUsesPrefabMovingTarget && wispRect != null)
		{
			return wispRect.transform;
		}

		if (wispIndicatorDisc != null && !wispIndicatorUsesPrefabMovingTarget)
		{
			return wispIndicatorDisc.transform;
		}

		return wispIndicatorUsesPrefabMovingTarget && wispIndicator != null ? wispIndicator.transform : null;
	}

	private void ResetWispTargetApproachRingPulseState()
	{
		wispTargetApproachRingPulseStartUnscaledTime = -1f;
		wispTargetApproachRingPulseEndUnscaledTime = -1f;
		wispTargetApproachRingPulseScaleMultiplier = 1f;
		wispTargetApproachRingPulseAlphaMultiplier = 1f;
	}

	private float EvaluateWispTargetApproachRingPulse01()
	{
		if (wispTargetApproachRingPulseStartUnscaledTime < 0f ||
		    wispTargetApproachRingPulseEndUnscaledTime <= Time.unscaledTime)
		{
			return 0f;
		}

		float duration = Mathf.Max(0.0001f, wispTargetApproachRingPulseEndUnscaledTime - wispTargetApproachRingPulseStartUnscaledTime);
		float t = Mathf.Clamp01((Time.unscaledTime - wispTargetApproachRingPulseStartUnscaledTime) / duration);
		return 1f - Mathf.SmoothStep(0f, 1f, t);
	}

	private Color GetCurrentWispTargetCueColor()
	{
		return ResolveCurrentWispTargetCueColor(Mathf.Clamp01(wispProgress));
	}

	private Color ResolveCurrentWispTargetCueColor(float progress01)
	{
		if (!wispTargetApproachRingUseZoneColor)
		{
			return wispTargetApproachRingColor;
		}

		float progress = Mathf.Clamp01(progress01);
		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		if (progress < greenStart)
		{
			float preHitT = Mathf.InverseLerp(0f, Mathf.Max(0.0001f, greenStart), progress);
			return Color.Lerp(wispTargetApproachRingColor, wispOverlapGoodColor, Mathf.SmoothStep(0f, 0.88f, preHitT));
		}

		if (progress >= perfectStart && progress <= greenEnd)
		{
			float perfectT = Mathf.InverseLerp(perfectStart, Mathf.Max(perfectStart + 0.0001f, greenEnd), progress);
			return Color.Lerp(wispOverlapGoodColor, wispOverlapPerfectColor, perfectT);
		}

		if (progress >= greenStart && progress <= greenEnd)
		{
			float goodT = Mathf.InverseLerp(greenStart, Mathf.Max(greenStart + 0.0001f, perfectStart), progress);
			return Color.Lerp(wispOverlapGoodColor, wispOverlapPerfectColor, goodT * 0.35f);
		}

		return wispOverlapLateColor;
	}

	private float EvaluateWispTargetApproachRingAlphaMultiplier(float progress01, float greenStart, float greenEnd)
	{
		float progress = Mathf.Clamp01(progress01);
		if (progress < greenStart)
		{
			float preHitT = Mathf.InverseLerp(0f, Mathf.Max(0.0001f, greenStart), progress);
			return Mathf.Lerp(0.58f, 1f, Mathf.SmoothStep(0f, 1f, preHitT));
		}

		if (progress <= greenEnd)
		{
			float windowT = Mathf.InverseLerp(greenStart, Mathf.Max(greenStart + 0.0001f, greenEnd), progress);
			return Mathf.Lerp(1f, 0.82f, windowT);
		}

		float lateT = Mathf.InverseLerp(greenEnd, 1f, progress);
		return Mathf.Lerp(0.82f, 0f, Mathf.SmoothStep(0f, 1f, lateT));
	}

	private void HideWispTargetApproachRingImmediate()
	{
		ResetWispTargetApproachRingPulseState();

		if (wispTargetApproachRingRect != null)
		{
			wispTargetApproachRingRect.DOKill();
			wispTargetApproachRingRect.localScale = Vector3.one;
		}

		if (wispTargetApproachRingDisc != null)
		{
			DOTween.Kill(wispTargetApproachRingDisc);
			Color c = wispTargetApproachRingDisc.Color;
			c.a = 0f;
			wispTargetApproachRingDisc.Color = c;
			wispTargetApproachRingDisc.gameObject.SetActive(false);
		}

		SetApproachCueVisibility(ref targetApproachCueState, false);
	}

	private void PrepareTargetApproachCueWindow(EquationBubbleElement owner)
	{
		if (!wispActive)
		{
			return;
		}

		bool needNewWindow =
			!targetApproachCueState.isPrepared ||
			targetApproachCueState.windowId != (activeWispWindowState.isPrepared ? activeWispWindowState.windowId : -1) ||
			!targetApproachCueState.MatchesOwner(owner);
		if (needNewWindow)
		{
			PrepareApproachCueWindow(
				ref targetApproachCueState,
				ApproachCueKind.MovingTarget,
				owner,
				ApproachCueSemantic.TravelBody,
				wispStartSongTime,
				wispEndSongTime,
				wispTargetBeatIndex,
				activeWispWindowState.isPrepared ? activeWispWindowState.windowId : -1,
				wispTimingPrepared ? "wisp-runtime" : "wisp-fallback");
		}
		else
		{
			RebindApproachCueOwner(ref targetApproachCueState, owner);
		}

		SetApproachCueProgress(ref targetApproachCueState, wispProgress);
	}

	private void UpdateWispTargetApproachRing()
	{
		if (!ShouldUseMovingTargetApproachRingCue() || wispTargetApproachRingDisc == null || wispTargetApproachRingRect == null || wispRect == null)
		{
			HideWispTargetApproachRingImmediate();
			return;
		}

		if (!wispTargetApproachRingContinuous)
		{
			if (wispTargetApproachRingDisc.gameObject.activeSelf)
			{
				wispTargetApproachRingRect.anchoredPosition = wispRect.anchoredPosition;
			}
			return;
		}

		if (!wispActive)
		{
			HideWispTargetApproachRingImmediate();
			return;
		}

		PrepareTargetApproachCueWindow(GetActiveWispDestinationElement());

		float markerDiameter = Mathf.Max(8f, Mathf.Max(wispRect.rect.width, wispRect.rect.height));
		float d = Mathf.Max(8f, ToWispShapeUnits(markerDiameter));
		float thickness = Mathf.Max(0.75f, d * Mathf.Clamp(wispTargetApproachRingThicknessRatio, 0.01f, 0.14f));
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		wispTargetApproachRingDisc.Thickness = thickness;
		wispTargetApproachRingDisc.Radius = radius;
		SyncWispTargetApproachRingSorting();

		float progress = Mathf.Clamp01(wispProgress);
		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float closure01 = EvaluateApproachRingClosure01(progress);
		float imminence01 = EvaluateApproachRingImminence01(progress, greenStart);
		float guidanceScaleBoost = ShouldShowJourneyPathBodyWhileActive() ? 1f : 1.08f;
		float startScale = Mathf.Clamp(GetScaledWispTargetApproachRingStartScale() * guidanceScaleBoost, 1f, 10f);
		float ringScale = Mathf.Lerp(startScale, 1f, closure01);
		float pulse01 = EvaluateWispTargetApproachRingPulse01();
		float pulseScaleMul = Mathf.Lerp(1f, Mathf.Max(1f, wispTargetApproachRingPulseScaleMultiplier), pulse01);
		float pulseAlphaMul = Mathf.Lerp(1f, Mathf.Max(1f, wispTargetApproachRingPulseAlphaMultiplier), pulse01);
		float ambientPulse01 = EvaluateApproachRingAmbientPulse01(progress, 1.25f, 2.2f);
		float ambientDepth = Mathf.Lerp(0.026f, 0f, closure01) * Mathf.Lerp(1f, 0.5f, imminence01);
		float ambientScaleMul = 1f + (((ambientPulse01 * 2f) - 1f) * ambientDepth);
		float settleScaleMul = Mathf.Lerp(1.02f, 1f, imminence01);

		wispTargetApproachRingRect.anchoredPosition = wispRect.anchoredPosition;
		wispTargetApproachRingRect.localScale = Vector3.one * ringScale * ambientScaleMul * settleScaleMul * pulseScaleMul;

		Color cue = ResolveCurrentWispTargetCueColor(progress);
		float alphaMul = EvaluateWispTargetApproachRingAlphaMultiplier(progress, greenStart, greenEnd);
		if (!ShouldShowJourneyPathBodyWhileActive())
		{
			alphaMul = Mathf.Clamp01((alphaMul * 1.12f) + 0.04f);
		}
		float mergeFade = EvaluateApproachRingFadeOutAlpha01(
			closure01,
			wispTargetApproachRingFadeNearHit,
			latestFadeStart01: 0.82f,
			earliestFadeStart01: 0.5f);
		alphaMul *= mergeFade;

		cue.a = Mathf.Clamp01(wispTargetApproachRingAlpha * alphaMul * pulseAlphaMul);
		wispTargetApproachRingDisc.Color = cue;
		bool visible = cue.a > 0.001f;
		SetApproachCueVisibility(ref targetApproachCueState, visible);
		wispTargetApproachRingDisc.gameObject.SetActive(visible);
	}

	private bool ShouldUseMovingTargetApproachRingCue()
	{
		return wispTargetApproachRingEnabled;
	}

	private void PulseWispTargetApproachRing(float durationSeconds, float startScaleMultiplier = 1f, float alphaMultiplier = 1f)
	{
		if (!ShouldUseMovingTargetApproachRingCue() || wispTargetApproachRingDisc == null || wispTargetApproachRingRect == null || wispRect == null)
		{
			return;
		}

		PrepareTargetApproachCueWindow(GetActiveWispDestinationElement());

		if (wispTargetApproachRingContinuous)
		{
			wispTargetApproachRingPulseStartUnscaledTime = Time.unscaledTime;
			wispTargetApproachRingPulseEndUnscaledTime = wispTargetApproachRingPulseStartUnscaledTime + Mathf.Max(0.05f, durationSeconds);
			wispTargetApproachRingPulseScaleMultiplier = Mathf.Max(1f, startScaleMultiplier);
			wispTargetApproachRingPulseAlphaMultiplier = Mathf.Max(1f, alphaMultiplier);
			UpdateWispTargetApproachRing();
			return;
		}

		float markerDiameter = Mathf.Max(8f, Mathf.Max(wispRect.rect.width, wispRect.rect.height));
		float d = Mathf.Max(8f, ToWispShapeUnits(markerDiameter));
		float thickness = Mathf.Max(0.75f, d * Mathf.Clamp(wispTargetApproachRingThicknessRatio, 0.01f, 0.14f));
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		wispTargetApproachRingDisc.Thickness = thickness;
		wispTargetApproachRingDisc.Radius = radius;
		SyncWispTargetApproachRingSorting();

		wispTargetApproachRingRect.DOKill();
		DOTween.Kill(wispTargetApproachRingDisc);
		wispTargetApproachRingRect.anchoredPosition = wispRect.anchoredPosition;
		float targetRingStartScale = Mathf.Clamp(GetScaledWispTargetApproachRingStartScale() * Mathf.Max(1f, startScaleMultiplier), 1f, 10f);
		wispTargetApproachRingRect.localScale = Vector3.one * Mathf.Lerp(1f, targetRingStartScale, 0.9f);

		Color c = GetCurrentWispTargetCueColor();
		c.a = Mathf.Clamp01(wispTargetApproachRingAlpha * Mathf.Clamp01(alphaMultiplier) * 0.82f);
		wispTargetApproachRingDisc.Color = c;
		wispTargetApproachRingDisc.gameObject.SetActive(true);
		SetApproachCueVisibility(ref targetApproachCueState, true);

		float dur = Mathf.Max(0.05f, durationSeconds);
		wispTargetApproachRingRect.DOScale(1f, dur).SetEase(Ease.OutCubic).SetUpdate(true);

		Color from = c;
		Color to = c;
		to.a = 0f;
		DOTween.To(() => from, v =>
		{
			from = v;
			if (wispTargetApproachRingDisc != null)
			{
				wispTargetApproachRingDisc.Color = v;
			}
		}, to, dur).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(wispTargetApproachRingDisc)
			.OnComplete(() =>
			{
				if (wispTargetApproachRingDisc != null)
				{
					wispTargetApproachRingDisc.gameObject.SetActive(false);
				}
				SetApproachCueVisibility(ref targetApproachCueState, false);
			});
	}

	private void PulseWispSourceDigitApproachRing(float durationSeconds, float punch = 0f)
	{
		// The source-digit cue is an idle/journey timing affordance. During an active drag, the drag ring handles feedback.
		if (currentDraggingElement != null)
		{
			return;
		}

		EquationBubbleElement source = GetActiveWispSourceElement();
		if (source == null || !showActiveDragApproachRing)
		{
			return;
		}

		EnsureActiveDragApproachRing(source);
		if (activeDragApproachRingDisc == null || activeDragApproachRingRect == null)
		{
			return;
		}

		float bubbleRadiusPx = Mathf.Max(4f, GetEquationBubbleVisualRadius(source));
		float diameterPx = bubbleRadiusPx * 2f;
		float d = Mathf.Max(8f, ToWispShapeUnits(diameterPx));
		float thickness = Mathf.Max(0.75f, d * Mathf.Clamp(activeDragApproachRingThicknessRatio, 0.01f, 0.12f) * 0.8f);
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		activeDragApproachRingDisc.Thickness = thickness;
		activeDragApproachRingDisc.Radius = radius;
		SyncActiveDragApproachRingDiscSorting();

		activeDragApproachRingRect.DOKill();
		DOTween.Kill(activeDragApproachRingDisc);
		float punch01 = Mathf.Clamp01(punch);
		float pulseBlend = Mathf.Lerp(0.55f, 0.8f, punch01);
		float pulseStartScale = Mathf.Lerp(1f, GetScaledSourceBubbleApproachRingStartScale(), pulseBlend);
		activeDragApproachRingRect.localScale = Vector3.one * Mathf.Clamp(pulseStartScale, 1.08f, 10f);

		Color start = activeDragApproachRingColor;
		start.a = Mathf.Clamp01(Mathf.Max(0.08f, activeDragApproachRingBaseAlpha * 0.24f));
		activeDragApproachRingDisc.Color = start;
		activeDragApproachRingDisc.gameObject.SetActive(true);

		float dur = Mathf.Max(0.06f, durationSeconds);
		activeDragApproachRingRect.DOScale(1f, dur).SetEase(Ease.OutCubic).SetUpdate(true);

		Color tweenColor = start;
		Color end = start;
		end.a = 0f;
		DOTween.To(() => tweenColor, v =>
		{
			tweenColor = v;
			if (activeDragApproachRingDisc != null)
			{
				activeDragApproachRingDisc.Color = v;
			}
		}, end, dur).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(activeDragApproachRingDisc)
			.OnComplete(() =>
			{
				if (activeDragApproachRingDisc != null && currentDraggingElement == null)
				{
					Color hidden = activeDragApproachRingDisc.Color;
					hidden.a = 0f;
					activeDragApproachRingDisc.Color = hidden;
					activeDragApproachRingDisc.gameObject.SetActive(false);
				}
			});
	}
}
