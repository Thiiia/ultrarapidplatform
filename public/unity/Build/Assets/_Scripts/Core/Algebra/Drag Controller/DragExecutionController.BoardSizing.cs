using System.Collections.Generic;
using UnityEngine;

public partial class DragExecutionController
{
	private void ApplyAutoSizing()
	{
		if (!autoSizeBubbles || equationContainer == null)
		{
			return;
		}

		if (keepBubbleSizingStablePerSession && hasStableBubbleSizing)
		{
			bubbleSize = stableBubbleSize;
			operatorSize = stableOperatorSize;
			bubbleSpacing = stableBubbleSpacing;
			return;
		}

		// Force current UI geometry so first-pass sizing does not read stale rects.
		Canvas.ForceUpdateCanvases();

		float containerHeight = ResolveAutoSizeHeight();
		float containerWidth = ResolveAutoSizeWidth();
		float ratio = Mathf.Clamp(autoSizeHeightRatio, 0.35f, 0.85f);
		float targetByHeight = containerHeight * ratio;

		float widthBudget = containerWidth * 0.78f;
		float widthUnits = EstimateEquationWidthUnits();
		float targetByWidth = widthBudget / Mathf.Max(1f, widthUnits);

		float targetSize = Mathf.Min(targetByHeight, targetByWidth);
		targetSize = Mathf.Clamp(targetSize, bubbleSizeMin, bubbleSizeMax);
		bubbleSize = targetSize;
		operatorSize = Mathf.Clamp(targetSize * operatorSizeRatio, targetSize * 0.36f, targetSize * 0.9f);
		bubbleSpacing = Mathf.Clamp(targetSize * bubbleSpacingRatio, 8f, targetSize * 0.5f);

		if (keepBubbleSizingStablePerSession)
		{
			stableBubbleSize = bubbleSize;
			stableOperatorSize = operatorSize;
			stableBubbleSpacing = bubbleSpacing;
			hasStableBubbleSizing = true;
		}
	}

	/// <summary>
	/// Returns the same bubble/operator/spacing sizing that gameplay would use for a given equation,
	/// without mutating runtime state. Used by tutorial preview so Step 1 matches in-game scale.
	/// </summary>
	public bool TryGetPreviewSizing(string equation, out float resolvedBubbleSize, out float resolvedOperatorSize, out float resolvedBubbleSpacing)
	{
		resolvedBubbleSize = bubbleSize;
		resolvedOperatorSize = operatorSize;
		resolvedBubbleSpacing = bubbleSpacing;

		if (keepBubbleSizingStablePerSession && hasStableBubbleSizing)
		{
			resolvedBubbleSize = stableBubbleSize;
			resolvedOperatorSize = stableOperatorSize;
			resolvedBubbleSpacing = stableBubbleSpacing;
			return true;
		}

		if (!autoSizeBubbles || equationContainer == null)
		{
			return false;
		}

		Canvas.ForceUpdateCanvases();

		float containerHeight = ResolveAutoSizeHeight();
		float containerWidth = ResolveAutoSizeWidth();
		float ratio = Mathf.Clamp(autoSizeHeightRatio, 0.35f, 0.85f);
		float targetByHeight = containerHeight * ratio;
		float widthBudget = containerWidth * 0.78f;
		float widthUnits = EstimateEquationWidthUnits(equation);
		float targetByWidth = widthBudget / Mathf.Max(1f, widthUnits);

		float targetSize = Mathf.Min(targetByHeight, targetByWidth);
		targetSize = Mathf.Clamp(targetSize, bubbleSizeMin, bubbleSizeMax);

		resolvedBubbleSize = targetSize;
		resolvedOperatorSize = Mathf.Clamp(targetSize * operatorSizeRatio, targetSize * 0.36f, targetSize * 0.9f);
		resolvedBubbleSpacing = Mathf.Clamp(targetSize * bubbleSpacingRatio, 8f, targetSize * 0.5f);
		return true;
	}

	private float ResolveAutoSizeHeight()
	{
		float containerHeight = equationContainer != null ? equationContainer.rect.height : 0f;
		float fallbackHeight = 0f;
		if (dragCanvas != null)
		{
			fallbackHeight = Mathf.Max(fallbackHeight, dragCanvas.rect.height);
		}

		if (parentCanvas != null)
		{
			RectTransform canvasRect = parentCanvas.transform as RectTransform;
			if (canvasRect != null)
			{
				fallbackHeight = Mathf.Max(fallbackHeight, canvasRect.rect.height);
			}
		}

		if (fallbackHeight > 0f)
		{
			containerHeight = Mathf.Max(containerHeight, fallbackHeight);
		}

		if (containerHeight <= 0f)
		{
			containerHeight = Mathf.Max(1f, Screen.height);
		}

		return containerHeight;
	}

	private float ResolveAutoSizeWidth()
	{
		float containerWidth = equationContainer != null ? equationContainer.rect.width : 0f;
		float fallbackWidth = 0f;
		if (dragCanvas != null)
		{
			fallbackWidth = Mathf.Max(fallbackWidth, dragCanvas.rect.width);
		}

		if (parentCanvas != null)
		{
			RectTransform canvasRect = parentCanvas.transform as RectTransform;
			if (canvasRect != null)
			{
				fallbackWidth = Mathf.Max(fallbackWidth, canvasRect.rect.width);
			}
		}

		if (fallbackWidth > 0f)
		{
			containerWidth = Mathf.Max(containerWidth, fallbackWidth);
		}

		if (containerWidth <= 0f)
		{
			containerWidth = Mathf.Max(1f, Screen.width);
		}

		return containerWidth;
	}

	private float EstimateEquationWidthUnits()
	{
		string equation = currentState != null ? FormatEquation(currentState) : string.Empty;
		return EstimateEquationWidthUnits(equation);
	}

	private float EstimateEquationWidthUnits(string equation)
	{
		List<TokenInfo> tokens = TokenizeEquation(equation);
		if (tokens == null || tokens.Count == 0)
		{
			return 7.5f;
		}

		float units = 0f;
		float operatorRatio = Mathf.Clamp(operatorSizeRatio, 0.3f, 1f);
		float variableRatio = variableHasBubble ? Mathf.Clamp(variableBubbleScale, 0.7f, 1.2f) : operatorRatio;
		float spacingUnits = Mathf.Max(0f, bubbleSpacingRatio);
		float termSpacingUnits = spacingUnits * Mathf.Clamp(termAdjacencySpacingRatio, 0.05f, 1f);
		float digitScale = Mathf.Clamp(digitBubbleScale, 0.7f, 1f);
		float innerRatio = Mathf.Clamp(doubleDigitInnerSpacingRatio, 0f, 0.5f);

		for (int i = 0; i < tokens.Count; i++)
		{
			TokenInfo token = tokens[i];
			if (token.isOperator)
			{
				units += operatorRatio;
			}
			else if (token.isVariable)
			{
				units += variableRatio;
			}
			else if (ShouldSplitMultiDigit(token))
			{
				int count = Mathf.Max(2, (token.text ?? string.Empty).Trim().Length);
				units += (count * digitScale) + ((count - 1) * digitScale * innerRatio);
			}
			else
			{
				units += 1f;
			}

			if (i < tokens.Count - 1)
			{
				bool coefficientPair = token.isCoefficient && tokens[i + 1].isVariable;
				units += coefficientPair ? termSpacingUnits : spacingUnits;
			}
		}

		return Mathf.Max(1f, units);
	}

	private void CacheAutoSizeLayoutState()
	{
		lastAutoSizeScreenWidth = Screen.width;
		lastAutoSizeScreenHeight = Screen.height;
		lastAutoSizeCanvasSize = dragCanvas != null ? dragCanvas.rect.size : Vector2.zero;
	}

	private bool HasAutoSizeLayoutChanged()
	{
		Vector2 canvasSize = dragCanvas != null ? dragCanvas.rect.size : Vector2.zero;
		bool screenChanged = Screen.width != lastAutoSizeScreenWidth || Screen.height != lastAutoSizeScreenHeight;
		bool canvasChanged = Vector2.Distance(canvasSize, lastAutoSizeCanvasSize) > 0.5f;
		return screenChanged || canvasChanged;
	}

	private void TryRefreshAutoSizedLayout()
	{
		if (!autoSizeBubbles || !isBubbleInitialized || currentState == null)
		{
			return;
		}

		if (keepBubbleSizingStablePerSession && hasStableBubbleSizing && !refreshStableSizingWhenLayoutChanges)
		{
			CacheAutoSizeLayoutState();
			return;
		}

		if (isBubbleAnimating || currentDraggingElement != null)
		{
			CacheAutoSizeLayoutState();
			return;
		}

		if (!HasAutoSizeLayoutChanged())
		{
			return;
		}

		if (Time.unscaledTime - lastAutoSizeRefreshTime < 0.12f)
		{
			return;
		}

		lastAutoSizeRefreshTime = Time.unscaledTime;
		CacheAutoSizeLayoutState();
		if (keepBubbleSizingStablePerSession && refreshStableSizingWhenLayoutChanges)
		{
			hasStableBubbleSizing = false;
		}

		RebuildBubbleLayoutForCurrentState();
	}

	private void RebuildBubbleLayoutForCurrentState()
	{
		if (currentState == null)
		{
			return;
		}

		string equation = FormatEquation(currentState);
		// Layout refresh destroys/recreates the live row, so clear any active guidance visuals
		// first or they can briefly outlive the bubbles they were targeting.
		StopWispAnimation();
		ClearWispPathVisuals();
		StopOperatorFollowing(false);
		ClearBubbleElements();
		CreateBubbleElements(equation);
		UpdateBubbleProgressBar(currentState);
		EnsureStepPerformanceBar(forceRebuild: false);
		RequestDeferredStepPerformanceAnchorRefresh(2);
		RequestJourneyGuidanceRefresh();
	}
}
