using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;

/// <summary>
/// Tracks hit quality, combo streaks, and broadcasts judgement data so UI/VFX layers stay reactive.
/// </summary>
public class ScoreManagerScript : MonoBehaviour
{
	public static ScoreManagerScript Instance;

	public string totalMissionTime;
	public int totalGameGems;
	public int perfectTimeGems;
	public int wellTimedGems;
	public int missedGems;
	public int destroyedGems;
	public int SegmentsCompleted { get; private set; }
	public int ComboRecord { get; private set; }
	public int CurrentStreak { get; private set; }
	public float RollingAccuracy { get; private set; }

	[SerializeField] private GameObject InGameScoreDisplayGameObject;
	[SerializeField, Tooltip("How many latest hits feed the rolling accuracy calculation.")]
	private int rollingWindowSize = 30;

	// --- Streak tiers / heat (for feel escalation) ---
	[SerializeField, Tooltip("Heat Tier 1 threshold (start of 'Flow')")]
	private int tier1Threshold = 10;
	[SerializeField, Tooltip("Heat Tier 2 threshold (start of 'Overdrive')")]
	private int tier2Threshold = 25;
	[SerializeField, Tooltip("Heat Tier 3 threshold (start of 'Voltage')")]
	private int tier3Threshold = 50;
	public int Tier1Threshold => tier1Threshold;
	public int Tier2Threshold => tier2Threshold;
	public int Tier3Threshold => tier3Threshold;
	[SerializeField, Range(0f, 1f), Tooltip("How hard we lerp toward the target heat on each hit; higher = snappier")]
	private float heatLerp = 0.75f;

	private GameplayEventBus.StreakTier _currentTier = GameplayEventBus.StreakTier.None;
	private float _currentHeat = 0f; // 0..1 within the current tier

	public event Action<RhythmHitKind, int> OnHitRegistered; // External listeners (FEEL, Text Animator, etc.)
	public event Action<int> OnStreakChanged;
	public event Action OnStreakBroken;
	public event Action<string, float, bool> OnSegmentProgressed;
	public event Action<float, int> OnPerimeterHeadMoved;
	public event Action<string, int> OnSegmentMilestone;

	private readonly Queue<RhythmHitKind> recentHits = new Queue<RhythmHitKind>();
	private readonly Dictionary<string, int> segmentMilestoneById = new();
	private PerimeterShapeRun currentPerimeterShape;
	private readonly List<PerimeterShapeRun> completedPerimeterShapes = new();
	private PerimeterQuizPayload pendingQuizPayload;
	private bool hasPendingQuizPayload = false;
	[SerializeField, Tooltip("Default tolerance applied to the perimeter quiz answer.")] private float perimeterQuizTolerance = 0.1f;
	private int currentShapeOrdinal = 0;
	private int totalShapesInRun = 1;
	private ShapeFormulaRuntimeData _currentShapeFormula = ShapeFormulaRuntimeData.Empty;

	public int CurrentShapeOrdinal => currentShapeOrdinal;
	public int TotalShapesInRun => totalShapesInRun;

	public struct SegmentDistanceEntry
	{
		public string segmentId;
		public string label;
		public float distanceValue;
	}

	public struct PerimeterQuizPayload
	{
		public float totalDistance;
		public float tolerance;
		public List<SegmentDistanceEntry> segments;
		public ShapeFormulaRuntimeData formula;
	}

	private sealed class PerimeterShapeRun
	{
		public ShapeSelectButton.ShapeType ShapeType { get; }
		public List<SegmentDistanceEntry> Segments { get; } = new();

		public PerimeterShapeRun(ShapeSelectButton.ShapeType shapeType)
		{
			ShapeType = shapeType;
		}

		public void AddOrUpdate(string segmentId, string label, float value)
		{
			var entry = new SegmentDistanceEntry
			{
				segmentId = segmentId,
				label = label,
				distanceValue = Mathf.Max(0f, value)
			};

			int existingIndex = Segments.FindIndex(s => s.segmentId == segmentId);
			if (existingIndex >= 0)
				Segments[existingIndex] = entry;
			else
				Segments.Add(entry);
		}

		public float TotalDistance
		{
			get
			{
				float total = 0f;
				if (Segments != null)
				{
					for (int i = 0; i < Segments.Count; i++)
					{
						total += Segments[i].distanceValue;
					}
				}
				return total;
			}
		}

		public List<SegmentDistanceEntry> Snapshot() => new List<SegmentDistanceEntry>(Segments);
	}

    private void Awake()
    {
        // Persist one scoreboard so scene swaps don't reset combo state mid-song.
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Auto-wire score display on boot and on scene changes
            SceneManager.sceneLoaded += OnSceneLoaded;
            GameplayEventBus.SegmentCompleted += HandleSegmentCompleted;
            GameplayEventBus.OnPerimeterComplete += HandlePerimeterComplete;
            ResolveScoreDisplayTarget();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    private void OnDestroy()
    {
        if (Instance == this)
        {
            SceneManager.sceneLoaded -= OnSceneLoaded;
            GameplayEventBus.SegmentCompleted -= HandleSegmentCompleted;
            GameplayEventBus.PerimeterHeadMoved -= HandlePerimeterHeadMovedEvent;
            GameplayEventBus.SegmentProgressed -= HandleSegmentProgressedEvent;
            GameplayEventBus.OnPerimeterComplete -= HandlePerimeterComplete;
        }
    }

	private void OnEnable()
	{
		if (Instance == this)
		{
			GameplayEventBus.PerimeterHeadMoved += HandlePerimeterHeadMovedEvent;
			GameplayEventBus.SegmentProgressed += HandleSegmentProgressedEvent;
			ShapeFormulaRuntime.FormulaChanged += HandleShapeFormulaChanged;
		}
	}

	private void OnDisable()
	{
		if (Instance == this)
		{
			GameplayEventBus.PerimeterHeadMoved -= HandlePerimeterHeadMovedEvent;
			GameplayEventBus.SegmentProgressed -= HandleSegmentProgressedEvent;
			ShapeFormulaRuntime.FormulaChanged -= HandleShapeFormulaChanged;
		}
	}

    private void OnSceneLoaded(Scene scene, LoadSceneMode mode)
    {
        // Re-resolve after scene switches since this object is persistent
        ResolveScoreDisplayTarget();
    }

    private void ResolveScoreDisplayTarget()
    {
        if (InGameScoreDisplayGameObject != null) return;

        InGameScoreDisplay found = null;
        try
        {
#if UNITY_2023_1_OR_NEWER
            found = UnityEngine.Object.FindFirstObjectByType<InGameScoreDisplay>(UnityEngine.FindObjectsInactive.Include);
#else
            // Fallback that also finds inactive instances but filters out assets/prefabs
            var all = Resources.FindObjectsOfTypeAll<InGameScoreDisplay>();
            foreach (var d in all)
            {
                if (d && d.gameObject && d.gameObject.scene.IsValid()) { found = d; break; }
            }
#endif
        }
        catch { /* ignored */ }

        if (found)
            InGameScoreDisplayGameObject = found.gameObject;
    }

	/// <summary>
	/// Register a hit/miss judgement and notify listeners (UI, VFX, analytics).
	/// </summary>
	public void RegisterNoteHit(string hitType)
	{
		var hit = ParseHit(hitType);
		RegisterNoteHit(hit);
	}

	/// <summary>
	/// Overload so systems can call with the enum directly (no string allocations).
	/// </summary>
	public void RegisterNoteHit(RhythmHitKind hit)
	{
		if (hit == RhythmHitKind.Unknown)
			return;

        if (hit == RhythmHitKind.Miss)
        {
            if (CurrentStreak != 0)
            {
                if (!InGameScoreDisplayGameObject)
                    ResolveScoreDisplayTarget();
                if (InGameScoreDisplayGameObject)
                    ExecuteEvents.Execute<IScoreManagerGameplayMessage>(InGameScoreDisplayGameObject, null, (x, y) => x.TriggerStreakBrokenTextPulse());
            }

			CurrentStreak = 0;
			missedGems++;
			OnStreakBroken?.Invoke();

			// Heat/tier hard reset on miss
			UpdateTierAndHeatBroadcast(forceEmit:true);
		}
		else
		{
			CurrentStreak++;
			ComboRecord = Mathf.Max(ComboRecord, CurrentStreak); // chasing combo art like Chainsaw Man splash pages, now.

			// Heat/tier climb on non-miss
			UpdateTierAndHeatBroadcast();
		}

		totalGameGems++;

		if (hit == RhythmHitKind.Perfect)
		{
			perfectTimeGems++;
		}
		else if (hit == RhythmHitKind.Good)
		{
			wellTimedGems++;
		}

		TrackRollingAccuracy(hit);
		OnStreakChanged?.Invoke(CurrentStreak);
		OnHitRegistered?.Invoke(hit, CurrentStreak);
		GameplayEventBus.RaiseHitJudged(hit, CurrentStreak);
	}

	public void SetTotalMissionTime(string formattedTime)
	{
		totalMissionTime = formattedTime;
	}

	public void RegisterNoteDestroyed()
	{
		destroyedGems++;
	}

	public void BeginPerimeterShape(ShapeSelectButton.ShapeType shapeType)
	{
		if (shapeType == ShapeSelectButton.ShapeType.Empty)
			shapeType = GameplayEventBus.currentShape;

		FinalizePerimeterShapeRun();
		currentPerimeterShape = new PerimeterShapeRun(shapeType);
		EnsureCalibrationForCurrentMode();
	}

	public void SetShapeRunContext(int ordinal, int shapeCount)
	{
		totalShapesInRun = Mathf.Max(1, shapeCount);
		currentShapeOrdinal = Mathf.Clamp(ordinal, 0, totalShapesInRun - 1);
	}

	public void RecordPerimeterSegment(string segmentId, string label, float numericValue, float fallbackLength)
	{
		if (string.IsNullOrEmpty(segmentId))
			return;

		if (currentPerimeterShape == null)
		{
			var inferredShape = GameplayEventBus.currentShape;
			currentPerimeterShape = new PerimeterShapeRun(inferredShape);
		}

		float value = numericValue > 0f ? numericValue : Mathf.Max(0f, fallbackLength);
		currentPerimeterShape.AddOrUpdate(segmentId, label, value);
	}

	public void FinalizePerimeterShapeRun()
	{
		if (currentPerimeterShape == null)
			return;

		if (currentPerimeterShape.Segments.Count > 0)
			completedPerimeterShapes.Add(currentPerimeterShape);

		currentPerimeterShape = null;
	}

	public void PreparePerimeterQuizFromLastShape(float? toleranceOverride = null)
	{
		PerimeterShapeRun source = currentPerimeterShape;
		if (source == null && completedPerimeterShapes != null && completedPerimeterShapes.Count > 0)
		{
			// Use the most recently completed shape run (manual LastOrDefault equivalent).
			source = completedPerimeterShapes[completedPerimeterShapes.Count - 1];
		}

		if (source == null || source.Segments.Count == 0)
		{
			hasPendingQuizPayload = false;
			pendingQuizPayload = default;
			return;
		}

		pendingQuizPayload = new PerimeterQuizPayload
		{
			totalDistance = Mathf.Max(0f, source.TotalDistance),
			tolerance = toleranceOverride ?? perimeterQuizTolerance,
			segments = source.Snapshot(),
			formula = _currentShapeFormula
		};
		hasPendingQuizPayload = true;
	}

	public bool TryConsumePerimeterQuiz(out PerimeterQuizPayload payload)
	{
		payload = pendingQuizPayload;
		if (!hasPendingQuizPayload)
			return false;

		hasPendingQuizPayload = false;
		pendingQuizPayload = default;
		return true;
	}

	// Reset counters between tracks (e.g., after retry or scene swap).
	public void ResetScore()
	{
		totalGameGems = 0;
		perfectTimeGems = 0;
		wellTimedGems = 0;
		missedGems = 0;
		CurrentStreak = 0;
		ComboRecord = 0;
		RollingAccuracy = 0;
		SegmentsCompleted = 0;
		recentHits.Clear();
		segmentMilestoneById.Clear();
		currentPerimeterShape = null;
		completedPerimeterShapes.Clear();
		hasPendingQuizPayload = false;
		pendingQuizPayload = default;
		currentShapeOrdinal = 0;
		totalShapesInRun = 1;

		// zero heat/tier and let downstream reset visuals instantly
		_currentTier = GameplayEventBus.StreakTier.None;
		_currentHeat = 0f;
		GameplayEventBus.RaiseStreakTierChanged(0, _currentTier, _currentHeat);
		GameplayEventBus.RaiseHeatChanged(0f);
		_currentShapeFormula = ShapeFormulaRuntime.Current;
		GameplayEventBus.RaiseChartRestarted();
		EnsureCalibrationForCurrentMode();
	}

	private void EnsureCalibrationForCurrentMode()
	{
		if (ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter)
			JudgementService.CalibrationOffsetMs = 0f;
	}

	private RhythmHitKind ParseHit(string hitType)
	{
		if (string.IsNullOrEmpty(hitType)) return RhythmHitKind.Unknown;
		switch (hitType)
		{
			case "Perfect": return RhythmHitKind.Perfect;
			case "Good": return RhythmHitKind.Good;
			case "Miss": return RhythmHitKind.Miss;
			default: return RhythmHitKind.Unknown;
		}
	}

	// Keeps a rolling vibe check -  “be fr” 
	private void TrackRollingAccuracy(RhythmHitKind hit)
		{
			if (hit == RhythmHitKind.Unknown) return;

			recentHits.Enqueue(hit);
			if (recentHits.Count > Mathf.Max(rollingWindowSize, 5))
				recentHits.Dequeue();

			int weighted = 0;
			foreach (var h in recentHits)
			{
				switch (h)
				{
					case RhythmHitKind.Perfect: weighted += 2; break;
					case RhythmHitKind.Good: weighted += 1; break;
				}
			}

		int maxScore = recentHits.Count * 2;
		RollingAccuracy = maxScore == 0 ? 0 : Mathf.Clamp01((float)weighted / maxScore);
	}

	// --- Heat / Tier math & broadcast -------------------------------------------------

	private void UpdateTierAndHeatBroadcast(bool forceEmit = false)
	{
		// compute tier based on thresholds
		var newTier = GameplayEventBus.StreakTier.None;
		if (CurrentStreak >= tier3Threshold) newTier = GameplayEventBus.StreakTier.Tier3;
		else if (CurrentStreak >= tier2Threshold) newTier = GameplayEventBus.StreakTier.Tier2;
		else if (CurrentStreak >= tier1Threshold) newTier = GameplayEventBus.StreakTier.Tier1;

		// compute target heat (0..1) WITHIN the current tier (nice for per-tier escalation)
		float targetHeat = 0f;
		if (newTier == GameplayEventBus.StreakTier.Tier1)
			targetHeat = Mathf.InverseLerp(tier1Threshold, tier2Threshold, CurrentStreak);
		else if (newTier == GameplayEventBus.StreakTier.Tier2)
			targetHeat = Mathf.InverseLerp(tier2Threshold, tier3Threshold, CurrentStreak);
		else if (newTier == GameplayEventBus.StreakTier.Tier3)
			targetHeat = 1f; // you’re cooking

		// smooth toward target so heat feels organic (still event-driven)
		float prevHeat = _currentHeat;
		_currentHeat = Mathf.Lerp(_currentHeat, targetHeat, Mathf.Clamp01(heatLerp));

		bool tierChanged = newTier != _currentTier;
		bool heatMoved   = !Mathf.Approximately(prevHeat, _currentHeat);

		if (tierChanged || heatMoved || forceEmit)
		{
			_currentTier = newTier;
			GameplayEventBus.RaiseStreakTierChanged(CurrentStreak, _currentTier, _currentHeat);
			GameplayEventBus.RaiseHeatChanged(_currentHeat);
		}
	}

	private void HandleSegmentCompleted(string segmentId, string colorName)
	{
		SegmentsCompleted = Mathf.Max(0, SegmentsCompleted + 1);
	}

	private void HandleSegmentProgressedEvent(string segmentId, float percent, bool isComplete)
	{
		OnSegmentProgressed?.Invoke(segmentId, percent, isComplete);

		int quarter = Mathf.Clamp(Mathf.FloorToInt(percent * 4f), 0, 4);
		if (!segmentMilestoneById.TryGetValue(segmentId, out var prev) || quarter > prev)
		{
			segmentMilestoneById[segmentId] = quarter;
			OnSegmentMilestone?.Invoke(segmentId, quarter);
		}
	}

	private void HandlePerimeterHeadMovedEvent(float normalizedT, int pathIndex)
	{
		OnPerimeterHeadMoved?.Invoke(normalizedT, pathIndex);
	}

	private void HandlePerimeterComplete()
	{
		FinalizePerimeterShapeRun();
	}

	private void HandleShapeFormulaChanged(ShapeFormulaRuntimeData data)
	{
		_currentShapeFormula = data;
	}
}
