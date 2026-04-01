using System.Collections;

using UnityEngine;
using UnityEngine.UI;
using Sirenix.OdinInspector;

using TMPro;

using DG.Tweening;

using LeTai.Asset.TranslucentImage;
using Shapes;

public partial class DragExecutionController
{
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), SerializeField] private bool showSolvedBadge = true;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Sprite solvedCheckSprite;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Sprite solvedBadgeCircleSprite;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private bool solvedBadgeUseTranslucentGlass = true;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeGlassSettings)), SerializeField, Range(0f, 1f), Tooltip("Tinted glass strength for the solved check badge when using TranslucentImage.")]
	private float solvedBadgeGlassForegroundOpacity = 0.34f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Color solvedBadgeCircleColor = AlgebraUiPalette.JudgementGreen;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Color solvedBadgeCheckColor = new Color(1f, 1f, 1f, 0.95f);
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Color solvedBadgeRingColor = new Color(AlgebraUiPalette.JudgementGreen.r, AlgebraUiPalette.JudgementGreen.g, AlgebraUiPalette.JudgementGreen.b, 0.95f);
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Color solvedBadgeGlowColor = new Color(AlgebraUiPalette.JudgementGreen.r, AlgebraUiPalette.JudgementGreen.g, AlgebraUiPalette.JudgementGreen.b, 0.28f);
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField, Range(0.15f, 0.7f)] private float solvedBadgeSizeRatio = 0.52f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private Vector2 solvedBadgeOffset = Vector2.zero;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField, Min(0.05f)] private float solvedBadgePopSeconds = 0.22f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField, Range(1f, 2.5f)] private float solvedBadgeRippleScale = 1.6f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField, Min(0.05f)] private float solvedBadgeRippleSeconds = 0.34f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private bool highlightSolvedValueBubble = true;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedValueStyleSettings)), SerializeField] private Color solvedValueBackgroundColor = AlgebraUiPalette.White;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedValueStyleSettings)), SerializeField] private Color solvedValueOutlineColor = new Color(1f, 1f, 1f, 0.22f);
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedValueStyleSettings)), SerializeField] private Color solvedValueTextColor = new Color(0.06f, 0.06f, 0.06f, 1f);
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField] private bool loopPulseSolvedValue = true;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedValuePulseSettings)), SerializeField, Range(1f, 1.25f)] private float solvedValuePulseScale = 1.04f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedValuePulseSettings)), SerializeField, Min(0.05f)] private float solvedValuePulseSeconds = 0.28f;
	[FoldoutGroup("Feedback"), FoldoutGroup("Feedback/Solved"), ShowIf(nameof(ShowSolvedBadgeSettings)), SerializeField, Min(0.05f)] private float solvedBurstSeconds = 0.25f;

	private GameObject solvedBadgeObject;
	private EquationBubbleElement solvedBadgeTarget;
	private Tween solvedValuePulseTween;
	private bool ShowSolvedBadgeSettings => showSolvedBadge;
	private bool ShowSolvedBadgeGlassSettings => showSolvedBadge && solvedBadgeUseTranslucentGlass;
	private bool ShowSolvedValueStyleSettings => showSolvedBadge && highlightSolvedValueBubble;
	private bool ShowSolvedValuePulseSettings => showSolvedBadge && loopPulseSolvedValue;
	private const float SolvedBadgeCornerOverlapRatio = 0.16f;

	private IEnumerator PlaySolvedBurstAndReveal()
	{
		isBubbleAnimating = true;

		HideOperationSymbol();

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null)
				continue;

			bubble.SetInteractable(false);

			RectTransform rect = bubble.RectTransform;
			if (rect == null)
				continue;

			rect.DOKill();
			CanvasGroup cg = bubble.GetComponent<CanvasGroup>();
			if (cg != null)
			{
				cg.DOKill();
				cg.alpha = 1f;
			}

			rect.DOPunchScale(Vector3.one * 0.22f, solvedBurstSeconds * 0.55f, 7, 0.85f).SetEase(Ease.OutQuad);
			rect.DOScale(0f, solvedBurstSeconds).SetDelay(solvedBurstSeconds * 0.35f).SetEase(Ease.InBack);
			if (cg != null)
				cg.DOFade(0f, solvedBurstSeconds).SetDelay(solvedBurstSeconds * 0.35f).SetEase(Ease.OutQuad);
		}

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject labelGo = operatorLabels[i];
			if (labelGo == null)
				continue;

			RectTransform rect = labelGo.GetComponent<RectTransform>();
			TextMeshProUGUI tmp = labelGo.GetComponent<TextMeshProUGUI>();

			if (rect != null)
			{
				rect.DOKill();
				rect.DOPunchScale(Vector3.one * 0.18f, solvedBurstSeconds * 0.55f, 7, 0.85f).SetEase(Ease.OutQuad);
				rect.DOScale(0f, solvedBurstSeconds).SetDelay(solvedBurstSeconds * 0.35f).SetEase(Ease.InBack);
			}

			if (tmp != null)
			{
				tmp.DOKill();
				tmp.DOFade(0f, solvedBurstSeconds).SetDelay(solvedBurstSeconds * 0.35f).SetEase(Ease.OutQuad);
			}
		}

		yield return new WaitForSeconds(solvedBurstSeconds * 1.1f);

		RefreshBubbleDisplay();
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			if (bubbleElements[i] != null)
				bubbleElements[i].SetInteractable(false);
		}

		ShowSolvedFeedback();
		isBubbleAnimating = false;
	}

	private void ClearSolvedBadge()
	{
		if (solvedValuePulseTween != null)
		{
			solvedValuePulseTween.Kill(false);
			solvedValuePulseTween = null;
		}

		if (solvedBadgeObject != null)
		{
			KillTweensOnTransform(solvedBadgeObject.transform);
			solvedBadgeObject.SetActive(false);
			Destroy(solvedBadgeObject);
			solvedBadgeObject = null;
		}

		if (solvedBadgeTarget != null && solvedBadgeTarget.RectTransform != null)
		{
			solvedBadgeTarget.RectTransform.DOKill();
			solvedBadgeTarget.RectTransform.localScale = Vector3.one;
		}

		solvedBadgeTarget = null;
	}

	private bool TryResolveSolvedValueBubble(out EquationBubbleElement valueBubble, out EquationBubbleElement variableBubble)
	{
		valueBubble = null;
		variableBubble = null;

		if (currentState == null || !currentState.IsSolved())
			return false;

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement elem = bubbleElements[i];
			if (elem != null && elem.ElementType == BubbleElementType.Variable)
			{
				variableBubble = elem;
				break;
			}
		}

		int variableSide = variableBubble != null ? variableBubble.EquationSide : -1;
		for (int i = bubbleElements.Count - 1; i >= 0; i--)
		{
			EquationBubbleElement elem = bubbleElements[i];
			if (elem == null)
				continue;
			if (elem.ElementType != BubbleElementType.Constant)
				continue;

			if (variableSide < 0 || elem.EquationSide != variableSide)
			{
				valueBubble = elem;
				return true;
			}
		}

		return false;
	}

	private RectTransform ResolveSolvedBadgeAnchorRect(EquationBubbleElement target)
	{
		if (target == null)
		{
			return null;
		}

		RectTransform rootRect = target.RectTransform;
		if (rootRect == null)
		{
			return null;
		}

		Transform digitContainer = target.transform.Find("DigitBubbles");
		if (digitContainer == null || digitContainer.childCount == 0)
		{
			return rootRect;
		}

		RectTransform rightmost = null;
		float rightmostX = float.NegativeInfinity;
		for (int i = 0; i < digitContainer.childCount; i++)
		{
			RectTransform childRect = digitContainer.GetChild(i) as RectTransform;
			if (childRect == null)
			{
				continue;
			}

			float childX = childRect.anchoredPosition.x;
			if (rightmost == null || childX > rightmostX)
			{
				rightmost = childRect;
				rightmostX = childX;
			}
		}

		return rightmost != null ? rightmost : rootRect;
	}

	private static float GetSolvedBadgeVisibleDiameter(RectTransform rect)
	{
		if (rect == null)
		{
			return 0f;
		}

		float diameter = Mathf.Max(1f, Mathf.Min(rect.rect.width, rect.rect.height));
		RectTransform outlineRect = rect.Find("Outline") as RectTransform;
		if (outlineRect != null)
		{
			float outlineDiameter = Mathf.Max(1f, Mathf.Min(outlineRect.rect.width, outlineRect.rect.height));
			diameter = Mathf.Max(diameter, outlineDiameter);
		}

		return diameter;
	}

	private static Vector2 GetSolvedBadgeCornerOffset(RectTransform rect, float badgeDiameter)
	{
		if (rect == null)
		{
			return Vector2.zero;
		}

		float targetRadius = GetSolvedBadgeVisibleDiameter(rect) * 0.5f;
		float badgeRadius = Mathf.Max(0.5f, badgeDiameter * 0.5f);
		float overlap = badgeRadius * SolvedBadgeCornerOverlapRatio;
		float radialDistance = Mathf.Max(0f, targetRadius + badgeRadius - overlap);
		float axisDistance = radialDistance * 0.70710678f;
		return new Vector2(axisDistance, axisDistance);
	}

	private Sprite ResolveSolvedBadgeCircleSprite()
	{
		if (solvedBadgeCircleSprite != null && solvedBadgeCircleSprite == solvedCheckSprite && circleSprite != null)
		{
			return circleSprite;
		}

		if (solvedBadgeCircleSprite != null)
		{
			return solvedBadgeCircleSprite;
		}

		if (circleSprite != null)
		{
			return circleSprite;
		}

		return GetFallbackWhiteSprite();
	}

	private void ShowSolvedFeedback()
	{
		if (!showSolvedBadge)
			return;

		ClearSolvedBadge();

		if (!TryResolveSolvedValueBubble(out EquationBubbleElement valueBubble, out EquationBubbleElement variableBubble))
			return;

		solvedBadgeTarget = valueBubble;

		if (highlightSolvedValueBubble && solvedBadgeTarget != null)
		{
			solvedBadgeTarget.AnimateSolvedStyle(solvedValueOutlineColor, solvedValueBackgroundColor, solvedValueTextColor, solvedBadgePopSeconds);
		}

		if (variableBubble != null && variableBubble != solvedBadgeTarget)
		{
			variableBubble.AnimateSuccess();
		}

		RectTransform targetRect = solvedBadgeTarget.RectTransform;
		if (targetRect == null)
			return;

		RectTransform badgeAnchorRect = ResolveSolvedBadgeAnchorRect(solvedBadgeTarget);
		if (badgeAnchorRect == null)
		{
			badgeAnchorRect = targetRect;
		}

		if (loopPulseSolvedValue)
		{
			Vector3 baseScale = targetRect.localScale;
			solvedValuePulseTween = targetRect
				.DOScale(baseScale * solvedValuePulseScale, solvedValuePulseSeconds)
				.SetDelay(solvedBadgePopSeconds)
				.SetEase(Ease.InOutSine)
				.SetLoops(-1, LoopType.Yoyo)
				.SetUpdate(true)
				.SetLink(targetRect.gameObject, LinkBehaviour.KillOnDestroy);
		}

		float bubblePx = GetSolvedBadgeVisibleDiameter(badgeAnchorRect);
		float badgePx = Mathf.Clamp(bubblePx * solvedBadgeSizeRatio, 18f, bubblePx);
		EnsureStepPerformanceSource();

		GameObject badgeGo = new GameObject("SolvedBadge", typeof(RectTransform), typeof(CanvasGroup));
		badgeGo.transform.SetParent(badgeAnchorRect, false);
		badgeGo.transform.SetAsLastSibling();

		RectTransform badgeRect = badgeGo.GetComponent<RectTransform>();
		badgeRect.anchorMin = new Vector2(0.5f, 0.5f);
		badgeRect.anchorMax = new Vector2(0.5f, 0.5f);
		badgeRect.pivot = new Vector2(0.5f, 0.5f);
		badgeRect.sizeDelta = new Vector2(badgePx, badgePx);
		badgeRect.anchoredPosition = GetSolvedBadgeCornerOffset(badgeAnchorRect, badgePx) + solvedBadgeOffset;

		CanvasGroup badgeGroup = badgeGo.GetComponent<CanvasGroup>();
		badgeGroup.alpha = 0f;

		Sprite circle = ResolveSolvedBadgeCircleSprite();

		// Keep the solved badge minimal: glass fill + Shapes ring + icon.
		// Unity UI Outline duplicates the source graphic in several directions,
		// which reads like multiple stacked badges on a filled circle.
		if (circle != null)
		{
			Graphic badgeBgGraphic;
			if (solvedBadgeUseTranslucentGlass)
			{
				TranslucentImage badgeBgTi = badgeGo.AddComponent<TranslucentImage>();
				badgeBgTi.raycastTarget = false;
				badgeBgTi.sprite = circle;
				badgeBgTi.type = Image.Type.Simple;
				badgeBgTi.preserveAspect = true;
				Color badgeTint = solvedBadgeCircleColor;
				badgeTint.a = 1f;
				badgeBgTi.color = badgeTint;
				badgeBgTi.foregroundOpacity = Mathf.Clamp01(solvedBadgeGlassForegroundOpacity);
				if (badgeBgTi.source == null && cachedStepPerformanceSource != null)
				{
					badgeBgTi.source = cachedStepPerformanceSource;
				}

				TryConfigureTranslucentCircle(badgeGo, badgeRect);
				badgeBgGraphic = badgeBgTi;
			}
			else
			{
				Image badgeBg = badgeGo.AddComponent<Image>();
				badgeBg.raycastTarget = false;
				badgeBg.sprite = circle;
				badgeBg.preserveAspect = true;
				Color fallbackFill = solvedBadgeCircleColor;
				fallbackFill.a = Mathf.Max(fallbackFill.a, 0.8f);
				badgeBg.color = fallbackFill;
				badgeBgGraphic = badgeBg;
			}

			// Keep graphic ref alive to avoid stripping by compiler and document intent.
			if (badgeBgGraphic != null)
			{
				badgeBgGraphic.raycastTarget = false;
			}
		}

		GameObject ringGo = new GameObject("Ring", typeof(RectTransform), typeof(Disc));
		ringGo.transform.SetParent(badgeGo.transform, false);
		RectTransform ringRect = ringGo.GetComponent<RectTransform>();
		ringRect.anchorMin = new Vector2(0.5f, 0.5f);
		ringRect.anchorMax = new Vector2(0.5f, 0.5f);
		ringRect.pivot = new Vector2(0.5f, 0.5f);
		ringRect.anchoredPosition = Vector2.zero;
		ringRect.sizeDelta = Vector2.zero;

		Disc ringDisc = ringGo.GetComponent<Disc>();
		ringDisc.Type = DiscType.Ring;
		ringDisc.RadiusSpace = ThicknessSpace.Meters;
		ringDisc.ThicknessSpace = ThicknessSpace.Meters;
		float ringThickness = Mathf.Clamp(badgePx * 0.055f, 0.8f, 3.5f);
		ringDisc.Thickness = ringThickness;
		ringDisc.Radius = Mathf.Max(1f, (badgePx * 0.5f) - Mathf.Max(0.5f, ringThickness * 0.2f));
		Color ringColor = solvedBadgeRingColor;
		ringColor.a = Mathf.Clamp01(ringColor.a);
		ringDisc.Color = ringColor;

		GameObject iconGo = new GameObject("Icon", typeof(RectTransform));
		iconGo.transform.SetParent(badgeGo.transform, false);
		RectTransform iconRect = iconGo.GetComponent<RectTransform>();
		iconRect.anchorMin = new Vector2(0.5f, 0.5f);
		iconRect.anchorMax = new Vector2(0.5f, 0.5f);
		iconRect.pivot = new Vector2(0.5f, 0.5f);
		iconRect.anchoredPosition = Vector2.zero;
		iconRect.sizeDelta = new Vector2(badgePx * 0.58f, badgePx * 0.58f);

		if (solvedCheckSprite != null)
		{
			Image iconImg = iconGo.AddComponent<Image>();
			iconImg.raycastTarget = false;
			iconImg.sprite = solvedCheckSprite;
			iconImg.preserveAspect = true;
			iconImg.color = solvedBadgeCheckColor;
		}
		else
		{
			TextMeshProUGUI tmp = iconGo.AddComponent<TextMeshProUGUI>();
			tmp.raycastTarget = false;
			tmp.text = "\u2713";
			tmp.alignment = TextAlignmentOptions.Center;
			tmp.color = solvedBadgeCheckColor;
			tmp.fontSize = badgePx * 0.72f;
			tmp.textWrappingMode = TextWrappingModes.NoWrap;
		}

		badgeRect.localScale = Vector3.zero;
		Sequence seq = DOTween.Sequence();
		seq.SetUpdate(true);
		seq.SetLink(badgeGo, LinkBehaviour.KillOnDestroy);
		seq.Join(badgeGroup.DOFade(1f, solvedBadgePopSeconds * 0.6f).SetEase(Ease.OutQuad));
		seq.Join(badgeRect.DOScale(1.1f, solvedBadgePopSeconds).SetEase(Ease.OutBack));
		seq.Append(badgeRect.DOScale(1f, solvedBadgePopSeconds * 0.4f).SetEase(Ease.OutQuad));

		solvedBadgeObject = badgeGo;
	}
}
