using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;
using DG.Tweening;
using LeTai.Asset.TranslucentImage;
using LeTai.Paraform.Scaffold;
using Shapes;
using Febucci.UI;

public class LockedInEquationUI : MonoBehaviour
{
	private static Sprite fallbackWhiteSprite;
	private static bool warnedAboutMissingTranslucentSource;

	[Header("Bind (optional)")]
	[SerializeField] private TextMeshProUGUI addOperatorText;
	[SerializeField] private TextMeshProUGUI equalsText;
	[SerializeField] private TextMeshProUGUI leftBubbleText;
	[SerializeField] private TextMeshProUGUI midBubbleText;
	[SerializeField] private TextMeshProUGUI rightBubbleText;

	[Header("Bubble Fill + Text Effects")]
	[SerializeField] private bool startBubblesEmpty = true;
	[SerializeField, Range(0f, 1f)] private float emptyBubbleAlpha = 0.14f;
	[SerializeField, Range(0f, 1f)] private float filledBubbleAlpha = 0.75f;
	[SerializeField, Min(0.05f)] private float bubbleFillTweenSeconds = 0.22f;
	[SerializeField] private bool useFebucciTextAnimator = true;
	[SerializeField] private string fillTextEffectTag = "bounce";
	[SerializeField, Min(0.05f)] private float fillTextEffectSeconds = 0.45f;
	[SerializeField] private bool splitDoubleDigitsIntoBubbles = true;
	[SerializeField, Range(0.5f, 1f)] private float doubleDigitBubbleScale = 0.78f;
	[SerializeField, Range(0f, 0.5f)] private float doubleDigitInnerSpacingRatio = 0.16f;
	[SerializeField, Tooltip("If an equation has no '=' token, still show the equals glyph.")]
	private bool forceEqualsIfMissing = true;

	[Header("Dynamic Equation Layout")]
	[SerializeField] private bool useDynamicEquationBubbles = true;
	[SerializeField, Tooltip("Prefer gameplay sizing as the reference for the locked equation while clamping it to the smaller Figma HUD scale.")]
	private bool useGameplayReferenceSizing = true;
	[SerializeField, Range(0.35f, 1f), Tooltip("Scale applied to gameplay sizing before it drives the locked equation HUD.")]
	private float gameplayReferenceScale = 0.74f;
	[SerializeField, Min(1f), Tooltip("Fallback locked-equation bubble diameter when gameplay sizing is unavailable. Figma locked variant is about 70px.")]
	private float dynamicReferenceBubbleDiameter = 70f;
	[SerializeField, Min(1f)] private float dynamicGameplayReferenceMinBubbleDiameter = 64f;
	[SerializeField, Min(1f)] private float dynamicGameplayReferenceMaxBubbleDiameter = 80f;
	[SerializeField, Min(0f)] private float dynamicHorizontalPadding = 52f;
	[SerializeField, Range(0.05f, 0.5f)] private float dynamicItemSpacingRatio = 0.18f;
	[SerializeField, Range(0.2f, 0.9f)] private float dynamicOperatorWidthRatio = 0.55f;
	[SerializeField] private Color dynamicVariableTextColor = Color.white;
	[SerializeField] private bool dynamicReserveLockBadgeSpace = true;
	[SerializeField, Min(0f)] private float dynamicLockBadgePadding = 18f;
	[SerializeField, Tooltip("Keep the equation visually centered even if we reserve space for the lock badge.")]
	private bool dynamicCenterIgnoreLockBadge = true;
	[SerializeField, Tooltip("Keep dynamic equation scale fixed after first layout pass to avoid visual size jumps during play.")]
	private bool lockDynamicScaleAfterFirstLayout = true;
	[SerializeField, Tooltip("Resize the locked bar to fit the current equation instead of shrinking tokens into the prefab's authored width.")]
	private bool dynamicResizeBarToContent = true;
	[SerializeField, Tooltip("When enabled, force the locked bar to a specific width/height (useful for manual Figma matching while keeping dynamic token layout).")]
	private bool dynamicUseManualBarSize = false;
	[SerializeField] private Vector2 dynamicManualBarSize = new Vector2(344f, 98f);
	[SerializeField, Min(0f), Tooltip("Minimum inner bar width. Figma short variant is ~344px.")]
	private float dynamicBarMinWidth = 344f;
	[SerializeField, Min(0f), Tooltip("Maximum inner bar width before the equation content scales down.")]
	private float dynamicBarMaxWidth = 510f;
	[SerializeField, Range(0.9f, 2f), Tooltip("Bar height relative to locked bubble diameter (Figma is ~1.38x).")]
	private float dynamicBarHeightBubbleRatio = 1.38f;
	[SerializeField, Range(0.12f, 0.45f), Tooltip("Corner radius relative to locked bubble diameter (Figma is ~0.29x).")]
	private float dynamicBarCornerRadiusBubbleRatio = 0.286f;
	[SerializeField, Range(0.4f, 1.6f), Tooltip("Lock badge size relative to locked bubble diameter (Figma is ~0.87x).")]
	private float dynamicLockBadgeSizeBubbleRatio = 0.87f;
	[SerializeField, Range(0f, 0.8f), Tooltip("How much of the lock badge remains inside the bar on the X axis.")]
	private float dynamicLockBadgeInsetRatio = 0.34f;
	[SerializeField, Range(0f, 0.8f), Tooltip("How much of the lock badge remains inside the bar on the Y axis.")]
	private float dynamicLockBadgeTopInsetRatio = 0.18f;
	[SerializeField, Range(0f, 1f), Tooltip("0 = ignore fit scaling, 1 = full fit-to-bar scaling.")]
	private float dynamicFitScaleInfluence = 0.9f;
	[SerializeField, Range(0.25f, 2f), Tooltip("Extra multiplier applied to dynamic content scale after fit logic.")]
	private float dynamicContentScaleMultiplier = 1f;
	[SerializeField, Range(0.1f, 1f)] private float dynamicMinContentScale = 0.72f;
	[SerializeField, Range(0.5f, 2f)] private float dynamicMaxContentScale = 1f;
	[SerializeField, Tooltip("Display implicit multiplication (e.g., 6x) as '6 × x'.")]
	private bool showImplicitMultiply = false;
	[SerializeField, Tooltip("Use a middle-dot glyph for implicit multiplication instead of ×.")]
	private bool showImplicitMultiplyAsDot = true;
	[SerializeField, Range(0.2f, 1f), Tooltip("Spacing multiplier between layout slots (left/mid/equals/right).")]
	private float dynamicSlotSpacingRatio = 0.35f;
	[SerializeField, Range(0.02f, 0.3f), Tooltip("Spacing ratio used between digits in a multi-digit number.")]
	private float dynamicDigitSpacingRatio = 0.04f;
	[SerializeField, Range(0.02f, 0.3f), Tooltip("Spacing ratio used between a number and an implied variable (e.g., 10x).")]
	private float dynamicImplicitMultiplySpacingRatio = 0.05f;
	[SerializeField, Tooltip("Snap dynamic equation positions to screen pixels to reduce jagged edges.")]
	private bool dynamicSnapToPixels = true;
	[SerializeField, Range(0.001f, 0.05f), Tooltip("Scale rounding step used when snapping (smaller = closer to true scale).")]
	private float dynamicScaleSnapStep = 0.01f;

	[Header("Equation Polish")]
	[SerializeField] private bool popOperatorsOnSpawn = false;
	[SerializeField, Range(0.6f, 1f)] private float operatorPopStartScale = 0.85f;
	[SerializeField, Min(0.01f)] private float operatorPopSeconds = 0.2f;
	[SerializeField] private bool shimmerOnEquationUpdate = false;
	[SerializeField, Range(0f, 0.4f)] private float shimmerIntensity = 0.12f;
	[SerializeField, Min(0.05f)] private float shimmerSeconds = 0.35f;
	[SerializeField] private bool equationIntroPulse = false;
	[SerializeField, Range(1f, 1.15f)] private float equationIntroScale = 1.04f;
	[SerializeField, Min(0.05f)] private float equationIntroSeconds = 0.18f;
	[SerializeField, Min(0.05f)] private float equationIntroFadeSeconds = 0.12f;
	[SerializeField] private bool dimInactiveSlotsOnDrag = true;
	[SerializeField, Range(0.2f, 1f)] private float inactiveSlotAlpha = 0.45f;
	[SerializeField, Min(0.01f)] private float slotDimSeconds = 0.12f;
	[SerializeField] private bool ghostPreviewEnabled = false;
	[SerializeField] private Sprite ghostPreviewSprite;
	[SerializeField] private Color ghostPreviewColor = new Color(1f, 1f, 1f, 0.35f);
	[SerializeField, Min(2f)] private float ghostPreviewSize = 18f;
	[SerializeField, Min(0.05f)] private float ghostPreviewDuration = 0.7f;
	[SerializeField] private Ease ghostPreviewEase = Ease.InOutSine;

	[Header("Progress Tint (optional)")]
	[SerializeField] private Rectangle outlineRectangle;
	[SerializeField, Min(0)] private int outlineShapeSortingOffset = 1;
	[SerializeField] private TranslucentImage barTranslucent;
	[SerializeField] private TranslucentImage lockBadgeTranslucent;
	[SerializeField] private TranslucentImage progressGrower;
	[SerializeField, Tooltip("Auto-assigns the scene TranslucentImageSource when prefab sources are missing.")]
	private bool autoAssignTranslucentSource = true;
	[SerializeField] private Sprite lockedBadgeSprite;
	[SerializeField] private Sprite unlockedBadgeSprite;
	[SerializeField] private float tintTweenSeconds = 0.18f;
	[SerializeField, Min(0.02f)] private float progressFillTweenSeconds = 0.25f;
	[SerializeField] private Ease progressFillEase = Ease.OutCubic;
	[SerializeField] private bool useProgressFillCurve = true;
	[SerializeField] private AnimationCurve progressFillCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
	[SerializeField] private Gradient progressGradient;
	[SerializeField] private bool pulseOnSolved = false;
	[SerializeField] private Color outlineLockedColor = new Color32(255, 71, 71, 255);   // #FF4747
	[SerializeField] private Color outlineProgressColor = new Color32(111, 0, 246, 255); // #6F00F6
	[SerializeField, Tooltip("Use the Figma-style red -> purple fill palette instead of the legacy gradient.")]
	private bool useUnifiedProgressFillPalette = true;
	[SerializeField] private Color progressFillLockedColor = new Color32(255, 71, 71, 255);   // #FF4747
	[SerializeField] private Color progressFillProgressColor = new Color32(111, 0, 246, 255); // #6F00F6
	[SerializeField, Range(0f, 1f)] private float progressGrowerMinAlpha = 0.72f;
	[SerializeField, Range(0f, 1f)] private float progressGrowerMaxAlpha = 0.9f;
	[SerializeField, Min(0f), Tooltip("Keeps the progress grower slightly inside the outline so rounded edges do not bleed past the bar border.")]
	private float progressGrowerInnerInset = 2f;
	[SerializeField, Tooltip("Offset very small progress values away from the bar's rounded left cap so the fill stays visually inside the outline.")]
	private bool progressGrowerRespectRoundedCap = true;
	[SerializeField, Range(0.5f, 2f), Tooltip("How long the rounded-cap offset persists, relative to the fill height.")]
	private float progressGrowerRoundedCapBlendWidth = 1f;
	[SerializeField, Tooltip("Y punch can protrude on small bars, so it is off by default.")]
	private bool progressGrowerPunchEnabled = false;
	[SerializeField, Tooltip("Use a fixed outline thickness for stronger color readability across progress states.")]
	private bool useFixedOutlineThickness = true;
	[SerializeField, Min(0.1f)] private float fixedOutlineThickness = 4f;
	[SerializeField, Min(0f), Tooltip("Used when fixed outline thickness is disabled.")]
	private float dynamicOutlineThicknessHeightRatio = 0.0172f;
	[SerializeField, Min(0.1f), Tooltip("Used when fixed outline thickness is disabled.")]
	private float dynamicOutlineMinThickness = 1.2f;
	[SerializeField, Min(0.1f), Tooltip("Used when fixed outline thickness is disabled.")]
	private float dynamicOutlineMaxThickness = 4f;
	[SerializeField, Range(0f, 0.25f)] private float outlineThicknessProgressBoost = 0.08f;
	[SerializeField, Range(0f, 0.12f)] private float progressGrowerPunchScaleY = 0.035f;
	[SerializeField, Min(0.05f)] private float progressGrowerPunchSeconds = 0.18f;
	[SerializeField] private Color lowProgressColor = new Color(1f, 0.25f, 0.25f, 1f);
	[SerializeField] private Color highProgressColor = new Color(0.25f, 1f, 0.4f, 1f);

	private Color outlineBaseColor;
	private float outlineBaseThickness;
	private Color barBaseColor;
	private Color lockBaseColor;
	private Color growerBaseColor;
	private float lastPulseTime;
	private RectTransform progressGrowerRect;
	private Vector2 progressGrowerBaseAnchoredPos;
	private Vector2 progressGrowerBaseSizeDelta;
	private Vector2 progressGrowerBasePivot;
	private Vector3 progressGrowerBaseScale = Vector3.one;
	private bool progressGrowerGeometryCached;
	private float progressGrowerBaseCornerRadius = -1f;
	private float progressGrowerLastCapsuleRadius = -1f;
	private float progressBarCornerRadius = -1f;
	private float leftBaseFontSize;
	private float midBaseFontSize;
	private float rightBaseFontSize;

	private Graphic leftBubbleGraphic;
	private Graphic midBubbleGraphic;
	private Graphic rightBubbleGraphic;

	private string lastLeftText = string.Empty;
	private string lastMidText = string.Empty;
	private string lastRightText = string.Empty;

	private readonly Dictionary<TextMeshProUGUI, Coroutine> resetTextEffects = new Dictionary<TextMeshProUGUI, Coroutine>(4);

	[Header("Drag Reaction (optional)")]
	[SerializeField, Range(0f, 0.4f)] private float dragParallaxStrength = 0.12f;
	[SerializeField] private float dragParallaxMax = 18f;
	[SerializeField, Range(1f, 1.25f)] private float dragFocusScale = 1.08f;
	[SerializeField, Min(0.01f)] private float dragTweenSeconds = 0.12f;
	[SerializeField, Min(0f)] private float dragFocusContainerPadding = 8f;

	private RectTransform leftBubbleRoot;
	private RectTransform midBubbleRoot;
	private RectTransform rightBubbleRoot;
	private Vector2 leftBasePos;
	private Vector2 midBasePos;
	private Vector2 rightBasePos;
	private Vector3 leftBaseScale;
	private Vector3 midBaseScale;
	private Vector3 rightBaseScale;
	private int dragFocusSlot = -1;
	private bool dragBasesCached;

	// Dynamic layout runtime objects (optional)
	private RectTransform dynamicRoot;
	private RectTransform dynamicLeftSlotRoot;
	private RectTransform dynamicMidSlotRoot;
	private RectTransform dynamicRightSlotRoot;
	private readonly CanvasGroup[] dynamicSlotCanvasGroups = new CanvasGroup[3];
	private RectTransform ghostPreviewRect;
	private Image ghostPreviewImage;
	private Tween ghostPreviewTween;
	private CanvasGroup equationIntroGroup;
	private Tween equationIntroTween;
	private Vector3 dynamicBaseScale = Vector3.one;
	private Quaternion dynamicBaseRotation = Quaternion.identity;
	private bool dynamicScaleLocked;
	private float lockedDynamicScale = 1f;
	private float dynamicBaselineY = 0f;
	private float dynamicBubbleCenterY = 0f;
	private float dynamicOperatorCenterY = 0f;
	private float dynamicOperatorHeight = 0f;
	private float dynamicBubbleHeight = 0f;
	private float dynamicBubbleWidth = 0f;
	private TextMeshProUGUI dynamicEqualsLabel;
	private readonly List<GameObject> dynamicSpawned = new List<GameObject>(48);
	private readonly List<Graphic>[] dynamicSlotBubbleGraphics = { new List<Graphic>(12), new List<Graphic>(12), new List<Graphic>(12) };
	private readonly List<TextMeshProUGUI>[] dynamicSlotBubbleTexts = { new List<TextMeshProUGUI>(12), new List<TextMeshProUGUI>(12), new List<TextMeshProUGUI>(12) };
	private bool dynamicLayoutReady;
	private string dynamicLastEquationString = string.Empty;
	private TranslucentImageSource cachedTranslucentSource;
	private bool hasGameplayReferenceSizing;
	private float gameplayReferenceBubbleSize = -1f;
	private float gameplayReferenceOperatorSize = -1f;
	private float gameplayReferenceBubbleSpacing = -1f;

	private void Awake()
	{
		AutoBindIfNeeded();
		SyncOutlineShapeSorting();
		EnsureTranslucentSources();
		EnsureGradientDefaults();
		EnsureProgressGrowerRuntimeSetup();
		CacheBaseColors();
		CacheBubbleGraphics();
		ApplyOperatorFontStyle(addOperatorText);
		lastLeftText = leftBubbleText != null ? leftBubbleText.text : string.Empty;
		lastMidText = midBubbleText != null ? midBubbleText.text : string.Empty;
		lastRightText = rightBubbleText != null ? rightBubbleText.text : string.Empty;

		// Keep "empty" state subtly visible (glass), otherwise TranslucentImage reads as "off".
		if (emptyBubbleAlpha <= 0.001f)
		{
			emptyBubbleAlpha = 0.14f;
		}

		if (startBubblesEmpty)
		{
			lastLeftText = string.Empty;
			lastMidText = string.Empty;
			lastRightText = string.Empty;

			SetBubbleFilled(leftBubbleGraphic, false, immediate: true);
			SetBubbleFilled(midBubbleGraphic, false, immediate: true);
			SetBubbleFilled(rightBubbleGraphic, false, immediate: true);

			SetText(leftBubbleText, "");
			SetText(midBubbleText, "");
			SetText(rightBubbleText, "");

			if (leftBubbleText != null) leftBubbleText.transform.parent.gameObject.SetActive(true);
			if (midBubbleText != null) midBubbleText.transform.parent.gameObject.SetActive(true);
			if (rightBubbleText != null) rightBubbleText.transform.parent.gameObject.SetActive(true);
		}
	}

	private void OnEnable()
	{
		SyncOutlineShapeSorting();
	}

	private void OnTransformParentChanged()
	{
		SyncOutlineShapeSorting();
	}

	private void OnCanvasHierarchyChanged()
	{
		SyncOutlineShapeSorting();
	}

	private void OnValidate()
	{
		if (!Application.isPlaying || !isActiveAndEnabled)
		{
			return;
		}

		// Manual tuning in play mode should reflow immediately without waiting for the next equation update.
		dynamicScaleLocked = false;
		lockedDynamicScale = 1f;
		if (useDynamicEquationBubbles && !string.IsNullOrWhiteSpace(dynamicLastEquationString))
		{
			BuildDynamicEquation(dynamicLastEquationString);
		}
	}

	private void CacheBubbleGraphics()
	{
		leftBubbleGraphic = GetBubbleGraphic(leftBubbleText);
		midBubbleGraphic = GetBubbleGraphic(midBubbleText);
		rightBubbleGraphic = GetBubbleGraphic(rightBubbleText);
		NormalizeOperatorTextLayout(addOperatorText);
		NormalizeOperatorTextLayout(equalsText);
		EnsureTranslucentSources();
	}

	private static Graphic GetBubbleGraphic(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return null;
		}

		Transform parent = tmp.transform != null ? tmp.transform.parent : null;
		return parent != null ? parent.GetComponent<Graphic>() : null;
	}

	private void EnsureProgressGrowerRuntimeSetup()
	{
		if (progressGrower == null)
		{
			return;
		}

		progressGrowerRect = progressGrower.rectTransform;
		progressGrower.raycastTarget = false;

		if (progressGrowerBaseCornerRadius < 0f)
		{
			Vector4 corners = progressGrower.paraformConfig.CornerRadii;
			progressGrowerBaseCornerRadius = Mathf.Max(0f, Mathf.Max(Mathf.Max(corners.x, corners.y), Mathf.Max(corners.z, corners.w)));
		}

		if (progressBarCornerRadius < 0f && barTranslucent != null)
		{
			Vector4 corners = barTranslucent.paraformConfig.CornerRadii;
			progressBarCornerRadius = Mathf.Max(0f, Mathf.Max(Mathf.Max(corners.x, corners.y), Mathf.Max(corners.z, corners.w)));
		}

		if (!progressGrowerGeometryCached)
		{
			InsetProgressGrowerToInterior();
		}

		// Cache the authored full-width geometry. We animate width directly instead of Image.fillAmount
		// so the prefab can stay as a simple TranslucentImage (no sprite/fill setup required).
		if (!progressGrowerGeometryCached && progressGrowerRect != null)
		{
			progressGrowerBaseAnchoredPos = progressGrowerRect.anchoredPosition;
			progressGrowerBaseSizeDelta = progressGrowerRect.sizeDelta;
			progressGrowerBasePivot = progressGrowerRect.pivot;
			progressGrowerBaseScale = progressGrowerRect.localScale;
			progressGrowerGeometryCached = progressGrowerBaseSizeDelta.x > 0.001f;
		}

		TryConfigureProgressGrowerCapsule();
		RefreshProgressGrowerVisibility();
	}

	private void TryConfigureProgressGrowerCapsule()
	{
		if (progressGrower == null || progressGrowerRect == null)
		{
			return;
		}

		Rect rect = progressGrowerRect.rect;
		float width = Mathf.Max(0.001f, rect.width);
		float height = Mathf.Max(0.001f, rect.height);
		// Keep a rounded/capsule-like moving head, but cap the max radius so the full bar
		// still reads like the authored rounded rectangle instead of a giant pill.
		float radiusCap = Mathf.Max(0.5f, Mathf.Max(progressGrowerBaseCornerRadius, height * 0.22f));
		float radius = Mathf.Clamp(Mathf.Min(width, height) * 0.5f, 0.5f, radiusCap);

		if (Mathf.Abs(radius - progressGrowerLastCapsuleRadius) <= 0.01f)
		{
			return;
		}

		ParaformConfig cfg = progressGrower.paraformConfig;
		cfg.CornerRadii = new Vector4(radius, radius, radius, radius);
		progressGrower.paraformConfig = cfg;
		progressGrower.SetVerticesDirty();
		progressGrowerLastCapsuleRadius = radius;
	}

	private float GetProgressGrowerInsetPixels()
	{
		float outlineInset = 0f;
		if (outlineRectangle != null)
		{
			outlineInset = Mathf.Max(0f, outlineRectangle.Thickness * 0.75f);
		}
		else if (outlineBaseThickness > 0.001f)
		{
			outlineInset = Mathf.Max(0f, outlineBaseThickness * 0.75f);
		}

		return Mathf.Max(0f, Mathf.Max(progressGrowerInnerInset, outlineInset));
	}

	private void InsetProgressGrowerToInterior(float? outerWidthOverride = null, float? outerHeightOverride = null)
	{
		if (progressGrowerRect == null)
		{
			return;
		}

		float outerWidth = outerWidthOverride ?? 0f;
		float outerHeight = outerHeightOverride ?? 0f;

		if (outerWidth <= 0.001f || outerHeight <= 0.001f)
		{
			RectTransform barRt = barTranslucent != null ? barTranslucent.rectTransform : null;
			if (barRt != null && barRt != progressGrowerRect)
			{
				Rect barRect = barRt.rect;
				outerWidth = Mathf.Max(outerWidth, barRect.width);
				outerHeight = Mathf.Max(outerHeight, barRect.height);
			}
		}

		if (outerWidth <= 0.001f || outerHeight <= 0.001f)
		{
			Rect current = progressGrowerRect.rect;
			outerWidth = Mathf.Max(outerWidth, current.width);
			outerHeight = Mathf.Max(outerHeight, current.height);
		}

		if (outerWidth <= 0.001f || outerHeight <= 0.001f)
		{
			return;
		}

		float inset = Mathf.Min(GetProgressGrowerInsetPixels(), Mathf.Min(outerWidth, outerHeight) * 0.45f);
		float width = Mathf.Max(1f, outerWidth - (inset * 2f));
		float height = Mathf.Max(1f, outerHeight - (inset * 2f));

		progressGrowerRect.sizeDelta = new Vector2(width, height);
		progressGrowerRect.anchoredPosition = Vector2.zero;
	}

	private float GetCurrentProgressGrower01()
	{
		if (progressGrowerRect == null || !progressGrowerGeometryCached || progressGrowerBaseSizeDelta.x <= 0.001f)
		{
			return 0f;
		}

		return Mathf.Clamp01(progressGrowerRect.sizeDelta.x / progressGrowerBaseSizeDelta.x);
	}

	private float GetProgressGrowerLeadingInsetScaled(float targetWidthScaled)
	{
		if (!progressGrowerRespectRoundedCap || progressGrowerRect == null || !progressGrowerGeometryCached)
		{
			return 0f;
		}

		float baseScaleX = Mathf.Abs(progressGrowerBaseScale.x) > 0.0001f ? progressGrowerBaseScale.x : 1f;
		float baseScaleY = Mathf.Abs(progressGrowerBaseScale.y) > 0.0001f ? progressGrowerBaseScale.y : 1f;
		float heightLocal = Mathf.Max(1f, progressGrowerRect.sizeDelta.y);
		float cornerExcessLocal = Mathf.Max(0f, progressBarCornerRadius - (heightLocal * 0.5f));
		float reserveLocal = Mathf.Min(
			Mathf.Max(0f, GetProgressGrowerInsetPixels() * 0.35f) + (cornerExcessLocal * 0.2f),
			heightLocal * 0.12f);
		if (reserveLocal <= 0.001f)
		{
			return 0f;
		}

		float reserveScaled = reserveLocal * baseScaleX;
		float currentHeightScaled = Mathf.Max(1f, progressGrowerRect.sizeDelta.y * baseScaleY);
		float blendThresholdScaled = Mathf.Max(currentHeightScaled * Mathf.Max(0.35f, progressGrowerRoundedCapBlendWidth * 0.5f), reserveScaled * 2f);
		float widthT = Mathf.Clamp01(targetWidthScaled / Mathf.Max(0.001f, blendThresholdScaled));
		float insetScaled = reserveScaled * (1f - widthT);
		float maxInsetScaled = Mathf.Max(0f, (progressGrowerBaseSizeDelta.x * baseScaleX) - targetWidthScaled);
		return Mathf.Min(insetScaled, maxInsetScaled);
	}

	private void ApplyProgressGrower01Immediate(float normalized)
	{
		if (progressGrowerRect == null || !progressGrowerGeometryCached)
		{
			return;
		}

		normalized = Mathf.Clamp01(normalized);

		float baseScaleX = Mathf.Abs(progressGrowerBaseScale.x) > 0.0001f ? progressGrowerBaseScale.x : 1f;
		float baseWidthScaled = Mathf.Max(0f, progressGrowerBaseSizeDelta.x * baseScaleX);
		float targetWidthScaled = baseWidthScaled * normalized;
		float targetWidthUnscaled = targetWidthScaled / baseScaleX;

		Vector2 size = progressGrowerRect.sizeDelta;
		size.x = targetWidthUnscaled;
		progressGrowerRect.sizeDelta = size;

		// Preserve the authored left edge while shrinking/growing width.
		float baseLeftX = progressGrowerBaseAnchoredPos.x - (baseWidthScaled * progressGrowerBasePivot.x);
		float leadingInsetScaled = GetProgressGrowerLeadingInsetScaled(targetWidthScaled);
		Vector2 pos = progressGrowerRect.anchoredPosition;
		pos.x = baseLeftX + leadingInsetScaled + (targetWidthScaled * progressGrowerBasePivot.x);
		pos.y = progressGrowerBaseAnchoredPos.y;
		progressGrowerRect.anchoredPosition = pos;

		TryConfigureProgressGrowerCapsule();
	}

	private bool ShouldPunchProgressGrower(float normalized)
	{
		if (!progressGrowerPunchEnabled || progressGrowerRect == null || !progressGrowerGeometryCached)
		{
			return false;
		}

		float baseScaleX = Mathf.Abs(progressGrowerBaseScale.x) > 0.0001f ? progressGrowerBaseScale.x : 1f;
		float projectedWidth = Mathf.Max(0f, progressGrowerBaseSizeDelta.x * normalized * baseScaleX);
		float currentHeight = progressGrowerRect.rect.height;
		float minimumStableWidth = Mathf.Max(currentHeight * 1.35f, 48f);
		return projectedWidth >= minimumStableWidth;
	}

	private void EnsureTranslucentSources()
	{
		if (!autoAssignTranslucentSource)
		{
			return;
		}

		if (cachedTranslucentSource == null)
		{
			cachedTranslucentSource = FindFirstObjectByType<TranslucentImageSource>();
			if (cachedTranslucentSource == null)
			{
				cachedTranslucentSource = FindFirstObjectByType<TranslucentImageSource>();
			}
		}

		if (cachedTranslucentSource == null)
		{
#if UNITY_EDITOR
			if (!warnedAboutMissingTranslucentSource)
			{
				warnedAboutMissingTranslucentSource = true;
				Debug.LogWarning("[LockedInEquationUI] No TranslucentImageSource found in scene; glass effect will be flat.");
			}
#endif
			return;
		}

		TryAssignTranslucentSource(barTranslucent);
		TryAssignTranslucentSource(lockBadgeTranslucent);
		TryAssignTranslucentSource(progressGrower);
		TryAssignTranslucentSource(leftBubbleGraphic);
		TryAssignTranslucentSource(midBubbleGraphic);
		TryAssignTranslucentSource(rightBubbleGraphic);

		for (int s = 0; s < dynamicSlotBubbleGraphics.Length; s++)
		{
			List<Graphic> graphics = dynamicSlotBubbleGraphics[s];
			for (int i = 0; i < graphics.Count; i++)
			{
				TryAssignTranslucentSource(graphics[i]);
			}
		}
	}

	private void TryAssignTranslucentSource(Graphic graphic)
	{
		if (graphic == null)
		{
			return;
		}

		if (graphic is TranslucentImage ti)
		{
			if (ti.source == null && cachedTranslucentSource != null)
			{
				ti.source = cachedTranslucentSource;
			}

			if (!ti.enabled)
			{
				ti.enabled = true;
			}

			if (ti.color.a <= 0f)
			{
				Color c = ti.color;
				c.a = 1f;
				ti.color = c;
			}

			if (ti.foregroundOpacity <= 0.001f)
			{
				ti.foregroundOpacity = Mathf.Max(0.01f, emptyBubbleAlpha);
			}
		}
	}

	private static Sprite GetFallbackWhiteSprite()
	{
		if (fallbackWhiteSprite != null)
		{
			return fallbackWhiteSprite;
		}

		// Create a 1x1 sprite from Unity's built-in white texture.
		// This avoids relying on editor-only UI/Skin resources.
		Texture2D tex = Texture2D.whiteTexture;
		fallbackWhiteSprite = Sprite.Create(tex, new Rect(0f, 0f, tex.width, tex.height), new Vector2(0.5f, 0.5f), pixelsPerUnit: 100f);
		fallbackWhiteSprite.name = "LockedInEquationUI_FallbackWhiteSprite";
		return fallbackWhiteSprite;
	}

	private void EnsureGradientDefaults()
	{
		if (progressGradient != null && progressGradient.colorKeys != null && progressGradient.colorKeys.Length > 0)
		{
			return;
		}

		progressGradient = new Gradient();
		progressGradient.SetKeys(
			new[]
			{
				new GradientColorKey(lowProgressColor, 0f),
				new GradientColorKey(new Color(1f, 0.75f, 0.25f, 1f), 0.5f),
				new GradientColorKey(highProgressColor, 1f),
			},
			new[]
			{
				new GradientAlphaKey(1f, 0f),
				new GradientAlphaKey(1f, 1f),
			}
		);
	}

	[ContextMenu("Auto Bind")]
	public void AutoBindIfNeeded()
	{
		if (addOperatorText == null)
		{
			Transform add = transform.Find("Add");
			if (add != null) addOperatorText = add.GetComponent<TextMeshProUGUI>();
		}

		if (equalsText == null)
		{
			Transform eq = transform.Find("Equal");
			if (eq != null) equalsText = eq.GetComponent<TextMeshProUGUI>();
		}

		if (leftBubbleText == null || midBubbleText == null || rightBubbleText == null)
		{
			// Bubble prefabs have a child TMP named "Text (TMP)".
			TextMeshProUGUI[] allTmps = GetComponentsInChildren<TextMeshProUGUI>(true);
			List<TextMeshProUGUI> bubbleTmps = new List<TextMeshProUGUI>(8);

			foreach (TextMeshProUGUI tmp in allTmps)
			{
				if (tmp == null) continue;
				if (tmp == addOperatorText || tmp == equalsText) continue;
				if (tmp.gameObject.name != "Text (TMP)" && tmp.gameObject.name != "Text") continue;
				bubbleTmps.Add(tmp);
			}

			bubbleTmps.Sort((a, b) =>
			{
				RectTransform ra = a.transform as RectTransform;
				RectTransform rb = b.transform as RectTransform;
				float ax = ra != null ? ra.anchoredPosition.x : a.transform.localPosition.x;
				float bx = rb != null ? rb.anchoredPosition.x : b.transform.localPosition.x;
				return ax.CompareTo(bx);
			});

			if (bubbleTmps.Count >= 1) leftBubbleText = bubbleTmps[0];
			if (bubbleTmps.Count >= 2) midBubbleText = bubbleTmps[1];
			if (bubbleTmps.Count >= 3) rightBubbleText = bubbleTmps[2];
		}

		if (leftBubbleGraphic == null || midBubbleGraphic == null || rightBubbleGraphic == null)
		{
			CacheBubbleGraphics();
		}

		if (outlineRectangle == null)
		{
			Transform rect = transform.Find("Rectangle");
			if (rect != null) outlineRectangle = rect.GetComponent<Rectangle>();
		}

		SyncOutlineShapeSorting();

		if (barTranslucent == null)
		{
			barTranslucent = GetComponent<TranslucentImage>();
		}

		if (lockBadgeTranslucent == null)
		{
			Transform lockTransform = transform.Find("Translucent Image");
			if (lockTransform != null) lockBadgeTranslucent = lockTransform.GetComponent<TranslucentImage>();
		}

		if (progressGrower == null)
		{
			Transform grower = transform.Find("Progress Grower");
			if (grower != null) progressGrower = grower.GetComponent<TranslucentImage>();
		}

		// Default lock/unlock sprites from Resources if not assigned.
		if (lockedBadgeSprite == null)
		{
			lockedBadgeSprite = Resources.Load<Sprite>("Locked pill");
		}

		if (unlockedBadgeSprite == null)
		{
			unlockedBadgeSprite = Resources.Load<Sprite>("Quickfire/unlocked pill");
		}

		EnsureTranslucentSources();
	}

	private void SyncOutlineShapeSorting()
	{
		if (outlineRectangle == null)
		{
			return;
		}

		Canvas sourceCanvas = GetComponentInParent<Canvas>();
		if (sourceCanvas != null)
		{
			outlineRectangle.SortingLayerID = sourceCanvas.sortingLayerID;
			outlineRectangle.SortingOrder = sourceCanvas.sortingOrder + Mathf.Max(1, outlineShapeSortingOffset);
		}

		outlineRectangle.ZTest = CompareFunction.Always;
	}

	public void SetEquationString(string equation)
	{
		AutoBindIfNeeded();

		if (string.IsNullOrWhiteSpace(equation))
		{
			dynamicLastEquationString = string.Empty;
			Apply("", "", "", "", "");
			return;
		}

		// Normalize spacing a bit.
		string trimmed = equation.Trim();
		// Normalize common unicode math symbols to ASCII so operator detection is stable.
		trimmed = trimmed
			.Replace('\u2212', '-') // minus
			.Replace('\u2013', '-') // en-dash
			.Replace('\u2014', '-') // em-dash
			.Replace('\uFF0B', '+') // fullwidth plus
			.Replace('\uFF1D', '=') // fullwidth equals
			.Replace('\u2261', '=') // identical to
			.Replace('\u2248', '=') // almost equal
			.Replace('\u00D7', '*') // multiplication sign
			.Replace('\u00B7', '*') // middle dot
			.Replace('\u00F7', '/'); // division sign
		dynamicLastEquationString = trimmed;

		if (useDynamicEquationBubbles)
		{
			BuildDynamicEquation(trimmed);
			PlayBarShimmer();
			PlayGhostPreview();
			PlayEquationIntroPulse();
			return;
		}

		string leftPart;
		string rightPart;
		int eqIdx = trimmed.IndexOf('=');
		if (eqIdx >= 0)
		{
			leftPart = trimmed.Substring(0, eqIdx).Trim();
			rightPart = trimmed.Substring(eqIdx + 1).Trim();
		}
		else
		{
			leftPart = trimmed;
			rightPart = "";
		}

		// Try split left into A [op] B (first + or - that isn't leading sign)
		string a = leftPart;
		string op = "";
		string b = "";

		for (int i = 1; i < leftPart.Length; i++)
		{
			char c = leftPart[i];
			if (c == '+' || c == '-')
			{
				a = leftPart.Substring(0, i).Trim();
				op = c.ToString();
				b = leftPart.Substring(i + 1).Trim();
				break;
			}
		}

		string equalsToken = eqIdx >= 0 ? "=" : (forceEqualsIfMissing ? "=" : "");
		Apply(a, op, b, equalsToken, rightPart);
		PlayBarShimmer();
		PlayEquationIntroPulse();
	}

	// Compatibility hook: DragExecutionController forwards gameplay sizing here so the
	// locked/reference HUD can stay proportional without inheriting the large template bubble.
	public void SetGameplayReferenceSizing(float bubbleSize, float operatorSize, float bubbleSpacing)
	{
		hasGameplayReferenceSizing = bubbleSize > 0.01f;
		gameplayReferenceBubbleSize = bubbleSize;
		gameplayReferenceOperatorSize = operatorSize;
		gameplayReferenceBubbleSpacing = bubbleSpacing;
		dynamicScaleLocked = false;
		lockedDynamicScale = 1f;

		if (useDynamicEquationBubbles && dynamicLayoutReady && !string.IsNullOrWhiteSpace(dynamicLastEquationString))
		{
			BuildDynamicEquation(dynamicLastEquationString);
		}
	}

	private DynamicReferenceMetrics ResolveDynamicReferenceMetrics()
	{
		RectTransform bubbleTemplateRoot = ResolveBubbleRoot(leftBubbleText) ?? ResolveBubbleRoot(midBubbleText) ?? ResolveBubbleRoot(rightBubbleText);
		float templateBubbleDiameter = GetTemplateBubbleDiameter(bubbleTemplateRoot);
		float bubbleDiameter = dynamicReferenceBubbleDiameter > 0.01f ? dynamicReferenceBubbleDiameter : templateBubbleDiameter;
		if (useGameplayReferenceSizing && hasGameplayReferenceSizing && gameplayReferenceBubbleSize > 0.01f)
		{
			bubbleDiameter = Mathf.Clamp(
				gameplayReferenceBubbleSize * Mathf.Max(0.01f, gameplayReferenceScale),
				Mathf.Max(1f, dynamicGameplayReferenceMinBubbleDiameter),
				Mathf.Max(Mathf.Max(1f, dynamicGameplayReferenceMinBubbleDiameter), dynamicGameplayReferenceMaxBubbleDiameter));
		}
		bubbleDiameter = Mathf.Max(1f, bubbleDiameter);

		float itemSpacing = bubbleDiameter * Mathf.Clamp(dynamicItemSpacingRatio, 0.05f, 0.5f);
		if (useGameplayReferenceSizing && hasGameplayReferenceSizing && gameplayReferenceBubbleSpacing > 0.01f)
		{
			itemSpacing = Mathf.Clamp(
				gameplayReferenceBubbleSpacing * Mathf.Max(0.01f, gameplayReferenceScale),
				bubbleDiameter * 0.05f,
				bubbleDiameter * 0.5f);
		}

		float operatorWidth = bubbleDiameter * Mathf.Clamp(dynamicOperatorWidthRatio, 0.2f, 0.9f);
		if (useGameplayReferenceSizing && hasGameplayReferenceSizing && gameplayReferenceOperatorSize > 0.01f)
		{
			operatorWidth = Mathf.Clamp(
				gameplayReferenceOperatorSize * Mathf.Max(0.01f, gameplayReferenceScale),
				bubbleDiameter * 0.2f,
				bubbleDiameter * 0.9f);
		}

		return new DynamicReferenceMetrics
		{
			bubbleDiameter = bubbleDiameter,
			itemSpacing = itemSpacing,
			operatorWidth = operatorWidth,
			operatorHeight = bubbleDiameter
		};
	}

	private static float GetTemplateBubbleDiameter(RectTransform bubbleTemplateRoot)
	{
		if (bubbleTemplateRoot == null)
		{
			return 0f;
		}

		float sx = Mathf.Abs(bubbleTemplateRoot.localScale.x);
		float sy = Mathf.Abs(bubbleTemplateRoot.localScale.y);
		float width = Mathf.Max(1f, bubbleTemplateRoot.rect.width * (sx > 0.0001f ? sx : 1f));
		float height = Mathf.Max(1f, bubbleTemplateRoot.rect.height * (sy > 0.0001f ? sy : 1f));
		return Mathf.Max(width, height);
	}

	private static float ResolveLockedBubbleFontSize(float bubbleDiameter, string text)
	{
		string glyph = string.IsNullOrWhiteSpace(text) ? string.Empty : text.Trim();
		int glyphCount = glyph.Length;

		// Figma reference equation states use ~70.5px bubbles with ~39.4px number/X text,
		// which lands closer to 0.56x bubble diameter than the previous oversized 0.62x.
		float baseSize = bubbleDiameter * 0.56f;
		if (glyphCount == 1 && glyph == "1")
		{
			baseSize *= 1.05f;
		}
		if (glyphCount >= 2)
		{
			baseSize *= 0.9f;
		}
		return Mathf.Clamp(baseSize, 18f, 68f);
	}

	private static float ResolveLockedOperatorFontSize(float bubbleDiameter, string text)
	{
		string symbol = (text ?? string.Empty).Trim();
		// Figma reference uses ~47.1px operators on ~70.5px bubbles, or about 0.67x.
		float size = bubbleDiameter * 0.67f;
		if (symbol == "=")
		{
			size *= 1.08f;
		}
		else if (symbol == "-")
		{
			size *= 1.08f;
		}
		else if (symbol == "/" || symbol == "\u00F7" || symbol == "*" || symbol == "\u00D7")
		{
			size *= 1.03f;
		}

		return Mathf.Clamp(size, 16f, 76f);
	}

	private static float ResolveLockedEqualsFontSize(float bubbleDiameter)
	{
		return Mathf.Clamp(bubbleDiameter * 0.74f, 24f, 70f);
	}

	private void NormalizeSpawnedBubbleTemplate(GameObject obj, TextMeshProUGUI tmp, float bubbleDiameter)
	{
		if (obj == null)
		{
			return;
		}

		RectTransform rt = obj.GetComponent<RectTransform>();
		if (rt != null)
		{
			rt.localScale = Vector3.one;
			rt.sizeDelta = new Vector2(bubbleDiameter, bubbleDiameter);
		}

		if (obj.GetComponent<Graphic>() is TranslucentImage bubbleGlass)
		{
			ApplyRoundedRectToTranslucent(bubbleGlass, bubbleDiameter * 0.5f);
		}

		Transform outline = obj.transform.Find("Outline");
		if (outline is RectTransform outlineRt)
		{
			outlineRt.anchorMin = Vector2.zero;
			outlineRt.anchorMax = Vector2.one;
			outlineRt.anchoredPosition = Vector2.zero;
			outlineRt.sizeDelta = Vector2.zero;
		}

		if (tmp != null)
		{
			RectTransform textRt = tmp.rectTransform;
			textRt.anchorMin = new Vector2(0.5f, 0.5f);
			textRt.anchorMax = new Vector2(0.5f, 0.5f);
			textRt.pivot = new Vector2(0.5f, 0.5f);
			textRt.anchoredPosition = Vector2.zero;
			textRt.sizeDelta = new Vector2(bubbleDiameter * 0.88f, bubbleDiameter * 0.88f);
			tmp.enableAutoSizing = false;
			tmp.fontSize = ResolveLockedBubbleFontSize(bubbleDiameter, tmp.text);
			tmp.fontSizeMin = tmp.fontSize;
			tmp.fontSizeMax = tmp.fontSize;
		}
	}

	private void ApplyDynamicBubbleTextSizing(TextMeshProUGUI tmp, float bubbleDiameter)
	{
		if (tmp == null)
		{
			return;
		}

		tmp.enableAutoSizing = false;
		float fontSize = ResolveLockedBubbleFontSize(bubbleDiameter, tmp.text);
		tmp.fontSize = fontSize;
		tmp.fontSizeMin = fontSize;
		tmp.fontSizeMax = fontSize;
		tmp.margin = Vector4.zero;
	}

	private void ApplyDynamicOperatorTextSizing(TextMeshProUGUI tmp, float bubbleDiameter)
	{
		if (tmp == null)
		{
			return;
		}

		tmp.enableAutoSizing = false;
		float fontSize = ResolveLockedOperatorFontSize(bubbleDiameter, tmp.text);
		tmp.fontSize = fontSize;
		tmp.fontSizeMin = fontSize;
		tmp.fontSizeMax = fontSize;
		tmp.margin = Vector4.zero;
	}

	private void ApplyDynamicEqualsTextSizing(TextMeshProUGUI tmp, float bubbleDiameter)
	{
		if (tmp == null)
		{
			return;
		}

		tmp.enableAutoSizing = false;
		float fontSize = ResolveLockedEqualsFontSize(bubbleDiameter);
		tmp.fontSize = fontSize;
		tmp.fontSizeMin = fontSize;
		tmp.fontSizeMax = fontSize;
		tmp.margin = Vector4.zero;
		tmp.characterSpacing = 0f;
		tmp.lineSpacing = 0f;
		tmp.paragraphSpacing = 0f;
	}

	private void RefreshProgressGrowerVisibility()
	{
		if (progressGrower == null)
		{
			return;
		}

		progressGrower.gameObject.SetActive(true);
	}

	private enum EqTokenKind
	{
		Number,
		Variable,
		Operator,
		Equals,
	}

	private struct EqToken
	{
		public EqTokenKind kind;
		public string text;
	}

	private struct Atom
	{
		public bool isBubble;
		public bool isVariable;
		public string text;
	}

	private struct DynamicReferenceMetrics
	{
		public float bubbleDiameter;
		public float itemSpacing;
		public float operatorWidth;
		public float operatorHeight;
	}

	private void EnsureDynamicLayout()
	{
		if (dynamicLayoutReady)
		{
			return;
		}

		AutoBindIfNeeded();

		// Dynamic equation is laid out relative to this prefab root (Locked In Equation).
		// The old static bubbles/operators are *offset* children, so we should not inherit a single bubble's anchoredPosition.
		dynamicBaseScale = Vector3.one;
		dynamicBaseRotation = Quaternion.identity;
		RectTransform bubbleTemplateRoot = ResolveBubbleRoot(leftBubbleText) ?? ResolveBubbleRoot(midBubbleText) ?? ResolveBubbleRoot(rightBubbleText);
		DynamicReferenceMetrics metrics = ResolveDynamicReferenceMetrics();
		// Keep the dynamic layout in the bar's local coordinate space; don't inherit the old 3-slot offsets.
		dynamicBubbleCenterY = 0f;
		dynamicBubbleWidth = Mathf.Max(1f, metrics.bubbleDiameter);
		dynamicBubbleHeight = Mathf.Max(1f, metrics.bubbleDiameter);

		dynamicOperatorCenterY = 0f;
		dynamicOperatorHeight = Mathf.Max(1f, metrics.operatorHeight);

		// Kept for backwards compatibility; baseline now means "bubble row center".
		dynamicBaselineY = dynamicBubbleCenterY;

		// Hide the static 3-slot layout (we'll use these objects as templates).
		if (addOperatorText != null) addOperatorText.gameObject.SetActive(false);
		if (equalsText != null) equalsText.gameObject.SetActive(false);
		if (leftBubbleText != null) leftBubbleText.transform.parent.gameObject.SetActive(false);
		if (midBubbleText != null) midBubbleText.transform.parent.gameObject.SetActive(false);
		if (rightBubbleText != null) rightBubbleText.transform.parent.gameObject.SetActive(false);

		Transform parentForDynamic = barTranslucent != null ? barTranslucent.transform : transform;
		GameObject rootObj = new GameObject("DynamicEquation", typeof(RectTransform));
		rootObj.transform.SetParent(parentForDynamic, false);
		int desiredSibling = -1;
		Transform siblingRef = bubbleTemplateRoot != null ? bubbleTemplateRoot.transform
			: (leftBubbleText != null ? leftBubbleText.transform.parent
			: (midBubbleText != null ? midBubbleText.transform.parent
			: (rightBubbleText != null ? rightBubbleText.transform.parent : null)));
		if (siblingRef != null && siblingRef.parent == parentForDynamic)
		{
			desiredSibling = siblingRef.GetSiblingIndex();
		}
		if (desiredSibling >= 0)
		{
			rootObj.transform.SetSiblingIndex(desiredSibling);
		}
		dynamicRoot = rootObj.GetComponent<RectTransform>();
		dynamicRoot.anchorMin = new Vector2(0.5f, 0.5f);
		dynamicRoot.anchorMax = new Vector2(0.5f, 0.5f);
		dynamicRoot.pivot = new Vector2(0.5f, 0.5f);
		dynamicRoot.anchoredPosition = Vector2.zero;
		dynamicRoot.sizeDelta = Vector2.zero;
		dynamicRoot.localRotation = dynamicBaseRotation;
		dynamicRoot.localScale = dynamicBaseScale;
		dynamicScaleLocked = false;
		lockedDynamicScale = 1f;

		dynamicLeftSlotRoot = CreateDynamicSlot("Slot_Left");
		dynamicMidSlotRoot = CreateDynamicSlot("Slot_Mid");
		dynamicRightSlotRoot = CreateDynamicSlot("Slot_Right");

		dynamicLayoutReady = true;
		CacheDragBases();
	}

	private float GetCanvasScaleFactor()
	{
		Canvas canvas = GetComponentInParent<Canvas>();
		if (canvas != null)
		{
			return Mathf.Max(0.0001f, canvas.scaleFactor);
		}
		return 1f;
	}

	private Vector2 SnapToPixels(Vector2 value)
	{
		if (!dynamicSnapToPixels)
		{
			return value;
		}

		float scale = GetCanvasScaleFactor();
		return new Vector2(
			Mathf.Round(value.x * scale) / scale,
			Mathf.Round(value.y * scale) / scale
		);
	}

	private float SnapScaleStep(float value)
	{
		if (dynamicScaleSnapStep <= 0f)
		{
			return value;
		}

		float step = Mathf.Max(0.001f, dynamicScaleSnapStep);
		return Mathf.Round(value / step) * step;
	}

	private CanvasGroup GetSlotCanvasGroup(int slotIndex)
	{
		if (slotIndex < 0 || slotIndex > 2)
		{
			return null;
		}

		if (dynamicSlotCanvasGroups[slotIndex] != null)
		{
			return dynamicSlotCanvasGroups[slotIndex];
		}

		RectTransform root = GetDragRoot(slotIndex);
		if (root == null)
		{
			return null;
		}

		CanvasGroup group = root.GetComponent<CanvasGroup>();
		if (group == null)
		{
			group = root.gameObject.AddComponent<CanvasGroup>();
		}

		dynamicSlotCanvasGroups[slotIndex] = group;
		return group;
	}

	private void SetSlotAlpha(int slotIndex, float alpha, bool immediate)
	{
		CanvasGroup group = GetSlotCanvasGroup(slotIndex);
		if (group == null)
		{
			return;
		}

		group.DOKill();
		if (immediate)
		{
			group.alpha = alpha;
			return;
		}

		group.DOFade(alpha, slotDimSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
	}

	private void PlayOperatorPop(RectTransform rt, Graphic graphic)
	{
		if (!popOperatorsOnSpawn || rt == null)
		{
			return;
		}

		rt.DOKill();
		Vector3 baseScale = rt.localScale;
		float start = Mathf.Clamp(operatorPopStartScale, 0.6f, 1f);
		rt.localScale = baseScale * start;
		rt.DOScale(baseScale, operatorPopSeconds).SetEase(Ease.OutBack).SetUpdate(true);

		if (graphic != null)
		{
			graphic.DOKill();
			Color c = graphic.color;
			float targetAlpha = 1f;
			c.a = 0f;
			graphic.color = c;
			graphic.DOFade(targetAlpha, operatorPopSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
		}
	}

	private void PlayBarShimmer()
	{
		if (!shimmerOnEquationUpdate || barTranslucent == null)
		{
			return;
		}

		barTranslucent.DOKill();
		Color baseColor = barTranslucent.color;
		Color bright = Color.Lerp(baseColor, Color.white, Mathf.Clamp01(shimmerIntensity));
		Sequence seq = DOTween.Sequence().SetUpdate(true);
		seq.Append(DOTween.To(() => barTranslucent.color, c => barTranslucent.color = c, bright, shimmerSeconds * 0.5f).SetEase(Ease.OutQuad));
		seq.Append(DOTween.To(() => barTranslucent.color, c => barTranslucent.color = c, baseColor, shimmerSeconds * 0.5f).SetEase(Ease.InQuad));
	}

	private void EnsureGhostPreview()
	{
		if (!ghostPreviewEnabled || ghostPreviewRect != null)
		{
			return;
		}

		if (dynamicRoot == null)
		{
			return;
		}

		GameObject obj = new GameObject("GhostPreview", typeof(RectTransform), typeof(Image));
		obj.transform.SetParent(dynamicRoot, false);
		ghostPreviewRect = obj.GetComponent<RectTransform>();
		ghostPreviewRect.anchorMin = new Vector2(0.5f, 0.5f);
		ghostPreviewRect.anchorMax = new Vector2(0.5f, 0.5f);
		ghostPreviewRect.pivot = new Vector2(0.5f, 0.5f);
		ghostPreviewRect.sizeDelta = new Vector2(ghostPreviewSize, ghostPreviewSize);
		ghostPreviewRect.anchoredPosition = Vector2.zero;

		ghostPreviewImage = obj.GetComponent<Image>();
		ghostPreviewImage.sprite = ghostPreviewSprite != null ? ghostPreviewSprite : GetFallbackWhiteSprite();
		ghostPreviewImage.color = ghostPreviewColor;
		ghostPreviewImage.raycastTarget = false;
		ghostPreviewRect.SetAsFirstSibling();
	}

	private CanvasGroup GetEquationIntroGroup(RectTransform root)
	{
		if (root == null)
		{
			return null;
		}

		if (equationIntroGroup != null && equationIntroGroup.transform == root)
		{
			return equationIntroGroup;
		}

		CanvasGroup group = root.GetComponent<CanvasGroup>();
		if (group == null)
		{
			group = root.gameObject.AddComponent<CanvasGroup>();
		}

		equationIntroGroup = group;
		return group;
	}

	private void PlayEquationIntroPulse()
	{
		if (!equationIntroPulse)
		{
			return;
		}

		RectTransform root = dynamicRoot != null ? dynamicRoot : transform as RectTransform;
		if (root == null)
		{
			return;
		}

		equationIntroTween?.Kill();
		root.DOKill();

		Vector3 baseScale = root.localScale;
		root.localScale = baseScale * Mathf.Max(1f, equationIntroScale);
		root.DOScale(baseScale, equationIntroSeconds).SetEase(Ease.OutBack).SetUpdate(true);

		CanvasGroup group = GetEquationIntroGroup(root);
		if (group != null)
		{
			group.DOKill();
			group.alpha = 0f;
			equationIntroTween = group.DOFade(1f, equationIntroFadeSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
		}
	}

	private void PlayGhostPreview()
	{
		if (!ghostPreviewEnabled)
		{
			return;
		}

		EnsureGhostPreview();
		if (ghostPreviewRect == null || ghostPreviewImage == null)
		{
			return;
		}

		Vector2 start = Vector2.zero;
		Vector2 end = Vector2.zero;
		if (dynamicLeftSlotRoot != null) start = dynamicLeftSlotRoot.anchoredPosition;
		if (dynamicRightSlotRoot != null) end = dynamicRightSlotRoot.anchoredPosition;

		ghostPreviewRect.anchoredPosition = start;
		ghostPreviewRect.localScale = Vector3.one;

		ghostPreviewTween?.Kill();
		ghostPreviewImage.DOKill();

		Color c = ghostPreviewColor;
		c.a = 0f;
		ghostPreviewImage.color = c;

		Sequence seq = DOTween.Sequence().SetUpdate(true);
		seq.Append(ghostPreviewImage.DOFade(ghostPreviewColor.a, ghostPreviewDuration * 0.25f).SetEase(Ease.OutQuad));
		seq.Join(ghostPreviewRect.DOAnchorPos(end, ghostPreviewDuration).SetEase(ghostPreviewEase));
		seq.Append(ghostPreviewImage.DOFade(0f, ghostPreviewDuration * 0.2f).SetEase(Ease.InQuad));
		ghostPreviewTween = seq;
	}

	private RectTransform CreateDynamicSlot(string name)
	{
			GameObject slotObj = new GameObject(name, typeof(RectTransform));
			slotObj.transform.SetParent(dynamicRoot, false);
			RectTransform rt = slotObj.GetComponent<RectTransform>();
			rt.anchorMin = new Vector2(0.5f, 0.5f);
			rt.anchorMax = new Vector2(0.5f, 0.5f);
			rt.pivot = new Vector2(0f, 0.5f); // left edge pivot for simple sequential placement
			rt.anchoredPosition = Vector2.zero;
			rt.sizeDelta = Vector2.zero;
			return rt;
		}

		private void ClearDynamicSpawned()
		{
			for (int i = 0; i < dynamicSpawned.Count; i++)
			{
				GameObject obj = dynamicSpawned[i];
				if (obj == null) continue;
				obj.transform.DOKill();
				Graphic g = obj.GetComponent<Graphic>();
				if (g != null) g.DOKill();
				Destroy(obj);
			}
			dynamicSpawned.Clear();
			dynamicEqualsLabel = null;

			for (int s = 0; s < dynamicSlotBubbleGraphics.Length; s++)
			{
				dynamicSlotBubbleGraphics[s].Clear();
				dynamicSlotBubbleTexts[s].Clear();
			}
		}

	private List<EqToken> TokenizeDynamic(string equation)
	{
		List<EqToken> tokens = new List<EqToken>(24);
		if (string.IsNullOrWhiteSpace(equation))
		{
			return tokens;
			}

			for (int i = 0; i < equation.Length; i++)
			{
				char c = equation[i];
				if (char.IsWhiteSpace(c))
				{
					continue;
				}

				if (char.IsDigit(c))
				{
					int start = i;
					while (i < equation.Length && char.IsDigit(equation[i]))
					{
						i++;
					}
					string num = equation.Substring(start, i - start);
					tokens.Add(new EqToken { kind = EqTokenKind.Number, text = num });
					i--;
					continue;
				}

				if (c == 'x' || c == 'X')
				{
					tokens.Add(new EqToken { kind = EqTokenKind.Variable, text = "X" });
					continue;
				}

				if (c == '=')
				{
					tokens.Add(new EqToken { kind = EqTokenKind.Equals, text = "=" });
					continue;
				}

			if (c == '+' || c == '-')
			{
				tokens.Add(new EqToken { kind = EqTokenKind.Operator, text = c.ToString() });
				continue;
			}

			if (c == '*' || c == '/')
			{
				string op = c == '*' ? "×" : "÷";
				tokens.Add(new EqToken { kind = EqTokenKind.Operator, text = op });
				continue;
			}
		}

		if (showImplicitMultiply && tokens.Count > 1)
		{
			List<EqToken> expanded = new List<EqToken>(tokens.Count + 4);
			for (int i = 0; i < tokens.Count; i++)
			{
				EqToken current = tokens[i];
				expanded.Add(current);

				if (i >= tokens.Count - 1)
				{
					continue;
				}

				EqToken next = tokens[i + 1];
				bool leftMul = current.kind == EqTokenKind.Number || current.kind == EqTokenKind.Variable;
				bool rightMul = next.kind == EqTokenKind.Number || next.kind == EqTokenKind.Variable;
				if (leftMul && rightMul)
				{
					string glyph = showImplicitMultiplyAsDot ? "·" : "×";
					expanded.Add(new EqToken { kind = EqTokenKind.Operator, text = glyph });
				}
			}

			return expanded;
		}

		return tokens;
	}

		private static void AppendNumberAsDigitBubbles(List<Atom> atoms, string numberText)
		{
			if (atoms == null)
			{
				return;
			}

			string s = numberText ?? string.Empty;
			for (int i = 0; i < s.Length; i++)
			{
				if (!char.IsDigit(s[i])) continue;
				atoms.Add(new Atom { isBubble = true, isVariable = false, text = s[i].ToString() });
			}
		}

		private void BuildDynamicEquation(string equation)
		{
			EnsureDynamicLayout();
			ClearDynamicSpawned();

			List<EqToken> tokens = TokenizeDynamic(equation);
			int eqIndex = -1;
			for (int i = 0; i < tokens.Count; i++)
			{
				if (tokens[i].kind == EqTokenKind.Equals)
				{
					eqIndex = i;
					break;
				}
			}

			List<EqToken> left = eqIndex >= 0 ? tokens.GetRange(0, eqIndex) : tokens;
			List<EqToken> right = eqIndex >= 0 && eqIndex + 1 < tokens.Count ? tokens.GetRange(eqIndex + 1, tokens.Count - (eqIndex + 1)) : new List<EqToken>(0);

			// Callers may provide canonicalized strings like "+X + 6 = 11". The gameplay equation hides the
			// leading unary plus, so strip it here or the locked bar renders "+X" instead of "X +".
			if (left.Count > 0 && left[0].kind == EqTokenKind.Operator && left[0].text == "+")
			{
				left.RemoveAt(0);
			}
			if (right.Count > 0 && right[0].kind == EqTokenKind.Operator && right[0].text == "+")
			{
				right.RemoveAt(0);
			}

			// Split left into: [coefficient term bubble group] + [rest of left side].
			HashSet<int> consumedLeft = new HashSet<int>();
			List<Atom> leftSlot = new List<Atom>(8);
			List<Atom> midSlot = new List<Atom>(16);
			List<Atom> rightSlot = new List<Atom>(16);

			int leftVarIdx = -1;
			for (int i = 0; i < left.Count; i++)
			{
				if (left[i].kind == EqTokenKind.Variable)
				{
					leftVarIdx = i;
					break;
				}
			}

			if (leftVarIdx >= 0 && leftVarIdx > 0 && left[leftVarIdx - 1].kind == EqTokenKind.Number)
			{
				int coefIdx = leftVarIdx - 1;
				int signIdx = (coefIdx - 1 == 0 && left[0].kind == EqTokenKind.Operator && left[0].text == "-") ? 0 : -1;

				if (signIdx == 0)
				{
					leftSlot.Add(new Atom { isBubble = false, text = "-" });
					consumedLeft.Add(0);
				}

				AppendNumberAsDigitBubbles(leftSlot, left[coefIdx].text);
				leftSlot.Add(new Atom { isBubble = true, isVariable = true, text = "X" });

				consumedLeft.Add(coefIdx);
				consumedLeft.Add(leftVarIdx);
			}

			for (int i = 0; i < left.Count; i++)
			{
				if (consumedLeft.Contains(i)) continue;

				EqToken t = left[i];
				if (t.kind == EqTokenKind.Number)
				{
					AppendNumberAsDigitBubbles(midSlot, t.text);
				}
				else if (t.kind == EqTokenKind.Variable)
				{
					midSlot.Add(new Atom { isBubble = true, isVariable = true, text = "X" });
				}
				else if (t.kind == EqTokenKind.Operator)
				{
					midSlot.Add(new Atom { isBubble = false, text = t.text });
				}
			}

			for (int i = 0; i < right.Count; i++)
			{
				EqToken t = right[i];
				if (t.kind == EqTokenKind.Number)
				{
					AppendNumberAsDigitBubbles(rightSlot, t.text);
				}
				else if (t.kind == EqTokenKind.Variable)
				{
					rightSlot.Add(new Atom { isBubble = true, isVariable = true, text = "X" });
				}
				else if (t.kind == EqTokenKind.Operator)
				{
					rightSlot.Add(new Atom { isBubble = false, text = t.text });
				}
			}

		DynamicReferenceMetrics metrics = ResolveDynamicReferenceMetrics();
		float bubbleDiameter = Mathf.Max(1f, metrics.bubbleDiameter);
		float spacing = Mathf.Max(0f, metrics.itemSpacing);
		float opWidth = Mathf.Max(1f, metrics.operatorWidth);
		float eqWidth = Mathf.Max(opWidth, bubbleDiameter * 0.72f);
		float opHeight = Mathf.Max(1f, metrics.operatorHeight);

		float slotSpacing = spacing * Mathf.Clamp(dynamicSlotSpacingRatio, 0.2f, 1f);
		slotSpacing = Mathf.Max(slotSpacing, opWidth * 0.2f);

			float leftW = BuildDynamicSlotContent(dynamicLeftSlotRoot, leftSlot, bubbleDiameter, spacing, opWidth, slotIndex: 0);
			float midW = BuildDynamicSlotContent(dynamicMidSlotRoot, midSlot, bubbleDiameter, spacing, opWidth, slotIndex: 1);
			float rightW = BuildDynamicSlotContent(dynamicRightSlotRoot, rightSlot, bubbleDiameter, spacing, opWidth, slotIndex: 2);

		if (dynamicEqualsLabel == null)
		{
			dynamicEqualsLabel = CreateDynamicOperatorLabel("Equals", equalsText, preserveTemplateStyle: true);
		}

		if (dynamicEqualsLabel != null)
		{
			if (!dynamicEqualsLabel.gameObject.activeSelf)
			{
				dynamicEqualsLabel.gameObject.SetActive(true);
			}

			RectTransform rt = dynamicEqualsLabel.rectTransform;
			rt.anchorMin = new Vector2(0.5f, 0.5f);
			rt.anchorMax = new Vector2(0.5f, 0.5f);
			rt.pivot = new Vector2(0.5f, 0.5f);
			rt.sizeDelta = new Vector2(eqWidth, opHeight);
			dynamicEqualsLabel.text = "=";
			dynamicEqualsLabel.raycastTarget = false;
			dynamicEqualsLabel.textWrappingMode = TextWrappingModes.NoWrap;
			dynamicEqualsLabel.overflowMode = TextOverflowModes.Overflow;
			dynamicEqualsLabel.alignment = TextAlignmentOptions.CenterGeoAligned;
			ApplyDynamicEqualsTextSizing(dynamicEqualsLabel, bubbleDiameter);
			EnsureOperatorVisible(dynamicEqualsLabel, preserveTemplateStyle: true);
			PlayOperatorPop(rt, dynamicEqualsLabel);
		}

			// Lay out the three slot roots + equals in one centered row.
		float totalWidth = leftW;
		if (midW > 0f) totalWidth += (totalWidth > 0f ? slotSpacing : 0f) + midW;
		totalWidth += (totalWidth > 0f ? slotSpacing : 0f) + eqWidth;
		if (rightW > 0f) totalWidth += slotSpacing + rightW;

			float reservedRight = 0f;
			if (dynamicReserveLockBadgeSpace && lockBadgeTranslucent != null)
			{
				RectTransform lockRt = lockBadgeTranslucent.transform as RectTransform;
				if (lockRt != null)
				{
					reservedRight = Mathf.Max(0f, lockRt.rect.width * Mathf.Abs(lockRt.localScale.x) + dynamicLockBadgePadding);
				}
			}
			if (dynamicResizeBarToContent)
			{
				// The Figma lock pill overlaps the bar edge; don't reserve inner layout width for it.
				reservedRight = 0f;
			}

		ApplyDynamicBarGeometry(totalWidth, bubbleDiameter);

		float contentCenterX = dynamicCenterIgnoreLockBadge ? 0f : -reservedRight * 0.5f;
		float startX = -(totalWidth * 0.5f);
		float x = startX;
		bool hasPlacedLeftContent = false;

		if (dynamicLeftSlotRoot != null)
		{
			dynamicLeftSlotRoot.anchoredPosition = SnapToPixels(new Vector2(x, 0f));
			if (leftW > 0f)
			{
				x += leftW;
				hasPlacedLeftContent = true;
			}
		}

		if (midW > 0f)
		{
			if (hasPlacedLeftContent)
			{
				x += slotSpacing;
			}
			dynamicMidSlotRoot.anchoredPosition = SnapToPixels(new Vector2(x, 0f));
			x += midW;
			hasPlacedLeftContent = true;
		}
		else
		{
			dynamicMidSlotRoot.anchoredPosition = SnapToPixels(new Vector2(x, 0f));
		}

		if (hasPlacedLeftContent)
		{
			x += slotSpacing;
		}
		if (dynamicEqualsLabel != null)
		{
			dynamicEqualsLabel.rectTransform.anchoredPosition = SnapToPixels(new Vector2(x + (eqWidth * 0.5f), dynamicOperatorCenterY));
			dynamicEqualsLabel.transform.SetAsLastSibling();
		}
		x += eqWidth;

		if (rightW > 0f)
		{
			x += slotSpacing;
			if (dynamicRightSlotRoot != null)
			{
				dynamicRightSlotRoot.anchoredPosition = SnapToPixels(new Vector2(x, 0f));
			}
		}
		else if (dynamicRightSlotRoot != null)
		{
			dynamicRightSlotRoot.anchoredPosition = SnapToPixels(new Vector2(x, 0f));
		}

			// Scale down to fit inside the bar, if needed.
			float availableWidth = 0f;
			RectTransform barRt = barTranslucent != null ? (barTranslucent.transform as RectTransform) : null;
			RectTransform selfRt = transform as RectTransform;
			if (barRt != null) availableWidth = barRt.rect.width;
			else if (selfRt != null) availableWidth = selfRt.rect.width;

			availableWidth = Mathf.Max(0f, availableWidth - (dynamicHorizontalPadding * 2f) - reservedRight);
		float fitScale = (availableWidth > 0f && totalWidth > 0f) ? Mathf.Min(1f, availableWidth / totalWidth) : 1f;
		float scale = Mathf.Lerp(1f, fitScale, Mathf.Clamp01(dynamicFitScaleInfluence));
		scale *= Mathf.Max(0.01f, dynamicContentScaleMultiplier);
		scale = Mathf.Clamp(scale, Mathf.Max(0.01f, dynamicMinContentScale), Mathf.Max(dynamicMinContentScale, dynamicMaxContentScale));
		scale = SnapScaleStep(scale);
		if (lockDynamicScaleAfterFirstLayout)
		{
			if (!dynamicScaleLocked)
			{
				lockedDynamicScale = Mathf.Max(0.01f, scale);
				dynamicScaleLocked = true;
			}
			scale = lockedDynamicScale;
		}
		dynamicRoot.localScale = dynamicBaseScale * scale;
		dynamicRoot.localRotation = dynamicBaseRotation;
		dynamicRoot.anchoredPosition = SnapToPixels(new Vector2(contentCenterX, 0f));

			// Refresh drag bases so the hover/parallax animation stays aligned.
			CacheDragBases();
		}

	private void ApplyDynamicBarGeometry(float contentWidth, float bubbleDiameter)
	{
		if (!dynamicResizeBarToContent)
		{
			return;
		}

		RectTransform rootRt = transform as RectTransform;
		RectTransform barRt = barTranslucent != null ? barTranslucent.rectTransform : null;
		RectTransform outlineRt = outlineRectangle != null ? outlineRectangle.GetComponent<RectTransform>() : null;
		RectTransform lockRt = lockBadgeTranslucent != null ? lockBadgeTranslucent.rectTransform : null;
		RectTransform growerRt = progressGrower != null ? progressGrower.rectTransform : null;
		if (barRt == null)
		{
			return;
		}

		float padding = Mathf.Max(0f, dynamicHorizontalPadding) * 2f;
		float targetWidth;
		float targetHeight;
		if (dynamicUseManualBarSize)
		{
			targetWidth = Mathf.Max(1f, dynamicManualBarSize.x);
			targetHeight = Mathf.Max(1f, dynamicManualBarSize.y);
		}
		else
		{
			targetWidth = Mathf.Max(1f, Mathf.Max(dynamicBarMinWidth, contentWidth + padding));
			if (dynamicBarMaxWidth > 0.01f)
			{
				targetWidth = Mathf.Min(targetWidth, Mathf.Max(dynamicBarMinWidth, dynamicBarMaxWidth));
			}

			targetHeight = Mathf.Max(1f, bubbleDiameter * Mathf.Clamp(dynamicBarHeightBubbleRatio, 0.9f, 2f));
		}
		float targetCorner = Mathf.Max(1f, bubbleDiameter * Mathf.Clamp(dynamicBarCornerRadiusBubbleRatio, 0.12f, 0.45f));
		progressBarCornerRadius = targetCorner;

		if (rootRt != null)
		{
			rootRt.sizeDelta = new Vector2(targetWidth, targetHeight);
		}

		barRt.sizeDelta = new Vector2(targetWidth, targetHeight);
		if (outlineRt != null)
		{
			outlineRt.sizeDelta = new Vector2(targetWidth, targetHeight);
		}

		if (outlineRectangle != null)
		{
			float outlineThickness = useFixedOutlineThickness
				? Mathf.Max(0.1f, fixedOutlineThickness)
				: Mathf.Clamp(
					targetHeight * Mathf.Max(0f, dynamicOutlineThicknessHeightRatio),
					Mathf.Max(0.1f, dynamicOutlineMinThickness),
					Mathf.Max(Mathf.Max(0.1f, dynamicOutlineMinThickness), dynamicOutlineMaxThickness));

			outlineRectangle.Width = targetWidth;
			outlineRectangle.Height = targetHeight;
			outlineRectangle.CornerRadii = new Vector4(targetCorner, targetCorner, targetCorner, targetCorner);
			outlineRectangle.Thickness = outlineThickness;
			outlineBaseThickness = Mathf.Max(0.001f, outlineRectangle.Thickness);
		}

		ApplyRoundedRectToTranslucent(barTranslucent, targetCorner);
		if (barTranslucent != null)
		{
			Color barColor = barTranslucent.color;
			barColor.r = 0f;
			barColor.g = 0f;
			barColor.b = 0f;
			barColor.a = Mathf.Max(0.48f, barColor.a);
			barTranslucent.color = barColor;
			barBaseColor = barColor;
		}

		float retainedProgress = 0f;
		EnsureProgressGrowerRuntimeSetup();
		if (progressGrowerGeometryCached)
		{
			retainedProgress = GetCurrentProgressGrower01();
		}

		if (growerRt != null)
		{
			progressGrowerRect = growerRt;
			InsetProgressGrowerToInterior(targetWidth, targetHeight);
			ApplyRoundedRectToTranslucent(progressGrower, targetCorner);

			// Re-cache the grower geometry after changing the authored width so progress fill stays correct.
			progressGrowerBaseAnchoredPos = growerRt.anchoredPosition;
			progressGrowerBaseSizeDelta = growerRt.sizeDelta;
			progressGrowerBasePivot = growerRt.pivot;
			progressGrowerBaseScale = growerRt.localScale;
			progressGrowerGeometryCached = progressGrowerBaseSizeDelta.x > 0.001f;
			progressGrowerLastCapsuleRadius = -1f;
			TryConfigureProgressGrowerCapsule();
			ApplyProgressGrower01Immediate(retainedProgress);
		}

		if (lockRt != null)
		{
			float badgeSize = Mathf.Max(24f, bubbleDiameter * Mathf.Clamp(dynamicLockBadgeSizeBubbleRatio, 0.4f, 1.6f));
			lockRt.sizeDelta = new Vector2(badgeSize, badgeSize);
			float halfW = targetWidth * 0.5f;
			float halfH = targetHeight * 0.5f;
			float x = halfW - (badgeSize * Mathf.Clamp(dynamicLockBadgeInsetRatio, 0f, 0.8f));
			float y = halfH - (badgeSize * Mathf.Clamp(dynamicLockBadgeTopInsetRatio, 0f, 0.8f));
			lockRt.anchoredPosition = SnapToPixels(new Vector2(x, y));
			ApplyRoundedRectToTranslucent(lockBadgeTranslucent, badgeSize * 0.5f);
		}
	}

	private static void ApplyRoundedRectToTranslucent(TranslucentImage image, float radius)
	{
		if (image == null)
		{
			return;
		}

		ParaformConfig cfg = image.paraformConfig;
		Vector4 target = new Vector4(radius, radius, radius, radius);
		if (cfg.CornerRadii == target)
		{
			return;
		}

		cfg.CornerRadii = target;
		image.paraformConfig = cfg;
		image.SetVerticesDirty();
	}

		private float BuildDynamicSlotContent(RectTransform slotRoot, List<Atom> atoms, float bubbleDiameter, float spacing, float operatorWidth, int slotIndex)
		{
			if (slotRoot == null || atoms == null || atoms.Count == 0)
			{
				return 0f;
			}

		RectTransform bubbleTemplateRoot = ResolveBubbleRoot(leftBubbleText) ?? ResolveBubbleRoot(midBubbleText) ?? ResolveBubbleRoot(rightBubbleText);
		GameObject bubbleTemplate = bubbleTemplateRoot != null ? bubbleTemplateRoot.gameObject : null;
		GameObject operatorTemplate = addOperatorText != null
			? addOperatorText.gameObject
			: (equalsText != null ? equalsText.gameObject : null);
			float bubbleY = 0f;
			float opY = 0f;
			float opHeight = Mathf.Max(1f, dynamicOperatorHeight > 0f ? dynamicOperatorHeight : bubbleDiameter * 0.5f);

			int clampedSlot = Mathf.Clamp(slotIndex, 0, 2);
		float width = 0f;
		for (int i = 0; i < atoms.Count; i++)
		{
			Atom a = atoms[i];
			float w = a.isBubble ? bubbleDiameter : operatorWidth;

				if (a.isBubble && bubbleTemplate != null)
				{
					GameObject obj = Instantiate(bubbleTemplate, slotRoot);
					obj.name = $"Bubble_{clampedSlot}_{a.text}_{i}";
					obj.SetActive(true);
					dynamicSpawned.Add(obj);

					TextMeshProUGUI tmp = obj.GetComponentInChildren<TextMeshProUGUI>(true);
					NormalizeSpawnedBubbleTemplate(obj, tmp, bubbleDiameter);

					RectTransform rt = obj.GetComponent<RectTransform>();
					rt.anchorMin = new Vector2(0f, 0.5f);
					rt.anchorMax = new Vector2(0f, 0.5f);
					rt.pivot = new Vector2(0.5f, 0.5f);
					rt.anchoredPosition = SnapToPixels(new Vector2(width + (bubbleDiameter * 0.5f), bubbleY));

					if (tmp != null)
					{
						tmp.text = a.text ?? string.Empty;
						tmp.raycastTarget = false;
						tmp.textWrappingMode = TextWrappingModes.NoWrap;
						ApplyDynamicBubbleTextSizing(tmp, bubbleDiameter);
						if (a.isVariable) tmp.color = dynamicVariableTextColor;
					}

					Graphic bubbleGraphic = obj.GetComponent<Graphic>();
					if (bubbleGraphic == null && tmp != null)
					{
						bubbleGraphic = ResolveBubbleGraphic(tmp);
					}
					if (bubbleGraphic != null)
					{
						TryAssignTranslucentSource(bubbleGraphic);
						SetBubbleFilled(bubbleGraphic, filled: false, immediate: true);
						dynamicSlotBubbleGraphics[clampedSlot].Add(bubbleGraphic);
					}
					if (tmp != null)
					{
						dynamicSlotBubbleTexts[clampedSlot].Add(tmp);
					}
				}
				else if (!a.isBubble)
				{
					GameObject obj;
					TextMeshProUGUI tmp;

					if (operatorTemplate != null)
					{
						obj = Instantiate(operatorTemplate, slotRoot);
						tmp = obj.GetComponent<TextMeshProUGUI>();
					}
					else
					{
						obj = new GameObject("OpFallback", typeof(RectTransform));
						obj.transform.SetParent(slotRoot, false);
						tmp = obj.AddComponent<TextMeshProUGUI>();
						TextMeshProUGUI style = addOperatorText ?? equalsText ?? leftBubbleText ?? midBubbleText ?? rightBubbleText;
						if (style != null)
						{
							tmp.font = style.font;
							tmp.fontSize = style.fontSize;
							tmp.color = style.color;
						}
					}

					obj.name = $"Op_{clampedSlot}_{a.text}_{i}";
					obj.SetActive(true);
					dynamicSpawned.Add(obj);

					RectTransform rt = obj.GetComponent<RectTransform>();
					rt.anchorMin = new Vector2(0f, 0.5f);
					rt.anchorMax = new Vector2(0f, 0.5f);
					rt.pivot = new Vector2(0.5f, 0.5f);
					rt.localScale = Vector3.one;
					rt.anchoredPosition = SnapToPixels(new Vector2(width + (operatorWidth * 0.5f), opY));
					rt.sizeDelta = new Vector2(operatorWidth, opHeight);

						if (tmp != null)
						{
							tmp.text = a.text ?? string.Empty;
							tmp.raycastTarget = false;
							tmp.textWrappingMode = TextWrappingModes.NoWrap;
							tmp.alignment = TextAlignmentOptions.Center;
							ApplyDynamicOperatorTextSizing(tmp, bubbleDiameter);
							EnsureOperatorVisible(tmp);
						}

					PlayOperatorPop(rt, tmp);
				}

			width += w;
			if (i < atoms.Count - 1)
			{
				Atom next = atoms[i + 1];
				float gap = spacing;
				if (IsDigitAtom(a) && IsDigitAtom(next))
				{
					gap = bubbleDiameter * Mathf.Clamp(dynamicDigitSpacingRatio, 0.02f, 0.3f);
				}
				else if (IsDigitAtom(a) && IsVariableAtom(next))
				{
					gap = bubbleDiameter * Mathf.Clamp(dynamicImplicitMultiplySpacingRatio, 0.02f, 0.3f);
				}
				width += gap;
			}
		}

			return width;
		}

	private void CacheBaseColors()
	{
		if (outlineRectangle != null)
		{
			outlineBaseColor = outlineRectangle.Color;
			outlineBaseThickness = Mathf.Max(0.001f, outlineRectangle.Thickness);
		}

		if (barTranslucent != null)
		{
			barBaseColor = barTranslucent.color;
		}

		if (lockBadgeTranslucent != null)
		{
			lockBaseColor = lockBadgeTranslucent.color;
		}

		if (progressGrower != null)
		{
			EnsureProgressGrowerRuntimeSetup();
			growerBaseColor = progressGrower.color;
		}

		if (leftBubbleText != null) leftBaseFontSize = leftBubbleText.fontSize;
		if (midBubbleText != null) midBaseFontSize = midBubbleText.fontSize;
		if (rightBubbleText != null) rightBaseFontSize = rightBubbleText.fontSize;

		CacheDragBases();
	}

	private void CacheDragBases()
	{
		if (useDynamicEquationBubbles && dynamicLayoutReady)
		{
			leftBubbleRoot = dynamicLeftSlotRoot;
			midBubbleRoot = dynamicMidSlotRoot;
			rightBubbleRoot = dynamicRightSlotRoot;
		}
		else
		{
			leftBubbleRoot = ResolveBubbleRoot(leftBubbleText);
			midBubbleRoot = ResolveBubbleRoot(midBubbleText);
			rightBubbleRoot = ResolveBubbleRoot(rightBubbleText);
		}

		if (leftBubbleRoot != null)
		{
			leftBasePos = leftBubbleRoot.anchoredPosition;
			leftBaseScale = leftBubbleRoot.localScale;
		}

		if (midBubbleRoot != null)
		{
			midBasePos = midBubbleRoot.anchoredPosition;
			midBaseScale = midBubbleRoot.localScale;
		}

		if (rightBubbleRoot != null)
		{
			rightBasePos = rightBubbleRoot.anchoredPosition;
			rightBaseScale = rightBubbleRoot.localScale;
		}

		dragBasesCached = true;
	}

	private static RectTransform ResolveBubbleRoot(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return null;
		}

		Transform t = tmp.transform;
		for (int i = 0; i < 6 && t != null; i++)
		{
			Transform parent = t.parent;
			if (parent == null)
			{
				break;
			}

			if (parent.GetComponent<TranslucentImage>() != null || parent.GetComponent<Image>() != null)
			{
				return parent as RectTransform;
			}

			t = parent;
		}

			return tmp.transform.parent as RectTransform;
		}

	private static Graphic ResolveBubbleGraphic(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return null;
		}

		Transform parent = tmp.transform.parent;
		if (parent == null)
		{
			return null;
		}

		return parent.GetComponent<Graphic>();
	}

	private static bool IsDigitAtom(Atom atom)
	{
		return atom.isBubble && !atom.isVariable && !string.IsNullOrEmpty(atom.text) && atom.text.Length == 1 && char.IsDigit(atom.text[0]);
	}

	private static bool IsVariableAtom(Atom atom)
	{
		return atom.isBubble && atom.isVariable;
	}

	private TextMeshProUGUI CreateDynamicOperatorLabel(string objectName, TextMeshProUGUI templateSource = null, bool preserveTemplateStyle = false)
	{
		GameObject obj;
		TextMeshProUGUI tmp;

		TextMeshProUGUI templateText = templateSource != null ? templateSource : addOperatorText;
		GameObject template = templateText != null ? templateText.gameObject : null;
		if (template != null)
		{
			obj = Instantiate(template, dynamicRoot);
			tmp = obj.GetComponent<TextMeshProUGUI>();
		}
		else
		{
			obj = new GameObject(objectName, typeof(RectTransform));
			obj.transform.SetParent(dynamicRoot, false);
			tmp = obj.AddComponent<TextMeshProUGUI>();
		}

		obj.name = objectName;
		obj.SetActive(true);
		dynamicSpawned.Add(obj);

		if (tmp != null)
		{
			tmp.raycastTarget = false;
			tmp.textWrappingMode = TextWrappingModes.NoWrap;
			tmp.overflowMode = TextOverflowModes.Overflow;
			tmp.alignment = TextAlignmentOptions.CenterGeoAligned;
			if (!preserveTemplateStyle)
			{
				ApplyOperatorFontStyle(tmp);
			}
			NormalizeOperatorTextLayout(tmp);
		}

		return tmp;
	}

	private TextMeshProUGUI GetOperatorStyleSource()
	{
		if (addOperatorText != null && addOperatorText.font != null) return addOperatorText;
		if (equalsText != null && equalsText.font != null) return equalsText;
		if (leftBubbleText != null && leftBubbleText.font != null) return leftBubbleText;
		if (midBubbleText != null && midBubbleText.font != null) return midBubbleText;
		if (rightBubbleText != null && rightBubbleText.font != null) return rightBubbleText;
		return null;
	}

	private void ApplyOperatorFontStyle(TextMeshProUGUI target)
	{
		if (target == null)
		{
			return;
		}

		TextMeshProUGUI styleSource = GetOperatorStyleSource();
		if (styleSource == null || styleSource == target)
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

		target.fontStyle = styleSource.fontStyle;
		target.fontWeight = styleSource.fontWeight;
	}

	private static void NormalizeOperatorTextLayout(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return;
		}

		// The prefab operator templates carry large negative TMP margins (likely from an old layout/font setup).
		// When we reuse those templates dynamically (or force a different font), the glyph looks off-center.
		tmp.margin = Vector4.zero;
		tmp.textWrappingMode = TextWrappingModes.NoWrap;
		tmp.overflowMode = TextOverflowModes.Overflow;
		tmp.alignment = TextAlignmentOptions.CenterGeoAligned;

	}

	private static bool FontLikelyMissingOperatorGlyph(TMP_FontAsset font, char glyph)
	{
		if (font == null)
		{
			return true;
		}

		return !font.HasCharacter(glyph);
	}

	private void NormalizeOperatorGlyphsForFont(TextMeshProUGUI tmp)
	{
		if (tmp == null || string.IsNullOrEmpty(tmp.text))
		{
			return;
		}

		string resolved = tmp.text;
		TMP_FontAsset font = tmp.font;

		if (resolved.IndexOf('\u00F7') >= 0 && FontLikelyMissingOperatorGlyph(font, '\u00F7'))
		{
			resolved = resolved.Replace("\u00F7", "/");
		}

		if (resolved.IndexOf('\u00D7') >= 0 && FontLikelyMissingOperatorGlyph(font, '\u00D7'))
		{
			resolved = resolved.Replace("\u00D7", "*");
		}

		if (!string.Equals(resolved, tmp.text, StringComparison.Ordinal))
		{
			tmp.text = resolved;
		}
	}

	private void EnsureOperatorVisible(TextMeshProUGUI tmp, bool preserveTemplateStyle = false)
	{
		if (tmp == null)
		{
			return;
		}

		if (!tmp.gameObject.activeSelf)
		{
			tmp.gameObject.SetActive(true);
		}

		tmp.enabled = true;
		if (!preserveTemplateStyle)
		{
			ApplyOperatorFontStyle(tmp);
		}
		NormalizeOperatorTextLayout(tmp);
		NormalizeOperatorGlyphsForFont(tmp);

		Color c = tmp.color;
		c.a = 1f;
		tmp.color = c;
	}

		private void SetDynamicSlotFocus(int slotIndex, bool immediate = false)
		{
			if (!useDynamicEquationBubbles || !dynamicLayoutReady)
			{
				return;
			}

			for (int s = 0; s < 3; s++)
			{
				bool fill = slotIndex == s;
				List<Graphic> graphics = dynamicSlotBubbleGraphics[s];
				for (int i = 0; i < graphics.Count; i++)
				{
					SetBubbleFilled(graphics[i], fill, immediate);
				}

				if (fill)
				{
					List<TextMeshProUGUI> texts = dynamicSlotBubbleTexts[s];
					for (int i = 0; i < texts.Count; i++)
					{
						TextMeshProUGUI tmp = texts[i];
						if (tmp != null)
						{
							// Keep focus feedback subtle: bubble fill/outline only (no bouncing text).
							SetText(tmp, tmp.text, animate: false);
						}
					}
				}

				if (dimInactiveSlotsOnDrag)
				{
					float targetAlpha = slotIndex < 0 ? 1f : (fill ? 1f : inactiveSlotAlpha);
					SetSlotAlpha(s, targetAlpha, immediate);
				}
				else
				{
					SetSlotAlpha(s, 1f, immediate);
				}
			}
		}

		public void BeginDragReaction(int slotIndex)
		{
			AutoBindIfNeeded();
		if (!dragBasesCached)
		{
			CacheDragBases();
		}

		int clamped = Mathf.Clamp(slotIndex, -1, 2);
		if (clamped == -1)
		{
			EndDragReaction();
			return;
		}

		if (dragFocusSlot == clamped)
		{
			return;
		}

		ResetDragSlot(dragFocusSlot, tween: true);
		dragFocusSlot = clamped;
		ResetDragSlot(dragFocusSlot, tween: false);

		RectTransform root = GetDragRoot(dragFocusSlot);
		if (root == null)
		{
			return;
		}

			Vector3 baseScale = GetDragBaseScale(dragFocusSlot);
			float safeFocusMul = GetSafeDragFocusScaleMultiplier(dragFocusSlot, dragFocusScale);
			root.DOKill();
			root.DOScale(baseScale * safeFocusMul, dragTweenSeconds).SetEase(Ease.OutCubic);

			SetDynamicSlotFocus(dragFocusSlot);
		}

	public void UpdateDragReaction(Vector2 equationSpaceDragDelta)
	{
		if (dragFocusSlot < 0)
		{
			return;
		}

		RectTransform root = GetDragRoot(dragFocusSlot);
		if (root == null)
		{
			return;
		}

		Vector2 offset = equationSpaceDragDelta * dragParallaxStrength;
		offset = Vector2.ClampMagnitude(offset, dragParallaxMax);
		root.anchoredPosition = GetDragBasePos(dragFocusSlot) + offset;
	}

		public void EndDragReaction()
		{
			if (!dragBasesCached)
			{
				CacheDragBases();
			}

			ResetDragSlot(0, tween: true);
			ResetDragSlot(1, tween: true);
			ResetDragSlot(2, tween: true);
			dragFocusSlot = -1;

			SetDynamicSlotFocus(-1);
		}

	private RectTransform GetDragRoot(int slot)
	{
		return slot switch
		{
			0 => leftBubbleRoot,
			1 => midBubbleRoot,
			2 => rightBubbleRoot,
			_ => null,
		};
	}

	private Vector2 GetDragBasePos(int slot)
	{
		return slot switch
		{
			0 => leftBasePos,
			1 => midBasePos,
			2 => rightBasePos,
			_ => Vector2.zero,
		};
	}

	private Vector3 GetDragBaseScale(int slot)
	{
		return slot switch
		{
			0 => leftBaseScale == Vector3.zero ? Vector3.one : leftBaseScale,
			1 => midBaseScale == Vector3.zero ? Vector3.one : midBaseScale,
			2 => rightBaseScale == Vector3.zero ? Vector3.one : rightBaseScale,
			_ => Vector3.one,
		};
	}

	private RectTransform GetReferenceEquationContainerRect()
	{
		if (barTranslucent != null)
		{
			return barTranslucent.rectTransform;
		}

		return transform as RectTransform;
	}

	private float GetSafeDragFocusScaleMultiplier(int slot, float requestedMultiplier)
	{
		float requested = Mathf.Max(1f, requestedMultiplier);

		RectTransform root = GetDragRoot(slot);
		RectTransform container = GetReferenceEquationContainerRect();
		if (root == null || container == null)
		{
			return requested;
		}

		Bounds bounds = RectTransformUtility.CalculateRelativeRectTransformBounds(container, root);
		if (bounds.size.sqrMagnitude <= 0.0001f)
		{
			return requested;
		}

		Rect rect = container.rect;
		Vector3 center = bounds.center;
		Vector3 extents = bounds.extents;

		// Reserve some room for parallax movement during drag so the focus pulse stays inside the bar.
		float reserve = Mathf.Max(0f, dragParallaxMax) + Mathf.Max(0f, dragFocusContainerPadding);
		float roomRight = rect.xMax - center.x - reserve;
		float roomLeft = center.x - rect.xMin - reserve;
		float roomTop = rect.yMax - center.y - reserve;
		float roomBottom = center.y - rect.yMin - reserve;

		float halfAvailX = Mathf.Max(0.001f, Mathf.Min(roomLeft, roomRight));
		float halfAvailY = Mathf.Max(0.001f, Mathf.Min(roomBottom, roomTop));

		float maxMul = requested;
		if (extents.x > 0.001f)
		{
			maxMul = Mathf.Min(maxMul, halfAvailX / extents.x);
		}

		if (extents.y > 0.001f)
		{
			maxMul = Mathf.Min(maxMul, halfAvailY / extents.y);
		}

		return Mathf.Clamp(maxMul, 1f, requested);
	}

	private void ResetDragSlot(int slot, bool tween)
	{
		RectTransform root = GetDragRoot(slot);
		if (root == null)
		{
			return;
		}

		root.DOKill();

		Vector2 basePos = GetDragBasePos(slot);
		Vector3 baseScale = GetDragBaseScale(slot);

		if (!tween)
		{
			root.anchoredPosition = basePos;
			root.localScale = baseScale;
			return;
		}

		root.DOAnchorPos(basePos, dragTweenSeconds).SetEase(Ease.OutQuad);
		root.DOScale(baseScale, dragTweenSeconds).SetEase(Ease.OutQuad);
	}

	public void SetProgress01(float t, bool solved = false, bool pulse = false)
	{
		AutoBindIfNeeded();
		EnsureGradientDefaults();
		EnsureProgressGrowerRuntimeSetup();
		RefreshProgressGrowerVisibility();

		float clamped = Mathf.Clamp01(t);
		if (solved)
		{
			clamped = 1f;
		}

		float curveT = (useProgressFillCurve && progressFillCurve != null) ? Mathf.Clamp01(progressFillCurve.Evaluate(clamped)) : clamped;
		float eased = Mathf.SmoothStep(0f, 1f, curveT);
		float currentGrower01 = GetCurrentProgressGrower01();
		float progressDelta = curveT - currentGrower01;
		Color growerTarget = useUnifiedProgressFillPalette
			? Color.Lerp(progressFillLockedColor, progressFillProgressColor, eased)
			: ((progressGradient != null && progressGradient.colorKeys != null && progressGradient.colorKeys.Length > 0)
				? progressGradient.Evaluate(eased)
				: Color.Lerp(lowProgressColor, highProgressColor, eased));
		Color outlineTarget = Color.Lerp(outlineLockedColor, outlineProgressColor, eased);

		if (outlineRectangle != null)
		{
			outlineRectangle.DOKill();

			Color c = outlineTarget;
			c.a = outlineBaseColor.a > 0 ? outlineBaseColor.a : c.a;

			if (tintTweenSeconds <= 0.001f)
			{
				outlineRectangle.Color = c;
			}
			else
			{
				DOTween.To(() => outlineRectangle.Color, v => outlineRectangle.Color = v, c, tintTweenSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetTarget(outlineRectangle)
					.SetLink(outlineRectangle.gameObject, LinkBehaviour.KillOnDestroy);
			}

			if (outlineBaseThickness <= 0.001f)
			{
				outlineBaseThickness = Mathf.Max(0.001f, outlineRectangle.Thickness);
			}

			float thicknessTarget = outlineBaseThickness * (1f + (Mathf.Clamp01(eased) * Mathf.Max(0f, outlineThicknessProgressBoost)));
			if (tintTweenSeconds <= 0.001f)
			{
				outlineRectangle.Thickness = thicknessTarget;
			}
			else
			{
				DOTween.To(() => outlineRectangle.Thickness, v => outlineRectangle.Thickness = v, thicknessTarget, tintTweenSeconds)
					.SetEase(Ease.OutQuad)
					.SetUpdate(true)
					.SetTarget(outlineRectangle)
					.SetLink(outlineRectangle.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}

		if (lockBadgeTranslucent != null)
		{
			lockBadgeTranslucent.DOKill();

			if (solved && unlockedBadgeSprite != null)
			{
				lockBadgeTranslucent.sprite = unlockedBadgeSprite;
			}
			else if (!solved && lockedBadgeSprite != null)
			{
				lockBadgeTranslucent.sprite = lockedBadgeSprite;
			}
		}

		if (progressGrower != null)
		{
			progressGrower.DOKill();
			if (progressGrowerRect != null)
			{
				progressGrowerRect.DOKill();

				float from = currentGrower01;
				DOTween.To(() => from, v =>
				{
					from = v;
					ApplyProgressGrower01Immediate(v);
				}, curveT, progressFillTweenSeconds)
					.SetEase(progressFillEase)
					.SetUpdate(true)
					.SetTarget(progressGrowerRect)
					.SetLink(progressGrowerRect.gameObject, LinkBehaviour.KillOnDestroy);

					if (ShouldPunchProgressGrower(curveT) && progressGrowerPunchScaleY > 0.001f && progressDelta > 0.01f)
					{
						float punch = progressGrowerPunchScaleY * Mathf.Clamp01(progressDelta * 2f);
						progressGrowerRect.DOPunchScale(new Vector3(0f, punch, 0f), progressGrowerPunchSeconds, 5, 0.5f)
							.SetUpdate(true)
							.SetTarget(progressGrowerRect)
							.SetLink(progressGrowerRect.gameObject, LinkBehaviour.KillOnDestroy);
					}
			}

			Color c = growerTarget;
			// If grower base alpha isn't cached (or was 0), fall back to current alpha or 1.
			float alpha = growerBaseColor.a > 0 ? growerBaseColor.a : progressGrower.color.a;
			float targetAlpha = Mathf.Lerp(progressGrowerMinAlpha, progressGrowerMaxAlpha, eased);
			c.a = Mathf.Max(alpha > 0 ? alpha : 1f, targetAlpha);
			progressGrower.DOColor(c, tintTweenSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(progressGrower.gameObject, LinkBehaviour.KillOnDestroy);
		}

		bool shouldPulse = pulse || (pulseOnSolved && solved);
		if (shouldPulse && Time.unscaledTime - lastPulseTime > 0.2f)
		{
			lastPulseTime = Time.unscaledTime;
			transform.DOKill();
			transform.DOPunchScale(new Vector3(0.06f, 0.06f, 0f), 0.25f, 6, 0.6f);
		}
	}

	private void Apply(string left, string op, string mid, string equals, string right)
	{
		ApplyBubble(leftBubbleText, leftBubbleGraphic, left, leftBaseFontSize, ref lastLeftText);
		ApplyBubble(midBubbleText, midBubbleGraphic, mid, midBaseFontSize, ref lastMidText);
		ApplyBubble(rightBubbleText, rightBubbleGraphic, right, rightBaseFontSize, ref lastRightText);
		if (addOperatorText != null) addOperatorText.text = op;
		if (equalsText != null) equalsText.text = equals;

		if (midBubbleText != null) midBubbleText.transform.parent.gameObject.SetActive(!string.IsNullOrWhiteSpace(mid));
	if (addOperatorText != null) addOperatorText.gameObject.SetActive(!string.IsNullOrWhiteSpace(op));
	if (equalsText != null)
	{
		bool showEquals = !string.IsNullOrWhiteSpace(equals) && (forceEqualsIfMissing || !string.IsNullOrWhiteSpace(right));
		equalsText.gameObject.SetActive(showEquals);
	}
		if (rightBubbleText != null) rightBubbleText.transform.parent.gameObject.SetActive(!string.IsNullOrWhiteSpace(right));
	}

	private void ApplyBubble(TextMeshProUGUI tmp, Graphic bubbleGraphic, string text, float baseSize, ref string lastPlainText)
	{
		if (tmp == null)
		{
			return;
		}

		string next = text ?? string.Empty;
		bool nextHasText = !string.IsNullOrWhiteSpace(next);
		bool fillingNow = string.IsNullOrWhiteSpace(lastPlainText) && nextHasText;

		if (ShouldSplitDoubleDigit(next))
		{
			ApplySplitDoubleDigit(tmp, bubbleGraphic, next.Trim(), fillingNow);
			lastPlainText = next;
			return;
		}

		ClearSplitDoubleDigit(tmp);

		tmp.textWrappingMode = TextWrappingModes.NoWrap;
		tmp.overflowMode = TextOverflowModes.Overflow;
		tmp.alignment = TextAlignmentOptions.Center;
		tmp.margin = Vector4.zero;
		tmp.enableAutoSizing = false;
		SetText(tmp, next, animate: useFebucciTextAnimator && fillingNow);
		SetBubbleFilled(bubbleGraphic, nextHasText, immediate: !fillingNow);

		lastPlainText = next;

		if (!nextHasText || baseSize <= 0f)
		{
			return;
		}

		// Reduce size for multi-character tokens so double-digits don't feel cramped.
		float scale = 1f;
		int len = next.Trim().Length;
		if (len == 2) scale = 0.78f;
		else if (len >= 3) scale = 0.65f;

		tmp.fontSize = Mathf.Max(18f, baseSize * scale);
	}

	private bool ShouldSplitDoubleDigit(string text)
	{
		if (!splitDoubleDigitsIntoBubbles)
		{
			return false;
		}

		string s = (text ?? "").Trim();
		if (s.Length < 2)
		{
			return false;
		}

		for (int i = 0; i < s.Length; i++)
		{
			if (!char.IsDigit(s[i]))
			{
				return false;
			}
		}

		return true;
	}

	private void ApplySplitDoubleDigit(TextMeshProUGUI tmp, Graphic bubbleGraphic, string digits, bool animate)
	{
		if (tmp == null)
		{
			return;
		}

		Transform bubbleRoot = tmp.transform != null ? tmp.transform.parent : null;
		if (bubbleRoot == null)
		{
			return;
		}

		// Hide the slot's outer bubble visuals (we'll show two inner bubbles instead).
		SetBubbleFilled(bubbleGraphic, filled: false, immediate: true);
		SetBubbleOutlineAlpha(bubbleRoot, 0f);

		tmp.gameObject.SetActive(false);

		Transform containerTransform = bubbleRoot.Find("DigitBubbles");
		if (containerTransform == null)
		{
			GameObject containerObj = new GameObject("DigitBubbles", typeof(RectTransform));
			containerObj.transform.SetParent(bubbleRoot, false);
			containerTransform = containerObj.transform;
		}

		RectTransform container = containerTransform as RectTransform;
		if (container != null)
		{
			container.anchorMin = new Vector2(0.5f, 0.5f);
			container.anchorMax = new Vector2(0.5f, 0.5f);
			container.pivot = new Vector2(0.5f, 0.5f);
			container.anchoredPosition = Vector2.zero;
			container.sizeDelta = Vector2.zero;
		}

		// Clear previous digits (if any)
		for (int i = containerTransform.childCount - 1; i >= 0; i--)
		{
			Destroy(containerTransform.GetChild(i).gameObject);
		}

		RectTransform rootRect = bubbleRoot as RectTransform;
		float rootSize = rootRect != null ? Mathf.Max(1f, Mathf.Min(rootRect.rect.width, rootRect.rect.height)) : 200f;
		float diameter = rootSize * Mathf.Clamp(doubleDigitBubbleScale, 0.5f, 1f);
		float inner = Mathf.Max(0f, diameter * Mathf.Clamp(doubleDigitInnerSpacingRatio, 0f, 0.5f));
		float step = diameter + inner;
		float startX = -((digits.Length - 1) * step) * 0.5f;

		Image outlineImg = null;
		Transform outline = bubbleRoot.Find("Outline");
		if (outline != null)
		{
			outlineImg = outline.GetComponent<Image>();
		}

		Sprite fillSprite = null;
		Color fillBase = Color.white;
		if (bubbleGraphic is Image img)
		{
			fillSprite = img.sprite;
			fillBase = img.color;
		}

		Sprite ringSprite = outlineImg != null ? outlineImg.sprite : null;
		Color ringColor = outlineImg != null ? outlineImg.color : new Color(0.4f, 0.4f, 0.4f, 1f);

		for (int i = 0; i < digits.Length; i++)
		{
			CreateDigitBubble(containerTransform, tmp, digits[i].ToString(), new Vector2(startX + (i * step), 0f), diameter, fillSprite, fillBase, ringSprite, ringColor, animate);
		}
	}

	private void CreateDigitBubble(Transform parent, TextMeshProUGUI styleSource, string digit, Vector2 anchoredPos, float diameter, Sprite fillSprite, Color fillBase, Sprite ringSprite, Color ringColor, bool animate)
	{
		if (parent == null)
		{
			return;
		}

		GameObject root = new GameObject($"Digit_{digit}", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
		root.transform.SetParent(parent, false);

		RectTransform rt = root.GetComponent<RectTransform>();
		rt.anchorMin = new Vector2(0.5f, 0.5f);
		rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.pivot = new Vector2(0.5f, 0.5f);
		rt.sizeDelta = new Vector2(diameter, diameter);
		rt.anchoredPosition = anchoredPos;

		CanvasGroup cg = root.GetComponent<CanvasGroup>();
		cg.interactable = false;
		cg.blocksRaycasts = false;

		Image bg = root.GetComponent<Image>();
		bg.raycastTarget = false;
		bg.sprite = fillSprite;
		bg.type = Image.Type.Simple;
		Color c = fillBase;
		// Keep a subtle glass fill even when "empty" so it doesn't read as off.
		c.a = Mathf.Clamp01(emptyBubbleAlpha);
		bg.color = c;

		// Outline ring
		if (ringSprite != null)
		{
			GameObject outlineObj = new GameObject("Outline", typeof(RectTransform), typeof(Image));
			outlineObj.transform.SetParent(root.transform, false);
			outlineObj.transform.SetAsFirstSibling();

			RectTransform ort = outlineObj.GetComponent<RectTransform>();
			ort.anchorMin = Vector2.zero;
			ort.anchorMax = Vector2.one;
			ort.anchoredPosition = Vector2.zero;
			ort.sizeDelta = Vector2.zero;

			Image oimg = outlineObj.GetComponent<Image>();
			oimg.raycastTarget = false;
			oimg.sprite = ringSprite;
			oimg.type = Image.Type.Simple;
			oimg.color = ringColor;
		}

		// Digit TMP
		GameObject textObj = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
		textObj.transform.SetParent(root.transform, false);
		TextMeshProUGUI tmp = textObj.GetComponent<TextMeshProUGUI>();
		RectTransform trt = tmp.rectTransform;
		trt.anchorMin = Vector2.zero;
		trt.anchorMax = Vector2.one;
		trt.anchoredPosition = Vector2.zero;
		trt.sizeDelta = Vector2.zero;

		tmp.textWrappingMode = TextWrappingModes.NoWrap;
		tmp.overflowMode = TextOverflowModes.Overflow;
		tmp.alignment = TextAlignmentOptions.Center;
		tmp.margin = Vector4.zero;
		tmp.enableAutoSizing = false;
		tmp.fontSize = Mathf.Clamp(diameter * 0.78f, 18f, 120f);
		tmp.raycastTarget = false;
		tmp.color = styleSource != null ? styleSource.color : Color.white;
		if (styleSource != null)
		{
			tmp.font = styleSource.font;
			tmp.fontSharedMaterial = styleSource.fontSharedMaterial;
			tmp.fontStyle = styleSource.fontStyle;
			tmp.fontWeight = styleSource.fontWeight;
		}

		SetText(tmp, digit, animate: useFebucciTextAnimator && animate);
	}

	private void ClearSplitDoubleDigit(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return;
		}

		Transform bubbleRoot = tmp.transform != null ? tmp.transform.parent : null;
		if (bubbleRoot == null)
		{
			return;
		}

		Transform container = bubbleRoot.Find("DigitBubbles");
		if (container != null)
		{
			Destroy(container.gameObject);
		}

		tmp.gameObject.SetActive(true);
		SetBubbleOutlineAlpha(bubbleRoot, 1f);
	}

	private static void SetBubbleOutlineAlpha(Transform bubbleRoot, float alpha)
	{
		if (bubbleRoot == null)
		{
			return;
		}

		Transform outline = bubbleRoot.Find("Outline");
		if (outline == null)
		{
			return;
		}

		Graphic g = outline.GetComponent<Graphic>();
		if (g == null)
		{
			return;
		}

		Color c = g.color;
		c.a = Mathf.Clamp01(alpha);
		g.color = c;
	}

	private void SetBubbleFilled(Graphic bubbleGraphic, bool filled, bool immediate)
	{
		if (bubbleGraphic == null)
		{
			return;
		}

		float targetAlpha = filled ? Mathf.Clamp01(filledBubbleAlpha) : Mathf.Clamp01(emptyBubbleAlpha);

		bubbleGraphic.DOKill();

		// LeTai TranslucentImage reads much better when driving foregroundOpacity for the "glass" strength.
		if (bubbleGraphic is TranslucentImage ti)
		{
			if (!ti.enabled)
			{
				ti.enabled = true;
			}

			if (immediate)
			{
				ti.foregroundOpacity = targetAlpha;
				// Keep base tint fully applied; foregroundOpacity controls how strong the glass appears.
				Color c = ti.color;
				c.a = 1f;
				ti.color = c;
				return;
			}

			float from = ti.foregroundOpacity;
			DOTween.To(() => from, v => { from = v; if (ti != null) ti.foregroundOpacity = v; }, targetAlpha, bubbleFillTweenSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true)
				.SetLink(ti.gameObject, LinkBehaviour.KillOnDestroy);

			return;
		}

		if (immediate)
		{
			Color c = bubbleGraphic.color;
			c.a = targetAlpha;
			bubbleGraphic.color = c;
			return;
		}

		bubbleGraphic.DOFade(targetAlpha, bubbleFillTweenSeconds).SetEase(Ease.OutQuad).SetUpdate(true);
	}

	private void SetText(TextMeshProUGUI tmp, string text, bool animate = false)
	{
		if (tmp == null)
		{
			return;
		}

		// Variable feedback should be subtle: never run Febucci effects on the "x" glyph.
		string plain = (text ?? string.Empty);
		if (string.Equals(plain.Trim(), "x", StringComparison.OrdinalIgnoreCase))
		{
			tmp.text = plain;
			return;
		}

		if (!useFebucciTextAnimator)
		{
			tmp.text = plain;
			return;
		}

		TextAnimator_TMP animator = tmp.GetComponent<TextAnimator_TMP>();
		if (animator == null)
		{
			animator = tmp.gameObject.AddComponent<TextAnimator_TMP>();
			animator.timeScale = Febucci.UI.TimeScale.Unscaled;
			animator.typewriterStartsAutomatically = false;
		}

		if (resetTextEffects.TryGetValue(tmp, out Coroutine existing) && existing != null)
		{
			StopCoroutine(existing);
			resetTextEffects.Remove(tmp);
		}

		if (animate && !string.IsNullOrWhiteSpace(plain))
		{
			string tag = string.IsNullOrWhiteSpace(fillTextEffectTag) ? "bounce" : fillTextEffectTag.Trim();
			animator.SetText($"<{tag}>{plain}</>");
			resetTextEffects[tmp] = StartCoroutine(ResetTextAfterDelay(tmp, animator, plain, fillTextEffectSeconds));
			return;
		}

		animator.SetText(plain);
	}

	private IEnumerator ResetTextAfterDelay(TextMeshProUGUI tmp, TextAnimator_TMP animator, string plain, float seconds)
	{
		yield return new WaitForSecondsRealtime(Mathf.Max(0f, seconds));

		if (animator != null)
		{
			animator.SetText(plain ?? string.Empty);
		}

		if (tmp != null)
		{
			resetTextEffects.Remove(tmp);
		}
	}
}
