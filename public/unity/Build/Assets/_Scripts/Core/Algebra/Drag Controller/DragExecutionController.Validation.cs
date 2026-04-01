using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

public partial class DragExecutionController
{
#if UNITY_EDITOR
	private bool editorBackgroundOverrideApplyQueued;
#endif

	private void OnValidate()
	{
		EnforceModernRuntimeModes(logCorrection: false);
		NormalizeSerializedSettings(logRuntimeCorrection: false);
		sceneBackgroundCanvasSortingOffset = Mathf.Clamp(sceneBackgroundCanvasSortingOffset, -50, -1);
		sceneBackgroundTranslucentForegroundOpacity = Mathf.Clamp01(sceneBackgroundTranslucentForegroundOpacity);
		sceneBackgroundTranslucentBrightness = Mathf.Clamp(sceneBackgroundTranslucentBrightness, -1f, 1f);
		sceneBackgroundTranslucentVibrancy = Mathf.Clamp(sceneBackgroundTranslucentVibrancy, 0f, 2f);
		sceneBackgroundTranslucentFlatten = Mathf.Clamp01(sceneBackgroundTranslucentFlatten);

		if (!gameObject.scene.IsValid())
		{
			return;
		}

#if UNITY_EDITOR
		// OnValidate can fire frequently while editing and may run outside the normal update loop.
		// Queue scene-mutation work to the editor update pump and coalesce duplicate requests.
		if (!Application.isPlaying)
		{
			QueueEditorBackgroundOverrideApply();
			return;
		}
#endif

		ApplySceneBackgroundOverridesIfEnabled();
	}

#if UNITY_EDITOR
	private void QueueEditorBackgroundOverrideApply()
	{
		if (editorBackgroundOverrideApplyQueued)
		{
			return;
		}

		editorBackgroundOverrideApplyQueued = true;
		EditorApplication.delayCall += ApplySceneBackgroundOverridesDeferred;
	}

	private void ApplySceneBackgroundOverridesDeferred()
	{
		editorBackgroundOverrideApplyQueued = false;
		if (this == null || !gameObject.scene.IsValid())
		{
			return;
		}

		ApplySceneBackgroundOverridesIfEnabled();
	}
#endif

	private void NormalizeTimingZones()
	{
		greenZoneStart = Mathf.Clamp01(greenZoneStart);
		greenZoneEnd = Mathf.Clamp01(greenZoneEnd);
		if (greenZoneEnd < greenZoneStart)
		{
			float tmp = greenZoneStart;
			greenZoneStart = greenZoneEnd;
			greenZoneEnd = tmp;
		}

		perfectZoneStart = Mathf.Clamp01(perfectZoneStart);
		perfectZoneStart = Mathf.Clamp(perfectZoneStart, greenZoneStart, greenZoneEnd);
	}

	private void NormalizeNonNegativeSettings()
	{
		bubbleSizeMin = Mathf.Max(0f, bubbleSizeMin);
		bubbleSizeMax = Mathf.Max(0f, bubbleSizeMax);
		if (bubbleSizeMax < bubbleSizeMin)
		{
			bubbleSizeMax = bubbleSizeMin;
		}

		bubbleSpacingRatio = Mathf.Max(0f, bubbleSpacingRatio);
		operatorSizeRatio = Mathf.Max(0f, operatorSizeRatio);
		wispBubbleAvoidancePadding = Mathf.Max(0f, wispBubbleAvoidancePadding);
		wispArcHeightMin = Mathf.Max(0f, wispArcHeightMin);
		wispArcHeightMax = Mathf.Max(wispArcHeightMin, wispArcHeightMax);
		wispTravelDurationMinSeconds = Mathf.Max(0.05f, wispTravelDurationMinSeconds);
		wispTravelDurationMaxSeconds = Mathf.Max(wispTravelDurationMinSeconds, wispTravelDurationMaxSeconds);
		wispOcclusionZoneRefreshSeconds = Mathf.Max(0f, wispOcclusionZoneRefreshSeconds);
		wispOcclusionZoneRefreshWhileDraggingSeconds = Mathf.Max(0f, wispOcclusionZoneRefreshWhileDraggingSeconds);
		wispEndpointBubbleFadeOutlineBand = Mathf.Clamp(wispEndpointBubbleFadeOutlineBand, 0f, 0.5f);
		wispFollowRingRadiusPadding = Mathf.Max(0f, wispFollowRingRadiusPadding);
		stepPerformanceReferenceGap = Mathf.Max(0f, stepPerformanceReferenceGap);
		contextualGuidanceAutoTutorialMissThreshold = Mathf.Max(1, contextualGuidanceAutoTutorialMissThreshold);
		contextualGuidancePathMissCompletionThreshold = Mathf.Clamp(contextualGuidancePathMissCompletionThreshold, 0.1f, 0.9f);
		wispStreakModulationTargetStreak = Mathf.Max(1, wispStreakModulationTargetStreak);
		trailSampleMinDistance = Mathf.Max(0f, trailSampleMinDistance);
		trailCatchUpPointsPerSecond = Mathf.Max(0.1f, trailCatchUpPointsPerSecond);
		dragEquationCompactionTweenSeconds = Mathf.Max(0f, dragEquationCompactionTweenSeconds);
		stepPerformanceReferenceWidthPadding = Mathf.Max(0f, stepPerformanceReferenceWidthPadding);
		stepPerformanceMinSlotWidth = Mathf.Max(8f, stepPerformanceMinSlotWidth);
		stepPerformanceVisualTweenSeconds = Mathf.Max(0.02f, stepPerformanceVisualTweenSeconds);
	}

	private void NormalizeWispScaleSettings()
	{
		wispPathWidthRatio = Mathf.Clamp(wispPathWidthRatio, 0.04f, 0.75f);
		wispProceduralPathMinWidthRatio = Mathf.Clamp(wispProceduralPathMinWidthRatio, 0.04f, 0.75f);
		wispIndicatorSizeRatio = Mathf.Clamp(wispIndicatorSizeRatio, 0.12f, 0.75f);
		wispArcHeightDistanceRatio = Mathf.Clamp(wispArcHeightDistanceRatio, 0.05f, 0.75f);
		wispPathSegments = Mathf.Clamp(wispPathSegments, 2, 160);
		wispShapesPolylineMaxPoints = Mathf.Clamp(wispShapesPolylineMaxPoints, 24, 240);
		wispShapesPolylineDecimation = Mathf.Clamp01(wispShapesPolylineDecimation);
		wispProceduralPathMinShapesThicknessMultiplier = Mathf.Clamp(wispProceduralPathMinShapesThicknessMultiplier, 0.75f, 4f);
		wispProceduralPathMinDotThicknessMultiplier = Mathf.Clamp(wispProceduralPathMinDotThicknessMultiplier, 0.25f, 4f);
		wispShapesPolylineThicknessMultiplier = Mathf.Clamp(wispShapesPolylineThicknessMultiplier, 0.75f, 4f);
		wispPathThicknessMultiplier = Mathf.Clamp(wispPathThicknessMultiplier, 0.35f, 3f);
		wispSegmentCullConfidenceThreshold = Mathf.Clamp(wispSegmentCullConfidenceThreshold, 0.5f, 0.95f);
		wispPathHeatLerp = Mathf.Clamp(wispPathHeatLerp, 0.05f, 0.65f);
		wispFollowRingBubbleRadiusRatio = Mathf.Clamp(wispFollowRingBubbleRadiusRatio, 0.35f, 1.6f);
		wispCurvePointSpacingWidthMultiplier = Mathf.Clamp(wispCurvePointSpacingWidthMultiplier, 0.2f, 1.6f);
		wispCurveMaxRenderPoints = Mathf.Clamp(wispCurveMaxRenderPoints, 24, 320);
		wispCurveCornerRoundMinTurnDegrees = Mathf.Clamp(wispCurveCornerRoundMinTurnDegrees, 8f, 80f);
		wispCurveCornerRoundBlend = Mathf.Clamp(wispCurveCornerRoundBlend, 0.15f, 0.45f);
		wispPathCurvaturePenaltyWeight = Mathf.Clamp(wispPathCurvaturePenaltyWeight, 0f, 2f);
		wispPathSelfIntersectionPenaltyWeight = Mathf.Clamp(wispPathSelfIntersectionPenaltyWeight, 0f, 3f);
		wispPreferUnderCloseWeight = Mathf.Clamp(wispPreferUnderCloseWeight, 0f, 2f);
		wispReferenceCloseHeadroomRatio = Mathf.Clamp(wispReferenceCloseHeadroomRatio, 0.4f, 3f);
		wispPathGradientExponent = Mathf.Clamp(wispPathGradientExponent, 0.35f, 2.4f);
		wispMovingTargetGlassIdleOpacity = Mathf.Clamp01(wispMovingTargetGlassIdleOpacity);
		wispMovingTargetGlassFocusOpacity = Mathf.Clamp01(wispMovingTargetGlassFocusOpacity);
		wispMovingTargetOutlinePulseScale = Mathf.Clamp(wispMovingTargetOutlinePulseScale, 1f, 1.4f);
		wispStreakAssistDistanceBoost = Mathf.Clamp(wispStreakAssistDistanceBoost, 0f, 0.35f);
		wispStreakAssistPerfectRelax = Mathf.Clamp(wispStreakAssistPerfectRelax, 0f, 0.25f);
		wispStreakAssistGoodRelax = Mathf.Clamp(wispStreakAssistGoodRelax, 0f, 0.2f);
		wispStreakTightenDistance = Mathf.Clamp(wispStreakTightenDistance, 0f, 0.2f);
		wispStreakTightenPerfect = Mathf.Clamp(wispStreakTightenPerfect, 0f, 0.2f);
		wispStreakTightenGood = Mathf.Clamp(wispStreakTightenGood, 0f, 0.15f);
		wispStreakBeatPulseBonus = Mathf.Clamp(wispStreakBeatPulseBonus, 0f, 0.3f);
		wispEquationStyleOverrideStrength = Mathf.Clamp(wispEquationStyleOverrideStrength, 0f, 0.45f);
		wispAdaptiveTravelMaxMultiplier = Mathf.Clamp(wispAdaptiveTravelMaxMultiplier, 0.8f, 2.2f);
		wispAdaptiveTravelEqualsCrossBonus = Mathf.Clamp(wispAdaptiveTravelEqualsCrossBonus, 0f, 0.6f);
		wispAdaptiveTravelVariableBonus = Mathf.Clamp(wispAdaptiveTravelVariableBonus, 0f, 0.4f);
		wispSongClockStallFallbackSeconds = Mathf.Max(0.02f, wispSongClockStallFallbackSeconds);
		wispUniformHalfRectDepthMultiplier = Mathf.Clamp(wispUniformHalfRectDepthMultiplier, 0.75f, 1.8f);
		wispUniformHalfRectCornerRadiusRatio = Mathf.Clamp(wispUniformHalfRectCornerRadiusRatio, 0.08f, 0.45f);
		wispUniformSemiCircleSagittaRatio = Mathf.Clamp(wispUniformSemiCircleSagittaRatio, 0.45f, 1f);
		wispUniformHalfRectBridgeDipRatio = Mathf.Clamp(wispUniformHalfRectBridgeDipRatio, 0f, 0.45f);
		wispUniformTemplateSpacingWidthMultiplier = Mathf.Clamp(wispUniformTemplateSpacingWidthMultiplier, 0.12f, 0.6f);
	}

	private void NormalizeAutoSizingSettings()
	{
		autoSizeHeightRatio = Mathf.Clamp(autoSizeHeightRatio, 0.35f, 0.85f);
		bubbleSpacingRatio = Mathf.Clamp(bubbleSpacingRatio, 0f, 0.7f);
		operatorSizeRatio = Mathf.Clamp(operatorSizeRatio, 0.2f, 1f);
		stepPerformanceBarGap = Mathf.Max(0f, stepPerformanceBarGap);
		stepPerformanceBarHeight = Mathf.Max(6f, stepPerformanceBarHeight);
		stepPerformanceBarWidth = Mathf.Max(80f, stepPerformanceBarWidth);
		stepPerformanceShapesOutlineThickness = Mathf.Clamp(stepPerformanceShapesOutlineThickness, 0f, 4f);
		stepPerformanceShapesOutlineEmptyAlpha = Mathf.Clamp01(stepPerformanceShapesOutlineEmptyAlpha);
		stepPerformanceShapesOutlineFilledAlpha = Mathf.Clamp01(stepPerformanceShapesOutlineFilledAlpha);
		stepPerformanceReferenceWidthRatio = Mathf.Clamp(stepPerformanceReferenceWidthRatio, 0.4f, 1f);
		stepPerformanceDynamicHeightScale = Mathf.Clamp(stepPerformanceDynamicHeightScale, 0.5f, 1.6f);
		stepPerformanceDynamicGapScale = Mathf.Clamp(stepPerformanceDynamicGapScale, 0.5f, 1.6f);
		wispPathMinAlphaWhenBehind = Mathf.Clamp01(wispPathMinAlphaWhenBehind);
		wispPathTintLiftWhenBehind = Mathf.Clamp01(wispPathTintLiftWhenBehind);
		wispPathAlphaLiftWhenBehind = Mathf.Clamp(wispPathAlphaLiftWhenBehind, 0f, 0.4f);
		wispZoneAlphaLiftWhenBehind = Mathf.Clamp(wispZoneAlphaLiftWhenBehind, 0f, 0.35f);
		dropZoneIdleFillAlpha = Mathf.Clamp01(dropZoneIdleFillAlpha);
		dropZoneDragFillAlpha = Mathf.Clamp01(dropZoneDragFillAlpha);
		dropZoneNearFillAlpha = Mathf.Clamp01(dropZoneNearFillAlpha);
		dropZoneFillThemeBlend = Mathf.Clamp01(dropZoneFillThemeBlend);
		dropZoneNearFillThemeBlend = Mathf.Clamp01(dropZoneNearFillThemeBlend);
		dropZoneOutlineThemeBlend = Mathf.Clamp01(dropZoneOutlineThemeBlend);
		dropZoneNearOutlineThemeBlend = Mathf.Clamp01(dropZoneNearOutlineThemeBlend);
		dropZoneOutlineMinAlpha = Mathf.Clamp01(dropZoneOutlineMinAlpha);
		dropZoneNearOutlineMinAlpha = Mathf.Clamp01(dropZoneNearOutlineMinAlpha);
		dropZoneOutlineHighlightLift = Mathf.Clamp(dropZoneOutlineHighlightLift, 0f, 0.5f);
		wispLateHoldGraceSeconds = Mathf.Max(0f, wispLateHoldGraceSeconds);
		wispTargetApproachRingScaleDampen = Mathf.Clamp(wispTargetApproachRingScaleDampen, 0.35f, 1f);
		wispTargetApproachRingFadeNearHit = Mathf.Clamp01(wispTargetApproachRingFadeNearHit);
		activeDragApproachRingThicknessRatio = Mathf.Clamp(activeDragApproachRingThicknessRatio, 0.01f, 0.12f);
		wispMovingTargetGlassFocusOpacity = Mathf.Max(wispMovingTargetGlassIdleOpacity, wispMovingTargetGlassFocusOpacity);
		solvedBadgeRippleScale = Mathf.Clamp(solvedBadgeRippleScale, 1f, 2.5f);
		solvedBadgeRippleSeconds = Mathf.Max(0.05f, solvedBadgeRippleSeconds);
		solvedBadgeSizeRatio = Mathf.Clamp(solvedBadgeSizeRatio, 0.15f, 0.7f);
		solvedBadgePopSeconds = Mathf.Max(0.05f, solvedBadgePopSeconds);
		solvedBadgeGlassForegroundOpacity = Mathf.Clamp01(solvedBadgeGlassForegroundOpacity);
	}

	private void NormalizeSerializedSettings(bool logRuntimeCorrection)
	{
		float oldGreenStart = greenZoneStart;
		float oldGreenEnd = greenZoneEnd;
		float oldPerfectStart = perfectZoneStart;
		float oldPathRatio = wispPathWidthRatio;
		float oldIndicatorRatio = wispIndicatorSizeRatio;
		float oldArcRatio = wispArcHeightDistanceRatio;
		float oldPadding = wispBubbleAvoidancePadding;
		float oldBubbleMin = bubbleSizeMin;
		float oldBubbleMax = bubbleSizeMax;
		float oldTravelMin = wispTravelDurationMinSeconds;
		float oldTravelMax = wispTravelDurationMaxSeconds;
		float oldStepGap = stepPerformanceReferenceGap;

		NormalizeTimingZones();
		NormalizeNonNegativeSettings();
		NormalizeWispScaleSettings();
		NormalizeAutoSizingSettings();

		if (stepPerformanceUseSolidFillStyle)
		{
			stepPerformanceGlossAlpha = 0f;
		}

		bool changed =
			!Mathf.Approximately(oldGreenStart, greenZoneStart) ||
			!Mathf.Approximately(oldGreenEnd, greenZoneEnd) ||
			!Mathf.Approximately(oldPerfectStart, perfectZoneStart) ||
			!Mathf.Approximately(oldPathRatio, wispPathWidthRatio) ||
			!Mathf.Approximately(oldIndicatorRatio, wispIndicatorSizeRatio) ||
			!Mathf.Approximately(oldArcRatio, wispArcHeightDistanceRatio) ||
			!Mathf.Approximately(oldPadding, wispBubbleAvoidancePadding) ||
			!Mathf.Approximately(oldBubbleMin, bubbleSizeMin) ||
			!Mathf.Approximately(oldBubbleMax, bubbleSizeMax) ||
			!Mathf.Approximately(oldTravelMin, wispTravelDurationMinSeconds) ||
			!Mathf.Approximately(oldTravelMax, wispTravelDurationMaxSeconds) ||
			!Mathf.Approximately(oldStepGap, stepPerformanceReferenceGap);

		if (changed && logRuntimeCorrection && !runtimeSettingsCorrectionLogged)
		{
			runtimeSettingsCorrectionLogged = true;
			Debug.LogWarning("DragExecutionController: Corrected invalid serialized timing/path sizing values to safe runtime ranges.");
		}
	}
}
