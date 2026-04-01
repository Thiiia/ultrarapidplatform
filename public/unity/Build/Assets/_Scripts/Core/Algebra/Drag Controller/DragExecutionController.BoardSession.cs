using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private void KillManagedTweens()
	{
		KillTweensOnTransform(equationContainer);
		KillTweensOnTransform(referenceHudContainer);
		KillTweensOnTransform(progressMeterContainer);
		KillTweensOnTransform(trailContainer);
		KillTweensOnTransform(wispPathContainer);
		KillTweensOnTransform(dragPreviewRootRect);
		KillTweensOnTransform(operationSymbolRect);
		KillTweensOnTransform(followingOperatorRect);
	}

	private static void KillTweensOnTransform(Transform root)
	{
		if (root == null)
		{
			return;
		}

		root.DOKill(false);

		RectTransform[] rects = root.GetComponentsInChildren<RectTransform>(true);
		for (int i = 0; i < rects.Length; i++)
		{
			if (rects[i] != null)
			{
				rects[i].DOKill(false);
			}
		}

		Graphic[] graphics = root.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			if (graphics[i] != null)
			{
				graphics[i].DOKill(false);
			}
		}

		CanvasGroup[] groups = root.GetComponentsInChildren<CanvasGroup>(true);
		for (int i = 0; i < groups.Length; i++)
		{
			if (groups[i] != null)
			{
				groups[i].DOKill(false);
			}
		}

		TextMeshProUGUI[] labels = root.GetComponentsInChildren<TextMeshProUGUI>(true);
		for (int i = 0; i < labels.Length; i++)
		{
			if (labels[i] != null)
			{
				labels[i].DOKill(false);
			}
		}
	}

	#region Public API

	/// Initializes and activates the bubble drag system with an equation string.
	public void InitializeWithEquation(string equation)
	{
		// Rebuilds can happen mid-tutorial or after guided drags, so fully clear any
		// lingering wisp/timing visuals from the previous board before spawning a new one.
		SessionBootstrapService.PrepareForExternalStateInitialization(this);
		currentEquationSkillTag = EquationSkillTagUtility.InferFromEquation(equation);

		if (!SessionBootstrapService.TryCreateStateFromEquation(equation, out EquationState parsedState))
		{
			Debug.LogError($"DragExecutionController: Failed to parse equation: {equation}");
			return;
		}
		currentState = parsedState;

		CreateBubbleElements(equation);

		SessionBootstrapService.BeginSession(
			this,
			initializeChoiceSystem: true,
			debugMessage: $"DragExecutionController: Initialized bubble system with equation '{equation}'");
	}

	/// Initializes and activates the bubble drag system with an equation state.
	public void InitializeWithState(EquationState state)
	{
		// Keep state-based reinitialization on the same teardown path as string-based init
		// so stale tutorial/journey guidance visuals cannot leak across sessions.
		SessionBootstrapService.PrepareForExternalStateInitialization(this);
		currentState = state;
		string equation = !string.IsNullOrWhiteSpace(state != null ? state.rawEquation : string.Empty)
			? state.rawEquation
			: FormatEquation(state);
		currentEquationSkillTag = EquationSkillTagUtility.InferFromEquation(equation);

		CreateBubbleElements(equation);

		SessionBootstrapService.BeginSession(
			this,
			initializeChoiceSystem: true,
			debugMessage: "DragExecutionController: Initialized bubble system with state");
	}

	public void Deactivate()
	{
		isActive = false;
		currentEquationSkillTag = EquationSkillTag.Unknown;
		KillManagedTweens();
		if (deferredStepPerformanceAnchorRefreshCoroutine != null)
		{
			StopCoroutine(deferredStepPerformanceAnchorRefreshCoroutine);
			deferredStepPerformanceAnchorRefreshCoroutine = null;
		}

		ClearBubbleElements();
		StopWispAnimation();
		ClearWispPathVisuals();
		StopOperatorFollowing(false);
		ClearJourneyGuidance();
		ResetAdaptiveJourneyGuidanceSessionState(clearExposureMemory: true);
		ResetLockedInEquationPinnedText();
	}

	private void ResetLockedInEquationPinnedText()
	{
		lockedInEquationPinnedTextValid = false;
		lockedInEquationPinnedText = string.Empty;
	}

	private string ResolveLockedInEquationDisplayText(EquationState state)
	{
		string formatted = state != null ? FormatEquation(state) : string.Empty;
		if (!lockedInEquationKeepInitialEquationText)
		{
			return formatted;
		}

		if (!lockedInEquationPinnedTextValid)
		{
			lockedInEquationPinnedText = formatted;
			lockedInEquationPinnedTextValid = true;
		}

		return lockedInEquationPinnedText;
	}

	public void ResetProgress()
	{
		successCount = 0;
		stepsCompletedForEquation = 0;
		stepsRequiredForEquation = Mathf.Max(1, stepsRequiredForEquation);
		useExternalLockedProgress = false;
		currentStepDragCount = 0;
		currentStepRequiredDrags = ResolveStepRequiredDragCount(currentState);
		equationRepeatRowOffsetApplied = Vector2.zero;
		ResetCurrentStepPerformanceOutcomes();
		UpdateProgressMeter();
		OnSuccessCountChanged?.Invoke(successCount);
	}

	public void SetLockedProgress01(float baseProgress, float segmentSpan, bool pulse = false)
	{
		useExternalLockedProgress = true;
		externalLockedProgress = Mathf.Clamp01(baseProgress);
		externalLockedProgressSpan = Mathf.Clamp01(segmentSpan);

		if (lockedInEquationUI != null)
		{
			lockedInEquationUI.SetProgress01(externalLockedProgress, false, pulse);
		}
	}

	public void SetEquationSolver(LinearEquationSolver solver)
	{
		equationSolver = solver;
	}

	public void SetEquationContainer(RectTransform container)
	{
		if (container == null)
		{
			return;
		}

		if (equationContainer == container)
		{
			return;
		}

		equationContainer = container;
		equationRepeatRowOffsetApplied = Vector2.zero;

		Canvas resolvedCanvas = equationContainer.GetComponentInParent<Canvas>();
		if (resolvedCanvas != null)
		{
			parentCanvas = resolvedCanvas;
			RectTransform canvasRect = resolvedCanvas.transform as RectTransform;
			if (canvasRect != null)
			{
				dragCanvas = canvasRect;
			}

			if (resolvedCanvas.renderMode != RenderMode.ScreenSpaceOverlay && resolvedCanvas.worldCamera != null)
			{
				uiCamera = resolvedCanvas.worldCamera;
			}
		}

		if (trailContainer != null)
		{
			TrySetParentSafe(trailContainer, equationContainer, false, nameof(SetEquationContainer) + ".trailContainer");
			trailContainer.anchorMin = Vector2.zero;
			trailContainer.anchorMax = Vector2.one;
			trailContainer.sizeDelta = Vector2.zero;
			trailContainer.SetAsFirstSibling();
		}

		if (wispPathContainer != null)
		{
			TrySetParentSafe(wispPathContainer, equationContainer, false, nameof(SetEquationContainer) + ".wispPathContainer");
			wispPathContainer.anchorMin = Vector2.zero;
			wispPathContainer.anchorMax = Vector2.one;
			wispPathContainer.sizeDelta = Vector2.zero;
			EnsureWispContainerOrder();
		}

		if (dragPreviewRootRect != null)
		{
			TrySetParentSafe(dragPreviewRootRect, equationContainer, false, nameof(SetEquationContainer) + ".dragPreviewRootRect");
		}

		if (operationSymbolRect != null)
		{
			TrySetParentSafe(operationSymbolRect, equationContainer, false, nameof(SetEquationContainer) + ".operationSymbolRect");
		}

		if (followingOperatorRect != null)
		{
			TrySetParentSafe(followingOperatorRect, equationContainer, false, nameof(SetEquationContainer) + ".followingOperatorRect");
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble != null)
			{
				bubble.transform.SetParent(equationContainer, false);
			}
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject label = operatorLabels[i];
			if (label != null)
			{
				label.transform.SetParent(equationContainer, false);
			}
		}
	}

	public void SetProgressMeterContainer(RectTransform container)
	{
		if (container == null)
		{
			return;
		}

		progressMeterContainer = container;
		if (referenceHudContainer == null)
		{
			return;
		}

		if (!TrySetParentSafe(referenceHudContainer, progressMeterContainer, false, nameof(SetProgressMeterContainer) + ".referenceHudContainer"))
		{
			return;
		}
		referenceHudContainer.anchoredPosition = new Vector2(0f, progressBarYOffset);
		referenceHudContainer.SetAsLastSibling();
		EnsureStepPerformanceBar(forceRebuild: false);
		RequestDeferredStepPerformanceAnchorRefresh(2);
	}

	/// Reopens concise in-session help near the current target zone.
	public bool ShowContextualGuidanceHelp(string overrideMessage = null)
	{
		if (!isActive)
		{
			return false;
		}

		string message = string.IsNullOrWhiteSpace(overrideMessage) ? contextualGuidanceHelpMessage : overrideMessage;
		if (string.IsNullOrWhiteSpace(message))
		{
			return false;
		}

		EquationBubbleElement anchor = ResolveContextualFeedbackAnchorDropZone();
		EquationBubbleElement previousDropZone = currentDropZone;
		if (previousDropZone == null && anchor != null)
		{
			currentDropZone = anchor;
		}

		ShowContextualGuidanceFeedback(message, new Color(0.86f, 0.95f, 1f));
		ContextualHintShown?.Invoke(message);

		if (previousDropZone == null)
		{
			currentDropZone = null;
		}

		contextualGuidanceShownOnFirstDrag = true;
		contextualGuidanceMissStreak = 0;
		contextualGuidanceSuccessStreak = 0;
		return true;
	}

	EquationChoiceSystem ISessionBootstrapHost.ChoiceSystem => choiceSystem;

	EquationState ISessionBootstrapHost.CurrentState
	{
		get => currentState;
		set => currentState = value;
	}

	int ISessionBootstrapHost.CurrentStepDragCount
	{
		get => currentStepDragCount;
		set => currentStepDragCount = value;
	}

	int ISessionBootstrapHost.DragsPerStep
	{
		get => dragsPerStep;
		set => dragsPerStep = value;
	}

	EquationState ISessionBootstrapHost.StepStartState
	{
		get => stepStartState;
		set => stepStartState = value;
	}

	bool ISessionBootstrapHost.IsBubbleInitialized
	{
		get => isBubbleInitialized;
		set => isBubbleInitialized = value;
	}

	bool ISessionBootstrapHost.IsActive
	{
		get => isActive;
		set => isActive = value;
	}

	void ISessionBootstrapHost.ResolveChoiceSystem()
	{
		ResolveChoiceSystem();
	}

	void ISessionBootstrapHost.StopWispAnimation()
	{
		StopWispAnimation();
	}

	void ISessionBootstrapHost.ClearWispPathVisuals()
	{
		ClearWispPathVisuals();
	}

	void ISessionBootstrapHost.StopOperatorFollowing(bool dropAccepted)
	{
		StopOperatorFollowing(dropAccepted);
	}

	void ISessionBootstrapHost.ClearBubbleElements()
	{
		ClearBubbleElements();
	}

	void ISessionBootstrapHost.ResetLockedInEquationPinnedText()
	{
		ResetLockedInEquationPinnedText();
	}

	void ISessionBootstrapHost.ResetProgress()
	{
		ResetProgress();
	}

	void ISessionBootstrapHost.RecomputeStepProgressTargets(EquationState state)
	{
		RecomputeStepProgressTargets(state);
	}

	void ISessionBootstrapHost.StartIntroAnimation()
	{
		StartCoroutine(PlayIntroAnimation());
	}

	#endregion
}
