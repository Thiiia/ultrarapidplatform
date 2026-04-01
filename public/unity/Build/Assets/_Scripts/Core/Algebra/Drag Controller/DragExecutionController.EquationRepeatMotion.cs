using System.Collections.Generic;

using DG.Tweening;

using UnityEngine;

public partial class DragExecutionController
{
	private Vector2 equationRepeatRowOffsetApplied;
	private readonly List<Vector2> equationPathHemisphereProbePoints = new List<Vector2>(64);

	private static readonly Vector2[] EquationRepeatMotionPattern =
	{
		new Vector2(-0.38f,  0.05f),
		new Vector2( 0.34f, -0.02f),
		new Vector2(-0.12f,  0.20f),
		new Vector2( 0.26f,  0.17f),
		new Vector2(-0.28f, -0.12f),
	};

	private void ApplyEquationRepeatMotionForCurrentStep()
	{
		ApplyEquationRepeatMotionToCurrentRow(GetEquationRepeatTargetOffsetForCurrentStep(), immediate: true);
	}

	private void ResetEquationRepeatMotion(bool immediate)
	{
		ApplyEquationRepeatMotionToCurrentRow(GetEquationRepeatTargetOffsetForCurrentStep(), immediate);
	}

	private Vector2 GetEquationRepeatTargetOffsetForCurrentStep()
	{
		Vector2 offset = GetEquationRepeatBaseOffsetForCurrentStep();
		offset.y = ResolvePathAwareVerticalOffsetY(offset.y);
		return offset;
	}

	private Vector2 GetEquationRepeatBaseOffsetForCurrentStep()
	{
		Vector2 offset = moveEquationBetweenRepeats
			? equationRepeatMoveCenterOffset + equationRepeatMotionBaselineOffset
			: Vector2.zero;
		offset += ResolveEquationRepeatPatternOffset();
		return offset;
	}

	private bool ShouldApplyEquationRepeatPattern()
	{
		if (!moveEquationBetweenRepeats)
		{
			return false;
		}

		int requiredDrags = GetCurrentRequiredDragsForStep();
		return
			requiredDrags > 1 &&
			currentStepDragCount > 0 &&
			(!moveEquationOnlyDuringRepeatSteps || requiredDrags > 1);
	}

	private Vector2 ResolveEquationRepeatPatternOffset()
	{
		if (!ShouldApplyEquationRepeatPattern())
		{
			return Vector2.zero;
		}

		int repeatIndex = Mathf.Max(0, currentStepDragCount - 1);
		Vector2 pattern = EquationRepeatMotionPattern[repeatIndex % EquationRepeatMotionPattern.Length];
		return new Vector2(
			pattern.x * equationRepeatMoveRadiusX,
			pattern.y * equationRepeatMoveRadiusY);
	}

	private Vector2 GetEquationRepeatPreviewDeltaForCurrentStep()
	{
		if (!moveEquationBetweenRepeats)
		{
			return Vector2.zero;
		}

		return GetEquationRepeatBaseOffsetForCurrentStep() - equationRepeatRowOffsetApplied;
	}

	private float ResolvePathAwareVerticalOffsetY(float fallbackY)
	{
		if (!equationFollowPathHemisphere || activeEquationPathHemisphere == EquationPathHemisphere.Neutral)
		{
			return fallbackY;
		}

		if (!TryGetEquationRepeatRowBounds(out Rect rowBounds, out Camera cam) ||
			!TryGetEquationRepeatSafeRect(cam, out Rect safeRect))
		{
			return fallbackY;
		}

		float fallbackDelta = fallbackY - equationRepeatRowOffsetApplied.y;
		Rect projectedBounds = rowBounds;
		projectedBounds.y += fallbackDelta;
		float targetOffsetY = fallbackY;
		switch (activeEquationPathHemisphere)
		{
			case EquationPathHemisphere.Upper:
			{
				float targetBottom = safeRect.yMin + Mathf.Max(0f, equationPathBottomInset);
				targetOffsetY += targetBottom - projectedBounds.yMin;
				break;
			}

			case EquationPathHemisphere.Lower:
			{
				float targetTop = safeRect.yMax - Mathf.Max(0f, equationPathTopInset);
				targetOffsetY += targetTop - projectedBounds.yMax;
				break;
			}
		}

		return targetOffsetY;
	}

	private void ApplyEquationPlacementForWispStyle(WispPathStyle style, bool prepareWindowState)
	{
		bool canReuseResolvedSuggestionPlacement =
			prepareWindowState &&
			currentDraggingElement != null &&
			currentDraggingElement == journeySuggestedElement &&
			currentDropZone != null &&
			currentDropZone == journeySuggestedDropZone &&
			equationPlacementState.lastResolvedPathVersion == approachCueGeometryVersion;
		if (canReuseResolvedSuggestionPlacement)
		{
			activeEquationPathHemisphere = equationPlacementState.activeHemisphere;
			if (prepareWindowState)
			{
				PrepareWispWindowState(style, activeEquationPathHemisphere);
			}

			CaptureEquationPlacementStateSnapshot();
			return;
		}

		EquationPathHemisphere hemisphere = ResolveWindowEquationPathHemisphere(style);
		activeEquationPathHemisphere = hemisphere;
		ApplyEquationRepeatMotionForCurrentStep();

		if (TryGetActiveWispPair(out EquationBubbleElement source, out EquationBubbleElement dropZone))
		{
			SetJourneyWispEndpointsForPair(source, dropZone);
		}

		if (prepareWindowState)
		{
			PrepareWispWindowState(style, hemisphere);
		}

		CaptureEquationPlacementStateSnapshot();
	}

	private void PrepareEquationPlacementForWispWindow(WispPathStyle style)
	{
		ApplyEquationPlacementForWispStyle(style, prepareWindowState: true);
	}

	private void PrimeEquationPlacementForJourneySuggestion()
	{
		if (journeySuggestedElement == null || journeySuggestedDropZone == null || currentDraggingElement != null)
		{
			return;
		}

		SetJourneyWispEndpointsForPair(journeySuggestedElement, journeySuggestedDropZone);
		ConfigureLockedWispPathWindowState(preserveLockedPathVariant: false);
		WispPathStyle style = hasLockedWindowPathStyle ? lockedWindowPathStyle : PickWispPathStyle();
		ApplyEquationPlacementForWispStyle(style, prepareWindowState: false);
	}

	private EquationPathHemisphere ResolveWindowEquationPathHemisphere(WispPathStyle style)
	{
		if (!equationFollowPathHemisphere)
		{
			return EquationPathHemisphere.Neutral;
		}

		if (lockPathPerHitZoneWindow && hasLockedWindowEquationPathHemisphere)
		{
			return lockedWindowEquationPathHemisphere;
		}

		EquationPathHemisphere hemisphere = EquationPathHemisphere.Neutral;
		if (TryBuildProvisionalWispPathSamples(style, equationPathHemisphereProbePoints))
		{
			hemisphere = ClassifyEquationPathHemisphere(
				equationPathHemisphereProbePoints,
				Mathf.Max(8f, bubbleSize * 0.08f),
				biasThreshold: 0.22f);
		}

		if (lockPathPerHitZoneWindow)
		{
			lockedWindowEquationPathHemisphere = hemisphere;
			hasLockedWindowEquationPathHemisphere = true;
		}

		return hemisphere;
	}

	private bool TryBuildProvisionalWispPathSamples(WispPathStyle style, List<Vector2> destination)
	{
		if (destination == null)
		{
			return false;
		}

		destination.Clear();
		if (!TryGetActiveWispPair(out EquationBubbleElement source, out EquationBubbleElement dropZone))
		{
			return false;
		}

		SetJourneyWispEndpointsForPair(source, dropZone);
		if ((journeyWispEnd - journeyWispStart).sqrMagnitude <= 0.0001f)
		{
			return false;
		}

		WispPathStyle resolvedStyle = ResolveOcclusionAwareWispStyle(journeyWispStart, journeyWispEnd, style);
		BuildWispPathPoints(journeyWispStart, journeyWispEnd, resolvedStyle, destination);
		return destination.Count >= 2;
	}

	private bool TryGetActiveWispPair(out EquationBubbleElement source, out EquationBubbleElement dropZone)
	{
		source = currentDraggingElement != null ? currentDraggingElement : journeySuggestedElement;
		dropZone = currentDraggingElement != null ? currentDropZone : journeySuggestedDropZone;
		return source != null && dropZone != null;
	}

	private static EquationPathHemisphere ClassifyEquationPathHemisphere(IReadOnlyList<Vector2> samples, float deviationEpsilon, float biasThreshold = 0.24f)
	{
		if (samples == null || samples.Count < 3)
		{
			return EquationPathHemisphere.Neutral;
		}

		Vector2 start = samples[0];
		Vector2 end = samples[samples.Count - 1];
		float sumDeviation = 0f;
		float sumAbsDeviation = 0f;
		float peakPositive = 0f;
		float peakNegative = 0f;
		int sampleCount = 0;

		for (int i = 1; i < samples.Count - 1; i++)
		{
			float t = i / (float)(samples.Count - 1);
			float expectedY = Mathf.Lerp(start.y, end.y, t);
			float deviation = samples[i].y - expectedY;

			sumDeviation += deviation;
			sumAbsDeviation += Mathf.Abs(deviation);
			peakPositive = Mathf.Max(peakPositive, deviation);
			peakNegative = Mathf.Max(peakNegative, -deviation);
			sampleCount++;
		}

		if (sampleCount <= 0)
		{
			return EquationPathHemisphere.Neutral;
		}

		float meanAbsDeviation = sumAbsDeviation / sampleCount;
		if (meanAbsDeviation <= Mathf.Max(0.001f, deviationEpsilon))
		{
			return EquationPathHemisphere.Neutral;
		}

		float normalizedBias = Mathf.Clamp(sumDeviation / Mathf.Max(0.001f, sumAbsDeviation), -1f, 1f);
		float threshold = Mathf.Clamp(biasThreshold, 0.05f, 0.95f);
		if (normalizedBias >= threshold && peakPositive > deviationEpsilon)
		{
			return EquationPathHemisphere.Upper;
		}

		if (normalizedBias <= -threshold && peakNegative > deviationEpsilon)
		{
			return EquationPathHemisphere.Lower;
		}

		return EquationPathHemisphere.Neutral;
	}

	private void ResetEquationPathHemisphereState(bool clearWindowLock)
	{
		activeEquationPathHemisphere = EquationPathHemisphere.Neutral;
		if (clearWindowLock)
		{
			lockedWindowEquationPathHemisphere = EquationPathHemisphere.Neutral;
			hasLockedWindowEquationPathHemisphere = false;
		}

		CaptureEquationPlacementStateSnapshot();
	}

	private void ApplyEquationRepeatMotionToCurrentRow(Vector2 offset, bool immediate)
	{
		offset = ConstrainEquationRepeatRowOffset(offset);

		Vector2 delta = offset - equationRepeatRowOffsetApplied;
		if (delta.sqrMagnitude <= 0.0001f)
		{
			return;
		}

		// Reposition the gameplay row itself (bubbles/operators/drop zones) rather than
		// moving equationContainer, so the path can remain independent in the same space.
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null || bubble.RectTransform == null)
			{
				continue;
			}

			Vector2 target = bubble.OriginalPosition + delta;
			if (immediate)
			{
				bubble.SetOriginalPosition(target);
			}
			else
			{
				bubble.MoveTo(target, Mathf.Max(0.01f, equationRepeatMoveSeconds));
			}
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject label = operatorLabels[i];
			if (label == null)
			{
				continue;
			}

			RectTransform rt = label.GetComponent<RectTransform>();
			if (rt == null)
			{
				continue;
			}

			Vector2 target = rt.anchoredPosition + delta;
			rt.DOKill(false);
			if (immediate)
			{
				rt.anchoredPosition = target;
			}
			else
			{
				rt.DOAnchorPos(target, Mathf.Max(0.01f, equationRepeatMoveSeconds))
					.SetEase(equationRepeatMoveEase)
					.SetLink(rt.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}

		if (operationSymbolRect != null)
		{
			Vector2 target = operationSymbolRect.anchoredPosition + delta;
			operationSymbolRect.DOKill(false);
			if (immediate)
			{
				operationSymbolRect.anchoredPosition = target;
			}
			else
			{
				operationSymbolRect.DOAnchorPos(target, Mathf.Max(0.01f, equationRepeatMoveSeconds))
					.SetEase(equationRepeatMoveEase)
					.SetLink(operationSymbolRect.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}

		equationRepeatRowOffsetApplied = offset;
		CaptureEquationPlacementStateSnapshot();
	}

	private Vector2 ConstrainEquationRepeatRowOffset(Vector2 desiredOffset)
	{
		if (equationContainer == null)
		{
			return desiredOffset;
		}

		if (!TryGetEquationRepeatRowBounds(out Rect rowBounds, out Camera cam))
		{
			return desiredOffset;
		}

		if (!TryGetEquationRepeatSafeRect(cam, out Rect safeRect))
		{
			return desiredOffset;
		}

		Vector2 clamped = desiredOffset;
		Vector2 desiredDelta = desiredOffset - equationRepeatRowOffsetApplied;
		Rect moved = new Rect(
			rowBounds.x + desiredDelta.x,
			rowBounds.y + desiredDelta.y,
			rowBounds.width,
			rowBounds.height);

		if (moved.xMin < safeRect.xMin)
		{
			clamped.x += safeRect.xMin - moved.xMin;
			moved.xMin = safeRect.xMin;
			moved.xMax = moved.xMin + rowBounds.width;
		}
		if (moved.xMax > safeRect.xMax)
		{
			clamped.x -= moved.xMax - safeRect.xMax;
			moved.xMax = safeRect.xMax;
			moved.xMin = moved.xMax - rowBounds.width;
		}
		if (moved.yMin < safeRect.yMin)
		{
			clamped.y += safeRect.yMin - moved.yMin;
			moved.yMin = safeRect.yMin;
			moved.yMax = moved.yMin + rowBounds.height;
		}
		if (moved.yMax > safeRect.yMax)
		{
			clamped.y -= moved.yMax - safeRect.yMax;
		}

		return clamped;
	}

	private bool TryGetEquationRepeatRowBounds(out Rect bounds, out Camera cam)
	{
		bounds = default;
		cam = null;

		if (equationContainer == null)
		{
			return false;
		}

		Camera resolvedCam = null;
		Canvas canvas = equationContainer.GetComponentInParent<Canvas>();
		if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
		{
			resolvedCam = canvas.worldCamera != null ? canvas.worldCamera : uiCamera;
		}

		bool found = false;
		Rect resolvedBounds = default;

		void IncludeRect(RectTransform rt)
		{
			if (rt == null || !rt.gameObject.activeInHierarchy)
			{
				return;
			}

			if (!TryGetLocalRect(rt, equationContainer, resolvedCam, out Rect local))
			{
				return;
			}

			if (!found)
			{
				resolvedBounds = local;
				found = true;
				return;
			}

			float xMin = Mathf.Min(resolvedBounds.xMin, local.xMin);
			float yMin = Mathf.Min(resolvedBounds.yMin, local.yMin);
			float xMax = Mathf.Max(resolvedBounds.xMax, local.xMax);
			float yMax = Mathf.Max(resolvedBounds.yMax, local.yMax);
			resolvedBounds = Rect.MinMaxRect(xMin, yMin, xMax, yMax);
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null)
			{
				continue;
			}

			IncludeRect(bubble.RectTransform);
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject label = operatorLabels[i];
			if (label == null)
			{
				continue;
			}

			IncludeRect(label.GetComponent<RectTransform>());
		}

		IncludeRect(operationSymbolRect);
		if (found)
		{
			bounds = resolvedBounds;
			cam = resolvedCam;
		}

		return found;
	}

	private bool TryGetEquationRepeatSafeRect(Camera cam, out Rect safeRect)
	{
		safeRect = default;
		if (equationContainer == null)
		{
			return false;
		}

		Rect raw = equationContainer.rect;
		if (dragCanvas != null && dragCanvas != equationContainer && TryGetLocalRect(dragCanvas, equationContainer, cam, out Rect canvasLocal))
		{
			raw = canvasLocal;
		}

		if (raw.width <= 1f || raw.height <= 1f)
		{
			return false;
		}

		float horizontalMargin = Mathf.Max(12f, bubbleSize * 0.55f);
		float bottomMargin = Mathf.Max(12f, bubbleSize * 0.6f);
		float topMargin = Mathf.Max(20f, bubbleSize * 0.42f);

		safeRect = raw;
		safeRect.xMin += horizontalMargin;
		safeRect.xMax -= horizontalMargin;
		safeRect.yMin += bottomMargin;
		safeRect.yMax -= topMargin;

		float topUiGap = Mathf.Max(stepPerformanceReferenceGap, bubbleSize * 0.42f) + Mathf.Max(0f, equationRepeatReferenceExtraGap);
		if (TryGetWispReferenceCeilingY(out float referenceCeiling))
		{
			safeRect.yMax = Mathf.Min(safeRect.yMax, referenceCeiling - topUiGap);
		}

		if (runtimeStepPerformanceBarRoot != null &&
			runtimeStepPerformanceBarRoot.gameObject.activeInHierarchy &&
			TryGetLocalRect(runtimeStepPerformanceBarRoot, equationContainer, cam, out Rect stepPerfLocal))
		{
			safeRect.yMax = Mathf.Min(safeRect.yMax, stepPerfLocal.yMin - topUiGap);
		}

		float minWidth = Mathf.Max(80f, bubbleSize * 2.4f);
		float minHeight = Mathf.Max(80f, bubbleSize * 1.6f);
		if (safeRect.width <= minWidth || safeRect.height <= minHeight)
		{
			return false;
		}

		return true;
	}
}
