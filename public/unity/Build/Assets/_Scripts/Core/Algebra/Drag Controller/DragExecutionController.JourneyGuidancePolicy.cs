using System;

using UnityEngine;

public partial class DragExecutionController
{
	[Serializable]
	private struct JourneyGuidanceProgress
	{
		public int windowExposures;
		public int successfulCompletions;
		public int consecutiveMisses;
	}

	private bool IsAdaptiveJourneyGuidanceEnabled()
	{
		return enableJourneyGuidance && journeyAdaptiveGuidanceScaffoldingEnabled;
	}

	private bool ShouldUseJourneyFirstExposurePathOnlyMode()
	{
		return IsAdaptiveJourneyGuidanceEnabled() && journeyFirstExposurePathOnlyMode;
	}

	private void ResetAdaptiveJourneyGuidanceSessionState(bool clearExposureMemory)
	{
		activeJourneyGuidanceKey = string.Empty;
		activeJourneyGuidanceMode = JourneyGuidanceMode.FullPath;
		currentDragJourneyGuidanceKey = string.Empty;
		currentDragJourneyGuidanceMode = JourneyGuidanceMode.FullPath;
		currentDragPeakGuidedProgress01 = 0f;
		currentDragPeakOverlapScore01 = 0f;
		if (clearExposureMemory)
		{
			journeyGuidanceProgressByKey.Clear();
		}
	}

	private void RefreshJourneyGuidanceModeForPair(EquationBubbleElement source, EquationBubbleElement dropZone, bool recordWindowExposure)
	{
		string key = BuildJourneyGuidanceKey(source, dropZone);
		activeJourneyGuidanceKey = key;

		JourneyGuidanceProgress progress = GetJourneyGuidanceProgress(key);
		activeJourneyGuidanceMode = ResolveJourneyGuidanceMode(progress);

		if (recordWindowExposure && !string.IsNullOrEmpty(key))
		{
			progress.windowExposures = Mathf.Max(0, progress.windowExposures) + 1;
			journeyGuidanceProgressByKey[key] = progress;
		}
	}

	private JourneyGuidanceProgress GetJourneyGuidanceProgress(string key)
	{
		if (string.IsNullOrWhiteSpace(key))
		{
			return default;
		}

		return journeyGuidanceProgressByKey.TryGetValue(key, out JourneyGuidanceProgress progress)
			? progress
			: default;
	}

	private JourneyGuidanceMode ResolveJourneyGuidanceMode(JourneyGuidanceProgress progress)
	{
		if (!enableJourneyGuidance || tutorialGuidanceVisualOverride || rhythmClarityCalmMode)
		{
			return JourneyGuidanceMode.FullPath;
		}

		if (!IsAdaptiveJourneyGuidanceEnabled())
		{
			return JourneyGuidanceMode.FullPath;
		}

		int restoreThreshold = Mathf.Max(1, journeyMissesToRestoreFullPath);
		if (progress.consecutiveMisses >= restoreThreshold)
		{
			return JourneyGuidanceMode.FullPath;
		}

		if (ShouldUseJourneyFirstExposurePathOnlyMode())
		{
			return progress.windowExposures >= 1
				? JourneyGuidanceMode.MovingTargetOnly
				: JourneyGuidanceMode.FullPath;
		}

		int masteryThreshold = ResolveJourneyGuidanceMasterySuccessThreshold();
		if (progress.successfulCompletions >= masteryThreshold)
		{
			return JourneyGuidanceMode.MovingTargetOnly;
		}

		if (progress.windowExposures >= 1)
		{
			return JourneyGuidanceMode.DimmedPath;
		}

		return JourneyGuidanceMode.FullPath;
	}

	private int ResolveJourneyGuidanceMasterySuccessThreshold()
	{
		int threshold = Mathf.Max(1, journeySuccessesBeforeTargetOnly);
		int requiredDrags = GetCurrentRequiredDragsForStep();
		if (requiredDrags >= 4)
		{
			threshold = Mathf.Max(threshold, 2);
		}

		EquationSkillTag skillTag = ResolveCurrentEquationSkillTag();
		if (skillTag == EquationSkillTag.ExpandBrackets ||
			skillTag == EquationSkillTag.MixedMultiStep ||
			skillTag == EquationSkillTag.Substitution)
		{
			threshold = Mathf.Max(threshold, 2);
		}

		return threshold;
	}

	private float GetJourneyGuidancePathAlphaMultiplier()
	{
		return activeJourneyGuidanceMode switch
		{
			JourneyGuidanceMode.DimmedPath => Mathf.Clamp01(journeyDimmedPathAlphaMultiplier),
			JourneyGuidanceMode.MovingTargetOnly => 0f,
			_ => 1f,
		};
	}

	private bool ShouldShowIdleJourneyPreviewPathBody()
	{
		if (tutorialGuidanceVisualOverride || rhythmClarityCalmMode)
		{
			return true;
		}

		return activeJourneyGuidanceMode != JourneyGuidanceMode.MovingTargetOnly;
	}

	private bool ShouldShowJourneyPathBodyWhileActive()
	{
		if (tutorialGuidanceVisualOverride || rhythmClarityCalmMode)
		{
			return true;
		}

		return activeJourneyGuidanceMode != JourneyGuidanceMode.MovingTargetOnly;
	}

	private void CaptureJourneyGuidanceModeForCurrentDrag()
	{
		if (string.IsNullOrEmpty(activeJourneyGuidanceKey))
		{
			RefreshJourneyGuidanceModeForPair(currentDraggingElement, currentDropZone, recordWindowExposure: false);
		}

		currentDragJourneyGuidanceKey = activeJourneyGuidanceKey;
		currentDragJourneyGuidanceMode = activeJourneyGuidanceMode;
		currentDragPeakGuidedProgress01 = 0f;
		currentDragPeakOverlapScore01 = 0f;
	}

	private void TrackJourneyPathGuidanceSample(float overlapScore)
	{
		if (currentDraggingElement == null || !wispActive)
		{
			return;
		}

		float clampedOverlap = Mathf.Clamp01(overlapScore);
		currentDragPeakOverlapScore01 = Mathf.Max(currentDragPeakOverlapScore01, clampedOverlap);
		if (clampedOverlap > 0.0001f)
		{
			currentDragPeakGuidedProgress01 = Mathf.Max(currentDragPeakGuidedProgress01, Mathf.Clamp01(wispProgress));
		}
	}

	private float ResolveCurrentDragPathCompletion01(bool droppedOnTarget)
	{
		if (droppedOnTarget)
		{
			return 1f;
		}

		float progress = Mathf.Clamp01(currentDragPeakGuidedProgress01);
		float overlap = Mathf.Clamp01(currentDragPeakOverlapScore01);
		return Mathf.Clamp01(Mathf.Max(progress, overlap * 0.45f));
	}

	private void RegisterJourneyGuidanceOutcome(bool success, HitResult hitResult, DragMissReason missReason)
	{
		if (string.IsNullOrWhiteSpace(currentDragJourneyGuidanceKey))
		{
			return;
		}

		JourneyGuidanceProgress progress = GetJourneyGuidanceProgress(currentDragJourneyGuidanceKey);
		if (success && (hitResult == HitResult.Good || hitResult == HitResult.Perfect))
		{
			progress.successfulCompletions = Mathf.Max(0, progress.successfulCompletions) + 1;
			progress.consecutiveMisses = 0;
		}
		else if (hitResult == HitResult.Miss || missReason != DragMissReason.None)
		{
			progress.consecutiveMisses = Mathf.Max(0, progress.consecutiveMisses) + 1;
		}

		journeyGuidanceProgressByKey[currentDragJourneyGuidanceKey] = progress;
		if (string.Equals(activeJourneyGuidanceKey, currentDragJourneyGuidanceKey, StringComparison.Ordinal))
		{
			activeJourneyGuidanceMode = ResolveJourneyGuidanceMode(progress);
		}
	}

	private string BuildJourneyGuidanceKey(EquationBubbleElement source, EquationBubbleElement dropZone)
	{
		if (source == null || dropZone == null)
		{
			return string.Empty;
		}

		string equation = currentState != null
			? (!string.IsNullOrWhiteSpace(currentState.rawEquation) ? currentState.rawEquation : FormatEquation(currentState))
			: string.Empty;
		string normalizedEquation = EquationStringUtil.NormalizeForParsing(equation);
		string skillTagKey = EquationSkillTagUtility.ToStableKey(ResolveCurrentEquationSkillTag());
		string dropKey = ResolveJourneyDropZoneStableKey(dropZone);
		string placementKey = ResolveJourneyPlacementKey();
		StepOption operation = DetermineBubbleOperation(source);
		string operationKey = operation != null
			? $"{(int)operation.operationType}:{operation.value}:{Mathf.Max(1, operation.valueDenominator)}"
			: $"{source.ElementType}:{source.NumericValue}";
		return $"{normalizedEquation}|{skillTagKey}|{operationKey}|src:{source.EquationSide}|dst:{dropKey}|place:{placementKey}";
	}

	private string ResolveJourneyPlacementKey()
	{
		if (!moveEquationBetweenRepeats)
		{
			return "static";
		}

		Vector2 offset = GetEquationRepeatBaseOffsetForCurrentStep();
		float quantize = Mathf.Max(1f, bubbleSize * 0.12f);
		int qx = Mathf.RoundToInt(offset.x / quantize);
		int qy = Mathf.RoundToInt(offset.y / quantize);
		return $"{qx},{qy}";
	}

	private string ResolveJourneyDropZoneStableKey(EquationBubbleElement dropZone)
	{
		if (dropZone == leftDropZone)
		{
			return "left";
		}

		if (dropZone == rightDropZone)
		{
			return "right";
		}

		return dropZone != null ? dropZone.EquationSide.ToString() : "unknown";
	}
}
