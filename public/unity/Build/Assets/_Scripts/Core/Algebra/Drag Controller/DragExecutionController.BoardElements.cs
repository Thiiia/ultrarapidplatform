using System;
using System.Collections.Generic;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using LeTai.Asset.TranslucentImage;

public partial class DragExecutionController
{
	private static bool IsAllDigits(string s)
	{
		if (string.IsNullOrWhiteSpace(s))
		{
			return false;
		}

		for (int i = 0; i < s.Length; i++)
		{
			if (!char.IsDigit(s[i]))
			{
				return false;
			}
		}

		return true;
	}

	private void RefreshBubbleDisplay()
	{
		ResetApproachCueRuntimeState(clearWindowLock: true);
		ResetEquationPathHemisphereState(clearWindowLock: true);
		ClearSourceBubbleApproachRing();

		// Prevent a one-frame duplicate checkmark when the solved row is rebuilt.
		ClearSolvedBadge();
		DestroyDragOriginGhostImmediate();
		ClearTermVisualGroups();

		foreach (EquationBubbleElement elem in bubbleElements)
		{
			if (elem != null)
			{
				elem.OnDragStarted -= HandleBubbleDragStarted;
				elem.OnDragging -= HandleBubbleDragging;
				elem.OnDragEnded -= HandleBubbleDragEnded;
				KillTweensOnTransform(elem.transform);
				elem.gameObject.SetActive(false);
				Destroy(elem.gameObject);
			}
		}
		bubbleElements.Clear();

		foreach (GameObject label in operatorLabels)
		{
			if (label != null)
			{
				KillTweensOnTransform(label.transform);
				label.SetActive(false);
				Destroy(label);
			}
		}
		operatorLabels.Clear();

		currentDropZone = null;
		leftDropZone = null;
		rightDropZone = null;

		string equation = FormatEquation(currentState);
		CreateBubbleElements(equation);

		foreach (EquationBubbleElement bubble in bubbleElements)
		{
			RectTransform rect = bubble.RectTransform;
			rect.localScale = Vector3.one * 0.8f;
			rect.DOScale(1f, 0.2f).SetEase(Ease.OutBack);
		}

		RebuildTermVisualGroups();
		RefreshJourneyGuidanceAndEquationPlacement();
	}

	public void ClearBubbleElements()
	{
		ClearEquationDragCompactionState();
		ClearJourneyGuidance();
		ClearTermVisualGroups();
		ClearSolvedBadge();
		if (lockedInEquationUI != null)
		{
			lockedInEquationUI.EndDragReaction();
		}

		DestroyDragPreview();
		DestroyDragOriginGhostImmediate();

		foreach (EquationBubbleElement elem in bubbleElements)
		{
			if (elem != null)
			{
				elem.OnDragStarted -= HandleBubbleDragStarted;
				elem.OnDragging -= HandleBubbleDragging;
				elem.OnDragEnded -= HandleBubbleDragEnded;
				KillTweensOnTransform(elem.transform);
				Destroy(elem.gameObject);
			}
		}
		bubbleElements.Clear();

		foreach (GameObject label in operatorLabels)
		{
			if (label != null)
			{
				KillTweensOnTransform(label.transform);
				Destroy(label);
			}
		}
		operatorLabels.Clear();

		if (operationSymbolObject != null)
		{
			KillTweensOnTransform(operationSymbolObject.transform);
			Destroy(operationSymbolObject);
			operationSymbolObject = null;
		}

		currentDropZone = null;
		leftDropZone = null;
		rightDropZone = null;
		currentDraggingElement = null;
		isBubbleInitialized = false;
		equationAtTop = false;
		ResetApproachCueRuntimeState(clearWindowLock: true);
		ClearSourceBubbleApproachRing();
		ResetEquationPathHemisphereState(clearWindowLock: true);
	}

	private bool ShouldSplitMultiDigit(TokenInfo token)
	{
		if (multiDigitRenderMode != MultiDigitRenderMode.SplitDigits)
		{
			return false;
		}

		if (token.isOperator || token.isVariable)
		{
			return false;
		}

		if (token.isCoefficient)
		{
			return false;
		}

		string s = (token.text ?? string.Empty).Trim();
		return s.Length >= 2 && IsAllDigits(s);
	}

	private float GetTokenVisualWidth(TokenInfo token)
	{
		if (token.isOperator)
		{
			return operatorSize;
		}

		if (token.isVariable)
		{
			return variableHasBubble ? (bubbleSize * variableBubbleScale) : operatorSize;
		}

		if (ShouldSplitMultiDigit(token))
		{
			string s = (token.text ?? string.Empty).Trim();
			int n = Mathf.Max(2, s.Length);
			float d = bubbleSize * Mathf.Clamp(digitBubbleScale, 0.7f, 1f);
			float inner = Mathf.Max(0f, d * doubleDigitInnerSpacingRatio);
			return (d * n) + (inner * (n - 1));
		}

		return bubbleSize;
	}

	private float GetTokenLogicalWidth(TokenInfo token)
	{
		if (token.isOperator)
		{
			return operatorSize;
		}

		if (token.isVariable)
		{
			return variableHasBubble ? (bubbleSize * variableBubbleScale) : operatorSize;
		}

		return bubbleSize;
	}

	private Vector2 GetTokenRectSize(TokenInfo token)
	{
		if (token.isVariable)
		{
			float s = variableHasBubble ? (bubbleSize * variableBubbleScale) : operatorSize;
			return new Vector2(s, s);
		}

		if (ShouldSplitMultiDigit(token))
		{
			string s = (token.text ?? string.Empty).Trim();
			int n = Mathf.Max(2, s.Length);
			float d = bubbleSize * Mathf.Clamp(digitBubbleScale, 0.7f, 1f);
			float inner = Mathf.Max(0f, d * doubleDigitInnerSpacingRatio);
			return new Vector2((d * n) + (inner * (n - 1)), bubbleSize);
		}

		return new Vector2(bubbleSize, bubbleSize);
	}

	private float GetSpacingAfterToken(List<TokenInfo> tokens, int index)
	{
		if (tokens == null || index < 0 || index >= tokens.Count - 1)
		{
			return 0f;
		}

		TokenInfo a = tokens[index];
		TokenInfo b = tokens[index + 1];
		if (a.isCoefficient && b.isVariable)
		{
			return bubbleSpacing * Mathf.Clamp(termAdjacencySpacingRatio, 0.05f, 1f);
		}

		return bubbleSpacing;
	}

	private EquationBubbleElement CreateBubbleElement(TokenInfo token, float xPos, int side, float logicalCenterX)
	{
		GameObject bubbleObj;

		if (bubbleElementPrefab != null)
		{
			bubbleObj = Instantiate(bubbleElementPrefab, equationContainer);
		}
		else
		{
			bubbleObj = new GameObject($"Bubble_{token.text}", typeof(RectTransform), typeof(CanvasGroup));
			bubbleObj.transform.SetParent(equationContainer, false);
			bubbleObj.AddComponent<EquationBubbleElement>();
		}

		EquationBubbleElement bubble = bubbleObj.GetComponent<EquationBubbleElement>();
		if (bubble == null)
		{
			bubble = bubbleObj.AddComponent<EquationBubbleElement>();
		}

		BubbleElementType elementType;
		bool isDraggable;

		// "-x" may be represented as coefficient token "x" with numericValue -1.
		bool isCoefficientXGlyph = token.isCoefficient &&
			string.Equals((token.text ?? string.Empty).Trim(), "x", StringComparison.OrdinalIgnoreCase);

		if (token.isVariable || isCoefficientXGlyph)
		{
			elementType = BubbleElementType.Variable;
			isDraggable = isCoefficientXGlyph && token.numericValue == -1;
		}
		else if (token.isCoefficient)
		{
			elementType = BubbleElementType.Coefficient;
			isDraggable = true;
		}
		else
		{
			elementType = BubbleElementType.Constant;
			isDraggable = true;
		}

		bubble.Initialize(elementType, token.text, token.numericValue, side, isDraggable);

		RectTransform rect = bubble.RectTransform;
		Vector2 size = GetTokenRectSize(token);
		rect.sizeDelta = size;
		rect.anchoredPosition = new Vector2(xPos + (size.x * 0.5f), 0f);
		bubble.SetOriginalPosition(rect.anchoredPosition);
		bubble.SetLogicalPathAnchorOffset(new Vector2(logicalCenterX - rect.anchoredPosition.x, 0f));

		SetupBubbleVisuals(bubble, token);

		bubble.OnDragStarted += HandleBubbleDragStarted;
		bubble.OnDragging += HandleBubbleDragging;
		bubble.OnDragEnded += HandleBubbleDragEnded;

		CanvasGroup canvasGroup = bubble.GetComponent<CanvasGroup>();
		canvasGroup.alpha = 1f;
		rect.localScale = Vector3.one;

		return bubble;
	}

	private void CreateDropZones(float equationLeftEdgeX, float equationRightEdgeNextX, float equationLeftEdgeLogicalX, float equationRightEdgeLogicalNextX)
	{
		currentDropZone = null;
		leftDropZone = null;
		rightDropZone = null;

		float rightDropZoneLeftEdgeX = equationRightEdgeNextX + dropZoneOffset;
		float rightDropZoneLogicalCenterX = equationRightEdgeLogicalNextX + dropZoneOffset + (bubbleSize * 0.5f);
		rightDropZone = CreateDropZoneAtLeftEdge(
			rightDropZoneLeftEdgeX,
			rightDropZoneLogicalCenterX,
			side: 1,
			name: "DropZone_RHS",
			createOperationSymbol: true);

		if (enableBidirectionalDropZones)
		{
			float leftDropZoneLeftEdgeX = equationLeftEdgeX - dropZoneOffset - bubbleSize;
			float leftDropZoneLogicalCenterX = equationLeftEdgeLogicalX - dropZoneOffset - (bubbleSize * 0.5f);
			leftDropZone = CreateDropZoneAtLeftEdge(
				leftDropZoneLeftEdgeX,
				leftDropZoneLogicalCenterX,
				side: 0,
				name: "DropZone_LHS",
				createOperationSymbol: false);
		}

		currentDropZone = rightDropZone;
		ApplyDropZoneContextVisibility(immediate: true);
	}

	private EquationBubbleElement CreateDropZoneAtLeftEdge(float dropZoneLeftEdgeX, float logicalCenterX, int side, string name, bool createOperationSymbol)
	{
		GameObject dropZoneObj;
		if (bubbleElementPrefab != null)
		{
			dropZoneObj = Instantiate(bubbleElementPrefab, equationContainer);
			dropZoneObj.name = name;
		}
		else
		{
			dropZoneObj = new GameObject(name, typeof(RectTransform), typeof(CanvasGroup));
			dropZoneObj.transform.SetParent(equationContainer, false);
		}

		EquationBubbleElement dropZone = dropZoneObj.GetComponent<EquationBubbleElement>();
		if (dropZone == null)
		{
			dropZone = dropZoneObj.AddComponent<EquationBubbleElement>();
		}

		dropZone.Initialize(BubbleElementType.DropZone, string.Empty, 0, side, false);

		Transform tmp = dropZoneObj.transform.Find("Text (TMP)");
		if (tmp != null)
		{
			TextMeshProUGUI label = tmp.GetComponent<TextMeshProUGUI>();
			if (label != null)
			{
				label.text = string.Empty;
				label.raycastTarget = false;
			}
		}

		Graphic backgroundGraphic = dropZoneObj.GetComponent<Graphic>();
		if (backgroundGraphic != null)
		{
			backgroundGraphic.raycastTarget = true;
			if (circleSprite != null && !(backgroundGraphic is TranslucentImage) && backgroundGraphic is Image image && image.sprite == null)
			{
				image.sprite = circleSprite;
				image.type = Image.Type.Simple;
			}
		}

		SetDropZoneFill(dropZone, isNear: false);

		RectTransform rect = dropZoneObj.GetComponent<RectTransform>();
		rect.sizeDelta = new Vector2(bubbleSize, bubbleSize);
		rect.anchoredPosition = new Vector2(dropZoneLeftEdgeX + (bubbleSize * 0.5f), 0f);
		dropZone.SetOriginalPosition(rect.anchoredPosition);
		dropZone.SetLogicalPathAnchorOffset(new Vector2(logicalCenterX - rect.anchoredPosition.x, 0f));

		TryConfigureTranslucentCircle(dropZoneObj, rect);

		bubbleElements.Add(dropZone);

		CanvasGroup canvasGroup = dropZoneObj.GetComponent<CanvasGroup>();
		if (canvasGroup == null)
		{
			canvasGroup = dropZoneObj.AddComponent<CanvasGroup>();
		}

		canvasGroup.alpha = 1f;
		rect.localScale = Vector3.one;

		if (createOperationSymbol)
		{
			CreateOperationSymbol(dropZoneLeftEdgeX);
		}

		return dropZone;
	}

	private void CreateOperationSymbol(float dropZoneX)
	{
		if (operationSymbolObject != null)
		{
			if (operationSymbolRect != null)
			{
				operationSymbolRect.DOKill();
			}

			if (operationSymbolText != null)
			{
				operationSymbolText.DOKill();
			}

			Destroy(operationSymbolObject);
		}

		operationSymbolObject = new GameObject("OperationSymbol", typeof(RectTransform), typeof(TextMeshProUGUI));
		operationSymbolObject.transform.SetParent(equationContainer, false);

		operationSymbolRect = operationSymbolObject.GetComponent<RectTransform>();
		operationSymbolRect.sizeDelta = new Vector2(operationSymbolSize * 2f, operationSymbolSize * 2f);
		operationSymbolRect.anchoredPosition = GetOperationSymbolPositionForDropZoneCenter(dropZoneX + (bubbleSize * 0.5f));

		operationSymbolText = operationSymbolObject.GetComponent<TextMeshProUGUI>();
		ApplyEquationTextStyle(operationSymbolText);
		SetEquationOperatorText(operationSymbolText, GetDivideSymbol());
		operationSymbolText.fontSize = 80f;
		operationSymbolText.fontStyle = FontStyles.Bold;
		operationSymbolText.alignment = TextAlignmentOptions.Center;
		operationSymbolText.color = operationSymbolColor;
		operationSymbolText.raycastTarget = false;

		operationSymbolObject.SetActive(false);
	}

	private Vector2 GetOperationSymbolPositionForDropZoneCenter(float dropZoneCenterX)
	{
		float gapCenterOffset = 0.5f * (dropZoneOffset + bubbleSize);
		float x = dropZoneCenterX - gapCenterOffset;
		return new Vector2(x, operationSymbolYOffset);
	}

	private void UpdateOperationSymbolPositionFromRightDropZone(bool animate = false, float duration = 0f)
	{
		if (operationSymbolRect == null || rightDropZone == null || rightDropZone.RectTransform == null)
		{
			return;
		}

		Vector2 target = GetOperationSymbolPositionForDropZoneCenter(rightDropZone.RectTransform.anchoredPosition.x);
		operationSymbolRect.DOKill(false);
		if (animate && duration > 0.001f)
		{
			operationSymbolRect.DOAnchorPos(target, duration).SetEase(Ease.OutQuad).SetUpdate(true);
		}
		else
		{
			operationSymbolRect.anchoredPosition = target;
		}
	}

	private void ShowOperationSymbol(BubbleElementType dragType)
	{
		if (dragType != BubbleElementType.Coefficient)
		{
			HideOperationSymbol();
			return;
		}

		if (operationSymbolObject == null || operationSymbolText == null)
		{
			return;
		}

		UpdateOperationSymbolPositionFromRightDropZone();
		operationSymbolObject.SetActive(true);

		SetEquationOperatorText(operationSymbolText, GetDivideSymbol());
		operationSymbolText.color = operationSymbolColor;

		operationSymbolRect.localScale = Vector3.zero;
		operationSymbolRect.DOScale(1f, 0.2f).SetEase(Ease.OutBack);
	}

	private void HideOperationSymbol()
	{
		if (operationSymbolObject != null)
		{
			operationSymbolObject.SetActive(false);
		}
	}
}
