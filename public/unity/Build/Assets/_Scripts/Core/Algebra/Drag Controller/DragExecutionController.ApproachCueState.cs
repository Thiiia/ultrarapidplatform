using System;
using UnityEngine;

public partial class DragExecutionController
{
	private enum ApproachCueKind
	{
		None = 0,
		SourceBubble = 1,
		MovingTarget = 2,
		ActiveDrag = 3,
	}

	private enum ApproachCueSemantic
	{
		None = 0,
		NoteHead = 1,
		TravelBody = 2,
		DragFeedback = 3,
		SustainTail = 4,
	}

	[Serializable]
	private struct ApproachCueState
	{
		public ApproachCueKind kind;
		public ApproachCueSemantic semantic;
		public EquationBubbleElement owner;
		public int ownerId;
		public int targetIndex;
		public int windowId;
		public int lastResolvedPathVersion;
		public double startSongTime;
		public double endSongTime;
		public double lastEvaluatedSongTime;
		public float spawnRealtime;
		public float progress01;
		public bool isPrepared;
		public bool isVisible;
		public string timingSource;

		public bool MatchesOwner(EquationBubbleElement element)
		{
			return owner == element && ownerId == GetOwnerId(element);
		}

		private static int GetOwnerId(EquationBubbleElement element)
		{
			return element != null ? element.GetInstanceID() : 0;
		}
	}

	[Serializable]
	private struct WispWindowState
	{
		public int windowId;
		public WispPathStyle pathStyle;
		public EquationPathHemisphere pathHemisphere;
		public WispUniformTemplateMode templateMode;
		public WispPathUnitBucket pathUnitBucket;
		public bool pathUnitFlipX;
		public bool pathUnitFlipY;
		public bool hasResolvedPathState;
		public Vector2 startEndpoint;
		public Vector2 endEndpoint;
		public double headSongTime;
		public double bodyEndSongTime;
		public double tailSongTime;
		public bool isLockedForWindow;
		public bool isPrepared;
		public int lastResolvedPathVersion;
	}

	[Serializable]
	private struct EquationPlacementState
	{
		public EquationPathHemisphere activeHemisphere;
		public EquationPathHemisphere lockedHemisphere;
		public Vector2 rowOffsetApplied;
		public Rect rowAnchorBounds;
		public Rect lastSafeRect;
		public Rect lastReferenceHudBounds;
		public bool hasRowAnchorBounds;
		public bool hasSafeRect;
		public bool hasReferenceHudBounds;
		public int lastResolvedPathVersion;
	}

	[Serializable]
	private struct ApproachCueDebugSnapshot
	{
		public string sourceCue;
		public string targetCue;
		public string dragCue;
		public string window;
		public string placement;

		public override string ToString()
		{
			return $"{sourceCue} | {targetCue} | {dragCue} | {window} | {placement}";
		}
	}

	private ApproachCueState sourceApproachCueState;
	private ApproachCueState targetApproachCueState;
	private ApproachCueState activeDragCueState;
	private WispWindowState activeWispWindowState;
	private EquationPlacementState equationPlacementState;
	private int approachCueGeometryVersion = 1;
	private int nextWispWindowId = 1;

	private static int GetApproachCueOwnerId(EquationBubbleElement owner)
	{
		return owner != null ? owner.GetInstanceID() : 0;
	}

	private static void ResetApproachCueState(ref ApproachCueState state, ApproachCueKind kind, ApproachCueSemantic semantic)
	{
		state = new ApproachCueState
		{
			kind = kind,
			semantic = semantic,
			targetIndex = -1,
			windowId = -1,
			lastResolvedPathVersion = -1,
			timingSource = string.Empty,
		};
	}

	private void ResetSourceApproachCueState()
	{
		ResetApproachCueState(ref sourceApproachCueState, ApproachCueKind.SourceBubble, ApproachCueSemantic.NoteHead);
	}

	private void ResetTargetApproachCueState()
	{
		ResetApproachCueState(ref targetApproachCueState, ApproachCueKind.MovingTarget, ApproachCueSemantic.TravelBody);
	}

	private void ResetActiveDragCueState()
	{
		ResetApproachCueState(ref activeDragCueState, ApproachCueKind.ActiveDrag, ApproachCueSemantic.DragFeedback);
	}

	private void ResetWispWindowState()
	{
		activeWispWindowState = new WispWindowState
		{
			windowId = -1,
			pathStyle = WispPathStyle.ArcUp,
			pathHemisphere = EquationPathHemisphere.Neutral,
			templateMode = WispUniformTemplateMode.Off,
			pathUnitBucket = WispPathUnitBucket.None,
			lastResolvedPathVersion = -1,
		};
	}

	private void ResetEquationPlacementState()
	{
		equationPlacementState = new EquationPlacementState
		{
			activeHemisphere = EquationPathHemisphere.Neutral,
			lockedHemisphere = EquationPathHemisphere.Neutral,
			rowOffsetApplied = Vector2.zero,
			lastResolvedPathVersion = -1,
		};
	}

	private void ResetApproachCueRuntimeState(bool clearWindowLock)
	{
		ResetSourceApproachCueState();
		ResetTargetApproachCueState();
		ResetActiveDragCueState();
		ResetWispWindowState();
		ResetEquationPlacementState();
		if (clearWindowLock)
		{
			ResetWispWindowLockState();
		}
	}

	private void PrepareApproachCueWindow(
		ref ApproachCueState state,
		ApproachCueKind kind,
		EquationBubbleElement owner,
		ApproachCueSemantic semantic,
		double startSongTime,
		double endSongTime,
		int targetIndex,
		int windowId,
		string timingSource)
	{
		state.kind = kind;
		state.semantic = semantic;
		state.owner = owner;
		state.ownerId = GetApproachCueOwnerId(owner);
		state.startSongTime = startSongTime;
		state.endSongTime = endSongTime;
		state.targetIndex = targetIndex;
		state.windowId = windowId;
		state.spawnRealtime = Time.unscaledTime;
		state.progress01 = 0f;
		state.lastEvaluatedSongTime = startSongTime;
		state.isPrepared = true;
		state.isVisible = false;
		state.lastResolvedPathVersion = approachCueGeometryVersion;
		state.timingSource = timingSource ?? string.Empty;
	}

	private void RebindApproachCueOwner(ref ApproachCueState state, EquationBubbleElement owner)
	{
		state.owner = owner;
		state.ownerId = GetApproachCueOwnerId(owner);
		state.lastResolvedPathVersion = approachCueGeometryVersion;
	}

	private bool UpdateApproachCueProgressFromSongTime(ref ApproachCueState state, double nowSongTime, out float progress01)
	{
		progress01 = 0f;
		if (!state.isPrepared)
		{
			return false;
		}

		double duration = Math.Max(0.0001d, state.endSongTime - state.startSongTime);
		state.lastEvaluatedSongTime = nowSongTime;
		state.progress01 = Mathf.Clamp01((float)((nowSongTime - state.startSongTime) / duration));
		state.lastResolvedPathVersion = approachCueGeometryVersion;
		progress01 = state.progress01;
		return true;
	}

	private void SetApproachCueProgress(ref ApproachCueState state, float progress01)
	{
		if (!state.isPrepared)
		{
			return;
		}

		state.progress01 = Mathf.Clamp01(progress01);
		state.lastEvaluatedSongTime = NowSongTime();
		state.lastResolvedPathVersion = approachCueGeometryVersion;
	}

	private void SetApproachCueVisibility(ref ApproachCueState state, bool visible)
	{
		if (!state.isPrepared && visible)
		{
			return;
		}

		state.isVisible = visible;
		state.lastResolvedPathVersion = approachCueGeometryVersion;
	}

	private void InvalidateApproachCueStateForLayoutChange(bool preservePreparedWindows)
	{
		approachCueGeometryVersion = Math.Max(1, approachCueGeometryVersion + 1);
		if (!preservePreparedWindows)
		{
			ResetSourceApproachCueState();
			ResetTargetApproachCueState();
			ResetActiveDragCueState();
			ResetWispWindowState();
			ResetEquationPlacementState();
			return;
		}

		TouchApproachCueGeometry(ref sourceApproachCueState);
		TouchApproachCueGeometry(ref targetApproachCueState);
		TouchApproachCueGeometry(ref activeDragCueState);
		if (activeWispWindowState.isPrepared)
		{
			activeWispWindowState.hasResolvedPathState = false;
			activeWispWindowState.lastResolvedPathVersion = -1;
		}
		if (equationPlacementState.lastResolvedPathVersion >= 0)
		{
			equationPlacementState.lastResolvedPathVersion = -1;
		}
	}

	private void TouchApproachCueGeometry(ref ApproachCueState state)
	{
		if (!state.isPrepared)
		{
			return;
		}

		state.lastResolvedPathVersion = approachCueGeometryVersion;
	}

	private bool HasCurrentResolvedWispWindowState()
	{
		return activeWispWindowState.isPrepared &&
			activeWispWindowState.isLockedForWindow &&
			activeWispWindowState.hasResolvedPathState &&
			activeWispWindowState.lastResolvedPathVersion == approachCueGeometryVersion;
	}

	private bool TryGetPreparedResolvedWispWindowState(out WispWindowState state)
	{
		if (HasCurrentResolvedWispWindowState())
		{
			state = activeWispWindowState;
			return true;
		}

		state = default;
		return false;
	}

	private void SyncLegacyWindowLockStateFromPreparedWindow()
	{
		if (!TryGetPreparedResolvedWispWindowState(out WispWindowState state))
		{
			return;
		}

		lockedWindowPathStyle = state.pathStyle;
		hasLockedWindowPathStyle = true;
		lockedWindowEquationPathHemisphere = state.pathHemisphere;
		hasLockedWindowEquationPathHemisphere = true;
		lockedWindowTemplateMode = state.templateMode;
		hasLockedWindowTemplateMode = true;

		if (state.pathUnitBucket != WispPathUnitBucket.None)
		{
			lockedWindowPathUnitBucket = state.pathUnitBucket;
			lockedWindowPathUnitFlipX = state.pathUnitFlipX;
			lockedWindowPathUnitFlipY = state.pathUnitFlipY;
			hasLockedWindowPathUnitVariant = true;
			return;
		}

		ClearLockedWispPathUnitVariant();
	}

	private void PrepareWispWindowState(WispPathStyle style, EquationPathHemisphere hemisphere)
	{
		activeWispWindowState.windowId = nextWispWindowId++;
		activeWispWindowState.pathStyle = style;
		activeWispWindowState.pathHemisphere = hemisphere;
		activeWispWindowState.templateMode = hasLockedWindowTemplateMode ? lockedWindowTemplateMode : WispUniformTemplateMode.Off;
		activeWispWindowState.pathUnitBucket = hasLockedWindowPathUnitVariant ? lockedWindowPathUnitBucket : WispPathUnitBucket.None;
		activeWispWindowState.pathUnitFlipX = hasLockedWindowPathUnitVariant && lockedWindowPathUnitFlipX;
		activeWispWindowState.pathUnitFlipY = hasLockedWindowPathUnitVariant && lockedWindowPathUnitFlipY;
		activeWispWindowState.hasResolvedPathState = false;
		activeWispWindowState.startEndpoint = journeyWispStart;
		activeWispWindowState.endEndpoint = journeyWispEnd;
		activeWispWindowState.isLockedForWindow = lockPathPerHitZoneWindow;
		activeWispWindowState.isPrepared = true;
		activeWispWindowState.lastResolvedPathVersion = approachCueGeometryVersion;

		if (wispTimingPrepared)
		{
			activeWispWindowState.headSongTime = wispStartSongTime;
			activeWispWindowState.bodyEndSongTime = wispExpectedDropSongTime;
			activeWispWindowState.tailSongTime = wispEndSongTime;
		}
		else
		{
			double now = NowSongTime();
			activeWispWindowState.headSongTime = now;
			activeWispWindowState.bodyEndSongTime = now;
			activeWispWindowState.tailSongTime = now;
		}
	}

	private void CaptureResolvedWispPathState()
	{
		if (!activeWispWindowState.isPrepared)
		{
			return;
		}

		EquationPathHemisphere resolvedHemisphere = currentWispPath != null && currentWispPath.Count >= 3
			? ClassifyEquationPathHemisphere(
				currentWispPath,
				Mathf.Max(8f, bubbleSize * 0.08f),
				biasThreshold: 0.22f)
			: activeWispWindowState.pathHemisphere;

		activeWispWindowState.pathStyle = currentWispPathStyle;
		activeWispWindowState.pathHemisphere = resolvedHemisphere;
		activeWispWindowState.templateMode = currentWispResolvedTemplateMode;
		activeWispWindowState.pathUnitBucket = currentWispPathUnitBucket;
		activeWispWindowState.pathUnitFlipX = currentWispPathUnitFlipX;
		activeWispWindowState.pathUnitFlipY = currentWispPathUnitFlipY;
		activeWispWindowState.hasResolvedPathState = true;
		activeWispWindowState.lastResolvedPathVersion = approachCueGeometryVersion;
		SyncLegacyWindowLockStateFromPreparedWindow();
	}

	private void CaptureEquationPlacementStateSnapshot()
	{
		equationPlacementState.activeHemisphere = activeEquationPathHemisphere;
		equationPlacementState.lockedHemisphere =
			hasLockedWindowEquationPathHemisphere
				? lockedWindowEquationPathHemisphere
				: EquationPathHemisphere.Neutral;
		equationPlacementState.rowOffsetApplied = equationRepeatRowOffsetApplied;
		equationPlacementState.lastResolvedPathVersion = approachCueGeometryVersion;

		if (TryGetEquationRepeatRowBounds(out Rect rowBounds, out Camera cam))
		{
			equationPlacementState.rowAnchorBounds = rowBounds;
			equationPlacementState.hasRowAnchorBounds = true;

			if (TryGetEquationRepeatSafeRect(cam, out Rect safeRect))
			{
				equationPlacementState.lastSafeRect = safeRect;
				equationPlacementState.hasSafeRect = true;
			}
			else
			{
				equationPlacementState.hasSafeRect = false;
				equationPlacementState.lastSafeRect = default;
			}

			equationPlacementState.hasReferenceHudBounds = TryGetEquationPlacementReferenceHudBounds(cam, out equationPlacementState.lastReferenceHudBounds);
		}
		else
		{
			equationPlacementState.hasRowAnchorBounds = false;
			equationPlacementState.hasSafeRect = false;
			equationPlacementState.hasReferenceHudBounds = false;
			equationPlacementState.rowAnchorBounds = default;
			equationPlacementState.lastSafeRect = default;
			equationPlacementState.lastReferenceHudBounds = default;
		}
	}

	private bool TryGetEquationPlacementReferenceHudBounds(Camera cam, out Rect bounds)
	{
		bounds = default;
		if (equationContainer == null)
		{
			return false;
		}

		if (referenceHudContainer != null &&
			referenceHudContainer.gameObject.activeInHierarchy &&
			TryGetLocalRect(referenceHudContainer, equationContainer, cam, out bounds))
		{
			return true;
		}

		if (runtimeStepPerformanceBarRoot != null &&
			runtimeStepPerformanceBarRoot.gameObject.activeInHierarchy &&
			TryGetLocalRect(runtimeStepPerformanceBarRoot, equationContainer, cam, out bounds))
		{
			return true;
		}

		return false;
	}

	private ApproachCueDebugSnapshot BuildApproachCueDebugSnapshot()
	{
		return new ApproachCueDebugSnapshot
		{
			sourceCue = DescribeApproachCueState(sourceApproachCueState),
			targetCue = DescribeApproachCueState(targetApproachCueState),
			dragCue = DescribeApproachCueState(activeDragCueState),
			window = DescribeWispWindowState(activeWispWindowState),
			placement = DescribeEquationPlacementState(equationPlacementState),
		};
	}

	private static string DescribeApproachCueState(ApproachCueState state)
	{
		if (!state.isPrepared)
		{
			return $"{state.kind}:idle";
		}

		return $"{state.kind}:{state.semantic} owner={state.ownerId} window={state.windowId} target={state.targetIndex} progress={state.progress01:F2} visible={state.isVisible} pathV={state.lastResolvedPathVersion}";
	}

	private static string DescribeWispWindowState(WispWindowState state)
	{
		if (!state.isPrepared)
		{
			return "window:idle";
		}

		return $"window#{state.windowId} style={state.pathStyle} hemi={state.pathHemisphere} template={state.templateMode} bucket={state.pathUnitBucket} resolved={state.hasResolvedPathState} start={state.startEndpoint} end={state.endEndpoint} pathV={state.lastResolvedPathVersion}";
	}

	private static string DescribeEquationPlacementState(EquationPlacementState state)
	{
		return $"placement active={state.activeHemisphere} locked={state.lockedHemisphere} offset={state.rowOffsetApplied} pathV={state.lastResolvedPathVersion}";
	}
}
