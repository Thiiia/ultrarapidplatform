using System.Collections;

using UnityEngine;
using UnityEngine.UI;

using TMPro;

using DG.Tweening;

public partial class DragExecutionController
{
	private IEnumerator PlayIntroAnimation()
	{
		isBubbleAnimating = true;

		// Pop + fade + gentle float for each bubble.
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			RectTransform rect = bubble.RectTransform;
			CanvasGroup cg = bubble.GetComponent<CanvasGroup>();

			float delay = i * 0.08f;

			if (cg != null)
			{
				cg.DOKill();
				cg.alpha = 0f;
				cg.DOFade(1f, 0.18f).SetDelay(delay);
			}

			rect.DOKill();
			rect.localScale = Vector3.one * 0.85f;

			// Pop effect - scale up then back to normal
			rect.DOScale(1.08f, 0.18f).SetDelay(delay).SetEase(Ease.OutQuad).OnComplete(() =>
			{
				if (rect != null) rect.DOScale(1f, 0.12f).SetEase(Ease.InQuad);
			});

			// Gentle "bubble float" (small vertical wobble)
			Vector2 startPos = rect.anchoredPosition;
			rect.DOAnchorPosY(startPos.y + 10f, 1.2f).SetDelay(delay).SetEase(Ease.InOutSine).SetLoops(4, LoopType.Yoyo);
		}

		yield return new WaitForSeconds(0.5f);

		// Show progress bar at top (but keep main bubbles in center!)
		yield return StartCoroutine(MoveEquationToTop());

		isBubbleAnimating = false;
	}

	private static float Hash01(int seed)
	{
		float s = Mathf.Sin(seed * 12.9898f) * 43758.5453f;
		return s - Mathf.Floor(s);
	}

	private IEnumerator MoveEquationToTop()
	{
		// Show the locked/reference HUD.
		referenceHudContainer.gameObject.SetActive(true);
		referenceHudContainer.localScale = Vector3.zero;
		referenceHudContainer.DOScale(1f, 0.3f)
			.SetEase(Ease.OutBack)
			.OnComplete(() =>
			{
				EnsureStepPerformanceBar(forceRebuild: false);
				RequestDeferredStepPerformanceAnchorRefresh(2);
			});

		// Update progress bar content
		UpdateBubbleProgressBar(currentState);

		yield return new WaitForSeconds(0.2f);

		// Animate the initial "spawn" equation up and out, so it feels like it becomes the locked/reference equation.
		float duration = Mathf.Max(0.1f, moveToProgressBarDuration);
		float minDurMul = Mathf.Min(moveToTopDurationMultiplierRange.x, moveToTopDurationMultiplierRange.y);
		float maxDurMul = Mathf.Max(moveToTopDurationMultiplierRange.x, moveToTopDurationMultiplierRange.y);
		float rise = bubbleSize * 0.9f;
		float maxTweenTime = 0f;

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null)
			{
				continue;
			}

			float r = Hash01(i + 11);
			float dur = duration * Mathf.Lerp(minDurMul, maxDurMul, r);
			float delay = moveToTopStaggerSeconds * Hash01(i + 101);
			float riseJitter = Mathf.Lerp(moveToTopRiseJitterRange.x, moveToTopRiseJitterRange.y, Hash01(i + 201));
			maxTweenTime = Mathf.Max(maxTweenTime, dur + delay);

			RectTransform rt = bubble.RectTransform;
			if (rt != null)
			{
				rt.DOKill();
				Vector2 start = rt.anchoredPosition;
				rt.DOAnchorPos(new Vector2(start.x, start.y + rise + riseJitter), dur).SetDelay(delay).SetEase(Ease.InOutSine);
				rt.DOScale(0.7f, dur).SetDelay(delay).SetEase(Ease.InQuad);
			}

			CanvasGroup cg = bubble.GetComponent<CanvasGroup>();
			if (cg != null)
			{
				cg.DOKill();
				cg.DOFade(0f, dur).SetDelay(delay).SetEase(Ease.InQuad);
			}
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject labelObj = operatorLabels[i];
			if (labelObj == null)
			{
				continue;
			}

			float r = Hash01(i + 701);
			float dur = duration * Mathf.Lerp(minDurMul, maxDurMul, r);
			float delay = moveToTopStaggerSeconds * Hash01(i + 801);
			float riseJitter = Mathf.Lerp(moveToTopRiseJitterRange.x, moveToTopRiseJitterRange.y, Hash01(i + 901));
			maxTweenTime = Mathf.Max(maxTweenTime, dur + delay);

			RectTransform rt = labelObj.GetComponent<RectTransform>();
			if (rt != null)
			{
				rt.DOKill();
				Vector2 start = rt.anchoredPosition;
				rt.DOAnchorPos(new Vector2(start.x, start.y + rise + riseJitter), dur).SetDelay(delay).SetEase(Ease.InOutSine);
				rt.DOScale(0.7f, dur).SetDelay(delay).SetEase(Ease.InQuad);
			}

			TextMeshProUGUI tmp = labelObj.GetComponent<TextMeshProUGUI>();
			if (tmp != null)
			{
				tmp.DOKill();
				tmp.DOFade(0f, dur).SetDelay(delay).SetEase(Ease.InQuad);
			}
		}

		yield return new WaitForSeconds(maxTweenTime);

		// Destroy the "intro" instances and spawn the playable equation again at center.
		foreach (EquationBubbleElement elem in bubbleElements)
		{
			if (elem == null) continue;
			if (elem.RectTransform != null) elem.RectTransform.DOKill();
			CanvasGroup cg = elem.GetComponent<CanvasGroup>();
			if (cg != null) cg.DOKill();
			Graphic g = elem.GetComponent<Graphic>();
			if (g != null) g.DOKill();
			elem.transform.DOKill();
			Destroy(elem.gameObject);
		}
		bubbleElements.Clear();

		foreach (GameObject label in operatorLabels)
		{
			if (label == null) continue;
			RectTransform rt = label.GetComponent<RectTransform>();
			if (rt != null) rt.DOKill();
			TextMeshProUGUI tmp = label.GetComponent<TextMeshProUGUI>();
			if (tmp != null) tmp.DOKill();
			label.transform.DOKill();
			Destroy(label);
		}
		operatorLabels.Clear();

		currentDropZone = null;
		equationAtTop = true;

		string equation = FormatEquation(currentState);
		CreateBubbleElements(equation);
		EnsureStepPerformanceBar(forceRebuild: false);
		RequestDeferredStepPerformanceAnchorRefresh(2);

		foreach (EquationBubbleElement bubble in bubbleElements)
		{
			if (bubble == null) continue;
			RectTransform rt = bubble.RectTransform;
			if (rt == null) continue;
			rt.localScale = Vector3.one * 0.9f;
			rt.DOScale(1f, 0.2f).SetEase(Ease.OutBack);
		}

		RebuildTermVisualGroups();
		RefreshJourneyGuidanceAndEquationPlacement();
	}
}
