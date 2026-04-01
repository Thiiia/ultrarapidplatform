using System;

using DG.Tweening;

using LeTai.Asset.TranslucentImage;

using TMPro;

using UnityEngine;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private bool TryFindTermBuddyVariable(EquationBubbleElement element, out EquationBubbleElement variableBubble)
	{
		variableBubble = null;
		if (element == null || element.ElementType != BubbleElementType.Coefficient)
		{
			return false;
		}

		if (bubbleElements == null || bubbleElements.Count == 0)
		{
			return false;
		}

		Vector2 basePos = element.OriginalPosition;
		float maxDist = bubbleSize * 2.2f;
		float best = float.MaxValue;

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement other = bubbleElements[i];
			if (other == null || other == element) continue;
			if (other.ElementType != BubbleElementType.Variable) continue;
			if (other.EquationSide != element.EquationSide) continue;

			Vector2 p = other.OriginalPosition;
			if (p.x <= basePos.x) continue; // only "next" buddy to the right
			if (Mathf.Abs(p.y - basePos.y) > bubbleSize * 0.6f) continue;

			float d = Vector2.Distance(basePos, p);
			if (d <= maxDist && d < best)
			{
				best = d;
				variableBubble = other;
			}
		}

		return variableBubble != null;
	}

	private void CreateOrRefreshDragPreview(EquationBubbleElement element)
	{
		if (equationContainer == null || element == null)
		{
			return;
		}

		if (element.ElementType == BubbleElementType.Variable || element.ElementType == BubbleElementType.Operator || element.ElementType == BubbleElementType.DropZone)
		{
			return;
		}

		// Rebuild each drag so the visuals always match the dragged token.
		ClearDragPreviewDigitBubbles();
		ClearDragGhostGroups();

		if (dragPreviewRoot == null)
		{
			dragPreviewRoot = new GameObject("DragPreview", typeof(RectTransform), typeof(CanvasGroup));
			dragPreviewRoot.transform.SetParent(equationContainer, false);
			dragPreviewRootRect = dragPreviewRoot.GetComponent<RectTransform>();
			dragPreviewRootRect.anchorMin = new Vector2(0.5f, 0.5f);
			dragPreviewRootRect.anchorMax = new Vector2(0.5f, 0.5f);
			dragPreviewRootRect.pivot = new Vector2(0.5f, 0.5f);
			dragPreviewRootRect.anchoredPosition = Vector2.zero;
			dragPreviewRootRect.sizeDelta = Vector2.zero;
		}

		CanvasGroup rootCg = dragPreviewRoot.GetComponent<CanvasGroup>();
		if (rootCg != null)
		{
			rootCg.interactable = false;
			rootCg.blocksRaycasts = false;
			rootCg.ignoreParentGroups = false;

			rootCg.DOKill();
			rootCg.alpha = 0f;
			rootCg.DOFade(Mathf.Clamp01(dragPreviewAlpha), Mathf.Max(0.01f, dragPreviewFadeSeconds)).SetUpdate(true);
		}

		string display = (element.DisplayText ?? "").Trim();
		bool isTermPreview = element.ElementType == BubbleElementType.Coefficient && TryFindTermBuddyVariable(element, out _);

		string[] glyphs;
		int visualCharCount;
		if (isTermPreview)
		{
			// Single bubble preview like "6x" (x tinted) while dragging the coefficient.
			string varHex = ColorUtility.ToHtmlStringRGBA(variableColor);
			glyphs = new[] { $"{display}<color=#{varHex}>x</color>" };
			visualCharCount = display.Length + 1;
		}
		else if (display.Length >= 2 && IsAllDigits(display))
		{
			glyphs = new string[display.Length];
			for (int i = 0; i < display.Length; i++)
			{
				glyphs[i] = display[i].ToString();
			}
			visualCharCount = 1;
		}
		else
		{
			glyphs = new[] { display };
			visualCharCount = Mathf.Max(1, display.Length);
		}

		float digitDiameter = bubbleSize * (glyphs.Length >= 2 ? Mathf.Clamp(digitBubbleScale, 0.7f, 1f) : 1f);
		float inner = Mathf.Max(0f, digitDiameter * doubleDigitInnerSpacingRatio);
		float step = digitDiameter + inner;
		float startX = -((glyphs.Length - 1) * step) * 0.5f;

		int count = Mathf.Clamp(dragGhostCount, 4, 32);
		for (int g = 0; g < count; g++)
		{
			GameObject groupObj = new GameObject($"Ghost_{g}", typeof(RectTransform), typeof(CanvasGroup));
			groupObj.transform.SetParent(dragPreviewRoot.transform, false);

			RectTransform grt = groupObj.GetComponent<RectTransform>();
			grt.anchorMin = new Vector2(0.5f, 0.5f);
			grt.anchorMax = new Vector2(0.5f, 0.5f);
			grt.pivot = new Vector2(0.5f, 0.5f);
			grt.anchoredPosition = element.OriginalPosition;
			grt.sizeDelta = Vector2.zero;

			CanvasGroup gcg = groupObj.GetComponent<CanvasGroup>();
			gcg.interactable = false;
			gcg.blocksRaycasts = false;
			gcg.ignoreParentGroups = false;
			gcg.alpha = 0f;

			for (int i = 0; i < glyphs.Length; i++)
			{
				Vector2 p = new Vector2(startX + (i * step), 0f);
				CreateDragPreviewDigitBubble(groupObj.transform, glyphs[i], p, digitDiameter, visualCharCount);
			}

			dragGhostGroups.Add(groupObj);
		}

		// Cache the initial distance so "highlighting the further you go" can be based on progress to target.
		dragGhostStartDistanceToTarget = 1f;
		if (currentDropZone != null)
		{
			dragGhostStartDistanceToTarget = Mathf.Max(1f, Vector2.Distance(element.OriginalPosition, currentDropZone.OriginalPosition));
		}

		dragPreviewIsShowing = true;
	}

	private void CreateDragPreviewDigitBubble(Transform parent, string digit, Vector2 anchoredPos, float diameter, int visualCharCount)
	{
		if (parent == null)
		{
			return;
		}

		GameObject bubbleObj;
		if (bubbleElementPrefab != null)
		{
			bubbleObj = Instantiate(bubbleElementPrefab, parent);
		}
		else
		{
			bubbleObj = new GameObject("PreviewBubble", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
			bubbleObj.transform.SetParent(parent, false);
		}

		bubbleObj.name = $"Preview_{digit}";

		// Strip/disable extra graphics so preview rings don't create overlap artifacts.
		Graphic[] graphics = bubbleObj.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			Graphic g = graphics[i];
			if (g == null) continue;
			if (g is TextMeshProUGUI) continue;
			if (g.transform != null && g.transform.name == "Outline") continue;

			if (g is TranslucentImage tiG)
			{
				tiG.foregroundOpacity = 0f;
				tiG.enabled = false;
			}

			Color c = g.color;
			c.a = 0f;
			g.color = c;
			g.enabled = false;
		}

		EquationBubbleElement maybe = bubbleObj.GetComponent<EquationBubbleElement>();
		if (maybe != null)
		{
			Destroy(maybe);
		}

		CanvasGroup cg = bubbleObj.GetComponent<CanvasGroup>();
		if (cg == null) cg = bubbleObj.AddComponent<CanvasGroup>();
		cg.interactable = false;
		cg.blocksRaycasts = false;
		cg.alpha = 1f;

		RectTransform rt = bubbleObj.GetComponent<RectTransform>();
		rt.anchorMin = new Vector2(0.5f, 0.5f);
		rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.pivot = new Vector2(0.5f, 0.5f);
		rt.sizeDelta = new Vector2(diameter, diameter);
		rt.anchoredPosition = anchoredPos;
		rt.localScale = Vector3.one;

		// Hollow bubble fill
		Graphic bg = bubbleObj.GetComponent<Graphic>();
		if (bg != null)
		{
			bg.raycastTarget = false;
			Color c = bg.color;
			c.a = 0f;
			bg.color = c;
			if (bg is TranslucentImage ti)
			{
				ti.foregroundOpacity = 0f;
				ti.enabled = false;
			}
		}

		// Outline highlight
		Transform outlineT = bubbleObj.transform.Find("Outline");
		Graphic outlineG = outlineT != null ? outlineT.GetComponent<Graphic>() : null;
		if (outlineG != null)
		{
			// Normalize outline sizing so multi-digit previews don't produce a phantom "third ring".
			RectTransform ort = outlineG.rectTransform;
			ort.anchorMin = Vector2.zero;
			ort.anchorMax = Vector2.one;
			ort.pivot = new Vector2(0.5f, 0.5f);
			ort.anchoredPosition = Vector2.zero;
			ort.sizeDelta = Vector2.zero;

			Color oc = dragPreviewOutlineColor;
			oc.a = outlineG.color.a > 0f ? outlineG.color.a : oc.a;
			outlineG.color = oc;
		}

		Transform tmpT = bubbleObj.transform.Find("Text (TMP)") ?? bubbleObj.transform.Find("Text");
		TextMeshProUGUI tmp = tmpT != null ? tmpT.GetComponent<TextMeshProUGUI>() : bubbleObj.GetComponentInChildren<TextMeshProUGUI>(true);
		if (tmp != null)
		{
			ApplyEquationTextStyle(tmp);

			RectTransform tr = tmp.rectTransform;
			tr.anchorMin = Vector2.zero;
			tr.anchorMax = Vector2.one;
			tr.anchoredPosition = new Vector2(0f, bubbleTextVerticalOffset);
			tr.sizeDelta = Vector2.zero;

			tmp.text = digit;
			tmp.textWrappingMode = TextWrappingModes.NoWrap;
			tmp.overflowMode = TextOverflowModes.Overflow;
			tmp.alignment = TextAlignmentOptions.CenterGeoAligned;
			tmp.margin = Vector4.zero;
			tmp.enableAutoSizing = false;
			float mul = visualCharCount >= 2 ? 0.56f : 0.78f;
			tmp.fontSize = Mathf.Clamp(diameter * mul, 22f, 95f);
			tmp.raycastTarget = false;
			tmp.color = numberColor;
		}

		// Drag preview text must stay stable (no Febucci wiggle/rainbow).
		if (tmp != null)
		{
			DestroyTextAnimator(tmp);
		}

		TryConfigureTranslucentCircle(bubbleObj, rt);
		dragPreviewDigitBubbles.Add(bubbleObj);
	}

	private void ClearDragGhostGroups()
	{
		for (int i = 0; i < dragGhostGroups.Count; i++)
		{
			GameObject go = dragGhostGroups[i];
			if (go == null) continue;
			go.transform.DOKill();
			CanvasGroup cg = go.GetComponent<CanvasGroup>();
			if (cg != null) cg.DOKill();
			Destroy(go);
		}
		dragGhostGroups.Clear();
	}

	private void ClearDragPreviewDigitBubbles()
	{
		for (int i = 0; i < dragPreviewDigitBubbles.Count; i++)
		{
			GameObject go = dragPreviewDigitBubbles[i];
			if (go == null) continue;
			go.transform.DOKill();
			Graphic g = go.GetComponent<Graphic>();
			if (g != null) g.DOKill();
			Destroy(go);
		}
		dragPreviewDigitBubbles.Clear();
	}

	private void UpdateDragPreview(EquationBubbleElement element, Vector2 dragPosition)
	{
		if (!dragPreviewIsShowing || dragPreviewRootRect == null || element == null)
		{
			return;
		}

		if (trailPoints == null || trailPoints.Count == 0 || dragGhostGroups.Count == 0)
		{
			return;
		}

		float progress = 0f;
		if (currentDropZone != null)
		{
			float dist = Vector2.Distance(dragPosition, currentDropZone.OriginalPosition);
			progress = Mathf.Clamp01(1f - (dist / Mathf.Max(1f, dragGhostStartDistanceToTarget)));
		}

		float easedProgress = Mathf.SmoothStep(0f, 1f, progress);
		int count = dragGhostGroups.Count;
		int pointCount = trailPoints.Count;
		float time = Time.unscaledTime;
		float speed01 = Mathf.Clamp01(dragSpeedVisual01);
		float speedEased = Mathf.SmoothStep(0f, 1f, speed01);

		Color baseColor = trailGradient != null ? trailGradient.Evaluate(easedProgress) : Color.yellow;

		for (int g = 0; g < count; g++)
		{
			GameObject groupObj = dragGhostGroups[g];
			if (groupObj == null) continue;

			float age01 = count <= 1 ? 0f : (g / (float)(count - 1)); // 0 = newest
			float trailStretchExponent = Mathf.Lerp(1.65f, Mathf.Lerp(0.95f, 0.72f, Mathf.Clamp01(dragGhostSpeedStretch)), speedEased);
			float sampledAge01 = Mathf.Pow(age01, Mathf.Max(0.35f, trailStretchExponent));
			// trailPoints is newest-first (index 0 is current position)
			int pointIndex = Mathf.RoundToInt(sampledAge01 * (pointCount - 1));
			pointIndex = Mathf.Clamp(pointIndex, 0, pointCount - 1);

			RectTransform grt = groupObj.GetComponent<RectTransform>();
			if (grt != null)
			{
				grt.anchoredPosition = trailPoints[pointIndex];

				// Keep the preview stable; avoid "bobbing"/pulsing that reads as noisy UI.
				float pulse = 1f;
				float pulseAmt = Mathf.Clamp(dragGhostPulseScale, 0f, 0.06f) * Mathf.Lerp(0.35f, 1f, speedEased);
				if (pulseAmt > 0.0001f)
				{
					float pulseRate = Mathf.Lerp(1.75f, 3.2f, speedEased);
					pulse = 1f + (Mathf.Sin(time * pulseRate + g) * pulseAmt);
				}
				float speedScaleMul = Mathf.Lerp(0.92f, 1.16f, speedEased);
				float scale = Mathf.Lerp(dragGhostMaxScale, dragGhostMinScale, age01) * Mathf.Lerp(0.88f, 1.12f, easedProgress) * speedScaleMul * pulse;
				grt.localScale = Vector3.one * scale;
			}

			CanvasGroup cg = groupObj.GetComponent<CanvasGroup>();
			if (cg != null)
			{
				float speedAlphaMul = Mathf.Lerp(Mathf.Clamp01(1f - Mathf.Clamp01(dragGhostSlowAlphaDampen)), 1f, speedEased);
				float a = Mathf.Lerp(dragGhostMaxAlpha, dragGhostMinAlpha, age01) * Mathf.Lerp(0.32f, 1f, easedProgress) * speedAlphaMul;
				cg.alpha = Mathf.Clamp01(a);
			}

			// Keep ghost trail tasteful: use the trail gradient + a subtle brightness ramp (no rainbow cycling).
			float brighten = Mathf.Lerp(0.05f, 0.24f, Mathf.Max(easedProgress, speedEased * 0.8f));
			Color outlineColor = Color.Lerp(baseColor, Color.white, brighten);
			outlineColor.a = 1f;

			Color textColor = Color.Lerp(Color.white, outlineColor, 0.35f);
			float fillAlpha = Mathf.Lerp(0f, 0.14f, easedProgress) * Mathf.Lerp(1f, 0.25f, age01) * Mathf.Lerp(0.45f, 1f, speedEased);

			for (int i = 0; i < groupObj.transform.childCount; i++)
			{
				Transform child = groupObj.transform.GetChild(i);
				if (child == null) continue;

				Graphic bg = child.GetComponent<Graphic>();
				if (bg != null)
				{
					Color c = bg.color;
					c.a = fillAlpha;
					bg.color = c;
				}

				Transform outlineT = child.Find("Outline");
				Graphic outlineG = outlineT != null ? outlineT.GetComponent<Graphic>() : null;
				TextMeshProUGUI tmp = child.GetComponentInChildren<TextMeshProUGUI>(true);
				bool hasInlineColor = tmp != null && tmp.text != null && tmp.text.IndexOf("<color", StringComparison.OrdinalIgnoreCase) >= 0;
				bool isXOnly = tmp != null && !hasInlineColor && string.Equals((tmp.text ?? "").Trim(), "x", StringComparison.OrdinalIgnoreCase);

				if (outlineG != null)
				{
					if (isXOnly)
					{
						Color xOutline = Color.Lerp(bubbleOutlineColor, algebraTermOutlineTint, 0.65f);
						xOutline.a = outlineColor.a;
						outlineG.color = xOutline;
					}
					else
					{
						outlineG.color = outlineColor;
					}
				}

				if (tmp != null)
				{
					// Respect rich-text (term preview like "6<color=...>x</color>") so the x doesn't turn into a gradient/rainbow.
					if (hasInlineColor)
					{
						// leave TMP color untouched
					}
					else if (isXOnly)
					{
						tmp.color = variableColor;
					}
					else
					{
						tmp.color = textColor;
					}
				}
			}
		}
	}

	private void DestroyDragPreview()
	{
		dragPreviewIsShowing = false;

		if (dragPreviewRoot == null)
		{
			return;
		}

		CanvasGroup cg = dragPreviewRoot.GetComponent<CanvasGroup>();
		if (cg != null)
		{
			cg.DOKill();
			cg.DOFade(0f, Mathf.Max(0.01f, dragPreviewFadeSeconds)).SetUpdate(true).OnComplete(() =>
			{
				if (dragPreviewRoot == null) return;
				ClearDragPreviewDigitBubbles();
				ClearDragGhostGroups();
				dragPreviewRoot.transform.DOKill();
					Destroy(dragPreviewRoot);
					dragPreviewRoot = null;
					dragPreviewRootRect = null;
				});
				return;
			}

		ClearDragPreviewDigitBubbles();
		ClearDragGhostGroups();
		dragPreviewRoot.transform.DOKill();
		Destroy(dragPreviewRoot);
		dragPreviewRoot = null;
		dragPreviewRootRect = null;
	}
}
