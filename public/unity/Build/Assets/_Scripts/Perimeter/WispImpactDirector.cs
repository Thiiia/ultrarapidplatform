using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using DG.Tweening;
using Shapes;
using ChartLoader.NET.Framework;
using Sirenix.OdinInspector;
using UnityEngine.Rendering;
using TMPro;

public class WispImpactDirector : MonoBehaviour
{
	public static WispImpactDirector Instance;

	[TitleGroup("References")][Required] public PerimeterPathProvider path;
	[TitleGroup("References")][Required] public WispTimelineController wisp;
	[TitleGroup("References")][Required] public DiagramManager diagram;
	[TitleGroup("References")][Required] public ImpactFx fxPrefab;

	[TitleGroup("Profiles")][SerializeField] private BeatProfile beatProfile;
	[TitleGroup("Profiles")][SerializeField] private PerimeterVfxTheme vfxTheme;

	[TitleGroup("Hierarchy")][SerializeField] private Transform fxParentOverride;

	[TitleGroup("Timing")] public float previewLeadSeconds = 0.5f;
	public float judgeGraceSeconds = 0.10f;

	[TitleGroup("Approach FX")]
	[SerializeField] private bool enableApproachRings = true;
	[SerializeField] private Disc approachPrototype;
	[SerializeField] private bool leadInBeats = true;
	[SerializeField, Range(0.25f, 4f)] private float leadBeats = 1f;
	[SerializeField, Range(0.1f, 3f)] private float approachLeadSeconds = 1f;
	[SerializeField, Range(0.1f, 4f)] private float minimumPreviewLeadSeconds = 1.5f;
	[SerializeField] private float approachStartRadius = 1.1f;
	[SerializeField] private float approachTargetRadius = 0.25f;
	[SerializeField, Range(0f, 1f)] private float approachAlpha = 0.7f;
	[SerializeField, Range(0f, 1f)] private float approachHoldAlpha = 0.18f;
	[SerializeField, Range(0.05f, 0.6f)] private float approachHoldFadeSeconds = 0.20f;
	[SerializeField] private AnimationCurve approachRadiusCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
	[SerializeField] private AnimationCurve approachAlphaCurve = AnimationCurve.EaseInOut(0, 1, 1, 0);
	[SerializeField] private bool showGhostRings = true;
	[SerializeField, Range(0, 3)] private int ghostCount = 2;
	[SerializeField] private float ghostRadiusStep = 0.25f;
	[SerializeField, Range(0.1f, 0.95f)] private float ghostAlphaFalloff = 0.55f;
	[SerializeField] private int approachPoolSize = 32;
	[SerializeField] private bool prewarmApproachPool = true;

	[TitleGroup("Impact FX Pool")][SerializeField, Min(1)] private int poolSize = 32;
	[SerializeField, Min(1)] private int hardCapActiveFx = 96; // safety: never instantiate infinite
	[SerializeField, Tooltip("Seconds before a spawned impact FX is forcibly recycled even if tweens never finish.")] private float impactFxMaxLifetime = 3f;
	[SerializeField, Tooltip("Logs hit timing drift (ms) for diagnostics.")] private bool logHitTiming = false;
	[SerializeField, Tooltip("Warn when hit drift exceeds this many milliseconds.")] private float hitTimingWarningMs = 25f;

	// scheduling
	readonly Dictionary<long, ImpactFx> scheduled = new();       // expectedMs -> fx
	readonly Dictionary<long, BeatPayload> payloadByTime = new(); // expectedMs -> payload
	const int TimeQuantMs = 1; // 1ms bins
	static long ToKeyMs(double t) => (long)System.Math.Round(t * 1000.0 / TimeQuantMs) * TimeQuantMs;
	static long KeyOf(double seconds) => ToKeyMs(seconds);
	static double SecondsOf(long keyMs) => keyMs / 1000.0;



	// pools
	readonly Queue<ImpactFx> impactPool = new();
	readonly HashSet<ImpactFx> impactPoolSet = new();
	readonly List<ImpactFx> activeImpactFx = new();
	readonly Dictionary<ImpactFx, double> impactFxBirthTime = new();
	readonly Dictionary<ImpactFx, Tween> impactRecycleTweens = new();
	readonly Dictionary<ImpactFx, ulong> impactFxGeneration = new();
	ulong impactFxGenerationCounter;
	readonly List<ImpactFx> impactFxRecycleBuffer = new();
	readonly HashSet<long> passiveMissKeys = new();
	readonly List<long> passiveMissBuffer = new();
	readonly Queue<ImpactFx> pendingImpactReparents = new();
	bool impactReparentRoutineActive;
	readonly Queue<Disc> approachPool = new();
	readonly HashSet<Disc> approachPoolSet = new();
	readonly List<Tween> activeApproachTweens = new();
	readonly HashSet<long> approachKeys = new(); // dedupe by ms key
	long _lastResolveMs = long.MinValue;
	readonly Queue<TextMeshProUGUI> judgementLabelPool = new();
	readonly List<TextMeshProUGUI> judgementLabelScratch = new();
	readonly List<TextMeshProUGUI> activeJudgementLabels = new();
	double _lastJudgementLabelDsp;
	int _lastManualResolveFrame = -1;
	int _manualResolvesThisFrame = 0;

	struct AutoMissEntry
	{
		public long key;
		public double missAt;
	}

	int previewIndex = 0;
	readonly List<AutoMissEntry> autoMissQueue = new();
	[SerializeField, Tooltip("Seconds ahead of current song time to consider for preview generation (used to skip far-future notes).")]
	private float previewLookaheadSeconds = 6f;

	Transform fxParent, impactActiveRoot, impactPoolRoot, approachActiveRoot, approachPoolRoot;

	[Header("Impact Dot Overrides")]
	[SerializeField] bool overrideDotOptions = false;
	[SerializeField] bool enableCenterDot = true;
	[SerializeField] bool enableRadialBurst = true;

	// beat grid
	[Header("Beat Grid")][SerializeField] bool beatDriven = false; // gameplay: notes, not beat grid
	[SerializeField] bool alsoSpawnNoteTargets = false;
	[SerializeField, Range(0.25f, 4f)] float approachBeats = 1f;

	[Header("Clock & Input")]
	[SerializeField] float visualOffsetMs = 0f;
	[SerializeField] XplorerGuitarInput input;
	[SerializeField] KeyCode fallbackKey = KeyCode.Space;
	[SerializeField, Range(0.00f, 0.20f)] float inputLockoutSeconds = 0.06f;
	[SerializeField, Range(1, 6)] int manualResolveBurstLimit = 2;

	// continuous fill state
	[Header("Continuous Perimeter Fill")]
	[SerializeField] bool continuousPerimeterFill = true;
	[SerializeField, Range(0f, 1f)] float startT = 0f;
	float _filledUntilT = -1f;

	// beat state
	double _lastBeatTime = -1, _prevBeatTime = -1;
	readonly List<float> _tmpKeys = new();
	double _lastResolveSongTime = -999;
	double _beatDur = 0.5f;
	int sequenceCounter;
	[Header("Heat")]
	[SerializeField, Range(0f, 1f)] float heat = 0f;
	[SerializeField] float heatRisePerPerfect = 0.10f;
	[SerializeField] float heatRisePerGood = 0.06f;
	[SerializeField] float heatDropOnMiss = 0.35f;
	[SerializeField] float heatDecayPerSecond = 0.15f;
	[Header("Cleanup Flair")]
	[SerializeField, Tooltip("If enabled, impact discs get pulled into the wisp at the end of their life instead of just fading in place.")]
	bool enableWispEatCleanup = true;
	[SerializeField, Range(0.02f, 0.5f), Tooltip("How long the wisp-eat pull lasts once it starts.")]
	float wispEatTravelSeconds = 0.18f;
	[SerializeField, Range(0f, 0.5f), Tooltip("Delay after the hit before the wisp starts pulling the ring in.")]
	float wispEatDelaySeconds = 0.06f;

	[Header("Judgement Labels")]
	[SerializeField] bool enableJudgementLabels = true;
	[SerializeField] TextMeshProUGUI judgementLabelPrefab;
	[SerializeField] RectTransform judgementLabelParentOverride;
	[SerializeField, Range(0.2f, 1.2f)] float judgementLabelLifetime = 0.65f;
	[SerializeField, Range(0f, 1f)] float judgementLabelCooldown = 0.35f;
	[SerializeField, Range(0f, 120f)] float judgementLabelJitterRadius = 28f;
	[SerializeField, Range(0f, 120f)] float judgementLabelNormalOffset = 32f;
	[SerializeField] Color judgementPerfectColor = new Color32(0x62, 0xEF, 0x48, 0xFF);
	[SerializeField] Color judgementGoodColor = new Color32(0x6F, 0x37, 0x94, 0xFF);
	[SerializeField] Color judgementMissColor = new Color32(0xFF, 0x3C, 0x00, 0xFF);

	// Keep inspector-only and future-facing fields from generating compiler warnings when
	// they are not yet wired into runtime logic. These reads are never executed, but they
	// are enough for the compiler to treat the values as used.
	void __SuppressUnusedInspectorFields()
	{
		_ = alsoSpawnNoteTargets;
		_ = approachBeats;
		_ = _lastBeatTime;
		_ = _prevBeatTime;
		_ = _beatDur;
		_ = _lastResolveMs;
		_ = heatRisePerPerfect;
		_ = heatRisePerGood;
		_ = heatDropOnMiss;
		_ = enableWispEatCleanup;
		_ = wispEatTravelSeconds;
		_ = wispEatDelaySeconds;
	}


	public float VisualOffsetMs => visualOffsetMs;

	double Now()
	{
		double baseNow = AudioManager.CachedSongTime > 0 ? AudioManager.CachedSongTime : GetSongTime();
		return baseNow + visualOffsetMs / 1000.0;
	}

	void ApplyProfiles()
	{
		if (beatProfile)
		{
			leadInBeats = beatProfile.leadInBeats;
			leadBeats = Mathf.Max(0.05f, beatProfile.leadBeats);
			approachLeadSeconds = Mathf.Max(0.01f, beatProfile.fallbackLeadSeconds);
			if (beatProfile.radiusCurve != null) approachRadiusCurve = beatProfile.radiusCurve;
			if (beatProfile.alphaCurve != null) approachAlphaCurve = beatProfile.alphaCurve;

		}
		if (vfxTheme)
		{
			// Approach & ghost rings
			showGhostRings = vfxTheme.showGhostRings;
			ghostCount = Mathf.Clamp(vfxTheme.ghostCount, 0, 8);
			ghostRadiusStep = vfxTheme.ghostRadiusStep;
			ghostAlphaFalloff = vfxTheme.ghostAlphaFalloff;
			approachStartRadius = vfxTheme.approachStartRadius;
			approachTargetRadius = vfxTheme.approachTargetRadius;
			approachRadiusCurve = vfxTheme.approachRadius ?? approachRadiusCurve;
			approachAlphaCurve = vfxTheme.approachAlpha ?? approachAlphaCurve;
			// Use theme’s dedicated approach ring colour (falls back to previewTint alpha on older assets)
			var approachColor = vfxTheme.approachRingColor.a > 0f ? vfxTheme.approachRingColor : vfxTheme.previewTint;
			approachAlpha = Mathf.Clamp01(approachColor.a);
		}
	}

	void Awake()
	{
		Instance = this;
		ApplyProfiles();
		fxParent = (fxParentOverride != null) ? fxParentOverride : ((path != null && path.ReferenceRect != null) ? (Transform)path.ReferenceRect : transform);
		impactActiveRoot = new GameObject("ImpactFX_Active", typeof(RectTransform)).transform; impactActiveRoot.SetParent(fxParent, false);
		impactPoolRoot = new GameObject("ImpactFX_Pool", typeof(RectTransform)).transform; impactPoolRoot.SetParent(fxParent, false);

		for (int i = 0; i < poolSize; i++) { var fx = Instantiate(fxPrefab, impactPoolRoot); fx.gameObject.SetActive(false); SetupImpactFx(fx); fx.ResetToPoolState(); impactPool.Enqueue(fx); impactPoolSet.Add(fx); }

		if (approachPrototype)
		{
			approachPrototype.enabled = false; approachPrototype.gameObject.SetActive(false);
			approachActiveRoot = new GameObject("ApproachActive", typeof(RectTransform)).transform; approachActiveRoot.SetParent(fxParent, false);
			approachPoolRoot = new GameObject("ApproachPool", typeof(RectTransform)).transform; approachPoolRoot.SetParent(fxParent, false);

			if (prewarmApproachPool)
				for (int i = 0; i < Mathf.Max(0, approachPoolSize); i++)
				{ var d = Instantiate(approachPrototype, approachPoolRoot); d.enabled = false; d.gameObject.SetActive(false); approachPool.Enqueue(d); approachPoolSet.Add(d); }
		}
	}
	void Update()
	{
		ProcessPreviewQueue();

		// Space is always allowed, even if a controller is present
		bool pressed = (input && input.yellow) || Input.GetKeyDown(fallbackKey);
		if (pressed) TryResolveNearestScheduled();

		AutoMissExpired();
		heat = Mathf.Max(0f, heat - heatDecayPerSecond * Time.deltaTime);
		CullExpiredImpactFx();
	}


	void OnEnable()
	{
		ChartSystem.OnChartInitialized += OnChart;
		if (beatDriven) ChartSystem.OnBeat += HandleBeat;
		GameplayEventBus.HitJudged += OnHitJudged;
		GameplayEventBus.HeatChanged += HandleGlobalHeatChanged;
		GameplayEventBus.PerimeterHeadMoved += HandlePerimeterHeadMoved;
		GameplayEventBus.OnPerimeterShapeChanged += HandlePerimeterShapeChanged;
		GameplayEventBus.ChartCompleted += HandleChartCompleted;

		if (pendingApproachReparents.Count > 0 && !approachReparentRoutineActive)
			StartCoroutine(ProcessPendingApproachReparents());
		if (pendingImpactReparents.Count > 0 && !impactReparentRoutineActive)
			StartCoroutine(ProcessPendingImpactReparents());
	}

	void OnDisable()
	{
		ChartSystem.OnChartInitialized -= OnChart;
		if (beatDriven) ChartSystem.OnBeat -= HandleBeat;
		GameplayEventBus.HitJudged -= OnHitJudged;
		GameplayEventBus.HeatChanged -= HandleGlobalHeatChanged;
		GameplayEventBus.PerimeterHeadMoved -= HandlePerimeterHeadMoved;
		GameplayEventBus.OnPerimeterShapeChanged -= HandlePerimeterShapeChanged;
		GameplayEventBus.ChartCompleted -= HandleChartCompleted;

		StopAllCoroutines();
		ResetActiveVfxState();
	}

	void HandlePerimeterHeadMoved(float normalizedT, int pathIndex)
	{
		_filledUntilT = normalizedT;
	}

	void HandlePerimeterShapeChanged(GameObject perimeterInstance)
	{
		ResetActiveVfxState();
		ResetPreviewState();
	}

	void HandleChartCompleted()
	{
		ResetActiveVfxState();
		ResetPreviewState();
	}

	void OnDestroy()
	{
		CleanupImpactFxRoots();
		CleanupApproachRoots();
	}

	// ---------------- chart/beat scheduling ----------------

	void OnChart()
	{
		StopAllCoroutines();
		ResetActiveVfxState();
		_filledUntilT = startT;
		// compute actual starting T from wisp now, and sync diagram so the fill starts here
		startT = (wisp != null) ? wisp.GetNormalizedT(Now()) : 0f;
		_filledUntilT = startT;
		if (diagram) diagram.ResetGlobalFill(startT);


		ResetPreviewState();
	}

	void HandleBeat()
	{
		if (!beatDriven) return;
	}

	ImpactFx GetOrReuseFx(long key)
	{
		if (scheduled.TryGetValue(key, out var fx) && fx) return fx;

		if (impactPool.Count == 0 && (impactActiveRoot.childCount + impactPoolRoot.childCount) >= hardCapActiveFx)
		{
			if (impactActiveRoot.childCount > 0)
			{
				var oldest = impactActiveRoot.GetChild(0).GetComponent<ImpactFx>();
				if (oldest) RecycleImpactFx(oldest);
			}
		}
		return GetImpactFx();
	}


	void OnHitJudged(RhythmHitKind kind, int streak)
	{
		// Heat is primarily driven by the global ScoreManager via GameplayEventBus.HeatChanged.
		// We keep this callback for future feel routing (eg. per-hit camera shakes) but avoid
		// mutating the local heat accumulator so both systems stay in sync.
	}

	void HandleGlobalHeatChanged(float value)
	{
		heat = Mathf.Clamp01(value);
	}

	ImpactFx GetImpactFx()
	{
		ImpactFx fx;
		if (impactPool.Count > 0) { fx = impactPool.Dequeue(); impactPoolSet.Remove(fx); }
		else fx = Instantiate(fxPrefab, impactActiveRoot);

		fx.transform.SetParent(impactActiveRoot, false);
		fx.transform.localPosition = Vector3.zero;
		fx.transform.localRotation = Quaternion.identity;
		fx.transform.localScale = Vector3.one;
		fx.gameObject.SetActive(true);
		SetupImpactFx(fx);
		fx.ResetToPoolState();
		MarkImpactFxActive(fx);
		TrackImpactFx(fx);
		return fx;
	}

	void MarkImpactFxActive(ImpactFx fx)
	{
		if (!fx) return;

		if (impactRecycleTweens.TryGetValue(fx, out var recycleTween) && recycleTween != null)
		{
			recycleTween.Kill(false);
			impactRecycleTweens.Remove(fx);
		}

		impactFxGeneration[fx] = ++impactFxGenerationCounter;
	}

	void RecycleImpactFx(ImpactFx fx)
	{
		if (!fx) return;
		if (impactRecycleTweens.TryGetValue(fx, out var recycleTween) && recycleTween != null)
		{
			recycleTween.Kill(false);
			impactRecycleTweens.Remove(fx);
		}
		impactFxGeneration.Remove(fx);
		UntrackImpactFx(fx);
		fx.ResetToPoolState();
		fx.gameObject.SetActive(false);

		QueueImpactFxForPool(fx);
	}

	void ScheduleImpactRecycle(ImpactFx fx, float delaySeconds)
	{
		if (!fx) return;

		if (!impactFxGeneration.TryGetValue(fx, out var generation))
		{
			generation = ++impactFxGenerationCounter;
			impactFxGeneration[fx] = generation;
		}

		if (impactRecycleTweens.TryGetValue(fx, out var existing) && existing != null)
		{
			existing.Kill(false);
			impactRecycleTweens.Remove(fx);
		}

		float safeDelay = Mathf.Max(0.05f, delaySeconds);
		if (impactFxMaxLifetime > 0.0001f)
			safeDelay = Mathf.Min(safeDelay, impactFxMaxLifetime);

		var recycleTween = DOVirtual.DelayedCall(safeDelay, () =>
		{
			if (!impactFxGeneration.TryGetValue(fx, out var activeGen) || activeGen != generation)
				return;
			impactRecycleTweens.Remove(fx);
			RecycleImpactFx(fx);
		})
		.SetTarget(fx)
		.SetUpdate(true)
		.SetLink(fx.gameObject, LinkBehaviour.KillOnDestroy);

		impactRecycleTweens[fx] = recycleTween;
	}

	void SetupImpactFx(ImpactFx fx)
	{
		if (!fx) return;
		if (vfxTheme) fx.ApplyTheme(vfxTheme);
		else if (diagram) fx.ApplyPalette(diagram.PreviewColor, diagram.MissColor);

		if (overrideDotOptions)
			fx.ConfigureDotBehaviour(enableCenterDot, enableRadialBurst);
	}
	void RecycleAllScheduledFx()
	{
		if (scheduled.Count == 0) return;
		foreach (var kv in scheduled)
		{
			if (kv.Value) RecycleImpactFx(kv.Value);
		}
		scheduled.Clear();
	}

	void SpawnApproachSetOnce(BeatPayload payload, Vector3 pos, Quaternion rot)
	{
		long key = KeyOf(payload.DspTime);
		if (!approachKeys.Add(key)) return; // already spawned for this time

		double now = Now();
		float remaining = Mathf.Max(0.01f, (float)payload.DspTime - (float)now);
		float travel = Mathf.Min(remaining, Mathf.Max(0.01f, payload.LeadInSeconds));
		if (travel <= 0.001f) return;
		float holdSeconds = Mathf.Max(0f, remaining - travel);

		Vector2 anchored = new(pos.x, pos.y);
		Color baseCol;
		if (vfxTheme)
		{
			// Prefer the theme’s explicit approach ring colour; fall back to previewTint for legacy assets
			baseCol = vfxTheme.approachRingColor.a > 0f ? vfxTheme.approachRingColor : vfxTheme.previewTint;
		}
		else
		{
			baseCol = diagram ? diagram.PreviewColor : Color.yellow;
		}

		// main ring
		Disc main = GetApproachDisc();
		SetAnchored(main.transform, anchored); SetLocalRotation(main.transform, rot);
		main.Type = DiscType.Ring; main.RadiusSpace = approachPrototype.RadiusSpace;
		main.ThicknessSpace = approachPrototype.ThicknessSpace; main.Thickness = approachPrototype.Thickness;
		main.Radius = approachStartRadius; main.Color = new Color(baseCol.r, baseCol.g, baseCol.b, approachAlpha);

		string id = ApproachId(key, "main");
		var seq = DOTween.Sequence();
		seq.SetId(id).SetTarget(main).SetUpdate(true).SetLink(main.gameObject, LinkBehaviour.KillOnDestroy)
			.Append(DOVirtual.Float(0f, 1f, travel, p =>
			{
				p = Mathf.Clamp01(p);
				main.Radius = Mathf.Lerp(approachStartRadius, approachTargetRadius, approachRadiusCurve.Evaluate(p));
				float holdA = Mathf.Clamp01(approachHoldAlpha);
				float a = Mathf.Lerp(approachAlpha, holdA, approachAlphaCurve.Evaluate(p));
				main.Color = new Color(baseCol.r, baseCol.g, baseCol.b, a);
			}).SetEase(Ease.Linear));

		if (holdSeconds > 0.001f)
			seq.AppendInterval(holdSeconds);

		// Snappy vanish: once the hit window has passed, quickly shrink the approach
		// ring inward while fading it out so it doesn't sit around as a ghost.
		float vanishSeconds = Mathf.Max(0.05f, approachHoldFadeSeconds);
		float mainStartRadius = approachTargetRadius;
		float mainEndRadius = approachTargetRadius * 0.6f;
		float mainStartAlpha = Mathf.Clamp01(approachHoldAlpha);

		seq.Append(DOVirtual.Float(0f, 1f, vanishSeconds, t =>
		{
			t = Mathf.Clamp01(t);
			float r = Mathf.Lerp(mainStartRadius, mainEndRadius, t);
			main.Radius = r;
			float a = Mathf.Lerp(mainStartAlpha, 0f, t);
			main.Color = new Color(baseCol.r, baseCol.g, baseCol.b, a);
		}).SetEase(Ease.InQuad))
		  .OnKill(() =>
		  {
			  ReturnApproachDisc(main, stopTweens: false);
			  activeApproachTweens.Remove(seq);
		  });
		RegisterApproachTween(seq);

		if (showGhostRings && ghostCount > 0)
		{
			for (int g = 1; g <= ghostCount; g++)
			{
				Disc ghost = GetApproachDisc();
				SetAnchored(ghost.transform, anchored); SetLocalRotation(ghost.transform, rot);
				ghost.Type = DiscType.Ring; ghost.RadiusSpace = approachPrototype.RadiusSpace;
				ghost.ThicknessSpace = approachPrototype.ThicknessSpace; ghost.Thickness = approachPrototype.Thickness;
				ghost.Radius = approachStartRadius + ghostRadiusStep * g;
				float gAlpha = Mathf.Pow(ghostAlphaFalloff, g) * approachAlpha;
				ghost.Color = new Color(baseCol.r, baseCol.g, baseCol.b, gAlpha);

				string gid = ApproachId(key, $"ghost{g}");
				var gseq = DOTween.Sequence();
				gseq.SetId(gid).SetTarget(ghost).SetUpdate(true)
					.SetLink(ghost.gameObject, LinkBehaviour.KillOnDestroy)
					.Append(DOVirtual.Float(0f, 1f, travel, p =>
					{
						p = Mathf.Clamp01(p);
						ghost.Radius = Mathf.Lerp(approachStartRadius + ghostRadiusStep * g, approachTargetRadius, approachRadiusCurve.Evaluate(p));
						float a = Mathf.Lerp(gAlpha, Mathf.Clamp01(approachHoldAlpha), approachAlphaCurve.Evaluate(p));
						ghost.Color = new Color(baseCol.r, baseCol.g, baseCol.b, a);
					}).SetEase(Ease.Linear));

				if (holdSeconds > 0.001f)
					gseq.AppendInterval(holdSeconds);

				float ghostStartRadius = ghost.Radius;
				float ghostEndRadius = approachTargetRadius * 0.5f;
				float ghostStartAlpha = Mathf.Clamp01(approachHoldAlpha * Mathf.Pow(ghostAlphaFalloff, g));
				float vanishGhostSeconds = Mathf.Max(0.05f, approachHoldFadeSeconds * 0.9f);

				gseq.Append(DOVirtual.Float(0f, 1f, vanishGhostSeconds, t =>
					{
						t = Mathf.Clamp01(t);
						float r = Mathf.Lerp(ghostStartRadius, ghostEndRadius, t);
						ghost.Radius = r;
						float a = Mathf.Lerp(ghostStartAlpha, 0f, t);
						ghost.Color = new Color(baseCol.r, baseCol.g, baseCol.b, a);
					}).SetEase(Ease.InQuad))
					.OnKill(() =>
					{
						ReturnApproachDisc(ghost, stopTweens: false);
						activeApproachTweens.Remove(gseq);
					});
				RegisterApproachTween(gseq);
			}
		}
	}

	// resolve

	public static void ReportJudgement(float expectedTime, HitResult result)
	{ if (Instance) Instance.Resolve(expectedTime, result); }

	void Resolve(float expectedTime, HitResult result)
	{
		long k = KeyOf(expectedTime);
		bool passiveMiss = result == HitResult.Miss && passiveMissKeys.Remove(k);
		RemoveAutoMissEntry(k);
		Vector2 anchored = EvaluateHitAnchored(expectedTime);
		Quaternion rotation = EvaluateHitRotation(expectedTime);
		Vector2 normal = EvaluateHitNormal(expectedTime);

		ImpactFx fx = scheduled.TryGetValue(k, out var existing) ? existing : GetImpactFx();
		if (!existing)
		{
			SetAnchored(fx.transform, anchored); SetLocalRotation(fx.transform, rotation);
			fx.gameObject.SetActive(true);
		}
		// Tint impact FX by theme ring colour when available; otherwise fall back to diagram preview colour
		var laneColor = vfxTheme
			? new Color(vfxTheme.impactRingColor.r, vfxTheme.impactRingColor.g, vfxTheme.impactRingColor.b, 1f)
			: (diagram ? diagram.PreviewColor : new Color(0.9f, 1f, 0.6f, 1f)); // fallback if no palette available
		fx.SetLaneColor(laneColor);

		if (result == HitResult.Perfect) fx.HitPerfect(heat);
		else if (result == HitResult.Good) fx.HitGood(heat);
		else
		{
			if (passiveMiss) fx.MissPassive();
			else fx.Miss();
		}

		// Broadcast scoring judgement
		int prevStreak = ScoreManagerScript.Instance ? ScoreManagerScript.Instance.CurrentStreak : 0;
		ScoreManagerScript.Instance?.RegisterNoteHit
	(
	   result == HitResult.Perfect ? "Perfect" :
	   result == HitResult.Good ? "Good" :
	   "Miss"
	);

		bool allowMissLabel = result == HitResult.Miss && prevStreak > 0;
		ShowJudgementLabel(result, anchored, normal, allowMissLabel);

		// Ensure timeline progress advances in Wisp mode as notes are resolved
		// (Highway mode increments via trigger callbacks in NoteBlockScript.)
		if (ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter)
			ScoreManagerScript.Instance?.RegisterNoteDestroyed();

		if (payloadByTime.TryGetValue(k, out var payload))
			GameplayEventBus.RaiseBeatResolved(payload, result);

		KillApproachTweens(expectedTime);
		payloadByTime.Remove(k);
		scheduled.Remove(k);

		// diagram fill
		if (path && wisp && diagram)
		{
			double now = Now();
			if (logHitTiming)
			{
				float driftMs = (float)((now - expectedTime) * 1000.0);
				if (Mathf.Abs(driftMs) > hitTimingWarningMs)
					Debug.LogWarning($"[WispImpactDirector] Hit drift {driftMs:+0.0;-0.0;0} ms (threshold {hitTimingWarningMs})");
				else
					Debug.Log($"[WispImpactDirector] Hit drift {driftMs:+0.0;-0.0;0} ms");
			}
			float hitT = wisp.GetNormalizedT(now);
			bool cw = (wisp.PathDirection == WispTimelineController.Direction.CW);
			int segIdx = path ? path.GetSegmentIndex(hitT) : -1;

			if (continuousPerimeterFill)
			{
				float fromT = (_filledUntilT < 0f) ? startT : _filledUntilT;
				// Only advance the continuous fill on successful hits
				if (result == HitResult.Perfect || result == HitResult.Good)
				{
					diagram.FillBetween(fromT, hitT, cw);
					// feedback difference between Good vs Perfect
					if (segIdx >= 0)
						diagram.GlobalHitFeedback(segIdx, result);
				}
				else if (result == HitResult.Miss && segIdx >= 0)
				{
					diagram.GlobalMissFeedback(segIdx);
				}

				if (segIdx >= 0)
					diagram.ApplyHitByPathIndex(segIdx, result);

				// In continuous perimeter mode, do not advance per-segment milestone logic
			}
			else
			{
				// Highway mode: apply discrete per-segment hits for milestones
				if (segIdx >= 0)
				{
					diagram.ApplyHitByPathIndex(segIdx, result);
					if (result == HitResult.Miss) diagram.GlobalMissFeedback(segIdx);
				}
			}

		}

		// Recycle impact FX on a fixed delay; any extra cleanup flair is currently disabled
		// to avoid additional positional pull that can feel disorienting.
		ScheduleImpactRecycle(fx, 0.30f);
	}

	// -------------- pools & helpers --------------

	readonly Queue<Disc> pendingApproachReparents = new Queue<Disc>();
	bool approachReparentRoutineActive;

	Disc GetApproachDisc()
	{
		Disc d;
		if (approachPool.Count > 0) { d = approachPool.Dequeue(); approachPoolSet.Remove(d); }
		else d = Instantiate(approachPrototype, approachActiveRoot);
		DOTween.Kill(d);
		DOTween.Kill(d.transform);
		d.transform.SetParent(approachActiveRoot, false);
		d.gameObject.SetActive(true);
		d.enabled = true;
		// Stable UI ordering: above perimeter fill but below impact ring
		d.ZTest = CompareFunction.Always;
		d.SortingOrder = 12;
		return d;
	}
	void ReturnApproachDisc(Disc d, bool stopTweens = true, bool forceImmediate = false)
	{
		if (!d) return;
		if (stopTweens)
		{
			DOTween.Kill(d);
			DOTween.Kill(d.transform);
		}
		d.enabled = false;
		d.gameObject.SetActive(false);

		bool canImmediate = forceImmediate
			&& approachPoolRoot != null
			&& approachPoolRoot.gameObject.activeInHierarchy
			&& isActiveAndEnabled
			&& gameObject.activeInHierarchy;

		if (canImmediate)
		{
			if (approachPoolRoot)
				d.transform.SetParent(approachPoolRoot, false);
			if (approachPoolSet.Add(d))
				approachPool.Enqueue(d);
			return;
		}

		pendingApproachReparents.Enqueue(d);
		if (isActiveAndEnabled && !approachReparentRoutineActive)
			StartCoroutine(ProcessPendingApproachReparents());
	}

	IEnumerator ProcessPendingApproachReparents()
	{
		approachReparentRoutineActive = true;
		var wait = new WaitForEndOfFrame();
		while (pendingApproachReparents.Count > 0)
		{
			var disc = pendingApproachReparents.Dequeue();
			yield return wait;
			if (!disc)
				continue;

			if (approachPoolRoot == null || !approachPoolRoot.gameObject.activeInHierarchy)
			{
				pendingApproachReparents.Enqueue(disc);
				break;
			}

			disc.transform.SetParent(approachPoolRoot, false);
			if (approachPoolSet.Add(disc))
				approachPool.Enqueue(disc);
		}
		approachReparentRoutineActive = false;
	}

	IEnumerator ProcessPendingImpactReparents()
	{
		impactReparentRoutineActive = true;
		var wait = new WaitForEndOfFrame();
		while (pendingImpactReparents.Count > 0)
		{
			var fx = pendingImpactReparents.Dequeue();
			yield return wait;
			if (!fx) continue;

			if (impactPoolRoot == null || !impactPoolRoot.gameObject.activeInHierarchy)
			{
				pendingImpactReparents.Enqueue(fx);
				break;
			}

			fx.transform.SetParent(impactPoolRoot, false);
			if (impactPoolSet.Add(fx))
				impactPool.Enqueue(fx);
		}
		impactReparentRoutineActive = false;
	}

	void RegisterApproachTween(Tween t) { if (t != null) activeApproachTweens.Add(t); }
	void KillApproachTweens(float expectedTime)
	{
		long key = KeyOf(expectedTime);
		string prefix = ApproachPrefix(key);
		for (int i = activeApproachTweens.Count - 1; i >= 0; i--)
		{
			var tw = activeApproachTweens[i];
			if (tw == null) { activeApproachTweens.RemoveAt(i); continue; }
			if (tw.id is string id && id.StartsWith(prefix)) tw.Kill(false);
		}
		approachKeys.Remove(key);
		payloadByTime.Remove(key);
	}
	void KillAllApproachTweens()
	{
		for (int i = activeApproachTweens.Count - 1; i >= 0; i--)
		{
			var tween = activeApproachTweens[i];
			try { tween?.Kill(false); } catch { }
		}
		activeApproachTweens.Clear();
	}

	bool _vfxCleanupInProgress;

	void ResetActiveVfxState()
	{
		_vfxCleanupInProgress = true;
		KillAllApproachTweens();
		approachKeys.Clear();
		RecycleAllScheduledFx();
		payloadByTime.Clear();
		sequenceCounter = 0;
		previewIndex = 0;
		autoMissQueue.Clear();
		ResetImpactFxInstances();
		ResetApproachDiscsImmediate();
		ClearJudgementLabels();
		_vfxCleanupInProgress = false;
	}

	void TrackImpactFx(ImpactFx fx)
	{
		if (!fx) return;
		if (!impactFxBirthTime.ContainsKey(fx))
			activeImpactFx.Add(fx);
		impactFxBirthTime[fx] = Now();
	}

	void UntrackImpactFx(ImpactFx fx)
	{
		if (!fx) return;
		impactFxBirthTime.Remove(fx);
		activeImpactFx.Remove(fx);
	}

	void CullExpiredImpactFx()
	{
		if (_vfxCleanupInProgress) return;
		if (impactFxMaxLifetime <= 0f || activeImpactFx.Count == 0)
			return;

		double now = Now();
		var expired = new List<ImpactFx>();

		for (int i = activeImpactFx.Count - 1; i >= 0; i--)
		{
			var fx = activeImpactFx[i];
			if (!fx)
			{
				activeImpactFx.RemoveAt(i);
				continue;
			}

			if (!impactFxBirthTime.TryGetValue(fx, out var born))
			{
				activeImpactFx.RemoveAt(i);
				continue;
			}

			if (now - born >= impactFxMaxLifetime)
			{
				expired.Add(fx);
				activeImpactFx.RemoveAt(i);
				impactFxBirthTime.Remove(fx);
			}
		}

		foreach (var fx in expired)
		{
			RecycleImpactFx(fx);
		}
	}

	public void ForceClearVfx()
	{
		ResetActiveVfxState();
		ApplyProfiles();
	}

	void ResetImpactFxInstances()
	{
		if (!impactActiveRoot) return;

		foreach (var tween in impactRecycleTweens.Values)
			tween?.Kill(false);
		impactRecycleTweens.Clear();
		impactFxGeneration.Clear();

		for (int i = impactActiveRoot.childCount - 1; i >= 0; i--)
		{
			var child = impactActiveRoot.GetChild(i);
			var fx = child ? child.GetComponent<ImpactFx>() : null;
			if (fx) RecycleImpactFx(fx);
			else if (child)
				Destroy(child.gameObject);
		}
	}

	void ResetApproachDiscsImmediate()
	{
		if (!approachActiveRoot) return;
		var buffer = new List<Disc>();
		for (int i = 0; i < approachActiveRoot.childCount; i++)
		{
			var disc = approachActiveRoot.GetChild(i).GetComponent<Disc>();
			if (disc) buffer.Add(disc);
		}

		foreach (var disc in buffer)
			ReturnApproachDisc(disc, stopTweens: true, forceImmediate: true);
	}

	string ApproachPrefix(long keyMs) => $"approach:{keyMs}";
	string ApproachId(long keyMs, string suff) => $"{ApproachPrefix(keyMs)}:{suff}";

	void ShowJudgementLabel(HitResult result, Vector2 anchoredPos, Vector2 normal, bool allowMiss)
	{
		if (!enableJudgementLabels || judgementLabelPrefab == null)
			return;

		bool isPositive = result == HitResult.Perfect || result == HitResult.Good;
		bool shouldShowMiss = allowMiss && result == HitResult.Miss;
		if (!isPositive && !shouldShowMiss)
			return;

		RectTransform parent = judgementLabelParentOverride ? judgementLabelParentOverride : path?.ReferenceRect;
		if (!parent)
			return;

		double now = Now();
		if (now - _lastJudgementLabelDsp < judgementLabelCooldown)
			return;
		_lastJudgementLabelDsp = now;

		Vector2 finalPos = anchoredPos;
		if (normal.sqrMagnitude < 1e-4f) normal = Vector2.up;
		finalPos += normal.normalized * judgementLabelNormalOffset;
		if (judgementLabelJitterRadius > 0.01f)
			finalPos += Random.insideUnitCircle * judgementLabelJitterRadius;

		var label = judgementLabelPool.Count > 0
			? judgementLabelPool.Dequeue()
			: Instantiate(judgementLabelPrefab, parent);

		if (!label) return;

		label.gameObject.SetActive(true);
		var rt = label.rectTransform;
		rt.SetParent(parent, false);
		rt.anchoredPosition = finalPos;
		label.text = JudgementText(result);
		label.color = JudgementColor(result);
		label.alpha = 0f;
		rt.localScale = Vector3.one * 0.9f;
		if (!activeJudgementLabels.Contains(label))
			activeJudgementLabels.Add(label);

		DOTween.Kill(label);
		DOTween.Kill(rt);

		DOTween.Sequence()
			.SetTarget(label)
			.SetUpdate(true)
			.Append(label.DOFade(1f, 0.08f))
			.Join(rt.DOScale(1.05f, 0.12f).SetEase(Ease.OutBack))
			.AppendInterval(Mathf.Max(0.05f, judgementLabelLifetime - 0.24f))
			.Append(label.DOFade(0f, 0.2f).SetEase(Ease.InQuad)
				.OnStart(() => rt.DOScale(0.9f, 0.2f).SetEase(Ease.InQuad)))
			.OnKill(() =>
			{
				if (!label) return;
				activeJudgementLabels.Remove(label);
				label.alpha = 0f;
				rt.localScale = Vector3.one;
				RecycleJudgementLabel(label);
			});
	}

	void RecycleJudgementLabel(TextMeshProUGUI label)
	{
		if (!label) return;
		label.alpha = 0f;
		if (label.rectTransform) label.rectTransform.localScale = Vector3.one;
		if (label.gameObject.activeSelf)
			label.gameObject.SetActive(false);
		if (!judgementLabelPool.Contains(label))
			judgementLabelPool.Enqueue(label);
	}
	void ClearJudgementLabels()
	{
		foreach (var label in activeJudgementLabels)
		{
			RecycleJudgementLabel(label);
		}
		activeJudgementLabels.Clear();

		judgementLabelScratch.Clear();
		while (judgementLabelPool.Count > 0)
		{
			var pooled = judgementLabelPool.Dequeue();
			judgementLabelScratch.Add(pooled);
		}

		foreach (var pooled in judgementLabelScratch)
		{
			if (!pooled) continue;
			DOTween.Kill(pooled);
			if (pooled.rectTransform) DOTween.Kill(pooled.rectTransform);
			pooled.alpha = 0f;
			if (pooled.rectTransform) pooled.rectTransform.localScale = Vector3.one;
			pooled.gameObject.SetActive(false);
			judgementLabelPool.Enqueue(pooled);
		}
		judgementLabelScratch.Clear();
	}

	Color JudgementColor(HitResult result) =>
		result switch
		{
			HitResult.Perfect => judgementPerfectColor,
			HitResult.Good => judgementGoodColor,
			_ => judgementMissColor
		};

	string JudgementText(HitResult result) =>
		result switch
		{
			HitResult.Perfect => "PERFECT",
			HitResult.Good => "GOOD",
			_ => "MISS"
		};

	// coordinates/space
	void SetAnchored(Transform target, Vector2 anchored)
	{
		var rt = target as RectTransform;
		if (rt != null && path != null && path.ReferenceRect != null)
		{
			rt.SetParent(path.ReferenceRect, false);
			rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
			rt.pivot = new Vector2(0.5f, 0.5f);
			rt.localScale = Vector3.one; rt.localRotation = Quaternion.identity;
			rt.anchoredPosition = anchored; return;
		}
		target.position = path.ReferenceLocalToWorld(new Vector3(anchored.x, anchored.y, 0f));
	}
	void SetLocalRotation(Transform target, Quaternion worldRot)
	{
		if (!target) return;
		var rt = target as RectTransform;
		if (rt != null && path != null && path.ReferenceRect != null)
		{ var e = worldRot.eulerAngles; rt.localEulerAngles = new Vector3(0, 0, e.z); return; }
		if (target.parent) target.localRotation = Quaternion.Inverse(target.parent.rotation) * worldRot;
		else target.rotation = worldRot;
	}

	Vector2 EvaluateHitAnchored(float expectedTime) =>
		path ? path.EvaluateAnchoredPosition(wisp ? wisp.GetNormalizedT(expectedTime) : 0f) : Vector2.zero;
	Quaternion EvaluateHitRotation(float expectedTime)
	{
		if (path && wisp)
		{
			float t = wisp.GetNormalizedT(expectedTime);
			Vector3 tan = path.EvaluateTangent(t);
			if (tan.sqrMagnitude > 1e-6f)
				return Quaternion.Euler(0, 0, Mathf.Atan2(tan.y, tan.x) * Mathf.Rad2Deg);
		}
		return Quaternion.identity;
	}
	Vector2 EvaluateHitNormal(float expectedTime)
	{
		if (path && wisp)
		{
			float t = wisp.GetNormalizedT(expectedTime);
			Vector3 tan3 = path.EvaluateTangent(t);
			Vector2 tangent = new Vector2(tan3.x, tan3.y);
			if (tangent.sqrMagnitude < 1e-6f) tangent = Vector2.right;
			tangent.Normalize();
			Vector2 normal = new Vector2(-tangent.y, tangent.x);
			bool cw = (wisp.PathDirection == WispTimelineController.Direction.CW);
			return cw ? normal : -normal;
		}
		return Vector2.up;
	}
	float GetBeatDuration(Note n)
	{
		if (n == null || n.SynchTrack == null) return 0.5f;
		float bpmMilli = n.SynchTrack.BeatsPerMinute;
		float bpm = bpmMilli > 0 ? bpmMilli / 1000f : 120f;
		return 60f / Mathf.Max(1f, bpm);
	}
	double GetSongTime()
	{
		var a = AudioManager.Instance;
		return a ? a.GetAdjustedSongTime() : AudioSettings.dspTime;
	}

	void TryResolveNearestScheduled()
	{
		if (scheduled.Count == 0) return;

		if (_lastManualResolveFrame != Time.frameCount)
		{
			_lastManualResolveFrame = Time.frameCount;
			_manualResolvesThisFrame = 0;
		}
		if (_manualResolvesThisFrame >= manualResolveBurstLimit)
			return;

		double now = Now();
		if (now - _lastResolveSongTime < inputLockoutSeconds) return;

		long bestKey = 0;
		double bestAbs = double.MaxValue;

		foreach (var kv in scheduled)
		{
			double expected = SecondsOf(kv.Key);
			double abs = System.Math.Abs(now - expected);
			if (abs < bestAbs) { bestAbs = abs; bestKey = kv.Key; }
		}

		float expectedTime = (float)SecondsOf(bestKey);
		var result = JudgementService.Judge(expectedTime, now);
		if (result == HitResult.Miss && bestAbs > JudgementService.Windows.miss) return;

		Resolve(expectedTime, result);
		_lastResolveSongTime = now;
		_manualResolvesThisFrame++;
	}

	void ProcessPreviewQueue()
	{
		var notes = ChartSystem.CachedNotes;
		if (notes == null || notes.Length == 0)
			return;

		double now = Now();
		double lookahead = now + Mathf.Max(0.1f, previewLookaheadSeconds);

		while (previewIndex < notes.Length)
		{
			var n = notes[previewIndex];
			float expected = ChartSystem.GetNoteHitTime(n);
			float beatDuration = GetBeatDuration(n);

			float approachLeadBase = leadInBeats ? beatDuration * leadBeats : approachLeadSeconds;
			float approachLeadForNote = enableApproachRings
				? Mathf.Max(minimumPreviewLeadSeconds, Mathf.Max(0.01f, approachLeadBase))
				: Mathf.Max(minimumPreviewLeadSeconds, previewLeadSeconds);

			float previewLeadForNote = Mathf.Max(minimumPreviewLeadSeconds, Mathf.Max(0.01f, previewLeadSeconds));
			float spawnLead = Mathf.Max(previewLeadForNote, approachLeadForNote);
			double spawnTime = expected - spawnLead;

			// Skip far future notes to avoid scanning entire chart every frame.
			if (spawnTime > lookahead)
				break;

			if (spawnTime <= now)
			{
				SpawnPreviewPayload(expected, beatDuration, approachLeadForNote, previewLeadForNote);
				previewIndex++;
			}
			else
			{
				break;
			}
		}
	}

	void SpawnPreviewPayload(float expectedTime, float beatDuration, float approachLeadForNote, float previewLeadForNote)
	{
		Vector2 anchored = EvaluateHitAnchored(expectedTime);
		Quaternion rot = EvaluateHitRotation(expectedTime);
		long k = KeyOf(expectedTime);

		// update/insert payload
		if (payloadByTime.TryGetValue(k, out var existing))
		{
			var changed = !Mathf.Approximately(existing.LeadInSeconds, approachLeadForNote);
			existing = existing.WithLead(approachLeadForNote);
			payloadByTime[k] = existing;
			if (changed) GameplayEventBus.RaiseBeatScheduled(existing);
		}
		else
		{
			var payload = new BeatPayload(expectedTime, ++sequenceCounter, beatDuration, approachLeadForNote);
			payloadByTime[k] = payload;
			GameplayEventBus.RaiseBeatScheduled(payload);
		}

		if (enableApproachRings && approachPrototype)
			SpawnApproachSetOnce(payloadByTime[k], new Vector3(anchored.x, anchored.y, 0f), rot);

		var fx = GetOrReuseFx(k);
		SetAnchored(fx.transform, anchored);
		SetLocalRotation(fx.transform, rot);
		fx.gameObject.SetActive(true);
		fx.ShowPreview();

		float previewCueDelay = Mathf.Max(0f, expectedTime - (float)Now());
		fx.SchedulePreviewHitCue(previewCueDelay);
		scheduled[k] = fx;

		RemoveAutoMissEntry(k);
		autoMissQueue.Add(new AutoMissEntry
		{
			key = k,
			missAt = expectedTime + judgeGraceSeconds
		});
	}

	void ResetPreviewState()
	{
		previewIndex = 0;
		autoMissQueue.Clear();

		var notes = ChartSystem.CachedNotes;
		if (notes == null || notes.Length == 0) return;

		double now = Now();
		double skipBefore = now - judgeGraceSeconds;
		while (previewIndex < notes.Length && ChartSystem.GetNoteHitTime(notes[previewIndex]) < skipBefore)
			previewIndex++;
	}


	void AutoMissExpired()
	{
		if (autoMissQueue.Count == 0) return;

		double now = Now();
		for (int i = autoMissQueue.Count - 1; i >= 0; i--)
		{
			var entry = autoMissQueue[i];
			if (now >= entry.missAt)
			{
				long k = entry.key;
				autoMissQueue.RemoveAt(i);
				if (scheduled.ContainsKey(k))
				{
					passiveMissKeys.Add(k);
					Resolve((float)SecondsOf(k), HitResult.Miss);
				}
			}
		}
	}

	void RemoveAutoMissEntry(long key)
	{
		for (int i = autoMissQueue.Count - 1; i >= 0; i--)
		{
			if (autoMissQueue[i].key == key)
				autoMissQueue.RemoveAt(i);
		}
	}
	void PulseTrailHit(HitResult r, float signedDelta) { }

	void CleanupImpactFxRoots()
	{
		scheduled.Clear();
		payloadByTime.Clear();

		while (impactPool.Count > 0)
		{
			var fx = impactPool.Dequeue();
			if (fx) Destroy(fx.gameObject);
		}
		impactPoolSet.Clear();
		foreach (var tween in impactRecycleTweens.Values)
			tween?.Kill(false);
		impactRecycleTweens.Clear();
		impactFxGeneration.Clear();

		if (impactActiveRoot)
		{
			Destroy(impactActiveRoot.gameObject);
			impactActiveRoot = null;
		}
		if (impactPoolRoot)
		{
			Destroy(impactPoolRoot.gameObject);
			impactPoolRoot = null;
		}

		pendingImpactReparents.Clear();
		impactReparentRoutineActive = false;
	}

	void CleanupApproachRoots()
	{
		KillAllApproachTweens();
		while (approachPool.Count > 0)
		{
			var disc = approachPool.Dequeue();
			if (disc) Destroy(disc.gameObject);
		}
		approachPoolSet.Clear();
		approachKeys.Clear();

		if (approachActiveRoot)
		{
			Destroy(approachActiveRoot.gameObject);
			approachActiveRoot = null;
		}
		if (approachPoolRoot)
		{
			Destroy(approachPoolRoot.gameObject);
			approachPoolRoot = null;
		}

		pendingApproachReparents.Clear();
		approachReparentRoutineActive = false;
	}

	void QueueImpactFxForPool(ImpactFx fx)
	{
		if (!fx) return;
		bool canImmediate = impactPoolRoot != null && impactPoolRoot.gameObject.activeInHierarchy
			&& isActiveAndEnabled && gameObject.activeInHierarchy;
		if (canImmediate)
		{
			fx.transform.SetParent(impactPoolRoot, false);
			if (impactPoolSet.Add(fx)) impactPool.Enqueue(fx);
			return;
		}
		pendingImpactReparents.Enqueue(fx);
		if (isActiveAndEnabled && !impactReparentRoutineActive)
			StartCoroutine(ProcessPendingImpactReparents());
	}

}
