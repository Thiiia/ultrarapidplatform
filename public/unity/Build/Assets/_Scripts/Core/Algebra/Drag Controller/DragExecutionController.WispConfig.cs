using UnityEngine;
using Sirenix.OdinInspector;

public partial class DragExecutionController
{
	private enum WispPathStyle
	{
		ArcUp,
		ArcDown,
		ArcLeft,
		ArcRight,
		SCurve,
		Jitter,
		MWave,
		WWave,
	}

	private enum WispUniformTemplateMode
	{
		Off = 0,
		Auto = 1,
		SemiCircle = 2,
		HalfRectangle = 3,
	}

	private enum WispPathUnitBucket
	{
		None = 0,
		Units2 = 2,
		Units4 = 4,
		Units6 = 6,
	}

	private enum WispPathRuntimeMode
	{
		AdaptiveDot = 0,
		UniformTemplate = 1,
		BezierReadability = 2,
	}

	[System.Serializable]
	private struct WispPathDebugSnapshot
	{
		[LabelText("Mode")] public WispPathRuntimeMode mode;
		[LabelText("Input Points")] public int inputPoints;
		[LabelText("Post Resample Points")] public int postResamplePoints;
		[LabelText("Spacing Used")] public float spacingUsed;
		[LabelText("Point Cap Used")] public int pointCapUsed;
	}

	[Header("Wisp Display")]
	[SerializeField] private bool wispShowOnlyWhileDragging = true;
	[Header("Wisp Overlap Feedback")]
	[SerializeField] private bool enableWispOverlapFeedback = true;
	[SerializeField, Range(0.4f, 2f)] private float wispOverlapDistanceMultiplier = 1.3f;
	[SerializeField, Range(0f, 0.8f)] private float wispOverlapMaxAlpha = 0.45f;
	[SerializeField, Range(0f, 0.25f)] private float wispOverlapProximityEpsilon = 0.03f;
	[SerializeField] private bool wispOverlapAffectsScore = false;
	[SerializeField] private bool wispOverlapAffectsJudgement = true;
	[SerializeField, Range(0f, 1f)] private float wispOverlapScoreFloor = 0.6f;
	[SerializeField, Range(0f, 1f)] private float wispOverlapResultGoodMin = 0.5f;
	[SerializeField, Range(0f, 1f)] private float wispOverlapResultPerfectMin = 0.8f;
	[SerializeField, Range(0f, 1.25f)] private float wispOverlapPerfectWeight = 1f;
	[SerializeField, Range(0f, 1.25f)] private float wispOverlapGoodWeight = 0.9f;
	[SerializeField, Range(0f, 1.25f)] private float wispOverlapEarlyWeight = 0.72f;
	[SerializeField, Range(0f, 1.25f)] private float wispOverlapLateWeight = 0.7f;
	[SerializeField] private Color wispOverlapPerfectColor = AlgebraUiPalette.JudgementGreen;
	[SerializeField] private Color wispOverlapGoodColor = AlgebraUiPalette.JudgementYellow;
	[SerializeField] private Color wispOverlapEarlyColor = AlgebraUiPalette.JudgementRed;
	[SerializeField] private Color wispOverlapLateColor = AlgebraUiPalette.JudgementRed;
	[Header("Wisp Streak Modulation")]
	[SerializeField] private bool wispStreakModulationEnabled = true;
	[SerializeField, Min(1)] private int wispStreakModulationTargetStreak = 6;
	[SerializeField, Range(0f, 0.35f)] private float wispStreakAssistDistanceBoost = 0.14f;
	[SerializeField, Range(0f, 0.25f)] private float wispStreakAssistPerfectRelax = 0.08f;
	[SerializeField, Range(0f, 0.2f)] private float wispStreakAssistGoodRelax = 0.06f;
	[SerializeField, Range(0f, 0.2f)] private float wispStreakTightenDistance = 0.05f;
	[SerializeField, Range(0f, 0.2f)] private float wispStreakTightenPerfect = 0.04f;
	[SerializeField, Range(0f, 0.15f)] private float wispStreakTightenGood = 0.03f;
	[SerializeField, Range(0f, 0.3f)] private float wispStreakBeatPulseBonus = 0.09f;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField] private bool wispPathHeatByAccuracy = true;
	[SerializeField, Range(0.05f, 0.65f)] private float wispPathHeatLerp = 0.24f;
	[SerializeField] private Color wispPathHeatHighColor = new Color(AlgebraUiPalette.JudgementGreen.r, AlgebraUiPalette.JudgementGreen.g, AlgebraUiPalette.JudgementGreen.b, 0.94f);
	[SerializeField] private Color wispPathHeatMidColor = new Color(AlgebraUiPalette.JudgementYellow.r, AlgebraUiPalette.JudgementYellow.g, AlgebraUiPalette.JudgementYellow.b, 0.92f);
	[SerializeField] private Color wispPathHeatLowColor = new Color(AlgebraUiPalette.JudgementRed.r, AlgebraUiPalette.JudgementRed.g, AlgebraUiPalette.JudgementRed.b, 0.92f);

	[Header("Wisp Follow Ring (Shapes)")]
	[SerializeField] private bool showWispFollowRing = true;
	[SerializeField, Range(1f, 36f)] private float wispFollowRingThickness = 9f;
	[SerializeField, Range(0f, 1f)] private float wispFollowRingAlpha = 0.85f;
	[SerializeField] private bool wispFollowRingUseZoneColor = true;
	[SerializeField, Range(0f, 1f), Tooltip("How much the wisp follow-ring reacts to drag speed (thickness/radius/alpha).")]
	private float wispFollowRingSpeedResponse = 0.45f;
	[SerializeField, Tooltip("When enabled, ring radius follows equation bubble size instead of indicator size.")]
	private bool wispFollowRingUseBubbleRadius = true;
	[SerializeField, Range(0.35f, 1.6f), Tooltip("1 = same visual radius as the active equation bubble. <1 smaller, >1 larger.")]
	private float wispFollowRingBubbleRadiusRatio = 1.04f;
	[SerializeField, Min(0f), Tooltip("Extra ring radius padding in UI pixels after ratio sizing.")]
	private float wispFollowRingRadiusPadding = 3f;
	[SerializeField] private Color wispFollowRingColor = new Color(1f, 1f, 1f, 1f);
	[SerializeField, Range(0.85f, 1.25f)] private float wispFollowRingPulseScale = 1.05f;

	[Header("Wisp Target Approach Ring (Rhythm Cue)")]
	[SerializeField, Tooltip("Dedicated timing approach ring on the moving target (separate from the path and separate from the follow ring).")]
	private bool wispTargetApproachRingEnabled = false;
	[SerializeField, Tooltip("Continuously shrinks the moving-target approach ring toward the target using chart timing instead of relying only on pulse bursts.")]
	private bool wispTargetApproachRingContinuous = true;
	[SerializeField] private bool wispTargetApproachRingUseZoneColor = true;
	[SerializeField] private Color wispTargetApproachRingColor = AlgebraUiPalette.AccentPurple;
	[SerializeField, Range(0f, 1f)] private float wispTargetApproachRingAlpha = 0.55f;
	[SerializeField, Range(1f, 2.5f)] private float wispTargetApproachRingStartScale = 1.55f;
	[SerializeField, Range(0.35f, 1f), Tooltip("Dampens the moving-target approach ring relative to the algebra approach multiplier so it stays readable over the board.")]
	private float wispTargetApproachRingScaleDampen = 0.68f;
	[SerializeField, Range(0f, 1f), Tooltip("Extra fade as the moving-target approach ring closes so it yields to the actual target before overlap judgement.")]
	private float wispTargetApproachRingFadeNearHit = 0.58f;
	[SerializeField, Range(0.01f, 0.14f)] private float wispTargetApproachRingThicknessRatio = 0.032f;
	[SerializeField, Min(0.05f)] private float wispTargetApproachRingSeconds = 0.16f;
	[SerializeField] private bool wispTargetApproachRingPulseOnBeat = true;
	[SerializeField] private bool wispTargetApproachRingPulseOnSpawn = true;

	[Header("Algebra Target ImpactFx (Optional)")]
	[SerializeField, Tooltip("Optional ImpactFx prefab used for moving-target timing cues in Algebra (preview + hit/miss bursts).")]
	private ImpactFx algebraTargetImpactFxPrefab;
	[SerializeField, Tooltip("Optional parent for algebra target ImpactFx. Defaults to the wisp path container.")]
	private Transform algebraTargetImpactFxParentOverride;
	[SerializeField] private bool algebraTargetImpactFxEnable = true;
	[SerializeField] private bool algebraTargetImpactFxPreviewOnSpawn = true;
	[SerializeField] private bool algebraTargetImpactFxPreviewOnBeat = false;
	[SerializeField] private bool algebraTargetImpactFxUseHitBursts = true;
	[SerializeField] private bool algebraTargetImpactFxUseMissBursts = true;
	[SerializeField] private bool algebraTargetImpactFxTintFromWispZone = true;
	[SerializeField, Range(0f, 1f)] private float algebraTargetImpactFxHeatBias = 0.15f;
	[SerializeField, Range(0.1f, 4f)] private float algebraTargetImpactFxScale = 1f;

	[Header("Wisp Moving Target (Glass Prefab)")]
	[SerializeField] private bool wispUsePrefabMovingTarget = true;
	[SerializeField, Tooltip("Optional explicit prefab for moving target visuals. Falls back to bubbleElementPrefab when null.")]
	private GameObject wispMovingTargetPrefab;
	[SerializeField, Range(0f, 1f), Tooltip("Base body alpha for the moving-target bubble while outside the green/perfect timing window.")]
	private float wispMovingTargetBodyIdleAlpha = 0.2f;
	[SerializeField, Range(0f, 1f), Tooltip("Body alpha for the moving-target bubble inside the green/perfect timing window.")]
	private float wispMovingTargetBodyFocusAlpha = 0.32f;
	[SerializeField, Range(0f, 1f)] private float wispMovingTargetGlassIdleOpacity = 0.22f;
	[SerializeField, Range(0f, 1f)] private float wispMovingTargetGlassFocusOpacity = 0.34f;
	[SerializeField, Range(1f, 1.4f)] private float wispMovingTargetOutlinePulseScale = 1.12f;
	[SerializeField, Range(0f, 1f), Tooltip("Minimum overlap proximity required before moving-target interaction pulses trigger.")]
	private float wispMovingTargetInteractionPulseMinProximity = 0.3f;
	[SerializeField, Min(0f), Tooltip("Cooldown between moving-target interaction pulses while dragging near it.")]
	private float wispMovingTargetInteractionPulseCooldown = 0.08f;
	[SerializeField, Min(0.04f), Tooltip("Duration of moving-target interaction pulse animation.")]
	private float wispMovingTargetInteractionPulseSeconds = 0.12f;

	[Header("Wisp Path Settings")]
	[SerializeField] private float wispPathArcHeight = 120f;
	[SerializeField, Range(2, 160)] private int wispPathSegments = 14;
	[HideIf(nameof(wispAutoScaleToBubble))]
	[SerializeField] private float wispSize = 30f;
	[SerializeField] private float wispSpeed = 2f; // Beats to complete path
	[SerializeField] private bool wispClampArcBelowReferenceEquation = true;
	[SerializeField, Tooltip("Render the wisp path behind equation bubbles/HUD. Disable to keep the path fully in front of the locked equation.")]
	private bool wispRenderBehindEquationBubbles = true;
	[SerializeField, Min(0f)] private float wispReferenceEquationClearance = 20f;
	[SerializeField, Min(0f)] private float wispMaxRiseAboveEndpoints = 135f;
	[SerializeField] private bool wispAvoidEquationBubbles = true;
	[SerializeField, Min(0f)] private float wispBubbleAvoidancePadding = 12f;
	[SerializeField, Range(0.5f, 0.95f)] private float wispSegmentCullConfidenceThreshold = 0.82f;
	[SerializeField] private bool wispFadeIndicatorNearEquationBubbles = true;
	[SerializeField, Range(0f, 1f)] private float wispIndicatorBubbleAlphaMultiplier = 0.36f;
	[SerializeField, Range(0f, 1f)] private float wispRingBubbleAlphaMultiplier = 0.72f;
	[SerializeField, Min(0f), Tooltip("How often (seconds) to refresh bubble-avoid zones while animating wisp visuals.")]
	private float wispOcclusionZoneRefreshSeconds = 0.06f;
	[SerializeField, Min(0f), Tooltip("Faster refresh interval used only while actively dragging.")]
	private float wispOcclusionZoneRefreshWhileDraggingSeconds = 0.03f;
	[SerializeField, Tooltip("Fade path alpha near endpoint bubbles while rendering behind them. Disable to keep full path opacity up to bubble overlap.")]
	private bool wispEndpointBubbleFadeEnabled = false;
	[SerializeField, Range(0f, 0.5f), Tooltip("When endpoint fade is enabled, controls how close to the bubble outline the fade band stays.")]
	private float wispEndpointBubbleFadeOutlineBand = 0.06f;
	[SerializeField, Range(0f, 1f), Tooltip("Minimum alpha used for non-green path segments while rendering behind bubbles.")]
	private float wispPathMinAlphaWhenBehind = 0.78f;
	[SerializeField, Range(0f, 1f), Tooltip("Lift non-green path tint toward the behind-bubble lift color while rendering behind bubbles.")]
	private float wispPathTintLiftWhenBehind = 0.18f;
	[SerializeField, Tooltip("Tint used when lifting path visibility behind bubbles. Use a cool dark tint for richer gradients instead of white.")]
	private Color wispPathBehindLiftColor = Color.white;
	[SerializeField, Range(0f, 0.4f), Tooltip("Extra alpha lift for non-green path segments while rendering behind bubbles.")]
	private float wispPathAlphaLiftWhenBehind = 0.18f;
	[SerializeField, Range(0f, 0.35f), Tooltip("Extra alpha lift for green/perfect path segments while rendering behind bubbles.")]
	private float wispZoneAlphaLiftWhenBehind = 0.12f;
	[SerializeField] private Color wispColor = new Color(1f, 0.9f, 0.4f, 0.9f);
	[SerializeField] private Color wispPathColor = new Color(0.36f, 0.36f, 0.38f, 0.78f);
	[HideIf(nameof(wispAutoScaleToBubble))]
	[SerializeField] private float wispPathWidth = 12f;
	[SerializeField, Tooltip("Blend path colour from moving-target accent (start) toward destination neutral (end).")]
	private bool wispUseDirectionalPathGradient = true;
	[SerializeField] private Color wispPathGradientStartColor = new Color(0.16f, 0.95f, 0.42f, 0.95f);
		[SerializeField] private Color wispPathGradientMiddleColor = new Color(0.82f, 0.58f, 0.20f, 0.94f);
		[SerializeField, Range(0.05f, 0.95f), Tooltip("Normalized location of the middle gradient stop (third color) between start and end.")]
		private float wispPathGradientMiddlePosition = 0.56f;
		[SerializeField, Range(0f, 1f), Tooltip("How strongly the middle gradient stop is used. 0 = two-color gradient, 1 = full three-stop blend.")]
		private float wispPathGradientMiddleBlendStrength = 0.88f;
		[SerializeField] private Color wispPathGradientEndColor = new Color(0.42f, 0.44f, 0.46f, 0.94f);
		[SerializeField, Range(0.35f, 2.4f), Tooltip("Curve bias for directional gradient interpolation. <1 keeps green longer, >1 fades sooner.")]
		private float wispPathGradientExponent = 0.74f;
		[SerializeField, Range(0f, 1f), Tooltip("How strongly the Good/green timing zone tints the path when using directional gradient.")]
		private float wispPathGreenZoneTintStrength = 0.28f;
		[SerializeField, Range(0f, 1f), Tooltip("How strongly the Perfect timing zone tints the path when using directional gradient.")]
		private float wispPathPerfectZoneTintStrength = 0.42f;
		[SerializeField, Range(0f, 0.45f), Tooltip("Optional ramp before the Good zone that starts tinting the path toward green for readability on long drags.")]
		private float wispPathPreGreenRampWidth = 0.14f;
		[SerializeField, Range(0f, 1f), Tooltip("Strength of the pre-Good-zone green ramp tint.")]
		private float wispPathPreGreenRampStrength = 0.18f;
		[SerializeField, Tooltip("Gradient color at the beginning of the Good/green timing zone.")]
		private Color wispGoodZoneGradientStartColor = new Color(0.58f, 0.84f, 0.20f, 0.94f);
		[SerializeField, Tooltip("Gradient color near the end of the Good/Perfect timing zone.")]
		private Color wispGoodZoneGradientEndColor = new Color(0.30f, 0.97f, 0.34f, 0.98f);
		[SerializeField, Range(0f, 1f), Tooltip("Extra blend strength for the good-zone gradient over the base path gradient.")]
		private float wispGoodZoneGradientStrength = 0.58f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0f, 1f), Tooltip("Animated shimmer amount applied within the Good/Perfect zone.")]
		private float wispGoodZoneShimmerStrength = 0.18f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0.1f, 8f), Tooltip("Shimmer frequency for the Good/Perfect zone animation.")]
		private float wispGoodZoneShimmerHz = 1.8f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Tooltip("Pulse tint for green-zone beat accents.")]
		private Color wispGoodZonePulseColor = new Color(0.55f, 1f, 0.34f, 0.98f);
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0f, 1f), Tooltip("How strongly green-zone beat accents tint toward the pulse color.")]
		private float wispGoodZonePulseTintStrength = 0.52f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Tooltip("Adds a subtle moving-target-driven head tint that travels along the path (separate from beat pulse accents).")]
		private bool wispPathAnimateWithMovingTarget = true;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0f, 1f), Tooltip("How strongly the moving target tints the nearby path segment.")]
		private float wispPathMovingTargetAccentStrength = 0.28f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0.02f, 0.4f), Tooltip("Normalized width of the moving color head along the path.")]
		private float wispPathMovingTargetAccentWidth = 0.13f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0.05f, 1f), Tooltip("How quickly path colors settle toward the moving target tint each frame.")]
		private float wispPathMovingTargetAccentFollowLerp = 0.42f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0f, 8f), Tooltip("Extra shimmer frequency applied to the moving path head tint. 0 disables shimmer.")]
		private float wispPathMovingTargetAccentPulseHz = 1.6f;
		[HideIf(nameof(wispPathGradientOnlyMode))]
		[SerializeField, Range(0f, 1f), Tooltip("Blend between zone cue color and moving-target color for the path head tint.")]
		private float wispPathMovingTargetAccentIndicatorBlend = 0.35f;
		[SerializeField, Min(1)] private int wispOverlaySortingOrderOffset = 25;
	[SerializeField, Range(24, 240), Tooltip("Upper bound for rendered polyline points when using Shapes.")]
	private int wispShapesPolylineMaxPoints = 220;
	[SerializeField, Range(0f, 1f), Tooltip("Extra point decimation for Shapes path. 0 keeps detail, 1 is cheapest.")]
	private float wispShapesPolylineDecimation = 0f;
	[SerializeField, Tooltip("Uses round polyline joins. Disable for lower mesh cost.")]
	private bool wispShapesPolylineRoundJoins = true;
	[SerializeField, Range(0.75f, 4f), Tooltip("Extra thickness boost applied only when using Shapes polyline rendering.")]
	private float wispShapesPolylineThicknessMultiplier = 1.18f;
	[SerializeField, Range(0.35f, 3f), Tooltip("Global path thickness multiplier applied after width auto-scaling/manual width.")]
	private float wispPathThicknessMultiplier = 1f;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[SerializeField, Tooltip("Sample active source/target bubble visuals and use them as the geometry reference size instead of only using the configured bubbleSize.")]
	private bool wispGeometrySampleActiveBubbles = true;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[ShowIf(nameof(wispGeometrySampleActiveBubbles))]
	[SerializeField, Range(0f, 1f), Tooltip("Blend between configured bubbleSize (0) and sampled active bubble diameter (1) for width/arc/pitch calculations.")]
	private float wispGeometryUseRenderedBubbleBlend = 0.85f;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[SerializeField, Range(0.65f, 1.45f), Tooltip("Scales unit-pitch used for 2/4/6 bucket selection. Increase if paths choose buckets that look too short/chunky.")]
	private float wispPathUnitPitchScale = 1f;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[SerializeField, Range(0.6f, 2.4f), Tooltip("Canonical placeholder arc height ratio relative to geometry bubble size.")]
	private float wispCanonicalArcHeightToBubbleRatio = 229f / 134f;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[SerializeField, Range(0.35f, 2.4f), Tooltip("Global multiplier for arc depth after arc-height resolution. Use this for dip tuning.")]
	private float wispArcHeightMultiplier = 1f;
	[FoldoutGroup("Wisp Geometry Tuning")]
	[SerializeField, Range(0.08f, 0.9f), Tooltip("Caps final path width as a ratio of geometry bubble size to avoid oversized tubes when multipliers stack.")]
	private float wispPathMaxWidthToBubbleRatio = 0.56f;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Tooltip("When enabled, strips extra path FX (heat, beat pulses, moving-head accent, tick markers) and renders only the base gradient.")]
		private bool wispPathGradientOnlyMode = false;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Tooltip("Automatically applies the Figma-aligned wisp palette at runtime when path rendering is procedural or dot-sprite driven.")]
		private bool wispAutoApplyFigmaPaletteForProceduralPath = true;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Tooltip("When auto-applying the procedural profile, keep only the core gradient to avoid runtime tint drift from heat/accent overlays.")]
		private bool wispProceduralPathForceGradientOnly = true;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Range(0.04f, 0.75f), Tooltip("Minimum path width ratio (relative to bubble size) enforced for procedural/dot path readability.")]
		private float wispProceduralPathMinWidthRatio = 0.30f;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Range(0.75f, 4f), Tooltip("Minimum Shapes thickness multiplier enforced for procedural/dot paths.")]
		private float wispProceduralPathMinShapesThicknessMultiplier = 1.35f;
		[FoldoutGroup("Wisp Path"), FoldoutGroup("Wisp Path/Visual Modes")]
		[SerializeField, Range(0.25f, 4f), Tooltip("Minimum extra thickness multiplier applied in dot-sprite mode.")]
		private float wispProceduralPathMinDotThicknessMultiplier = 1.25f;
		[SerializeField] private Color greenZoneColor = new Color(0f, 1f, 0.3412f, 0.9f); // #00FF57
		[SerializeField] private float greenZoneStart = 0.72f; // Path progress where green zone starts
		[SerializeField] private float greenZoneEnd = 1f; // Path progress where green zone ends
	[SerializeField] private float perfectZoneStart = 0.9f; // Tighter window for "perfect"
	[SerializeField, Min(0f), Tooltip("Grace period after wisp end where late releases still use chart-based judgement.")]
	private float wispLateHoldGraceSeconds = 0.35f;

	[Header("Wisp Path Scale (UI)")]
	[SerializeField] private bool wispAutoScaleToBubble = true;
	[ShowIf(nameof(wispAutoScaleToBubble))]
	[SerializeField, Range(0.12f, 0.75f)] private float wispIndicatorSizeRatio = 0.34f; // relative to bubbleSize
	[ShowIf(nameof(wispAutoScaleToBubble))]
	[SerializeField, Range(0.04f, 0.75f)] private float wispPathWidthRatio = 0.24f; // relative to bubbleSize
	[SerializeField] private bool wispArcHeightScalesWithDistance = true;
	[SerializeField, Range(0.05f, 0.75f)] private float wispArcHeightDistanceRatio = 0.32f; // relative to start->end distance
	[SerializeField, Min(0f)] private float wispArcHeightMin = 80f;
	[SerializeField, Min(0f)] private float wispArcHeightMax = 260f;
	[SerializeField, Min(0.05f)] private float wispTravelDurationMinSeconds = 0.45f;
	[SerializeField, Min(0.05f)] private float wispTravelDurationMaxSeconds = 2.2f;
	[SerializeField, Tooltip("When the idle/journey wisp is driven by chart note windows, allow longer travel times than the global max so sparse charts/holds do not feel artificially sped up.")]
	private bool wispPreserveIdleChartNoteDurations = true;
	[SerializeField, Min(0.05f), Tooltip("Upper cap used only for idle/journey chart-note timing when preservation is enabled.")]
	private float wispIdleChartNoteDurationMaxSeconds = 6f;
	[SerializeField, Tooltip("When active drags use chart note timing, target the note hit time instead of the full sustain tail. Recommended for sustain-heavy charts like Waves.")]
	private bool wispActiveDragChartTimingHitOnly = true;
	[SerializeField, Tooltip("Logs which timing source the wisp used (notes/scheduled/fallback) and how much duration was clamped. Useful for debugging 'chart not being read' reports.")]
	private bool wispLogTimingDiagnostics = false;

	[Header("Wisp Curve Sampling")]
	[SerializeField, Range(0.2f, 1.6f)] private float wispCurvePointSpacingWidthMultiplier = 0.22f;
	[SerializeField, Range(24, 320)] private int wispCurveMaxRenderPoints = 260;
	[SerializeField] private bool wispCurveCornerRounding = true;
	[SerializeField, Range(8f, 80f)] private float wispCurveCornerRoundMinTurnDegrees = 18f;
	[SerializeField, Range(0.15f, 0.45f)] private float wispCurveCornerRoundBlend = 0.28f;
	[SerializeField, Range(0f, 2f)] private float wispPathCurvaturePenaltyWeight = 0.75f;
	[SerializeField, Range(0f, 3f)] private float wispPathSelfIntersectionPenaltyWeight = 1.25f;
	[SerializeField, Range(0f, 2f), Tooltip("Penalty for paths that leave/arrive with near-vertical endpoint tangents (ugly stem look).")]
	private float wispPathEndpointStemPenaltyWeight = 0.95f;
	[SerializeField, Range(0f, 2f), Tooltip("Penalty for deep U-shapes that dwell too long near the bottom of the path.")]
	private float wispPathBottomDwellPenaltyWeight = 0.9f;
	[SerializeField] private bool wispPreferUnderWhenReferenceIsClose = true;
	[SerializeField, Range(0f, 2f)] private float wispPreferUnderCloseWeight = 0.95f;
	[SerializeField, Range(0.4f, 3f)] private float wispReferenceCloseHeadroomRatio = 1.2f;

	[Header("Wisp Playful Feedback")]
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField] private bool wispBeatSnapPulseEnabled = true;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField, Range(0f, 0.35f)] private float wispBeatSnapPulseScale = 0.11f;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField, Min(0.02f)] private float wispBeatSnapPulseSeconds = 0.12f;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField] private bool wispTimingTickMarkers = true;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField, Range(0.08f, 0.4f)] private float wispTimingTickSizeRatio = 0.22f;
	[HideIf(nameof(wispPathGradientOnlyMode))]
	[SerializeField, Range(0f, 1f)] private float wispTimingTickAlpha = 0.9f;
	[SerializeField] private bool wispOutcomeTrailEnabled = true;
	[SerializeField, Min(0.05f)] private float wispOutcomeTrailSeconds = 0.26f;
	[SerializeField, Range(1f, 3f)] private float wispOutcomeTrailScale = 1.45f;

	[Header("Wisp Path Variants")]
	[SerializeField] private bool wispUseVariantPaths = true;
	[SerializeField] private bool wispVariantUseChartLane = true;
	[SerializeField, Min(0f)] private float wispVariantChartLaneSearchWindowSeconds = 0.35f;
	[SerializeField, Tooltip("Resolve path variants against fixed layout units (2/4/6) from stable endpoint spacing. Metadata is cached for future asset/template selection.")]
	private bool wispUseFixedUnitPathBuckets = true;
	[SerializeField, Min(0f), Tooltip("0 = auto from current bubble size + spacing. Used only for 2/4/6 path bucket resolution.")]
	private float wispFixedUnitPathPitchOverride = 0f;

	[Header("Wisp Path Dot Sprite")]
	[SerializeField, Tooltip("Circular sprite stamped at equal intervals along the wisp path. When assigned this replaces the three arc sprites below.")]
	private Sprite wispDotSprite;
	[SerializeField, Range(0.25f, 6f), Tooltip("How far the rope sags below the endpoints. Multiplies the standard arc height — 1 = default depth, 2 = twice as deep.")]
	private float wispDotPathSagMultiplier = 1.5f;
	[SerializeField, Range(0.25f, 4f), Tooltip("Primary thickness multiplier used in dot-sprite mode.")]
	private float wispDotPathThicknessMultiplier = 1f;
	[SerializeField, Tooltip("Optional safety cap for dot-path dip against playfield bounds.")]
	private bool wispDotStrictClampDipToPlayfield = true;
	[SerializeField, Range(0f, 1f), Tooltip("How strongly dot-sprite endpoints are pushed from bubble centers toward bubble edges. 0 = center anchored, 1 = edge anchored.")]
	private float wispDotPathEndpointEdgeBias = 0.8f;
	[SerializeField, Range(1f, 3f), Tooltip("Minimum dip depth in dot-sprite mode as a multiple of rendered path width. Prevents flattened U-shapes when constraints are active.")]
	private float wispDotPathMinDipWidthMultiplier = 1.55f;

	[Header("Wisp Path Unit Sprites (legacy – leave blank when using Dot Sprite)")]
	[SerializeField, Tooltip("While using placeholder bucket sprites, force a canonical U-path and bypass avoidance style selection. Disable once style-specific art is hooked up.")]
	private bool wispPlaceholderArcSpritesForceCanonicalPath = true;
	[SerializeField, Tooltip("Arc sprite for paths spanning ~2 units (tight curve).")]
	private Sprite wispArcSpriteUnits2;
	[SerializeField, Tooltip("Arc sprite for paths spanning ~4 units (medium curve).")]
	private Sprite wispArcSpriteUnits4;
	[SerializeField, Tooltip("Arc sprite for paths spanning ~6 units (wide/flat curve).")]
	private Sprite wispArcSpriteUnits6;

	[SerializeField] private WispPathStyle wispFixedPathStyle = WispPathStyle.ArcUp;
	[SerializeField] private WispPathStyle[] wispPathStylePool = { WispPathStyle.ArcUp, WispPathStyle.ArcLeft, WispPathStyle.ArcRight, WispPathStyle.SCurve, WispPathStyle.MWave, WispPathStyle.WWave };
	[SerializeField] private bool wispVariantDeterministic = false;
	[SerializeField] private int wispVariantSeed = 12345;
	[SerializeField, Range(0f, 0.75f)] private float wispJitterStrength = 0.22f;
	[SerializeField, Tooltip("Avoid repeating the same visible path family (e.g. semicircle/half-rect/S-curve) on consecutive drags when alternatives are viable.")]
	private bool wispPathFamilyCadenceEnabled = true;
	[SerializeField, Range(1, 4), Tooltip("Allowed consecutive repeats of the same visible path family before penalties push variety.")]
	private int wispPathFamilyMaxConsecutive = 2;
	[SerializeField, Range(0f, 0.6f), Tooltip("Penalty applied during path style selection when the visible family is repeating too much.")]
	private float wispPathFamilyRepeatPenalty = 0.16f;
	[SerializeField, Range(0f, 0.25f), Tooltip("Small extra penalty to repeated semicircle silhouettes to encourage half-rect / S-curve variety.")]
	private float wispPathSemiCircleRepeatBonusPenalty = 0.02f;

	[Header("Wisp Dynamic Adaptation")]
	[SerializeField, Tooltip("Bias style choice from equation geometry (e.g. equals-crossing + drag direction).")]
	private bool wispUseEquationAwareStyleBias = true;
	[SerializeField, Tooltip("Let the active algebra skill tag nudge path families, so multi-step skills can surface more layered silhouettes.")]
	private bool wispUseSkillTagPathBias = true;
	[SerializeField, Range(0f, 0.2f), Tooltip("How strongly the current algebra skill tag can pull selection toward M/W-style paths.")]
	private float wispSkillTagPathBiasStrength = 0.085f;
	[SerializeField, Range(0f, 0.45f), Tooltip("How hard equation-aware bias can override chart/random style picks.")]
	private float wispEquationStyleOverrideStrength = 0.18f;
	[SerializeField, Tooltip("Scales travel beats by path distance so longer drags feel intentional.")]
	private bool wispUseAdaptiveTravelSteps = true;
	[SerializeField, Range(0.8f, 2.2f)] private float wispAdaptiveTravelMaxMultiplier = 1.45f;
	[SerializeField, Range(0f, 0.6f), Tooltip("Extra travel-step multiplier when moving across the equals sign.")]
	private float wispAdaptiveTravelEqualsCrossBonus = 0.28f;
	[SerializeField, Range(0f, 0.4f), Tooltip("Extra travel-step multiplier for variable/coefficient drags.")]
	private float wispAdaptiveTravelVariableBonus = 0.12f;
	[SerializeField, Min(0.02f), Tooltip("If song-time stalls longer than this, progression falls back to realtime.")]
	private float wispSongClockStallFallbackSeconds = 0.12f;

	[Header("Wisp Canonical Geometry")]
	[SerializeField, Tooltip("Keeps path silhouettes clean and repeatable (semi-circle / half-rectangle) instead of freeform.")]
	private WispUniformTemplateMode wispUniformTemplateMode = WispUniformTemplateMode.Auto;
	[SerializeField, Tooltip("Bias canonical templates to bend below the equation row when possible.")]
	private bool wispUniformPreferLowerHemisphere = false;
	[SerializeField, Range(0.75f, 1.8f), Tooltip("Depth multiplier for half-rectangle U-shapes.")]
	private float wispUniformHalfRectDepthMultiplier = 0.94f;
	[SerializeField, Range(0f, 1f), Tooltip("Auto-mode bias toward HalfRectangle templates. 0 = prefer smooth semicircles, 1 = prefer long U-shapes.")]
	private float wispUniformAutoHalfRectBias = 0.24f;
	[SerializeField, Range(0.08f, 0.45f), Tooltip("Corner radius ratio relative to horizontal span for half-rectangle template.")]
	private float wispUniformHalfRectCornerRadiusRatio = 0.24f;
	[SerializeField, Range(0.45f, 1f), Tooltip("Sagitta ratio for semi-circle template. 1 = perfect semicircle.")]
	private float wispUniformSemiCircleSagittaRatio = 0.88f;
	[SerializeField, Range(0f, 0.45f), Tooltip("Extra center dip ratio for half-rectangle bridge to keep it curved.")]
	private float wispUniformHalfRectBridgeDipRatio = 0.06f;
	[SerializeField, Range(0.12f, 0.6f), Tooltip("Point spacing ratio (relative to path width) for canonical template resampling.")]
	private float wispUniformTemplateSpacingWidthMultiplier = 0.16f;
	[SerializeField, Tooltip("If enabled, canonical templates avoid readability warping from bubble avoidance projection.")]
	private bool wispUniformIgnoreBubbleAvoidance = true;
	[SerializeField, Tooltip("Allow canonical placeholder hemisphere to alternate across repeat drags. Disable for stable under-row silhouettes.")]
	private bool wispCanonicalHemisphereAlternation = false;
	[SerializeField, Tooltip("When top space is tight against locked/reference UI, force canonical paths to bend downward.")]
	private bool wispCanonicalForceLowerWhenTopConstrained = true;
	[ShowIf(nameof(wispCanonicalForceLowerWhenTopConstrained))]
	[SerializeField, Range(0f, 1f), Tooltip("Top squeeze threshold used to force lower hemisphere when canonical force-lower is enabled.")]
	private float wispCanonicalTopConstraintForceLowerThreshold = 0.08f;

		[Header("Wisp Playfield UX")]
		[SerializeField, Tooltip("Keep generated wisp paths inside a screen-safe corridor (in path-space rect) so they don't hug/cross viewport edges.")]
		private bool wispConstrainPathToPlayfield = true;
		[SerializeField, Range(0f, 0.2f), Tooltip("Extra safe margin ratio (relative to path-space min dimension) reserved from the edges.")]
		private float wispPathPlayfieldSafeMarginRatio = 0.045f;
		[SerializeField, Min(0f), Tooltip("Minimum safe margin from screen/playfield edges in UI pixels.")]
		private float wispPathPlayfieldSafeMarginMin = 18f;
		[SerializeField, Min(0f), Tooltip("Maximum safe margin from screen/playfield edges in UI pixels.")]
		private float wispPathPlayfieldSafeMarginMax = 84f;
		[SerializeField, Range(0f, 3f), Tooltip("Penalty for path points approaching or crossing the screen-safe edge corridor.")]
		private float wispPathPlayfieldEdgePenaltyWeight = 1.1f;
		[SerializeField, Range(0f, 2f), Tooltip("Penalty for long consecutive runs near the edge corridor (slider readability killer).")]
		private float wispPathPlayfieldEdgeRunPenaltyWeight = 0.8f;
		[SerializeField, Range(0, 2), Tooltip("How many passes to clamp interior path points back inside the playfield-safe corridor.")]
		private int wispPathPlayfieldClampPasses = 1;

}
