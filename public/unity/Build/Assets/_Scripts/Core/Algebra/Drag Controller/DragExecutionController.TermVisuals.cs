using DG.Tweening;
using UnityEngine;

public partial class DragExecutionController
{
	#region Bubble System - Term Visuals

	private void ClearTermVisualGroups(bool restoreVariableScales = true)
	{
		for (int i = 0; i < termVisualGroups.Count; i++)
		{
			TermVisualGroup group = termVisualGroups[i];
			if (group == null)
			{
				continue;
			}

			if (restoreVariableScales && group.variable != null && group.variable.RectTransform != null)
			{
				RectTransform variableRect = group.variable.RectTransform;
				variableRect.DOKill();
				variableRect.localScale = group.variableSoloScale;
			}
		}

		termVisualGroups.Clear();
		termGroupByCoefficient.Clear();
	}

	private void RebuildTermVisualGroups()
	{
		ClearTermVisualGroups();

		if (!equationAtTop)
		{
			return;
		}

		if (equationContainer == null || bubbleElements == null || bubbleElements.Count == 0)
		{
			return;
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement coefficient = bubbleElements[i];
			if (coefficient == null || coefficient.ElementType != BubbleElementType.Coefficient)
			{
				continue;
			}

			if (!TryFindTermBuddyVariable(coefficient, out EquationBubbleElement variableBubble))
			{
				continue;
			}

			RectTransform coefficientRect = coefficient.RectTransform;
			RectTransform variableRect = variableBubble != null ? variableBubble.RectTransform : null;
			if (coefficientRect == null || variableRect == null)
			{
				continue;
			}

			TermVisualGroup group = new TermVisualGroup
			{
				coefficient = coefficient,
				variable = variableBubble,
				variableSoloScale = variableRect.localScale
			};

			float clampedScale = Mathf.Clamp(termBuddyVariableScale, 0.5f, 1f);
			group.variableCombinedScale = group.variableSoloScale * clampedScale;
			group.isCombined = true;

			variableRect.localScale = group.variableCombinedScale;

			termVisualGroups.Add(group);
			termGroupByCoefficient[coefficient] = group;
		}
	}

	private static float GetBubbleRadius(RectTransform rect)
	{
		if (rect == null)
		{
			return 0f;
		}

		float width = Mathf.Abs(rect.rect.width * rect.localScale.x);
		float height = Mathf.Abs(rect.rect.height * rect.localScale.y);
		return Mathf.Max(width, height) * 0.5f;
	}

	private bool TryGetTermGroup(EquationBubbleElement coefficient, out TermVisualGroup group)
	{
		group = null;
		return coefficient != null && termGroupByCoefficient.TryGetValue(coefficient, out group) && group != null;
	}

	private void SetTermGroupCombined(TermVisualGroup group, bool combined, bool animate)
	{
		if (group == null)
		{
			return;
		}

		group.isCombined = combined;

		RectTransform variableRect = group.variable != null ? group.variable.RectTransform : null;
		if (variableRect != null)
		{
			Vector3 targetScale = combined ? group.variableCombinedScale : group.variableSoloScale;
			variableRect.DOKill();
			if (animate)
			{
				variableRect.DOScale(targetScale, 0.12f).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				variableRect.localScale = targetScale;
			}
		}
	}

	private void RestoreTermGroupAfterSnapBack(EquationBubbleElement element)
	{
		if (!TryGetTermGroup(element, out TermVisualGroup group))
		{
			return;
		}

		float delay = Mathf.Max(0.01f, snapBackDuration);
		DOVirtual.DelayedCall(delay, () =>
		{
			if (group == null)
			{
				return;
			}

			SetTermGroupCombined(group, combined: true, animate: true);
		}).SetUpdate(true);
	}

	#endregion
}
