using System.Collections.Generic;

using UnityEngine;

using TMPro;
using DG.Tweening;

public partial class DragExecutionController
{
	private void UpdateLockedEquationDragReaction(EquationBubbleElement element, Vector2 currentPosition, bool end = false)
	{
		if (lockedInEquationUI == null || element == null)
		{
			return;
		}

		if (referenceHudContainer != null && !referenceHudContainer.gameObject.activeInHierarchy)
		{
			return;
		}

		if (end)
		{
			lockedInEquationUI.EndDragReaction();
			return;
		}

		int slot = GetLockedEquationSlotForElement(element, currentPosition);
		lockedInEquationUI.BeginDragReaction(slot);
		lockedInEquationUI.UpdateDragReaction(currentPosition - element.OriginalPosition);
	}

	private int GetLockedEquationSlotForElement(EquationBubbleElement element, Vector2 currentPosition)
	{
		if (element == null)
		{
			return -1;
		}

		int side = element.EquationSide;
		if (TryGetEqualsX(out float equalsX))
		{
			side = currentPosition.x > equalsX ? 1 : 0;
		}

		if (side == 1)
		{
			return 2;
		}

		return element.ElementType switch
		{
			BubbleElementType.Coefficient => 0,
			BubbleElementType.Constant => 1,
			_ => -1,
		};
	}

	private bool TryGetEqualsX(out float equalsX)
	{
		equalsX = 0f;

		if (operatorLabels == null || operatorLabels.Count == 0)
		{
			return false;
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject label = operatorLabels[i];
			if (label == null)
			{
				continue;
			}

			TextMeshProUGUI text = label.GetComponent<TextMeshProUGUI>();
			if (text != null && text.text == "=")
			{
				RectTransform rt = label.GetComponent<RectTransform>();
				if (rt != null)
				{
					equalsX = rt.anchoredPosition.x;
					return true;
				}
			}
		}

		return false;
	}

	private void ClearEquationDragCompactionState()
	{
		dragEquationCompactionActive = false;
		dragEquationCompactionBubbles.Clear();
		dragEquationCompactionBubblePositions.Clear();
		dragEquationCompactionOperatorRects.Clear();
		dragEquationCompactionOperatorPositions.Clear();
	}

	private bool IsEquationRowCompactionRestoreActive()
	{
		float until = Mathf.Max(dragEquationCompactionRestoreUntilUnscaledTime, dragSnapBackRestoreUntilUnscaledTime);
		return Time.unscaledTime < until;
	}

	private void MarkDragVisualSettleWindow(float seconds)
	{
		float dur = Mathf.Max(0f, seconds);
		if (dur <= 0f)
		{
			return;
		}

		dragSnapBackRestoreUntilUnscaledTime = Mathf.Max(dragSnapBackRestoreUntilUnscaledTime, Time.unscaledTime + dur + 0.02f);
	}

	private void EndEquationDragCompaction(bool immediate)
	{
		if (!dragEquationCompactionActive)
		{
			ClearEquationDragCompactionState();
			return;
		}

		float duration = immediate ? 0f : Mathf.Max(0f, dragEquationCompactionTweenSeconds);
		bool animate = duration > 0.001f;
		dragEquationCompactionRestoreUntilUnscaledTime = animate
			? (Time.unscaledTime + duration + 0.02f)
			: float.NegativeInfinity;

		for (int i = 0; i < dragEquationCompactionOperatorRects.Count; i++)
		{
			RectTransform rt = dragEquationCompactionOperatorRects[i];
			if (rt == null)
			{
				continue;
			}

			Vector2 target = i < dragEquationCompactionOperatorPositions.Count ? dragEquationCompactionOperatorPositions[i] : rt.anchoredPosition;
			rt.DOKill();
			if (animate)
			{
				rt.DOAnchorPos(target, duration).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				rt.anchoredPosition = target;
			}
		}

		for (int i = 0; i < dragEquationCompactionBubbles.Count; i++)
		{
			EquationBubbleElement bubble = dragEquationCompactionBubbles[i];
			if (bubble == null)
			{
				continue;
			}

			RectTransform rt = bubble.RectTransform;
			if (rt == null)
			{
				continue;
			}

			Vector2 target = i < dragEquationCompactionBubblePositions.Count ? dragEquationCompactionBubblePositions[i] : rt.anchoredPosition;
			rt.DOKill();
			if (animate)
			{
				rt.DOAnchorPos(target, duration).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				rt.anchoredPosition = target;
			}

			bubble.SetOriginalPosition(target);
		}

		if (operationSymbolRect != null && rightDropZone != null)
		{
			Vector2 opTarget = GetOperationSymbolPositionForDropZoneCenter(rightDropZone.OriginalPosition.x);
			operationSymbolRect.DOKill(false);
			if (animate)
			{
				operationSymbolRect.DOAnchorPos(opTarget, duration).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				operationSymbolRect.anchoredPosition = opTarget;
			}
		}

		ClearEquationDragCompactionState();
	}

	private void BeginEquationDragCompaction(EquationBubbleElement dragged)
	{
		if (ShouldUseDragOriginGhostPlaceholder())
		{
			return;
		}

		if (wispDotSprite == null && ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			return;
		}

		if (!compactEquationLayoutWhileDragging || dragged == null || currentState == null || equationContainer == null)
		{
			return;
		}

		dragEquationCompactionRestoreUntilUnscaledTime = float.NegativeInfinity;
		dragSnapBackRestoreUntilUnscaledTime = float.NegativeInfinity;
		ClearEquationDragCompactionState();

		List<TokenInfo> tokens = TokenizeEquation(FormatEquation(currentState));
		if (tokens == null || tokens.Count <= 1)
		{
			return;
		}

		List<EquationBubbleElement> tokenBubbles = new List<EquationBubbleElement>(bubbleElements.Count);
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement b = bubbleElements[i];
			if (b == null || b.ElementType == BubbleElementType.DropZone)
			{
				continue;
			}

			tokenBubbles.Add(b);
		}

		int draggedBubbleOrder = -1;
		for (int i = 0; i < tokenBubbles.Count; i++)
		{
			if (tokenBubbles[i] == dragged)
			{
				draggedBubbleOrder = i;
				break;
			}
		}

		if (draggedBubbleOrder < 0)
		{
			return;
		}

		int draggedTokenIndex = -1;
		int bubbleOrdinal = 0;
		int tokenBubbleCount = 0;
		for (int i = 0; i < tokens.Count; i++)
		{
			if (tokens[i].isOperator)
			{
				continue;
			}

			if (bubbleOrdinal == draggedBubbleOrder)
			{
				draggedTokenIndex = i;
			}

			bubbleOrdinal++;
			tokenBubbleCount++;
		}

		if (draggedTokenIndex < 0 || tokenBubbleCount != tokenBubbles.Count)
		{
			return;
		}

		EquationBubbleElement[] tokenBubbleByIndex = new EquationBubbleElement[tokens.Count];
		RectTransform[] tokenOperatorRectByIndex = new RectTransform[tokens.Count];

		int opCursor = 0;
		int bubbleCursor = 0;
		for (int i = 0; i < tokens.Count; i++)
		{
			if (tokens[i].isOperator)
			{
				while (opCursor < operatorLabels.Count && operatorLabels[opCursor] == null)
				{
					opCursor++;
				}

				if (opCursor >= operatorLabels.Count)
				{
					return;
				}

				GameObject labelObj = operatorLabels[opCursor++];
				tokenOperatorRectByIndex[i] = labelObj != null ? labelObj.GetComponent<RectTransform>() : null;
			}
			else
			{
				if (bubbleCursor >= tokenBubbles.Count)
				{
					return;
				}

				tokenBubbleByIndex[i] = tokenBubbles[bubbleCursor++];
			}
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject labelObj = operatorLabels[i];
			if (labelObj == null)
			{
				continue;
			}

			RectTransform rt = labelObj.GetComponent<RectTransform>();
			if (rt == null)
			{
				continue;
			}

			dragEquationCompactionOperatorRects.Add(rt);
			dragEquationCompactionOperatorPositions.Add(rt.anchoredPosition);
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement b = bubbleElements[i];
			if (b == null || b == dragged)
			{
				continue;
			}

			RectTransform rt = b.RectTransform;
			if (rt == null)
			{
				continue;
			}

			dragEquationCompactionBubbles.Add(b);
			dragEquationCompactionBubblePositions.Add(rt.anchoredPosition);
		}

		List<TokenInfo> remainingTokens = new List<TokenInfo>(tokens.Count - 1);
		List<int> remainingOriginalIndices = new List<int>(tokens.Count - 1);
		for (int i = 0; i < tokens.Count; i++)
		{
			if (i == draggedTokenIndex)
			{
				continue;
			}

			remainingTokens.Add(tokens[i]);
			remainingOriginalIndices.Add(i);
		}

		if (remainingTokens.Count == 0)
		{
			return;
		}

		float totalWidth = 0f;
		float totalLogicalWidth = 0f;
		for (int i = 0; i < remainingTokens.Count; i++)
		{
			totalWidth += GetTokenVisualWidth(remainingTokens[i]);
			totalLogicalWidth += GetTokenLogicalWidth(remainingTokens[i]);
			if (i < remainingTokens.Count - 1)
			{
				float spacing = GetSpacingAfterToken(remainingTokens, i);
				totalWidth += spacing;
				totalLogicalWidth += spacing;
			}
		}

		float xPos = -totalWidth * 0.5f;
		float logicalXPos = -totalLogicalWidth * 0.5f;
		float tweenSeconds = Mathf.Max(0f, dragEquationCompactionTweenSeconds);
		bool animate = tweenSeconds > 0.001f;

		for (int i = 0; i < remainingTokens.Count; i++)
		{
			TokenInfo token = remainingTokens[i];
			int originalTokenIndex = remainingOriginalIndices[i];
			float width = GetTokenVisualWidth(token);
			float logicalWidth = GetTokenLogicalWidth(token);
			float centerX = xPos + (width * 0.5f);

			if (token.isOperator)
			{
				RectTransform rt = tokenOperatorRectByIndex[originalTokenIndex];
				if (rt != null)
				{
					Vector2 target = new Vector2(centerX, rt.anchoredPosition.y);
					rt.DOKill();
					if (animate)
					{
						rt.DOAnchorPos(target, tweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
					}
					else
					{
						rt.anchoredPosition = target;
					}
				}
			}
			else
			{
				EquationBubbleElement bubble = tokenBubbleByIndex[originalTokenIndex];
				if (bubble != null && bubble != dragged)
				{
					RectTransform rt = bubble.RectTransform;
					if (rt != null)
					{
						Vector2 target = new Vector2(centerX, rt.anchoredPosition.y);
						rt.DOKill();
						if (animate)
						{
							rt.DOAnchorPos(target, tweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
						}
						else
						{
							rt.anchoredPosition = target;
						}

						bubble.SetOriginalPosition(target);
					}
				}
			}

			xPos += width;
			logicalXPos += logicalWidth;
			if (i < remainingTokens.Count - 1)
			{
				float spacing = GetSpacingAfterToken(remainingTokens, i);
				xPos += spacing;
				logicalXPos += spacing;
			}
		}

		float leftEdgeX = -(totalWidth * 0.5f);
		float rightEdgeNextX = xPos;
		float leftEdgeLogicalX = -(totalLogicalWidth * 0.5f);
		float rightEdgeLogicalNextX = logicalXPos;
		if (rightDropZone != null && rightDropZone != dragged)
		{
			RectTransform rt = rightDropZone.RectTransform;
			if (rt != null)
			{
				float visualCenterX = rightEdgeNextX + dropZoneOffset + (bubbleSize * 0.5f);
				float logicalCenterX = rightEdgeLogicalNextX + dropZoneOffset + (bubbleSize * 0.5f);
				Vector2 target = new Vector2(visualCenterX, rt.anchoredPosition.y);
				rt.DOKill();
				if (animate)
				{
					rt.DOAnchorPos(target, tweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
				}
				else
				{
					rt.anchoredPosition = target;
				}

				rightDropZone.SetOriginalPosition(target);
				rightDropZone.SetLogicalPathAnchorOffset(new Vector2(logicalCenterX - visualCenterX, 0f));

				if (operationSymbolRect != null)
				{
					Vector2 opTarget = GetOperationSymbolPositionForDropZoneCenter(visualCenterX);
					operationSymbolRect.DOKill(false);
					if (animate)
					{
						operationSymbolRect.DOAnchorPos(opTarget, tweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
					}
					else
					{
						operationSymbolRect.anchoredPosition = opTarget;
					}
				}
			}
		}

		if (leftDropZone != null && leftDropZone != dragged)
		{
			RectTransform rt = leftDropZone.RectTransform;
			if (rt != null)
			{
				float visualCenterX = leftEdgeX - dropZoneOffset - (bubbleSize * 0.5f);
				float logicalCenterX = leftEdgeLogicalX - dropZoneOffset - (bubbleSize * 0.5f);
				Vector2 target = new Vector2(visualCenterX, rt.anchoredPosition.y);
				rt.DOKill();
				if (animate)
				{
					rt.DOAnchorPos(target, tweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
				}
				else
				{
					rt.anchoredPosition = target;
				}

				leftDropZone.SetOriginalPosition(target);
				leftDropZone.SetLogicalPathAnchorOffset(new Vector2(logicalCenterX - visualCenterX, 0f));
			}
		}

		dragEquationCompactionActive = true;
	}
}
