using System;
using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;
using TMPro;

using DG.Tweening;
using LeTai.Asset.TranslucentImage;

public partial class DragExecutionController
{
	private void SetupBubbleVisuals(EquationBubbleElement bubble, TokenInfo token)
	{
		// If this bubble came from Saheed's Equation Bubble prefab (TranslucentImage + Text (TMP)),
		// do NOT spawn extra Background/Outline/Text children. Just update existing TMP + tint the root Graphic.
		Transform prefabTextTransform = bubble.transform.Find("Text (TMP)");
		if (prefabTextTransform != null)
		{
			TextMeshProUGUI prefabText = prefabTextTransform.GetComponent<TextMeshProUGUI>();
			if (prefabText != null)
			{
				RectTransform textRect = prefabText.rectTransform;
				textRect.localScale = Vector3.one;
				// Normalize prefab TMP geometry on every spawn so scene/prefab offsets cannot drift centering.
				textRect.anchorMin = Vector2.zero;
				textRect.anchorMax = Vector2.one;
				textRect.pivot = new Vector2(0.5f, 0.5f);
				textRect.sizeDelta = Vector2.zero;
				textRect.anchoredPosition = new Vector2(0f, bubbleTextVerticalOffset);
				float bubblePx = bubble.RectTransform != null ? Mathf.Max(1f, bubble.RectTransform.rect.width) : bubbleSize;

				// Special case: render multi-digit numbers as 1 bubble per digit (visual-only).
				if (ShouldSplitMultiDigit(token))
				{
					SetupSplitMultiDigitVisuals(bubble, token, prefabText);
				}
				else
				{
					TokenInfo displayToken = token;
					displayToken.text = GetDisplayTokenText(token);
					ApplyTextWithOptionalAnimator(prefabText, displayToken);
					if (token.isVariable || (token.isCoefficient && string.Equals((token.text ?? string.Empty).Trim(), "x", StringComparison.OrdinalIgnoreCase)))
					{
						DestroyTextAnimatorsRecursive(bubble.gameObject);
					}

					prefabText.alignment = TextAlignmentOptions.CenterGeoAligned;
					prefabText.textWrappingMode = TextWrappingModes.NoWrap;
					prefabText.raycastTarget = false;
					prefabText.overflowMode = TextOverflowModes.Overflow;
					prefabText.margin = Vector4.zero;

					// Mirror LockedInEquationUI metrics to keep baseline/centering consistent.
					prefabText.enableAutoSizing = false;
					float baseSize = Mathf.Clamp(bubblePx * 0.78f, 30f, 95f);
					string plain = StripRichTextTags(prefabText.text).Trim();
					int len = plain.Length;
					float scale = 1f;
					if (len == 1 && plain == "1") scale = 1.12f; // optical compensation: "1" reads narrower/smaller at equal point size
					if (len == 2) scale = 0.78f;
					else if (len >= 3) scale = 0.65f;
					prefabText.fontSize = Mathf.Max(18f, baseSize * scale);

					if (token.isVariable)
					{
						prefabText.color = variableColor;
					}
					else if (token.isCoefficient && token.text == "x")
					{
						// Special case: represent -x / -1x as a draggable "x" bubble (coefficient -1).
						prefabText.color = variableColor;
					}
					else
					{
						prefabText.color = numberColor;
					}
				}
			}

			// Optional: hide bubble background for standalone x (operator-like look).
			Graphic bgGraphic = bubble.GetComponent<Graphic>();
			if (bgGraphic != null)
			{
				Color c = bubbleBackgroundColor;
				if (token.isVariable && !variableHasBubble)
				{
					c.a = 0f;
				}
				bgGraphic.color = c;
				bgGraphic.raycastTarget = bubble.IsDraggable || bubble.ElementType == BubbleElementType.DropZone;

				// Some TranslucentImage setups need a sprite assigned to render; ensure we have one.
				if (bgGraphic is TranslucentImage ti && ti.sprite == null && circleSprite != null)
				{
					ti.sprite = circleSprite;
					ti.type = Image.Type.Simple;
				}

				// If this is a plain Unity Image bubble, allow a sprite fallback.
				if (circleSprite != null && !(bgGraphic is TranslucentImage) && bgGraphic is Image img && img.sprite == null)
				{
					img.sprite = circleSprite;
					img.type = Image.Type.Simple;
				}
			}

			// Apply a hollow "bubble" theme (outline always visible, fill appears on hover/drag/success).
			Color bg = bubbleBackgroundColor;
			Color bgHover = bubbleBackgroundColor;
			Color bgDrag = bubbleBackgroundColor;

			// If you feel like TranslucentImage "isn't visible", it's usually because alpha is 0.
			// Use these to control a subtle glass fill while keeping the bubble "empty".
			bg.a = Mathf.Clamp01(bubbleFillIdleAlpha);
			bgHover.a = Mathf.Clamp01(bubbleFillHoverAlpha);
			bgDrag.a = Mathf.Clamp01(bubbleFillDragAlpha);

			// Optional: hide bubble background for standalone x (operator-like look).
			if (token.isVariable && !variableHasBubble)
			{
				bg.a = 0f;
				bgHover.a = 0f;
				bgDrag.a = 0f;
			}
			Color outlineNormal = bubbleOutlineColor;
			Color outlineHighlight = bubbleDraggingOutline;

			// Subtle indicator:
			// - Variable bubbles use the variableColor as their accent (so no "rainbow" or unexpected tinting).
			// - Coefficients keep the algebraTermOutlineTint accent.
			bool isVariableGlyph = token.isVariable || (token.isCoefficient && string.Equals((token.text ?? string.Empty).Trim(), "x", StringComparison.OrdinalIgnoreCase));
			if (isVariableGlyph)
			{
				outlineNormal = Color.Lerp(bubbleOutlineColor, variableColor, 0.72f);
				outlineHighlight = Color.Lerp(bubbleDraggingOutline, variableColor, 0.25f);
			}
			else if (token.isCoefficient)
			{
				outlineNormal = Color.Lerp(bubbleOutlineColor, algebraTermOutlineTint, 0.55f);
				outlineHighlight = Color.Lerp(bubbleDraggingOutline, algebraTermOutlineTint, 0.25f);
			}

			// Keep the selected state visibly filled (per Figma feedback), but avoid a neon/"flooded" look.
			Color focusFill = Color.Lerp(bgDrag, outlineHighlight, 0.18f);
			focusFill.a = Mathf.Max(bgDrag.a, 0.18f);
			bubble.SetThemeColors(bg, bgHover, focusFill, outlineNormal, outlineHighlight, applyImmediately: true);

			// Variable idle feedback: subtle outline pulse (no moving text).
			if (pulseVariableBubbles && (token.isVariable || (token.isCoefficient && string.Equals((token.text ?? string.Empty).Trim(), "x", StringComparison.OrdinalIgnoreCase))))
			{
				Transform outlineT = bubble.transform.Find("Outline");
				Graphic outlineG = outlineT != null ? outlineT.GetComponent<Graphic>() : null;
				if (outlineG != null)
				{
					outlineG.DOKill();
					float baseAlpha = outlineG.color.a;
					float dip = Mathf.Clamp01(variablePulseWhitenStrength); // interpret as "how much to dip alpha"
					float pulseAlpha = Mathf.Clamp01(baseAlpha * (1f - dip));
					float half = Mathf.Max(0.05f, variablePulseSeconds) * 0.5f;
					outlineG.DOFade(pulseAlpha, half)
						.SetEase(Ease.InOutSine)
						.SetLoops(-1, LoopType.Yoyo)
						.SetLink(outlineG.gameObject, LinkBehaviour.KillOnDestroy);
				}
			}

			// Keep EquationBubbleElement in sync (used for hover/drag tint). No-op if prefab isn't Image-based.
			TryConfigureTranslucentCircle(bubble.gameObject, bubble.RectTransform);
			// Avoid assigning sprites to TranslucentImage-based bubble backgrounds; they are shader/paraform driven.
			// But we *do* allow an outline sprite to be applied for a clearer ring.
			if (circleSprite != null)
			{
				if (bubble.GetComponent<TranslucentImage>() == null)
				{
					bubble.SetBubbleSprite(circleSprite);
				}
				else
				{
					Transform outline = bubble.transform.Find("Outline");
					if (outline != null)
					{
						Image outlineImg = outline.GetComponent<Image>();
						if (outlineImg != null && outlineImg.sprite == null)
						{
							outlineImg.sprite = circleSprite;
							outlineImg.type = Image.Type.Sliced;
							outlineImg.raycastTarget = false;
						}
					}
				}
			}
			return;
		}

		// Variable "x" doesn't get a bubble - just text
		bool needsBubble = !token.isVariable;

		if (needsBubble)
		{
			// Create background (circular)
			Transform bgTransform = bubble.transform.Find("Background");
			Image bgImage;

			if (bgTransform == null)
			{
				GameObject bgObj = new GameObject("Background", typeof(RectTransform), typeof(Image));
				bgObj.transform.SetParent(bubble.transform, false);
				bgObj.transform.SetAsFirstSibling();
				bgImage = bgObj.GetComponent<Image>();
				RectTransform bgRect = bgObj.GetComponent<RectTransform>();
				bgRect.anchorMin = Vector2.zero;
				bgRect.anchorMax = Vector2.one;
				bgRect.sizeDelta = Vector2.zero;
			}
			else
			{
				bgImage = bgTransform.GetComponent<Image>();
			}

			bgImage.color = bubbleBackgroundColor;
			bgImage.sprite = circleSprite;
			bgImage.type = Image.Type.Sliced;

			// Create outline
			Transform outlineTransform = bubble.transform.Find("Outline");
			Image outlineImage;

			if (outlineTransform == null)
			{
				GameObject outlineObj = new GameObject("Outline", typeof(RectTransform), typeof(Image));
				outlineObj.transform.SetParent(bubble.transform, false);
				outlineObj.transform.SetAsFirstSibling();
				outlineImage = outlineObj.GetComponent<Image>();
				RectTransform outlineRect = outlineObj.GetComponent<RectTransform>();
				outlineRect.anchorMin = Vector2.zero;
				outlineRect.anchorMax = Vector2.one;
				outlineRect.sizeDelta = new Vector2(8f, 8f);
				outlineRect.anchoredPosition = Vector2.zero;
			}
			else
			{
				outlineImage = outlineTransform.GetComponent<Image>();
			}

			outlineImage.color = bubbleOutlineColor;
			outlineImage.sprite = circleSprite;
			outlineImage.type = Image.Type.Sliced;
			outlineImage.raycastTarget = false;
		}

		// Create text
		Transform textTransform = bubble.transform.Find("Text");
		TextMeshProUGUI text;

		if (textTransform == null)
		{
			GameObject textObj = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
			textObj.transform.SetParent(bubble.transform, false);
			text = textObj.GetComponent<TextMeshProUGUI>();
			RectTransform textRect = textObj.GetComponent<RectTransform>();
			textRect.anchorMin = Vector2.zero;
			textRect.anchorMax = Vector2.one;
			textRect.sizeDelta = Vector2.zero;
		}
		else
		{
			text = textTransform.GetComponent<TextMeshProUGUI>();
		}

		ApplyEquationTextStyle(text);
		TokenInfo fallbackDisplayToken = token;
		fallbackDisplayToken.text = GetDisplayTokenText(token);
		ApplyTextWithOptionalAnimator(text, fallbackDisplayToken);
		float fallbackBubblePx = bubble.RectTransform != null ? Mathf.Max(1f, bubble.RectTransform.rect.width) : bubbleSize;
		float fallbackBaseSize = Mathf.Clamp(fallbackBubblePx * 0.78f, 30f, 95f);
		string fallbackPlain = StripRichTextTags(text.text).Trim();
		int fallbackLen = fallbackPlain.Length;
		float fallbackScale = 1f;
		if (fallbackLen == 1 && fallbackPlain == "1") fallbackScale = 1.12f;
		if (fallbackLen == 2) fallbackScale = 0.78f;
		else if (fallbackLen >= 3) fallbackScale = 0.65f;
		text.fontSize = Mathf.Max(18f, fallbackBaseSize * fallbackScale);
		text.fontStyle = FontStyles.Bold;
		text.alignment = TextAlignmentOptions.CenterGeoAligned;
		text.textWrappingMode = TextWrappingModes.NoWrap;
		text.overflowMode = TextOverflowModes.Overflow;
		text.margin = Vector4.zero;
		text.enableAutoSizing = false;
		text.raycastTarget = false;

		// Set text color based on element type
		if (token.isVariable)
		{
			text.color = variableColor;
		}
		else if (token.isCoefficient && string.Equals((token.text ?? "").Trim(), "x", StringComparison.OrdinalIgnoreCase))
		{
			// Special case: coefficient "-1" is represented as a draggable "x" bubble.
			text.color = variableColor;
		}
		else if (token.isCoefficient)
		{
			text.color = numberColor; // Coefficient is a number
		}
		else
		{
			text.color = numberColor;
		}

		if (circleSprite != null && bubble.GetComponent<TranslucentImage>() == null)
		{
			bubble.SetBubbleSprite(circleSprite);
		}
	}


	private void CreateDigitVisualBubble(RectTransform parent, string digit, Vector2 anchoredPos, float diameter, List<Graphic> bgTargets, List<Graphic> outlineTargets)
	{
		if (parent == null)
		{
			return;
		}

		GameObject digitObj;
		if (bubbleElementPrefab != null)
		{
			digitObj = Instantiate(bubbleElementPrefab, parent);
		}
		else
		{
			digitObj = new GameObject("DigitBubble", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
			digitObj.transform.SetParent(parent, false);
		}

		digitObj.name = $"Digit_{digit}";

		// Strip/disable any extra graphics from the prefab (shadows/highlights/fills) so digits never
		// create phantom rings between them. Keep the ROOT background graphic so we can still render a subtle glass fill.
		Graphic[] graphics = digitObj.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			Graphic g = graphics[i];
			if (g == null) continue;

			// Keep TMP enabled (we'll style it below).
			if (g is TextMeshProUGUI) continue;

			// Keep the root background graphic (configured below).
			if (g.transform == digitObj.transform) continue;

			// Keep the Outline ring only.
			if (g.transform != null && g.transform.name == "Outline") continue;

			// Everything else: disable.
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

		// Make sure this is visual-only (no input).
		EquationBubbleElement maybeBubble = digitObj.GetComponent<EquationBubbleElement>();
		if (maybeBubble != null)
		{
			Destroy(maybeBubble);
		}

		CanvasGroup cg = digitObj.GetComponent<CanvasGroup>();
		if (cg == null)
		{
			cg = digitObj.AddComponent<CanvasGroup>();
		}
		if (cg != null)
		{
			cg.interactable = false;
			cg.blocksRaycasts = false;
			cg.ignoreParentGroups = false;
		}

		RectTransform rt = digitObj.GetComponent<RectTransform>();
		rt.anchorMin = new Vector2(0.5f, 0.5f);
		rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.pivot = new Vector2(0.5f, 0.5f);
		rt.sizeDelta = new Vector2(diameter, diameter);
		rt.anchoredPosition = anchoredPos;
		rt.localScale = Vector3.one;

		Graphic bg = digitObj.GetComponent<Graphic>();
		if (bg != null)
		{
			bg.raycastTarget = false;
			// Subtle glass fill per digit. (We avoid overlap artifacts by keeping digits separated via spacing.)
			Color c = bubbleBackgroundColor;
			c.a = Mathf.Clamp01(bubbleFillIdleAlpha * 0.75f);
			if (bg is TranslucentImage ti)
			{
				ti.enabled = true;
				ti.foregroundOpacity = c.a;
				c.a = 1f;
				ti.color = c;
				// Prefer a sprite if the prefab has none (some setups need a sprite to render).
				if (ti.sprite == null && circleSprite != null)
				{
					ti.sprite = circleSprite;
					ti.type = Image.Type.Simple;
				}
			}
			else
			{
				bg.color = c;
				if (bg is Image img && img.sprite == null && circleSprite != null)
				{
					img.sprite = circleSprite;
					img.type = Image.Type.Simple;
				}
			}
			if (bgTargets != null)
			{
				bgTargets.Add(bg);
			}
		}

		// Add a simple ring outline if needed (keeps the "bubble" read even on busy backgrounds).
		if (circleSprite != null)
		{
			Transform outline = digitObj.transform.Find("Outline");
			Image outlineImg = null;
			bool createdOutline = false;

			if (outline == null)
			{
				GameObject outlineObj = new GameObject("Outline", typeof(RectTransform), typeof(Image));
				outlineObj.transform.SetParent(digitObj.transform, false);
				outlineObj.transform.SetAsFirstSibling();
				outlineImg = outlineObj.GetComponent<Image>();
				createdOutline = true;
				RectTransform outlineRt = outlineObj.GetComponent<RectTransform>();
				outlineRt.anchorMin = Vector2.zero;
				outlineRt.anchorMax = Vector2.one;
				outlineRt.anchoredPosition = Vector2.zero;
				outlineRt.sizeDelta = Vector2.zero;
			}
			else
			{
				outlineImg = outline.GetComponent<Image>();
			}

			if (outlineImg != null)
			{
				// Normalize outline sizing: the prefab outline sometimes has padding that causes overlap artifacts.
				RectTransform outlineRt = outlineImg.rectTransform;
				outlineRt.anchorMin = Vector2.zero;
				outlineRt.anchorMax = Vector2.one;
				outlineRt.pivot = new Vector2(0.5f, 0.5f);
				outlineRt.anchoredPosition = Vector2.zero;
				outlineRt.sizeDelta = Vector2.zero;

				// Keep the prefab-provided outline sprite (stroke) if present.
				if (createdOutline || outlineImg.sprite == null)
				{
					outlineImg.sprite = circleSprite;
					outlineImg.type = Image.Type.Sliced;
				}
				outlineImg.color = bubbleOutlineColor;
				outlineImg.raycastTarget = false;
				if (outlineTargets != null)
				{
					outlineTargets.Add(outlineImg);
				}
			}
		}

		Transform tmpTransform = digitObj.transform.Find("Text (TMP)") ?? digitObj.transform.Find("Text");
		TextMeshProUGUI tmp = tmpTransform != null ? tmpTransform.GetComponent<TextMeshProUGUI>() : digitObj.GetComponentInChildren<TextMeshProUGUI>(true);
		if (tmp != null)
		{
			RectTransform textRect = tmp.rectTransform;
			textRect.anchorMin = Vector2.zero;
			textRect.anchorMax = Vector2.one;
			textRect.pivot = new Vector2(0.5f, 0.5f);
			textRect.anchoredPosition = new Vector2(0f, bubbleTextVerticalOffset);
			textRect.sizeDelta = Vector2.zero;

				tmp.text = digit;
				tmp.alignment = TextAlignmentOptions.CenterGeoAligned;
				tmp.textWrappingMode = TextWrappingModes.NoWrap;
				tmp.raycastTarget = false;
				tmp.overflowMode = TextOverflowModes.Overflow;
				tmp.margin = Vector4.zero;
				tmp.enableAutoSizing = false;
				float digitScale = digit == "1" ? 0.87f : 0.78f;
				tmp.fontSize = Mathf.Clamp(diameter * digitScale, 30f, 95f);
			tmp.color = numberColor;
		}

		// Safety: ensure no text-animators remain on digit visuals (they can create wiggle/rainbow artifacts).
		DestroyTextAnimator(tmp);

		TryConfigureTranslucentCircle(digitObj, rt);
	}

	private void ApplyTextWithOptionalAnimator(TextMeshProUGUI tmp, TokenInfo token)
	{
		if (tmp == null)
		{
			return;
		}

		string plain = token.text ?? string.Empty;

		// Force variable/coefficient-x text to be stable (no Febucci wiggle/rainbow).
		// We'll use subtle outline pulsing instead.
		bool isVariableGlyph = token.isVariable || (token.isCoefficient && string.Equals(plain.Trim(), "x", StringComparison.OrdinalIgnoreCase));
		if (isVariableGlyph)
		{
			DestroyTextAnimator(tmp);
			tmp.text = plain;
			return;
		}

		if (!useVariableBubbleFx || !token.isVariable)
		{
			tmp.text = plain;
			return;
		}

		Component animator = EnsureTextAnimator(tmp);
		if (animator == null)
		{
			tmp.text = plain;
			return;
		}

		string tags = (variableBubbleEffectTags ?? "").Trim();
		if (string.IsNullOrWhiteSpace(tags))
		{
			TrySetTextAnimatorText(animator, plain);
			return;
		}

		string[] parts = tags.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
		System.Text.StringBuilder sb = new System.Text.StringBuilder();
		for (int i = 0; i < parts.Length; i++)
		{
			sb.Append('<').Append(parts[i]).Append('>');
		}
		sb.Append(plain).Append("</>");
		TrySetTextAnimatorText(animator, sb.ToString());
	}

	private void SetupSplitMultiDigitVisuals(EquationBubbleElement bubble, TokenInfo token, TextMeshProUGUI prefabText)
	{
		if (bubble == null)
		{
			return;
		}

		// Hide the parent TMP and parent bubble visuals; the child digit bubbles will carry the visuals.
		if (prefabText != null)
		{
			prefabText.text = "";
			prefabText.gameObject.SetActive(false);
		}

		bubble.ClearExternalVisualTargets();

		// Hide the parent outline object entirely so it can never "reappear" behind the digit rings.
		Transform parentOutline = bubble.transform.Find("Outline");
		if (parentOutline != null)
		{
			parentOutline.gameObject.SetActive(false);
		}

		Graphic parentGraphic = bubble.GetComponent<Graphic>();
		if (parentGraphic != null)
		{
			// TranslucentImage uses foregroundOpacity (not color alpha) to blend, so we must explicitly zero it
			// or the parent "capsule/circle" will still render behind the digit bubbles (looks like a 3rd circle).
			TranslucentImage ti = parentGraphic as TranslucentImage;
			if (ti != null)
			{
				ti.foregroundOpacity = 0f;
				ti.enabled = false; // hard-disable rendering to avoid the "3rd circle" artifact
				Color c = ti.color;
				c.a = 0f;
				ti.color = c;
				// Keep raycastTarget ON so the parent token remains draggable.
			}
			else
			{
				Color c = parentGraphic.color;
				parentGraphic.color = new Color(c.r, c.g, c.b, 0f);
			}
		}

		// Some prefabs include extra overlay graphics (shadows/highlights) that can show up as a "third circle"
		// once we render the inner digit bubbles. Hard-disable any remaining Graphics on the parent (except the
		// explicit RaycastTarget we add below).
		Graphic[] allGraphics = bubble.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < allGraphics.Length; i++)
		{
			Graphic g = allGraphics[i];
			if (g == null) continue;
			if (g.transform == bubble.transform) continue; // handled above
			if (g.transform != null && g.transform.name == "RaycastTarget") continue;
			if (prefabText != null && g.gameObject == prefabText.gameObject) continue;
			if (g.transform != null && g.transform.name == "Outline") continue; // already disabled above
			if (g.transform != null && g.transform.name == "DigitBubbles") continue; // created later

			// Keep this graphic around but invisible (avoid accidentally breaking layout scripts/components).
			Color c = g.color;
			c.a = 0f;
			g.color = c;
			g.enabled = false;
		}

		// Ensure the parent token is still draggable even after disabling its TranslucentImage.
		Transform existingRaycast = bubble.transform.Find("RaycastTarget");
		if (existingRaycast == null)
		{
			GameObject rayObj = new GameObject("RaycastTarget", typeof(RectTransform), typeof(Image));
			rayObj.transform.SetParent(bubble.transform, false);
			rayObj.transform.SetAsFirstSibling();
			RectTransform rrt = rayObj.GetComponent<RectTransform>();
			rrt.anchorMin = Vector2.zero;
			rrt.anchorMax = Vector2.one;
			rrt.anchoredPosition = Vector2.zero;
			rrt.sizeDelta = Vector2.zero;
			Image img = rayObj.GetComponent<Image>();
			img.raycastTarget = true;
			img.color = new Color(1f, 1f, 1f, 0f);
			// Ensure raycasts work even when invisible.
			img.sprite = circleSprite != null ? circleSprite : GetFallbackWhiteSprite();
			img.type = Image.Type.Simple;
		}

		Transform existing = bubble.transform.Find("DigitBubbles");
		if (existing != null)
		{
			existing.DOKill();
			Destroy(existing.gameObject);
		}

		RectTransform bubbleRect = bubble.RectTransform;
		float diameter = bubbleRect != null ? Mathf.Max(1f, bubbleRect.rect.height) : bubbleSize;
		float d = diameter * Mathf.Clamp(digitBubbleScale, 0.7f, 1f);
		float inner = Mathf.Max(0f, d * doubleDigitInnerSpacingRatio);

		GameObject containerObj = new GameObject("DigitBubbles", typeof(RectTransform));
		containerObj.transform.SetParent(bubble.transform, false);
		RectTransform container = containerObj.GetComponent<RectTransform>();
		container.anchorMin = new Vector2(0.5f, 0.5f);
		container.anchorMax = new Vector2(0.5f, 0.5f);
		container.pivot = new Vector2(0.5f, 0.5f);
		container.anchoredPosition = Vector2.zero;
		container.sizeDelta = Vector2.zero;

		string s = (token.text ?? "").Trim();
		if (s.Length < 2)
		{
			return;
		}

		float step = d + inner;
		float startX = -((s.Length - 1) * step) * 0.5f;
		List<Graphic> bgTargets = new List<Graphic>(s.Length);
		List<Graphic> outlineTargets = new List<Graphic>(s.Length);
		for (int i = 0; i < s.Length; i++)
		{
			CreateDigitVisualBubble(container, s[i].ToString(), new Vector2(startX + (i * step), 0f), d, bgTargets, outlineTargets);
		}

		// Drive hover/drag fills + outline highlights through the child digit bubbles instead of the hidden parent.
		bubble.SetExternalVisualTargets(bgTargets, outlineTargets);
	}

	private static Sprite GetFallbackWhiteSprite()
	{
		if (fallbackWhiteSprite != null)
		{
			return fallbackWhiteSprite;
		}

		Texture2D tex = Texture2D.whiteTexture;
		fallbackWhiteSprite = Sprite.Create(tex, new Rect(0f, 0f, tex.width, tex.height), new Vector2(0.5f, 0.5f), pixelsPerUnit: 100f);
		fallbackWhiteSprite.name = "DragExecutionController_FallbackWhiteSprite";
		return fallbackWhiteSprite;
	}

	private static Sprite GetFallbackPillSprite()
	{
		if (fallbackPillSprite != null)
		{
			return fallbackPillSprite;
		}

		const int width = 256;
		const int height = 64;
		int radiusPx = height / 2;
		Texture2D tex = new Texture2D(width, height, TextureFormat.ARGB32, false)
		{
			filterMode = FilterMode.Bilinear,
			wrapMode = TextureWrapMode.Clamp,
			name = "DragExecutionController_FallbackPillTexture"
		};

		Color[] pixels = new Color[width * height];
		Vector2 a = new Vector2(radiusPx, height * 0.5f);
		Vector2 b = new Vector2(width - radiusPx, height * 0.5f);
		const float aa = 1.5f;
		for (int y = 0; y < height; y++)
		{
			float py = y + 0.5f;
			int row = y * width;
			for (int x = 0; x < width; x++)
			{
				float px = x + 0.5f;
				Vector2 p = new Vector2(px, py);
				Vector2 ab = b - a;
				float t = Vector2.Dot(p - a, ab) / Mathf.Max(0.0001f, Vector2.Dot(ab, ab));
				t = Mathf.Clamp01(t);
				Vector2 q = a + (ab * t);
				float sdf = Vector2.Distance(p, q) - radiusPx;
				float alpha = Mathf.Clamp01(0.5f - (sdf / aa));
				pixels[row + x] = new Color(1f, 1f, 1f, alpha);
			}
		}

		tex.SetPixels(pixels);
		tex.Apply(updateMipmaps: false, makeNoLongerReadable: false);

		Vector4 border = new Vector4(radiusPx, radiusPx, radiusPx, radiusPx);
		fallbackPillSprite = Sprite.Create(
			tex,
			new Rect(0f, 0f, width, height),
			new Vector2(0.5f, 0.5f),
			pixelsPerUnit: 100f,
			extrude: 0,
			SpriteMeshType.FullRect,
			border);
		fallbackPillSprite.name = "DragExecutionController_FallbackPillSprite";
		return fallbackPillSprite;
	}

	private static float SnapValueToCanvasPixel(float value, float scaleFactor)
	{
		float s = Mathf.Max(0.0001f, scaleFactor);
		return Mathf.Round(value * s) / s;
	}


}
