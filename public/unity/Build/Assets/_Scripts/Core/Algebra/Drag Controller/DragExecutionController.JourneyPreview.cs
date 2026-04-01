using UnityEngine;

public partial class DragExecutionController
{
	private bool BeginHitZoneWindowForDragIfReady(EquationBubbleElement source, EquationBubbleElement dropZone)
	{
		if (source == null || dropZone == null)
		{
			return false;
		}

		bool preservePreviewPathVariant =
			lockPathPerHitZoneWindow &&
			source == journeySuggestedElement &&
			dropZone == journeySuggestedDropZone &&
			(
				(currentWispPath != null && currentWispPath.Count >= 2) ||
				hasLockedWindowPathStyle ||
				hasLockedWindowEquationPathHemisphere);

		SetJourneyWispEndpointsForPair(source, dropZone);
		RefreshJourneyGuidanceModeForPair(source, dropZone, recordWindowExposure: true);
		CaptureJourneyGuidanceModeForCurrentDrag();
		return BeginHitZoneWindowInternal(
			requireIdleJourneyGate: false,
			allowRestartIfActive: true,
			bypassCooldown: true,
			preserveLockedPathVariant: preservePreviewPathVariant,
			allowBuildDuringDrag: true);
	}

	private bool CanBuildHitZoneWindow(bool allowDuringDrag = false)
	{
		if (!equationAtTop || currentState == null || currentState.IsSolved())
		{
			return false;
		}

		bool dragMayBypassAnimationGate = allowDuringDrag && currentDraggingElement != null;
		if (isBubbleAnimating && !dragMayBypassAnimationGate)
		{
			return false;
		}

		return true;
	}

	private void ConfigureLockedWispPathWindowState(bool preserveLockedPathVariant)
	{
		if (lockPathPerHitZoneWindow)
		{
			bool reuseExistingLock = preserveLockedPathVariant && hasLockedWindowPathStyle;
			if (reuseExistingLock)
			{
				SyncLegacyWindowLockStateFromPreparedWindow();
			}

			if (!reuseExistingLock)
			{
				lockedWindowPathStyle = PickWispPathStyle();
				hasLockedWindowPathStyle = true;
				hasLockedWindowEquationPathHemisphere = false;
				lockedWindowEquationPathHemisphere = EquationPathHemisphere.Neutral;
				hasLockedWindowTemplateMode = false;
				lockedWindowTemplateMode = WispUniformTemplateMode.Off;
				ClearLockedWispPathUnitVariant();
				if (ShouldForceCanonicalPathForPlaceholderArcSprites())
				{
					lockedPlaceholderVariantRepeatIndex = currentStepDragCount;
				}
			}

			return;
		}

		hasLockedWindowPathStyle = false;
		hasLockedWindowEquationPathHemisphere = false;
		lockedWindowEquationPathHemisphere = EquationPathHemisphere.Neutral;
		hasLockedWindowTemplateMode = false;
		lockedWindowTemplateMode = WispUniformTemplateMode.Off;
		ClearLockedWispPathUnitVariant();
	}

	private void BeginIdleJourneyPreviewInternal(bool bypassCooldown, bool preserveLockedPathVariant)
	{
		if (!enableJourneyGuidance || !journeyShowWispWhileIdle)
		{
			return;
		}

		if (!CanBuildHitZoneWindow())
		{
			return;
		}

		if (journeySuggestedElement == null || journeySuggestedDropZone == null)
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

		// Don't stomp an active drag/tutorial timing window.
		if (wispCoroutine != null && wispActive)
		{
			return;
		}

		if (!bypassCooldown && Time.unscaledTime - lastPathBuildRealtime < pathRebuildCooldown)
		{
			return;
		}

		// Recompute live endpoints for idle preview after layout settles.
		SetJourneyWispEndpointsForPair(journeySuggestedElement, journeySuggestedDropZone);

		lastPathBuildRealtime = Time.unscaledTime;

		// Idle preview must never contribute timing context or beat scheduling.
		wispActive = false;
		wispTimingPrepared = false;
		wispHasTimingContext = false;
		wispLateHoldGraceUntilSongTime = double.NegativeInfinity;
		hasActiveDragBeatPayload = false;
		wispBeatEventPulseCounter = 0;
		ResetWispSongClockFallbackState();
		ResetTargetApproachCueState();
		ResetActiveDragCueState();
		ResetWispWindowState();

		ConfigureLockedWispPathWindowState(preserveLockedPathVariant);
		WispPathStyle style = hasLockedWindowPathStyle ? lockedWindowPathStyle : PickWispPathStyle();
		PrepareEquationPlacementForWispWindow(style);

		if ((pathwayAppearsWithHitZone || tutorialGuidanceVisualOverride) && ShouldShowIdleJourneyPreviewPathBody())
		{
			bool builtPath = ShowWispPath(journeyWispStart, journeyWispEnd, style, animateSpawnVisuals: false);
			SetWispPathVisible(builtPath);
			if (builtPath)
			{
				HideWispMotionVisualsForStaticPreview();
				return;
			}
		}

		ClearWispPathVisuals();
		SetWispPathVisible(false);
		HideWispMotionVisualsForStaticPreview();
	}

	private bool BeginHitZoneWindowInternal(bool requireIdleJourneyGate, bool allowRestartIfActive, bool bypassCooldown, bool preserveLockedPathVariant = false, bool allowBuildDuringDrag = false)
	{
		if (requireIdleJourneyGate && (!enableJourneyGuidance || !journeyShowWispWhileIdle))
		{
			return false;
		}

		if (!CanBuildHitZoneWindow(allowBuildDuringDrag))
		{
			return false;
		}

		if (requireIdleJourneyGate && (journeySuggestedElement == null || journeySuggestedDropZone == null))
		{
			return false;
		}

		// Idle suggestions can be selected before the equation row finishes settling.
		// Recompute live endpoints right before building the path so placeholder sprites
		// don't start in a bad position and only "fix themselves" after drag begins.
		if (requireIdleJourneyGate && journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			SetJourneyWispEndpointsForPair(journeySuggestedElement, journeySuggestedDropZone);
		}

		// Avoid unnecessary restarts while idle; drag-start can force a rebuild to recover visibility.
		if (!allowRestartIfActive && wispCoroutine != null && wispActive)
		{
			return false;
		}

		if (!bypassCooldown && Time.unscaledTime - lastPathBuildRealtime < pathRebuildCooldown)
		{
			return false;
		}

		lastPathBuildRealtime = Time.unscaledTime;
		PrepareWispTiming();
		ResetTargetApproachCueState();
		ResetActiveDragCueState();
		ConfigureLockedWispPathWindowState(preserveLockedPathVariant);

		WispPathStyle style = hasLockedWindowPathStyle ? lockedWindowPathStyle : PickWispPathStyle();
		PrepareEquationPlacementForWispWindow(style);

		if (pathwayAppearsWithHitZone || currentDraggingElement != null || tutorialGuidanceVisualOverride)
		{
			bool builtPath = ShowWispPath(journeyWispStart, journeyWispEnd, style);
			SetWispPathVisible(builtPath);
			if (!builtPath)
			{
				ClearWispPathVisuals();
				return false;
			}
		}

		StartWispAnimation();
		return true;
	}

	private void BeginIdleJourneyPreviewIfReady()
	{
		bool preserveLockedPathVariant =
			lockPathPerHitZoneWindow &&
			hasLockedWindowPathStyle &&
			currentWispPath != null &&
			currentWispPath.Count >= 2;

		// Placeholder mode should be stable within a single repeat attempt, but allowed to vary
		// across repeats so the player sees up/down variation.
		if (preserveLockedPathVariant && ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			if (lockedPlaceholderVariantRepeatIndex != currentStepDragCount)
			{
				preserveLockedPathVariant = false;
			}
		}

		BeginIdleJourneyPreviewInternal(bypassCooldown: false, preserveLockedPathVariant: preserveLockedPathVariant);
	}

	private bool NeedsIdleJourneyPreviewRebuild()
	{
		if (!enableJourneyGuidance || !journeyShowWispWhileIdle)
		{
			return false;
		}

		if (currentDraggingElement != null || wispActive)
		{
			return false;
		}

		if (journeySuggestedElement == null || journeySuggestedDropZone == null)
		{
			return false;
		}

		if (currentWispPath == null || currentWispPath.Count < 2)
		{
			return true;
		}

		if (!activeWispWindowState.isPrepared || !activeWispWindowState.hasResolvedPathState)
		{
			return true;
		}

		return activeWispWindowState.lastResolvedPathVersion != approachCueGeometryVersion;
	}

	private void RefreshIdleJourneyPreviewForCurrentGeometry()
	{
		bool geometryStale =
			!activeWispWindowState.isPrepared ||
			!activeWispWindowState.hasResolvedPathState ||
			activeWispWindowState.lastResolvedPathVersion != approachCueGeometryVersion;
		BeginIdleJourneyPreviewInternal(bypassCooldown: true, preserveLockedPathVariant: !geometryStale);
		if (!NeedsIdleJourneyPreviewRebuild())
		{
			return;
		}

		// Geometry changed again before we were allowed to rebuild. Hide the stale path rather
		// than leaving a visibly wrong preview on screen until the next interaction.
		ClearWispPathVisuals();
		SetWispPathVisible(false);
		HideWispMotionVisualsForStaticPreview();
	}
}
