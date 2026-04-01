using UnityEngine;
using System.Globalization;
using System.Text;
using Shapes;
using Sirenix.OdinInspector;
using TMPro;
using DG.Tweening;
using System.Collections.Generic;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.EventSystems;
using Sirenix.Utilities;

// Translates gameplay hits into luminous perimeter glyphs – Who said spreadsheets can’t drip?
public class DiagramManager : MonoBehaviour, IHitZoneNotesGameplayMessage
{
	public static DiagramManager Instance;
	private static readonly Color glowFilledColor = new Color(0.769f, 1.013f, 0f, 1f);

	[InfoBox("Progress arcs glow like a Shibuya nightscape - tweak these colours and ask yourself? What would John Cena do?")]
	[FoldoutGroup("Colors")]
	[SerializeField] private Color outlineBaseColor = new Color(0.13f, 0.55f, 0.24f, 0.15f);
	[FoldoutGroup("Colors")]
	[SerializeField] private Color segmentFillColor = new Color(0.58f, 0.98f, 0.27f, 0.9f);
	[FoldoutGroup("Colors")]
	[SerializeField] private Color wispColor = new Color(1f, 0.97f, 0.25f, 1f);
	[FoldoutGroup("Colors")]
	[SerializeField] private Color previewColor = new Color(1f, 0.95f, 0.45f, 0.7f);
	[FoldoutGroup("Colors")]
	[SerializeField] private Color missColor = new Color(0.93f, 0.36f, 0.36f, 0.85f);

	public Color WispColor => wispColor;
	/// <summary>Current fill tint after the latest heat update (useful for binding other FX like the wisp glow).</summary>
	public Color CurrentHeatFillColor => EvaluateHeatFillColor();
	public Color PreviewColor => previewColor;
	public Color MissColor => missColor;
	public Color SegmentFillColor => segmentFillColor;

	[Header("Streak Heat Visuals")]
	[SerializeField, Tooltip("Blend the active perimeter fill toward warmer colors as the streak heats up.")]
	private bool tintFillByHeat = true;
	[SerializeField] private Color tier1Tint = new Color(1f, 0.82f, 0.35f, 1f);
	[SerializeField] private Color tier2Tint = new Color(1f, 0.58f, 0.25f, 1f);
	[SerializeField] private Color tier3Tint = new Color(1f, 0.35f, 0.18f, 1f);
	[SerializeField, Tooltip("Optional Shapes Disc used as an ambient heat haze over the diagram.")]
	private Disc streakHeatDisc;
	[SerializeField, Tooltip("If true, the streak heat disc uses its own colour set instead of matching the segment fill tint.")]
	private bool overrideStreakHeatDiscColor = false;
	[SerializeField, Tooltip("Base colour for the streak heat disc when no streak tier is active.")]
	private Color streakHeatDiscBaseColor = new Color(0.58f, 0.98f, 0.27f, 0.9f);
	[SerializeField, Tooltip("Disc tint while in streak tier 1 when overrideStreakHeatDiscColor is enabled.")]
	private Color streakHeatDiscTier1Color = new Color(1f, 0.82f, 0.35f, 1f);
	[SerializeField, Tooltip("Disc tint while in streak tier 2 when overrideStreakHeatDiscColor is enabled.")]
	private Color streakHeatDiscTier2Color = new Color(1f, 0.58f, 0.25f, 1f);
	[SerializeField, Tooltip("Disc tint while in streak tier 3 when overrideStreakHeatDiscColor is enabled.")]
	private Color streakHeatDiscTier3Color = new Color(1f, 0.35f, 0.18f, 1f);
	[SerializeField, Range(0f, 1f)] private float streakHeatDiscBaseAlpha = 0.12f;
	[SerializeField, Range(0f, 1f)] private float streakHeatDiscMaxAlpha = 0.55f;
	private Vector3 streakHeatDiscBaseScale = Vector3.one;
	private Tween _streakHeatDiscTween;
	[SerializeField, Tooltip("If true, perimeter outlines fade in only after the player has touched that segment.")]
	private bool hideOutlineUntilProgress = true;

	[Header("Beat Highlights")]
	[SerializeField] private WispTimelineController wispController;
	[SerializeField] private Color scheduledHighlightColor = new Color(1f, 1f, 1f, 0.65f);
	[SerializeField] private float highlightFadeDuration = 0.12f;
	[SerializeField] private float highlightHoldFraction = 0.6f;
	[SerializeField] private Color resolvedMissColor = new Color(0.9f, 0.35f, 0.35f, 0.9f);

	[Header("World Perimeter Segments")]
	[SerializeField] private Transform[] worldPerimeterSegments;
	[SerializeField] private PerimeterPathProvider path; // assign in Inspector
	float _anchorS;     // where the run started (distance along total length)
	float _progressS;   // how far we’ve filled since anchor (0..L]
	[SerializeField] private bool useGlobalFill = true; // Wisp mode wants a single ring
	[SerializeField, Tooltip("Draw per-segment progress overlays even when the global fill ring is active.")] private bool showSegmentProgressDuringGlobalFill = true;
	private float filledS; // distance along the ordered path

	[Header("Segment Completion")]
	[SerializeField, Range(0.1f, 1f), Tooltip("Fraction of the assigned note quota that must be hit before a segment is considered complete.")] private float segmentCompletionRequirement = 0.8f;
	/// <summary>Total required hits for all segments in the current shape (after difficulty/requirement scaling).</summary>
	public int CurrentShapeRequiredHitsTotal { get; private set; }

	[Header("Fill Animation")]
	[SerializeField, Tooltip("Animate per-segment fill on each successful input")] private bool animateSegmentFill = true;
	[SerializeField, Range(0.05f, 1.0f)] private float segmentFillTweenDuration = 0.22f;
	[SerializeField, Tooltip("Tween easing used when growing individual segment fills; try OutCubic or OutSine for a more liquid, swishing feel.")] private Ease segmentFillEase = Ease.OutCubic;
	[SerializeField, Tooltip("Curve controlling how much harder later shapes should be relative to earlier ones (0 = first shape, 1 = last).")] private AnimationCurve shapeDifficultyCurve = AnimationCurve.Linear(0f, 0.6f, 1f, 1.4f);

	public enum FillDirectionPreference { MatchWisp = 0, Clockwise = 1, CounterClockwise = 2 }

	[SerializeField, Tooltip("Smooth the continuous ring fill over time")] private bool animateGlobalFill = true;
	[SerializeField, Range(0.1f, 2.0f), Tooltip("Approx. seconds for a full-lap animation; actual step time scales by delta/L.")] private float globalFillSecondsPerLap = 0.8f;
	[SerializeField] private Ease globalFillEase = Ease.OutSine;
	[SerializeField] private FillDirectionPreference fillDirectionPreference = FillDirectionPreference.MatchWisp;
	[SerializeField, Tooltip("Lighten the fill color gradually as the continuous fill progresses")] private bool globalFillColorShift = true;
	[SerializeField, Range(0f, 1f), Tooltip("How much to shift toward white by the end of the lap")] private float globalFillWhiten = 0.25f;
	[SerializeField, Tooltip("Invert the direction used to draw the continuous fill to match the wisp if needed")] private bool invertGlobalFillDirection = false;

	[Header("Completion FX (Global Fill)")]
	[SerializeField, Tooltip("If empty, uses Distance Label Prefab")] private GameObject segmentCompleteBubblePrefab;
	[SerializeField, Range(0.05f, 1.0f)] private float bubbleScaleInSeconds = 0.18f;
	[SerializeField, Range(0.05f, 1.0f)] private float bubbleHoldSeconds = 0.25f;
	[SerializeField, Range(0.05f, 1.0f)] private float bubbleFadeOutSeconds = 0.18f;
	[SerializeField, Range(0f, 1f), Tooltip("Alpha to hold completion bubbles at once revealed.")] private float completionBubblePersistentAlpha = 0.75f;
	[SerializeField, Range(0.00f, 1.00f), Tooltip("Glow intensity on GOOD hits (0..1 toward white)")] private float goodGlow = 0.35f;
	[SerializeField, Range(0.00f, 1.00f), Tooltip("Glow intensity on PERFECT hits (0..1 toward white)")] private float perfectGlow = 0.55f;
	[SerializeField, Range(0.00f, 1.00f), Tooltip("Glow intensity when a small segment completes")] private float completionGlow = 0.45f;
	[SerializeField, Range(0.90f, 1.0f), Tooltip("Normalized fill (0..1) required before a segment is considered complete in global fill mode.")] private float globalCompletionThreshold = 0.995f;
	[SerializeField, Tooltip("Optional ImpactFx prefab used to celebrate segment completion in Wisp/global fill mode.")] private ImpactFx segmentCompletionFxPrefab;
	[SerializeField, Range(0.1f, 1.5f), Tooltip("Seconds before a spawned completion ImpactFx is recycled.")] private float segmentCompletionFxLifetime = 0.45f;
	[SerializeField, Min(0), Tooltip("Maximum number of ImpactFx instances kept in the completion pool.")] private int segmentCompletionFxPoolSize = 8;
	[SerializeField, Range(0f, 1f), Tooltip("Heat value forwarded to the completion ImpactFx.")] private float segmentCompletionFxHeat = 0.85f;
	[SerializeField, Tooltip("Override parent for completion ImpactFx (defaults to the Perimeter reference rect or diagram canvas).")] private Transform segmentCompletionFxParentOverride;
	[Header("Bubble Placement")]
	[SerializeField, Tooltip("Offset applied to completion bubbles so they sit just inside the perimeter.")] private float completionBubbleOffset = 12f;
	[SerializeField, Tooltip("If true, bubbles are nudged toward the centroid; otherwise they sit outward.")] private bool offsetBubblesTowardCentroid = true;

	private readonly Dictionary<string, float> _segmentFillT = new();
	private Tween _globalFillTween;
	private bool _globalClockwise = true;

	[System.Serializable]
	public struct PerimeterSegment
	{
		public string id; // e.g. "S4-S5"
		public string laneColor; // Green, Red, Yellow, Blue
		public ShapeRenderer shape; // Line or Disc component assigned via Inspector
		public string distanceLabel;    // e.g. "5 km"
		[Header("Optional offset override")]
		public float offsetOverride;   // Leave 0 for default logic
	}
	[System.Serializable]
	public class SegmentProgress
	{
		public string id;
		public string colorName;
		public int requiredHits;
		public int currentHits;
		public float completionPercent => (float)currentHits / requiredHits;
	}

	public struct SegmentProgressData
	{
		public string segmentId;
		public string colorName;
		public int currentHits;
		public int requiredHits;
		public float percent;
		public bool isComplete;
		public int pathIndex;
	}

	class CompletionBubbleInstance
	{
		public RectTransform Rect;
		public CanvasGroup Canvas;
		public GameObject GameObject => Rect ? Rect.gameObject : Canvas ? Canvas.gameObject : null;
	}

	public List<SegmentProgress> segments = new List<SegmentProgress>();
	[Header("Outline Layer")]
	[SerializeField] bool buildOutlineLayer = true;
	readonly Dictionary<string, ShapeRenderer> outlineById = new();



	[Header("Line & Disc Visuals")]
	public PerimeterSegment[] perimeterSegments;
	public TMP_Text progressText;
	[Header("Lane Matching")]
	[SerializeField, Tooltip("If true, hits from any lane color can advance perimeter segments for the active shape (ignores laneColor matching).")]
	private bool acceptAnyLaneHitsForCurrentShape = false;

	private Dictionary<string, int> colorSegmentIndex = new Dictionary<string, int>()
	{
	{ "Green", 0 }, { "Red", 0 }, { "Yellow", 0 }, { "Blue", 0 }, { "Orange", 0 }
	};

	private Dictionary<string, int> completedSegments = new Dictionary<string, int>()
	{
	{ "Green", 0 }, { "Red", 0 }, { "Yellow", 0 }, { "Blue", 0 }, { "Orange", 0 }
	};
	private Dictionary<string, float> prevPercent = new Dictionary<string, float>()
	{
	{ "Green", 0f },
	{ "Red", 0f },
	{ "Yellow", 0f },
	{ "Blue", 0f },
	{ "Orange", 0f }
	};

	// Store authored geometry
	private Dictionary<string, Vector3> segmentStartPositions = new Dictionary<string, Vector3>();
	private Dictionary<string, Vector3> segmentEndPositions = new Dictionary<string, Vector3>();
	private Dictionary<string, float> discStartAngles = new Dictionary<string, float>();
	private Dictionary<string, float> discEndAngles = new Dictionary<string, float>();
	private Dictionary<string, float> discFinalRadii = new Dictionary<string, float>();
	private readonly Dictionary<string, Color> baseSegmentColors = new Dictionary<string, Color>();
	private readonly Dictionary<string, Tween> highlightTweens = new Dictionary<string, Tween>();
	private readonly Dictionary<string, Vector3> baseScaleById = new Dictionary<string, Vector3>();
	private readonly Dictionary<string, float> baseThicknessById = new Dictionary<string, float>();
	private readonly Dictionary<string, float> coveredUById = new Dictionary<string, float>();
	private readonly Dictionary<string, SegmentProgress> segmentProgressById = new Dictionary<string, SegmentProgress>();
	private readonly Dictionary<string, int> pathIndexById = new Dictionary<string, int>();
	private readonly HashSet<string> completedSegmentIds = new HashSet<string>();
	private readonly HashSet<string> revealedSegments = new HashSet<string>();
	private readonly Dictionary<string, CompletionBubbleInstance> completionBubbleById = new();
	private readonly HashSet<string> spawnedBubbleSegments = new();
	private readonly Dictionary<string, float> segmentCoverageById = new();
	private bool hasRegisteredImpact = false;
	private int anchorSegmentIndex = -1;
	private const float coverageMergeThreshold = 0.01f;
	private ShapeFormulaRuntimeData _activeFormula = ShapeFormulaRuntimeData.Empty;

	private GameplayEventBus.StreakTier currentHeatTier = GameplayEventBus.StreakTier.None;
	private float currentHeatLevel = 0f;
	private readonly Queue<ImpactFx> completionFxPool = new();
	private readonly HashSet<ImpactFx> completionFxActive = new();
	private Transform completionFxPoolRoot;
	private Transform completionFxActiveRoot;
	private bool loggedMissingBubblePrefab = false;
	private float lastBroadcastProgressS = float.MinValue;
	private float lastBroadcastHeadT = float.MinValue;
	private int lastBroadcastHeadIndex = -1;
	private bool ShouldRenderSegmentOverlays => !useGlobalFill || showSegmentProgressDuringGlobalFill;

	[Header("Transition Settings")]

	public float delayBeforeSceneLoad = 5f;
	[SerializeField] private bool autoLoadQuestionOnComplete = false;

	private bool transitionStarted = false;

	[SerializeField] private GameObject distanceLabelPrefab; // single prefab used for all segment labels
	[SerializeField] private Transform uiCanvas; // parent canvas for spawned labels

	[Header("Label Offset Multipliers")]

	public float baseOffsetFactor = 0.15f;
	public float minOffset = 10f;
	public float maxOffset = 30;
	[Header("Label Preview Gizmos")]
	public bool showLabelGizmos = true;
	public Color gizmoColor = Color.cyan;
	public float gizmoSize = 0.2f;

	[Header("Other References")]
	[SerializeField] private GameObject noteBlockGameObject;

	// Scratch buffer used when pruning highlight tweens without allocating arrays.
	private readonly List<string> _tweenPruneBuffer = new List<string>();

	private void Awake()
	{
		Instance = this;
	}

	private void OnEnable()
	{
		ChartSystem.OnChartInitialized += HandleChartInitialized;
		GameplayEventBus.BeatScheduled += HandleBeatScheduled;
		GameplayEventBus.BeatResolved += HandleBeatResolved;
		GameplayEventBus.OnPerimeterShapeChanged += UpdateCurrentShapeSegments;
		GameplayEventBus.StreakTierChanged += HandleStreakTierChanged;
		GameplayEventBus.HeatChanged += HandleHeatChanged;
		ShapeFormulaRuntime.FormulaChanged += HandleShapeFormulaChanged;
		HandleShapeFormulaChanged(ShapeFormulaRuntime.Current);
	}

	private void OnDisable()
	{
		ChartSystem.OnChartInitialized -= HandleChartInitialized;
		GameplayEventBus.BeatScheduled -= HandleBeatScheduled;
		GameplayEventBus.BeatResolved -= HandleBeatResolved;
		GameplayEventBus.OnPerimeterShapeChanged -= UpdateCurrentShapeSegments;
		GameplayEventBus.StreakTierChanged -= HandleStreakTierChanged;
		GameplayEventBus.HeatChanged -= HandleHeatChanged;
		ShapeFormulaRuntime.FormulaChanged -= HandleShapeFormulaChanged;
		KillHighlightTweens();
		if (perimeterSegments != null)
		{
			foreach (var seg in perimeterSegments)
				SafeKillAndDisable(seg.shape);
		}
		ClearCompletionBubbles();
		CleanupCompletionFxRoots();
		if (_streakHeatDiscTween != null)
		{
			_streakHeatDiscTween.Kill();
			_streakHeatDiscTween = null;
			if (streakHeatDisc)
				streakHeatDisc.transform.localScale = streakHeatDiscBaseScale;
		}
	}

	private void OnDestroy()
	{
		ShapeFormulaRuntime.FormulaChanged -= HandleShapeFormulaChanged;
		ClearCompletionBubbles();
		CleanupCompletionFxRoots();
		if (_streakHeatDiscTween != null)
		{
			_streakHeatDiscTween.Kill();
			_streakHeatDiscTween = null;
		}
	}

	private void Start()
	{
		Initialize();
	}

	private void Initialize()
	{
		if (perimeterSegments.IsNullOrEmpty())
		{
			return;
		}
		if (streakHeatDisc)
			streakHeatDiscBaseScale = streakHeatDisc.transform.localScale;
		ValidatePerimeterSegments();

		// Reset progress data
		ClearCompletionBubbles();
		CleanupCompletionFxRoots();
		segments.Clear();
		segmentProgressById.Clear();
		completedSegmentIds.Clear();
		segmentCoverageById.Clear();
		transitionStarted = false;
		pathIndexById.Clear();
		completedSegments["Green"] = 0;
		completedSegments["Red"] = 0;
		completedSegments["Yellow"] = 0;
		completedSegments["Blue"] = 0;

		colorSegmentIndex["Green"] = 0;
		colorSegmentIndex["Red"] = 0;
		colorSegmentIndex["Yellow"] = 0;
		colorSegmentIndex["Blue"] = 0;

		segmentStartPositions.Clear();
		segmentEndPositions.Clear();
		discStartAngles.Clear();
		discEndAngles.Clear();
		discFinalRadii.Clear();
		baseSegmentColors.Clear();
		pathIndexById.Clear();
		completedSegmentIds.Clear();
		KillHighlightTweens();
		loggedMissingBubblePrefab = false;
		hasRegisteredImpact = false;
		anchorSegmentIndex = -1;
		filledS = 0f;

		// Cache authored geometry and show outline
		foreach (var seg in perimeterSegments)
		{
			if (seg.shape == null) continue;
			SafeKill(seg.shape);
			SafeKill(seg.shape.transform);

			if (seg.shape is Line line)
			{
				segmentStartPositions[seg.id] = line.Start;
				segmentEndPositions[seg.id] = line.End;

				line.enabled = true;
				// Use 2D billboarded geometry for UI stability, keep thickness in meters like before
				line.Geometry = LineGeometry.Billboard;
				line.ThicknessSpace = ThicknessSpace.Meters;
				line.Color = outlineBaseColor;
				baseSegmentColors[seg.id] = line.Color;
				// Default depth test; let render queue handle order
				line.ZTest = CompareFunction.LessEqual;
			}
			else if (seg.shape is Disc disc)
			{
				discStartAngles[seg.id] = disc.AngRadiansStart;
				discEndAngles[seg.id] = disc.AngRadiansEnd;
				discFinalRadii[seg.id] = disc.Radius;

				disc.enabled = true;
				disc.ThicknessSpace = ThicknessSpace.Meters;
				disc.Color = outlineBaseColor;
				baseSegmentColors[seg.id] = disc.Color;
				disc.ZTest = CompareFunction.LessEqual;
			}
		}
		if (path)
		{
			path.RebuildCache();
			RebuildPathIndexLookup();
		}
		if (buildOutlineLayer) BuildOutlineLayer();
		ResetOutlineVisibility();
		ResetGlobalFill(0f);   // show empty fill but keep baseline visible
		ApplyHeatTintImmediate();

		progressText.text = "0/" + perimeterSegments.Length + " SEGMENTS COMPLETED";

		if (_activeFormula.HasValues)
			ApplyFormulaValuesToSegments(_activeFormula);
	}

	void BuildOutlineLayer()
	{
		outlineById.Clear();

		foreach (var seg in perimeterSegments)
		{
			if (seg.shape == null) continue;

			// Clone the authored shape as a permanent outline
			var clone = Instantiate(seg.shape.gameObject, seg.shape.transform.parent);
			clone.name = seg.shape.name + "_Outline";
			clone.transform.SetSiblingIndex(0); // keep outline behind the fill
			var sr = clone.GetComponent<ShapeRenderer>();
			outlineById[seg.id] = sr;

			if (sr is Line ol)
			{
				ol.Color = outlineBaseColor;
				ol.Start = segmentStartPositions[seg.id];
				ol.End = segmentEndPositions[seg.id];
				ol.Geometry = LineGeometry.Billboard;
				ol.ThicknessSpace = ThicknessSpace.Meters;
				ol.ZTest = CompareFunction.LessEqual;
				ol.SortingOrder = -20; // outlines beneath fills/UI
			}
			else if (sr is Disc od)
			{
				od.Color = outlineBaseColor;
				od.AngRadiansStart = discStartAngles[seg.id];
				od.AngRadiansEnd = discEndAngles[seg.id];
				od.Radius = discFinalRadii[seg.id];
				od.ThicknessSpace = ThicknessSpace.Meters;
				od.ZTest = CompareFunction.LessEqual;
				od.SortingOrder = -20;
			}

			// Initialize the FILL shape to empty but visible color
			if (seg.shape is Line fl)
			{
				fl.Color = segmentFillColor;
				fl.Start = segmentStartPositions[seg.id];
				fl.End = segmentStartPositions[seg.id]; // zero length
				fl.Geometry = LineGeometry.Billboard;
				fl.ThicknessSpace = ThicknessSpace.Meters;
				fl.ZTest = CompareFunction.LessEqual;
				fl.SortingOrder = -10;
				if (!baseScaleById.ContainsKey(seg.id) && fl.transform)
					baseScaleById[seg.id] = fl.transform.localScale;
				if (!baseThicknessById.ContainsKey(seg.id)) baseThicknessById[seg.id] = fl.Thickness;
			}
			else if (seg.shape is Disc fd)
			{
				fd.Color = segmentFillColor;
				fd.AngRadiansStart = discStartAngles[seg.id];
				fd.AngRadiansEnd = discStartAngles[seg.id]; // zero arc
				fd.Radius = discFinalRadii[seg.id];
				fd.ThicknessSpace = ThicknessSpace.Meters;
				fd.ZTest = CompareFunction.LessEqual;
				fd.SortingOrder = -10;
				if (!baseScaleById.ContainsKey(seg.id) && fd.transform)
					baseScaleById[seg.id] = fd.transform.localScale;
				if (!baseThicknessById.ContainsKey(seg.id)) baseThicknessById[seg.id] = fd.Thickness;
			}
		}
	}

	private void UpdateCurrentShapeSegments(GameObject perimeterInstance)
	{
		if (perimeterInstance == null)
		{
			return;
		}

		PerimeterShape perimeterShape = perimeterInstance.GetComponent<PerimeterShape>();

		if (perimeterShape == null)
		{
			return;
		}

		PerimeterSegment[] shapeSegments = perimeterShape.GetPerimeterSegments();

		if (shapeSegments == null || shapeSegments.Length == 0)
		{
			return;
		}

		acceptAnyLaneHitsForCurrentShape = perimeterShape.AcceptAnyLaneHits;
		perimeterSegments = shapeSegments;
		Initialize();
		RebuildSegmentProgressRequirements();
	}

	void UpdateProgressUI()
	{
		int totalCompleted = GetTotalCompletedSegments();
		int declaredSegments = perimeterSegments != null ? perimeterSegments.Length : 0;
		int logicalSegments = segments != null ? segments.Count : 0;
		int maxSegments = Mathf.Max(declaredSegments, logicalSegments);

		progressText.text = $"{totalCompleted}/{Mathf.Max(0, maxSegments)} SEGMENTS COMPLETED";

		if (maxSegments > 0 && totalCompleted >= maxSegments)
		{
			Debug.Log("[DiagramManager] All segments complete - initiating transition.");
			HandleDiagramComplete();
		}
	}

	private void HandleStreakTierChanged(int streak, GameplayEventBus.StreakTier tier, float heat)
	{
		var previousTier = currentHeatTier;
		currentHeatTier = tier;
		currentHeatLevel = Mathf.Clamp01(heat);
		ApplyHeatTintImmediate();
		if (tier != GameplayEventBus.StreakTier.None && tier >= previousTier)
			PulseHeatDisc(currentHeatLevel);
		else if (tier == GameplayEventBus.StreakTier.None && streakHeatDisc)
			streakHeatDisc.transform.localScale = streakHeatDiscBaseScale;
	}

	private void HandleShapeFormulaChanged(ShapeFormulaRuntimeData data)
	{
		_activeFormula = data;
		if (!data.HasValues)
			return;

		ApplyFormulaValuesToSegments(data);
	}

	private void HandleHeatChanged(float heat)
	{
		currentHeatLevel = Mathf.Clamp01(heat);
		ApplyHeatTintImmediate();
	}

	void HandleBeatScheduled(BeatPayload payload)
	{
		if (!wispController || path == null || perimeterSegments == null || perimeterSegments.Length == 0)
			return;

		float t = wispController.GetNormalizedT(payload.DspTime);
		int segmentIndex = path.GetSegmentIndex(t);
		HighlightSegment(segmentIndex, payload.LeadInSeconds);
	}

	void HandleBeatResolved(BeatPayload payload, HitResult result)
	{
		if (!wispController || path == null || perimeterSegments == null || perimeterSegments.Length == 0)
			return;

		float t = wispController.GetNormalizedT(payload.DspTime);
		int segmentIndex = path.GetSegmentIndex(t);
		if (segmentIndex < 0 || segmentIndex >= perimeterSegments.Length) return;

		var seg = perimeterSegments[segmentIndex];
		if (seg.shape == null) return;

		if (highlightTweens.TryGetValue(seg.id, out var tween) && tween != null)
		{
			tween.Kill(false);
			highlightTweens.Remove(seg.id);
		}

		if (!baseSegmentColors.TryGetValue(seg.id, out var baseColor))
			baseColor = outlineBaseColor;

		if (result == HitResult.Miss)
		{
			var seq = DOTween.Sequence()
				.SetTarget(seg.shape)
				.SetUpdate(true)
				.Append(DOTween.To(() => seg.shape.Color, c => seg.shape.Color = c, resolvedMissColor, highlightFadeDuration)
					.SetEase(Ease.OutQuad))
				.AppendInterval(0.1f)
				.Append(DOTween.To(() => seg.shape.Color, c => seg.shape.Color = c, baseColor, highlightFadeDuration)
					.SetEase(Ease.InQuad));
			string missKey = seg.id;
			highlightTweens[missKey] = seq;
			seq.OnKill(() =>
			{
				if (highlightTweens.TryGetValue(missKey, out var current) && current == seq)
					highlightTweens.Remove(missKey);
			});
		}
		else
		{
			DOTween.To(() => seg.shape.Color, c => seg.shape.Color = c, baseColor, highlightFadeDuration * 0.6f)
				.SetEase(Ease.InQuad)
				.SetTarget(seg.shape)
				.SetUpdate(true);
		}
	}

	void HighlightSegment(int segmentIndex, float leadInSeconds)
	{
		if (segmentIndex < 0 || perimeterSegments == null || segmentIndex >= perimeterSegments.Length)
			return;

		var seg = perimeterSegments[segmentIndex];
		if (seg.shape == null) return;

		if (!baseSegmentColors.TryGetValue(seg.id, out var baseColor))
			baseColor = outlineBaseColor;

		if (highlightTweens.TryGetValue(seg.id, out var tween) && tween != null)
		{
			// Kill safely (don’t modify DOTween lists while updating)
			DOTween.Kill(tween, complete: false);
			highlightTweens.Remove(seg.id);
		}

		float holdSeconds = Mathf.Max(0.02f, leadInSeconds * highlightHoldFraction);

		var seq = DOTween.Sequence()
			.SetTarget(seg.shape)
			.SetUpdate(true)
			.Append(DOTween.To(() => seg.shape.Color, c => seg.shape.Color = c, scheduledHighlightColor, highlightFadeDuration)
				.SetEase(Ease.OutQuad))
			.AppendInterval(holdSeconds)
			.Append(DOTween.To(() => seg.shape.Color, c => seg.shape.Color = c, baseColor, highlightFadeDuration)
				.SetEase(Ease.InQuad));

		string highlightKey = seg.id;
		highlightTweens[highlightKey] = seq;
		seq.OnKill(() =>
		{
			if (highlightTweens.TryGetValue(highlightKey, out var current) && current == seq)
				highlightTweens.Remove(highlightKey);
		});
	}

	private int GetTotalCompletedSegments() => completedSegmentIds.Count;

	void HandleDiagramComplete()
	{
		if (transitionStarted) return;
		transitionStarted = true;

		// Use perimeter path for centroid
		Vector3 centroid = path ? path.ComputeCentroid(36) : Vector3.zero;

		for (int i = 0; i < perimeterSegments.Length; i++)
		{
			var seg = perimeterSegments[i];
			if (seg.shape == null) continue;

			Vector3 localMid = Vector3.zero;
			Quaternion localRot = Quaternion.identity;

			if (seg.shape is Line line)
			{
				// Midpoint in local space
				localMid = (line.Start + line.End) * 0.5f;

				// Direction of the line
				Vector3 dir = (line.End - line.Start).normalized;

				// Perpendicular to line
				Vector3 normal = new Vector3(-dir.y, dir.x, 0);

				// Convert midpoint to world to test direction
				Vector3 worldMid = seg.shape.transform.TransformPoint(localMid);

				// Always flip the normal inward toward the centroid.
				Vector3 toCentroid = (centroid - worldMid).normalized;
				if (Vector3.Dot(normal, toCentroid) < 0)
					normal = -normal;

				// Compute offset amount
				float lineLength = Vector3.Distance(line.Start, line.End);
				float baseOffset = Mathf.Clamp(lineLength * baseOffsetFactor, minOffset, maxOffset);

				// Use override if defined
				if (seg.offsetOverride != 0)
					baseOffset = seg.offsetOverride;

				// Apply offset
				localMid += normal * baseOffset;

				localRot = Quaternion.identity;


			}
			else if (seg.shape is Disc disc)
			{
				float startAng = discStartAngles[seg.id];
				float endAng = discEndAngles[seg.id];
				float mid = Mathf.Lerp(startAng, endAng, 0.5f);
				float r = discFinalRadii[seg.id];
				Vector3 localEdge = new Vector3(Mathf.Cos(mid) * r, Mathf.Sin(mid) * r, 0);
				Vector3 worldEdge = disc.transform.TransformPoint(localEdge);
				Vector3 toCentroid = (centroid - worldEdge).normalized;
				float baseOffset = Mathf.Clamp(r * baseOffsetFactor, minOffset, maxOffset);
				if (seg.offsetOverride != 0) baseOffset = seg.offsetOverride;
				Vector3 localOffset = disc.transform.InverseTransformVector(toCentroid) * baseOffset;
				localMid = localEdge + localOffset;
			}


			if (distanceLabelPrefab != null)
			{
				GameObject labelObj = Instantiate(distanceLabelPrefab, seg.shape.transform);
				RectTransform rect = labelObj.GetComponent<RectTransform>();
				if (rect == null) rect = labelObj.AddComponent<RectTransform>();
				rect.localScale = Vector3.one;

				rect.localPosition = localMid;
				rect.localRotation = localRot;

				// Update text
				var tmp = labelObj.GetComponentInChildren<TextMeshProUGUI>();
				if (tmp != null) tmp.text = seg.distanceLabel;

				// Animate
				Sequence seq = DOTween.Sequence()
					.SetTarget(rect)
					.SetUpdate(true)
					.SetRecyclable(true)
					.SetLink(labelObj, LinkBehaviour.KillOnDestroy);
				seq.Append(rect.DOScale(1.2f, 0.35f).SetEase(Ease.OutBack));
				seq.Append(rect.DOScale(1f, 0.2f).SetEase(Ease.InOutSine));
			}
		}

		GameplayEventBus.RaisePerimeterComplete();
		if (autoLoadQuestionOnComplete)
		{
			Invoke(nameof(LoadFinalScene), delayBeforeSceneLoad);
		}
	}

	private void LoadFinalScene()
	{
		SceneManager.LoadScene("Question Perimeter");
	}

	private Color GetLaneColor(string colorName)
	{
		switch (colorName.ToLower())
		{
			case "green": return new Color(0.157f, 0.667f, 0f); // S
			case "red": return new Color(0.79f, 0.078f, 0.078f); // F
			case "yellow": return new Color(1f, 0.73f, 0.02f); // J
			case "blue": return new Color(0.027f, 0.396f, 0.918f); // L
			case "orange": return new Color(1f, 0.5f, 0f);
			default: return Color.gray;
		}
	}

	private Color ResolveFillColor(string colorName)
	{
		return ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter
			? segmentFillColor
			: GetLaneColor(colorName);
	}

	private Color ResolvePulseColor()
	{
		if (ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter)
		{
			Color pulse = Color.Lerp(segmentFillColor, Color.white, 0.25f);
			pulse.a = Mathf.Clamp01(segmentFillColor.a + 0.1f);
			return pulse;
		}
		return glowFilledColor;
	}
	public void ResetDiagramSegments()
	{
		if (perimeterSegments == null || perimeterSegments.Length == 0)
		{
			return;
		}

		foreach (var seg in perimeterSegments)
		{
			if (seg.shape == null) continue;
			SafeKillAndDisable(seg.shape);
		}
	}

	public void OnNotesHitting(Transform note, string inputColor)
	{
		if (note)
		{
			RegisterHit(note, inputColor);
		}
	}

	// Record the strike; each hit is another lantern lit along the perimeter.
	public void RegisterHit(Transform note, string colorName)
	{
		SegmentProgress seg;
		if (acceptAnyLaneHitsForCurrentShape)
		{
			// Find the first incomplete segment regardless of lane color
			seg = segments.Find(s => s.currentHits < s.requiredHits);
		}
		else
		{
			//  Find the *first incomplete segment* of this color
			seg = segments.Find(s => s.colorName == colorName && s.currentHits < s.requiredHits);
		}

		if (seg == null) return;

		seg.currentHits++;

		float oldPercent = (float)(seg.currentHits - 1) / seg.requiredHits;
		float newPercent = seg.completionPercent;

		Debug.Log($"[DiagramManager] {seg.colorName} segment {seg.currentHits}/{seg.requiredHits} ({newPercent:P0}).");

		for (int i = 0; i < perimeterSegments.Length; ++i)
		{
			PerimeterSegment ps = perimeterSegments[i];
			if (ps.id != seg.id)
			{
				continue;
			}

			if (i < worldPerimeterSegments.Length)
			{
				note.parent = worldPerimeterSegments[i];
				note.DOLocalMove(Vector3.zero, 0.25f).SetEase(Ease.InOutQuad);
			}
		}
		// Continuous growth for this segment
		UpdateSegmentVisual(seg);
		if (seg.currentHits >= seg.requiredHits)
			HandleSegmentCompletionByHits(seg);

		//  Milestones (quarters)
		int oldQuarter = Mathf.FloorToInt(oldPercent * 4);
		int newQuarter = Mathf.FloorToInt(newPercent * 4);

		// Milestones (quarters)
		if (ShouldRenderSegmentOverlays && newQuarter > oldQuarter)
		{
			Debug.Log($"[DiagramManager] {seg.id} milestone {newQuarter}/4 ignited.");

			foreach (PerimeterSegment ps in perimeterSegments)
			{
				if (ps.id != seg.id) continue;
				if (ps.shape == null) continue; // 🔑 Skip tweens if no shape assigned (Orange case)

				Color fillCol = ResolveFillColor(seg.colorName);
				Color pulseCol = ResolvePulseColor();
				ps.shape.DOKill();
				TweenShapeColor(ps.shape, fillCol, pulseCol, 0.15f, Ease.OutQuad, true);

				if (newQuarter == 4)
				{
					ps.shape.DOKill();
					TweenShapeColor(ps.shape, ps.shape.Color, pulseCol, 0.3f, Ease.OutQuad);
				}
			}

			// Pulse only if there’s a shape
			if (ShouldRenderSegmentOverlays) PulseSegment(seg.id);
		}

		CheckAllSegmentsComplete();
	}

	private void UpdateSegmentVisual(SegmentProgress seg)
	{
		if (seg == null) return;
		BroadcastSegmentProgress(seg);
		float percent = seg.completionPercent;
		UpdateSegmentCoverageCache(seg, percent);
		if (!ShouldRenderSegmentOverlays) return; // Avoid per-segment visuals if disabled

		// Update just this segment’s visuals
		SetSegmentState(seg.id, seg.colorName, percent);

		// Detect milestone quarters
		int oldQuarter = Mathf.FloorToInt(((float)(seg.currentHits - 1) / seg.requiredHits) * 4f);
		int newQuarter = Mathf.FloorToInt(percent * 4f);

		if (newQuarter > oldQuarter)
		{
			Debug.Log($"[DiagramManager] {seg.id} milestone {newQuarter}/4 ignited.");
			Color pulseCol = ResolvePulseColor();

			foreach (var ps in perimeterSegments)
			{
				if (ps.id != seg.id) continue;

				if (ps.shape == null) continue;
				SafeKill(ps.shape);

				TweenShapeColor(ps.shape, ps.shape.Color, pulseCol, 0.15f, Ease.OutQuad, true);
			}
		}

		// Completion = turn permanently lime
		if (percent >= 1f)
		{
			foreach (var ps in perimeterSegments)
			{
				if (ps.id != seg.id) continue;

				if (ps.shape == null) continue;
				SafeKill(ps.shape);

				TweenShapeColor(ps.shape, ps.shape.Color, ResolvePulseColor(), 0.25f, Ease.OutQuad);
			}
		}
	}

	private void SetSegmentState(string segId, string colorName, float fillAmount)
	{
		if (!ShouldRenderSegmentOverlays) return; // global drawer handles visuals if overlays disabled
		foreach (var seg in perimeterSegments)
		{
			if (seg.id != segId) continue;

			if (seg.shape is Line line)
			{
				if (!line.enabled) line.enabled = true;
				line.ZTest = CompareFunction.LessEqual;

				Vector3 startPos = segmentStartPositions[seg.id];
				Vector3 endPos = segmentEndPositions[seg.id];

				// Use authored geometry exactly; avoid pixel snapping so path and visuals match 1:1
				line.Start = startPos;
				if (animateSegmentFill)
				{
					DOTween.Kill(line);
					// derive current t from current End position projected on the segment
					float curT = 0f;
					{
						Vector3 v = endPos - startPos; float len = v.magnitude;
						if (len > 1e-4f)
						{
							Vector3 d = (line.End - startPos);
							curT = Mathf.Clamp01(Vector3.Dot(d, v.normalized) / len);
						}
					}
					DOTween.To(() => curT, t => { if (line) line.End = Vector3.Lerp(startPos, endPos, t); }, Mathf.Clamp01(fillAmount), segmentFillTweenDuration)
						.SetEase(segmentFillEase).SetTarget(line).SetUpdate(true);
				}
				else
				{
					line.End = Vector3.Lerp(startPos, endPos, fillAmount);
				}

				Color c = ResolveFillColor(colorName);
				c.a = ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter ? segmentFillColor.a : 1f;
				line.Color = c;
			}
			else if (seg.shape is Disc disc)
			{
				if (!disc.enabled) disc.enabled = true;
				disc.ZTest = CompareFunction.LessEqual;

				// Align disc fill with path-chosen direction/sweep
				float a0 = discStartAngles[seg.id];
				float sweep = 0f;
				if (path != null)
				{
					var segments = path.Segments;
					if (segments != null && segments.Count > 0)
					{
						bool found = false;
						PerimeterPathProvider.SegmentInfo match = default;
						for (int i = 0; i < segments.Count; i++)
						{
							var si = segments[i];
							if (si.id == seg.id)
							{
								match = si;
								found = true;
								break;
							}
						}

						if (found && match.length > 0 && Mathf.Abs(match.arcSweepRad) > 1e-6f)
						{
							a0 = match.arcStartRadLocal;
							sweep = match.arcSweepRad;
						}
						else
						{
							// fallback to authored end-start
							sweep = (discEndAngles[seg.id] - discStartAngles[seg.id]);
						}
					}
					else
					{
						sweep = (discEndAngles[seg.id] - discStartAngles[seg.id]);
					}
				}
				else
				{
					sweep = (discEndAngles[seg.id] - discStartAngles[seg.id]);
				}

				float targetT = Mathf.Clamp01(fillAmount);
				if (animateSegmentFill)
				{
					DOTween.Kill(disc);
					// compute current t from current angles
					float curT = 0f;
					float denom = Mathf.Abs(sweep) > 1e-6f ? sweep : (discEndAngles[seg.id] - discStartAngles[seg.id]);
					if (Mathf.Abs(denom) > 1e-6f)
					{
						curT = Mathf.Clamp01((disc.AngRadiansEnd - a0) / denom);
					}
					DOTween.To(() => curT, t =>
					{
						if (!disc) return;
						disc.AngRadiansStart = a0;
						disc.AngRadiansEnd = a0 + sweep * t;
					}, targetT, segmentFillTweenDuration)
					.SetEase(segmentFillEase).SetTarget(disc).SetUpdate(true);
				}
				else
				{
					disc.AngRadiansStart = a0;
					disc.AngRadiansEnd = a0 + sweep * targetT;
				}
				disc.Radius = discFinalRadii[seg.id];

				Color c = ResolveFillColor(colorName);
				c.a = ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter ? segmentFillColor.a : 1f;
				disc.Color = c;
			}
		}
	}

	private void BroadcastSegmentProgress(SegmentProgress seg)
	{
		if (seg == null) return;
		float percent = Mathf.Clamp01(seg.completionPercent);
		bool isComplete = seg.currentHits >= seg.requiredHits;
		GameplayEventBus.RaiseSegmentProgressed(seg.id, percent, isComplete);
	}

	// PixelSnap removed to keep parity with path sampling

	private void HandleChartInitialized()
	{
		if (useGlobalFill)
		{
			float t0 = 0f;
			double now = AudioManager.Instance ? AudioManager.Instance.GetAdjustedSongTime() : AudioSettings.dspTime;
			if (wispController) t0 = wispController.GetNormalizedT(now);
			ResetGlobalFill(t0);
		}

		RebuildSegmentProgressRequirements();
	}

	public void PulseSegment(string segId)
	{
		if (!ShouldRenderSegmentOverlays) return; // Keep ring stable in pure global fill mode
		var seg = segments.Find(s => s.id == segId);
		if (seg == null) return;

		if (perimeterSegments == null || perimeterSegments.Length == 0) return;

		PerimeterSegment ps = default;
		bool found = false;
		for (int i = 0; i < perimeterSegments.Length; i++)
		{
			if (perimeterSegments[i].id == segId)
			{
				ps = perimeterSegments[i];
				found = true;
				break;
			}
		}
		if (!found) return;

		if (ps.shape == null || ps.shape.transform == null || !ps.shape.gameObject.activeInHierarchy) return;

		var t = ps.shape.transform;
		DOTween.Kill(t);
		var baseScale = baseScaleById.TryGetValue(segId, out var b) ? b : t.localScale;
		t.localScale = baseScale;
		t.DOPunchScale(Vector3.one * 0.15f, 0.25f, 8, 0.5f)
			.SetUpdate(true)
			.SetTarget(t)
			.SetLink(ps.shape.gameObject)
			.OnKill(() => { if (t) t.localScale = baseScale; })
			.OnComplete(() => { if (t) t.localScale = baseScale; });

	}

	private void CheckAllSegmentsComplete()
	{
		int totalCompleted = 0;
		foreach (var seg in segments)
		{
			if (seg.currentHits >= seg.requiredHits)
				totalCompleted++;
		}

		progressText.text = $"{totalCompleted}/{segments.Count} SEGMENTS COMPLETED";

		if (totalCompleted >= segments.Count && !transitionStarted)
		{
			Debug.Log("[DiagramManager] All segments filled — running HandleDiagramComplete().");
			HandleDiagramComplete();
		}
	}

	private void SafeKillAndDisable(ShapeRenderer shape)
	{
		if (shape == null) return;

		DOTween.Kill(shape);   // kill tweens attached
		DOTween.Kill(shape.transform);

		shape.enabled = false;
	}

	private void SafeKill(object target)
	{
		if (target != null)
			DOTween.Kill(target, complete: false);
	}

	private void TweenShapeColor(ShapeRenderer shape, Color from, Color to, float duration, Ease ease, bool yoyo = false)
	{
		if (shape == null || shape.gameObject == null || !shape.gameObject.activeInHierarchy) return;

		// Kill existing tweens safely
		DOTween.Kill(shape);
		DOTween.Kill(shape.transform);

		// Animate to target
		var tween = DOTween.To(
		() => shape.Color,
		c => { if (shape != null && shape.gameObject != null) shape.Color = c; },
		to, duration
		).SetEase(ease)
		.SetTarget(shape)
		.SetUpdate(true)
	   .SetLink(shape.gameObject);
		if (yoyo)
		{
			tween.OnComplete(() =>
			{
				if (shape != null && shape.gameObject != null)
				{
					DOTween.To(() => shape.Color,
							   c => { if (shape != null && shape.gameObject != null) shape.Color = c; },
							   from, duration)
						   .SetEase(ease)
						   .SetTarget(shape)
						   .SetUpdate(true);
				}
			});
		}
	}

	private void OnDrawGizmosSelected()
	{
		if (!showLabelGizmos || perimeterSegments == null) return;

		// Use perimeter nodes to approximate the centroid so label offsets stay centered.
		Vector3 centroid = path ? path.ComputeCentroid(36) : Vector3.zero;


		Gizmos.color = gizmoColor;

		foreach (var seg in perimeterSegments)
		{
			if (seg.shape == null) continue;

			Vector3 localMid = Vector3.zero;

			if (seg.shape is Line line)
			{
				// Midpoint (local space of shape)
				localMid = (line.Start + line.End) * 0.5f;
				Vector3 dir = (line.End - line.Start).normalized;

				// Perpendicular
				Vector3 normal = new Vector3(-dir.y, dir.x, 0);

				// Convert midpoint to world
				Vector3 worldMid = seg.shape.transform.TransformPoint(localMid);

				// Flip the normal inward toward the centroid.
				Vector3 toCentroid = (centroid - worldMid).normalized;
				if (Vector3.Dot(normal, toCentroid) < 0)
					normal = -normal;

				float lineLength = Vector3.Distance(line.Start, line.End);
				float baseOffset = Mathf.Clamp(lineLength * baseOffsetFactor, minOffset, maxOffset);

				// Use override if defined
				if (seg.offsetOverride != 0)
					baseOffset = seg.offsetOverride;


				localMid += normal * baseOffset;
			}
			else if (seg.shape is Disc disc)
			{
				float startAng = discStartAngles[seg.id];
				float endAng = discEndAngles[seg.id];
				float mid = Mathf.Lerp(startAng, endAng, 0.5f);
				float r = discFinalRadii[seg.id];
				Vector3 localEdge = new Vector3(Mathf.Cos(mid) * r, Mathf.Sin(mid) * r, 0);
				Vector3 worldEdge = disc.transform.TransformPoint(localEdge);
				Vector3 toCentroid = (centroid - worldEdge).normalized;
				float baseOffset = Mathf.Clamp(r * baseOffsetFactor, minOffset, maxOffset);
				if (seg.offsetOverride != 0) baseOffset = seg.offsetOverride;
				Vector3 localOffset = disc.transform.InverseTransformVector(toCentroid) * baseOffset;
				localMid = localEdge + localOffset;
			}


			// Convert back to world
			Vector3 worldPos = seg.shape.transform.TransformPoint(localMid);
			Gizmos.DrawSphere(worldPos, gizmoSize);

			// Debug line to centroid
			Gizmos.color = Color.magenta;
			Gizmos.DrawLine(worldPos, centroid);
			Gizmos.color = gizmoColor;
		}

	}
	// Returns the next segment (by color) that still needs hits.
	public string GetNextIncompleteSegmentIdByColor(string colorName)
	{
		var seg = segments.Find(s => s.colorName == colorName && s.currentHits < s.requiredHits);
		return seg != null ? seg.id : null;
	}

	// Returns the current world-space tip of that segment based on its completion percent.
	public Vector3 GetSegmentWorldTip(string segId)
	{
		var ps = System.Array.Find(perimeterSegments, p => p.id == segId);
		if (ps.shape == null) return Vector3.zero;

		var prog = segments.Find(s => s.id == segId);
		float t = prog != null ? Mathf.Clamp01(prog.completionPercent) : 0f;

		// If you cached values at Start (recommended), use them:
		if (ps.shape is Shapes.Line line && segmentStartPositions != null && segmentEndPositions != null)
		{
			Vector3 localStart = segmentStartPositions[segId];
			Vector3 localEnd = segmentEndPositions[segId];
			Vector3 localTip = Vector3.Lerp(localStart, localEnd, t);
			return line.transform.TransformPoint(localTip);
		}
		if (ps.shape is Shapes.Disc disc && discStartAngles != null && discEndAngles != null && discFinalRadii != null)
		{
			float a0 = discStartAngles[segId];
			float a1 = discEndAngles[segId];
			float ang = Mathf.Lerp(a0, a1, t);
			float r = discFinalRadii[segId]; // or Lerp from min→final if you “grow” radius
			Vector3 localTip = new Vector3(Mathf.Cos(ang) * r, Mathf.Sin(ang) * r, 0f);
			return disc.transform.TransformPoint(localTip);
		}

		// Fallback: read directly from the Shapes.
		if (ps.shape is Shapes.Line lineDirect)
		{
			// Shapes Line exposes .Start and .End in local space
			Vector3 localTip = Vector3.Lerp(lineDirect.Start, lineDirect.End, t);
			return lineDirect.transform.TransformPoint(localTip);
		}
		if (ps.shape is Shapes.Disc discDirect)
		{
			float ang = Mathf.Lerp(discDirect.AngRadiansStart, discDirect.AngRadiansEnd, t);
			float r = discDirect.Radius; // or outer radius if using thickness
			Vector3 localTip = new Vector3(Mathf.Cos(ang) * r, Mathf.Sin(ang) * r, 0f);
			return discDirect.transform.TransformPoint(localTip);
		}

		return ps.shape.transform.position;
	}
	public void ApplyHit(int segmentId, HitResult result)
	{
		if (segmentId < 0 || segmentId >= segments.Count) return;

		if (result == HitResult.Perfect || result == HitResult.Good)
		{
			var seg = segments[segmentId];
			seg.currentHits = Mathf.Min(seg.requiredHits, seg.currentHits + 1);
			RevealSegmentOutline(seg.id);
			UpdateSegmentVisual(seg);
		}
		else
		{
			var ps = perimeterSegments[segmentId];
			if (ps.shape != null)
			{
				TweenShapeColor(ps.shape, ps.shape.Color, missColor, 0.12f, Ease.OutQuad, true);
			}
		}

		CheckAllSegmentsComplete();
	}
	// Fill a continuous arc from 'fromT' to 'toT' along wisp direction.
	// Uses segment granularity (no new shaders), quick to ship.
	public void FillArc(float fromT, float toT, bool clockwise, HitResult result)
	{
		if (perimeterSegments == null || perimeterSegments.Length == 0) return;

		fromT = Mathf.Repeat(fromT, 1f);
		toT = Mathf.Repeat(toT, 1f);

		int segCount = perimeterSegments.Length;
		int iFrom = path ? path.GetSegmentIndex(fromT) : 0;
		int iTo = path ? path.GetSegmentIndex(toT) : 0;

		int dir = clockwise ? +1 : -1;
		int i = iFrom;
		int guard = 0;

		// softly mark all between from..to, and stamp result on the final segment
		while (true)
		{
			if (i == iTo)
			{
				ApplyHit(i, result); // the "real" hit lands here
				break;
			}
			i = Mod(i + dir, segCount);
			ApplyHit(i, HitResult.Good); // gentle advance on the in-betweens
			if (++guard > 2048) break; // safety
		}
	}

	static int Mod(int x, int m) { x %= m; if (x < 0) x += m; return x; }

	public void ResetGlobalFill(float startT = 0f)
	{
		if (!path) return;
		float L = path.TotalLength;
		_anchorS = Mathf.Repeat(startT, 1f) * L; // no drawing yet
		_progressS = 0f;
		coveredUById.Clear();
		segmentCoverageById.Clear();
		hasRegisteredImpact = false;
		anchorSegmentIndex = -1;
		filledS = 0f;
		lastBroadcastProgressS = float.MinValue;
		lastBroadcastHeadT = float.MinValue;
		lastBroadcastHeadIndex = -1;
		RedrawGlobalFill();
	}

	public void FillBetween(float fromT, float toT, bool clockwise)
	{
		if (!path) return;
		bool desiredClockwise = fillDirectionPreference switch
		{
			FillDirectionPreference.Clockwise => true,
			FillDirectionPreference.CounterClockwise => false,
			_ => clockwise
		};
		_globalClockwise = (desiredClockwise ^ invertGlobalFillDirection);
		UpdateGlobalFillFromCoverage();
	}


	void RedrawGlobalFill()
	{
		if (!path) return;
		float L = path.TotalLength;
		float a0 = _anchorS;
		float a1 = _anchorS + _progressS;

		var segs = path.Segments;
		for (int i = 0; i < segs.Count; i++)
		{
			var si = segs[i];
			float b0 = si.accumStart;
			float b1 = si.accumStart + si.length;

			// compute overlap along a circular domain
			float overlap = OverlapUnwrapped(a0, a1, b0, b1, L); // returns [0..length]
			float u = (si.length <= 1e-5f) ? 1f : Mathf.Clamp01(overlap / si.length);

			var ps = System.Array.Find(perimeterSegments, p => p.id == si.id);
			if (ps.shape == null) continue;

			if (ps.shape is Shapes.Line line)
			{
				var a = segmentStartPositions[ps.id];
				var b = segmentEndPositions[ps.id];
				// do not pixel-snap; keep exact match with cached path
				if (_globalClockwise)
				{
					line.Start = a;
					line.End = Vector3.Lerp(a, b, u);
				}
				else
				{
					line.End = b;
					line.Start = Vector3.Lerp(b, a, u);
				}
				var c = EvaluateHeatFillColor();
				if (globalFillColorShift)
				{
					float p = Mathf.Clamp01(_progressS / Mathf.Max(1e-5f, L));
					c = Color.Lerp(c, Color.white, globalFillWhiten * p);
				}
				c.a = segmentFillColor.a; line.Color = c;
				line.enabled = u > 0f;
				// ensure perimeter fills render below UI/wisp
				line.SortingOrder = -10;
				TrackGlobalCoverageAndBubbles(ps.id, u, i);
			}
			else if (ps.shape is Shapes.Disc disc)
			{
				// Use path-chosen arc sweep + start to ensure disc fill matches travel direction
				float angStart = discStartAngles[ps.id];
				float sweep = 0f;
				// get cached segment info from path (already computed this iteration)
				if (Mathf.Abs(si.arcSweepRad) > 1e-6f)
				{
					angStart = si.arcStartRadLocal;
					sweep = si.arcSweepRad;
				}
				else
				{
					// fallback to authored orientation
					sweep = (discEndAngles[ps.id] - discStartAngles[ps.id]);
				}
				if (_globalClockwise)
				{
					disc.AngRadiansStart = angStart;
					disc.AngRadiansEnd = angStart + sweep * u;
				}
				else
				{
					// Grow from the arc's end backwards when traveling CCW relative to path orientation
					disc.AngRadiansStart = angStart + sweep;
					disc.AngRadiansEnd = angStart + sweep * (1f - u);
				}
				disc.Radius = discFinalRadii[ps.id];
				var c = EvaluateHeatFillColor();
				if (globalFillColorShift)
				{
					float p = Mathf.Clamp01(_progressS / Mathf.Max(1e-5f, L));
					c = Color.Lerp(c, Color.white, globalFillWhiten * p);
				}
				c.a = segmentFillColor.a; disc.Color = c;
				disc.enabled = u > 0f;
				TrackGlobalCoverageAndBubbles(ps.id, u, i);
			}
		}
		UpdateProgressUI();
		BroadcastPerimeterHeadMoved();
	}

	private void BroadcastPerimeterHeadMoved()
	{
		if (!path) return;
		float L = path.TotalLength;
		if (L <= 1e-5f) return;

		float normalized = Mathf.Repeat((_anchorS + _progressS) / Mathf.Max(1e-5f, L), 1f);
		if (Mathf.Approximately(_progressS, lastBroadcastProgressS) &&
			Mathf.Approximately(normalized, lastBroadcastHeadT))
			return;

		lastBroadcastProgressS = _progressS;
		lastBroadcastHeadT = normalized;
		lastBroadcastHeadIndex = path.GetSegmentIndex(normalized);
		GameplayEventBus.RaisePerimeterHeadMoved(normalized, lastBroadcastHeadIndex);
	}

	private void ApplyHeatTintImmediate()
	{
		var heatTint = EvaluateHeatFillColor();
		UpdateHeatDisc(heatTint);
		if (useGlobalFill && path != null && perimeterSegments != null && perimeterSegments.Length > 0)
			RedrawGlobalFill();
	}

	private Color EvaluateHeatFillColor()
	{
		if (!tintFillByHeat)
			return segmentFillColor;

		Color target = currentHeatTier switch
		{
			GameplayEventBus.StreakTier.Tier1 => tier1Tint,
			GameplayEventBus.StreakTier.Tier2 => tier2Tint,
			GameplayEventBus.StreakTier.Tier3 => tier3Tint,
			_ => segmentFillColor
		};

		float blend = currentHeatTier == GameplayEventBus.StreakTier.None ? 0f : Mathf.Clamp01(currentHeatLevel);
		Color tinted = Color.Lerp(segmentFillColor, target, blend);
		tinted.a = segmentFillColor.a;
		return tinted;
	}

	private void UpdateHeatDisc(Color baseTint)
	{
		if (!streakHeatDisc) return;
		Color tint = overrideStreakHeatDiscColor ? EvaluateStreakDiscColor() : baseTint;
		float alpha = Mathf.Lerp(streakHeatDiscBaseAlpha, streakHeatDiscMaxAlpha, Mathf.Clamp01(currentHeatLevel));
		tint.a = alpha;
		streakHeatDisc.Color = tint;
		streakHeatDisc.enabled = alpha > 0.01f;
	}

	private Color EvaluateStreakDiscColor()
	{
		// When overriding, the disc can have its own warm gradient independent of segment fills.
		Color target = currentHeatTier switch
		{
			GameplayEventBus.StreakTier.Tier1 => streakHeatDiscTier1Color,
			GameplayEventBus.StreakTier.Tier2 => streakHeatDiscTier2Color,
			GameplayEventBus.StreakTier.Tier3 => streakHeatDiscTier3Color,
			_ => streakHeatDiscBaseColor
		};

		float blend = currentHeatTier == GameplayEventBus.StreakTier.None ? 0f : Mathf.Clamp01(currentHeatLevel);
		Color tinted = Color.Lerp(streakHeatDiscBaseColor, target, blend);
		// Alpha is handled separately in UpdateHeatDisc
		tinted.a = 1f;
		return tinted;
	}

	private void PulseHeatDisc(float heat)
	{
		if (!streakHeatDisc) return;
		var target = streakHeatDisc.transform;
		_streakHeatDiscTween?.Kill();
		target.localScale = streakHeatDiscBaseScale;

		float punch = Mathf.Lerp(0.02f, 0.08f, Mathf.Clamp01(heat));
		_streakHeatDiscTween = target.DOPunchScale(Vector3.one * punch, 0.35f, 6, 0.65f)
			.SetTarget(target)
			.SetUpdate(true)
			.SetLink(streakHeatDisc.gameObject, LinkBehaviour.KillOnDestroy)
			.OnKill(() =>
			{
				if (target)
					target.localScale = streakHeatDiscBaseScale;
			});
	}

	private void ApplyFormulaValuesToSegments(in ShapeFormulaRuntimeData data)
	{
		if (perimeterSegments == null || perimeterSegments.Length == 0 || !data.HasValues)
			return;

		for (int i = 0; i < perimeterSegments.Length; i++)
		{
			var seg = perimeterSegments[i];
			if (!TryGetFormulaTermForSegment(data, seg.id, i, out var term))
				continue;

			string unit = !string.IsNullOrEmpty(term.unit) ? term.unit : data.unitSuffix;
			string valueText = string.IsNullOrEmpty(unit)
				? term.formattedValue
				: $"{term.formattedValue}{unit}";

			perimeterSegments[i].distanceLabel = valueText;
			UpdateCompletionBubbleLabel(seg.id, valueText);
		}
	}

	private bool TryGetFormulaTermForSegment(in ShapeFormulaRuntimeData data, string segmentId, int segmentIndex, out ShapeFormulaTermValue term)
	{
		if (data.values != null)
		{
			for (int i = 0; i < data.values.Length; i++)
			{
				var candidate = data.values[i];
				if (!string.IsNullOrEmpty(segmentId) && candidate.segmentId == segmentId)
				{
					term = candidate;
					return true;
				}
				if (candidate.segmentIndex == segmentIndex)
				{
					term = candidate;
					return true;
				}
			}
		}

		term = default;
		return false;
	}

	private void UpdateCompletionBubbleLabel(string segmentId, string text)
	{
		if (string.IsNullOrEmpty(segmentId))
			return;

		if (completionBubbleById.TryGetValue(segmentId, out var bubble) && bubble != null)
		{
			var tmp = bubble.GameObject ? bubble.GameObject.GetComponentInChildren<TextMeshProUGUI>(true) : null;
			if (tmp)
				tmp.text = text;
		}
	}

	void ValidatePerimeterSegments()
	{
		if (perimeterSegments == null || perimeterSegments.Length == 0)
			return;

		var seenIds = new HashSet<string>();
		for (int i = 0; i < perimeterSegments.Length; i++)
		{
			var seg = perimeterSegments[i];
			string segName = seg.shape ? seg.shape.name : $"Segment[{i}]";
			if (string.IsNullOrWhiteSpace(seg.id))
			{
				Debug.LogWarning($"[DiagramManager] Perimeter segment '{segName}' on '{name}' is missing an id. Progress tracking and UI need unique ids per segment.");
				continue;
			}

			if (!seenIds.Add(seg.id))
			{
				Debug.LogWarning($"[DiagramManager] Duplicate perimeter segment id '{seg.id}' found on '{name}'. Using the same id twice in one shape will cause the wisp/score UI to reuse cached progress.");
			}
		}
	}

	// Helper: overlap of [a0,a1] with [b0,b1] on a circular axis of length L
	static float OverlapUnwrapped(float a0, float a1, float b0, float b1, float L)
	{
		float o0 = OverlapLinear(a0, a1, b0, b1);
		float o1 = OverlapLinear(a0, a1, b0 + L, b1 + L);
		float o2 = OverlapLinear(a0, a1, b0 - L, b1 - L);
		return Mathf.Max(o0, Mathf.Max(o1, o2));
	}
	static float OverlapLinear(float a0, float a1, float b0, float b1)
	{
		float lo = Mathf.Max(a0, b0);
		float hi = Mathf.Min(a1, b1);
		return Mathf.Max(0f, hi - lo);
	}

	// Use id, not array index, when applying a discrete hit
	public void ApplyHitByPathIndex(int pathIndex, HitResult result)
	{
		if (pathIndex < 0 || pathIndex >= path.Segments.Count) return;
		var id = path.Segments[pathIndex].id;
		var seg = segments.Find(s => s.id == id);
		if (seg == null) return;

		if (result == HitResult.Perfect || result == HitResult.Good)
		{
			seg.currentHits = Mathf.Min(seg.requiredHits, seg.currentHits + 1);
			RevealSegmentOutline(seg.id);
			float percent = seg.completionPercent;
			if (ShouldRenderSegmentOverlays)
				UpdateSegmentVisual(seg);
			else
			{
				UpdateSegmentCoverageCache(seg, percent);
				BroadcastSegmentProgress(seg);
			}

			if (seg.currentHits >= seg.requiredHits)
				HandleSegmentCompletionByHits(seg);
		}
		else
		{
			var ps = System.Array.Find(perimeterSegments, p => p.id == id);
			if (ps.shape)
			{
				// In global fill mode, avoid transform shakes to prevent ring drift
				if (useGlobalFill)
				{
					TweenShapeColor(ps.shape, ps.shape.Color, missColor, 0.12f, Ease.OutQuad, true);
				}
				else
				{
					TweenShapeColor(ps.shape, ps.shape.Color, missColor, 0.12f, Ease.OutQuad, true);
					if (ps.shape.transform && ps.shape.gameObject.activeInHierarchy)
					{
						DOTween.Kill(ps.shape.transform);
						ps.shape.transform.DOShakeScale(0.2f, 0.2f, 12, 90, false, ShakeRandomnessMode.Harmonic)
							.SetUpdate(true).SetTarget(ps.shape.transform).SetLink(ps.shape.gameObject)
							.OnKill(() => { if (ps.shape && baseScaleById.TryGetValue(id, out var b)) ps.shape.transform.localScale = b; })
							.OnComplete(() => { if (ps.shape && baseScaleById.TryGetValue(id, out var b)) ps.shape.transform.localScale = b; });
					}
				}
			}
		}
	}

	private void UpdateSegmentCoverageCache(SegmentProgress seg, float percent)
	{
		if (seg == null) return;
		segmentCoverageById[seg.id] = Mathf.Clamp01(percent);

		if (!hasRegisteredImpact && path != null)
		{
			int idx = GetPathIndexForSegmentId(seg.id);
			if (idx >= 0 && idx < path.Segments.Count)
			{
				anchorSegmentIndex = idx;
				_anchorS = path.Segments[idx].accumStart;
				hasRegisteredImpact = true;
			}
		}

		UpdateGlobalFillFromCoverage();
	}

	private void UpdateGlobalFillFromCoverage()
	{
		if (!useGlobalFill || path == null)
		{
			return;
		}

		if (!hasRegisteredImpact || anchorSegmentIndex < 0 || path.Segments == null || path.Segments.Count == 0)
		{
			SetGlobalFillProgress(0f);
			return;
		}

		float coveredLength = ComputeCoveredLengthFromAnchor(anchorSegmentIndex);
		filledS = coveredLength;
		SetGlobalFillProgress(coveredLength);
	}

	private float ComputeCoveredLengthFromAnchor(int startIndex)
	{
		var segs = path.Segments;
		if (segs == null || segs.Count == 0 || startIndex < 0 || startIndex >= segs.Count)
			return 0f;

		float total = 0f;
		int dir = _globalClockwise ? 1 : -1;
		int idx = startIndex;

		for (int step = 0; step < segs.Count; step++)
		{
			var segInfo = segs[idx];
			float coverage = segmentCoverageById.TryGetValue(segInfo.id, out var c) ? Mathf.Clamp01(c) : 0f;

			if (coverage <= coverageMergeThreshold)
			{
				break;
			}

			total += segInfo.length * coverage;

			if (coverage < 1f - coverageMergeThreshold)
			{
				break;
			}

			idx = Mod(idx + dir, segs.Count);

			if (idx == startIndex)
			{
				total = path.TotalLength;
				break;
			}
		}

		return Mathf.Clamp(total, 0f, path.TotalLength);
	}

	private void SetGlobalFillProgress(float target)
	{
		if (!path)
		{
			return;
		}

		float L = path.TotalLength;
		target = Mathf.Clamp(target, 0f, L);

		if (Mathf.Approximately(target, _progressS))
		{
			_progressS = target;
			RedrawGlobalFill();
			return;
		}

		if (!animateGlobalFill)
		{
			_progressS = target;
			RedrawGlobalFill();
			return;
		}

		if (_globalFillTween != null)
		{
			DOTween.Kill(_globalFillTween);
		}
		float lap = Mathf.Max(0.05f, globalFillSecondsPerLap);
		float duration = lap * (L <= 1e-5f ? 0f : Mathf.Clamp01(Mathf.Abs(target - _progressS) / Mathf.Max(1e-5f, L)));
		_globalFillTween = DOTween.To(() => _progressS, v =>
		{
			_progressS = v;
			RedrawGlobalFill();
		}, target, Mathf.Max(0.05f, duration))
			.SetEase(globalFillEase).SetUpdate(true).SetTarget(this);
	}

	private void TrackGlobalCoverageAndBubbles(string id, float u, int pathIndex)
	{
		float prev = coveredUById.TryGetValue(id, out var v) ? v : 0f;
		coveredUById[id] = u;

		if (u > 0f)
			RevealSegmentOutline(id);

		// Optional: once the visual fill actually reaches the completed segment, flash it again.
		if (completedSegmentIds.Contains(id) && prev < globalCompletionThreshold && u >= globalCompletionThreshold)
		{
			PulseGlow(id, completionGlow * 0.6f);
			PulseCompletionBubble(id);
		}
	}

	private bool TryRegisterSegmentCompletion(string id)
	{
		if (string.IsNullOrEmpty(id))
			return false;

		if (!completedSegmentIds.Add(id))
			return false;

		if (segmentProgressById.TryGetValue(id, out var progress))
		{
			progress.currentHits = progress.requiredHits;
			UpdateSegmentCoverageCache(progress, 1f);
			BroadcastSegmentProgress(progress);
			GameplayEventBus.RaiseSegmentCompleted(id, progress.colorName);
		}
		else
		{
			segmentCoverageById[id] = 1f;
			UpdateGlobalFillFromCoverage();
			GameplayEventBus.RaiseSegmentCompleted(id, ResolveSegmentColorName(id));
		}

		RevealSegmentOutline(id);
		return true;
	}

	private void HandleSegmentCompletionByHits(SegmentProgress seg)
	{
		if (seg == null || seg.currentHits < seg.requiredHits)
			return;

		if (!TryRegisterSegmentCompletion(seg.id))
			return;

		HandleSegmentCompletionVisuals(seg.id);
		CheckAllSegmentsComplete();
	}

	private void HandleSegmentCompletionVisuals(string id)
	{
		int pathIndex = GetPathIndexForSegmentId(id);
		SpawnSegmentBubble(id, pathIndex);
		SpawnCompletionImpactFx(id, pathIndex);
		PulseGlow(id, completionGlow);
	}

	private string ResolveSegmentColorName(string id)
	{
		if (segmentProgressById.TryGetValue(id, out var progress) && !string.IsNullOrEmpty(progress.colorName))
			return progress.colorName;

		if (perimeterSegments != null && perimeterSegments.Length > 0)
		{
			var seg = System.Array.Find(perimeterSegments, p => p.id == id);
			if (seg.id != null)
				return seg.laneColor;
		}
		return string.Empty;
	}

	private void SpawnSegmentBubble(string id, int pathIndex = -1)
	{
		if (!completedSegmentIds.Contains(id)) return;
		if (perimeterSegments == null || perimeterSegments.Length == 0) return;
		var ps = System.Array.Find(perimeterSegments, p => p.id == id);
		if (ps.shape == null) return;

		if (spawnedBubbleSegments.Contains(id))
		{
			PulseCompletionBubble(id);
			return;
		}

		NotifySegmentDistanceRecorded(id, ps.distanceLabel, pathIndex);

		if (completionBubbleById.TryGetValue(id, out var existing) && existing != null && existing.GameObject)
		{
			PulseCompletionBubble(id);
			return;
		}

		Vector2 anchored = ResolveSegmentAnchoredMidpoint(id, pathIndex);
		anchored += ResolveBubbleOffset(id, pathIndex, anchored);

		Transform parent = null;
		if (path && path.ReferenceRect)
			parent = path.ReferenceRect;
		else if (uiCanvas)
			parent = uiCanvas;
		else
			parent = ps.shape.transform;

		var prefab = segmentCompleteBubblePrefab ? segmentCompleteBubblePrefab : distanceLabelPrefab;
		if (!prefab)
		{
			LogMissingBubblePrefab();
			return;
		}
		var go = Instantiate(prefab, parent, false);
		var rt = go.transform as RectTransform;
		if (rt)
		{
			rt.anchoredPosition = anchored;
			rt.localScale = Vector3.one * 0.6f;
		}
		var cg = go.GetComponent<CanvasGroup>();
		if (!cg) cg = go.AddComponent<CanvasGroup>();
		cg.alpha = 0f;
		var instance = new CompletionBubbleInstance { Rect = rt, Canvas = cg };
		completionBubbleById[id] = instance;
		spawnedBubbleSegments.Add(id);

		// if using distanceLabelPrefab, update text to segment's label
		var tmp = go.GetComponentInChildren<TextMeshProUGUI>();
		if (tmp != null) tmp.text = ps.distanceLabel;

		if (go)
		{
			var targetAlpha = Mathf.Clamp01(completionBubblePersistentAlpha);
			DOTween.Sequence()
				.SetTarget(go)
				.SetUpdate(true)
				.SetLink(go, LinkBehaviour.KillOnDestroy)
				.Append(cg.DOFade(1f, bubbleScaleInSeconds * 0.6f))
				.Join(go.transform.DOScale(1.05f, bubbleScaleInSeconds).SetEase(Ease.OutBack))
				.AppendInterval(bubbleHoldSeconds)
				.Append(cg.DOFade(targetAlpha, bubbleFadeOutSeconds))
				.Join(go.transform.DOScale(1f, bubbleFadeOutSeconds).SetEase(Ease.InSine))
				.OnComplete(() =>
				{
					if (!instance.Canvas) return;
					instance.Canvas.alpha = targetAlpha;
					if (instance.Rect) instance.Rect.localScale = Vector3.one;
				});
		}
	}
	private void PulseCompletionBubble(string id)
	{
		if (!completionBubbleById.TryGetValue(id, out var instance) || instance == null)
			return;

		var go = instance.GameObject;
		if (!go)
		{
			completionBubbleById.Remove(id);
			return;
		}

		var rt = instance.Rect ? instance.Rect : go.GetComponent<RectTransform>();
		var cg = instance.Canvas ? instance.Canvas : go.GetComponent<CanvasGroup>();
		instance.Rect = rt;
		instance.Canvas = cg;

		float targetAlpha = Mathf.Clamp01(completionBubblePersistentAlpha);

		DOTween.Kill(go);
		if (rt) DOTween.Kill(rt);
		if (cg) DOTween.Kill(cg);

		var seq = DOTween.Sequence()
			.SetTarget(go)
			.SetUpdate(true)
			.SetLink(go, LinkBehaviour.KillOnDestroy);

		if (rt)
		{
			seq.Append(rt.DOScale(1.08f, 0.18f).SetEase(Ease.OutBack));
		}
		if (cg)
		{
			if (seq.Duration(false) == 0f)
				seq.Append(cg.DOFade(1f, 0.15f));
			else
				seq.Join(cg.DOFade(1f, 0.15f));
		}
		seq.AppendInterval(0.05f);
		if (rt)
			seq.Append(rt.DOScale(1f, 0.18f).SetEase(Ease.OutSine));
		if (cg)
			seq.Join(cg.DOFade(targetAlpha, 0.2f).SetEase(Ease.InQuad));
	}

	private Vector2 ResolveBubbleOffset(string segmentId, int explicitPathIndex, Vector2 anchoredMid)
	{
		if (completionBubbleOffset <= Mathf.Epsilon)
			return Vector2.zero;

		Vector2 offsetDir = Vector2.zero;

		if (path != null)
		{
			// Prefer centroid direction for "inside" placement
			Vector2 centroid = ResolveCentroidAnchored();
			Vector2 toCentroid = centroid - anchoredMid;
			if (toCentroid.sqrMagnitude > 1e-4f)
				offsetDir = offsetBubblesTowardCentroid ? toCentroid.normalized : (-toCentroid.normalized);
			else
			{
				int idx = explicitPathIndex >= 0 ? explicitPathIndex : GetPathIndexForSegmentId(segmentId);
				Vector2 tangent = ResolveSegmentTangent(idx);
				if (tangent.sqrMagnitude > 1e-4f)
				{
					Vector2 normal = new Vector2(-tangent.y, tangent.x).normalized;
					offsetDir = offsetBubblesTowardCentroid ? normal * -1f : normal;
				}
			}
		}

		if (offsetDir.sqrMagnitude < 1e-4f)
			offsetDir = Vector2.up;

		return offsetDir.normalized * completionBubbleOffset;
	}

	private void NotifySegmentDistanceRecorded(string segmentId, string distanceLabel, int pathIndex)
	{
		if (ScoreManagerScript.Instance == null)
			return;

		float parsed = ParseDistanceLabel(distanceLabel);
		float fallbackLength = 0f;

		if (path != null && pathIndex >= 0 && pathIndex < path.Segments.Count)
			fallbackLength = path.Segments[pathIndex].length;

		ScoreManagerScript.Instance.RecordPerimeterSegment(segmentId, distanceLabel, parsed, fallbackLength);
	}

	private static float ParseDistanceLabel(string label)
	{
		if (string.IsNullOrWhiteSpace(label))
			return 0f;

		var builder = new StringBuilder();
		foreach (char c in label)
		{
			if (char.IsDigit(c))
			{
				builder.Append(c);
			}
			else if (c == '.' || c == ',')
			{
				builder.Append('.');
			}
			else if (builder.Length > 0 && !char.IsDigit(c))
			{
				break;
			}
		}

		if (builder.Length == 0)
			return 0f;

		return float.TryParse(builder.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
			? value
			: 0f;
	}

	private Vector2 ResolveCentroidAnchored()
	{
		if (!path)
			return Vector2.zero;

		Vector3 centroid = path.ComputeCentroid(36);
		Vector3 local = path.WorldToReferenceLocal(centroid);
		return new Vector2(local.x, local.y);
	}

	private Vector2 ResolveSegmentTangent(int pathIndex)
	{
		if (!path || path.Segments == null || path.Segments.Count == 0)
			return Vector2.right;

		int idx = Mathf.Clamp(pathIndex, 0, path.Segments.Count - 1);
		var si = path.Segments[idx];
		float total = Mathf.Max(1e-5f, path.TotalLength);
		float midT = Mathf.Clamp01((si.accumStart + si.length * 0.5f) / total);
		Vector3 tangent3 = path.EvaluateTangent(midT);
		Vector2 tangent = new Vector2(tangent3.x, tangent3.y);
		return tangent.sqrMagnitude > 1e-5f ? tangent.normalized : Vector2.right;
	}

	private Vector2 EvaluateSegmentAnchoredMidpoint(int pathIndex)
	{
		if (path == null || path.Segments == null || path.Segments.Count == 0)
			return Vector2.zero;

		int clampedIndex = Mathf.Clamp(pathIndex, 0, path.Segments.Count - 1);
		var si = path.Segments[clampedIndex];
		float totalLength = Mathf.Max(1e-5f, path.TotalLength);
		float t01 = Mathf.Clamp01((si.accumStart + si.length * 0.5f) / totalLength);
		return path.EvaluateAnchoredPosition(t01);
	}

	private void SpawnCompletionImpactFx(string segmentId, int pathIndex = -1)
	{
		if (!completedSegmentIds.Contains(segmentId)) return;
		if (perimeterSegments == null || perimeterSegments.Length == 0) return;
		if (!segmentCompletionFxPrefab) return;
		var fx = RentCompletionFx();
		if (!fx) return;

		Vector2 anchored = ResolveSegmentAnchoredMidpoint(segmentId, pathIndex);
		PositionCompletionFx(fx.transform, anchored);

		var ps = System.Array.Find(perimeterSegments, p => p.id == segmentId);
		if (!string.IsNullOrEmpty(ps.id))
		{
			Color laneColor = GetLaneColor(ps.laneColor);
			fx.SetLaneColor(laneColor);
		}

		fx.HitPerfect(segmentCompletionFxHeat);

		DOVirtual.DelayedCall(Mathf.Max(0.05f, segmentCompletionFxLifetime), () => ReturnCompletionFx(fx))
			.SetTarget(fx)
			.SetUpdate(true)
			.SetLink(fx.gameObject, LinkBehaviour.KillOnDestroy);
	}

	private Vector2 ResolveSegmentAnchoredMidpoint(string id, int explicitPathIndex = -1)
	{
		if (path != null)
		{
			int index = explicitPathIndex >= 0 ? explicitPathIndex : GetPathIndexForSegmentId(id);
			if (index >= 0)
				return EvaluateSegmentAnchoredMidpoint(index);
		}

		var seg = System.Array.Find(perimeterSegments, p => p.id == id);
		if (seg.shape == null)
			return Vector2.zero;

		Vector3 worldMid = CalculateSegmentWorldMidpoint(seg);
		if (path != null)
			return path.WorldToAnchored(worldMid);
		return new Vector2(worldMid.x, worldMid.y);
	}

	private Vector3 CalculateSegmentWorldMidpoint(PerimeterSegment seg)
	{
		if (seg.shape is Line line)
		{
			Vector3 start = segmentStartPositions.TryGetValue(seg.id, out var s) ? s : line.Start;
			Vector3 end = segmentEndPositions.TryGetValue(seg.id, out var e) ? e : line.End;
			Vector3 localMid = Vector3.Lerp(start, end, 0.5f);
			return line.transform.TransformPoint(localMid);
		}

		if (seg.shape is Disc disc)
		{
			float startAng = discStartAngles.TryGetValue(seg.id, out var sa) ? sa : disc.AngRadiansStart;
			float endAng = discEndAngles.TryGetValue(seg.id, out var ea) ? ea : disc.AngRadiansEnd;
			float midAngDeg = Mathf.LerpAngle(startAng * Mathf.Rad2Deg, endAng * Mathf.Rad2Deg, 0.5f);
			float midAng = midAngDeg * Mathf.Deg2Rad;
			float radius = discFinalRadii.TryGetValue(seg.id, out var r) ? r : disc.Radius;
			Vector3 localMid = new Vector3(Mathf.Cos(midAng) * radius, Mathf.Sin(midAng) * radius, 0f);
			return disc.transform.TransformPoint(localMid);
		}

		return seg.shape.transform.position;
	}

	private void RebuildPathIndexLookup()
	{
		pathIndexById.Clear();
		if (path == null || path.Segments == null)
			return;

		for (int i = 0; i < path.Segments.Count; i++)
		{
			var seg = path.Segments[i];
			if (!string.IsNullOrEmpty(seg.id))
				pathIndexById[seg.id] = i;
		}
	}

	private int GetPathIndexForSegmentId(string id)
	{
		if (string.IsNullOrEmpty(id) || path == null || path.Segments == null)
			return -1;

		if (pathIndexById.TryGetValue(id, out var idx))
			return idx;

		for (int i = 0; i < path.Segments.Count; i++)
		{
			if (path.Segments[i].id == id)
			{
				pathIndexById[id] = i;
				return i;
			}
		}

		return -1;
	}

	public bool TryGetSegmentProgressByPathIndex(int pathIndex, out SegmentProgressData data)
	{
		data = default;
		if (path == null || path.Segments == null || pathIndex < 0 || pathIndex >= path.Segments.Count)
			return false;
		var id = path.Segments[pathIndex].id;
		return TryBuildSegmentSnapshot(id, pathIndex, out data);
	}

	public bool TryGetSegmentProgressById(string segmentId, out SegmentProgressData data)
	{
		return TryBuildSegmentSnapshot(segmentId, -1, out data);
	}

	private bool TryBuildSegmentSnapshot(string id, int explicitPathIndex, out SegmentProgressData data)
	{
		data = default;
		if (string.IsNullOrEmpty(id)) return false;
		if (!segmentProgressById.TryGetValue(id, out var progress))
			return false;

		int resolvedIndex = explicitPathIndex >= 0 ? explicitPathIndex : GetPathIndexForSegmentId(id);

		data = new SegmentProgressData
		{
			segmentId = progress.id,
			colorName = progress.colorName,
			currentHits = progress.currentHits,
			requiredHits = progress.requiredHits,
			percent = Mathf.Clamp01(progress.completionPercent),
			isComplete = progress.currentHits >= progress.requiredHits,
			pathIndex = resolvedIndex
		};
		return true;
	}

	private ImpactFx RentCompletionFx()
	{
		if (!segmentCompletionFxPrefab) return null;
		EnsureCompletionFxRoots();

		ImpactFx fx = null;
		while (completionFxPool.Count > 0 && fx == null)
		{
			fx = completionFxPool.Dequeue();
		}

		if (!fx)
		{
			fx = Instantiate(segmentCompletionFxPrefab, completionFxActiveRoot);
		}

		if (!fx) return null;

		fx.transform.SetParent(completionFxActiveRoot, false);
		fx.gameObject.SetActive(true);
		fx.ResetToPoolState();
		completionFxActive.Add(fx);
		return fx;
	}

	private void ReturnCompletionFx(ImpactFx fx)
	{
		if (!fx) return;
		EnsureCompletionFxRoots();

		fx.ResetToPoolState();
		fx.gameObject.SetActive(false);
		completionFxActive.Remove(fx);

		int maxPool = Mathf.Max(0, segmentCompletionFxPoolSize);
		if (maxPool == 0 || completionFxPool.Count >= maxPool)
		{
			Destroy(fx.gameObject);
			return;
		}

		fx.transform.SetParent(completionFxPoolRoot, false);
		completionFxPool.Enqueue(fx);
	}

	private void EnsureCompletionFxRoots()
	{
		var parent = ResolveCompletionFxParent();
		if (!completionFxActiveRoot)
		{
			completionFxActiveRoot = new GameObject("SegmentCompletionFx_Active").transform;
			completionFxActiveRoot.SetParent(parent, false);
		}
		else if (completionFxActiveRoot.parent != parent)
		{
			completionFxActiveRoot.SetParent(parent, false);
		}

		if (!completionFxPoolRoot)
		{
			completionFxPoolRoot = new GameObject("SegmentCompletionFx_Pool").transform;
			completionFxPoolRoot.SetParent(parent, false);
			completionFxPoolRoot.gameObject.SetActive(false);
		}
		else if (completionFxPoolRoot.parent != parent)
		{
			completionFxPoolRoot.SetParent(parent, false);
		}
	}

	private void ClearCompletionBubbles()
	{
		foreach (var kv in completionBubbleById)
		{
			var inst = kv.Value;
			if (inst == null) continue;
			var go = inst.GameObject;
			if (go)
			{
				DOTween.Kill(go);
				if (inst.Rect) DOTween.Kill(inst.Rect);
				if (inst.Canvas) DOTween.Kill(inst.Canvas);
				Destroy(go);
			}
		}
		completionBubbleById.Clear();
		spawnedBubbleSegments.Clear();
	}

	private void CleanupCompletionFxRoots()
	{
		foreach (var fx in completionFxActive)
		{
			if (!fx) continue;
			DOTween.Kill(fx);
			DOTween.Kill(fx.transform);
			Destroy(fx.gameObject);
		}
		completionFxActive.Clear();

		while (completionFxPool.Count > 0)
		{
			var pooled = completionFxPool.Dequeue();
			if (pooled) Destroy(pooled.gameObject);
		}
		completionFxPool.Clear();

		if (completionFxActiveRoot)
		{
			Destroy(completionFxActiveRoot.gameObject);
			completionFxActiveRoot = null;
		}
		if (completionFxPoolRoot)
		{
			Destroy(completionFxPoolRoot.gameObject);
			completionFxPoolRoot = null;
		}
	}

	private Transform ResolveCompletionFxParent()
	{
		if (segmentCompletionFxParentOverride) return segmentCompletionFxParentOverride;
		if (path && path.ReferenceRect) return path.ReferenceRect;
		if (uiCanvas) return uiCanvas;
		return transform;
	}

	private void PositionCompletionFx(Transform target, Vector2 anchored)
	{
		if (!target) return;
		var parent = ResolveCompletionFxParent();
		var parentRect = parent as RectTransform;
		var rt = target as RectTransform;

		if (rt != null && parentRect != null)
		{
			rt.SetParent(parentRect, false);
			rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
			rt.pivot = new Vector2(0.5f, 0.5f);
			rt.localScale = Vector3.one;
			rt.anchoredPosition = anchored;
		}
		else
		{
			target.SetParent(parent, false);
			Vector3 world = path ? path.ReferenceLocalToWorld(new Vector3(anchored.x, anchored.y, 0f)) : new Vector3(anchored.x, anchored.y, 0f);
			target.position = world;
		}
	}

	private void LogMissingBubblePrefab()
	{
		if (loggedMissingBubblePrefab) return;
		loggedMissingBubblePrefab = true;
		Debug.LogWarning("[DiagramManager] No segment completion bubble prefab assigned; completion bubbles are disabled until a prefab is set.", this);
	}

	public void GlobalHitFeedback(int pathIndex, HitResult result)
	{
		if (!useGlobalFill) return;
		if (pathIndex < 0 || pathIndex >= path.Segments.Count) return;
		var id = path.Segments[pathIndex].id;
		// glow intensity distinguishes Good vs Perfect
		PulseGlow(id, (result == HitResult.Perfect) ? perfectGlow : goodGlow);
		GameplayEventBus.RaiseBroadcastHit();
	}

	public void GlobalMissFeedback(int pathIndex)
	{
		if (!useGlobalFill) return;
		if (pathIndex < 0 || pathIndex >= path.Segments.Count) return;
		var id = path.Segments[pathIndex].id;
		var ps = System.Array.Find(perimeterSegments, p => p.id == id);
		if (ps.shape)
		{
			TweenShapeColor(ps.shape, ps.shape.Color, missColor, 0.10f, Ease.OutQuad, true);
		}
	}

	private void PulseGlow(string id, float intensity)
	{
		var ps = System.Array.Find(perimeterSegments, p => p.id == id);
		if (ps.shape == null) return;
		Color baseCol = ps.shape.Color;
		Color flash = Color.Lerp(baseCol, Color.white, Mathf.Clamp01(intensity));
		TweenShapeColor(ps.shape, baseCol, flash, 0.12f, Ease.OutQuad, true);
	}

	private void RevealSegmentOutline(string id)
	{
		if (!hideOutlineUntilProgress) return;
		if (!revealedSegments.Add(id)) return;

		if (outlineById.TryGetValue(id, out var outline) && outline != null)
		{
			Color target = outlineBaseColor;
			DOTween.To(() => outline.Color, c => outline.Color = c, target, 0.35f)
				.SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(outline);
		}
	}

	private void ResetOutlineVisibility()
	{
		revealedSegments.Clear();
		if (!hideOutlineUntilProgress) return;

		foreach (var kv in outlineById)
		{
			if (!kv.Value) continue;
			Color hidden = outlineBaseColor;
			hidden.a = 0f;
			kv.Value.Color = hidden;
		}
	}

	void LateUpdate()
	{
		// Prune completed or null tweens safely
		if (highlightTweens.Count == 0)
			return;

		// Use a scratch list instead of LINQ ToArray to stay WebGL‑safe.
		_tweenPruneBuffer.Clear();
		foreach (var kvp in highlightTweens)
		{
			if (kvp.Value == null || !kvp.Value.active)
				_tweenPruneBuffer.Add(kvp.Key);
		}

		for (int i = 0; i < _tweenPruneBuffer.Count; i++)
		{
			highlightTweens.Remove(_tweenPruneBuffer[i]);
		}
	}

	void KillHighlightTweens()
	{
		// Iterate over a snapshot so OnKill callbacks that mutate the dictionary
		// (e.g., removing their own key) don't cause collection-modified errors.
		if (highlightTweens.Count == 0)
			return;

		_tweenPruneBuffer.Clear();
		foreach (var kvp in highlightTweens)
		{
			_tweenPruneBuffer.Add(kvp.Key);
		}

		for (int i = 0; i < _tweenPruneBuffer.Count; i++)
		{
			var key = _tweenPruneBuffer[i];
			if (highlightTweens.TryGetValue(key, out var tween) && tween != null)
				tween.Kill(false);
		}

		highlightTweens.Clear();
	}

	private sealed class ShapeNoteStats
	{
		public int totalNotes;
		public int[] notesPerColor; // index: 0=Green,1=Red,2=Yellow,3=Blue,4=Orange

		public ShapeNoteStats()
		{
			totalNotes = 0;
			notesPerColor = new int[5];
		}
	}

	private ShapeNoteStats ComputeShapeNoteStatsForCurrentShape(int shapeCount, int shapeOrdinal)
	{
		var stats = new ShapeNoteStats();

		var notes = ChartSystem.CachedNotes;
		if (notes == null || notes.Length == 0 || shapeCount <= 0)
			return stats;

		shapeCount = Mathf.Max(1, shapeCount);
		shapeOrdinal = Mathf.Clamp(shapeOrdinal, 0, shapeCount - 1);

		// Find the time span of the chart (in song-seconds).
		float minT = float.MaxValue;
		float maxT = float.MinValue;
		for (int i = 0; i < notes.Length; i++)
		{
			var n = notes[i];
			if (n == null) continue;
			float t = ChartSystem.GetNoteSongTime(n);
			if (t < minT) minT = t;
			if (t > maxT) maxT = t;
		}

		if (!float.IsFinite(minT) || !float.IsFinite(maxT) || maxT <= minT + 1e-4f)
		{
			// Fallback: no usable timing span; count all notes uniformly.
			for (int i = 0; i < notes.Length; i++)
			{
				var n = notes[i];
				if (n == null || n.ButtonIndexes == null) continue;

				for (int lane = 0; lane < 5 && lane < n.ButtonIndexes.Length; lane++)
				{
					if (!n.ButtonIndexes[lane]) continue;
					stats.totalNotes++;
					stats.notesPerColor[lane]++;
				}
			}
			return stats;
		}

		float span = maxT - minT;
		float slice = span / shapeCount;
		float sliceStart = minT + slice * shapeOrdinal;
		float sliceEnd = (shapeOrdinal == shapeCount - 1)
			? maxT + 1e-3f
			: minT + slice * (shapeOrdinal + 1);

		for (int i = 0; i < notes.Length; i++)
		{
			var n = notes[i];
			if (n == null) continue;

			float t = ChartSystem.GetNoteSongTime(n);
			if (t < sliceStart || t > sliceEnd)
				continue;

			if (n.ButtonIndexes == null) continue;

			for (int lane = 0; lane < 5 && lane < n.ButtonIndexes.Length; lane++)
			{
				if (!n.ButtonIndexes[lane]) continue;
				stats.totalNotes++;
				stats.notesPerColor[lane]++;
			}
		}

		return stats;
	}

	private static int ResolveColorIndex(string colorName)
	{
		if (string.IsNullOrEmpty(colorName)) return -1;
		switch (colorName.ToLower())
		{
			case "green": return 0;
			case "red": return 1;
			case "yellow": return 2;
			case "blue": return 3;
			case "orange": return 4;
			default: return -1;
		}
	}

	private void RebuildSegmentProgressRequirements()
	{
		segments.Clear();
		segmentProgressById.Clear();
		CurrentShapeRequiredHitsTotal = 0;

		if (perimeterSegments == null || perimeterSegments.Length == 0)
		{
			progressText.text = "0/0 SEGMENTS COMPLETED";
			return;
		}

		var scoreboard = ScoreManagerScript.Instance;
		int shapeCount = scoreboard ? scoreboard.TotalShapesInRun : 1;
		int shapeOrdinal = scoreboard ? scoreboard.CurrentShapeOrdinal : 0;
		shapeCount = Mathf.Max(1, shapeCount);
		shapeOrdinal = Mathf.Clamp(shapeOrdinal, 0, shapeCount - 1);

		float normalizedOrdinal = (shapeCount <= 1) ? 0f : (float)shapeOrdinal / (shapeCount - 1);
		float difficultyMultiplier = shapeDifficultyCurve != null ? Mathf.Max(0.1f, shapeDifficultyCurve.Evaluate(normalizedOrdinal)) : 1f;

		// 1) Estimate how many notes meaningfully "belong" to this shape
		//    by slicing the chart time-span into equal windows.
		var noteStats = ComputeShapeNoteStatsForCurrentShape(shapeCount, shapeOrdinal);

		int totalSegments = Mathf.Max(1, perimeterSegments.Length);
		int effectiveNotes = noteStats.totalNotes;
		if (effectiveNotes <= 0)
		{
			// Fallback: uniform share of the full chart, or a tiny default if chart is empty.
			effectiveNotes = ChartSystem.GetTotalSpawnedNotes();
			if (effectiveNotes <= 0)
				effectiveNotes = totalSegments * 2;
		}

		// Target total hits for this shape before segmentCompletionRequirement.
		float targetHitsTotal = Mathf.Max(totalSegments, (float)effectiveNotes);
		targetHitsTotal *= difficultyMultiplier;

		// 2) Build a weight per segment based on geometry length and lane note density.
		var weightById = new System.Collections.Generic.Dictionary<string, float>(perimeterSegments.Length);
		float totalWeight = 0f;

		float avgNotesPerColor = noteStats.totalNotes > 0 ? (float)noteStats.totalNotes / 5f : 0f;

		for (int i = 0; i < perimeterSegments.Length; i++)
		{
			var seg = perimeterSegments[i];
			if (seg.shape == null || string.IsNullOrEmpty(seg.id))
				continue;

			float geomWeight = 1f;
			if (path != null && path.Segments != null && path.Segments.Count > 0)
			{
				int pathIndex = GetPathIndexForSegmentId(seg.id);
				if (pathIndex >= 0 && pathIndex < path.Segments.Count)
				{
					float len = path.Segments[pathIndex].length;
					if (len > 1e-4f)
						geomWeight = len;
				}
			}

			float colorWeight = 1f;
			int colorIndex = ResolveColorIndex(seg.laneColor);
			if (colorIndex >= 0 && colorIndex < noteStats.notesPerColor.Length && avgNotesPerColor > 0f)
			{
				float count = noteStats.notesPerColor[colorIndex];
				// Normalize around 1.0 so average lanes are neutral,
				// busier lanes get >1, quieter lanes <1 (within a sane range).
				colorWeight = Mathf.Clamp(count / avgNotesPerColor, 0.5f, 2f);
			}

			float weight = Mathf.Max(0.01f, geomWeight * colorWeight);
			weightById[seg.id] = weight;
			totalWeight += weight;
		}

		if (totalWeight <= 1e-4f)
		{
			// Fall back to uniform weights if geometry/path data is missing.
			weightById.Clear();
			for (int i = 0; i < perimeterSegments.Length; i++)
			{
				var seg = perimeterSegments[i];
				if (seg.shape == null || string.IsNullOrEmpty(seg.id))
					continue;
				weightById[seg.id] = 1f;
			}
			totalWeight = Mathf.Max(1, weightById.Count);
		}

		// Earlier shapes should be easier to complete: require a smaller fraction of the
		// target hits for completion and ramp toward the authored requirement on later shapes.
		float baseCompletion = Mathf.Clamp01(segmentCompletionRequirement);
		float completionEase = Mathf.Lerp(0.6f, 1.0f, normalizedOrdinal); // 60% of base on first shape → 100% on last
		float completionThreshold = Mathf.Clamp01(baseCompletion * completionEase);

		foreach (var seg in perimeterSegments)
		{
			if (seg.shape == null || string.IsNullOrEmpty(seg.id))
				continue;

			if (!weightById.TryGetValue(seg.id, out var w) || w <= 0f)
				w = 1f;

			float share = w / totalWeight;
			float rawTarget = Mathf.Max(1f, targetHitsTotal * share);
			int rawHits = Mathf.Max(1, Mathf.CeilToInt(rawTarget));
			int requiredHits = Mathf.Max(1, Mathf.CeilToInt(rawHits * completionThreshold));

			var progress = new SegmentProgress
			{
				id = seg.id,
				colorName = seg.laneColor,
				requiredHits = requiredHits,
				currentHits = 0
			};
			segments.Add(progress);
			segmentProgressById[progress.id] = progress;
			BroadcastSegmentProgress(progress);
			CurrentShapeRequiredHitsTotal += requiredHits;
		}

		progressText.text = $"0/{segments.Count} SEGMENTS COMPLETED";
	}
}
