using System;

using ChartLoader.NET.Framework;

using UnityEngine;

/// <summary>
/// Central broadcast hub so gameplay, UI, and VFX can vibe together without hard refs.
/// Static on purpose; we manually reset on domain-reload off.
/// </summary>
public static class GameplayEventBus
{
	// ---------------------------------------------
	// YUP YUP YUP YUPPPP SENDING SIGNALS TO THE BUS
	// ---------------------------------------------

	/// <summary>Raised after a chart has been parsed and cached.</summary>
	public static event Action<Chart, Note[]> ChartInitialized;

	/// <summary>Raised when note instances are spawned (per difficulty).</summary>
	public static event Action<Note[]> NotesSpawned;

	/// <summary>Raised whenever the visualization mode changes at runtime.</summary>
	public static event Action<ChartSystem.VisualizationMode> VisualizationModeChanged;

	/// <summary>Raised on each beat tick emitted by ChartSystem.</summary>
	public static event Action Beat;

	/// <summary>Raised when a beat (or note impact) is scheduled with timing metadata.</summary>
	public static event Action<BeatPayload> BeatScheduled;

	/// <summary>Raised when a scheduled beat resolves to a concrete judgement.</summary>
	public static event Action<BeatPayload, HitResult> BeatResolved;

	/// <summary>Raised once when gameplay reaches its natural end.</summary>
	public static event Action ChartCompleted;

	/// <summary>Raised when the perimeter camera reaches the birds-eye post-pan.</summary>
	public static event Action CameraPannedToBirdsEye;

	/// <summary>Raised when the perimeter camera returns to perspective view.</summary>
	public static event Action CameraPannedToPerspective;

	/// <summary>Raised when perimeter wall building begins.</summary>
	public static event Action WallGenerationStarted;

	/// <summary>Raised after the final wall section completes.</summary>
	public static event Action WallGenerationFinished;

	/// <summary>Raised every time a perimeter wall section completes.</summary>
	public static event Action<int> WallSectionCompleted;

	/// <summary>Raised when ScoreManager logs a hit judgement (hit type, current streak).</summary>
	public static event Action<RhythmHitKind, int> HitJudged;

	public static event Action BroadcastHit;

	public static event Action<GameObject> OnPerimeterShapeChanged;
	public static event Action<float, int> PerimeterHeadMoved;
	public static event Action<string, float, bool> SegmentProgressed;

	public static event Action OnPerimeterComplete;
	public static event Action<string, string> SegmentCompleted;

	/// <summary>
	/// Raised when a lane hit is reinterpreted by the current phase (laneIndex, semanticCode, hitKind).
	/// semanticCode is an optional lane reinterpretation value supplied by higher-level gameplay flows.
	/// </summary>
	public static event Action<int, int, RhythmHitKind> LaneSemanticTriggered;

	/// <summary>Raised when gameplay enters a lull with no imminent notes.</summary>
	public static event Action<float> DowntimeWindowStarted;

	/// <summary>Raised when the downtime window ends and input timing resumes.</summary>
	public static event Action DowntimeWindowEnded;

	/// <summary>Raised when a phrase boundary is reached (section or derived boundary).</summary>
	public static event Action<PhraseBoundaryPayload> PhraseBoundaryReached;

	/// <summary>Combo tiers we’ll use for “heat” escalation.</summary>
	public enum StreakTier { None = 0, Tier1 = 1, Tier2 = 2, Tier3 = 3 }

	/// <summary>
	/// Streak threshold crossed OR heat ramped within a tier.
	/// (streakCount, tier, heat[0..1])
	/// </summary>
	public static event Action<int, StreakTier, float> StreakTierChanged;

	/// <summary>Raw heat broadcast (0..1). Use if you don’t care about tiers.</summary>
	public static event Action<float> HeatChanged;

	/// <summary>Raised when we hard-restart gameplay (so VFX/heat/UI can zero instantly).</summary>
	public static event Action ChartRestarted;

	public static event Action<int> OnNotesSpawned;

	/// <summary>Raised when a tutorial step is entered (stepIndex).</summary>
	public static event Action<int> TutorialStepEntered;

	/// <summary>Raised when a drag is completed during tutorial (dragCount).</summary>
	public static event Action<int> TutorialDragCompleted;

	/// <summary>Raised when the tutorial is fully completed.</summary>
	public static event Action TutorialCompleted;

	public static ShapeSelectButton.ShapeType currentShape = ShapeSelectButton.ShapeType.Empty;

	public static AudioClip uploadedClip = null;
	public static string generatedChartFilePath = "";

	// ------------------------------------------------
	// Reset dance — editor-friendly, kills stale subs
	// ------------------------------------------------

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
	private static void ResetStatics() => Reset();

	/// <summary>Clears all subscribers; essential when domain reload is disabled in editor.</summary>
	public static void Reset()
	{
		ChartInitialized = null;
		NotesSpawned = null;
		VisualizationModeChanged = null;
		Beat = null;
		BeatScheduled = null;
		BeatResolved = null;
		ChartCompleted = null;
		CameraPannedToBirdsEye = null;
		CameraPannedToPerspective = null;
		WallGenerationStarted = null;
		WallGenerationFinished = null;
		WallSectionCompleted = null;
		HitJudged = null;
		SegmentCompleted = null;
		PerimeterHeadMoved = null;
		SegmentProgressed = null;
		BroadcastHit = null;
		OnPerimeterShapeChanged = null;
		OnPerimeterComplete = null;
		OnNotesSpawned = null;
		LaneSemanticTriggered = null;

		// new ones
		StreakTierChanged = null;
		HeatChanged = null;
		ChartRestarted = null;
		DowntimeWindowStarted = null;
		DowntimeWindowEnded = null;
		PhraseBoundaryReached = null;

		// tutorial events
		TutorialStepEntered = null;
		TutorialDragCompleted = null;
		TutorialCompleted = null;
	}

	// -----------------------------
	// Raisers (thin, inlined sugar)
	// -----------------------------

	public static void RaiseChartInitialized(Chart chart, Note[] cachedNotes) => ChartInitialized?.Invoke(chart, cachedNotes);

	public static void RaiseNotesSpawned(Note[] cachedNotes) => NotesSpawned?.Invoke(cachedNotes);

	public static void RaiseVisualizationModeChanged(ChartSystem.VisualizationMode mode) => VisualizationModeChanged?.Invoke(mode);

	public static void RaiseBeat() => Beat?.Invoke();

	public static void RaiseBeatScheduled(in BeatPayload payload) => BeatScheduled?.Invoke(payload);

	public static void RaiseBeatResolved(in BeatPayload payload, HitResult result) => BeatResolved?.Invoke(payload, result);

	public static bool RaiseChartCompleted()
	{
		if (ChartCompleted == null) return false;
		ChartCompleted.Invoke();
		return true;
	}

	public static void RaiseCameraPannedToBirdsEye() => CameraPannedToBirdsEye?.Invoke();
	public static void RaiseCameraPannedToPerspective() => CameraPannedToPerspective?.Invoke();
	public static void RaiseWallGenerationStarted() => WallGenerationStarted?.Invoke();
	public static void RaiseWallGenerationFinished() => WallGenerationFinished?.Invoke();
	public static void RaiseWallSectionCompleted(int index) => WallSectionCompleted?.Invoke(index);
	public static void RaiseHitJudged(RhythmHitKind hit, int streak) => HitJudged?.Invoke(hit, streak);
	public static void RaisePerimeterShapeChanged(GameObject perimeterInstance) => OnPerimeterShapeChanged?.Invoke(perimeterInstance);
	public static void RaisePerimeterComplete() => OnPerimeterComplete?.Invoke();
	public static void RaiseBroadcastHit() => BroadcastHit?.Invoke();
	public static void RaiseLaneSemanticTriggered(int laneIndex, int semanticCode, RhythmHitKind hitKind) => LaneSemanticTriggered?.Invoke(laneIndex, semanticCode, hitKind);
	public static void RaiseSpawnedNotes(int totalNotes) => OnNotesSpawned?.Invoke(totalNotes);
	public static void RaiseSegmentCompleted(string segmentId, string colorName) => SegmentCompleted?.Invoke(segmentId, colorName);
	public static void RaisePerimeterHeadMoved(float normalizedT, int pathIndex) => PerimeterHeadMoved?.Invoke(Mathf.Repeat(normalizedT, 1f), pathIndex);
	public static void RaiseSegmentProgressed(string segmentId, float percent, bool isComplete) =>
	SegmentProgressed?.Invoke(segmentId, Mathf.Clamp01(percent), isComplete);

	// new ones
	public static void RaiseStreakTierChanged(int streak, StreakTier tier, float heat) => StreakTierChanged?.Invoke(streak, tier, Mathf.Clamp01(heat));

	public static void RaiseHeatChanged(float heat) => HeatChanged?.Invoke(Mathf.Clamp01(heat));

	public static void RaiseChartRestarted() => ChartRestarted?.Invoke();

	public static void RaiseDowntimeWindowStarted(float expectedDurationSeconds) => DowntimeWindowStarted?.Invoke(Mathf.Max(0f, expectedDurationSeconds));

	public static void RaiseDowntimeWindowEnded() => DowntimeWindowEnded?.Invoke();

	public static void RaisePhraseBoundaryReached(in PhraseBoundaryPayload payload) => PhraseBoundaryReached?.Invoke(payload);

	// tutorial raise helpers
	public static void RaiseTutorialStepEntered(int stepIndex) => TutorialStepEntered?.Invoke(stepIndex);

	public static void RaiseTutorialDragCompleted(int dragCount) => TutorialDragCompleted?.Invoke(dragCount);

	public static void RaiseTutorialCompleted() => TutorialCompleted?.Invoke();
}


/// <summary>
/// Editor-only debug shim so you can poke the bus in Play Mode without writing temp code.
/// Safe to delete. Uses Odin if present; still compiles without.
/// </summary>
#if UNITY_EDITOR
public class GameplayEventBusDebug : MonoBehaviour
{
	// minimal editor UI without Odin
	[Header("HitJudged")]
	public RhythmHitKind debugHit = RhythmHitKind.Good;
	[Min(0)] public int debugStreak = 0;

	[ContextMenu("Fire: HitJudged")]
	void FireHit() => GameplayEventBus.RaiseHitJudged(debugHit, debugStreak);

	[Header("Tier / Heat")]
	public int dbgStreak = 12;
	public GameplayEventBus.StreakTier dbgTier = GameplayEventBus.StreakTier.Tier1;
	[Range(0, 1)] public float dbgHeat = 0.5f;

	[ContextMenu("Fire: StreakTierChanged")]
	void FireTier() => GameplayEventBus.RaiseStreakTierChanged(dbgStreak, dbgTier, dbgHeat);

	[ContextMenu("Fire: HeatChanged")]
	void FireHeat() => GameplayEventBus.RaiseHeatChanged(dbgHeat);

	[ContextMenu("Fire: ChartRestarted")]
	void FireRestart() => GameplayEventBus.RaiseChartRestarted();
}
#endif
