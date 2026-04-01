using System.Collections;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Shapes;

public partial class DragExecutionController
{
	private void SetDropZonesEmphasis(bool emphasized)
	{
		dropZonesEmphasized = emphasized;
		float seconds = 0.12f;
		float alpha = 1f;
		float pulseScale = Mathf.Clamp(dropZoneDragPulseScale, 1f, 1.35f);
		float pulseSeconds = Mathf.Max(0.05f, dropZoneDragPulseSeconds);

		void Apply(EquationBubbleElement zone)
		{
			if (zone == null)
			{
				return;
			}

			bool shouldShow = ShouldShowDropZoneInCurrentContext(zone);
			CanvasGroup cg = zone.GetComponent<CanvasGroup>();
			if (cg != null)
			{
				cg.DOKill();
				if (!shouldShow)
				{
					cg.DOFade(0f, seconds).SetUpdate(true);
				}
				else if (emphasized)
				{
					cg.alpha = Mathf.Max(cg.alpha, alpha);
					cg.DOFade(alpha, seconds).SetUpdate(true);
				}
				else
				{
					cg.DOFade(1f, seconds).SetUpdate(true);
				}
			}

			RectTransform rt = zone.RectTransform;
			if (rt != null)
			{
				rt.DOKill();
				if (emphasized && shouldShow)
				{
					rt.localScale = Vector3.one;
					rt.DOScale(pulseScale, pulseSeconds * 0.5f)
						.SetEase(Ease.InOutSine)
						.SetLoops(-1, LoopType.Yoyo)
						.SetUpdate(true);
				}
				else
				{
					rt.localScale = Vector3.one;
				}
			}

			if (!shouldShow)
			{
				zone.SetAsDropTarget(false);
			}

			SetDropZoneFill(zone, isNear: false);
		}

		Apply(leftDropZone);
		Apply(rightDropZone);
	}

	private void ApplyDropZoneContextVisibility(bool immediate, float fadeSeconds = 0f, bool forceVisible = true)
	{
		ApplyDropZoneContextVisibilityToZone(leftDropZone, immediate, fadeSeconds, forceVisible);
		ApplyDropZoneContextVisibilityToZone(rightDropZone, immediate, fadeSeconds, forceVisible);
	}

	private void ApplyDropZoneContextVisibilityToZone(EquationBubbleElement zone, bool immediate, float fadeSeconds, bool forceVisible)
	{
		if (zone == null)
		{
			return;
		}

		bool shouldShow = forceVisible && ShouldShowDropZoneInCurrentContext(zone);
		CanvasGroup cg = zone.GetComponent<CanvasGroup>();
		if (cg != null)
		{
			cg.DOKill();
			float target = shouldShow ? 1f : 0f;
			if (immediate || fadeSeconds <= 0f)
			{
				cg.alpha = target;
			}
			else
			{
				cg.DOFade(target, fadeSeconds).SetUpdate(true);
			}
		}

		if (!shouldShow)
		{
			zone.SetAsDropTarget(false);
			RectTransform rt = zone.RectTransform;
			if (rt != null)
			{
				rt.DOKill();
				rt.localScale = Vector3.one;
			}
		}
	}

	private bool ShouldShowDropZoneInCurrentContext(EquationBubbleElement zone)
	{
		if (zone == null)
		{
			return false;
		}

		if (zone == rightDropZone)
		{
			return currentDraggingElement == null || currentDropZone == null || currentDropZone == rightDropZone;
		}

		if (zone == leftDropZone)
		{
			return enableBidirectionalDropZones &&
				currentDraggingElement != null &&
				(currentDropZone == leftDropZone || currentDraggingElement.EquationSide == 1);
		}

		return true;
	}

	private Color ResolveDropZoneFillColor(bool isNear)
	{
		Color stateColor = isNear ? dropZoneValidColor : dropZoneInvalidColor;
		float blend = isNear ? dropZoneNearFillThemeBlend : dropZoneFillThemeBlend;
		Color fill = Color.Lerp(bubbleBackgroundColor, stateColor, Mathf.Clamp01(blend));
		float alpha = dropZonesEmphasized
			? (isNear ? dropZoneNearFillAlpha : dropZoneDragFillAlpha)
			: dropZoneIdleFillAlpha;
		fill.a = Mathf.Clamp01(alpha);
		return fill;
	}

	private Color ResolveDropZoneOutlineColor(bool isNear)
	{
		Color stateColor = isNear ? dropZoneValidColor : dropZoneInvalidColor;
		float blend = isNear ? dropZoneNearOutlineThemeBlend : dropZoneOutlineThemeBlend;
		Color outline = Color.Lerp(bubbleOutlineColor, stateColor, Mathf.Clamp01(blend));
		float minAlpha = isNear ? dropZoneNearOutlineMinAlpha : dropZoneOutlineMinAlpha;
		if (dropZonesEmphasized && !isNear)
		{
			minAlpha = Mathf.Max(minAlpha, dropZoneDragMinAlpha * 0.55f);
		}

		outline.a = Mathf.Max(Mathf.Clamp01(minAlpha), outline.a);
		return outline;
	}

	private void SetDropZoneFill(EquationBubbleElement zone, bool isNear)
	{
		if (zone == null)
		{
			return;
		}

		Color fill = ResolveDropZoneFillColor(isNear);
		Color outline = ResolveDropZoneOutlineColor(isNear);
		float blend = Mathf.Clamp01(dropZoneOutlineHighlightLift + (isNear ? 0.12f : 0f));
		zone.ApplyDropZoneVisualTheme(fill, outline, outlineHighlightLift: blend, duration: 0f);
	}

	#region Bubble System - Trail

	private void CreateTrailContainer()
	{
		if (trailContainer == null)
		{
			GameObject container = new GameObject("TrailContainer", typeof(RectTransform));
			container.transform.SetParent(equationContainer, false);
			container.transform.SetAsFirstSibling();
			trailContainer = container.GetComponent<RectTransform>();
			trailContainer.anchorMin = Vector2.zero;
			trailContainer.anchorMax = Vector2.one;
			trailContainer.sizeDelta = Vector2.zero;
		}

		for (int i = 0; i < trailPointCount; i++)
		{
			GameObject pointObj = new GameObject($"TrailPoint_{i}", typeof(RectTransform), typeof(Image));
			pointObj.transform.SetParent(trailContainer, false);

			Image pointImage = pointObj.GetComponent<Image>();
			RectTransform rect = pointObj.GetComponent<RectTransform>();

			float t = i / (float)(trailPointCount - 1);
			float size = Mathf.Lerp(trailWidth, trailWidth * 0.3f, t);

			rect.sizeDelta = new Vector2(size, size);
			pointImage.sprite = circleSprite;
			pointImage.color = trailGradient.Evaluate(t);
			pointImage.raycastTarget = false;

			pointObj.SetActive(false);
			trailImages.Add(pointImage);
		}
	}

	private void UpdateTrail(Vector2 currentPosition)
	{
		if (trailPoints.Count == 0)
		{
			trailPoints.Add(currentPosition);
			lastTrailSamplePosition = currentPosition;
			trailCatchUpAccumulator = 0f;
		}
		else
		{
			trailPoints[0] = currentPosition;
		}

		float speed01 = Mathf.Clamp01(dragSpeedVisual01);
		float sampleDistance = Mathf.Max(0f, trailSampleMinDistance);
		float sampleResponse = Mathf.Clamp01(trailSampleDistanceSpeedResponse);
		float sampleDistanceScale = Mathf.Lerp(1f + sampleResponse, Mathf.Max(0.2f, 1f - sampleResponse), speed01);
		sampleDistance *= sampleDistanceScale;
		float distFromLastSample = Vector2.Distance(currentPosition, lastTrailSamplePosition);
		bool shouldAddSample = distFromLastSample >= Mathf.Max(0.001f, sampleDistance);
		if (shouldAddSample)
		{
			trailPoints.Insert(0, currentPosition);
			lastTrailSamplePosition = currentPosition;
			trailCatchUpAccumulator = 0f;
		}
		else if (trailPoints.Count > 1)
		{
			trailCatchUpAccumulator += Time.unscaledDeltaTime * Mathf.Max(0.1f, trailCatchUpPointsPerSecond);
			int pointsToTrim = Mathf.FloorToInt(trailCatchUpAccumulator);
			if (pointsToTrim > 0)
			{
				int maxTrim = Mathf.Max(0, trailPoints.Count - 1);
				pointsToTrim = Mathf.Min(pointsToTrim, maxTrim);
				trailPoints.RemoveRange(trailPoints.Count - pointsToTrim, pointsToTrim);
				trailCatchUpAccumulator -= pointsToTrim;
			}
		}

		while (trailPoints.Count > trailPointCount)
		{
			trailPoints.RemoveAt(trailPoints.Count - 1);
		}

		if (useDragPreviewInsteadOfDropCircles)
		{
			for (int i = 0; i < trailImages.Count; i++)
			{
				if (trailImages[i] != null)
				{
					trailImages[i].gameObject.SetActive(false);
				}
			}

			return;
		}

		for (int i = 0; i < trailImages.Count; i++)
		{
			if (i < trailPoints.Count)
			{
				trailImages[i].gameObject.SetActive(true);
				RectTransform trailRect = trailImages[i].rectTransform;
				trailRect.anchoredPosition = trailPoints[i];

				float t = trailPointCount <= 1 ? 0f : (i / (float)(trailPointCount - 1));
				float baseSize = Mathf.Lerp(trailWidth, trailWidth * 0.3f, t);
				float widthMul = Mathf.Lerp(1f, 1f + Mathf.Clamp01(trailWidthSpeedResponse), speed01);
				float headBias = Mathf.Lerp(1f + (speed01 * 0.18f), 1f, t);
				float size = Mathf.Max(2f, baseSize * widthMul * headBias);
				trailRect.sizeDelta = new Vector2(size, size);

				Color c = trailGradient.Evaluate(t);
				float alphaMul = Mathf.Lerp(Mathf.Clamp01(1f - Mathf.Clamp01(trailAlphaSpeedResponse)), 1f, speed01);
				alphaMul *= Mathf.Lerp(1.08f, 0.62f, t);
				c.a *= Mathf.Clamp01(alphaMul);
				trailImages[i].color = c;
			}
			else
			{
				trailImages[i].gameObject.SetActive(false);
			}
		}
	}

	private void ClearTrail()
	{
		trailPoints.Clear();
		trailCatchUpAccumulator = 0f;

		for (int i = 0; i < trailImages.Count; i++)
		{
			Image image = trailImages[i];
			if (image != null)
			{
				image.gameObject.SetActive(false);
			}
		}
	}

	private IEnumerator FadeOutTrail()
	{
		float elapsed = 0f;
		float duration = 0.5f;

		while (elapsed < duration)
		{
			elapsed += Time.unscaledDeltaTime;
			float alpha = 1f - (elapsed / duration);

			for (int i = 0; i < trailImages.Count; i++)
			{
				Image image = trailImages[i];
				if (image != null && image.gameObject.activeSelf)
				{
					float t = trailPointCount <= 1 ? 0f : (i / (float)(trailPointCount - 1));
					Color c = trailGradient != null ? trailGradient.Evaluate(t) : image.color;
					c.a *= Mathf.Clamp01(alpha);
					image.color = c;
				}
			}

			yield return null;
		}

		ClearTrail();
	}

	#endregion

	#region Bubble System - Operator Following

	private void StartOperatorFollowing(EquationBubbleElement element)
	{
		followingOperatorLabel = null;
		followingOperatorRect = null;
		followingOperatorText = null;
		isDynamicDivideOperator = false;

		if (element.ElementType == BubbleElementType.Variable)
		{
			StepOption op = DetermineBubbleOperation(element);
			if (op != null && op.operationType == OperationType.MultiplyByNegativeOne)
			{
				CreateDynamicOperatorLabel(element, $"{GetMultiplySymbol()} -1", operationSymbolColor);
				return;
			}
		}

		if (element.ElementType == BubbleElementType.Coefficient)
		{
			StepOption op = DetermineBubbleOperation(element);
			if (op != null && (op.operationType == OperationType.DivideByCoefficient || op.operationType == OperationType.MultiplyByNegativeOne))
			{
				CreateDynamicOperatorLabel(
					element,
					op.operationType == OperationType.MultiplyByNegativeOne ? $"{GetMultiplySymbol()} -1" : GetDivideSymbol(),
					operationSymbolColor);
			}
			else
			{
				string symbol = (op != null && op.operationType == OperationType.AddVariable) ? "+" : "-";
				CreateDynamicOperatorLabel(element, symbol, operatorColor);
			}

			return;
		}

		if (operatorLabels.Count > 0)
		{
			Vector2 elementPos = element.OriginalPosition;
			float closestDist = float.MaxValue;

			for (int i = 0; i < operatorLabels.Count; i++)
			{
				GameObject label = operatorLabels[i];
				if (label == null)
				{
					continue;
				}

				TextMeshProUGUI text = label.GetComponent<TextMeshProUGUI>();
				if (text == null || text.text == "=")
				{
					continue;
				}

				RectTransform rect = label.GetComponent<RectTransform>();
				if (rect.anchoredPosition.x < elementPos.x)
				{
					float dist = elementPos.x - rect.anchoredPosition.x;
					if (dist < closestDist)
					{
						closestDist = dist;
						followingOperatorLabel = label;
						followingOperatorRect = rect;
						followingOperatorText = text;
					}
				}
			}
		}

		if (followingOperatorLabel != null)
		{
			operatorOriginalPosition = followingOperatorRect.anchoredPosition;
			operatorOriginalText = followingOperatorText.text;
			operatorOriginalParent = followingOperatorLabel.transform.parent;
			operatorOriginalSiblingIndex = followingOperatorLabel.transform.GetSiblingIndex();

			followingOperatorLabel.transform.SetAsLastSibling();
			element.transform.SetAsLastSibling();
		}
	}

	private void CreateDynamicOperatorLabel(EquationBubbleElement element, string symbol, Color color)
	{
		GameObject opObj = new GameObject("DynamicOperator", typeof(RectTransform), typeof(TextMeshProUGUI));
		opObj.transform.SetParent(equationContainer, false);

		followingOperatorLabel = opObj;
		followingOperatorRect = opObj.GetComponent<RectTransform>();
		followingOperatorText = opObj.GetComponent<TextMeshProUGUI>();
		isDynamicDivideOperator = true;

		followingOperatorRect.anchorMin = new Vector2(0.5f, 0.5f);
		followingOperatorRect.anchorMax = new Vector2(0.5f, 0.5f);
		followingOperatorRect.pivot = new Vector2(0.5f, 0.5f);
		followingOperatorRect.sizeDelta = new Vector2(operatorSize, bubbleSize);

		ApplyEquationTextStyle(followingOperatorText);
		SetEquationOperatorText(followingOperatorText, symbol);
		followingOperatorText.fontSize = ResolveEquationOperatorFontSize(symbol);
		followingOperatorText.fontStyle = FontStyles.Bold;
		followingOperatorText.alignment = TextAlignmentOptions.CenterGeoAligned;
		followingOperatorText.color = color;
		followingOperatorText.raycastTarget = false;

		Vector2 elementPos = element.RectTransform.anchoredPosition;
		float offsetX = (-operatorSize * operatorFollowLeftOffsetMultiplier) - operatorFollowExtraOffsetX;
		operatorOriginalPosition = elementPos + new Vector2(offsetX, operatorFollowYOffset + bubbleTextVerticalOffset);
		followingOperatorRect.anchoredPosition = operatorOriginalPosition;
		operatorOriginalText = followingOperatorText.text;

		followingOperatorRect.localScale = Vector3.zero;
		followingOperatorRect.DOScale(1f, 0.2f).SetEase(Ease.OutBack);

		followingOperatorLabel.transform.SetAsLastSibling();
		element.transform.SetAsLastSibling();
	}

	private void UpdateOperatorFollowing(Vector2 elementPosition)
	{
		if (followingOperatorRect == null)
		{
			return;
		}

		float offsetX = (-operatorSize * operatorFollowLeftOffsetMultiplier) - operatorFollowExtraOffsetX;
		Vector2 operatorPos = elementPosition + new Vector2(offsetX, operatorFollowYOffset + bubbleTextVerticalOffset);
		followingOperatorRect.anchoredPosition = operatorPos;
	}

	private void CheckOperatorSignFlip(EquationBubbleElement element, Vector2 currentPosition)
	{
		if (followingOperatorText == null)
		{
			return;
		}

		float equalsX = 0f;
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
				equalsX = label.GetComponent<RectTransform>().anchoredPosition.x;
				break;
			}
		}

		bool originallyOnLeft = element.EquationSide == 0;
		bool currentlyOnRight = currentPosition.x > equalsX;
		bool shouldFlip = (originallyOnLeft && currentlyOnRight) || (!originallyOnLeft && !currentlyOnRight);

		string newOperatorText;
		if (shouldFlip)
		{
			if (operatorOriginalText == "+")
			{
				newOperatorText = "-";
			}
			else if (operatorOriginalText == "-")
			{
				newOperatorText = "+";
			}
			else
			{
				newOperatorText = operatorOriginalText;
			}
		}
		else
		{
			newOperatorText = operatorOriginalText;
		}

		if (followingOperatorText.text != newOperatorText)
		{
			SetEquationOperatorText(followingOperatorText, newOperatorText);

			followingOperatorRect.DOKill();
			followingOperatorRect.localScale = Vector3.one * 1.5f;
			followingOperatorRect.DOScale(1f, 0.2f).SetEase(Ease.OutBack);

			followingOperatorText.DOKill();
			Color originalColor = followingOperatorText.color;
			followingOperatorText.color = Color.yellow;
			followingOperatorText.DOColor(originalColor, 0.3f);
		}
	}

	private void StopOperatorFollowing(bool success)
	{
		if (followingOperatorLabel == null)
		{
			return;
		}

		GameObject operatorObj = followingOperatorLabel;
		RectTransform operatorRt = followingOperatorRect;
		TextMeshProUGUI operatorTmp = followingOperatorText;
		bool wasDynamicDivide = isDynamicDivideOperator;

		if (wasDynamicDivide)
		{
			if (success)
			{
				if (operatorTmp != null)
				{
					operatorTmp.DOColor(Color.green, 0.2f);
				}

				if (operatorRt != null)
				{
					operatorRt.DOScale(1.3f, 0.15f).OnComplete(() =>
					{
						if (operatorRt == null)
						{
							return;
						}

						operatorRt.DOScale(0f, 0.2f).SetEase(Ease.InBack).OnComplete(() =>
						{
							if (operatorRt != null)
							{
								operatorRt.DOKill();
							}

							if (operatorTmp != null)
							{
								operatorTmp.DOKill();
							}

							if (operatorObj != null)
							{
								Destroy(operatorObj);
							}
						});
					});
				}
			}
			else if (operatorRt != null)
			{
				operatorRt.DOScale(0f, 0.2f).SetEase(Ease.InBack).OnComplete(() =>
				{
					if (operatorRt != null)
					{
						operatorRt.DOKill();
					}

					if (operatorTmp != null)
					{
						operatorTmp.DOKill();
					}

					if (operatorObj != null)
					{
						Destroy(operatorObj);
					}
				});
			}
		}
		else
		{
			if (operatorObj != null)
			{
				Transform transformRef = operatorObj.transform;

				if (operatorOriginalParent != null && transformRef.parent != operatorOriginalParent)
				{
					transformRef.SetParent(operatorOriginalParent, false);
				}

				if (operatorOriginalSiblingIndex >= 0 && transformRef.parent == operatorOriginalParent)
				{
					int max = transformRef.parent.childCount - 1;
					transformRef.SetSiblingIndex(Mathf.Clamp(operatorOriginalSiblingIndex, 0, Mathf.Max(0, max)));
				}
			}

			if (operatorRt != null)
			{
				operatorRt.DOKill();
				operatorRt.localScale = Vector3.one;
				operatorRt.anchoredPosition = operatorOriginalPosition;
			}

			if (operatorTmp != null)
			{
				operatorTmp.DOKill();
				SetEquationOperatorText(operatorTmp, operatorOriginalText);

				Color c = operatorTmp.color;
				c.a = success ? 0f : Mathf.Max(c.a, 0.999f);
				operatorTmp.color = c;
			}
		}

		followingOperatorLabel = null;
		followingOperatorRect = null;
		followingOperatorText = null;
		isDynamicDivideOperator = false;
	}

	#endregion

	#region Bubble System - Drag Motion

	private void ResetDragMotionVisuals(EquationBubbleElement element, Vector2 startPosition)
	{
		lastDragMotionSamplePosition = startPosition;
		lastDragMotionSampleTime = Time.unscaledTime;
		dragSpeedUiPerSecond = 0f;
		dragSpeedUiPerSecondSmoothed = 0f;
		dragSpeedVisual01 = 0f;

		if (element != null && showActiveDragApproachRing)
		{
			EnsureActiveDragApproachRing(element);
			UpdateActiveDragApproachRingVisual(startPosition);
		}
		else
		{
			ClearActiveDragApproachRing();
		}
	}

	private void UpdateDragMotionVisuals(EquationBubbleElement element, Vector2 currentPosition)
	{
		float now = Time.unscaledTime;
		if (lastDragMotionSampleTime < 0f)
		{
			lastDragMotionSampleTime = now;
			lastDragMotionSamplePosition = currentPosition;
		}

		float dt = Mathf.Max(0.0001f, now - lastDragMotionSampleTime);
		float rawSpeed = Vector2.Distance(currentPosition, lastDragMotionSamplePosition) / dt;
		dragSpeedUiPerSecond = rawSpeed;

		float speedLerp = 1f - Mathf.Exp(-12f * dt);
		dragSpeedUiPerSecondSmoothed = Mathf.Lerp(dragSpeedUiPerSecondSmoothed, rawSpeed, Mathf.Clamp01(speedLerp));

		float minSpeed = Mathf.Max(1f, dragTrailSpeedMinPixelsPerSecond);
		float maxSpeed = Mathf.Max(minSpeed + 1f, dragTrailSpeedMaxPixelsPerSecond);
		dragSpeedVisual01 = Mathf.Clamp01(Mathf.InverseLerp(minSpeed, maxSpeed, dragSpeedUiPerSecondSmoothed));

		lastDragMotionSampleTime = now;
		lastDragMotionSamplePosition = currentPosition;

		if (showActiveDragApproachRing)
		{
			EnsureActiveDragApproachRing(element);
			UpdateActiveDragApproachRingVisual(currentPosition);
			return;
		}

		if (currentDraggingElement != null)
		{
			ClearActiveDragApproachRing();
		}
	}

	private void EnsureActiveDragApproachRing(EquationBubbleElement element)
	{
		if ((!showActiveDragApproachRing && !showSourceBubbleApproachRing) || element == null)
		{
			ClearActiveDragApproachRing();
			return;
		}

		if (activeDragApproachRingOwner == element &&
			activeDragApproachRingRect != null &&
			activeDragApproachRingDisc != null)
		{
			if (!activeDragApproachRingDisc.gameObject.activeSelf)
			{
				activeDragApproachRingDisc.gameObject.SetActive(true);
			}
			return;
		}

		if (activeDragApproachRingDisc == null || activeDragApproachRingRect == null)
		{
			if (equationContainer == null)
			{
				return;
			}

			GameObject ringObject = new GameObject("ActiveDragApproachDisc", typeof(RectTransform), typeof(Disc));
			ringObject.transform.SetParent(equationContainer, false);
			activeDragApproachRingRect = ringObject.GetComponent<RectTransform>();
			activeDragApproachRingDisc = ringObject.GetComponent<Disc>();

			activeDragApproachRingDisc.Type = DiscType.Ring;
			activeDragApproachRingDisc.RadiusSpace = ThicknessSpace.Meters;
			activeDragApproachRingDisc.ThicknessSpace = ThicknessSpace.Meters;
			activeDragApproachRingDisc.ZTest = CompareFunction.Always;
			activeDragApproachRingDisc.Color = new Color(activeDragApproachRingColor.r, activeDragApproachRingColor.g, activeDragApproachRingColor.b, 0f);
			activeDragApproachRingDisc.gameObject.SetActive(false);
		}

		activeDragApproachRingOwner = element;
		activeDragApproachRingRect.SetParent(element.transform, false);
		activeDragApproachRingRect.SetAsLastSibling();
		activeDragApproachRingRect.anchorMin = new Vector2(0.5f, 0.5f);
		activeDragApproachRingRect.anchorMax = new Vector2(0.5f, 0.5f);
		activeDragApproachRingRect.pivot = new Vector2(0.5f, 0.5f);
		activeDragApproachRingRect.anchoredPosition = Vector2.zero;
		activeDragApproachRingRect.sizeDelta = Vector2.zero;
		activeDragApproachRingRect.localRotation = Quaternion.identity;
		activeDragApproachRingRect.localScale = Vector3.one;

		if (activeDragApproachRingDisc != null)
		{
			activeDragApproachRingDisc.gameObject.SetActive(true);
			SyncActiveDragApproachRingDiscSorting();
		}
	}

	private void UpdateActiveDragApproachRingVisual(Vector2 currentPosition)
	{
		if (!showActiveDragApproachRing ||
			activeDragApproachRingOwner == null ||
			activeDragApproachRingRect == null ||
			activeDragApproachRingDisc == null)
		{
			return;
		}

		float speed01 = Mathf.Clamp01(dragSpeedVisual01);
		float maxScale = Mathf.Lerp(activeDragApproachRingIdleScale, activeDragApproachRingFastScale, speed01);
		float pulseDepth = Mathf.Clamp01(activeDragApproachRingPulseDepth);
		float minScale = Mathf.Lerp(maxScale, 1f, pulseDepth);
		float pulse01 = 0.5f + (0.5f * Mathf.Sin(Time.unscaledTime * Mathf.Max(0.5f, activeDragApproachRingPulseHz) * Mathf.PI * 2f));
		float ringScale = Mathf.Lerp(maxScale, minScale, pulse01);
		PrepareActiveDragApproachCueWindow(activeDragApproachRingOwner);

		float timingAlphaMul = 1f;
		if (activeDragCueState.isPrepared && wispActive)
		{
			float greenStart = wispGreenZoneStartRuntime;
			float closure01 = EvaluateApproachRingClosure01(activeDragCueState.progress01);
			float imminence01 = EvaluateApproachRingImminence01(activeDragCueState.progress01, greenStart);

			// Keep the drag ring responsive to hand speed, but let it close slightly with the same
			// chart-timed envelope as the moving target so the three cue phases feel related.
			ringScale *= Mathf.Lerp(1.14f, 1f, closure01);
			ringScale *= Mathf.Lerp(1.015f, 1f, imminence01);
			timingAlphaMul = Mathf.Lerp(1f, 0.84f, closure01);
		}

		activeDragApproachRingRect.localScale = Vector3.one;

		float bubbleRadiusPx = Mathf.Max(4f, GetEquationBubbleVisualRadius(activeDragApproachRingOwner));
		float targetVisualRadiusPx = Mathf.Max(4f, bubbleRadiusPx * ringScale);
		float d = Mathf.Max(8f, ToWispShapeUnits(targetVisualRadiusPx * 2f));
		float thickness = Mathf.Max(0.75f, d * Mathf.Clamp(activeDragApproachRingThicknessRatio, 0.01f, 0.12f));
		float radius = Mathf.Max(1f, (d * 0.5f) - (thickness * 0.5f));
		activeDragApproachRingDisc.Thickness = thickness;
		activeDragApproachRingDisc.Radius = radius;
		SyncActiveDragApproachRingDiscSorting();

		Color ringColor = activeDragApproachRingColor;
		float overlapAlphaMul = 1f;
		if (wispActive && TryGetWispOverlapInfo(currentPosition, out float proximity, out _, out WispOverlapZone zone))
		{
			ringColor = zone switch
			{
				WispOverlapZone.Perfect => wispOverlapPerfectColor,
				WispOverlapZone.Good => wispOverlapGoodColor,
				WispOverlapZone.Early => wispOverlapEarlyColor,
				WispOverlapZone.Late => wispOverlapLateColor,
				_ => ringColor
			};
			overlapAlphaMul = Mathf.Lerp(0.82f, 1f, proximity);
		}
		else if (currentDraggingElement != null)
		{
			ringColor = bubbleDraggingOutline;
		}

		float baseAlpha = Mathf.Clamp01(activeDragApproachRingBaseAlpha);
		float speedAlphaMul = Mathf.Lerp(0.45f, 1f, speed01);
		float pulseAlphaMul = Mathf.Lerp(1f, 0.72f, pulse01 * 0.7f);
		ringColor.a = Mathf.Clamp01(baseAlpha * speedAlphaMul * overlapAlphaMul * pulseAlphaMul * timingAlphaMul);
		activeDragApproachRingDisc.Color = ringColor;
		SetApproachCueVisibility(ref activeDragCueState, ringColor.a > 0.001f);
	}

	private void PrepareActiveDragApproachCueWindow(EquationBubbleElement owner)
	{
		if (!wispActive || owner == null)
		{
			return;
		}

		bool needNewWindow =
			!activeDragCueState.isPrepared ||
			activeDragCueState.windowId != (activeWispWindowState.isPrepared ? activeWispWindowState.windowId : -1) ||
			!activeDragCueState.MatchesOwner(owner);
		if (needNewWindow)
		{
			PrepareApproachCueWindow(
				ref activeDragCueState,
				ApproachCueKind.ActiveDrag,
				owner,
				ApproachCueSemantic.DragFeedback,
				wispStartSongTime,
				wispEndSongTime,
				wispTargetBeatIndex,
				activeWispWindowState.isPrepared ? activeWispWindowState.windowId : -1,
				wispTimingPrepared ? "drag-runtime" : "drag-fallback");
		}
		else
		{
			RebindApproachCueOwner(ref activeDragCueState, owner);
		}

		SetApproachCueProgress(ref activeDragCueState, wispProgress);
	}

	private void ClearActiveDragApproachRing()
	{
		if (activeDragApproachRingDisc != null)
		{
			DOTween.Kill(activeDragApproachRingDisc);
			Color hidden = activeDragApproachRingDisc.Color;
			hidden.a = 0f;
			activeDragApproachRingDisc.Color = hidden;
			activeDragApproachRingDisc.gameObject.SetActive(false);
		}

		if (activeDragApproachRingRect != null)
		{
			DOTween.Kill(activeDragApproachRingRect);
			activeDragApproachRingRect.localScale = Vector3.one;
			activeDragApproachRingRect.localRotation = Quaternion.identity;
			activeDragApproachRingRect.anchoredPosition = Vector2.zero;
			if (equationContainer != null)
			{
				activeDragApproachRingRect.SetParent(equationContainer, false);
			}
		}

		activeDragApproachRingOwner = null;
		ResetActiveDragCueState();
	}

	#endregion
}
