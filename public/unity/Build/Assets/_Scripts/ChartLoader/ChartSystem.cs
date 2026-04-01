using UnityEngine;
using ChartLoader.NET.Framework;
using ChartLoader.NET.Utils;
using Sirenix.OdinInspector; // Odin namespace
using System.IO; //  System.IO 
using UnityEngine.Networking; // For WebGL compatibility
using System.Collections; // For IEnumerator
using System.Collections.Generic;
using System;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using DG.Tweening;

public class ChartSystem : MonoBehaviour
{
	#region Chart Settings
	[TabGroup("Chart Settings")]
	public static Chart Chart;
	public static event Action OnChartInitialized;
	#endregion

	#region Difficulty Settings
	[TabGroup("Difficulty Settings")]
	public enum Difficulty
	{
		EasyGuitar,
		MediumGuitar,
		HardGuitar,
		ExpertGuitar,
		EasyDrums,
		MediumDrums,
		HardDrums,
		ExpertDrums
	}

	[TabGroup("Difficulty Settings")]
	[SerializeField]
	private Difficulty difficulty;

	public Difficulty CurrentDifficulty => difficulty;

	/// <summary>
	/// Sets chart difficulty and optionally reloads the current chart.
	/// </summary>
	public void SetDifficulty(Difficulty next, bool reloadChart = true, bool preservePlaybackPosition = false)
	{
		if (difficulty == next)
			return;

		difficulty = next;
		if (reloadChart)
			ReloadChart(preservePlaybackPosition);
	}
	#endregion

	#region Game Settings
	[TabGroup("General Settings")]
	[SerializeField, Range(1f, 60f), Tooltip("The game speed.")]
	private float _speed = 1f;
	public float Speed
	{
		get { return _speed; }
		set { _speed = value; }
	}
	public enum VisualizationMode { Highway, WispPerimeter }
	public enum NoteDirection { LeftToRight, RightToLeft, UpToDown, DownToUp, GuitarHeroStyle }
	private enum Axis
	{
		X,
		Z
	}
	public NoteDirection direction = NoteDirection.RightToLeft;
	[TabGroup("General Settings")]
	[SerializeField]
	public VisualizationMode vizMode = VisualizationMode.Highway;

	public static VisualizationMode CurrentVisualizationMode { get; private set; } = VisualizationMode.Highway;

	[TabGroup("General Settings"), Tooltip("Judgement windows used when Visualization Mode is Highway.")]
	[SerializeField] private HitWindows highwayJudgement = new HitWindows(0.10f, 0.20f, 0.50f);
	[TabGroup("General Settings"), Tooltip("Judgement windows used when Visualization Mode is WispPerimeter.")]
	[SerializeField] private HitWindows wispJudgement = new HitWindows(0.375f, 0.50f, 0.675f);

	private struct HighwayNoteState
	{
		public float songTime;
		public Note note;
		public Transform[] lanes;
		public bool spawned;
	}
	private Axis highwayTravelAxis;
	private int highwayDirectionSign;
	private float[] highwayLaneOffsets;

	[SerializeField] private GameObject timelineGameObject;
	private readonly List<Transform[]> noteTransforms = new List<Transform[]>();
	private readonly List<HighwayNoteState> highwayStates = new List<HighwayNoteState>();
	private int highwaySpawnIndex = 0;
	private int highwayDespawnIndex = 0;
	private readonly List<Queue<Transform>> highwayPools = new List<Queue<Transform>>();
	[TabGroup("General Settings"), Tooltip("Seconds ahead of song time to keep highway notes alive.")]
	[SerializeField] private float highwaySpawnLookaheadSeconds = 6f;
	[TabGroup("General Settings"), Tooltip("Seconds past hit time to keep highway notes alive before recycling.")]
	[SerializeField] private float highwayDespawnPastSeconds = 2f;
	private Coroutine songEndRoutine;
	private bool hasTriggeredEndGame;

	[TabGroup("General Settings")]
	[SerializeField]
	private string _path; // Path relative to StreamingAssets
	public string Path
	{
		get { return _path; }
		set { _path = value; Debug.Log($"[ChartSystem] Path rerouted to '{_path}'."); }
	}

	[TabGroup("General Settings")]
	public enum BeatScheduleMode
	{
		/// <summary>
		/// Historical behaviour: treat each unique note timestamp as a beat pulse.
		/// Best when charts are authored as "one note per beat" marker charts.
		/// </summary>
		FromNotes = 0,

		/// <summary>
		/// Schedule beats using the chart's SyncTrack (quarter notes).
		/// Best when using dense Guitar Hero-style charts where notes are not beats.
		/// </summary>
		FromSyncTrackQuarterNotes = 1
	}

	[TabGroup("General Settings"), SerializeField, Tooltip("Controls how GameplayEventBus.Beat pulses are scheduled.")]
	private BeatScheduleMode beatScheduleMode = BeatScheduleMode.FromNotes;

	public BeatScheduleMode BeatMode => beatScheduleMode;

	public void SetBeatScheduleMode(BeatScheduleMode mode)
	{
		if (beatScheduleMode == mode)
		{
			return;
		}

		beatScheduleMode = mode;

		// If the chart is already live, rebuild the scheduled beat list so runtime consumers
		// (e.g. algebra wisp/journey timing) immediately reflect the new scheduling source.
		if (_isChartInitialized && CachedNotes != null)
		{
			ScheduleBeats(CachedNotes);
			PrimeBeatCursorForCurrentPlayback();
		}
	}

	/// <summary>
	/// Returns a beat window based on the currently scheduled beat pulses (notes or SyncTrack, depending on BeatMode).
	/// Output times are absolute song-time values on the same axis as AudioManager.GetAdjustedSongTime().
	/// </summary>
	public bool TryGetScheduledBeatWindow(double nowSongTime, int steps, out double startSongTime, out double endSongTime, out float beatSeconds, out int targetSequenceIndex)
	{
		startSongTime = nowSongTime;
		endSongTime = nowSongTime;
		beatSeconds = 0.5f;
		targetSequenceIndex = -1;

		if (scheduledBeats == null || scheduledBeats.Count == 0)
		{
			return false;
		}

		int count = scheduledBeats.Count;
		int s = Mathf.Clamp(steps, 1, 32);
		double anchor = chartSongAnchorTime;
		float localNow = (float)(nowSongTime - anchor);

		int idx = scheduledBeats.BinarySearch(localNow);
		if (idx < 0)
		{
			idx = ~idx;
		}

		int previous = idx - 1;
		if (previous >= 0 && previous < count)
		{
			startSongTime = anchor + scheduledBeats[previous];
		}

		beatSeconds = EstimateScheduledBeatSeconds(previous >= 0 ? previous : Mathf.Clamp(idx, 0, count - 1));

		if (previous < 0)
		{
			targetSequenceIndex = Mathf.Clamp(s - 1, 0, count - 1);
		}
		else
		{
			targetSequenceIndex = Mathf.Clamp(previous + s, 0, count - 1);
		}

		endSongTime = anchor + scheduledBeats[targetSequenceIndex];
		if (endSongTime <= startSongTime + 0.0001d)
		{
			endSongTime = startSongTime + (Mathf.Max(0.05f, beatSeconds) * s);
			targetSequenceIndex = -1;
		}

		return true;
	}

	private float EstimateScheduledBeatSeconds(int referenceIndex)
	{
		if (scheduledBeats == null || scheduledBeats.Count < 2)
		{
			return 0.5f;
		}

		int count = scheduledBeats.Count;
		int a = Mathf.Clamp(referenceIndex, 0, count - 2);
		int b = Mathf.Clamp(a + 1, 1, count - 1);
		float dt = scheduledBeats[b] - scheduledBeats[a];
		if (dt <= 0.0005f)
		{
			return 0.5f;
		}

		return Mathf.Clamp(dt, 0.05f, 3f);
	}
	#endregion

	#region Prefab Settings
	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("The note prefabs to be instantiated.")]
	private Transform[] _solidNotes;

	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Optional asset that can provide lane offset presets.")]
	private LaneOffsetConfig laneOffsetConfig;
	public Transform[] SolidNotes
	{
		get { return _solidNotes; }
		set { _solidNotes = value; }
	}
	public void SetVisualizationMode(VisualizationMode mode)
	{
		if (vizMode == mode)
		{
			return;
		}
		vizMode = mode;
		ApplyVisualizationSettings();
	}

	// Optional external hook if a scene wants to set the hit line at runtime.
	public void SetHighwayHitLine(Transform hitLine)
	{
		highwayHitLine = hitLine;
	}
	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Lane offsets along the X axis when notes travel on the Z axis.")]
	private float[] horizontalLaneOffsets = new float[] { -2f, -0.5f, 1f, 2.5f, 4f };

	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Lane offsets along the Z axis when notes travel on the X axis.")]
	private float[] verticalLaneOffsets = new float[] { -0.96f, -2.4f, -3.93f, -5.4f, -6.93f };

	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Lane offsets along the Z axis for the Guitar Hero style layout.")]
	private float[] guitarHeroLaneOffsets = new float[] { 4.08f, 2.55f, 1.02f, -0.562f, -2.15f };
	[SerializeField] private Transform orangeChordPrefab;
	private float firstNoteZPosition;
	private float firstNoteXPosition;
	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Optional transform that marks the highway hit line for spawn alignment.")]
	private Transform highwayHitLine;
	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("If true, use the hit line transform to align highway note spawn offsets.")]
		private bool useHitLineForHighway = true;
		public static Note[] CachedNotes { get; private set; }
		public static float ChartOffsetSeconds { get; private set; } = 0f;
		public static double ChartSongAnchorTime { get; private set; } = 0d;
		public static double LastBeatSongTime { get; private set; } = 0d;
		public static int LastBeatSequenceIndex { get; private set; } = -1;
		public static double NextBeatSongTime { get; private set; } = 0d;
		public static int NextBeatSequenceIndex { get; private set; } = 0;

	private double chartSongAnchorTime = 0d;
	private double? pendingSongAnchorTime;
	private bool pendingPreservePlayback;

	private HashSet<float> triggeredBeats = new HashSet<float>(); // Store triggered beats
	private readonly List<float> scheduledBeats = new List<float>();
	private int beatCursor = 0;
	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Prefab for star power.")]
	private Transform _starPowerPrefab;
	public Transform StarPowerPrefab
	{
		get { return _starPowerPrefab; }
		set { _starPowerPrefab = value; }
	}

	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Prefab for sections.")]
	private Transform _sectionPrefab;
	public Transform SectionPrefab
	{
		get { return _sectionPrefab; }
		set { _sectionPrefab = value; }
	}

	[TabGroup("Prefab Settings")]
	[SerializeField, Tooltip("Prefab for BPM.")]
	private Transform _bpmPrefab;
	public Transform BpmPrefab
	{
		get { return _bpmPrefab; }
		set { _bpmPrefab = value; }
	}
	public static event Action OnBeat; // Event to notify when a beat occurs
	#endregion

	#region Audio & Camera Settings
	[TabGroup("Audio & Camera")]
	[SerializeField, Tooltip("The music audio source.")]
	private AudioSource _music;
	public AudioSource Music
	{
		get { return _music; }
		set { _music = value; }
	}
	public float songLength; // Duration of the song in seconds

	[TabGroup("Audio & Camera")]
	[SerializeField, Tooltip("Camera movement aggregation.")]
	private CameraMovement _cameraMovement;
	public CameraMovement CameraMovement
	{
		get { return _cameraMovement; }
		set { _cameraMovement = value; }
	}
	#endregion

	#region Start and Initialization
	private void Awake()
	{
		ApplyVisualizationSettings();
		ApplyLaneOffsetOverrides();
	}

#if UNITY_EDITOR
	private void OnValidate()
	{
		ApplyVisualizationSettings();
		ApplyLaneOffsetOverrides();
	}
#endif

	private IEnumerator Start()
	{
		// Wait for the band leader to exist
		while (AudioManager.Instance == null) yield return null;

		// Subscribe once; we'll schedule playback when chart init fires
		OnChartInitialized += HandleChartInitialized;

		// Kick off loading (WebGL path is coroutine; desktop is sync)
		LoadAndInitializeChart();
	}

	private void OnDestroy()
	{
		OnChartInitialized -= HandleChartInitialized;
		StopSongEndWatcher();

		if (scheduleRoutine != null)
		{
			StopCoroutine(scheduleRoutine);
			scheduleRoutine = null;
		}

		if (AudioManager.Instance != null)
		{
			AudioManager.Instance.OnPlaybackAligned -= HandlePlaybackAligned;
			AudioManager.Instance.OnPlaybackStarted -= HandlePlaybackStarted;
		}

		// Clear static chart timing/cache so next scene instance always starts from a clean baseline.
		ResetStaticRuntimeState();
	}

	private static void ResetStaticRuntimeState()
	{
		Chart = null;
		CachedNotes = null;
		ChartOffsetSeconds = 0f;
		ChartSongAnchorTime = 0d;
		LastBeatSongTime = 0d;
		LastBeatSequenceIndex = -1;
		NextBeatSongTime = 0d;
		NextBeatSequenceIndex = 0;
	}


		private void PrepareForChartLoad(bool preservePlaybackPosition)
		{
			bool wasActive = _isChartInitialized || Chart != null || CachedNotes != null;
			if (wasActive)
				GameplayEventBus.RaiseChartRestarted();

			_isChartInitialized = false;
			hasTriggeredEndGame = false;
			scheduledBeats.Clear();
			beatCursor = 0;
			LastBeatSongTime = 0d;
			LastBeatSequenceIndex = -1;
			NextBeatSongTime = 0d;
			NextBeatSequenceIndex = 0;
			highwayStates.Clear();
			highwaySpawnIndex = 0;
			highwayDespawnIndex = 0;
			ResetTimelineUI();

		bool canPreserve = preservePlaybackPosition
			&& AudioManager.Instance != null
			&& AudioManager.Instance.HasSongStarted;

		pendingPreservePlayback = canPreserve;
		if (canPreserve && AudioManager.Instance != null)
		{
			pendingSongAnchorTime = AudioManager.Instance.GetAdjustedSongTime();
		}
		else
		{
			pendingSongAnchorTime = 0d;
		}
	}

		public void LoadAndInitializeChart()
		{
			PrepareForChartLoad(false);

			if (GameplayEventBus.generatedChartFilePath != "")
			{
				_path = GameplayEventBus.generatedChartFilePath;
				Debug.Log($"[ChartSystem] Using generated chart file path: '{_path}'.");
			}

			string chartPath = ResolveChartPath(_path);

			Debug.Log($"[ChartSystem] Chart load ritual begins at '{chartPath}'.");

			if (Application.platform == RuntimePlatform.WebGLPlayer)
			{
				StartCoroutine(LoadChartWebGL(chartPath));
		}
		else if (File.Exists(chartPath))
		{
			LoadChartFromPath(chartPath);
		}
		else
		{
			Debug.LogError($"[ChartSystem] Chart file missing at '{chartPath}'. Verify StreamingAssets carries the tune.");
		}
	}

		public void ReloadChart(bool preservePlaybackPosition = false)
		{
			Debug.Log("[ChartSystem] Reloading chart — clearing old echoes first.");
			PrepareForChartLoad(preservePlaybackPosition);

			ClearExistingNotes();
			Chart = null;
			Debug.Log("[ChartSystem] Chart and notes cleared; the stage is silent.");

			string chartPath = ResolveChartPath(_path);

			if (Application.platform == RuntimePlatform.WebGLPlayer)
			{
				StartCoroutine(LoadChartWebGL(chartPath)); // Handle WebGL chart loading
			}
		else if (File.Exists(chartPath))
		{
			LoadChartFromPath(chartPath); // Handle local chart loading
		}
		else
		{
			Debug.LogError($"[ChartSystem] Chart file not found for reload at '{chartPath}'.");
			return;
		}

		// Recalculate DSP time and start the music for the new chart
		// Playback is now scheduled exclusively through AudioManager.SchedulePlaybackNow()
		// so that tutorial suppression and calibration offsets remain intact.
		if (Music.clip == null)
		{
			Debug.LogError("[ChartSystem] Music clip is null. Assign the correct audio companion before invoking playback.");
		}
	}

	private void LoadChartFromPath(string chartPath)
	{
		Debug.Log($"[ChartSystem] Loading chart from '{chartPath}'.");
		ChartReader chartReader = new ChartReader();
		Chart = chartReader.ReadChartFile(chartPath);

		if (Chart != null)
		{
			Debug.Log("[ChartSystem] Chart successfully parsed and cached.");
			InitializeChartContent();
		}
		else
		{
			Debug.LogError($"[ChartSystem] Failed to load chart at '{chartPath}'.");
		}
	}

	public IEnumerator LoadChartWebGL(string chartPath)
	{
		Debug.Log($"[ChartSystem] WebGL streaming chart from '{chartPath}'.");

		using (UnityWebRequest uwr = UnityWebRequest.Get(chartPath))
		{
			yield return uwr.SendWebRequest();

			if (uwr.result != UnityWebRequest.Result.Success)
			{
				Debug.LogError($"[ChartSystem] WebGL failed to load chart. Error: {uwr.error}");
				yield break;
			}

			string chartData = uwr.downloadHandler.text;
			if (string.IsNullOrWhiteSpace(chartData))
			{
				Debug.LogError("[ChartSystem] WebGL chart download returned empty data.");
				yield break;
			}

			Debug.Log($"[ChartSystem] WebGL chart payload received ({chartData.Length} characters).");

			yield return null; // allow the web thread to flush before parsing

			try
			{
				ChartReader chartReader = new ChartReader();
				Chart = chartReader.ParseChartText(chartData);
			}
			catch (Exception ex)
			{
				Debug.LogError($"[ChartSystem] WebGL failed to parse chart text. {ex.Message}\n{ex.StackTrace}");
				Chart = null;
			}

			if (Chart != null)
			{
				Debug.Log($"[ChartSystem] Chart initialized. Sections discovered: {Chart.Notes.Keys.Count}");
				InitializeChartContent();
			}
			else
			{
				Debug.LogError("[ChartSystem] WebGL failed to parse chart.");
			}
		}
	}

	private bool _isChartInitialized = false;

	private void InitializeChartContent()
	{
		if (_isChartInitialized)
		{
			Debug.LogWarning("[ChartSystem] Chart already initialized. Skipping duplicate spin-up.");
			return;
		}

		_isChartInitialized = true;
		hasTriggeredEndGame = false;
		StopSongEndWatcher();

		ChartOffsetSeconds = (float)(Chart?.OffsetSeconds ?? 0f);
		Debug.Log($"[ChartSystem] Chart offset registered at {ChartOffsetSeconds:F3}s.");

		chartSongAnchorTime = pendingSongAnchorTime ?? 0d;
		ChartSongAnchorTime = chartSongAnchorTime;
		pendingSongAnchorTime = null;

		string currentDifficulty = RetrieveDifficulty();
		Note[] notes = Chart.GetNotes(currentDifficulty);
		Debug.Log($"[ChartSystem] Parsed {notes.Length} notes for difficulty {currentDifficulty}.");

		if (notes.Length == 0)
			Debug.LogError("[ChartSystem] Chart loaded but no notes found. Investigate parsing.");

				CachedNotes = notes;
				GameplayEventBus.RaiseChartInitialized(Chart, CachedNotes);
				ScheduleBeats(CachedNotes);
				PrimeBeatCursorForCurrentPlayback();
				noteTransforms.Clear();

			if (TryGetSpawnConfiguration(direction, out Axis travelAxis, out int directionSign, out float[] laneOffsets))
			{
				ApplyHighwayHitLineOffset(travelAxis);
			if (CurrentVisualizationMode == VisualizationMode.Highway)
			{
				PrepareHighwaySpawn(CachedNotes, travelAxis, directionSign, laneOffsets);
			}
			else
			{
				SpawnNotes(CachedNotes, travelAxis, directionSign, laneOffsets);
			}
		}
		else
		{
			Debug.LogWarning($"[ChartSystem] Unsupported note direction or missing lane offsets for {direction}.");
		}

		SpawnStarPower(Chart.GetStarPower(currentDifficulty));
		SpawnSynchTracks(Chart.SynchTracks);
		GameplayEventBus.RaiseNotesSpawned(CachedNotes);

		// No manual CameraMovement.transform.position tweaks here.
#if UNITY_2023_1_OR_NEWER
			foreach (BeatFretlineSpawner spawner in UnityEngine.Object.FindObjectsByType<BeatFretlineSpawner>(UnityEngine.FindObjectsSortMode.None))
				spawner.StartSpawningFretLines();
#else
			foreach (BeatFretlineSpawner spawner in FindObjectsOfType<BeatFretlineSpawner>())
				spawner.StartSpawningFretLines();
#endif

		// Let Start()/HandleChartInitialized schedule playback and wire camera.
		OnChartInitialized?.Invoke();
	}


	#endregion

	#region Difficulty Handling
	private string RetrieveDifficulty()
	{
		string result;
		switch (difficulty)
		{
			case Difficulty.EasyGuitar:
				result = "EasySingle";
				break;
			case Difficulty.MediumGuitar:
				result = "MediumSingle";
				break;
			case Difficulty.HardGuitar:
				result = "HardSingle";
				break;
			case Difficulty.ExpertGuitar:
				result = "ExpertSingle";
				break;
			case Difficulty.EasyDrums:
				result = "EasyDrums";
				break;
			case Difficulty.MediumDrums:
				result = "MediumDrums";
				break;
			case Difficulty.HardDrums:
				result = "HardDrums";
				break;
			case Difficulty.ExpertDrums:
				result = "ExpertDrums";
				break;
			default:
				result = "ExpertSingle";
				break;
		}
		return result;
	}
	#endregion

	#region Lane Offset Configuration
	private void ApplyLaneOffsetOverrides()
	{
		if (laneOffsetConfig == null)
		{
			return;
		}

		if (laneOffsetConfig.HorizontalLaneOffsets != null && laneOffsetConfig.HorizontalLaneOffsets.Length > 0)
		{
			horizontalLaneOffsets = CloneOffsets(laneOffsetConfig.HorizontalLaneOffsets);
		}

		if (laneOffsetConfig.VerticalLaneOffsets != null && laneOffsetConfig.VerticalLaneOffsets.Length > 0)
		{
			verticalLaneOffsets = CloneOffsets(laneOffsetConfig.VerticalLaneOffsets);
		}

		if (laneOffsetConfig.GuitarHeroLaneOffsets != null && laneOffsetConfig.GuitarHeroLaneOffsets.Length > 0)
		{
			guitarHeroLaneOffsets = CloneOffsets(laneOffsetConfig.GuitarHeroLaneOffsets);
		}
	}

	private static float[] CloneOffsets(float[] source)
	{
		if (source == null)
		{
			return null;
		}

		float[] clone = new float[source.Length];
		Array.Copy(source, clone, source.Length);
		return clone;
	}
	#endregion

	#region Spawn Methods
	private bool TryGetSpawnConfiguration(NoteDirection noteDirection, out Axis travelAxis, out int directionSign, out float[] laneOffsets)
	{
		travelAxis = Axis.Z;
		directionSign = 1;
		laneOffsets = null;

		switch (noteDirection)
		{
			case NoteDirection.LeftToRight:
				travelAxis = Axis.Z;
				directionSign = -1;
				laneOffsets = horizontalLaneOffsets;
				break;
			case NoteDirection.RightToLeft:
				travelAxis = Axis.Z;
				directionSign = 1;
				laneOffsets = horizontalLaneOffsets;
				break;
			case NoteDirection.UpToDown:
				travelAxis = Axis.X;
				directionSign = -1;
				laneOffsets = verticalLaneOffsets;
				break;
			case NoteDirection.DownToUp:
				travelAxis = Axis.X;
				directionSign = 1;
				laneOffsets = verticalLaneOffsets;
				break;
			case NoteDirection.GuitarHeroStyle:
				travelAxis = Axis.X;
				directionSign = -1;
				laneOffsets = guitarHeroLaneOffsets;
				break;
			default:
				return false;
		}

		if (laneOffsets == null || laneOffsets.Length == 0)
		{
			Debug.LogError($"[ChartSystem] Lane offsets are not configured for {noteDirection}.");
			return false;
		}

		return true;
	}

	private void ApplyHighwayHitLineOffset(Axis travelAxis)
	{
		if (!useHitLineForHighway || highwayHitLine == null)
		{
			return;
		}

		Vector3 localPos = transform.InverseTransformPoint(highwayHitLine.position);
		if (travelAxis == Axis.Z)
		{
			firstNoteZPosition = localPos.z;
		}
		else
		{
			firstNoteXPosition = localPos.x;
		}
	}

	private void SpawnSynchTracks(SynchTrack[] synchTracks)
	{
		// Handle synchronization
	}
	private void SpawnStarPower(StarPower[] starPowers)
	{
		foreach (StarPower starPower in starPowers)
		{
			Transform tmp = SpawnPrefab(StarPowerPrefab, transform, new Vector3(0, 0, starPower.Seconds * Speed));
			tmp.localScale = new Vector3(1, 1, starPower.DurationSeconds * Speed);
		}
	}

	private void SpawnNotes(Note[] notes, Axis travelAxis, int directionSign, float[] laneOffsets)
	{
		if (notes == null || notes.Length == 0)
		{
			Debug.LogWarning("[ChartSystem] No notes available to spawn.");
			return;
		}

		if (directionSign != 1 && directionSign != -1)
		{
			Debug.LogError($"[ChartSystem] Invalid direction sign {directionSign}; expected +1 or -1.");
			return;
		}

		if (laneOffsets == null || laneOffsets.Length == 0)
		{
			Debug.LogError("[ChartSystem] Lane offsets have not been configured.");
			return;
		}

		int prefabCount = _solidNotes != null ? _solidNotes.Length : laneOffsets.Length;
		int laneCount = Mathf.Min(prefabCount, laneOffsets.Length);
		if (laneCount == 0)
		{
			Debug.LogError("[ChartSystem] Unable to spawn notes — lane offsets or prefabs missing.");
			return;
		}

		Debug.Log($"[ChartSystem] Spawning {notes.Length} notes.");

		bool spawnVisuals = CurrentVisualizationMode != VisualizationMode.WispPerimeter;

		foreach (Note note in notes)
		{
			// In Wisp mode we skip instantiating highway visuals entirely to keep the scene lightweight.
			float noteSongTime = GetNoteSongTime(note);
			float baseDistance = noteSongTime * Speed;
			float originOffset = travelAxis == Axis.Z ? firstNoteZPosition : firstNoteXPosition;
			float travelPosition = (directionSign * baseDistance) + originOffset;

			// Always notify timeline of note spawn for UI markers (even in Wisp mode)
			if (timelineGameObject != null)
			{
				if (laneOffsets != null && laneOffsets.Length > 0 && note.ButtonIndexes != null)
				{
					for (int lane = 0; lane < laneOffsets.Length && lane < note.ButtonIndexes.Length; lane++)
					{
						if (!note.ButtonIndexes[lane]) continue;
						ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.OnNotesSpawning(travelPosition, lane));
					}
				}
			}

			if (!spawnVisuals)
			{
				if (timelineGameObject != null)
				{
					ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.IncrementTimelineNoteXPositon());
				}
				noteTransforms.Add(System.Array.Empty<Transform>());
				continue;
			}

			Transform[] laneInstances = new Transform[laneCount];
			int buttonCount = note.ButtonIndexes != null ? note.ButtonIndexes.Length : 0;

			for (int i = 0; i < laneCount && i < buttonCount; i++)
			{
				if (!note.ButtonIndexes[i])
				{
					continue;
				}

				Transform noteTmp = null;
				if (spawnVisuals)
				{
					if (_solidNotes == null || i >= _solidNotes.Length || _solidNotes[i] == null)
					{
						continue;
					}

					noteTmp = Instantiate(_solidNotes[i], transform);
					Vector3 localPosition = travelAxis == Axis.Z
							? new Vector3(laneOffsets[i], 0f, travelPosition)
							: new Vector3(travelPosition, 0f, laneOffsets[i]);

					noteTmp.localPosition = localPosition;
					UpdateNoteVisualDriver(noteTmp, noteSongTime);
				}

				// Always notify timeline of note spawn for UI markers (even in Wisp mode)
				if (timelineGameObject != null && (direction == NoteDirection.GuitarHeroStyle || direction == NoteDirection.UpToDown))
				{
					ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.OnNotesSpawning(travelPosition, i));
				}

				laneInstances[i] = noteTmp;
			}

			noteTransforms.Add(laneInstances);

			// Advance timeline marker X position per column once per note row
			if (timelineGameObject != null)
			{
				ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.IncrementTimelineNoteXPositon());
			}
		}

		GameplayEventBus.RaiseSpawnedNotes(GetTotalSpawnedNotes());
	}

	private void PrepareHighwaySpawn(Note[] notes, Axis travelAxis, int directionSign, float[] laneOffsets)
	{
		highwayStates.Clear();
		highwaySpawnIndex = 0;
		highwayDespawnIndex = 0;
		highwayTravelAxis = travelAxis;
		highwayDirectionSign = directionSign;
		highwayLaneOffsets = laneOffsets;

		int laneCount = Mathf.Min(laneOffsets.Length, _solidNotes != null ? _solidNotes.Length : 0);
		EnsureHighwayPools(laneCount);
		for (int i = 0; i < highwayPools.Count; i++)
			highwayPools[i].Clear();

		double now = AudioManager.CachedSongTime > 0 ? AudioManager.CachedSongTime :
			(AudioManager.Instance != null ? AudioManager.Instance.GetAdjustedSongTime() : 0d);

		// Precompute song times and timeline markers without instantiating notes.
		foreach (var note in notes)
		{
			float noteSongTime = GetNoteSongTime(note);
			highwayStates.Add(new HighwayNoteState
			{
				songTime = noteSongTime,
				note = note,
				lanes = null,
				spawned = false
			});

			if (timelineGameObject != null)
			{
				float baseDistance = noteSongTime * Speed;
				float originOffset = travelAxis == Axis.Z ? firstNoteZPosition : firstNoteXPosition;
				float travelPosition = (directionSign * baseDistance) + originOffset;

				for (int i = 0; i < laneOffsets.Length && i < 5; i++)
				{
					ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.OnNotesSpawning(travelPosition, i));
				}
				ExecuteEvents.Execute<IChartLoaderGameplayMessage>(timelineGameObject, null, (x, y) => x.IncrementTimelineNoteXPositon());
			}
		}
	}

	private void ProcessHighwaySpawnWindow()
	{
		if (CurrentVisualizationMode != VisualizationMode.Highway) return;
		if (highwayStates.Count == 0) return;

		double songTime = AudioManager.CachedSongTime > 0 ? AudioManager.CachedSongTime :
			(AudioManager.Instance != null ? AudioManager.Instance.GetAdjustedSongTime() : 0d);

		float lookahead = Mathf.Max(0f, highwaySpawnLookaheadSeconds);
		float despawnPast = Mathf.Max(0f, highwayDespawnPastSeconds);

		// Skip any notes already far behind the playhead.
		while (highwaySpawnIndex < highwayStates.Count && highwayStates[highwaySpawnIndex].songTime < songTime - despawnPast)
			highwaySpawnIndex++;
		if (highwayDespawnIndex < highwaySpawnIndex)
			highwayDespawnIndex = highwaySpawnIndex;

		// Spawn upcoming notes within the window.
		while (highwaySpawnIndex < highwayStates.Count && highwayStates[highwaySpawnIndex].songTime <= songTime + lookahead)
		{
			var state = highwayStates[highwaySpawnIndex];
			if (!state.spawned)
			{
				state = SpawnHighwayNote(state);
				highwayStates[highwaySpawnIndex] = state;
			}
			highwaySpawnIndex++;
		}

		// Despawn notes that have passed well beyond the hit time.
		while (highwayDespawnIndex < highwayStates.Count)
		{
			var state = highwayStates[highwayDespawnIndex];
			if (!state.spawned || songTime - state.songTime <= despawnPast)
				break;

			DespawnHighwayNote(ref state);
			highwayStates[highwayDespawnIndex] = state;
			highwayDespawnIndex++;
		}
	}

	private HighwayNoteState SpawnHighwayNote(HighwayNoteState state)
	{
		int laneCount = Mathf.Min(highwayLaneOffsets.Length, _solidNotes != null ? _solidNotes.Length : 0);
		if (laneCount == 0) return state;

		float baseDistance = state.songTime * Speed;
		float originOffset = highwayTravelAxis == Axis.Z ? firstNoteZPosition : firstNoteXPosition;
		float travelPosition = (highwayDirectionSign * baseDistance) + originOffset;

		int buttonCount = state.note.ButtonIndexes != null ? state.note.ButtonIndexes.Length : 0;
		var lanes = new Transform[laneCount];

		for (int i = 0; i < laneCount && i < buttonCount; i++)
		{
			if (!state.note.ButtonIndexes[i])
				continue;

			var laneObj = GetHighwayFromPool(i);
			if (laneObj == null) continue;

			Vector3 localPosition = highwayTravelAxis == Axis.Z
				? new Vector3(highwayLaneOffsets[i], 0f, travelPosition)
				: new Vector3(travelPosition, 0f, highwayLaneOffsets[i]);

			laneObj.gameObject.SetActive(true);
			laneObj.localPosition = localPosition;
			laneObj.localRotation = Quaternion.identity;
			laneObj.localScale = Vector3.one;

			var driver = laneObj.GetComponent<NoteVisualDriver>();
			if (driver != null)
			{
				driver.expectedHitTime = state.songTime;
			}

			lanes[i] = laneObj;
		}

		state.lanes = lanes;
		state.spawned = true;
		return state;
	}

	private void DespawnHighwayNote(ref HighwayNoteState state)
	{
		if (state.lanes != null)
		{
			for (int i = 0; i < state.lanes.Length; i++)
			{
				var laneObj = state.lanes[i];
				if (laneObj == null) continue;

				DOTween.Kill(laneObj, false);
				laneObj.gameObject.SetActive(false);
				if (i < highwayPools.Count)
					highwayPools[i].Enqueue(laneObj);
			}
		}

		state.lanes = null;
		state.spawned = false;
	}

	private Transform GetHighwayFromPool(int laneIndex)
	{
		if (laneIndex < highwayPools.Count && highwayPools[laneIndex].Count > 0)
			return highwayPools[laneIndex].Dequeue();

		if (_solidNotes == null || laneIndex >= _solidNotes.Length || _solidNotes[laneIndex] == null)
			return null;

		var obj = Instantiate(_solidNotes[laneIndex], transform);
		return obj;
	}

	private void EnsureHighwayPools(int laneCount)
	{
		while (highwayPools.Count < laneCount)
			highwayPools.Add(new Queue<Transform>());
	}

	private void ResetTimelineUI()
	{
		if (timelineGameObject == null) return;
		var tp = timelineGameObject.GetComponent<TimelineProgress>();
		if (tp != null)
		{
			tp.ResetTimeline();
		}
	}

	#endregion

	#region Helper Methods
	private void StartSong()
	{
		CameraMovement.Speed = Speed;
		CameraMovement.enabled = true;
	}

	private void PlayMusic() => Music.Play();

	private static void UpdateNoteVisualDriver(Transform noteTransform, float noteSongTime)
	{
		NoteVisualDriver spawner = noteTransform != null ? noteTransform.GetComponent<NoteVisualDriver>() : null;
		if (spawner != null)
		{
			spawner.expectedHitTime = noteSongTime;
		}
	}

	private Transform SpawnPrefab(Transform prefab, Transform parent, Vector3 position)
	{
		Transform tmp = Instantiate(prefab, parent);
		tmp.localPosition = position;
		return tmp;
	}
	public float GetFirstNoteZ()
	{
		return firstNoteZPosition;
	}

	public float GetFirstNoteX()
	{
		return firstNoteXPosition;
	}

	private IEnumerator WaitForDSPThenInitCamera()
	{
		float timeout = 2f;
		float timer = 0f;

		while (AudioManager.Instance == null)
		{
			timer += Time.deltaTime;
			if (timer >= timeout)
			{
				Debug.LogError("[ChartSystem] Timeout waiting for AudioManager dspStartTime.");
				yield break;
			}

			yield return null;
		}

		if (CameraMovement != null)
		{
			CameraMovement.InitializeFromAudioManager();
			Debug.Log("[ChartSystem] Camera initialized after dspStartTime became available.");
		}
	}

	private void SetLongNoteScale(Transform note, float length)
	{
		note.localScale = new Vector3(note.localScale.x, note.localScale.y, length);
	}

	private void SetHammerOnColor(Transform note, bool isHammerOn)
	{
		if (isHammerOn)
		{
			SpriteRenderer renderer = note.GetComponent<SpriteRenderer>();
			renderer.color = new Color(renderer.color.r + 0.75f, renderer.color.g + 0.75f, renderer.color.b + 0.75f);
		}
	}
	public static int GetTotalSpawnedNotes(string colorFilter = null)
	{
		if (CachedNotes == null) return 0;

		int total = 0;
		int colorIndex = colorFilter switch
		{
			"Green" => 0,
			"Red" => 1,
			"Yellow" => 2,
			"Blue" => 3,
			"Orange" => 4,
			_ => -1
		};

		foreach (Note note in CachedNotes)
		{
			for (int i = 0; i < 5; i++)
			{
				if (note.ButtonIndexes[i])
				{
					if (colorIndex == -1 || colorIndex == i)
						total++;
				}
			}
		}

		return total;
	}

		private IEnumerator TriggerBeatOnTime(float noteTime)
		{
			double targetSongTime = chartSongAnchorTime + noteTime;
			AudioManager audio = AudioManager.Instance;
		double currentSongTime = audio != null ? audio.GetAdjustedSongTime() : 0d;
		double delay = targetSongTime - currentSongTime;

		if (delay > 0d)
			yield return new WaitForSeconds((float)delay);
		else
		{
			// Skip beat that's already in the past
			Debug.Log($"[ChartSystem] Skipping past beat scheduled at {targetSongTime:F3}s (current time {currentSongTime:F3}s).");
			yield break;
		}

			ChartSystem.OnBeat?.Invoke();
			LastBeatSongTime = targetSongTime;
			LastBeatSequenceIndex = -1;
			GameplayEventBus.RaiseBeat();
		}

	private void StartSongEndWatcher()
	{
		StopSongEndWatcher();
		songEndRoutine = StartCoroutine(WaitForSongEndOrLastNote());
	}

	private void StopSongEndWatcher()
	{
		if (songEndRoutine != null)
		{
			StopCoroutine(songEndRoutine);
			songEndRoutine = null;
		}
	}

	private IEnumerator WaitForSongEndOrLastNote()
	{
		AudioManager audio = AudioManager.Instance;
		if (audio == null)
			yield break;

		// Ensure playback has actually kicked off; this prevents premature
		// endings in WebGL when tutorials suppress auto-start.
		double waitStart = AudioSettings.dspTime;
		const double waitForStartTimeout = 6.0; // seconds
		while (audio != null && !audio.HasSongStarted)
		{
			yield return null;
			audio = AudioManager.Instance;

			if (audio != null && !audio.HasSongStarted && AudioSettings.dspTime - waitStart > waitForStartTimeout)
			{
				Debug.LogWarning("[ChartSystem] Playback never started; forcing end-of-song transition.");
				EndGame();
				yield break;
			}
		}

		if (audio == null)
			yield break;

		// Snapshot notes into a local variable so they cannot be nulled out
		// from another code path while this coroutine is mid-frame.
		var notes = CachedNotes;

		if (notes == null || notes.Length == 0)
		{
			double clipLength = audio.songLength;
			if (clipLength <= 0 && audio.musicSource != null && audio.musicSource.clip != null)
				clipLength = audio.musicSource.clip.length;
			if (clipLength <= 0)
				clipLength = 1.0f; // safety net so WebGL tutorials don't insta-complete

			double fallback = audio.dspStartTime + clipLength + 1.0;
			while (AudioSettings.dspTime < fallback)
				yield return null;

			EndGame();
			yield break;
		}

		float lastNoteTime = 0f;
		for (int i = 0; i < notes.Length; i++)
		{
			var note = notes[i];
			if (note == null) continue;
			float t = GetNoteSongTime(note) + Mathf.Max(0f, note.DurationSeconds);
			if (t > lastNoteTime)
				lastNoteTime = t;
		}

		const float bufferTime = 2f; // delay for final feedback visuals
		double targetEndTime = audio.dspStartTime + chartSongAnchorTime + lastNoteTime + bufferTime;

		while (AudioSettings.dspTime < targetEndTime)
			yield return null;

		Debug.Log("[ChartSystem] Last note and buffer reached — ending gameplay.");
		//GameplayEventBus.RaiseCameraPannedToPerspective();

		EndGame();
	}

	private void EndGame()
	{
		if (hasTriggeredEndGame)
		{
			return;
		}

		hasTriggeredEndGame = true;
		StopSongEndWatcher();

		// Always broadcast so downstream listeners (city fade, UI, etc.) can react.
		bool handledByListener = GameplayEventBus.RaiseChartCompleted();

		// If a score display exists, let it own the transition animation. -> this was causing the bug where the end screen wouldn't show up and the game would hang
		// if (TryTriggerScoreDisplayFade())
		// {
		// 	return;
		// }

		if (!handledByListener)
		{
			// Legacy fallback remains intentionally disabled; warn only when nobody handled the completion event.
			Debug.LogWarning("[ChartSystem] ChartCompleted fired with no listeners. No end-of-run presenter handled the session.");
		}
	}

	private bool TryTriggerScoreDisplayFade()
	{
#if UNITY_2023_1_OR_NEWER
		InGameScoreDisplay scoreDisplay = UnityEngine.Object.FindFirstObjectByType<InGameScoreDisplay>(UnityEngine.FindObjectsInactive.Include);
#else
		InGameScoreDisplay scoreDisplay = UnityEngine.Object.FindFirstObjectByType<InGameScoreDisplay>();
#endif
		if (scoreDisplay == null)
			return false;

		scoreDisplay.TriggerEndGameFade();
		return true;
	}

	private void SetHOPO(Transform note)
	{
		SpriteRenderer renderer = note.GetComponent<SpriteRenderer>();
		renderer.color = new Color(0.75f, 0, 0.75f);
	}

	public void ClearExistingNotes()
	{
		Debug.Log("[ChartSystem] Clearing existing notes.");
		StopSongEndWatcher();
		foreach (Transform child in transform)
		{
			Debug.Log($"[ChartSystem] Destroying note instance '{child.name}'.");
			Destroy(child.gameObject);
		}
		noteTransforms.Clear();
		Debug.Log("[ChartSystem] All notes and objects cleared.");
	}
	public Note[] GetLoadedNotes()
	{
		return Chart?.GetNotes(RetrieveDifficulty());
	}

		public void ResetLoaderState()
		{
			Debug.Log("[ChartSystem] Resetting chart and notes.");
			GameplayEventBus.RaiseChartRestarted();
			ClearExistingNotes();
			Chart = null;
			CachedNotes = null;
			_isChartInitialized = false;
			hasTriggeredEndGame = false;
		pendingSongAnchorTime = 0d;
		chartSongAnchorTime = 0d;
		ChartSongAnchorTime = 0d;
		pendingPreservePlayback = false;
	}
	private void HandleChartInitialized()
	{
		// Camera baseline is owned by DSP — no manual warps
		if (CameraMovement != null)
		{
			CameraMovement.Speed = Speed;
			CameraMovement.InitializeFromAudioManager();
			CameraMovement.enabled = true;
		}

		// Re-pin once after the first real samples flow
		if (AudioManager.Instance != null)
		{
			AudioManager.Instance.OnPlaybackAligned -= HandlePlaybackAligned;
			AudioManager.Instance.OnPlaybackAligned += HandlePlaybackAligned;
			AudioManager.Instance.OnPlaybackStarted -= HandlePlaybackStarted;
			AudioManager.Instance.OnPlaybackStarted += HandlePlaybackStarted;

			// Only piggyback on already-running audio when this load explicitly preserves playback.
			// Otherwise a persistent AudioManager may still be near the end of an old run.
			if (pendingPreservePlayback && AudioManager.Instance.IsPlaying)
				HandlePlaybackStarted();
		}

		bool playbackAlreadyRunning = pendingPreservePlayback && (AudioManager.Instance != null && AudioManager.Instance.IsPlaying);

		// Schedule exactly once (unless tutorial is suppressing)
		if (AudioManager.IsAutoStartSuppressed)
		{
			Debug.Log("[ChartSystem] Auto-start suppressed; tutorial will trigger playback.");
		}
		else
		{
			if (AudioManager.Instance.songRestartedFromSceneReload)
				AudioManager.Instance.songRestartedFromSceneReload = false;

			if (!playbackAlreadyRunning)
				TrySchedulePlayback();
		}

		pendingPreservePlayback = false;

	}

	private void HandlePlaybackAligned(double _)
	{
		if (CameraMovement != null)
			CameraMovement.InitializeFromAudioManager();
	}

	private void HandlePlaybackStarted()
	{
		StartSongEndWatcher();
	}

	private Coroutine scheduleRoutine;
#if UNITY_WEBGL && !UNITY_EDITOR
	private Coroutine audioUnlockRoutine;
#endif

		private void TrySchedulePlayback()
		{
			if (AudioManager.Instance == null)
				return;

			// If the audio context is still locked (WebGL), wait for user gesture to unlock.
#if UNITY_WEBGL && !UNITY_EDITOR
			if (!AudioManager.AudioUnlocked)
			{
				if (audioUnlockRoutine == null)
					audioUnlockRoutine = StartCoroutine(WaitForAudioUnlockThenSchedule());
				return;
			}
#endif

			var src = AudioManager.Instance.musicSource;
			if (src == null || src.clip == null)
			{
			if (scheduleRoutine == null)
				scheduleRoutine = StartCoroutine(WaitForMusicClipThenSchedule());
			return;
		}

		// If the clip exists but isn't fully ready, wait for it (all platforms).
		if (src.clip.loadState != AudioDataLoadState.Loaded)
		{
			if (scheduleRoutine == null)
				scheduleRoutine = StartCoroutine(WaitForMusicClipThenSchedule());
			return;
		}

		AudioManager.Instance.SchedulePlaybackNow();
	}


	private IEnumerator WaitForMusicClipThenSchedule()
	{
		const float warnEvery = 5f;
		float elapsed = 0f;
		const float maxWait = 12f;
		float waited = 0f;

		while (AudioManager.Instance == null
			|| AudioManager.Instance.musicSource == null
			|| AudioManager.Instance.musicSource.clip == null
			|| AudioManager.Instance.musicSource.clip.loadState != AudioDataLoadState.Loaded
		)
		{
			if (elapsed >= warnEvery)
			{
				Debug.LogWarning("[ChartSystem] Waiting for music clip to become ready...");
				elapsed = 0f;
			}

			elapsed += Time.unscaledDeltaTime;
			waited += Time.unscaledDeltaTime;
			if (waited >= maxWait)
			{
				Debug.LogWarning("[ChartSystem] Clip readiness wait timed out; scheduling anyway.");
				break;
			}
			yield return null;
		}

		AudioManager.Instance.SchedulePlaybackNow();
		scheduleRoutine = null;
	}

#if UNITY_WEBGL && !UNITY_EDITOR
	private IEnumerator WaitForAudioUnlockThenSchedule()
	{
		while (!AudioManager.AudioUnlocked)
		{
			yield return null;
		}

		audioUnlockRoutine = null;
		TrySchedulePlayback();
	}
#endif

		/// <summary>
		/// Called from an explicit user gesture (WebGL click-to-start) to kick off scheduling.
		/// Safe no-op on other platforms.
		/// </summary>
		public void NotifyUserGestureStart()
		{
#if UNITY_WEBGL && !UNITY_EDITOR
			if (!AudioManager.AudioUnlocked)
				return;

			if (audioUnlockRoutine != null)
			{
				StopCoroutine(audioUnlockRoutine);
				audioUnlockRoutine = null;
			}

			TrySchedulePlayback();
#endif
		}


	internal void ToggleNotesPositions()
	{
		if (CachedNotes != null && CachedNotes.Length > 0)
		{
			ToggleNotesPositions(CachedNotes);
		}
		else
		{
			Debug.LogWarning("[ChartSystem] No cached notes available to toggle positions.");
		}
	}

	internal void ToggleNotesPositions(Note[] notes)
	{
		if (notes == null || notes.Length == 0)
		{
			Debug.LogWarning("[ChartSystem] No notes supplied to toggle positions.");
			return;
		}

		if (!TryGetSpawnConfiguration(direction, out Axis travelAxis, out int directionSign, out float[] laneOffsets))
		{
			Debug.LogWarning($"[ChartSystem] Cannot toggle note positions because lane offsets are missing for {direction}.");
			return;
		}

		if (noteTransforms.Count == 0)
		{
			Debug.LogWarning("[ChartSystem] No instantiated note transforms cached to toggle.");
			return;
		}

		int prefabCount = SolidNotes != null ? SolidNotes.Length : 0;
		int laneCount = Mathf.Min(laneOffsets.Length, prefabCount);
		if (laneCount == 0)
		{
			Debug.LogWarning("[ChartSystem] Cannot toggle note positions without configured lane offsets or prefabs.");
			return;
		}

		for (int noteIndex = 0; noteIndex < notes.Length && noteIndex < noteTransforms.Count; noteIndex++)
		{
			Note note = notes[noteIndex];
			Transform[] laneInstances = noteTransforms[noteIndex];
			if (laneInstances == null)
			{
				continue;
			}

			float noteSongTime = GetNoteSongTime(note);
			float baseDistance = noteSongTime * Speed;
			float originOffset = travelAxis == Axis.Z ? firstNoteZPosition : firstNoteXPosition;
			float travelPosition = (directionSign * baseDistance) + originOffset;

			int buttonCount = note.ButtonIndexes != null ? note.ButtonIndexes.Length : 0;

			for (int laneIndex = 0; laneIndex < laneCount && laneIndex < buttonCount; laneIndex++)
			{
				if (!note.ButtonIndexes[laneIndex])
				{
					continue;
				}

				if (laneInstances.Length <= laneIndex)
				{
					continue;
				}

				Transform noteTransform = laneInstances[laneIndex];
				if (noteTransform == null)
				{
					continue;
				}

				float laneOffset = laneOffsets[laneIndex];
				if (travelAxis == Axis.Z)
				{
					noteTransform.localPosition = new Vector3(laneOffset, 0f, travelPosition);
				}
				else
				{
					noteTransform.localPosition = new Vector3(travelPosition, 0f, laneOffset);
				}

				UpdateNoteVisualDriver(noteTransform, noteSongTime);
			}
		}
	}

	public static float GetNoteSongTime(Note note)
	{
		if (note == null) return 0f;
		float adjusted = (float)note.Seconds - ChartOffsetSeconds;
		return adjusted < 0f ? 0f : adjusted;
	}

		public static float GetNoteHitTime(Note note)
		{
			return (float)(ChartSongAnchorTime + GetNoteSongTime(note));
		}

		private static string ResolveChartPath(string pathValue)
		{
			if (string.IsNullOrWhiteSpace(pathValue))
				return string.Empty;

			// If the importer gave us an absolute path (or a direct StreamingAssets path),
			// don't double-Combine it.
			if (System.IO.Path.IsPathRooted(pathValue))
				return pathValue;

			string rel = pathValue.Trim().Replace('\\', '/');

			// Convention: "UserCharts/..." lives under persistentDataPath so players can import charts later.
			// This avoids collisions with StreamingAssets/Charts.
			const string userPrefix = "UserCharts/";
			bool isUser = rel.StartsWith(userPrefix, StringComparison.OrdinalIgnoreCase);

			if (Application.platform == RuntimePlatform.WebGLPlayer)
			{
				// WebGL uses URL-based streaming assets; persistent chart browsing is not supported here.
				return System.IO.Path.Combine(Application.streamingAssetsPath, rel);
			}

			if (isUser)
			{
				string userAbs = System.IO.Path.Combine(Application.persistentDataPath, rel);
				return userAbs;
			}

			// Default: StreamingAssets first, then fall back to persistentDataPath for developer/user-added files.
			string streamingAbs = System.IO.Path.Combine(Application.streamingAssetsPath, rel);
			if (System.IO.File.Exists(streamingAbs))
				return streamingAbs;

			string persistentAbs = System.IO.Path.Combine(Application.persistentDataPath, rel);
			if (System.IO.File.Exists(persistentAbs))
				return persistentAbs;

			// As a last-ditch attempt, treat "Charts/..." as "UserCharts/..." when missing from StreamingAssets.
			// This keeps old references working even if charts move to user space.
			if (rel.StartsWith("Charts/", StringComparison.OrdinalIgnoreCase))
			{
				string userFallback = System.IO.Path.Combine(Application.persistentDataPath, userPrefix + rel.Substring("Charts/".Length));
				if (System.IO.File.Exists(userFallback))
					return userFallback;
			}

			return streamingAbs;
		}

		private void ScheduleBeats(Note[] notes)
		{
			if (beatScheduleMode == BeatScheduleMode.FromSyncTrackQuarterNotes)
			{
				if (ScheduleBeatsFromSyncTrack(notes))
					return;
			}

			// Default / fallback.
			ScheduleBeatsFromNotes(notes);
		}

			private bool ScheduleBeatsFromSyncTrack(Note[] notes)
			{
				if (Chart == null || Chart.SynchTracks == null || Chart.SynchTracks.Length == 0)
					return false;

				if (Chart.Resolution <= 0)
					return false;

					long maxTick = 0;
					float maxSongTime = 0f;
					if (notes != null)
					{
						foreach (Note n in notes)
					{
						if (n == null)
							continue;

						if (n.Tick > maxTick)
							maxTick = n.Tick;

						float t = GetNoteSongTime(n);
							if (t > maxSongTime)
								maxSongTime = t;
						}
					}

					float notesMaxSongTime = maxSongTime;
					float clipLength = 0f;
					AudioManager audio = AudioManager.Instance;
					if (audio != null && audio.musicSource != null && audio.musicSource.clip != null)
					{
					clipLength = audio.musicSource.clip.length;
				}
				else if (Music != null && Music.clip != null)
				{
					clipLength = Music.clip.length;
				}

					// If note parsing is incomplete (or the chart isn't a "one note per beat" marker chart),
					// we still want beats to span the whole song. Prefer the clip length when available.
					if (clipLength > maxSongTime)
					{
						if (Debug.isDebugBuild && notesMaxSongTime > 0f && clipLength > notesMaxSongTime + 0.5f)
							Debug.Log($"[ChartSystem] SyncTrack beat schedule: notes cover {notesMaxSongTime:F1}s but clip is {clipLength:F1}s; scheduling to clip length.");
						maxSongTime = clipLength;
					}

				if (maxSongTime <= 0f)
				{
					// Nothing to schedule against.
					return false;
				}

				// De-dupe by rounded milliseconds.
				triggeredBeats.Clear();
				scheduledBeats.Clear();

			long tickStep = Chart.Resolution; // quarter notes
			float maxBpm = 0f;
			foreach (SynchTrack track in Chart.SynchTracks)
			{
				if (track == null)
					continue;

				float bpm = track.BeatsPerMinute / 1000f;
				if (bpm > maxBpm)
					maxBpm = bpm;
			}

			if (maxBpm <= 0f)
				return false;

			double estimatedBeats = maxSongTime * (maxBpm / 60.0);
			long tickEnd = (long)Math.Ceiling(estimatedBeats + 4.0) * tickStep;
			if (maxTick > tickEnd)
				tickEnd = maxTick + tickStep;

				// NOTE: We schedule beats on the same song-time axis as notes (i.e. we apply ChartOffsetSeconds).
				// Use an *unclamped* probe for sanity checks so large positive offsets don't trip the "stagnant" guard.
				float lastSongTimeProbe = float.NegativeInfinity;
				int stagnant = 0;
				for (long tick = 0; tick <= tickEnd; tick += tickStep)
				{
					long micro = Chart.CalculateTickToTime(tick);
					float songTimeProbe = micro / 1000000.0f - ChartOffsetSeconds;

					// Safety: bail if timing doesn't advance (bad/missing BPM).
					if (songTimeProbe <= lastSongTimeProbe + 0.00001f)
					{
						stagnant++;
						if (stagnant > 8)
							return false;
					}
					else
					{
						stagnant = 0;
						lastSongTimeProbe = songTimeProbe;
					}

					float songTime = songTimeProbe < 0f ? 0f : songTimeProbe;
					if (songTime > maxSongTime + 0.25f)
						break;

					float key = Mathf.Round(songTime * 1000f) / 1000f;
					if (!triggeredBeats.Add(key))
						continue;

				scheduledBeats.Add(key);
			}

			if (scheduledBeats.Count > 1)
				scheduledBeats.Sort();

			beatCursor = 0;
			return scheduledBeats.Count > 0;
		}

		private void ScheduleBeatsFromNotes(Note[] notes)
		{
			if (notes == null || notes.Length == 0) return;

			// De-dupe chords by time (round to ms so float fuzz doesn’t explode keys)
		triggeredBeats.Clear();
		scheduledBeats.Clear();
		foreach (var n in notes)
		{
			float t = GetNoteSongTime(n);
			float key = Mathf.Round(t * 1000f) / 1000f;
			if (!triggeredBeats.Add(key))
				continue;

			scheduledBeats.Add(key);
		}

		if (scheduledBeats.Count > 1)
			scheduledBeats.Sort();

		beatCursor = 0;
	}

	#endregion

#if UNITY_EDITOR
	private void Reset()
	{
		ApplyVisualizationSettings();
	}
#endif

	private void Update()
	{
		ProcessScheduledBeats();
		ProcessHighwaySpawnWindow();
	}

			private void ProcessScheduledBeats()
			{
				if (scheduledBeats.Count == 0)
					return;
				var audio = AudioManager.Instance;
				if (audio == null)
					return;

#if UNITY_WEBGL && !UNITY_EDITOR
				if (!AudioManager.AudioUnlocked)
					return;
#endif

				double now = audio.GetAdjustedSongTime();
				double anchor = chartSongAnchorTime;

			while (beatCursor < scheduledBeats.Count && anchor + scheduledBeats[beatCursor] <= now)
			{
				double beatTime = anchor + scheduledBeats[beatCursor];
				LastBeatSongTime = beatTime;
				LastBeatSequenceIndex = beatCursor;

				ChartSystem.OnBeat?.Invoke();
				GameplayEventBus.RaiseBeat();
				beatCursor++;
			}

			NextBeatSequenceIndex = beatCursor;
			NextBeatSongTime = beatCursor < scheduledBeats.Count ? anchor + scheduledBeats[beatCursor] : 0d;
		}

	private void PrimeBeatCursorForCurrentPlayback()
	{
		if (scheduledBeats.Count == 0)
			return;

		AudioManager audio = AudioManager.Instance;
		if (audio == null || !audio.HasSongStarted)
			return;

		double now = audio.GetAdjustedSongTime();
		double anchor = chartSongAnchorTime;

		const double catchupThresholdSeconds = 0.25;
		if (now - anchor <= catchupThresholdSeconds)
			return;

		while (beatCursor < scheduledBeats.Count && anchor + scheduledBeats[beatCursor] <= now)
			beatCursor++;

		if (Debug.isDebugBuild)
			Debug.Log($"[ChartSystem] Catch-up: beat cursor -> {beatCursor}/{scheduledBeats.Count} (t={now:F3}s).");
	}

	private void ApplyVisualizationSettings()
	{
		CurrentVisualizationMode = vizMode;
		JudgementService.Windows = vizMode == VisualizationMode.WispPerimeter ? wispJudgement : highwayJudgement;
		UpdateCalibrationForVisualizationMode(vizMode);
		GameplayEventBus.RaiseVisualizationModeChanged(CurrentVisualizationMode);
		ResetTimelineUI();
	}

	static float _savedHighwayCalibrationMs = 0f;
	static bool _hasSavedCalibration;

	private static void UpdateCalibrationForVisualizationMode(VisualizationMode mode)
	{
		if (mode == VisualizationMode.WispPerimeter)
		{
			if (!_hasSavedCalibration)
			{
				_savedHighwayCalibrationMs = JudgementService.CalibrationOffsetMs;
				_hasSavedCalibration = true;
			}
			JudgementService.CalibrationOffsetMs = 0f;
		}
		else if (_hasSavedCalibration)
		{
			JudgementService.CalibrationOffsetMs = _savedHighwayCalibrationMs;
		}
	}
}
