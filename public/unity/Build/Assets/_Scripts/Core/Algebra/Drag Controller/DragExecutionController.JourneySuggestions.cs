using System;
using System.Collections.Generic;
using ChartLoader.NET.Framework;
using UnityEngine;

public partial class DragExecutionController
{
	public void RequestJourneyGuidanceRefresh()
	{
		journeyNeedsRefresh = true;
	}

	public void ClearJourneyGuidance()
	{
		if (journeySuggestedElement != null)
		{
			journeySuggestedElement.SetHighlighted(false);
		}

		journeySuggestedElement = null;
		journeySuggestedDropZone = null;
		journeyNeedsRefresh = false;
		journeyWispRestartPending = false;
	}

	private void RefreshJourneyGuidanceAndEquationPlacement()
	{
		RequestJourneyGuidanceRefresh();
		UpdateJourneyGuidance();

		if (journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			return;
		}

		ApplyEquationRepeatMotionForCurrentStep();
	}

	private bool TrySelectJourneySuggestedElement(out EquationBubbleElement element)
	{
		element = null;

		if (choiceSystem == null || currentState == null)
		{
			return false;
		}

		List<StepOption> options = choiceSystem.GenerateAvailableOptions(currentState);
		if (options == null || options.Count == 0)
		{
			return false;
		}

		AlgebraSuggestionSemantic semantic = AlgebraSuggestionSemantic.Any;
		if (journeyUseChartLaneForSuggestion && TryGetUpcomingSuggestionSemantic(out AlgebraSuggestionSemantic laneSemantic))
		{
			semantic = laneSemantic;
		}

		StepOption best = SelectBestOptionForSemantic(options, semantic);
		if (best == null)
		{
			return false;
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null || !bubble.IsDraggable)
			{
				continue;
			}

			StepOption operation = DetermineBubbleOperation(bubble);
			if (operation == null)
			{
				continue;
			}

			if (!OperationsMatch(best, operation))
			{
				continue;
			}

			element = bubble;
			return true;
		}

		return false;
	}

	private StepOption SelectBestOptionForSemantic(List<StepOption> options, AlgebraSuggestionSemantic semantic)
	{
		if (options == null || options.Count == 0)
		{
			return null;
		}

		bool Wants(StepOption option)
		{
			if (option == null)
			{
				return false;
			}

			switch (semantic)
			{
				case AlgebraSuggestionSemantic.PreferConstantMove:
					return option.operationType == OperationType.AddConstant || option.operationType == OperationType.SubtractConstant;
				case AlgebraSuggestionSemantic.PreferVariableMove:
					return option.operationType == OperationType.AddVariable || option.operationType == OperationType.SubtractVariable;
				case AlgebraSuggestionSemantic.PreferDivide:
					return option.operationType == OperationType.DivideByCoefficient;
				case AlgebraSuggestionSemantic.PreferFlipSign:
					return option.operationType == OperationType.MultiplyByNegativeOne;
				default:
					return true;
			}
		}

		for (int i = 0; i < options.Count; i++)
		{
			StepOption option = options[i];
			if (option != null && option.isOptimal && Wants(option))
			{
				return option;
			}
		}

		for (int i = 0; i < options.Count; i++)
		{
			StepOption option = options[i];
			if (option != null && option.isOptimal)
			{
				return option;
			}
		}

		for (int i = 0; i < options.Count; i++)
		{
			StepOption option = options[i];
			if (Wants(option))
			{
				return option;
			}
		}

		return options[0];
	}

	private bool TryGetUpcomingSuggestionSemantic(out AlgebraSuggestionSemantic semantic)
	{
		semantic = AlgebraSuggestionSemantic.Any;

		EnsureWispBeatCache();
		if (wispBeatTimes == null || wispBeatTimes.Length == 0 || wispBeatNotes == null || wispBeatNotes.Length == 0)
		{
			return false;
		}

		double now = NowSongTime();
		int steps = Mathf.Max(1, Mathf.RoundToInt(wispSpeed));

		int index = Array.BinarySearch(wispBeatTimes, now);
		if (index < 0)
		{
			index = ~index;
		}

		int target = Mathf.Clamp(index + steps, 0, wispBeatNotes.Length - 1);
		Note note = wispBeatNotes[target];
		if (note == null)
		{
			return false;
		}

		int lane = Mathf.Clamp(note.HighestFret, 0, 4);
		semantic = lane switch
		{
			0 => lane0Semantic,
			1 => lane1Semantic,
			2 => lane2Semantic,
			3 => lane3Semantic,
			4 => lane4Semantic,
			_ => AlgebraSuggestionSemantic.Any
		};

		if (note.IsChord)
		{
			semantic = AlgebraSuggestionSemantic.Any;
		}

		return true;
	}

	private void ApplyJourneySuggestion(EquationBubbleElement suggested)
	{
		if (suggested == journeySuggestedElement && !journeyNeedsRefresh)
		{
			return;
		}

		ClearJourneyGuidance();
		journeyNeedsRefresh = false;

		journeySuggestedElement = suggested;
		journeySuggestedDropZone = GetTargetDropZoneForElement(suggested);

		if (journeyHighlightSuggestedBubble && journeySuggestedElement != null)
		{
			journeySuggestedElement.SetHighlighted(true);
		}

		if (journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			TryApplyCanonicalPlaceholderRowAlignmentForCurrentSuggestion();
			SetJourneyWispEndpointsForPair(journeySuggestedElement, journeySuggestedDropZone);
			RefreshJourneyGuidanceModeForPair(journeySuggestedElement, journeySuggestedDropZone, recordWindowExposure: false);
			PrimeEquationPlacementForJourneySuggestion();
		}

		BeginIdleJourneyPreviewIfReady();
	}

	private void SetJourneyWispEndpointsForPair(EquationBubbleElement source, EquationBubbleElement dropZone)
	{
		if (source == null || dropZone == null)
		{
			return;
		}

		Vector2 start = source.RectTransform != null ? source.RectTransform.anchoredPosition : source.OriginalPosition;
		Vector2 end = dropZone.RectTransform != null ? dropZone.RectTransform.anchoredPosition : dropZone.OriginalPosition;
		Vector2 delta = end - start;
		float distance = delta.magnitude;
		if (distance > 0.001f)
		{
			Vector2 direction = delta / distance;
			float sourceRadius = Mathf.Max(0f, GetBubbleRadius(source.RectTransform));
			float dropRadius = Mathf.Max(0f, GetBubbleRadius(dropZone.RectTransform));
			float halfPath = Mathf.Max(1f, GetWispPathWidth() * 0.5f);

			float startInset = Mathf.Max(0f, sourceRadius - (halfPath * 0.35f));
			float endInset = Mathf.Max(0f, dropRadius - (halfPath * 0.25f));

			float maxInset = distance * 0.45f;
			start += direction * Mathf.Min(startInset, maxInset);
			end -= direction * Mathf.Min(endInset, maxInset);
		}

		bool geometryChanged =
			Vector2.SqrMagnitude(journeyWispStart - start) > 0.0001f ||
			Vector2.SqrMagnitude(journeyWispEnd - end) > 0.0001f;
		journeyWispStart = start;
		journeyWispEnd = end;
		if (activeWispWindowState.isPrepared)
		{
			activeWispWindowState.startEndpoint = start;
			activeWispWindowState.endEndpoint = end;
		}

		if (geometryChanged)
		{
			InvalidateApproachCueStateForLayoutChange(preservePreparedWindows: true);
		}
	}

	private void UpdateJourneyGuidance()
	{
		bool ShouldHardHideGuidanceVisuals()
		{
			return wispActive ||
			       (currentWispPath != null && currentWispPath.Count > 0) ||
			       (wispIndicator != null && wispIndicator.gameObject.activeInHierarchy) ||
			       (wispIndicatorDisc != null && wispIndicatorDisc.gameObject.activeInHierarchy) ||
			       (wispIndicatorOutlineDisc != null && wispIndicatorOutlineDisc.gameObject.activeInHierarchy) ||
			       (wispFollowRing != null && wispFollowRing.gameObject.activeInHierarchy) ||
			       (wispTargetApproachRingDisc != null && wispTargetApproachRingDisc.gameObject.activeInHierarchy) ||
			       (wispPathPolyline != null && wispPathPolyline.gameObject.activeInHierarchy) ||
			       (wispPathUnderlayPolyline != null && wispPathUnderlayPolyline.gameObject.activeInHierarchy);
		}

		void HideGuidanceVisualsIfNeeded()
		{
			if (ShouldHardHideGuidanceVisuals())
			{
				HideWispGuidanceVisualsImmediate();
			}
			else
			{
				SetWispPathVisible(false);
			}
		}

		if (!enableJourneyGuidance || !journeyShowWispWhileIdle)
		{
			HideGuidanceVisualsIfNeeded();
			return;
		}

		if (SuppressJourneyGuidance)
		{
			if (journeySuggestedElement != null)
			{
				ClearJourneyGuidance();
			}

			HideGuidanceVisualsIfNeeded();
			return;
		}

		if (!equationAtTop || isBubbleAnimating || currentState == null || currentState.IsSolved())
		{
			if (journeySuggestedElement != null)
			{
				ClearJourneyGuidance();
			}

			HideGuidanceVisualsIfNeeded();
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

		if (journeyNeedsRefresh || journeySuggestedElement == null || journeySuggestedDropZone == null)
		{
			if (TrySelectJourneySuggestedElement(out EquationBubbleElement suggested))
			{
				ApplyJourneySuggestion(suggested);
			}
			else
			{
				ClearJourneyGuidance();
				return;
			}
		}

		RefreshJourneyGuidanceModeForPair(journeySuggestedElement, journeySuggestedDropZone, recordWindowExposure: false);
		bool shouldShowIdlePreviewPath = (pathwayAppearsWithHitZone || tutorialGuidanceVisualOverride) && ShouldShowIdleJourneyPreviewPathBody();
		if (shouldShowIdlePreviewPath && journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			bool needsPreviewRefresh = NeedsIdleJourneyPreviewRebuild();
			if (needsPreviewRefresh)
			{
				RefreshIdleJourneyPreviewForCurrentGeometry();
			}
			return;
		}

		if (!wispActive && currentDraggingElement == null)
		{
			ClearWispPathVisuals();
			SetWispPathVisible(false);
			HideWispMotionVisualsForStaticPreview();
		}
	}
}
