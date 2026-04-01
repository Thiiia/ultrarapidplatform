using System;
using System.Collections;
using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;

using TMPro;

using DG.Tweening;

using LeTai.Asset.TranslucentImage;
using LeTai.Paraform.Scaffold;
using Shapes;

using ChartLoader.NET.Framework;
using Sirenix.OdinInspector;
using TooltipSpecial = RainbowArt.CleanFlatUI.TooltipSpecial;

public partial class DragExecutionController : MonoBehaviour, ISessionBootstrapHost, IBubbleOperationFlowHost, IDragDropResolutionHost
{
	private static Sprite fallbackWhiteSprite;
	private static Sprite fallbackPillSprite;

	private enum MathSymbolMode
	{
		SmartFallback = 0,
		PreferUnicode = 1,
		ForceAscii = 2,
	}

	private enum MultiDigitRenderMode
	{
		SingleBubble = 0,
		SplitDigits = 1,
	}

	public enum JourneyGuidanceMode
	{
		FullPath = 0,
		DimmedPath = 1,
		MovingTargetOnly = 2,
	}

	private enum EquationPathHemisphere
	{
		Neutral = 0,
		Upper = 1,
		Lower = 2,
	}

	[Header("References")]
	[SerializeField] private LinearEquationSolver equationSolver;
	[SerializeField] private EquationChoiceSystem choiceSystem;
	[SerializeField] private RectTransform dragCanvas;
	[SerializeField] private RectTransform equationContainer;
	[SerializeField] private Camera uiCamera;
	[SerializeField] private Canvas parentCanvas;
	[SerializeField] private ChartSystem chartSystem;

	[Header("Hit Zone Window")]
	[SerializeField, Tooltip("If enabled, pathway appears when the hit zone starts moving (idle), not when the player drags.")]
	private bool pathwayAppearsWithHitZone = true;

	[SerializeField, Tooltip("Lock the pathway style/shape for a full hit-zone window so it doesn't keep changing.")]
	private bool lockPathPerHitZoneWindow = true;

	[SerializeField, Min(0f), Tooltip("Optional safety to avoid rebuilding path too frequently if refresh is spammy.")]
	private float pathRebuildCooldown = 0.15f;

	private float lastPathBuildRealtime = -999f;
	private WispPathStyle lockedWindowPathStyle;
	private bool hasLockedWindowPathStyle;
	private EquationPathHemisphere lockedWindowEquationPathHemisphere = EquationPathHemisphere.Neutral;
	private bool hasLockedWindowEquationPathHemisphere;
	private WispUniformTemplateMode lockedWindowTemplateMode = WispUniformTemplateMode.Off;
	private bool hasLockedWindowTemplateMode;
	private WispPathUnitBucket lockedWindowPathUnitBucket = WispPathUnitBucket.None;
	private bool lockedWindowPathUnitFlipX;
	private bool lockedWindowPathUnitFlipY;
	private bool hasLockedWindowPathUnitVariant;

	[Header("Chart Integration (Algebra)")]
	[SerializeField] private AlgebraChartConfig algebraChartConfig;
	[SerializeField] private bool applyAlgebraChartConfigOnStart = true;
	[SerializeField] private bool configureChartSystemOnStart = true;
	[SerializeField] private bool forceBeatModeFromNotes = true;
	[SerializeField] private bool overrideChartPathOnStart = true;
	[SerializeField] private string chartPathOverride = "Charts/Grafix - Feel Alive Chart File.chart";
	[SerializeField, Tooltip("When enabled, auto-selects beat schedule mode based on chart density + SyncTrack availability.")]
	private bool autoBeatModeFromChart = false;
	[SerializeField, Range(0.1f, 10f), Tooltip("Notes-per-second threshold that triggers SyncTrack beat scheduling.")]
	private float autoBeatModeNotesPerSecondThreshold = 2.5f;

	[Header("External State Sync")]
	[SerializeField, Tooltip("If enabled, the bubble equation UI follows EquationChoiceSystem.OnStateChanged for runtime state sync.")]
	private bool syncFromChoiceSystem = true;

	[Header("Journey (Chart Guided)")]
	[SerializeField, Tooltip("When enabled, keeps a wisp/path running even before the player starts dragging, and gently suggests the next valid move.")]
	private bool enableJourneyGuidance = true;
	[SerializeField, Tooltip("If enabled, the wisp path runs while idle (before drag starts).")]
	private bool journeyShowWispWhileIdle = true;
	[SerializeField, Tooltip("If enabled, the wisp re-schedules itself to the next note/beat when it reaches the end while idle.")]
	private bool journeyLoopWispWhileIdle = true;
	[SerializeField, Min(0f)] private float journeyRescheduleDelaySeconds = 0.05f;
	[SerializeField] private bool journeyHighlightSuggestedBubble = true;
	[SerializeField, Tooltip("If enabled, chart lanes influence which valid move gets suggested (useful when multiple moves are possible).")]
	private bool journeyUseChartLaneForSuggestion = true;
	private enum AlgebraSuggestionSemantic
	{
		Any = 0,
		PreferConstantMove = 1,
		PreferVariableMove = 2,
		PreferDivide = 3,
		PreferFlipSign = 4,
	}

	[SerializeField] private AlgebraSuggestionSemantic lane0Semantic = AlgebraSuggestionSemantic.PreferConstantMove;
	[SerializeField] private AlgebraSuggestionSemantic lane1Semantic = AlgebraSuggestionSemantic.PreferConstantMove;
	[SerializeField] private AlgebraSuggestionSemantic lane2Semantic = AlgebraSuggestionSemantic.PreferVariableMove;
	[SerializeField] private AlgebraSuggestionSemantic lane3Semantic = AlgebraSuggestionSemantic.PreferDivide;
	[SerializeField] private AlgebraSuggestionSemantic lane4Semantic = AlgebraSuggestionSemantic.PreferFlipSign;
	[SerializeField, Tooltip("Fades visual guidance over repeated exposures to the same source->target pair instead of keeping the full path visible forever.")]
	private bool journeyAdaptiveGuidanceScaffoldingEnabled = true;
	[SerializeField, Tooltip("If enabled, only the first exposure to a source->target pair shows the full path. Later exposures keep the moving target but hide the path body until repeated misses restore it.")]
	private bool journeyFirstExposurePathOnlyMode = false;
	[SerializeField, Range(0.08f, 1f), Tooltip("Alpha multiplier used for the path in the dimmed guidance stage.")]
	private float journeyDimmedPathAlphaMultiplier = 0.34f;
	[SerializeField, Min(1), Tooltip("Successful drags on the same pair before the system hides the path body and leaves only the moving target.")]
	private int journeySuccessesBeforeTargetOnly = 1;
	[SerializeField, Min(1), Tooltip("Consecutive misses on the same pair before the full path is restored.")]
	private int journeyMissesToRestoreFullPath = 2;

	[Header("Bubble System Prefabs")]
	[SerializeField] private GameObject bubbleElementPrefab;
	[SerializeField] private GameObject lockedInEquationPrefab;
	[SerializeField] private Sprite circleSprite;
	[SerializeField] private Sprite lockSprite;

	[Header("Background Visual Overrides (Optional)")]
	[SerializeField] private bool applySceneBackgroundOverrides = false;
	[SerializeField] private bool autoFindSceneBackgroundReferences = true;
	[SerializeField] private Image sceneBackgroundImage;
	[SerializeField] private Camera sceneBackgroundCamera;
	[SerializeField] private TranslucentImage sceneFullscreenBackgroundOverlay;
	[SerializeField] private Color sceneBackgroundColor = new Color(25f / 255f, 25f / 255f, 25f / 255f, 1f);
	[SerializeField] private bool clearSceneBackgroundSprite = true;
	[SerializeField, Tooltip("Disables the fullscreen translucent layer. Leave off if your background uses a subtle glass TranslucentImage.")]
	private bool disableFullscreenBackgroundOverlay = false;
	[SerializeField, Tooltip("If the auto-bound overlay is the same object as the background image, keep it enabled so the scene doesn't lose the background.")]
	private bool keepSharedTranslucentBackgroundEnabled = true;
	[SerializeField, Tooltip("Apply subtle glass tuning to the fullscreen TranslucentImage background.")]
	private bool tuneSceneBackgroundTranslucentImage = true;
	[SerializeField, Tooltip("Use a separate tint for the translucent glass layer instead of reusing the camera/base background color.")]
	private bool useSeparateTranslucentBackgroundTint = true;
	[SerializeField] private Color sceneBackgroundTranslucentTint = new Color(30f / 255f, 30f / 255f, 30f / 255f, 1f);
	[SerializeField, Tooltip("Force the fullscreen background image onto a lower nested canvas so wisp path visuals can sit above it while bubbles/popups remain above the path.")]
	private bool forceBackgroundImageBehindGameplayCanvas = true;
	[SerializeField, Range(-50, -1), Tooltip("Nested background canvas sorting offset relative to the main gameplay canvas.")]
	private int sceneBackgroundCanvasSortingOffset = -1;
	[SerializeField, Range(0f, 1f), Tooltip("TranslucentImage foreground opacity for the background glass effect (try 0.03 - 0.12).")]
	private float sceneBackgroundTranslucentForegroundOpacity = 0.07f;
	[SerializeField, Range(-1f, 1f), Tooltip("TranslucentImage brightness. -1 is very dark; use near 0 for subtle glass.")]
	private float sceneBackgroundTranslucentBrightness = 0f;
	[SerializeField, Range(0f, 2f), Tooltip("TranslucentImage vibrancy/saturation. 1 is neutral.")]
	private float sceneBackgroundTranslucentVibrancy = 1f;
	[SerializeField, Range(0f, 1f), Tooltip("TranslucentImage flatten/contrast stabilization. Keep low for a sleek subtle effect.")]
	private float sceneBackgroundTranslucentFlatten = 0.06f;

	[Header("Equation Rhythm Motion")]
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion")]
	[SerializeField, Tooltip("Move the gameplay equation between repeated drags so the player re-tracks it across the playfield (Figma loop behavior).")]
	private bool moveEquationBetweenRepeats = true;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Tooltip("Only apply motion when the same equation is repeated multiple times before a step commits.")]
	private bool moveEquationOnlyDuringRepeatSteps = true;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Min(0f)] private float equationRepeatMoveRadiusX = 340f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Min(0f)] private float equationRepeatMoveRadiusY = 170f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField] private Vector2 equationRepeatMoveCenterOffset = Vector2.zero;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Tooltip("Bias applied to repeat-motion row placement. Negative Y moves gameplay equation lower for more path headroom.")]
	private Vector2 equationRepeatMotionBaselineOffset = new Vector2(0f, -26f);
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion")]
	[SerializeField, Tooltip("When enabled, move the equation row into the opposite vertical band of the provisional path hemisphere before the path window is rendered.")]
	private bool equationFollowPathHemisphere = true;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion")]
	[SerializeField, Min(0f), Tooltip("Extra clearance from the top safe band when the provisional path bends downward and the row moves upward.")]
	private float equationPathTopInset = 72f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion")]
	[SerializeField, Min(0f), Tooltip("Extra clearance from the bottom safe band when the provisional path bends upward and the row moves downward.")]
	private float equationPathBottomInset = 72f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Min(0f), Tooltip("Extra vertical gap kept below locked/reference UI while clamping repeat-motion row movement.")]
	private float equationRepeatReferenceExtraGap = 56f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField, Min(0.01f)] private float equationRepeatMoveSeconds = 0.24f;
	[FoldoutGroup("Layout"), FoldoutGroup("Layout/Equation Repeat Motion"), ShowIf(nameof(moveEquationBetweenRepeats))]
	[SerializeField] private Ease equationRepeatMoveEase = Ease.OutCubic;

	[Header("Bubble Settings")]
	[SerializeField] private float bubbleSize = 100f;
	[SerializeField] private float operatorSize = 50f;
	[SerializeField] private float bubbleSpacing = 20f;
	[SerializeField] private bool variableHasBubble = true;
	[SerializeField, Range(0.7f, 1.2f)] private float variableBubbleScale = 1f;
	[SerializeField, Tooltip("How multi-digit numeric constants are rendered. Coefficient + variable terms remain split by token (e.g. 2 and x).")]
	private MultiDigitRenderMode multiDigitRenderMode = MultiDigitRenderMode.SingleBubble;
	[SerializeField, Range(0f, 0.5f)] private float doubleDigitInnerSpacingRatio = 0.28f;
	[SerializeField, Range(0.7f, 1f)] private float digitBubbleScale = 0.92f; // for multi-digit visuals
	[SerializeField, Range(-16f, 16f), Tooltip("Optional vertical nudge for text inside gameplay equation bubbles.")]
	private float bubbleTextVerticalOffset = 0f;
	[SerializeField] private bool autoSizeBubbles = true;
	[SerializeField, Range(0.35f, 0.85f)] private float autoSizeHeightRatio = 0.48f;
	[SerializeField] private float bubbleSizeMin = 88f;
	[SerializeField] private float bubbleSizeMax = 136f;
	[SerializeField] private float bubbleSpacingRatio = 0.24f;
	[SerializeField] private float operatorSizeRatio = 0.38f;
	[SerializeField, Tooltip("Keeps equation token sizing fixed after the first runtime auto-size pass so gameplay does not visually jump.")]
	private bool keepBubbleSizingStablePerSession = true;
	[SerializeField, Tooltip("If enabled, a layout/resolution change unlocks sizing and recalculates it once.")]
	private bool refreshStableSizingWhenLayoutChanges = false;
	[SerializeField, Range(0.05f, 1f)] private float termAdjacencySpacingRatio = 0.35f; // spacing between coefficient and x bubbles
	[SerializeField] private Color bubbleBackgroundColor = new Color(0.1f, 0.1f, 0.1f, 0f);
	[SerializeField] private Color bubbleOutlineColor = AlgebraUiPalette.White50;
	[SerializeField] private Color bubbleDraggingOutline = AlgebraUiPalette.AccentPurple;
	[SerializeField] private Color variableColor = AlgebraUiPalette.White;
	[SerializeField] private Color numberColor = AlgebraUiPalette.White;
	[SerializeField] private Color operatorColor = AlgebraUiPalette.White;
	[SerializeField] private Color algebraTermOutlineTint = AlgebraUiPalette.AccentPurple; // subtle indicator for term bubbles (coeff + x)
	[SerializeField, Range(0.5f, 1f)] private float termBuddyVariableScale = 0.8f; // x bubble is smaller when paired with a coefficient
	[SerializeField, Tooltip("Allow coefficient-variable terms like 6x to visually split apart while dragging the coefficient. Disable to keep the equation row visually intact.")]
	private bool splitCombinedTermsWhileDragging = false;

	[Header("Bubble Fill (Glass)")]
	[SerializeField, Range(0f, 1f)] private float bubbleFillIdleAlpha = 0.14f;
	[SerializeField, Range(0f, 1f)] private float bubbleFillHoverAlpha = 0.20f;
	[SerializeField, Range(0f, 1f)] private float bubbleFillDragAlpha = 0.28f;

	[Header("Variable Bubble FX")]
	[SerializeField] private bool useVariableBubbleFx = false;
	[SerializeField] private string variableBubbleEffectTags = "wiggle";

	[Header("Variable Idle Pulse (Subtle)")]
	[SerializeField] private bool pulseVariableBubbles = true;
	[SerializeField, Range(0f, 0.35f)] private float variablePulseWhitenStrength = 0.18f;
	[SerializeField, Min(0.15f)] private float variablePulseSeconds = 0.9f;

	[Header("Symbol Safety")]
	[SerializeField] private bool useSafeMathGlyphs = true;
	[SerializeField] private MathSymbolMode mathSymbolMode = MathSymbolMode.SmartFallback;
	[SerializeField] private string safeMultiplySymbol = "*";
	[SerializeField] private string safeDivideSymbol = "/";

	[Header("Trail Settings")]
	[SerializeField] private int trailPointCount = 20;
	[SerializeField] private float trailWidth = 40f;
	[SerializeField] private Gradient trailGradient;
	[SerializeField, Min(0f), Tooltip("Minimum pointer movement (UI pixels) required before adding a new trail sample.")]
	private float trailSampleMinDistance = 3f;
	[SerializeField, Min(0.1f), Tooltip("How fast stale trail points collapse toward the cursor while the player holds still.")]
	private float trailCatchUpPointsPerSecond = 32f;
	[SerializeField, Min(1f), Tooltip("Drag speed (UI px/s) mapped to 0 for trail/ghost speed-reactive visuals.")]
	private float dragTrailSpeedMinPixelsPerSecond = 120f;
	[SerializeField, Min(1f), Tooltip("Drag speed (UI px/s) mapped to 1 for trail/ghost speed-reactive visuals.")]
	private float dragTrailSpeedMaxPixelsPerSecond = 1800f;
	[SerializeField, Range(0f, 1f), Tooltip("Fast drags sample the trail more densely; slow drags sample more sparsely.")]
	private float trailSampleDistanceSpeedResponse = 0.65f;
	[SerializeField, Range(0f, 1f)] private float trailWidthSpeedResponse = 0.35f;
	[SerializeField, Range(0f, 1f)] private float trailAlphaSpeedResponse = 0.55f;

	[Header("Bubble Animation Settings")]
	[SerializeField] private float moveToProgressBarDuration = 0.8f;
	[SerializeField] private float dropAnimationDuration = 0.4f;
	[SerializeField] private float signFlipDuration = 0.3f;
	[SerializeField] private Vector2 moveToTopDurationMultiplierRange = new Vector2(0.85f, 1.25f);
	[SerializeField, Min(0f)] private float moveToTopStaggerSeconds = 0.03f;
	[SerializeField] private Vector2 moveToTopRiseJitterRange = new Vector2(-12f, 12f);

	[Header("Drop Zone Settings")]
	[SerializeField] private float dropZoneRadius = 60f;
	[SerializeField] private float dropZoneOffset = 150f; // Distance from last element
	[SerializeField] private Color dropZoneValidColor = new Color(AlgebraUiPalette.JudgementGreen.r, AlgebraUiPalette.JudgementGreen.g, AlgebraUiPalette.JudgementGreen.b, 0.85f);
	[SerializeField] private Color dropZoneInvalidColor = new Color(AlgebraUiPalette.JudgementRed.r, AlgebraUiPalette.JudgementRed.g, AlgebraUiPalette.JudgementRed.b, 0.55f);
	[SerializeField, Range(0f, 1f)] private float dropZoneIdleFillAlpha = 0.08f;
	[SerializeField, Range(0f, 1f)] private float dropZoneDragFillAlpha = 0.2f;
	[SerializeField, Range(0f, 1f)] private float dropZoneNearFillAlpha = 0.32f;
	[SerializeField, Range(0f, 1f)] private float dropZoneFillThemeBlend = 0.3f;
	[SerializeField, Range(0f, 1f)] private float dropZoneNearFillThemeBlend = 0.45f;
	[SerializeField, Range(0f, 1f)] private float dropZoneOutlineThemeBlend = 0.52f;
	[SerializeField, Range(0f, 1f)] private float dropZoneNearOutlineThemeBlend = 0.8f;
	[SerializeField, Range(0f, 1f)] private float dropZoneOutlineMinAlpha = 0.4f;
	[SerializeField, Range(0f, 1f)] private float dropZoneNearOutlineMinAlpha = 0.72f;
	[SerializeField, Range(0f, 0.5f)] private float dropZoneOutlineHighlightLift = 0.2f;
	[SerializeField] private bool enableBidirectionalDropZones = false;

	[Header("Operation Symbol Settings")]
	[SerializeField] private float operationSymbolSize = 60f;
	[SerializeField] private Color operationSymbolColor = AlgebraUiPalette.JudgementYellow;
	[SerializeField] private float operationSymbolYOffset = 0f;

	[Header("Operator Following Offsets")]
	[SerializeField, Tooltip("Detach the adjacent operator and make it follow the dragged bubble. Disable to keep the equation row visually intact during drag.")]
	private bool followOperatorDuringDrag = false;
	[SerializeField, Min(0f)] private float operatorFollowLeftOffsetMultiplier = 1.35f; // operatorSize multiplier
	[SerializeField] private float operatorFollowExtraOffsetX = 14f; // extra spacing so operator isn't too close to bubble
	[SerializeField] private float operatorFollowYOffset = 0f;

	[Header("Drag Preview (Instead of Drop Circles)")]
	[SerializeField] private bool useDragPreviewInsteadOfDropCircles = true;
	[SerializeField, Range(0f, 1f)] private float dragPreviewAlpha = 0.95f;
	[SerializeField] private Color dragPreviewOutlineColor = AlgebraUiPalette.AccentPurple;
	[SerializeField] private Color dragPreviewOperatorColor = AlgebraUiPalette.White;
	[SerializeField, Min(0f)] private float dragPreviewFadeSeconds = 0.12f;
	[SerializeField, Range(4, 32)] private int dragGhostCount = 14;
	[SerializeField, Range(0.4f, 1f)] private float dragGhostMinScale = 0.62f;
	[SerializeField, Range(0.7f, 1.3f)] private float dragGhostMaxScale = 1.02f;
	[SerializeField, Range(0f, 1f)] private float dragGhostMinAlpha = 0.05f;
	[SerializeField, Range(0f, 1f)] private float dragGhostMaxAlpha = 0.85f;
	[SerializeField, Min(0f)] private float dragGhostPulseScale = 0.02f;
	[SerializeField, Range(0f, 1f), Tooltip("Reduces ghost smear when dragging slowly; fast drags restore full intensity.")]
	private float dragGhostSlowAlphaDampen = 0.5f;
	[SerializeField, Range(0f, 1f), Tooltip("How much the ghost stack stretches out along the trail at high speed.")]
	private float dragGhostSpeedStretch = 0.65f;

	[Header("Active Drag Ring")]
	[SerializeField] private bool showActiveDragApproachRing = true;
	[SerializeField] private Color activeDragApproachRingColor = AlgebraUiPalette.AccentPurple;
	[SerializeField, Range(1f, 1.6f)] private float activeDragApproachRingIdleScale = 1.06f;
	[SerializeField, Range(1f, 2.1f)] private float activeDragApproachRingFastScale = 1.18f;
	[SerializeField, Range(0f, 1f)] private float activeDragApproachRingBaseAlpha = 0.82f;
	[SerializeField, Range(0.5f, 6f)] private float activeDragApproachRingPulseHz = 2.2f;
	[SerializeField, Range(0f, 1f)] private float activeDragApproachRingPulseDepth = 0.18f;
	[SerializeField, Range(0.01f, 0.12f)] private float activeDragApproachRingThicknessRatio = 0.045f;

	[Header("Algebra Approach Rings")]
	[SerializeField, Min(1f), Tooltip("Shared multiplier applied to algebra source/target approach-ring start scales without changing their timing windows.")]
	private float algebraApproachRingScaleMultiplier = 3.25f;

	[Header("Source Bubble Approach Ring")]
	[SerializeField, Tooltip("Shows an osu-style inward approach ring on the source bubble before the player starts dragging.")]
	private bool showSourceBubbleApproachRing = true;
	[SerializeField] private Color sourceBubbleApproachRingColor = AlgebraUiPalette.AccentPurple;
	[SerializeField, Range(1f, 2.6f)] private float sourceBubbleApproachRingStartScale = 1.6f;
	[SerializeField, Range(0f, 1f)] private float sourceBubbleApproachRingBaseAlpha = 0.72f;
	[SerializeField, Range(0.01f, 0.12f)] private float sourceBubbleApproachRingThicknessRatio = 0.04f;
	[SerializeField, Range(0f, 1f), Tooltip("How much the source approach ring fades as it closes in on the bubble.")]
	private float sourceBubbleApproachRingFadeNearHit = 0.35f;

	[Header("Drop Zone Emphasis (During Drag)")]
	[SerializeField, Range(1f, 1.35f)] private float dropZoneDragPulseScale = 1.12f;
	[SerializeField, Min(0.05f)] private float dropZoneDragPulseSeconds = 0.55f;
	[SerializeField, Range(0f, 1f)] private float dropZoneDragMinAlpha = 0.9f;

	[Header("Assist")]
	[SerializeField] private bool preventWrongMoves = false;
	[SerializeField] private bool restrictToOptimalMoves = false;

	[Header("Step Repetition")]
	[SerializeField] private int dragsPerStep = 5; // Number of times to drag before moving to next step
	[SerializeField, Tooltip("When enabled, the repetitions required for the current step are derived from the optimal operation using operation-specific rules instead of always using the fixed fallback count.")]
	private bool deriveStepRepetitionsFromOptimalTarget = true;
	[SerializeField, Min(1), Tooltip("Minimum repetitions when deriving from the optimal operation.")]
	private int derivedStepRepetitionMin = 1;
	[SerializeField, Min(1), Tooltip("Maximum repetitions when deriving from the optimal operation.")]
	private int derivedStepRepetitionMax = 5;
	[SerializeField, Min(1), Tooltip("Fallback repetition count for special operations that should stay short and readable (for example expand, combine-like-terms, substitute).")]
	private int derivedSpecialOperationRepetitions = 2;

	[Header("Drag Settings")]
	[SerializeField] private float snapBackDuration = 0.3f;
	[SerializeField, Tooltip("Close the gap left behind while dragging. Runtime keeps this off in canonical placeholder-arc mode to avoid path/template misalignment.")]
	private bool compactEquationLayoutWhileDragging = false;
	[SerializeField, Min(0f), Tooltip("Tween duration for drag-time equation compaction/restore.")]
	private float dragEquationCompactionTweenSeconds = 0.12f;
	[SerializeField, Tooltip("Leave a dim ghost at the bubble's origin instead of compacting the row while dragging.")]
	private bool leaveOriginGhostWhileDragging = true;
	[SerializeField, Range(0f, 1f)] private float dragOriginGhostAlpha = 0.28f;
	[SerializeField, Range(0.85f, 1.15f)] private float dragOriginGhostScale = 1f;
	[SerializeField, Min(0f)] private float dragOriginGhostFadeSeconds = 0.12f;

	[Header("Contextual Guidance")]
	[SerializeField] private bool contextualGuidanceEnabled = true;
	[SerializeField, Min(1)] private int contextualGuidanceMissThreshold = 2;
	[SerializeField, Min(1)] private int contextualGuidanceSuccessStreakToHide = 2;
	[SerializeField] private string contextualGuidanceFirstDragMessage = "Stay on the glowing path to score higher.";
	[SerializeField] private string contextualGuidanceMissMessage = "Try releasing in the green window. Tap ? How to for a quick refresher.";
	[SerializeField] private string contextualGuidanceHelpMessage = "Follow the glowing path and release in the green zone for better timing.";
	[SerializeField] private string contextualGuidanceEarlyMissMessage = "A bit early. Let the wisp travel farther before release.";
	[SerializeField] private string contextualGuidanceLateMissMessage = "A bit late. Release sooner as the wisp enters green.";
	[SerializeField] private string contextualGuidancePathMissMessage = "Stay closer to the moving target before releasing.";
	[SerializeField, Tooltip("Optional: CleanFlatUI tooltip instance (ex: TooltipSpecialRound) used for contextual hints instead of reusing the feedback chip.")]
	private TooltipSpecial contextualGuidanceTooltipUI;
	[SerializeField, Tooltip("Optional: if contextualGuidanceTooltipUI is not set, instantiate this prefab on demand (assign TooltipSpecialRound here).")]
	private TooltipSpecial contextualGuidanceTooltipPrefab;
	[SerializeField, Tooltip("Position offset from the contextual hint anchor (feedback chip top-center, or a fallback UI anchor).")]
	private Vector2 contextualGuidanceTooltipOffset = new Vector2(0f, 72f);
	[SerializeField, Min(0f), Tooltip("Auto-hide delay for contextual tooltip hints. Set to 0 to keep visible until replaced/hidden.")]
	private float contextualGuidanceTooltipAutoHideSeconds = 2.2f;
	[SerializeField, Range(0.1f, 0.9f)] private float contextualGuidancePathMissCompletionThreshold = 0.45f;
	[SerializeField] private Button contextualGuidanceHelpButton;
	[SerializeField] private string contextualGuidanceHelpButtonName = "? How to";
	[SerializeField] private bool autoBindContextualGuidanceHelpButton = true;
	[SerializeField] private bool contextualGuidanceAutoTutorialOverlayEnabled = true;
	[SerializeField, Min(1)] private int contextualGuidanceAutoTutorialMissThreshold = 3;
	[SerializeField] private bool contextualGuidanceAutoTutorialOncePerSession = true;
	[SerializeField] private AlgebraTutorialGate algebraTutorialGate;

	// Events
	public enum DragMissReason
	{
		None = 0,
		Early = 1,
		Late = 2,
		OffPath = 3,
		InvalidOperation = 4,
		DroppedOffTarget = 5
	}

	[Serializable]
	public struct DragAttemptTelemetry
	{
		public HitResult hitResult;
		public DragMissReason missReason;
		public bool droppedOnTarget;
		public bool success;
		public float signedErrorMs;
		public float pathCompletion01;
		public float peakGuidedProgress01;
		public float normalizedToMiss;
		public float scoreContribution01;
		public JourneyGuidanceMode journeyGuidanceMode;
		public EquationSkillTag skillTag;
		public int repetitionIndex;
	}

	public event Action OnDragOperationComplete;
	public event Action<int> OnSuccessCountChanged;
	public event Action<EquationState> OnEquationUpdated;
	public event Action OnEquationSolved;
	public event Action<DragAttemptTelemetry> DragAttemptEvaluated;
	public event Action<string> ContextualHintShown;

	// Runtime state
	private int successCount = 0;
	private int stepsRequiredForEquation = 1;
	private int stepsCompletedForEquation = 0;
	private int currentStepRequiredDrags = 0;
	private bool isActive = false;

	// Bubble system state
	private List<EquationBubbleElement> bubbleElements = new List<EquationBubbleElement>();
	private EquationBubbleElement currentDraggingElement;
	private EquationBubbleElement currentDropZone;
	private EquationBubbleElement leftDropZone;
	private EquationBubbleElement rightDropZone;
	private EquationState currentState;
	private EquationSkillTag currentEquationSkillTag = EquationSkillTag.Unknown;
	private bool isBubbleInitialized;
	private bool isBubbleAnimating;
	private bool equationAtTop;

	// Term visuals (coefficient + x grouping)
	private sealed class TermVisualGroup
	{
		public EquationBubbleElement coefficient;
		public EquationBubbleElement variable;
		public Vector3 variableSoloScale = Vector3.one;
		public Vector3 variableCombinedScale = Vector3.one;
		public bool isCombined;
	}

	private readonly List<TermVisualGroup> termVisualGroups = new List<TermVisualGroup>(8);
	private readonly Dictionary<EquationBubbleElement, TermVisualGroup> termGroupByCoefficient = new Dictionary<EquationBubbleElement, TermVisualGroup>(8);

	// Trail
	private RectTransform trailContainer;
	private List<Vector2> trailPoints = new List<Vector2>();
	private List<Image> trailImages = new List<Image>();
	private Vector2 lastTrailSamplePosition;
	private float trailCatchUpAccumulator;
	private Vector2 lastDragMotionSamplePosition;
	private float lastDragMotionSampleTime = -1f;
	private float dragSpeedUiPerSecond;
	private float dragSpeedUiPerSecondSmoothed;
	private float dragSpeedVisual01;

		// Drag-time equation compaction (visual-only layout)
	private bool dragEquationCompactionActive;
	private float dragEquationCompactionRestoreUntilUnscaledTime = float.NegativeInfinity;
	private float dragSnapBackRestoreUntilUnscaledTime = float.NegativeInfinity;
	private readonly List<EquationBubbleElement> dragEquationCompactionBubbles = new List<EquationBubbleElement>(16);
	private readonly List<Vector2> dragEquationCompactionBubblePositions = new List<Vector2>(16);
	private readonly List<RectTransform> dragEquationCompactionOperatorRects = new List<RectTransform>(16);
	private readonly List<Vector2> dragEquationCompactionOperatorPositions = new List<Vector2>(16);

	// Wisp path system
	private RectTransform wispPathContainer;
	private RectTransform wispFrontVisualContainer;
	private List<Image> wispPathImages = new List<Image>();
	private Image wispIndicator;
	private RectTransform wispRect;
	private Image wispArcLeftArm;
	private List<Vector2> currentWispPath = new List<Vector2>();
	private WispPathStyle currentWispPathStyle = WispPathStyle.ArcUp;
	private WispPathUnitBucket currentWispPathUnitBucket = WispPathUnitBucket.None;
	private bool currentWispPathUnitFlipX;
	private bool currentWispPathUnitFlipY;
	private float currentWispPathResolvedUnitPitch;
	private float currentWispPathResolvedUnitDistance;
	private double[] wispBeatTimes;
	private Note[] wispBeatNotes;
	private Note[] wispCachedNotesRef;
	private int wispTargetBeatIndex = -1;
	private float wispProgress = 0f;
	private bool wispActive = false;
	private Coroutine wispCoroutine;
	private int beatCount = 0;
	private float lastWispBeatTime;
	private double wispStartSongTime;
	private double wispEndSongTime;
	private double wispExpectedDropSongTime;
	private int wispRuntimeTravelSteps = 1;
	private float cachedBeatSeconds = 0.5f;
	private bool wispTimingPrepared;
	private bool wispHasTimingContext;
	private double wispLateHoldGraceUntilSongTime = double.NegativeInfinity;
	private double wispClockLastRealtime = double.NaN;
	private double wispClockLastRawSongTime = double.NaN;
	private double wispClockLastResolvedSongTime = double.NaN;
	private double wispClockStallElapsed;
	private bool wispClockUsingRealtimeFallback;
	private float wispGreenZoneStartRuntime;
	private float wispGreenZoneEndRuntime;
	private float wispPerfectZoneStartRuntime;
	private float wispNextBubbleZoneRefreshTime = -1f;
	private BeatPayload activeDragBeatPayload;
	private bool hasActiveDragBeatPayload;
	private int dragBeatSequenceCounter;

	// Operator following (now uses plain GameObjects, not EquationBubbleElements)
	private GameObject followingOperatorLabel;
	private RectTransform followingOperatorRect;
	private TextMeshProUGUI followingOperatorText;
	private Vector2 operatorOriginalPosition;
	private string operatorOriginalText;
	private bool isDynamicDivideOperator; // True if we created a divide symbol for coefficient dragging
	private int operatorOriginalSiblingIndex = -1;
	private Transform operatorOriginalParent;


	// Drag preview (duplicated bubbles near drop target)
	private GameObject dragPreviewRoot;
	private RectTransform dragPreviewRootRect;
	private readonly List<GameObject> dragPreviewDigitBubbles = new List<GameObject>(4);
	private readonly List<GameObject> dragGhostGroups = new List<GameObject>(24);
	private float dragGhostStartDistanceToTarget = 1f;
	private bool dragPreviewIsShowing;
	private GameObject dragOriginGhostObject;
	private RectTransform dragOriginGhostRect;
	private CanvasGroup dragOriginGhostCanvasGroup;
	private GameObject dragOriginGhostOperatorObject;
	private RectTransform dragOriginGhostOperatorRect;
	private CanvasGroup dragOriginGhostOperatorCanvasGroup;
	private bool dragOriginGhostPendingFade;
	private bool dropZonesEmphasized;
	private EquationBubbleElement sourceBubbleApproachRingOwner;
	private RectTransform sourceBubbleApproachRingRect;
	private Disc sourceBubbleApproachRingDisc;
	private EquationBubbleElement activeDragApproachRingOwner;
	private RectTransform activeDragApproachRingRect;
	private Disc activeDragApproachRingDisc;
	private Disc wispTargetApproachRingDisc;
	private RectTransform wispTargetApproachRingRect;
	private float wispTargetApproachRingPulseStartUnscaledTime = -1f;
	private float wispTargetApproachRingPulseEndUnscaledTime = -1f;
	private float wispTargetApproachRingPulseScaleMultiplier = 1f;
	private float wispTargetApproachRingPulseAlphaMultiplier = 1f;
	private ImpactFx algebraTargetImpactFxInstance;
	private bool algebraTargetImpactFxPreviewQueuedThisWindow;

	// Operation symbol display (divide shown at drop zone)
	private GameObject operationSymbolObject;
	private TextMeshProUGUI operationSymbolText;
	private RectTransform operationSymbolRect;

	// Journey / guidance state
	private EquationBubbleElement journeySuggestedElement;
	private EquationBubbleElement journeySuggestedDropZone;
	private Vector2 journeyWispStart;
	private Vector2 journeyWispEnd;
	private bool journeyNeedsRefresh;
	private bool journeyWispRestartPending;
	private bool rhythmClarityCalmMode;
	private bool rhythmClarityBaselineCaptured;
	private bool rhythmClarityBaselinePulseVariableBubbles;
	private bool rhythmClarityBaselineJourneyLoopWispWhileIdle;
	private bool rhythmClarityBaselineWispShowOnlyWhileDragging;
	private bool rhythmClarityBaselinePathwayAppearsWithHitZone;
	private int rhythmClarityBaselineContextualGuidanceMissThreshold;
	private bool tutorialGuidanceVisualOverride;
	private bool tutorialGuidanceBaselineCaptured;
	private bool tutorialGuidanceBaselineWispShowOnlyWhileDragging;
	private bool tutorialGuidanceBaselinePathwayAppearsWithHitZone;
	private bool tutorialGuidanceBaselineRenderBehindEquationBubbles;

	// Runtime safety + responsive auto-size tracking.
	private bool runtimeSettingsNormalized;
	private bool runtimeSettingsCorrectionLogged;
	private bool runtimeModeLockLogged;
	private int lastAutoSizeScreenWidth = -1;
	private int lastAutoSizeScreenHeight = -1;
	private Vector2 lastAutoSizeCanvasSize = new Vector2(-1f, -1f);
	private float lastAutoSizeRefreshTime = -10f;
	private bool hasStableBubbleSizing;
	private float stableBubbleSize;
	private float stableOperatorSize;
	private float stableBubbleSpacing;

	// Step repetition tracking
	private int currentStepDragCount = 0;
	private EquationState stepStartState; // The equation at the start of this step
	private int lockedPlaceholderVariantRepeatIndex = -1;
	private EquationPathHemisphere activeEquationPathHemisphere = EquationPathHemisphere.Neutral;
	private readonly Dictionary<string, JourneyGuidanceProgress> journeyGuidanceProgressByKey = new Dictionary<string, JourneyGuidanceProgress>(StringComparer.Ordinal);
	private string activeJourneyGuidanceKey = string.Empty;
	private JourneyGuidanceMode activeJourneyGuidanceMode = JourneyGuidanceMode.FullPath;
	private string currentDragJourneyGuidanceKey = string.Empty;
	private JourneyGuidanceMode currentDragJourneyGuidanceMode = JourneyGuidanceMode.FullPath;
	private float currentDragPeakGuidedProgress01 = 0f;
	private float currentDragPeakOverlapScore01 = 0f;

	/// When true, drag handlers ignore all bubble drag events (used by tutorial).
	public bool SuppressDragProcessing { get; set; }

	/// When true, UpdateJourneyGuidance() early-returns and hides the wisp path.
	/// Separate from SuppressDragProcessing so drag handlers can be suppressed
	/// while journey guidance is still visible (e.g. tutorial Step 3).
	public bool SuppressJourneyGuidance { get; set; }

	/// When true, blocks ALL external initialization paths (HandleChoiceSystemStateChanged,
	/// InitializeFromExternalState). Only explicit calls to InitializeWithEquation() are allowed.
	/// Set by EquationTutorialController to prevent gameplay from overlapping with the tutorial.
	public bool TutorialLock { get; set; }

	// Properties
	public bool IsAnimating => isBubbleAnimating;
	public bool IsBubbleDragging => currentDraggingElement != null && currentDraggingElement.IsDragging;
	public EquationState CurrentState => currentState;
	public RectTransform EquationContainer => equationContainer;
	public RectTransform WispPathContainer => wispPathContainer;
	public Canvas ParentCanvas => parentCanvas;
	public Camera UICamera => uiCamera;
	public int GetSuccessCount() => successCount;
	public bool IsActive => isActive;
	public bool IsDragging => IsBubbleDragging;
	public int DragsPerStep => GetCurrentRequiredDragsForStep();
	public float WispOverlapGoodMin => Mathf.Clamp01(wispOverlapResultGoodMin);
	public float WispOverlapPerfectMin => Mathf.Clamp01(wispOverlapResultPerfectMin);
	public bool IsRhythmClarityCalmMode => rhythmClarityCalmMode;
	public RectTransform ProgressMeterContainer => progressMeterContainer;
	public float BubbleTextVerticalOffset => bubbleTextVerticalOffset;

	public void SetAdaptiveDifficultySettings(int targetDragsPerStep, float targetGoodMin, float targetPerfectMin)
	{
		dragsPerStep = Mathf.Max(1, targetDragsPerStep);
		wispOverlapResultGoodMin = Mathf.Clamp01(targetGoodMin);
		wispOverlapResultPerfectMin = Mathf.Clamp01(Mathf.Max(targetPerfectMin, wispOverlapResultGoodMin + 0.05f));
		currentStepRequiredDrags = ResolveStepRequiredDragCount(currentState);
	}

	public void SetTutorialGuidanceVisualOverride(bool enabled)
	{
		if (tutorialGuidanceVisualOverride == enabled)
		{
			if (enabled)
			{
				RequestJourneyGuidanceRefresh();
			}
			return;
		}

		if (enabled && !tutorialGuidanceBaselineCaptured)
		{
			tutorialGuidanceBaselineCaptured = true;
			tutorialGuidanceBaselineWispShowOnlyWhileDragging = wispShowOnlyWhileDragging;
			tutorialGuidanceBaselinePathwayAppearsWithHitZone = pathwayAppearsWithHitZone;
			tutorialGuidanceBaselineRenderBehindEquationBubbles = wispRenderBehindEquationBubbles;
		}

		tutorialGuidanceVisualOverride = enabled;
		if (enabled)
		{
			wispShowOnlyWhileDragging = false;
			pathwayAppearsWithHitZone = true;
			// Preserve gameplay layering preference; this only controls path vs gameplay row tokens.
			// It does not control layering against the locked/reference equation HUD.
			wispRenderBehindEquationBubbles = tutorialGuidanceBaselineRenderBehindEquationBubbles;
			EnsureWispContainerOrder();
			RequestJourneyGuidanceRefresh();
			return;
		}

		if (tutorialGuidanceBaselineCaptured)
		{
			wispShowOnlyWhileDragging = tutorialGuidanceBaselineWispShowOnlyWhileDragging;
			pathwayAppearsWithHitZone = tutorialGuidanceBaselinePathwayAppearsWithHitZone;
			wispRenderBehindEquationBubbles = tutorialGuidanceBaselineRenderBehindEquationBubbles;
		}

		EnsureWispContainerOrder();
	}

	public void SetRhythmClarityCalmMode(bool enabled)
	{
		if (rhythmClarityCalmMode == enabled)
			return;

		if (!rhythmClarityBaselineCaptured)
		{
			rhythmClarityBaselineCaptured = true;
			rhythmClarityBaselinePulseVariableBubbles = pulseVariableBubbles;
			rhythmClarityBaselineJourneyLoopWispWhileIdle = journeyLoopWispWhileIdle;
			rhythmClarityBaselineWispShowOnlyWhileDragging = wispShowOnlyWhileDragging;
			rhythmClarityBaselinePathwayAppearsWithHitZone = pathwayAppearsWithHitZone;
			rhythmClarityBaselineContextualGuidanceMissThreshold = contextualGuidanceMissThreshold;
		}

		rhythmClarityCalmMode = enabled;
		if (enabled)
		{
			pulseVariableBubbles = false;
			journeyLoopWispWhileIdle = true;
			wispShowOnlyWhileDragging = false;
			pathwayAppearsWithHitZone = true;
			contextualGuidanceMissThreshold = 1;
			RequestJourneyGuidanceRefresh();
			return;
		}

		if (!rhythmClarityBaselineCaptured)
			return;

		pulseVariableBubbles = rhythmClarityBaselinePulseVariableBubbles;
		journeyLoopWispWhileIdle = rhythmClarityBaselineJourneyLoopWispWhileIdle;
		wispShowOnlyWhileDragging = rhythmClarityBaselineWispShowOnlyWhileDragging;
		pathwayAppearsWithHitZone = rhythmClarityBaselinePathwayAppearsWithHitZone;
		contextualGuidanceMissThreshold = Mathf.Max(1, rhythmClarityBaselineContextualGuidanceMissThreshold);
		RequestJourneyGuidanceRefresh();
	}

	#region Bubble System - Drag Handling

	private void ApplyBubbleOperation(EquationBubbleElement element, StepOption prevalidatedOperation = null)
	{
		BubbleOperationFlowService.Apply((IBubbleOperationFlowHost)this, element, prevalidatedOperation);
	}

	#endregion

}
