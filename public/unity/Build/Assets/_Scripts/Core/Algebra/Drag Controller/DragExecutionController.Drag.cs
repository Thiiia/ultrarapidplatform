using UnityEngine;

public partial class DragExecutionController
{
	private void HandleBubbleDragStarted(EquationBubbleElement element)
	{
		if (SuppressDragProcessing) return;
		currentDraggingElement = element;
		ClearSourceBubbleApproachRing();
		currentDragPeakGuidedProgress01 = 0f;
		currentDragPeakOverlapScore01 = 0f;
		overlapFeedbackActive = false;
		lastOverlapZone = WispOverlapZone.None;
		lastOverlapProximity = -1f;
		lastOverlapOutlineProgress = -1f;

		currentDropZone = GetTargetDropZoneForElement(element);

		// Keep term splitting opt-in so dragging preserves the authored row unless a scene
		// explicitly wants coefficient-variable terms to separate.
		if (splitCombinedTermsWhileDragging &&
			element.ElementType == BubbleElementType.Coefficient &&
			TryGetTermGroup(element, out TermVisualGroup termGroup))
		{
			SetTermGroupCombined(termGroup, combined: false, animate: true);
		}

		if (followOperatorDuringDrag)
		{
			// Start operator following first so the origin ghost can clone the matching equation operator.
			StartOperatorFollowing(element);
		}
		BeginDragOriginGhost(element);
		BeginEquationDragCompaction(element);

		// Start trail
		trailPoints.Clear();
		trailPoints.Add(element.OriginalPosition);
		lastTrailSamplePosition = element.OriginalPosition;
		trailCatchUpAccumulator = 0f;
		ResetDragMotionVisuals(element, element.OriginalPosition);

		// Dragging should not restart or re-roll the hit zone.
		// Drag-specific bootstrap is allowed to recover visibility even if idle guidance state is stale.
		if (currentDropZone != null)
		{
			bool startedWispWindow = BeginHitZoneWindowForDragIfReady(element, currentDropZone);
			if (!startedWispWindow)
			{
				ClearWispPathVisuals();
				SetWispPathVisible(false);
			}
		}

		// Highlight drop zone after the drag path and row placement have been resolved so transient
		// pulse scaling does not perturb the row-bounds measurement and nudge the equation.
		if (currentDropZone != null)
		{
			currentDropZone.SetAsDropTarget(true);
		}
		ApplyDropZoneContextVisibility(immediate: true);
		SetDropZonesEmphasis(true);

		ShowOperationSymbol(element.ElementType);

		if (useDragPreviewInsteadOfDropCircles)
		{
			CreateOrRefreshDragPreview(element);
			UpdateDragPreview(element, element.OriginalPosition);
		}

		UpdateLockedEquationDragReaction(element, element.OriginalPosition);
		NotifyContextualGuidanceOnDragStart();
	}

	private void HandleBubbleDragging(EquationBubbleElement element, Vector2 position)
	{
		if (SuppressDragProcessing) return;
		if (element != currentDraggingElement)
		{
			return;
		}

		// Update trail
		UpdateDragMotionVisuals(element, position);
		UpdateTrail(position);
		if (useDragPreviewInsteadOfDropCircles)
		{
			UpdateDragPreview(element, position);
		}

		if (followOperatorDuringDrag)
		{
			// Update operator position (follows the dragged element)
			UpdateOperatorFollowing(position);

			// Check if crossed the equals sign and update operator display
			CheckOperatorSignFlip(element, position);
		}

		// Check proximity to drop zone
		if (currentDropZone != null)
		{
			float distance = Vector2.Distance(position, currentDropZone.OriginalPosition);
			bool isNearDropZone = distance < dropZoneRadius * 1.5f;

			currentDropZone.SetAsDropTarget(isNearDropZone);
			SetDropZoneFill(currentDropZone, isNearDropZone);
		}

		UpdateWispOverlapFeedback(element, position);
		UpdateWispPathHeatDuringDrag(position);

		UpdateLockedEquationDragReaction(element, position);
	}

	private void HandleBubbleDragEnded(EquationBubbleElement element, Vector2 position)
	{
		if (SuppressDragProcessing) return;
		if (element != currentDraggingElement)
		{
			return;
		}

		// Check if dropped on drop zone
		DragDropResolutionOutcome dragOutcome = DragDropResolutionService.Resolve((IDragDropResolutionHost)this, element, position);
		bool droppedOnTarget = dragOutcome.droppedOnTarget;
		bool success = dragOutcome.success;
		bool operationAccepted = dragOutcome.operationAccepted;
		HitResult resolvedHit = dragOutcome.resolvedHit;
		float resolvedPoints01 = dragOutcome.resolvedPoints01;
		float resolvedSignedErrorMs = dragOutcome.resolvedSignedErrorMs;
		float resolvedPathCompletion01 = float.NaN;
		DragMissReason resolvedMissReason = dragOutcome.resolvedMissReason;

		RegisterBasicScore(resolvedHit, resolvedPoints01);
		SpawnWispOutcomeTrail(position, resolvedHit);
		RecordContextualGuidanceAttempt(resolvedHit, resolvedSignedErrorMs);
		NotifyContextualGuidanceOnDragResolved(success);

		element.ClearDragFeedback();
		overlapFeedbackActive = false;
		lastOverlapZone = WispOverlapZone.None;
		lastOverlapProximity = -1f;
		lastOverlapOutlineProgress = -1f;

		// Stop wisp animation and clear path
		StopWispAnimation();

		// On misses/off-target drops, clear the stale drag path immediately. Let idle preview rebuild
		// after the row/bubble settles so we don't show a path attached to a moving snap-back bubble.
		bool hidePathAfterDragResolve =
			!tutorialGuidanceVisualOverride &&
			(wispShowOnlyWhileDragging || resolvedHit == HitResult.Miss);
		if (hidePathAfterDragResolve)
		{
			ClearWispPathVisuals();
			SetWispPathVisible(false);
		}
		ResolveDragOriginGhostAfterDrag(pathHiddenNow: hidePathAfterDragResolve);

		// Hide operation symbol
		HideOperationSymbol();

		// Reset drop zones
		if (leftDropZone != null)
		{
			leftDropZone.SetAsDropTarget(false);
		}
		if (rightDropZone != null)
		{
			rightDropZone.SetAsDropTarget(false);
		}
		SetDropZonesEmphasis(false);

		if (useDragPreviewInsteadOfDropCircles)
		{
			DestroyDragPreview();
		}

		resolvedPathCompletion01 = ResolveCurrentDragPathCompletion01(droppedOnTarget);

		if (resolvedHit == HitResult.Miss && resolvedMissReason == DragMissReason.None)
		{
			if (!float.IsNaN(resolvedSignedErrorMs))
				resolvedMissReason = resolvedSignedErrorMs < 0f ? DragMissReason.Early : DragMissReason.Late;
			else
				resolvedMissReason = DragMissReason.OffPath;
		}

		if (resolvedHit != HitResult.Miss)
			resolvedMissReason = DragMissReason.None;

		DragAttemptTelemetry telemetry = new DragAttemptTelemetry
		{
			hitResult = resolvedHit,
			missReason = resolvedMissReason,
			droppedOnTarget = droppedOnTarget,
			success = success,
			signedErrorMs = resolvedSignedErrorMs,
			pathCompletion01 = resolvedPathCompletion01,
			peakGuidedProgress01 = Mathf.Clamp01(currentDragPeakGuidedProgress01),
			normalizedToMiss = dragOutcome.resolvedNormalizedToMiss,
			scoreContribution01 = Mathf.Clamp01(resolvedPoints01),
			journeyGuidanceMode = currentDragJourneyGuidanceMode,
			skillTag = ResolveCurrentEquationSkillTag(),
			repetitionIndex = Mathf.Max(1, currentStepDragCount + 1)
		};
		RegisterJourneyGuidanceOutcome(success, resolvedHit, resolvedMissReason);
		DragAttemptEvaluated?.Invoke(telemetry);

		// Fade out trail
		StartCoroutine(FadeOutTrail());

		if (operationAccepted)
		{
			ClearEquationDragCompactionState();
		}
		else
		{
			EndEquationDragCompaction(immediate: false);
		}

		UpdateLockedEquationDragReaction(element, position, end: true);
		ResetDragMotionVisuals(null, position);
		currentDragJourneyGuidanceKey = string.Empty;
		currentDragJourneyGuidanceMode = JourneyGuidanceMode.FullPath;
		currentDragPeakGuidedProgress01 = 0f;
		currentDragPeakOverlapScore01 = 0f;
		currentDraggingElement = null;
		ApplyDropZoneContextVisibility(immediate: true);
		RequestJourneyGuidanceRefresh();
	}

	EquationBubbleElement IBubbleDropResolutionHost.CurrentDropZone => currentDropZone;

	float IBubbleDropResolutionHost.DropAnimationDuration => dropAnimationDuration;

	float IBubbleDropResolutionHost.SnapBackDuration => snapBackDuration;

	bool IBubbleDropResolutionHost.StepPerformanceUseRawTimingResult => stepPerformanceUseRawTimingResult;

	AudioSource IBubbleDropResolutionHost.AudioSource => audioSource;

	AudioClip IBubbleDropResolutionHost.SuccessSound => successSound;

	AudioClip IBubbleDropResolutionHost.FailSound => failSound;

	bool IBubbleDropResolutionHost.IsBubbleAnimating
	{
		get => isBubbleAnimating;
		set => isBubbleAnimating = value;
	}

	void IBubbleDropResolutionHost.QueuePendingStepPerformanceOutcome(HitResult hitResult, float signedErrorMs)
	{
		QueuePendingStepPerformanceOutcome(hitResult, signedErrorMs);
	}

	void IBubbleDropResolutionHost.ApplyBubbleOperation(EquationBubbleElement element, StepOption prevalidatedOperation)
	{
		ApplyBubbleOperation(element, prevalidatedOperation);
	}

	void IBubbleDropResolutionHost.MarkDragVisualSettleWindow(float seconds)
	{
		MarkDragVisualSettleWindow(seconds);
	}

	void IBubbleDropResolutionHost.RestoreTermGroupAfterSnapBack(EquationBubbleElement element)
	{
		RestoreTermGroupAfterSnapBack(element);
	}

	void IBubbleDropResolutionHost.TryEmitAlgebraTimingImpactFxOnSuccess(HitResult hitResult)
	{
		TryEmitAlgebraTimingImpactFxOnSuccess(hitResult);
	}

	void IBubbleDropResolutionHost.TryEmitAlgebraTimingImpactFxOnMiss()
	{
		TryEmitAlgebraTimingImpactFxOnMiss();
	}

	void IBubbleDropResolutionHost.ShowFeedback(string message, Color color)
	{
		ShowFeedback(message, color);
	}

	void IBubbleDropResolutionHost.ShowFeedback(string message, Color color, HitResult hitResult, float signedErrorMs, float normalizedToMiss)
	{
		ShowFeedback(message, color, hitResult, signedErrorMs, normalizedToMiss);
	}

	float IDragDropResolutionHost.DropZoneRadius => dropZoneRadius;

	bool IDragDropResolutionHost.WispOverlapAffectsScore => wispOverlapAffectsScore;

	bool IDragDropResolutionHost.WispOverlapAffectsJudgement => wispOverlapAffectsJudgement;

	JudgementService.HitInfo IDragDropResolutionHost.EvaluateTimingDetailed(out string label, out Color color, out float score, out HitResult hitResult)
	{
		return EvaluateTimingDetailed(out label, out color, out score, out hitResult);
	}

	bool IDragDropResolutionHost.TryGetWispOverlapScore(Vector2 position, out float overlapScore)
	{
		return TryGetWispOverlapInfo(position, out _, out overlapScore, out _);
	}

	HitResult IDragDropResolutionHost.ApplyOverlapToHitResult(HitResult baseResult, float overlapScore)
	{
		return ApplyOverlapToHitResult(baseResult, overlapScore);
	}

	void IDragDropResolutionHost.ApplyHitResultFeedback(HitResult result, ref string label, ref Color color)
	{
		ApplyHitResultFeedback(result, ref label, ref color);
	}

	void IDragDropResolutionHost.UpdateWispPathHeatFromAccuracy(float quality01)
	{
		UpdateWispPathHeatFromAccuracy(quality01);
	}

	bool IDragDropResolutionHost.TryValidateBubbleOperation(EquationBubbleElement element, out StepOption operation, out bool isOptimal)
	{
		return TryValidateBubbleOperation(element, out operation, out isOptimal);
	}

	void IDragDropResolutionHost.StopOperatorFollowing(bool dropAccepted)
	{
		StopOperatorFollowing(dropAccepted);
	}

	void IDragDropResolutionHost.ResolveActiveBeatPayload(HitResult hitResult)
	{
		if (!hasActiveDragBeatPayload)
		{
			return;
		}

		GameplayEventBus.RaiseBeatResolved(activeDragBeatPayload, hitResult);
		hasActiveDragBeatPayload = false;
	}
}
