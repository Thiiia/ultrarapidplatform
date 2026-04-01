using System.Collections.Generic;
using TMPro;
using UnityEngine;

public partial class DragExecutionController
{
	// Store operator labels separately (not bubbles).
	private readonly List<GameObject> operatorLabels = new List<GameObject>();

	private static bool FontAssetSupportsGlyphRecursive(TMP_FontAsset font, char glyph, HashSet<int> visited)
	{
		if (font == null || glyph == '\0')
		{
			return false;
		}

		if (visited == null)
		{
			visited = new HashSet<int>();
		}

		int id = font.GetInstanceID();
		if (!visited.Add(id))
		{
			return false;
		}

		if (font.HasCharacter(glyph))
		{
			return true;
		}

		List<TMP_FontAsset> fallbackTable = font.fallbackFontAssetTable;
		if (fallbackTable == null)
		{
			return false;
		}

		for (int i = 0; i < fallbackTable.Count; i++)
		{
			if (FontAssetSupportsGlyphRecursive(fallbackTable[i], glyph, visited))
			{
				return true;
			}
		}

		return false;
	}

	private static bool FontSupportsGlyphInTmpFallbackChain(TMP_FontAsset primaryFont, char glyph)
	{
		if (glyph == '\0')
		{
			return false;
		}

		HashSet<int> visited = new HashSet<int>();

		if (FontAssetSupportsGlyphRecursive(primaryFont, glyph, visited))
		{
			return true;
		}

		if (TMP_Settings.defaultFontAsset != null &&
			FontAssetSupportsGlyphRecursive(TMP_Settings.defaultFontAsset, glyph, visited))
		{
			return true;
		}

		List<TMP_FontAsset> globalFallbacks = TMP_Settings.fallbackFontAssets;
		if (globalFallbacks != null)
		{
			for (int i = 0; i < globalFallbacks.Count; i++)
			{
				if (FontAssetSupportsGlyphRecursive(globalFallbacks[i], glyph, visited))
				{
					return true;
				}
			}
		}

		return false;
	}

	private bool CurrentEquationFontSupports(char glyph)
	{
		if (glyph == '\0')
		{
			return false;
		}

		if (TryGetEquationTextStyleSource(out TextMeshProUGUI styleSource) &&
			styleSource != null &&
			FontSupportsGlyphInTmpFallbackChain(styleSource.font, glyph))
		{
			return true;
		}

		return false;
	}

	private string ResolveMathSymbol(char unicodeGlyph, string safeFallback)
	{
		if (!useSafeMathGlyphs)
		{
			return unicodeGlyph.ToString();
		}

		if (string.IsNullOrEmpty(safeFallback))
		{
			safeFallback = unicodeGlyph.ToString();
		}

		switch (mathSymbolMode)
		{
			case MathSymbolMode.ForceAscii:
				return safeFallback;
			case MathSymbolMode.PreferUnicode:
				return unicodeGlyph.ToString();
			default:
				return CurrentEquationFontSupports(unicodeGlyph) ? unicodeGlyph.ToString() : safeFallback;
		}
	}

	private string GetMultiplySymbol() => ResolveMathSymbol('\u00D7', safeMultiplySymbol);
	private string GetDivideSymbol() => ResolveMathSymbol('\u00F7', safeDivideSymbol);

	private static string StripRichTextTags(string input)
	{
		if (string.IsNullOrEmpty(input))
		{
			return input ?? string.Empty;
		}

		return System.Text.RegularExpressions.Regex.Replace(input, @"<[^>]+>", string.Empty);
	}

	private void CreateBubbleElements(string equation)
	{
		equationRepeatRowOffsetApplied = Vector2.zero;
		ApplyAutoSizing();

		for (int i = 0; i < operatorLabels.Count; i++)
		{
			GameObject label = operatorLabels[i];
			if (label == null)
			{
				continue;
			}

			KillTweensOnTransform(label.transform);
			Destroy(label);
		}

		operatorLabels.Clear();

		List<TokenInfo> tokens = TokenizeEquation(equation);

		// Visual width drives rendering layout, while logical width keeps path and
		// judgement spacing stable when split-digit visuals are wider than logic.
		float totalWidth = 0f;
		float totalLogicalWidth = 0f;
		for (int i = 0; i < tokens.Count; i++)
		{
			totalWidth += GetTokenVisualWidth(tokens[i]);
			totalLogicalWidth += GetTokenLogicalWidth(tokens[i]);
			if (i < tokens.Count - 1)
			{
				float spacing = GetSpacingAfterToken(tokens, i);
				totalWidth += spacing;
				totalLogicalWidth += spacing;
			}
		}

		float xPos = -totalWidth * 0.5f;
		float logicalXPos = -totalLogicalWidth * 0.5f;
		float equationLeftEdgeX = xPos;
		float equationLeftEdgeLogicalX = logicalXPos;
		int side = 0;
		string pendingOperatorSign = null;

		for (int i = 0; i < tokens.Count; i++)
		{
			TokenInfo token = tokens[i];

			if (token.text == "=")
			{
				side = 1;
				GameObject label = CreateOperatorLabel(token.text, xPos, operatorSize);
				operatorLabels.Add(label);

				float opWidth = GetTokenVisualWidth(token);
				float opLogicalWidth = GetTokenLogicalWidth(token);
				xPos += opWidth + bubbleSpacing;
				logicalXPos += opLogicalWidth + bubbleSpacing;
				pendingOperatorSign = null;
				continue;
			}

			if (token.isOperator)
			{
				GameObject label = CreateOperatorLabel(token.text, xPos, operatorSize);
				operatorLabels.Add(label);
				pendingOperatorSign = token.text;

				float opWidth = GetTokenVisualWidth(token);
				float opLogicalWidth = GetTokenLogicalWidth(token);
				xPos += opWidth + bubbleSpacing;
				logicalXPos += opLogicalWidth + bubbleSpacing;
				continue;
			}

			float visualWidth = GetTokenVisualWidth(token);
			float logicalWidth = GetTokenLogicalWidth(token);
			float logicalCenterX = logicalXPos + (logicalWidth * 0.5f);
			EquationBubbleElement bubble = CreateBubbleElement(token, xPos, side, logicalCenterX);
			bubbleElements.Add(bubble);

			if (pendingOperatorSign == "-")
			{
				bubble.SetLinkedOperator(null, true);
			}
			else if (pendingOperatorSign == "+")
			{
				bubble.SetLinkedOperator(null, false);
			}

			pendingOperatorSign = null;
			xPos += visualWidth;
			logicalXPos += logicalWidth;
			if (i < tokens.Count - 1)
			{
				float spacing = GetSpacingAfterToken(tokens, i);
				xPos += spacing;
				logicalXPos += spacing;
			}
		}

		float equationRightEdgeNextX = xPos;
		float equationRightEdgeLogicalNextX = logicalXPos;

		RebuildTermVisualGroups();

		if (currentState == null || !currentState.IsSolved())
		{
			CreateDropZones(equationLeftEdgeX, equationRightEdgeNextX, equationLeftEdgeLogicalX, equationRightEdgeLogicalNextX);
		}
		else
		{
			currentDropZone = null;
			leftDropZone = null;
			rightDropZone = null;
		}

		UpdateBubbleInteractabilityForCurrentState();
	}

	private bool TryBuildCurrentEquationTokenVisualMap(List<TokenInfo> tokens, out EquationBubbleElement[] tokenBubbleByIndex, out RectTransform[] tokenOperatorRectByIndex)
	{
		tokenBubbleByIndex = null;
		tokenOperatorRectByIndex = null;

		if (tokens == null || tokens.Count == 0)
		{
			return false;
		}

		List<EquationBubbleElement> tokenBubbles = new List<EquationBubbleElement>(bubbleElements.Count);
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null || bubble.ElementType == BubbleElementType.DropZone)
			{
				continue;
			}

			tokenBubbles.Add(bubble);
		}

		int tokenBubbleCount = 0;
		for (int i = 0; i < tokens.Count; i++)
		{
			if (!tokens[i].isOperator)
			{
				tokenBubbleCount++;
			}
		}

		if (tokenBubbleCount != tokenBubbles.Count)
		{
			return false;
		}

		tokenBubbleByIndex = new EquationBubbleElement[tokens.Count];
		tokenOperatorRectByIndex = new RectTransform[tokens.Count];

		int operatorCursor = 0;
		int bubbleCursor = 0;
		for (int i = 0; i < tokens.Count; i++)
		{
			if (tokens[i].isOperator)
			{
				while (operatorCursor < operatorLabels.Count && operatorLabels[operatorCursor] == null)
				{
					operatorCursor++;
				}

				if (operatorCursor >= operatorLabels.Count)
				{
					return false;
				}

				GameObject labelObj = operatorLabels[operatorCursor++];
				tokenOperatorRectByIndex[i] = labelObj != null ? labelObj.GetComponent<RectTransform>() : null;
			}
			else
			{
				if (bubbleCursor >= tokenBubbles.Count)
				{
					return false;
				}

				tokenBubbleByIndex[i] = tokenBubbles[bubbleCursor++];
			}
		}

		return true;
	}

	private bool TryApplyCanonicalPlaceholderRowAlignmentForCurrentSuggestion()
	{
		if (currentDraggingElement != null || IsEquationRowCompactionRestoreActive())
		{
			return false;
		}

		if (journeySuggestedElement == null || journeySuggestedDropZone == null)
		{
			return false;
		}

		if (currentState == null || currentState.IsSolved())
		{
			return false;
		}

		if (wispDotSprite != null || !ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			return false;
		}

		List<TokenInfo> tokens = TokenizeEquation(FormatEquation(currentState));
		if (tokens == null || tokens.Count == 0)
		{
			return false;
		}

		if (!TryBuildCurrentEquationTokenVisualMap(tokens, out EquationBubbleElement[] tokenBubbleByIndex, out RectTransform[] tokenOperatorRectByIndex))
		{
			return false;
		}

		int sourceTokenIndex = -1;
		for (int i = 0; i < tokenBubbleByIndex.Length; i++)
		{
			if (tokenBubbleByIndex[i] == journeySuggestedElement)
			{
				sourceTokenIndex = i;
				break;
			}
		}

		if (sourceTokenIndex < 0)
		{
			return false;
		}

		WispPathUnitBucket bucket = WispPathUnitBucket.None;
		if (TryGetPreparedResolvedWispWindowState(out WispWindowState resolvedWindowState) &&
			resolvedWindowState.pathUnitBucket != WispPathUnitBucket.None)
		{
			bucket = resolvedWindowState.pathUnitBucket;
		}
		else if (lockPathPerHitZoneWindow && hasLockedWindowPathUnitVariant && lockedWindowPathUnitBucket != WispPathUnitBucket.None)
		{
			bucket = lockedWindowPathUnitBucket;
		}
		else
		{
			Vector2 logicalStart = journeySuggestedElement.OriginalPathAnchorPosition;
			Vector2 logicalEnd = journeySuggestedDropZone.OriginalPathAnchorPosition;
			float pitch = ResolveWispPathUnitPitchPixels();
			float units = Mathf.Abs(logicalEnd.x - logicalStart.x) / Mathf.Max(1f, pitch);
			bucket = ResolvePlaceholderArcSpriteBucket(units);
		}

		Sprite arcSprite = GetWispArcSpriteForBucket(bucket);
		if (arcSprite == null)
		{
			return false;
		}

		Vector2 templateVisibleSize = GetCanonicalPlaceholderVisibleFrameSizeFromSprite(arcSprite, bucket);
		const float canonicalPlaceholderReferenceBubbleSize = 134f;
		float uniformScale = bubbleSize / Mathf.Max(1f, canonicalPlaceholderReferenceBubbleSize);
		float targetFrameWidth = Mathf.Max(1f, templateVisibleSize.x * uniformScale);
		GetCanonicalPlaceholderEndpointAnchorInsetsRuntime(
			bucket,
			targetFrameWidth,
			out float endpointAnchorInsetLeft,
			out float endpointAnchorInsetRight);

		// Match the template's endpoint-anchor span instead of the full frame width.
		float targetSpan = Mathf.Max(1f, targetFrameWidth - endpointAnchorInsetLeft - endpointAnchorInsetRight);

		float[] visualCenterXByToken = new float[tokens.Count];
		float[] logicalCenterXByToken = new float[tokens.Count];

		bool TryComputeLayout(float spacingScale, bool apply, out float spanAbs)
		{
			spanAbs = 0f;
			float scaledSpacing = Mathf.Max(0f, spacingScale);

			float totalWidth = 0f;
			float totalLogicalWidth = 0f;
			for (int i = 0; i < tokens.Count; i++)
			{
				totalWidth += GetTokenVisualWidth(tokens[i]);
				totalLogicalWidth += GetTokenLogicalWidth(tokens[i]);
				if (i < tokens.Count - 1)
				{
					float spacing = GetSpacingAfterToken(tokens, i) * scaledSpacing;
					totalWidth += spacing;
					totalLogicalWidth += spacing;
				}
			}

			float xPos = -totalWidth * 0.5f;
			float logicalXPos = -totalLogicalWidth * 0.5f;
			float equationLeftEdgeX = xPos;
			float equationLeftEdgeLogicalX = logicalXPos;

			for (int i = 0; i < tokens.Count; i++)
			{
				float width = GetTokenVisualWidth(tokens[i]);
				float logicalWidth = GetTokenLogicalWidth(tokens[i]);
				visualCenterXByToken[i] = xPos + (width * 0.5f);
				logicalCenterXByToken[i] = logicalXPos + (logicalWidth * 0.5f);

				xPos += width;
				logicalXPos += logicalWidth;
				if (i < tokens.Count - 1)
				{
					float spacing = GetSpacingAfterToken(tokens, i) * scaledSpacing;
					xPos += spacing;
					logicalXPos += spacing;
				}
			}

			float equationRightEdgeNextX = xPos;
			float equationRightEdgeLogicalNextX = logicalXPos;

			float rightDropZoneVisualCenterX = equationRightEdgeNextX + dropZoneOffset + (bubbleSize * 0.5f);
			float rightDropZoneLogicalCenterX = equationRightEdgeLogicalNextX + dropZoneOffset + (bubbleSize * 0.5f);
			float leftDropZoneVisualCenterX = equationLeftEdgeX - dropZoneOffset - (bubbleSize * 0.5f);
			float leftDropZoneLogicalCenterX = equationLeftEdgeLogicalX - dropZoneOffset - (bubbleSize * 0.5f);

			float sourceCenterX = visualCenterXByToken[sourceTokenIndex];
			float targetCenterX = journeySuggestedDropZone == leftDropZone ? leftDropZoneVisualCenterX : rightDropZoneVisualCenterX;
			spanAbs = Mathf.Abs(targetCenterX - sourceCenterX);

			if (!apply)
			{
				return true;
			}

			float rowOffsetX = equationRepeatRowOffsetApplied.x;
			for (int i = 0; i < tokens.Count; i++)
			{
				if (tokens[i].isOperator)
				{
					RectTransform operatorRect = tokenOperatorRectByIndex[i];
					if (operatorRect == null)
					{
						continue;
					}

					Vector2 operatorPosition = operatorRect.anchoredPosition;
					operatorRect.anchoredPosition = new Vector2(visualCenterXByToken[i] + rowOffsetX, operatorPosition.y);
					continue;
				}

				EquationBubbleElement bubble = tokenBubbleByIndex[i];
				if (bubble == null || bubble.RectTransform == null)
				{
					continue;
				}

				RectTransform bubbleRect = bubble.RectTransform;
				Vector2 bubblePosition = bubbleRect.anchoredPosition;
				Vector2 target = new Vector2(visualCenterXByToken[i] + rowOffsetX, bubblePosition.y);
				bubble.SetOriginalPosition(target);
				bubble.SetLogicalPathAnchorOffset(new Vector2(logicalCenterXByToken[i] - visualCenterXByToken[i], 0f));
			}

			void ApplyDropZone(EquationBubbleElement zone, float visualCenterX, float logicalCenterX)
			{
				if (zone == null || zone.RectTransform == null)
				{
					return;
				}

				RectTransform zoneRect = zone.RectTransform;
				Vector2 zonePosition = zoneRect.anchoredPosition;
				Vector2 target = new Vector2(visualCenterX + rowOffsetX, zonePosition.y);
				zone.SetOriginalPosition(target);
				zone.SetLogicalPathAnchorOffset(new Vector2(logicalCenterX - visualCenterX, 0f));
			}

			ApplyDropZone(rightDropZone, rightDropZoneVisualCenterX, rightDropZoneLogicalCenterX);
			ApplyDropZone(leftDropZone, leftDropZoneVisualCenterX, leftDropZoneLogicalCenterX);

			if (operationSymbolRect != null && rightDropZone != null)
			{
				Vector2 position = operationSymbolRect.anchoredPosition;
				Vector2 target = GetOperationSymbolPositionForDropZoneCenter(rightDropZoneVisualCenterX + rowOffsetX);
				operationSymbolRect.anchoredPosition = new Vector2(target.x, position.y);
			}

			RebuildTermVisualGroups();

			// Width changes can push the row outside the safe play window.
			ApplyEquationRepeatMotionToCurrentRow(equationRepeatRowOffsetApplied, immediate: true);
			return true;
		}

		if (!TryComputeLayout(1f, apply: false, out float currentSpan))
		{
			return false;
		}

		float minScale = 0.55f;
		float maxScale = 1.9f;
		if (!TryComputeLayout(minScale, apply: false, out float minSpan) ||
			!TryComputeLayout(maxScale, apply: false, out float maxSpan))
		{
			return false;
		}

		float solvedScale;
		if (Mathf.Abs(maxSpan - minSpan) <= 0.001f)
		{
			solvedScale = 1f;
		}
		else
		{
			float t = Mathf.InverseLerp(minSpan, maxSpan, targetSpan);
			solvedScale = Mathf.Lerp(minScale, maxScale, t);
		}

		if (Mathf.Abs(currentSpan - targetSpan) <= 0.5f && Mathf.Abs(solvedScale - 1f) <= 0.01f)
		{
			return false;
		}

		return TryComputeLayout(solvedScale, apply: true, out _);
	}

	private bool TryGetEquationTextStyleSource(out TextMeshProUGUI styleSource)
	{
		styleSource = null;

		TextMeshProUGUI ResolveFromElement(EquationBubbleElement element)
		{
			return element != null ? element.GetComponentInChildren<TextMeshProUGUI>(true) : null;
		}

		TextMeshProUGUI Validate(TextMeshProUGUI candidate)
		{
			return candidate != null && candidate.font != null ? candidate : null;
		}

		styleSource = Validate(currentDraggingElement != null ? ResolveFromElement(currentDraggingElement) : null);
		if (styleSource != null)
		{
			return true;
		}

		if (bubbleElementPrefab != null)
		{
			styleSource = Validate(bubbleElementPrefab.GetComponentInChildren<TextMeshProUGUI>(true));
			if (styleSource != null)
			{
				return true;
			}
		}

		if (bubbleElements != null)
		{
			for (int i = 0; i < bubbleElements.Count; i++)
			{
				styleSource = Validate(ResolveFromElement(bubbleElements[i]));
				if (styleSource != null)
				{
					return true;
				}
			}
		}

		if (operatorLabels != null)
		{
			for (int i = 0; i < operatorLabels.Count; i++)
			{
				GameObject labelObj = operatorLabels[i];
				if (labelObj == null)
				{
					continue;
				}

				styleSource = Validate(labelObj.GetComponent<TextMeshProUGUI>());
				if (styleSource != null)
				{
					return true;
				}
			}
		}

		if (equationContainer != null)
		{
			TextMeshProUGUI[] all = equationContainer.GetComponentsInChildren<TextMeshProUGUI>(true);
			for (int i = 0; i < all.Length; i++)
			{
				styleSource = Validate(all[i]);
				if (styleSource != null)
				{
					return true;
				}
			}
		}

		return false;
	}

	private void ApplyEquationTextStyle(TextMeshProUGUI target)
	{
		if (target == null)
		{
			return;
		}

		if (!TryGetEquationTextStyleSource(out TextMeshProUGUI styleSource) || styleSource == null || styleSource == target)
		{
			return;
		}

		if (styleSource.font != null)
		{
			target.font = styleSource.font;
		}

		if (styleSource.fontSharedMaterial != null)
		{
			target.fontSharedMaterial = styleSource.fontSharedMaterial;
		}
	}

	private string NormalizeMathSymbolsForTarget(TextMeshProUGUI target, string text)
	{
		if (string.IsNullOrEmpty(text))
		{
			return text ?? string.Empty;
		}

		if (target == null)
		{
			return text;
		}

		if (!useSafeMathGlyphs || mathSymbolMode == MathSymbolMode.PreferUnicode)
		{
			return text;
		}

		TMP_FontAsset font = target.font;

		if (text.IndexOf('\u00F7') >= 0)
		{
			bool hasDivideGlyph = FontSupportsGlyphInTmpFallbackChain(font, '\u00F7');
			if (!hasDivideGlyph)
			{
				string fallback = string.IsNullOrEmpty(safeDivideSymbol) ? "/" : safeDivideSymbol;
				if (fallback.IndexOf('\u00F7') >= 0)
				{
					fallback = "/";
				}

				text = text.Replace("\u00F7", fallback);
			}
		}

		if (text.IndexOf('\u00D7') >= 0)
		{
			bool hasMultiplyGlyph = FontSupportsGlyphInTmpFallbackChain(font, '\u00D7');
			if (!hasMultiplyGlyph)
			{
				string fallback = string.IsNullOrEmpty(safeMultiplySymbol) ? "x" : safeMultiplySymbol;
				if (fallback.IndexOf('\u00D7') >= 0)
				{
					fallback = "*";
				}

				text = text.Replace("\u00D7", fallback);
			}
		}

		return text;
	}

	private string ForceSupportedMathGlyphsForTarget(TextMeshProUGUI target, string text)
	{
		if (string.IsNullOrEmpty(text))
		{
			return text ?? string.Empty;
		}

		if (target == null)
		{
			return text;
		}

		TMP_FontAsset font = target.font;

		if (text.IndexOf('\u00F7') >= 0 && !FontSupportsGlyphInTmpFallbackChain(font, '\u00F7'))
		{
			string fallback = string.IsNullOrEmpty(safeDivideSymbol) ? "/" : safeDivideSymbol;
			if (string.IsNullOrEmpty(fallback) || fallback.IndexOf('\u00F7') >= 0)
			{
				fallback = "/";
			}

			text = text.Replace("\u00F7", fallback);
		}

		if (text.IndexOf('\u00D7') >= 0 && !FontSupportsGlyphInTmpFallbackChain(font, '\u00D7'))
		{
			string fallback = string.IsNullOrEmpty(safeMultiplySymbol) ? "*" : safeMultiplySymbol;
			if (string.IsNullOrEmpty(fallback) || fallback.IndexOf('\u00D7') >= 0)
			{
				fallback = "*";
			}

			text = text.Replace("\u00D7", fallback);
		}

		return text;
	}

	private void SetEquationOperatorText(TextMeshProUGUI target, string text)
	{
		if (target == null)
		{
			return;
		}

		target.text = ForceSupportedMathGlyphsForTarget(target, NormalizeMathSymbolsForTarget(target, text));
	}

	private float ResolveEquationOperatorFontSize(string text)
	{
		string symbol = (text ?? string.Empty).Trim();
		float size = bubbleSize * 0.73f;

		// Operators read visually smaller than digits at the same point size.
		// Give thin symbols a small boost so the row matches the bubble glyph weight.
		if (symbol == "+" || symbol == "=")
		{
			size *= 1.14f;
		}
		else if (symbol == "-")
		{
			size *= 1.2f;
		}
		else if (symbol == "/" || symbol == "\u00F7" || symbol == "*" || symbol == "\u00D7")
		{
			size *= 1.08f;
		}

		return Mathf.Clamp(size, 52f, 124f);
	}

	private GameObject CreateOperatorLabel(string text, float xPos, float width)
	{
		GameObject labelObj = new GameObject($"OperatorLabel_{text}", typeof(RectTransform), typeof(TextMeshProUGUI));
		labelObj.transform.SetParent(equationContainer, false);

		RectTransform rect = labelObj.GetComponent<RectTransform>();
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = new Vector2(width, bubbleSize);
		rect.anchoredPosition = new Vector2(xPos + width * 0.5f, bubbleTextVerticalOffset);

		TextMeshProUGUI label = labelObj.GetComponent<TextMeshProUGUI>();
		ApplyEquationTextStyle(label);
		SetEquationOperatorText(label, text);
		label.fontSize = ResolveEquationOperatorFontSize(text);
		label.fontStyle = FontStyles.Bold;
		label.alignment = TextAlignmentOptions.CenterGeoAligned;
		label.margin = Vector4.zero;
		label.enableAutoSizing = false;
		label.textWrappingMode = TextWrappingModes.NoWrap;
		label.overflowMode = TextOverflowModes.Overflow;
		label.color = operatorColor;
		label.raycastTarget = false;

		return labelObj;
	}
}
