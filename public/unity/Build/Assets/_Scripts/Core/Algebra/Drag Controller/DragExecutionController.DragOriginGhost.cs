using UnityEngine;
using UnityEngine.UI;

using DG.Tweening;

public partial class DragExecutionController
{
	private bool ShouldUseDragOriginGhostPlaceholder()
	{
		return leaveOriginGhostWhileDragging;
	}

	private void BeginDragOriginGhost(EquationBubbleElement element)
	{
		DestroyDragOriginGhostImmediate();

		if (!ShouldUseDragOriginGhostPlaceholder() || element == null || element.RectTransform == null)
		{
			return;
		}

		RectTransform sourceRt = element.RectTransform;
		Transform parent = sourceRt.parent;
		if (parent == null)
		{
			return;
		}

		GameObject clone = Object.Instantiate(element.gameObject, parent);
		clone.name = "DragOriginGhost";
		clone.transform.SetSiblingIndex(sourceRt.GetSiblingIndex());

		EquationBubbleElement cloneElem = clone.GetComponent<EquationBubbleElement>();
		if (cloneElem != null)
		{
			cloneElem.enabled = false;
		}

		dragOriginGhostObject = clone;
		dragOriginGhostRect = clone.GetComponent<RectTransform>();
		dragOriginGhostCanvasGroup = clone.GetComponent<CanvasGroup>();
		if (dragOriginGhostCanvasGroup == null)
		{
			dragOriginGhostCanvasGroup = clone.AddComponent<CanvasGroup>();
		}

		if (dragOriginGhostRect != null)
		{
			dragOriginGhostRect.DOKill(false);
			dragOriginGhostRect.anchoredPosition = element.OriginalPosition;
			dragOriginGhostRect.localScale = sourceRt.localScale * Mathf.Clamp(dragOriginGhostScale, 0.85f, 1.15f);
		}

		dragOriginGhostCanvasGroup.DOKill(false);
		dragOriginGhostCanvasGroup.alpha = Mathf.Clamp01(dragOriginGhostAlpha);
		dragOriginGhostCanvasGroup.blocksRaycasts = false;
		dragOriginGhostCanvasGroup.interactable = false;

		Graphic[] graphics = clone.GetComponentsInChildren<Graphic>(includeInactive: true);
		for (int i = 0; i < graphics.Length; i++)
		{
			if (graphics[i] != null)
			{
				graphics[i].raycastTarget = false;
			}
		}

		TryCreateDragOriginOperatorGhost();
		dragOriginGhostPendingFade = false;
	}

	private void TryCreateDragOriginOperatorGhost()
	{
		if (followingOperatorLabel == null || isDynamicDivideOperator)
		{
			return;
		}

		RectTransform sourceRt = followingOperatorRect != null
			? followingOperatorRect
			: followingOperatorLabel.GetComponent<RectTransform>();
		if (sourceRt == null || sourceRt.parent == null)
		{
			return;
		}

		GameObject clone = Object.Instantiate(followingOperatorLabel, sourceRt.parent);
		clone.name = "DragOriginGhostOperator";
		clone.transform.SetSiblingIndex(sourceRt.GetSiblingIndex());

		dragOriginGhostOperatorObject = clone;
		dragOriginGhostOperatorRect = clone.GetComponent<RectTransform>();
		dragOriginGhostOperatorCanvasGroup = clone.GetComponent<CanvasGroup>();
		if (dragOriginGhostOperatorCanvasGroup == null)
		{
			dragOriginGhostOperatorCanvasGroup = clone.AddComponent<CanvasGroup>();
		}

		if (dragOriginGhostOperatorRect != null)
		{
			dragOriginGhostOperatorRect.DOKill(false);
			dragOriginGhostOperatorRect.anchoredPosition = sourceRt.anchoredPosition;
			dragOriginGhostOperatorRect.localScale = sourceRt.localScale;
			dragOriginGhostOperatorRect.localRotation = sourceRt.localRotation;
		}

		dragOriginGhostOperatorCanvasGroup.DOKill(false);
		dragOriginGhostOperatorCanvasGroup.alpha = Mathf.Clamp01(dragOriginGhostAlpha);
		dragOriginGhostOperatorCanvasGroup.blocksRaycasts = false;
		dragOriginGhostOperatorCanvasGroup.interactable = false;

		Graphic[] graphics = clone.GetComponentsInChildren<Graphic>(includeInactive: true);
		for (int i = 0; i < graphics.Length; i++)
		{
			if (graphics[i] != null)
			{
				graphics[i].raycastTarget = false;
			}
		}
	}

	private void FadeOutAndDestroyDragOriginGhost()
	{
		if (dragOriginGhostObject == null && dragOriginGhostOperatorObject == null)
		{
			dragOriginGhostPendingFade = false;
			return;
		}

		dragOriginGhostPendingFade = false;
		float fadeSeconds = Mathf.Max(0f, dragOriginGhostFadeSeconds);
		bool hasBubbleGhost = dragOriginGhostObject != null && dragOriginGhostCanvasGroup != null;
		bool hasOperatorGhost = dragOriginGhostOperatorObject != null && dragOriginGhostOperatorCanvasGroup != null;
		if (!hasBubbleGhost && !hasOperatorGhost)
		{
			DestroyDragOriginGhostImmediate();
			return;
		}

		if (dragOriginGhostRect != null)
		{
			dragOriginGhostRect.DOKill(false);
		}
		if (dragOriginGhostCanvasGroup != null)
		{
			dragOriginGhostCanvasGroup.DOKill(false);
		}
		if (dragOriginGhostOperatorCanvasGroup != null)
		{
			dragOriginGhostOperatorCanvasGroup.DOKill(false);
		}
		if (dragOriginGhostOperatorRect != null)
		{
			dragOriginGhostOperatorRect.DOKill(false);
		}

		if (fadeSeconds <= 0f)
		{
			DestroyDragOriginGhostImmediate();
			return;
		}

		int pendingFades = 0;
		void OnFadeComplete()
		{
			pendingFades--;
			if (pendingFades <= 0)
			{
				DestroyDragOriginGhostImmediate();
			}
		}

		if (hasBubbleGhost)
		{
			GameObject ghostObj = dragOriginGhostObject;
			RectTransform ghostRt = dragOriginGhostRect;
			if (ghostRt != null)
			{
				ghostRt.DOScale(ghostRt.localScale * 0.96f, fadeSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetLink(ghostObj, LinkBehaviour.KillOnDestroy);
			}

			pendingFades++;
			dragOriginGhostCanvasGroup.DOFade(0f, fadeSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(ghostObj, LinkBehaviour.KillOnDestroy)
				.OnComplete(OnFadeComplete);
		}

		if (hasOperatorGhost)
		{
			GameObject ghostOperatorObj = dragOriginGhostOperatorObject;
			RectTransform ghostOperatorRt = dragOriginGhostOperatorRect;
			if (ghostOperatorRt != null)
			{
				ghostOperatorRt.DOScale(ghostOperatorRt.localScale * 0.96f, fadeSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetLink(ghostOperatorObj, LinkBehaviour.KillOnDestroy);
			}

			pendingFades++;
			dragOriginGhostOperatorCanvasGroup.DOFade(0f, fadeSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(ghostOperatorObj, LinkBehaviour.KillOnDestroy)
				.OnComplete(OnFadeComplete);
		}

		if (pendingFades <= 0)
		{
			DestroyDragOriginGhostImmediate();
		}
	}

	private void DestroyDragOriginGhostImmediate()
	{
		dragOriginGhostPendingFade = false;

		if (dragOriginGhostObject != null)
		{
			if (dragOriginGhostRect != null)
			{
				dragOriginGhostRect.DOKill(false);
			}
			if (dragOriginGhostCanvasGroup != null)
			{
				dragOriginGhostCanvasGroup.DOKill(false);
			}
			KillTweensOnTransform(dragOriginGhostObject.transform);
			Object.Destroy(dragOriginGhostObject);
		}

		if (dragOriginGhostOperatorObject != null)
		{
			if (dragOriginGhostOperatorRect != null)
			{
				dragOriginGhostOperatorRect.DOKill(false);
			}
			if (dragOriginGhostOperatorCanvasGroup != null)
			{
				dragOriginGhostOperatorCanvasGroup.DOKill(false);
			}
			KillTweensOnTransform(dragOriginGhostOperatorObject.transform);
			Object.Destroy(dragOriginGhostOperatorObject);
		}

		dragOriginGhostObject = null;
		dragOriginGhostRect = null;
		dragOriginGhostCanvasGroup = null;
		dragOriginGhostOperatorObject = null;
		dragOriginGhostOperatorRect = null;
		dragOriginGhostOperatorCanvasGroup = null;
	}

	private void ResolveDragOriginGhostAfterDrag(bool pathHiddenNow)
	{
		if (!ShouldUseDragOriginGhostPlaceholder())
		{
			DestroyDragOriginGhostImmediate();
			return;
		}

		bool pathCurrentlyVisible =
			(wispPathContainer != null && wispPathContainer.gameObject.activeSelf) ||
			(wispFrontVisualContainer != null && wispFrontVisualContainer.gameObject.activeSelf);
		if (pathHiddenNow || !pathCurrentlyVisible)
		{
			FadeOutAndDestroyDragOriginGhost();
			return;
		}

		dragOriginGhostPendingFade = dragOriginGhostObject != null || dragOriginGhostOperatorObject != null;
	}

	private void OnWispPathVisibilityChangedForDragOriginGhost(bool visible)
	{
		if (!visible && dragOriginGhostPendingFade)
		{
			FadeOutAndDestroyDragOriginGhost();
		}
	}
}
