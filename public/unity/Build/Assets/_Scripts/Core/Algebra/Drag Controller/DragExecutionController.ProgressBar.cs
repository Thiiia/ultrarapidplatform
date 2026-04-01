using UnityEngine;
using Sirenix.OdinInspector;

public partial class DragExecutionController
{
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Locked Equation"), SerializeField, Tooltip("Keep the LockedInEquationUI text pinned to the equation at the start of the current problem instead of updating after each solve step.")]
	private bool lockedInEquationKeepInitialEquationText = true;

	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Locked Equation"), SerializeField] private float progressBarYOffset = 350f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Progress"), SerializeField] private RectTransform progressMeterContainer;

	private RectTransform referenceHudContainer;
	private LockedInEquationUI lockedInEquationUI;
	private bool lockedInEquationPinnedTextValid;
	private string lockedInEquationPinnedText = string.Empty;
	private bool useExternalLockedProgress;
	private float externalLockedProgress;
	private float externalLockedProgressSpan;

	#region Bubble System - Reference HUD

	private void UpdateProgressMeter()
	{
		// Locked/reference equation progress reflects cumulative solve progress:
		// completed solve steps plus partial progress within the current repeated-drag step.
		if (lockedInEquationUI != null)
		{
			bool equationSolved = currentState != null && currentState.IsSolved();
			float t = CalculateLockedEquationProgress01(equationSolved);
			if (useExternalLockedProgress)
			{
				t = Mathf.Clamp01(externalLockedProgress + (t * Mathf.Max(0f, externalLockedProgressSpan)));
			}

			lockedInEquationUI.SetProgress01(t, equationSolved, false);
		}

		UpdateStepPerformanceBarVisuals(forceRebuild: false);
	}

	private float CalculateLockedEquationProgress01(bool equationSolved)
	{
		if (equationSolved)
		{
			return 1f;
		}

		int totalSteps = Mathf.Max(1, stepsRequiredForEquation);
		int completedSteps = Mathf.Clamp(stepsCompletedForEquation, 0, totalSteps);
		float currentStep01 = Mathf.Clamp01(currentStepDragCount / (float)GetCurrentRequiredDragsForStep());
		return Mathf.Clamp01((completedSteps + currentStep01) / totalSteps);
	}

	private void CreateReferenceHud()
	{
		if (referenceHudContainer == null)
		{
			GameObject container = new GameObject("ReferenceHudContainer", typeof(RectTransform));
			container.transform.SetParent(progressMeterContainer, false);
			referenceHudContainer = container.GetComponent<RectTransform>();
			referenceHudContainer.anchorMin = new Vector2(0.5f, 0.5f);
			referenceHudContainer.anchorMax = new Vector2(0.5f, 0.5f);
		}

		referenceHudContainer.anchoredPosition = new Vector2(0f, progressBarYOffset);

		// LockedInEquationUI is the live algebra HUD path.
		if (lockedInEquationPrefab != null && lockedInEquationUI == null)
		{
			GameObject uiObj = Instantiate(lockedInEquationPrefab, referenceHudContainer);
			RectTransform uiRect = uiObj.GetComponent<RectTransform>();
			if (uiRect != null)
			{
				uiRect.anchorMin = new Vector2(0.5f, 0.5f);
				uiRect.anchorMax = new Vector2(0.5f, 0.5f);
				uiRect.anchoredPosition = Vector2.zero;
			}

			lockedInEquationUI = uiObj.GetComponent<LockedInEquationUI>();
			if (lockedInEquationUI == null)
			{
				lockedInEquationUI = uiObj.AddComponent<LockedInEquationUI>();
			}
			lockedInEquationUI.AutoBindIfNeeded();
		}

		// Start hidden
		referenceHudContainer.gameObject.SetActive(false);
		EnsureStepPerformanceBar(forceRebuild: true);
		RequestDeferredStepPerformanceAnchorRefresh(2);
	}

	private void UpdateBubbleProgressBar(EquationState state)
	{
		currentStepRequiredDrags = ResolveStepRequiredDragCount(state);

		if (lockedInEquationUI != null)
		{
			SyncLockedEquationSizingToGameplay(state);
			lockedInEquationUI.SetEquationString(ResolveLockedInEquationDisplayText(state));
		}

		EnsureStepPerformanceBar(forceRebuild: false);
		RequestDeferredStepPerformanceAnchorRefresh(2);
	}

	private void SyncLockedEquationSizingToGameplay(EquationState state)
	{
		if (lockedInEquationUI == null)
		{
			return;
		}

		string equation = state != null ? FormatEquation(state) : (currentState != null ? FormatEquation(currentState) : string.Empty);
		if (string.IsNullOrWhiteSpace(equation))
		{
			return;
		}

		if (TryGetPreviewSizing(equation, out float previewBubbleSize, out float previewOperatorSize, out float previewSpacing))
		{
			lockedInEquationUI.SetGameplayReferenceSizing(previewBubbleSize, previewOperatorSize, previewSpacing);
			return;
		}

		lockedInEquationUI.SetGameplayReferenceSizing(bubbleSize, operatorSize, bubbleSpacing);
	}

	#endregion
}
