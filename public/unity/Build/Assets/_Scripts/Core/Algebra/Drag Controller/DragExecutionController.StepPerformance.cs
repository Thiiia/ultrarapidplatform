using System.Collections;
using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;

using DG.Tweening;

using LeTai.Asset.TranslucentImage;
using Shapes;

public partial class DragExecutionController
{
	private enum StepPerformanceOutcome
	{
		Empty = 0,
		Perfect = 1,
		Good = 2,
		EarlyLate = 3,
	}

	[Header("Step Performance Bar (Bubble Mode)")]
	[SerializeField] private bool showStepPerformanceBar = true;
	[SerializeField, Tooltip("Optional external root. If empty, a runtime bar is created under the reference HUD container.")]
	private RectTransform stepPerformanceBarRootOverride;
	[SerializeField] private Vector2 stepPerformanceBarAnchoredPosition = new Vector2(0f, -78f);
	[SerializeField, Tooltip("Keep repetition meter auto-anchored below the locked/reference equation.")]
	private bool autoAnchorStepPerformanceBarToReference = true;
	[SerializeField, Min(0f), Tooltip("Vertical gap below the reference equation.")]
	private float stepPerformanceReferenceGap = 16f;
	[SerializeField, Tooltip("When true, preserve designer X offset and only auto-anchor Y.")]
	private bool stepPerformanceAnchorYOnly = true;
	[SerializeField, Min(80f)] private float stepPerformanceBarWidth = 344f;
	[SerializeField, Min(6f)] private float stepPerformanceBarHeight = 16f;
	[SerializeField, Min(0f)] private float stepPerformanceBarGap = 8f;
	[SerializeField, Tooltip("Use runtime-generated anti-aliased pill sprite for step slots to avoid jagged edges from low-res assets.")]
	private bool stepPerformanceUseGeneratedCapsuleSprite = true;
	[SerializeField, Tooltip("Render step-performance slots as solid fills (no glass blur), matching Figma.")]
	private bool stepPerformanceUseSolidFillStyle = true;
	[SerializeField, Tooltip("Adds a crisp Shapes outline on top of each slot for cleaner edges while keeping the TranslucentImage fill.")]
	private bool stepPerformanceUseShapesOutline = true;
	[SerializeField, Range(0f, 4f)] private float stepPerformanceShapesOutlineThickness = 1.15f;
	[SerializeField, Range(0f, 1f)] private float stepPerformanceShapesOutlineEmptyAlpha = 0.14f;
	[SerializeField, Range(0f, 1f)] private float stepPerformanceShapesOutlineFilledAlpha = 0.34f;
	[SerializeField, Tooltip("Auto-scale the step-performance bar from the locked/reference equation width so it stays responsive.")]
	private bool stepPerformanceAutoScaleToReferenceWidth = true;
	[SerializeField, Range(0.4f, 1f), Tooltip("Target width ratio relative to the locked/reference equation rect.")]
	private float stepPerformanceReferenceWidthRatio = 0.86f;
	[SerializeField, Min(0f), Tooltip("Extra horizontal padding removed from the reference width before sizing.")]
	private float stepPerformanceReferenceWidthPadding = 0f;
	[SerializeField, Min(8f), Tooltip("Minimum slot width when the number of reps increases.")]
	private float stepPerformanceMinSlotWidth = 22f;
	[SerializeField, Range(0.5f, 1.6f), Tooltip("Scales slot height with dynamic width (1 = proportional).")]
	private float stepPerformanceDynamicHeightScale = 1f;
	[SerializeField, Range(0.5f, 1.6f), Tooltip("Scales slot gap with dynamic width (1 = proportional).")]
	private float stepPerformanceDynamicGapScale = 1f;
	[SerializeField, Min(0.02f)] private float stepPerformanceVisualTweenSeconds = 0.12f;
	[SerializeField, Tooltip("Snap step-performance slot geometry to canvas pixels for crisper edges.")]
	private bool stepPerformancePixelSnap = true;
	[SerializeField] private Color stepPerformanceEmptyColor = AlgebraUiPalette.TrackGray;
	[SerializeField] private Color stepPerformancePerfectColor = AlgebraUiPalette.JudgementGreen;
	[SerializeField] private Color stepPerformanceGoodColor = AlgebraUiPalette.JudgementYellow;
	[SerializeField] private Color stepPerformanceEarlyLateColor = AlgebraUiPalette.JudgementRed;
	[SerializeField, Range(0f, 1f)] private float stepPerformanceEmptyOpacity = 0.86f;
	[SerializeField, Range(0f, 1f)] private float stepPerformanceFilledOpacity = 1f;
	[SerializeField] private Sprite stepPerformanceEmptySprite;
	[SerializeField] private Sprite stepPerformancePerfectSprite;
	[SerializeField] private Sprite stepPerformanceGoodSprite;
	[SerializeField] private Sprite stepPerformanceEarlyLateSprite;
	[SerializeField, Tooltip("Optional glossy highlight sprite laid on top of each slot.")]
	private Sprite stepPerformanceGlossSprite;
	[SerializeField, Range(0f, 1f)] private float stepPerformanceGlossAlpha = 0f;
	[SerializeField, Tooltip("If enabled, step-performance uses raw timing judgement before overlap/path downgrades.")]
	private bool stepPerformanceUseRawTimingResult = true;

	private RectTransform runtimeStepPerformanceBarRoot;
	private readonly List<TranslucentImage> stepPerformanceSlotImages = new List<TranslucentImage>(8);
	private readonly List<Rectangle> stepPerformanceSlotShapeOutlines = new List<Rectangle>(8);
	private readonly List<Image> stepPerformanceSlotGlosses = new List<Image>(8);
	private readonly List<StepPerformanceOutcome> currentStepPerformanceOutcomes = new List<StepPerformanceOutcome>(8);
	private TranslucentImageSource cachedStepPerformanceSource;
	private bool hasValidStepPerformanceAutoAnchor;
	private Coroutine deferredStepPerformanceAnchorRefreshCoroutine;
	private HitResult pendingStepPerformanceHitResult = HitResult.None;
	private float pendingStepPerformanceSignedErrorMs = float.NaN;
	private bool hasPendingStepPerformanceOutcome;
	private int stepPerformanceBuiltSlotCount = -1;
	private float stepPerformanceBuiltWidth = -1f;
	private float stepPerformanceBuiltHeight = -1f;
	private float stepPerformanceBuiltGap = -1f;
	private bool isBuildingStepPerformanceSlots;

	private void EnsureStepPerformanceBar(bool forceRebuild = false)
	{
		RectTransform root = ResolveStepPerformanceRoot(forceRebuild);
		if (root == null)
		{
			return;
		}

		if (!showStepPerformanceBar)
		{
			root.gameObject.SetActive(false);
			stepPerformanceSlotImages.Clear();
			stepPerformanceSlotShapeOutlines.Clear();
			stepPerformanceSlotGlosses.Clear();
			stepPerformanceBuiltSlotCount = -1;
			stepPerformanceBuiltWidth = -1f;
			stepPerformanceBuiltHeight = -1f;
			stepPerformanceBuiltGap = -1f;
			return;
		}

		root.gameObject.SetActive(true);
		EnsureStepPerformanceOutcomeCapacity();

		int slotCount = GetCurrentRequiredDragsForStep();
		bool needsRebuild = forceRebuild ||
			stepPerformanceSlotImages.Count != slotCount ||
			(stepPerformanceSlotImages.Count > 0 && stepPerformanceSlotImages[0] != null &&
				stepPerformanceSlotImages[0].transform.parent != root) ||
			StepPerformanceLayoutNeedsRebuild(root, slotCount);

		if (needsRebuild)
		{
			BuildStepPerformanceSlots(root, slotCount);
		}

		TryAutoAnchorStepPerformanceBar(root);
	}

	private void RequestDeferredStepPerformanceAnchorRefresh(int frameDelay = 2)
	{
		if (!isActive || !gameObject.activeInHierarchy)
		{
			return;
		}

		if (deferredStepPerformanceAnchorRefreshCoroutine != null)
		{
			return;
		}

		deferredStepPerformanceAnchorRefreshCoroutine = StartCoroutine(DeferredStepPerformanceAnchorRefresh(Mathf.Clamp(frameDelay, 1, 8)));
	}

	private IEnumerator DeferredStepPerformanceAnchorRefresh(int frameDelay)
	{
		for (int i = 0; i < frameDelay; i++)
		{
			yield return null;
		}

		Canvas.ForceUpdateCanvases();
		EnsureStepPerformanceBar(forceRebuild: false);
		deferredStepPerformanceAnchorRefreshCoroutine = null;
	}

	private RectTransform ResolveStepPerformanceRoot(bool forceRebuild)
	{
		if (stepPerformanceBarRootOverride != null)
		{
			if (runtimeStepPerformanceBarRoot != null)
			{
				runtimeStepPerformanceBarRoot.gameObject.SetActive(false);
			}
			hasValidStepPerformanceAutoAnchor = false;

			if (forceRebuild)
			{
				ClearGeneratedStepPerformanceSlots(stepPerformanceBarRootOverride);
			}

			return stepPerformanceBarRootOverride;
		}

		if (referenceHudContainer == null)
		{
			return null;
		}

		if (runtimeStepPerformanceBarRoot == null)
		{
			GameObject rootObj = new GameObject("StepPerformanceBar", typeof(RectTransform));
			rootObj.transform.SetParent(referenceHudContainer, false);
			runtimeStepPerformanceBarRoot = rootObj.GetComponent<RectTransform>();
			runtimeStepPerformanceBarRoot.anchorMin = new Vector2(0.5f, 0.5f);
			runtimeStepPerformanceBarRoot.anchorMax = new Vector2(0.5f, 0.5f);
			runtimeStepPerformanceBarRoot.pivot = new Vector2(0.5f, 0.5f);
			hasValidStepPerformanceAutoAnchor = false;
		}
		else if (runtimeStepPerformanceBarRoot.parent != referenceHudContainer)
		{
			if (!TrySetParentSafe(runtimeStepPerformanceBarRoot, referenceHudContainer, false, nameof(ResolveStepPerformanceRoot) + ".runtimeStepPerformanceBarRoot"))
			{
				return null;
			}
			hasValidStepPerformanceAutoAnchor = false;
		}

		if (!autoAnchorStepPerformanceBarToReference)
		{
			runtimeStepPerformanceBarRoot.anchoredPosition = stepPerformanceBarAnchoredPosition;
			hasValidStepPerformanceAutoAnchor = false;
		}
		else if (!hasValidStepPerformanceAutoAnchor)
		{
			ApplyStepPerformanceFallbackPosition(runtimeStepPerformanceBarRoot);
		}
		float rootWidth = stepPerformanceBuiltWidth > 0.01f ? stepPerformanceBuiltWidth : stepPerformanceBarWidth;
		float rootHeight = stepPerformanceBuiltHeight > 0.01f ? stepPerformanceBuiltHeight : stepPerformanceBarHeight;
		runtimeStepPerformanceBarRoot.sizeDelta = new Vector2(rootWidth, rootHeight);

		if (forceRebuild)
		{
			ClearGeneratedStepPerformanceSlots(runtimeStepPerformanceBarRoot);
		}

		return runtimeStepPerformanceBarRoot;
	}

	private void ApplyStepPerformanceFallbackPosition(RectTransform root)
	{
		if (root == null)
		{
			return;
		}

		Vector2 fallback = root.anchoredPosition;
		fallback.y = stepPerformanceBarAnchoredPosition.y;
		if (!stepPerformanceAnchorYOnly)
		{
			fallback.x = stepPerformanceBarAnchoredPosition.x;
		}
		if (stepPerformancePixelSnap)
		{
			Canvas canvas = root.GetComponentInParent<Canvas>();
			float scale = canvas != null ? Mathf.Max(0.0001f, canvas.scaleFactor) : 1f;
			fallback.x = SnapValueToCanvasPixel(fallback.x, scale);
			fallback.y = SnapValueToCanvasPixel(fallback.y, scale);
		}
		root.anchoredPosition = fallback;
	}

	private void TryAutoAnchorStepPerformanceBar(RectTransform root)
	{
		if (root == null)
		{
			return;
		}

		if (!autoAnchorStepPerformanceBarToReference)
		{
			ApplyStepPerformanceFallbackPosition(root);
			hasValidStepPerformanceAutoAnchor = false;
			return;
		}

		RectTransform referenceRect = lockedInEquationUI != null ? lockedInEquationUI.GetComponent<RectTransform>() : null;
		RectTransform parentRect = root.parent as RectTransform;
		if (referenceRect == null || parentRect == null || !referenceRect.gameObject.activeInHierarchy)
		{
			hasValidStepPerformanceAutoAnchor = false;
			ApplyStepPerformanceFallbackPosition(root);
			RequestDeferredStepPerformanceAnchorRefresh(2);
			return;
		}

		Vector3 parentScale = parentRect.lossyScale;
		if (Mathf.Abs(parentScale.x) < 0.25f || Mathf.Abs(parentScale.y) < 0.25f)
		{
			hasValidStepPerformanceAutoAnchor = false;
			ApplyStepPerformanceFallbackPosition(root);
			RequestDeferredStepPerformanceAnchorRefresh(2);
			return;
		}

		Camera cam = null;
		Canvas canvas = parentRect.GetComponentInParent<Canvas>();
		if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
		{
			cam = canvas.worldCamera != null ? canvas.worldCamera : uiCamera;
		}

		Canvas.ForceUpdateCanvases();

		if (!TryGetLocalRect(referenceRect, parentRect, cam, out Rect referenceLocal))
		{
			hasValidStepPerformanceAutoAnchor = false;
			ApplyStepPerformanceFallbackPosition(root);
			RequestDeferredStepPerformanceAnchorRefresh(2);
			return;
		}

		float rootHeight = root.rect.height > 0f ? root.rect.height : Mathf.Max(6f, stepPerformanceBarHeight);
		float halfHeight = rootHeight * 0.5f;
		float scaleFactor = canvas != null ? Mathf.Max(0.0001f, canvas.scaleFactor) : 1f;
		float gapUnits = Mathf.Max(0f, stepPerformanceReferenceGap) / scaleFactor;
		float anchoredY = referenceLocal.yMin - gapUnits - halfHeight;

		Vector2 anchored = root.anchoredPosition;
		if (!stepPerformanceAnchorYOnly)
		{
			anchored.x = referenceLocal.center.x + stepPerformanceBarAnchoredPosition.x;
		}
		anchored.y = anchoredY;
		if (stepPerformancePixelSnap)
		{
			anchored.x = SnapValueToCanvasPixel(anchored.x, scaleFactor);
			anchored.y = SnapValueToCanvasPixel(anchored.y, scaleFactor);
		}
		root.anchoredPosition = anchored;
		hasValidStepPerformanceAutoAnchor = true;
	}

	private void ClearGeneratedStepPerformanceSlots(RectTransform root)
	{
		if (root == null)
		{
			stepPerformanceSlotImages.Clear();
			stepPerformanceSlotShapeOutlines.Clear();
			stepPerformanceSlotGlosses.Clear();
			stepPerformanceBuiltSlotCount = -1;
			stepPerformanceBuiltWidth = -1f;
			stepPerformanceBuiltHeight = -1f;
			stepPerformanceBuiltGap = -1f;
			return;
		}

		for (int i = root.childCount - 1; i >= 0; i--)
		{
			Transform child = root.GetChild(i);
			if (child != null && child.name.StartsWith("PerfSlot_"))
			{
				KillTweensOnTransform(child);
				Destroy(child.gameObject);
			}
		}

		stepPerformanceSlotImages.Clear();
		stepPerformanceSlotShapeOutlines.Clear();
		stepPerformanceSlotGlosses.Clear();
		stepPerformanceBuiltSlotCount = -1;
		stepPerformanceBuiltWidth = -1f;
		stepPerformanceBuiltHeight = -1f;
		stepPerformanceBuiltGap = -1f;
	}

	private static bool IsCloseStepMetric(float a, float b)
	{
		return Mathf.Abs(a - b) <= 0.25f;
	}

	private bool ResolveStepPerformanceLayoutMetrics(
		RectTransform root,
		int slotCount,
		out float totalWidth,
		out float slotHeight,
		out float slotGap,
		out float scaleFactor)
	{
		totalWidth = Mathf.Max(80f, stepPerformanceBarWidth);
		slotHeight = Mathf.Max(6f, stepPerformanceBarHeight);
		slotGap = Mathf.Max(0f, stepPerformanceBarGap);
		scaleFactor = 1f;

		if (root == null)
		{
			return false;
		}

		Canvas canvas = root.GetComponentInParent<Canvas>();
		scaleFactor = canvas != null ? Mathf.Max(0.0001f, canvas.scaleFactor) : 1f;

		float widthScale = 1f;
		if (stepPerformanceAutoScaleToReferenceWidth && lockedInEquationUI != null && root.parent is RectTransform parentRect)
		{
			RectTransform referenceRect = lockedInEquationUI.GetComponent<RectTransform>();
			if (referenceRect != null && referenceRect.gameObject.activeInHierarchy)
			{
				Camera cam = null;
				if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
				{
					cam = canvas.worldCamera != null ? canvas.worldCamera : uiCamera;
				}

				if (TryGetLocalRect(referenceRect, parentRect, cam, out Rect referenceLocal))
				{
					float referenceWidth = Mathf.Max(0f, referenceLocal.width - Mathf.Max(0f, stepPerformanceReferenceWidthPadding));
					if (referenceWidth > 0.01f)
					{
						float targetWidth = referenceWidth * Mathf.Clamp(stepPerformanceReferenceWidthRatio, 0.4f, 1f);
						totalWidth = Mathf.Max(80f, targetWidth);
						widthScale = totalWidth / Mathf.Max(1f, stepPerformanceBarWidth);
					}
				}
			}
		}

		slotHeight *= Mathf.Lerp(1f, widthScale, Mathf.Clamp(stepPerformanceDynamicHeightScale, 0.5f, 1.6f));
		slotGap *= Mathf.Lerp(1f, widthScale, Mathf.Clamp(stepPerformanceDynamicGapScale, 0.5f, 1.6f));

		float minWidthForSlots = (Mathf.Max(8f, stepPerformanceMinSlotWidth) * Mathf.Max(1, slotCount)) + (slotGap * Mathf.Max(0, slotCount - 1));
		totalWidth = Mathf.Max(totalWidth, minWidthForSlots);

		if (stepPerformancePixelSnap)
		{
			totalWidth = SnapValueToCanvasPixel(totalWidth, scaleFactor);
			slotHeight = SnapValueToCanvasPixel(slotHeight, scaleFactor);
			slotGap = SnapValueToCanvasPixel(slotGap, scaleFactor);
		}

		slotHeight = Mathf.Max(6f, slotHeight);
		slotGap = Mathf.Max(0f, slotGap);
		totalWidth = Mathf.Max(80f, totalWidth);
		return true;
	}

	private bool StepPerformanceLayoutNeedsRebuild(RectTransform root, int slotCount)
	{
		if (root == null)
		{
			return false;
		}

		if (stepPerformanceBuiltSlotCount != slotCount)
		{
			return true;
		}

		if (!ResolveStepPerformanceLayoutMetrics(root, slotCount, out float totalWidth, out float slotHeight, out float slotGap, out _))
		{
			return false;
		}

		return !IsCloseStepMetric(stepPerformanceBuiltWidth, totalWidth) ||
			!IsCloseStepMetric(stepPerformanceBuiltHeight, slotHeight) ||
			!IsCloseStepMetric(stepPerformanceBuiltGap, slotGap);
	}

	private void BuildStepPerformanceSlots(RectTransform root, int slotCount)
	{
		if (root == null)
		{
			return;
		}

		if (isBuildingStepPerformanceSlots)
		{
			return;
		}

		isBuildingStepPerformanceSlots = true;
		try
		{

			ClearGeneratedStepPerformanceSlots(root);
			if (!stepPerformanceUseSolidFillStyle)
			{
				EnsureStepPerformanceSource();
			}

			ResolveStepPerformanceLayoutMetrics(root, slotCount, out float totalWidth, out float slotHeight, out float slotGap, out float scaleFactor);

			float totalGap = slotGap * Mathf.Max(0, slotCount - 1);
			float slotWidth = Mathf.Max(8f, (totalWidth - totalGap) / Mathf.Max(1, slotCount));
			slotWidth = Mathf.Max(slotWidth, Mathf.Max(8f, stepPerformanceMinSlotWidth));
			if (stepPerformancePixelSnap)
			{
				slotWidth = SnapValueToCanvasPixel(slotWidth, scaleFactor);
				totalWidth = SnapValueToCanvasPixel((slotWidth * slotCount) + (slotGap * Mathf.Max(0, slotCount - 1)), scaleFactor);
			}

			float left = -(totalWidth * 0.5f) + (slotWidth * 0.5f);
			root.sizeDelta = new Vector2(totalWidth, slotHeight);

			for (int i = 0; i < slotCount; i++)
			{
				GameObject slotObj = new GameObject($"PerfSlot_{i + 1}", typeof(RectTransform), typeof(TranslucentImage));
				slotObj.transform.SetParent(root, false);

				RectTransform slotRect = slotObj.GetComponent<RectTransform>();
				slotRect.anchorMin = new Vector2(0.5f, 0.5f);
				slotRect.anchorMax = new Vector2(0.5f, 0.5f);
				slotRect.pivot = new Vector2(0.5f, 0.5f);
				slotRect.sizeDelta = new Vector2(slotWidth, slotHeight);
				float slotX = left + (i * (slotWidth + slotGap));
				if (stepPerformancePixelSnap)
				{
					slotX = SnapValueToCanvasPixel(slotX, scaleFactor);
				}
				slotRect.anchoredPosition = new Vector2(slotX, 0f);

				TranslucentImage slotImage = slotObj.GetComponent<TranslucentImage>();
				slotImage.raycastTarget = false;
				slotImage.sprite = ResolveStepPerformanceSprite(StepPerformanceOutcome.Empty);
				slotImage.type = Image.Type.Sliced;
				Color initialColor = stepPerformanceEmptyColor;
				float initialForegroundOpacity = stepPerformanceEmptyOpacity;
				if (stepPerformanceUseSolidFillStyle)
				{
					initialColor.a *= stepPerformanceEmptyOpacity;
					initialForegroundOpacity = 1f;
					slotImage.source = null;
				}
				slotImage.color = initialColor;
				slotImage.foregroundOpacity = initialForegroundOpacity;
				if (!stepPerformanceUseSolidFillStyle && slotImage.source == null && cachedStepPerformanceSource != null)
				{
					slotImage.source = cachedStepPerformanceSource;
				}

				TryConfigureTranslucentCapsule(slotObj, slotRect);
				stepPerformanceSlotImages.Add(slotImage);

				Rectangle shapeOutline = null;
				if (stepPerformanceUseShapesOutline)
				{
					GameObject shapeObj = new GameObject("ShapeOutline", typeof(RectTransform), typeof(Rectangle));
					shapeObj.transform.SetParent(slotObj.transform, false);
					RectTransform shapeRect = shapeObj.GetComponent<RectTransform>();
					shapeRect.anchorMin = Vector2.zero;
					shapeRect.anchorMax = Vector2.one;
					shapeRect.offsetMin = Vector2.zero;
					shapeRect.offsetMax = Vector2.zero;
					shapeRect.pivot = new Vector2(0.5f, 0.5f);

					shapeOutline = shapeObj.GetComponent<Rectangle>();
					shapeOutline.Color = new Color(stepPerformanceEmptyColor.r, stepPerformanceEmptyColor.g, stepPerformanceEmptyColor.b, Mathf.Clamp01(stepPerformanceShapesOutlineEmptyAlpha));
					shapeOutline.Thickness = Mathf.Max(0f, stepPerformanceShapesOutlineThickness);
				}
				stepPerformanceSlotShapeOutlines.Add(shapeOutline);

				Image gloss = null;
				if (stepPerformanceGlossAlpha > 0f)
				{
					GameObject glossObj = new GameObject("Gloss", typeof(RectTransform), typeof(Image));
					glossObj.transform.SetParent(slotObj.transform, false);
					RectTransform glossRect = glossObj.GetComponent<RectTransform>();
					glossRect.anchorMin = new Vector2(0.06f, 0.52f);
					glossRect.anchorMax = new Vector2(0.94f, 0.98f);
					glossRect.offsetMin = Vector2.zero;
					glossRect.offsetMax = Vector2.zero;

					gloss = glossObj.GetComponent<Image>();
					gloss.raycastTarget = false;
					gloss.sprite = stepPerformanceGlossSprite != null ? stepPerformanceGlossSprite : ResolveStepPerformanceSprite(StepPerformanceOutcome.Empty);
					gloss.type = Image.Type.Sliced;
					gloss.color = new Color(1f, 1f, 1f, stepPerformanceGlossAlpha * 0.35f);
				}
				stepPerformanceSlotGlosses.Add(gloss);
			}

			stepPerformanceBuiltSlotCount = slotCount;
			stepPerformanceBuiltWidth = totalWidth;
			stepPerformanceBuiltHeight = slotHeight;
			stepPerformanceBuiltGap = slotGap;
		}
		finally
		{
			isBuildingStepPerformanceSlots = false;
		}

		RefreshStepPerformanceBarVisualsOnly();
	}

	private void EnsureStepPerformanceSource()
	{
		cachedStepPerformanceSource = ResolveStepPerformanceSourceIncludingInactive();
	}

	private TranslucentImageSource ResolveStepPerformanceSourceIncludingInactive()
	{
		if (IsSceneComponentAlive(cachedStepPerformanceSource))
		{
			return cachedStepPerformanceSource;
		}

#if UNITY_2023_1_OR_NEWER
		cachedStepPerformanceSource = FindFirstObjectByType<TranslucentImageSource>(FindObjectsInactive.Include);
#else
		cachedStepPerformanceSource = FindFirstObjectByType<TranslucentImageSource>();
#endif
		if (cachedStepPerformanceSource != null)
		{
			return cachedStepPerformanceSource;
		}

		TranslucentImageSource[] allSources = Resources.FindObjectsOfTypeAll<TranslucentImageSource>();
		for (int i = 0; i < allSources.Length; i++)
		{
			TranslucentImageSource source = allSources[i];
			if (!IsSceneComponentAlive(source))
			{
				continue;
			}

			cachedStepPerformanceSource = source;
			return cachedStepPerformanceSource;
		}

		return null;
	}

	private Sprite ResolveStepPerformanceSprite(StepPerformanceOutcome outcome)
	{
		if (stepPerformanceUseGeneratedCapsuleSprite)
		{
			return GetFallbackPillSprite();
		}

		Sprite sprite = null;
		switch (outcome)
		{
			case StepPerformanceOutcome.Perfect:
				sprite = stepPerformancePerfectSprite;
				break;
			case StepPerformanceOutcome.Good:
				sprite = stepPerformanceGoodSprite;
				break;
			case StepPerformanceOutcome.EarlyLate:
				sprite = stepPerformanceEarlyLateSprite;
				break;
			default:
				sprite = stepPerformanceEmptySprite;
				break;
		}

		if (sprite == null)
		{
			sprite = stepPerformanceEmptySprite;
		}
		if (sprite == null)
		{
			sprite = GetFallbackWhiteSprite();
		}

		return sprite;
	}

	private void EnsureStepPerformanceOutcomeCapacity()
	{
		int slotCount = GetCurrentRequiredDragsForStep();
		if (currentStepPerformanceOutcomes.Count > slotCount)
		{
			currentStepPerformanceOutcomes.RemoveRange(slotCount, currentStepPerformanceOutcomes.Count - slotCount);
		}

		while (currentStepPerformanceOutcomes.Count < slotCount)
		{
			currentStepPerformanceOutcomes.Add(StepPerformanceOutcome.Empty);
		}
	}

	private void QueuePendingStepPerformanceOutcome(HitResult hitResult, float signedErrorMs)
	{
		hasPendingStepPerformanceOutcome = true;
		pendingStepPerformanceHitResult = hitResult;
		pendingStepPerformanceSignedErrorMs = signedErrorMs;
	}

	private StepPerformanceOutcome ConsumePendingStepPerformanceOutcome()
	{
		if (!hasPendingStepPerformanceOutcome)
		{
			return StepPerformanceOutcome.Good;
		}

		hasPendingStepPerformanceOutcome = false;
		HitResult result = pendingStepPerformanceHitResult;
		float signedError = pendingStepPerformanceSignedErrorMs;
		pendingStepPerformanceHitResult = HitResult.None;
		pendingStepPerformanceSignedErrorMs = float.NaN;

		switch (result)
		{
			case HitResult.Perfect:
				return StepPerformanceOutcome.Perfect;
			case HitResult.Good:
				return StepPerformanceOutcome.Good;
			case HitResult.Miss:
				return StepPerformanceOutcome.EarlyLate;
			default:
				if (!float.IsNaN(signedError))
				{
					return StepPerformanceOutcome.EarlyLate;
				}
				return StepPerformanceOutcome.Good;
		}
	}

	private void RecordCurrentStepPerformanceOutcome()
	{
		EnsureStepPerformanceOutcomeCapacity();
		int slotIndex = Mathf.Clamp(currentStepDragCount - 1, 0, Mathf.Max(0, currentStepPerformanceOutcomes.Count - 1));
		if (slotIndex < 0 || slotIndex >= currentStepPerformanceOutcomes.Count)
		{
			return;
		}

		currentStepPerformanceOutcomes[slotIndex] = ConsumePendingStepPerformanceOutcome();
		UpdateStepPerformanceBarVisuals(forceRebuild: false);
		PulseStepPerformanceSlot(slotIndex);
	}

	private void ResetCurrentStepPerformanceOutcomes()
	{
		hasPendingStepPerformanceOutcome = false;
		pendingStepPerformanceHitResult = HitResult.None;
		pendingStepPerformanceSignedErrorMs = float.NaN;

		EnsureStepPerformanceOutcomeCapacity();
		for (int i = 0; i < currentStepPerformanceOutcomes.Count; i++)
		{
			currentStepPerformanceOutcomes[i] = StepPerformanceOutcome.Empty;
		}

		UpdateStepPerformanceBarVisuals(forceRebuild: false);
	}

	private void PulseStepPerformanceSlot(int slotIndex)
	{
		if (slotIndex < 0 || slotIndex >= stepPerformanceSlotImages.Count)
		{
			return;
		}

		TranslucentImage slot = stepPerformanceSlotImages[slotIndex];
		if (slot == null)
		{
			return;
		}

		slot.transform.DOKill();
		slot.transform.localScale = Vector3.one;
		slot.transform.DOPunchScale(new Vector3(0.18f, 0.14f, 0f), 0.22f, 8, 0.6f).SetUpdate(true);

		if (slotIndex >= 0 && slotIndex < stepPerformanceSlotShapeOutlines.Count)
		{
			Rectangle outline = stepPerformanceSlotShapeOutlines[slotIndex];
			if (outline != null)
			{
				outline.DOKill();
				float baseThickness = Mathf.Max(0f, stepPerformanceShapesOutlineThickness);
				float pulseThickness = baseThickness + Mathf.Max(0.4f, baseThickness * 0.8f);
				outline.Thickness = pulseThickness;
				DOTween.To(() => outline.Thickness, v => outline.Thickness = v, baseThickness, 0.2f)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetTarget(outline)
					.SetLink(outline.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}
	}

	private void UpdateStepPerformanceBarVisuals(bool forceRebuild)
	{
		EnsureStepPerformanceBar(forceRebuild);
		RefreshStepPerformanceBarVisualsOnly();
	}

	private void RefreshStepPerformanceBarVisualsOnly()
	{
		if (!showStepPerformanceBar)
		{
			return;
		}

		EnsureStepPerformanceOutcomeCapacity();
		int filledSlots = Mathf.Clamp(currentStepDragCount, 0, currentStepPerformanceOutcomes.Count);

		for (int i = 0; i < stepPerformanceSlotImages.Count; i++)
		{
			TranslucentImage slot = stepPerformanceSlotImages[i];
			if (slot == null)
			{
				continue;
			}

			StepPerformanceOutcome outcome = i < filledSlots ? currentStepPerformanceOutcomes[i] : StepPerformanceOutcome.Empty;
			ApplyStepPerformanceSlotVisual(i, slot, outcome);
		}
	}

	private void ApplyStepPerformanceSlotVisual(int index, TranslucentImage slot, StepPerformanceOutcome outcome)
	{
		if (slot == null)
		{
			return;
		}

		Color targetColor;
		switch (outcome)
		{
			case StepPerformanceOutcome.Perfect:
				targetColor = stepPerformancePerfectColor;
				break;
			case StepPerformanceOutcome.Good:
				targetColor = stepPerformanceGoodColor;
				break;
			case StepPerformanceOutcome.EarlyLate:
				targetColor = stepPerformanceEarlyLateColor;
				break;
			default:
				targetColor = stepPerformanceEmptyColor;
				break;
		}

		float targetOpacity = outcome == StepPerformanceOutcome.Empty
			? stepPerformanceEmptyOpacity
			: stepPerformanceFilledOpacity;

		Sprite sprite = ResolveStepPerformanceSprite(outcome);
		if (slot.sprite != sprite)
		{
			slot.sprite = sprite;
		}

		slot.DOKill();
		float tweenSeconds = Mathf.Max(0.02f, stepPerformanceVisualTweenSeconds);
		if (stepPerformanceUseSolidFillStyle)
		{
			Color solidTarget = targetColor;
			solidTarget.a *= targetOpacity;
			slot.DOColor(solidTarget, tweenSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(slot.gameObject, LinkBehaviour.KillOnDestroy);
			slot.foregroundOpacity = 1f;
			slot.source = null;
		}
		else
		{
			slot.DOColor(targetColor, tweenSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(slot.gameObject, LinkBehaviour.KillOnDestroy);

			float from = slot.foregroundOpacity;
			DOTween.To(() => from, v =>
			{
				from = v;
				if (slot != null)
				{
					slot.foregroundOpacity = v;
				}
			}, targetOpacity, tweenSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(slot.gameObject, LinkBehaviour.KillOnDestroy);
		}

		if (index >= 0 && index < stepPerformanceSlotGlosses.Count)
		{
			Image gloss = stepPerformanceSlotGlosses[index];
			if (gloss != null)
			{
				Color gc = Color.Lerp(targetColor, Color.white, 0.75f);
				gc.a = stepPerformanceGlossAlpha * (outcome == StepPerformanceOutcome.Empty ? 0.35f : 1f);
				gloss.color = gc;
			}
		}

		if (index >= 0 && index < stepPerformanceSlotShapeOutlines.Count)
		{
			Rectangle outline = stepPerformanceSlotShapeOutlines[index];
			if (outline != null)
			{
				outline.DOKill();
				Color outlineTarget = targetColor;
				outlineTarget.a = Mathf.Clamp01(outcome == StepPerformanceOutcome.Empty ? stepPerformanceShapesOutlineEmptyAlpha : stepPerformanceShapesOutlineFilledAlpha);
				float thicknessTarget = Mathf.Max(0f, stepPerformanceShapesOutlineThickness);
				if (outcome != StepPerformanceOutcome.Empty)
				{
					thicknessTarget *= 1.08f;
				}

				DOTween.To(() => outline.Color, v => outline.Color = v, outlineTarget, tweenSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetTarget(outline)
					.SetLink(outline.gameObject, LinkBehaviour.KillOnDestroy);

				DOTween.To(() => outline.Thickness, v => outline.Thickness = v, thicknessTarget, tweenSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetTarget(outline)
					.SetLink(outline.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}
	}
}
