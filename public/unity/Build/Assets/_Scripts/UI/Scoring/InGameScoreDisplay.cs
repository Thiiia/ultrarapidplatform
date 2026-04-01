using UnityEngine;
using TMPro;
using System.Collections;
using UnityEngine.SceneManagement;
using DG.Tweening;
using System;
using System.Collections.Generic;
using RainbowArt.CleanFlatUI;
using UnityEngine.UI;

// Keeps the live score readout lyrical - Steven Universe scoreboard meets FEEL tweening; is your combo singing back yet?
public class InGameScoreDisplay : MonoBehaviour, IScoreManagerGameplayMessage
{
	[Header("Score UI")]
	public TextMeshProUGUI releasedGemsText;
	public TextMeshProUGUI perfectGemsText;
	public TextMeshProUGUI goodGemsText;
	public TextMeshProUGUI missedGemsText;
	public TextMeshProUGUI accuracyText;
	[SerializeField] private TMP_Text streakText;
	[SerializeField] private TMP_Text streakBrokenText;

	[Header("Optional Roots (for animation)")]
	[SerializeField] private Transform accuracyRoot;  // parent container named "Accuracy"
	[SerializeField] private Transform streakRoot;    // parent container named "Streak"

	[Header("Optional Captions (small text)")]
	[SerializeField] private TextMeshProUGUI accuracyCaptionText; // shows "ACCURACY"
	[SerializeField] private TextMeshProUGUI streakCaptionText;   // shows "STREAK"

	[Header("UI References")]
	public GameObject stopPopup;
	public GameObject pauseOverlay;

	[SerializeField] private TimelineProgress timelineProgress;
	[SerializeField, Tooltip("Optional label describing the active segment and its completion percent.")]
	private TextMeshProUGUI segmentProgressLabel;
	[SerializeField, Tooltip("Prefix applied to the segment id (e.g., \"SEG\").")]
	private string segmentLabelPrefix = "SEG";
	[Header("Segment Progress Dial")]
	[SerializeField, Tooltip("Optional circular slider used for per-segment progress.")]
	private SliderCircular segmentProgressDial;
	[SerializeField, Tooltip("Fill image for the circular dial (auto-detected if omitted).")]
	private Image segmentProgressDialFillImage;
	[SerializeField, Tooltip("Glow image for the dial that pulses per shape.")]
	private Image segmentProgressDialGlowImage;
	[SerializeField, Tooltip("Optional root used when auto-binding the segment progress UI.")]
	private Transform segmentProgressRoot;
	[SerializeField, Tooltip("Attempt to auto-locate the segment dial/label if they are not wired in the inspector.")]
	private bool autoLocateSegmentProgressUI = true;
	[SerializeField, Tooltip("Name of the segment progress label object (used when auto-locating).")]
	private string segmentProgressLabelName = "SegmentProgressLabel";
	[SerializeField, Tooltip("Name of the segment progress dial object (used when auto-locating).")]
	private string segmentProgressDialName = "SegmentProgressDial";
	[SerializeField, Tooltip("Gradient that maps the active-shape index to a dial color.")]
	private Gradient segmentProgressShapeGradient;
	[SerializeField, Range(0f, 1f), Tooltip("Minimum glow alpha applied to the dial glow image.")]
	private float segmentProgressGlowMinAlpha = 0.25f;
	[SerializeField, Range(0f, 1f), Tooltip("Maximum glow alpha applied to the dial glow image.")]
	private float segmentProgressGlowMaxAlpha = 0.85f;
	[SerializeField, Tooltip("Seconds for the dial fill to lerp toward the latest segment percent.")]
	private float segmentProgressDialLerpSeconds = 0.35f;
	[SerializeField, Tooltip("Ease curve for the dial lerp animation.")] private Ease segmentProgressDialEase = Ease.OutCubic;
	[SerializeField, Tooltip("Extra glow alpha boost applied mid-lerp.")] private float segmentProgressDialGlowPulse = 0.15f;
	[SerializeField, Tooltip("Scale fraction used at the start of a new segment's dial animation.")] private float segmentDialIntroScale = 0.55f;
	[SerializeField, Tooltip("Duration for the dial intro tween.")] private float segmentDialIntroDuration = 0.35f;
	[SerializeField] private Ease segmentDialIntroEase = Ease.OutBack;
	[SerializeField, Tooltip("Sprite for milestone spark FX (defaults to dial glow sprite).")] private Sprite segmentMilestoneSparkSprite;
	[SerializeField, Tooltip("Color tint for milestone spark FX.")] private Color segmentMilestoneSparkColor = new Color(1f, 0.98f, 0.75f, 0.95f);
	[SerializeField, Tooltip("Lifetime (seconds) of milestone spark FX.")] private float segmentMilestoneSparkDuration = 0.4f;
	[SerializeField, Tooltip("Target scale for milestone sparks.")] private float segmentMilestoneSparkScale = 1.6f;
	[SerializeField, Tooltip("Message shown when a segment completes.")] private string segmentCompletionBannerText = "SEGMENT SECURED";
	[SerializeField, Tooltip("Color used for the completion banner.")] private Color segmentCompletionBannerColor = new Color(0.86f, 1f, 0.98f, 1f);
	[SerializeField, Tooltip("Seconds the completion banner remains visible.")] private float segmentCompletionBannerDuration = 1.1f;
	[SerializeField, Tooltip("Seconds used for banner fade in/out.")] private float segmentCompletionBannerFade = 0.28f;
	[SerializeField, Tooltip("Verbose logging for segment progress troubleshooting (WebGL builds, etc.).")]
	private bool debugSegmentProgressEvents = false;
	[Header("Segment Label Styling")]
	[SerializeField, Tooltip("Heading prefix displayed on the first line of the label.")] private string segmentLabelHeading = "SEGMENT";
	[SerializeField, Tooltip("Scale multiplier when the label eases in for a new segment.")] private float segmentLabelIntroScale = 0.85f;
	[SerializeField, Tooltip("Seconds for the label intro.")] private float segmentLabelIntroDuration = 0.3f;
	[SerializeField] private Ease segmentLabelIntroEase = Ease.OutQuad;
	[SerializeField, Tooltip("Punch amount when updating existing segment percent.")] private float segmentLabelPulseScale = 1.05f;
	[SerializeField, Tooltip("Seconds for the label pulse.")] private float segmentLabelPulseDuration = 0.25f;
	[SerializeField] private CustomizeControls customizeControls;

	private CanvasGroup pauseCanvasGroup;
	private int totalChartNotes = -1;
	private bool isPaused = false;
	private CameraMovement cameraMovement;
	private CustomizeControls _cc; // cache it
	private string currentSegmentId;
	private int currentSegmentPathIndex = -1;
	private float currentSegmentPercent;
	private bool currentSegmentComplete;
	private readonly Dictionary<string, SegmentProgressState> segmentProgressCache = new();
	private Vector3 segmentProgressLabelBaseScale = Vector3.one;
	private Vector3 segmentProgressDialBaseScale = Vector3.one;
	private Color _segmentDialFillBaseColor = Color.white;
	private Color _segmentDialGlowBaseColor = Color.white;
	private Tween _segmentProgressDialValueTween;
	private float _segmentDialVisualValue = 0f;
	private bool _segmentProgressFollowingHead = false;
	private Tween _segmentDialIntroTween;
	private Tween _segmentCompletionBannerTween;
	private TextMeshProUGUI _segmentCompletionBadge;
	private CanvasGroup _segmentCompletionBadgeCanvas;
	private CanvasGroup _segmentLabelCanvas;
	private Tween _segmentLabelTween;
	private Color _segmentLabelAccent = Color.white;
	private ScoreManagerScript _cachedScoreManager;
	private bool _scoreEventsAttached;
	private bool _endGameFadeStarted;

	private struct SegmentProgressState
	{
		public float percent;
		public bool isComplete;
	}

	// --- Live animation state ---
	[Header("Animations")]
	[SerializeField] private float accuracyPop = 1.10f;
	[SerializeField] private float accuracyPopDuration = 0.18f;
	[SerializeField] private float accuracyFlashDuration = 0.22f;
	[SerializeField] private Color accuracyUpColor = new Color32(0x62, 0xEF, 0x48, 0xFF);
	[SerializeField] private Color accuracyDownColor = new Color32(0xFF, 0x3C, 0x00, 0xFF);

	[SerializeField] private float streakPop = 1.15f;
	[SerializeField] private float streakPopDuration = 0.20f;
	[SerializeField] private float streakShakeDuration = 0.20f;
	[SerializeField] private float streakShakeStrength = 0.15f;

	[SerializeField] private bool restartScene = false;

	private int lastAccuracyPct = -1;
	private int lastStreak = -1;
	private Color baseAccuracyColor = Color.white;
	private Color baseStreakColor = Color.white;
	private Vector3 baseAccuracyScale = Vector3.one;
	private Vector3 baseStreakScale = Vector3.one;
	[Header("Heat / Flow")]
	[SerializeField, Tooltip("Subtle HSV shift based on streak heat (0..1) from GameplayEventBus.")]
	private bool enableHeatTint = true;
	[SerializeField, Range(0f, 24f)] private float heatHueShift = 10f;
	[SerializeField, Range(0f, 0.5f)] private float heatValueBoost = 0.12f;
	[SerializeField, Tooltip("Targets for heat tint; leave null to only tint streakText")]
	private TMP_Text[] heatTintTargets;
	[SerializeField, Tooltip("Optional image used as a glowing halo behind the streak readout.")]
	private Image streakHeatPulseImage;
	[SerializeField, Range(0f, 1f)] private float streakHeatPulseMinAlpha = 0.08f;
	[SerializeField, Range(0f, 1f)] private float streakHeatPulseMaxAlpha = 0.65f;
	[SerializeField, Range(1f, 2f)] private float streakHeatPulseScale = 1.2f;

	private float _currentHeat = 0f; // 0..1 from GameplayEventBus

	// cache base colors to tint toward
	private Color _baseStreakTextColor;
	private Color[] _baseHeatColors;
	private Vector3 _streakHeatPulseBaseScale = Vector3.one;

	[Header("Streak Dial / Slider")]
	[SerializeField, Tooltip("SliderCircular prefab used as the combo dial. Leave empty to auto-find under the Streak root.")]
	private SliderCircular streakDial;
	[SerializeField, Tooltip("Attempt to auto locate the streak dial + its images when missing references.")]
	private bool autoLocateStreakDial = true;
	[SerializeField, Tooltip("Image used for the dial fill (typically the 'Fill' child).")]
	private Image streakDialFillImage;
	[SerializeField, Tooltip("Background/glow image that should bloom with heat.")]
	private Image streakDialGlowImage;
	[SerializeField, Tooltip("Handle image to tint with the fill color for extra cohesion.")]
	private Image streakDialHandleImage;
	[SerializeField, Range(0.1f, 15f), Tooltip("How quickly the dial fill lerps toward the latest streak count.")]
	private float streakDialValueLerpSpeed = 6f;
	[SerializeField, Range(0.1f, 20f), Tooltip("How quickly the glow/color lerps toward the latest heat.")]
	private float streakDialHeatLerpSpeed = 8f;
	[SerializeField, Range(0f, 1f), Tooltip("Minimum alpha applied to the glow image.")]
	private float streakDialGlowMinAlpha = 0.18f;
	[SerializeField, Range(0f, 1f), Tooltip("Maximum alpha applied to the glow image.")]
	private float streakDialGlowMaxAlpha = 0.85f;
	[SerializeField, Tooltip("Optional gradient controlling the dial color as heat ramps up.")]
	private Gradient streakDialHeatGradient;
	[SerializeField, Tooltip("Fallback streak count that represents a full dial if ScoreManager thresholds are unavailable.")]
	private int streakDialFallbackMaxStreak = 60;
	[SerializeField, Tooltip("If true, the dial gives a subtle pulse on every streak increase (not just tier bumps).")]
	private bool pulseDialOnEveryIncrease = true;

	private float _streakDialTargetHeat = 0f;
	private float _streakDialDisplayHeat = 0f;
	private GameplayEventBus.StreakTier _streakDialTier = GameplayEventBus.StreakTier.None;
	private bool _streakDialConfigured;
	private Color _streakDialFillBaseColor = Color.white;
	private Color _streakDialGlowBaseColor = new Color(1f, 1f, 1f, 0.25f);
	private Color _streakDialHandleBaseColor = Color.white;
	private Vector3 _streakDialBaseScale = Vector3.one;
	private Tween _streakDialPulseTween;
	private Gradient _runtimeDialGradient;
	private bool _attemptedDialAutoLocate;
	private float _streakDialTargetValue = 0f;
	private float _streakDialDisplayValue = 0f;


	[Header("Accuracy Mode")]
	[SerializeField, Tooltip("If true, show rolling (last N hits) accuracy which can go up and down. If false, show cumulative accuracy which only trends up.")]
	private bool useRollingAccuracy = true;

	private TextMeshProUGUI FindTMPByParentName(string parentName)
	{
		// Search all (active and inactive) to be resilient across scene setups
		var all = Resources.FindObjectsOfTypeAll<TextMeshProUGUI>();
		foreach (var t in all)
		{
			var p = t.transform.parent;
			if (p != null && string.Equals(p.name, parentName, StringComparison.OrdinalIgnoreCase))
				return t;
		}
		return null;
	}

	private void EnsureSegmentProgressReferences()
	{
		if (!autoLocateSegmentProgressUI)
			return;

		if (!segmentProgressRoot)
			segmentProgressRoot = transform;

		if (!segmentProgressLabel && !string.IsNullOrEmpty(segmentProgressLabelName))
			segmentProgressLabel = FindSegmentUi<TextMeshProUGUI>(segmentProgressLabelName);

		if (segmentProgressLabel)
		{
			segmentProgressLabelBaseScale = segmentProgressLabel.transform.localScale;
			EnsureSegmentLabelCanvas();
		}

		if (!segmentProgressDial && !string.IsNullOrEmpty(segmentProgressDialName))
			segmentProgressDial = FindSegmentUi<SliderCircular>(segmentProgressDialName);

		if (segmentProgressDial)
		{
			segmentProgressDialBaseScale = segmentProgressDial.transform.localScale;
			ConfigureSegmentProgressDial(segmentProgressDial);
			if (!segmentProgressDialFillImage)
				segmentProgressDialFillImage = segmentProgressDial.GetComponentInChildren<Image>(true);
			if (segmentProgressDialFillImage)
				_segmentDialFillBaseColor = segmentProgressDialFillImage.color;
			if (segmentProgressDialGlowImage)
				_segmentDialGlowBaseColor = segmentProgressDialGlowImage.color;
		}
	}

	private T FindSegmentUi<T>(string targetName) where T : Component
	{
		if (string.IsNullOrEmpty(targetName))
			return null;

		if (segmentProgressRoot)
		{
			var children = segmentProgressRoot.GetComponentsInChildren<T>(true);
			foreach (var child in children)
			{
				if (string.Equals(child.name, targetName, StringComparison.OrdinalIgnoreCase))
					return child;
			}
		}

		var all = Resources.FindObjectsOfTypeAll<T>();
		foreach (var entry in all)
		{
			if (!entry || !entry.gameObject || !entry.gameObject.scene.IsValid())
				continue;
			if (string.Equals(entry.name, targetName, StringComparison.OrdinalIgnoreCase))
				return entry;
		}

		return null;
	}

	private void LogSegmentProgressEvent(string source, string segmentId, float percent, bool isComplete)
	{
		if (!debugSegmentProgressEvents)
			return;

		Debug.Log($"[InGameScoreDisplay] {source}: {(string.IsNullOrEmpty(segmentId) ? "<none>" : segmentId)} => {percent:P1} (complete: {isComplete})");
	}

	private (TextMeshProUGUI caption, TextMeshProUGUI value, Transform root) FindCaptionAndValueUnder(string parentName)
	{
		TextMeshProUGUI[] candidates = null;
		Transform root = null;
		// Gather by parent
		var all = Resources.FindObjectsOfTypeAll<TextMeshProUGUI>();
		var list = new System.Collections.Generic.List<TextMeshProUGUI>();
		foreach (var t in all)
		{
			var p = t.transform.parent;
			if (p != null && string.Equals(p.name, parentName, StringComparison.OrdinalIgnoreCase))
			{
				list.Add(t);
				root = p;
			}
		}
		candidates = list.ToArray();
		if (candidates.Length == 0) return (null, null, root);
		if (candidates.Length == 1) return (null, candidates[0], root);

		// Prefer content heuristic: caption = letters, value = digits
		TextMeshProUGUI captionByText = null, valueByText = null;
		foreach (var t in candidates)
		{
			var s = (t.text ?? string.Empty).Trim();
			bool hasDigit = false; foreach (char c in s) { if (char.IsDigit(c)) { hasDigit = true; break; } }
			if (hasDigit) valueByText = t; else captionByText = t;
		}
		if (valueByText != null && captionByText != null)
			return (captionByText, valueByText, root);

		// Choose value as the largest font size; the other as caption
		TextMeshProUGUI big = candidates[0];
		foreach (var t in candidates)
			if (t.fontSize > big.fontSize) big = t;
		TextMeshProUGUI caption = null;
		foreach (var t in candidates)
			if (t != big) { caption = t; break; }
		return (caption, big, root);
	}

	private void OnEnable()
	{
		_endGameFadeStarted = false;
		//GameplayEventBus.ChartCompleted += HandleChartCompleted;
		GameplayEventBus.ChartRestarted += HandleChartRestarted;
		GameplayEventBus.OnPerimeterShapeChanged += HandlePerimeterShapeChanged;
		GameplayEventBus.SegmentProgressed += HandleSegmentProgressed;
		GameplayEventBus.PerimeterHeadMoved += HandlePerimeterHeadMoved;

		EnsureSegmentProgressReferences();
		EnsureScoreManagerSubscription();

		// Heat/Tier stream (flow escalation)
		GameplayEventBus.StreakTierChanged += HandleStreakTierChanged;
		GameplayEventBus.HeatChanged += HandleHeatChanged;

		// Cache base colors for heat tint
		_baseStreakTextColor = streakText ? streakText.color : Color.white;
		if (heatTintTargets != null && heatTintTargets.Length > 0)
		{
			_baseHeatColors = new Color[heatTintTargets.Length];
			for (int i = 0; i < heatTintTargets.Length; i++)
				_baseHeatColors[i] = heatTintTargets[i] ? heatTintTargets[i].color : Color.white;
		}

		segmentProgressCache.Clear();
		ResetSegmentProgressUI();
	}

	private void OnDisable()
	{
		//GameplayEventBus.ChartCompleted -= HandleChartCompleted;
		GameplayEventBus.ChartRestarted -= HandleChartRestarted;
		GameplayEventBus.OnPerimeterShapeChanged -= HandlePerimeterShapeChanged;
		GameplayEventBus.SegmentProgressed -= HandleSegmentProgressed;
		GameplayEventBus.PerimeterHeadMoved -= HandlePerimeterHeadMoved;
		DetachScoreManagerDelegates();

		GameplayEventBus.StreakTierChanged -= HandleStreakTierChanged;
		GameplayEventBus.HeatChanged -= HandleHeatChanged;

		if (_streakDialPulseTween != null)
		{
			_streakDialPulseTween.Kill();
			_streakDialPulseTween = null;
			if (streakDial)
				streakDial.transform.localScale = _streakDialBaseScale;
		}
		if (_segmentProgressDialValueTween != null)
		{
			_segmentProgressDialValueTween.Kill();
			_segmentProgressDialValueTween = null;
		}
		if (_segmentDialIntroTween != null)
		{
			_segmentDialIntroTween.Kill();
			_segmentDialIntroTween = null;
		}
		if (_segmentCompletionBannerTween != null)
		{
			_segmentCompletionBannerTween.Kill();
			_segmentCompletionBannerTween = null;
		}
		if (_segmentCompletionBadge)
		{
			_segmentCompletionBadgeCanvas.alpha = 0f;
			_segmentCompletionBadge.gameObject.SetActive(false);
		}
	}

	private void EnsureScoreManagerSubscription()
	{
		var instance = ScoreManagerScript.Instance;
		if (_scoreEventsAttached && instance == null)
		{
			DetachScoreManagerDelegates();
		}
		else if (_scoreEventsAttached && instance != _cachedScoreManager)
		{
			DetachScoreManagerDelegates();
			instance = ScoreManagerScript.Instance;
		}

		if (!_scoreEventsAttached && instance != null)
			AttachScoreManagerDelegates(instance);
	}

	private void AttachScoreManagerDelegates(ScoreManagerScript score)
	{
		if (!score || _scoreEventsAttached) return;

		score.OnHitRegistered += HandleHitRegistered;
		score.OnStreakChanged += HandleStreakChangedEvent;
		score.OnStreakBroken += HandleStreakBrokenEvent;
		score.OnSegmentMilestone += HandleSegmentMilestone;
		_cachedScoreManager = score;
		_scoreEventsAttached = true;
	}

	private void DetachScoreManagerDelegates()
	{
		if (!_scoreEventsAttached || !_cachedScoreManager)
		{
			_scoreEventsAttached = false;
			_cachedScoreManager = null;
			return;
		}

		_cachedScoreManager.OnHitRegistered -= HandleHitRegistered;
		_cachedScoreManager.OnStreakChanged -= HandleStreakChangedEvent;
		_cachedScoreManager.OnStreakBroken -= HandleStreakBrokenEvent;
		_cachedScoreManager.OnSegmentMilestone -= HandleSegmentMilestone;
		_cachedScoreManager = null;
		_scoreEventsAttached = false;
	}

	private void HandleChartCompleted()
	{
		TriggerEndGameFade();
	}

	private void HandleChartRestarted()
	{
		lastAccuracyPct = -1;
		lastStreak = -1;
		_currentHeat = 0f;
		_streakDialTier = GameplayEventBus.StreakTier.None;
		SetDialTargetHeat(0f);
		ResetStreakDialImmediate();
		UpdateStreakHeatPulse(0f);
		segmentProgressCache.Clear();
		ResetSegmentProgressUI();
		_endGameFadeStarted = false;
	}

	private void HandleSegmentProgressed(string segmentId, float percent, bool isComplete)
	{
		if (string.IsNullOrEmpty(segmentId))
			return;

		LogSegmentProgressEvent("SegmentProgressed", segmentId, percent, isComplete);

		segmentProgressCache[segmentId] = new SegmentProgressState
		{
			percent = Mathf.Clamp01(percent),
			isComplete = isComplete
		};

		bool shouldForceUpdate = string.IsNullOrEmpty(currentSegmentId) || !_segmentProgressFollowingHead;
		if (shouldForceUpdate || (!string.IsNullOrEmpty(currentSegmentId) && currentSegmentId == segmentId))
			UpdateSegmentProgressUI(segmentId, percent, isComplete);
	}

	private void HandlePerimeterHeadMoved(float normalizedT, int pathIndex)
	{
		currentSegmentPathIndex = pathIndex;
		var diagram = DiagramManager.Instance;
		if (diagram != null && diagram.TryGetSegmentProgressByPathIndex(pathIndex, out var snapshot))
		{
			_segmentProgressFollowingHead = true;
			LogSegmentProgressEvent("PerimeterHeadMoved", snapshot.segmentId, snapshot.percent, snapshot.isComplete);
			UpdateSegmentProgressUI(snapshot.segmentId, snapshot.percent, snapshot.isComplete);
		}
		else if (!string.IsNullOrEmpty(currentSegmentId) && segmentProgressCache.TryGetValue(currentSegmentId, out var cached))
		{
			UpdateSegmentProgressUI(currentSegmentId, cached.percent, cached.isComplete);
		}
	}

	private void HandleSegmentMilestone(string segmentId, int milestone)
	{
		if (!string.IsNullOrEmpty(segmentId) && segmentId == currentSegmentId)
		{
			PulseSegmentProgressUI();
			SpawnSegmentMilestoneSpark(milestone);
		}
	}

	private void HandlePerimeterShapeChanged(GameObject perimeterInstance)
	{
		segmentProgressCache.Clear();
		ResetSegmentProgressUI();
		RefreshSegmentProgressTheme();
	}

	private void UpdateSegmentProgressUI(string segmentId, float percent, bool isComplete)
	{
		float clamped = Mathf.Clamp01(percent);
		bool segmentChanged = currentSegmentId != segmentId;
		currentSegmentId = segmentId;
		currentSegmentPercent = clamped;
		currentSegmentComplete = isComplete;

		if (segmentChanged)
			BeginSegmentDialIntro(clamped);
		else
			AnimateSegmentProgressDial(clamped);
		if (segmentProgressLabel)
		{
			EnsureSegmentLabelCanvas();
			segmentProgressLabel.text = FormatSegmentLabel(segmentId, clamped, isComplete);
			if (segmentChanged)
				PlaySegmentLabelIntro();
			else
				PulseSegmentLabel();
		}

		if (!string.IsNullOrEmpty(segmentId))
		{
			segmentProgressCache[segmentId] = new SegmentProgressState
			{
				percent = clamped,
				isComplete = isComplete
			};
		}

		if (segmentChanged)
			RefreshSegmentProgressTheme();
		if (isComplete && clamped >= 0.999f)
			ShowSegmentCompletionBanner(segmentId);
	}

	private void PulseSegmentProgressUI()
	{
		if (segmentProgressLabel)
		{
			PulseSegmentLabel();
		}
		if (segmentProgressDial)
		{
			var t = segmentProgressDial.transform;
			DOTween.Kill(t);
			t.localScale = segmentProgressDialBaseScale;
			t.DOPunchScale(Vector3.one * 0.08f, 0.25f, 6, 0.7f)
				.SetUpdate(true)
				.SetTarget(t)
				.SetLink(segmentProgressDial.gameObject, LinkBehaviour.KillOnDestroy)
				.OnKill(() => { if (t) t.localScale = segmentProgressDialBaseScale; });
		}
	}

	private void ResetSegmentProgressUI()
	{
		currentSegmentId = null;
		currentSegmentPercent = 0f;
		currentSegmentComplete = false;
		currentSegmentPathIndex = -1;
		_segmentProgressFollowingHead = false;
		_segmentDialVisualValue = 0f;
		if (_segmentProgressDialValueTween != null)
		{
			_segmentProgressDialValueTween.Kill();
			_segmentProgressDialValueTween = null;
		}
		if (segmentProgressLabel)
		{
			EnsureSegmentLabelCanvas();
			segmentProgressLabel.text = FormatSegmentLabel(null, 0f, false);
			segmentProgressLabel.transform.localScale = segmentProgressLabelBaseScale;
			if (_segmentLabelCanvas)
				_segmentLabelCanvas.alpha = 0f;
		}
		if (segmentProgressDial)
		{
			segmentProgressDial.gameObject.SetActive(true);
			segmentProgressDial.SetValueWithoutNotify(0f);
			segmentProgressDial.transform.localScale = segmentProgressDialBaseScale;
			UpdateSegmentDialGlow(0f);
		}
		RefreshSegmentProgressTheme();
	}

	private void RefreshSegmentProgressTheme()
	{
		Color accent = _segmentDialFillBaseColor;
		var scoreboard = ScoreManagerScript.Instance;
		if (segmentProgressShapeGradient != null && scoreboard != null)
		{
			int total = Mathf.Max(1, scoreboard.TotalShapesInRun);
			int ordinal = Mathf.Clamp(scoreboard.CurrentShapeOrdinal, 0, total - 1);
			float t = total <= 1 ? 0f : (float)ordinal / Mathf.Max(1f, total - 1);
			accent = segmentProgressShapeGradient.Evaluate(Mathf.Clamp01(t));
		}
		accent = EvaluateHeatAccent(accent);

		if (segmentProgressDialFillImage)
		{
			segmentProgressDialFillImage.color = accent;
			_segmentDialFillBaseColor = accent;
		}

		if (segmentProgressDialGlowImage)
		{
			Color glow = accent;
			float targetAlpha = Mathf.Lerp(segmentProgressGlowMinAlpha, segmentProgressGlowMaxAlpha, glow.a);
			glow.a = targetAlpha;
			segmentProgressDialGlowImage.color = glow;
			_segmentDialGlowBaseColor = glow;
		}

		if (segmentProgressLabel)
		{
			segmentProgressLabel.color = accent;
			_segmentLabelAccent = accent;
		}

		UpdateSegmentDialGlow(_segmentDialVisualValue);
	}

	private Color EvaluateHeatAccent(Color baseColor)
	{
		if (!enableHeatTint || _currentHeat <= 0.0001f)
			return baseColor;

		Color.RGBToHSV(baseColor, out var h, out var s, out var v);
		float shiftedHue = Mathf.Repeat(h + (_currentHeat * heatHueShift * 0.001f), 1f);
		float boostedValue = Mathf.Clamp01(v + _currentHeat * heatValueBoost);
		float boostedSat = Mathf.Clamp01(s + _currentHeat * 0.08f);
		return Color.HSVToRGB(shiftedHue, boostedSat, boostedValue);
	}

	private string FormatSegmentLabel(string segmentId, float percent, bool isComplete)
	{
		string idPart = string.IsNullOrEmpty(segmentId)
			? string.Empty
			: string.IsNullOrEmpty(segmentLabelPrefix)
				? segmentId
				: $"{segmentLabelPrefix} {segmentId}";

		string header = string.IsNullOrEmpty(idPart) ? segmentLabelHeading : $"{segmentLabelHeading} {idPart}";
		string status = isComplete ? "SECURED" : $"{Mathf.RoundToInt(percent * 100f)}% SECURED";
		string colorHex = ColorUtility.ToHtmlStringRGB(_segmentLabelAccent);
		return $"{header}\n<color=#{colorHex}>{status}</color>";
	}

	private void ConfigureSegmentProgressDial(SliderCircular dial)
	{
		dial.MinValue = 0f;
		dial.MaxValue = 1f;
		dial.WholeNumbers = false;
		dial.HasText = false;
		dial.Clockwise = true;
		dial.CurFillOrigin = SliderCircular.FillOrigin.Right;
	}

	private void AnimateSegmentProgressDial(float normalized)
	{
		if (!segmentProgressDial)
			return;

		segmentProgressDial.gameObject.SetActive(true);
		float target = Mathf.Clamp01(normalized);
		if (segmentProgressDialLerpSeconds <= 0.0001f)
		{
			_segmentDialVisualValue = target;
			UpdateSegmentDialVisuals(target);
			return;
		}

		_segmentProgressDialValueTween?.Kill();
		_segmentProgressDialValueTween = DOTween.To(() => _segmentDialVisualValue, v =>
		{
			_segmentDialVisualValue = v;
			UpdateSegmentDialVisuals(v);
		}, target, segmentProgressDialLerpSeconds)
			.SetEase(segmentProgressDialEase)
			.SetUpdate(true)
			.SetTarget(segmentProgressDial.gameObject);
	}

	private void UpdateSegmentDialVisuals(float normalized)
	{
		if (!segmentProgressDial)
			return;

		float dialTarget = Mathf.Lerp(segmentProgressDial.MinValue, segmentProgressDial.MaxValue, Mathf.Clamp01(normalized));
		segmentProgressDial.SetValueWithoutNotify(dialTarget);
		UpdateSegmentDialGlow(normalized);
	}

	private void UpdateSegmentDialGlow(float normalized)
	{
		float clamped = Mathf.Clamp01(normalized);
		if (segmentProgressDialGlowImage)
		{
			Color glow = _segmentDialGlowBaseColor;
			float pulseBonus = (_segmentProgressDialValueTween != null && _segmentProgressDialValueTween.IsActive())
				? segmentProgressDialGlowPulse
				: 0f;
			glow.a = Mathf.Clamp01(Mathf.Lerp(segmentProgressGlowMinAlpha, segmentProgressGlowMaxAlpha + pulseBonus, clamped));
			segmentProgressDialGlowImage.color = glow;
		}

		if (segmentProgressDialFillImage)
		{
			Color.RGBToHSV(_segmentDialFillBaseColor, out var h, out var s, out var v);
			float boostedV = Mathf.Clamp01(v + clamped * 0.2f + _currentHeat * 0.1f);
			var tinted = Color.HSVToRGB(h, Mathf.Clamp01(s * (0.85f + clamped * 0.15f)), boostedV);
			segmentProgressDialFillImage.color = tinted;
		}
	}

	private void EnsureSegmentLabelCanvas()
	{
		if (!segmentProgressLabel)
			return;
		if (!_segmentLabelCanvas)
		{
			_segmentLabelCanvas = segmentProgressLabel.GetComponent<CanvasGroup>();
			if (!_segmentLabelCanvas)
				_segmentLabelCanvas = segmentProgressLabel.gameObject.AddComponent<CanvasGroup>();
		}
	}

	private void PlaySegmentLabelIntro()
	{
		if (!segmentProgressLabel)
			return;
		EnsureSegmentLabelCanvas();
		_segmentLabelTween?.Kill();
		segmentProgressLabel.transform.localScale = segmentProgressLabelBaseScale * Mathf.Clamp(segmentLabelIntroScale, 0.1f, 1f);
		_segmentLabelCanvas.alpha = 0f;
		_segmentLabelTween = DOTween.Sequence()
			.SetUpdate(true)
			.Append(_segmentLabelCanvas.DOFade(1f, segmentLabelIntroDuration).SetEase(segmentLabelIntroEase))
			.Join(segmentProgressLabel.transform.DOScale(segmentProgressLabelBaseScale, segmentLabelIntroDuration).SetEase(segmentLabelIntroEase));
	}

	private void PulseSegmentLabel()
	{
		if (!segmentProgressLabel)
			return;
		var t = segmentProgressLabel.transform;
		DOTween.Kill(t);
		t.localScale = segmentProgressLabelBaseScale;
		float punch = Mathf.Max(0f, segmentLabelPulseScale - 1f);
		if (punch <= 0f)
			return;
		t.DOPunchScale(Vector3.one * punch, segmentLabelPulseDuration, 6, 0.7f)
			.SetUpdate(true)
			.SetTarget(t)
			.SetLink(segmentProgressLabel.gameObject, LinkBehaviour.KillOnDestroy)
			.OnKill(() => { if (t) t.localScale = segmentProgressLabelBaseScale; });
	}

	private void BeginSegmentDialIntro(float targetNormalized)
	{
		if (!segmentProgressDial)
		{
			AnimateSegmentProgressDial(targetNormalized);
			return;
		}

		_segmentDialIntroTween?.Kill();
		_segmentProgressDialValueTween?.Kill();
		_segmentDialVisualValue = 0f;
		segmentProgressDial.SetValueWithoutNotify(0f);
		UpdateSegmentDialGlow(0f);

		var dialTransform = segmentProgressDial.transform;
		float introScale = Mathf.Clamp(segmentDialIntroScale, 0.05f, 1f);
		dialTransform.localScale = segmentProgressDialBaseScale * introScale;
		_segmentDialIntroTween = dialTransform.DOScale(segmentProgressDialBaseScale, Mathf.Max(0.01f, segmentDialIntroDuration))
			.SetEase(segmentDialIntroEase)
			.SetUpdate(true)
			.OnComplete(() => AnimateSegmentProgressDial(targetNormalized));
	}

	private void SpawnSegmentMilestoneSpark(int milestone)
	{
		if (!segmentProgressDial)
			return;

		var sprite = segmentMilestoneSparkSprite ? segmentMilestoneSparkSprite :
			(segmentProgressDialGlowImage ? segmentProgressDialGlowImage.sprite :
			 segmentProgressDialFillImage ? segmentProgressDialFillImage.sprite : null);
		if (!sprite)
			return;

		var go = new GameObject($"SegmentSpark_{milestone}", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
		go.transform.SetParent(segmentProgressDial.transform, false);
		var rt = go.GetComponent<RectTransform>();
		rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.sizeDelta = new Vector2(120f, 120f);
		var img = go.GetComponent<Image>();
		img.sprite = sprite;
		img.color = segmentMilestoneSparkColor;
		img.raycastTarget = false;
		var cg = go.GetComponent<CanvasGroup>();
		cg.alpha = 1f;
		rt.localScale = Vector3.zero;

		DOTween.Sequence()
			.SetUpdate(true)
			.Append(rt.DOScale(segmentMilestoneSparkScale, segmentMilestoneSparkDuration * 0.6f).SetEase(Ease.OutCubic))
			.Join(cg.DOFade(0f, segmentMilestoneSparkDuration).SetEase(Ease.InQuad))
			.OnComplete(() => Destroy(go));
	}

	private void EnsureSegmentCompletionBadge()
	{
		if (_segmentCompletionBadge || !segmentProgressDial)
			return;

		var go = new GameObject("SegmentCompletionBadge", typeof(RectTransform), typeof(CanvasGroup));
		go.transform.SetParent(segmentProgressDial.transform, false);
		var rt = go.GetComponent<RectTransform>();
		rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
		rt.sizeDelta = new Vector2(220f, 90f);
		var text = go.AddComponent<TextMeshProUGUI>();
		text.alignment = TextAlignmentOptions.Center;
		text.fontSize = 30f;
		text.text = segmentCompletionBannerText;
		text.color = segmentCompletionBannerColor;
		text.raycastTarget = false;
		_segmentCompletionBadge = text;
		_segmentCompletionBadgeCanvas = go.GetComponent<CanvasGroup>();
		_segmentCompletionBadgeCanvas.alpha = 0f;
		go.SetActive(false);
	}

	private void ShowSegmentCompletionBanner(string segmentId)
	{
		if (!segmentProgressDial)
			return;

		EnsureSegmentCompletionBadge();
		if (!_segmentCompletionBadge)
			return;

		string suffix = string.IsNullOrEmpty(segmentId) ? string.Empty : $"{segmentLabelPrefix} {segmentId}";
		_segmentCompletionBadge.text = string.IsNullOrEmpty(suffix)
			? segmentCompletionBannerText
			: $"{segmentCompletionBannerText}\n{suffix}";
		_segmentCompletionBadge.color = segmentCompletionBannerColor;
		_segmentCompletionBadge.transform.localScale = Vector3.one * 0.7f;
		_segmentCompletionBadgeCanvas.alpha = 0f;
		_segmentCompletionBadge.gameObject.SetActive(true);

		_segmentCompletionBannerTween?.Kill();
		float fade = Mathf.Max(0.05f, segmentCompletionBannerFade);
		float hold = Mathf.Max(0f, segmentCompletionBannerDuration);
		_segmentCompletionBannerTween = DOTween.Sequence()
			.SetUpdate(true)
			.Append(_segmentCompletionBadgeCanvas.DOFade(1f, fade).SetEase(Ease.OutCubic))
			.Join(_segmentCompletionBadge.transform.DOScale(1f, fade).SetEase(Ease.OutBack))
			.AppendInterval(hold)
			.Append(_segmentCompletionBadgeCanvas.DOFade(0f, fade).SetEase(Ease.InQuad))
			.Join(_segmentCompletionBadge.transform.DOScale(0.85f, fade).SetEase(Ease.InBack))
			.OnComplete(() => _segmentCompletionBadge.gameObject.SetActive(false));
	}

	void Start()
	{
		cameraMovement = GameObject.Find("Guitar Camera")?.GetComponent<CameraMovement>();

		if (ChartSystem.CachedNotes != null)
			totalChartNotes = ChartSystem.CachedNotes.Length;

		if (stopPopup != null)
			stopPopup.SetActive(false);

		if (pauseOverlay != null)
		{
			_cc = pauseOverlay.GetComponentInChildren<CustomizeControls>(true);
			pauseCanvasGroup = pauseOverlay.GetComponent<CanvasGroup>();
			if (pauseCanvasGroup == null)
				pauseCanvasGroup = pauseOverlay.AddComponent<CanvasGroup>();

			pauseCanvasGroup.alpha = 0f;
			pauseCanvasGroup.interactable = true;
			pauseCanvasGroup.blocksRaycasts = true;
			pauseOverlay.SetActive(false);
		}

		var ccAtStart = _cc != null ? _cc : customizeControls;
		if (ccAtStart)
		{
			ccAtStart.SetVisible(false);
		}

		// Auto-hook accuracy and streak if not wired in the Inspector
		if (accuracyText == null)
		{
			var set = FindCaptionAndValueUnder("Accuracy");
			if (set.value) accuracyText = set.value;
			if (!accuracyRoot && set.root) accuracyRoot = set.root;
			if (!accuracyCaptionText && set.caption) accuracyCaptionText = set.caption;
		}

		if (streakText == null)
		{
			var set = FindCaptionAndValueUnder("Streak");
			if (set.value) streakText = set.value;
			if (!streakRoot && set.root) streakRoot = set.root;
			if (!streakCaptionText && set.caption) streakCaptionText = set.caption;
		}
		EnsureStreakDialResolved();


		if (accuracyCaptionText) accuracyCaptionText.text = "Accuracy";
		if (streakCaptionText) streakCaptionText.text = "Streak";

		// Cache base colors for flash effects
		if (accuracyText) baseAccuracyColor = accuracyText.color;
		if (streakText) baseStreakColor = streakText.color;

		// Cache base scales to prevent drift from overlapping tweens
		if (accuracyText) baseAccuracyScale = accuracyText.transform.localScale;
		if (streakText) baseStreakScale = streakText.transform.localScale;
		if (streakHeatPulseImage)
		{
			_streakHeatPulseBaseScale = streakHeatPulseImage.rectTransform.localScale;
			UpdateStreakHeatPulse(0f);
		}

		// Auto-wire TimelineProgress if not assigned in the scene
		if (!timelineProgress)
		{
#if UNITY_2023_1_OR_NEWER
			timelineProgress = UnityEngine.Object.FindFirstObjectByType<TimelineProgress>(UnityEngine.FindObjectsInactive.Include);
#else
			var allTP = Resources.FindObjectsOfTypeAll<TimelineProgress>();
			foreach (var tp in allTP)
			{
				if (tp && tp.gameObject && tp.gameObject.scene.IsValid()) { timelineProgress = tp; break; }
			}
#endif
		}

		EnsureSegmentProgressReferences();

		if (segmentProgressLabel)
		{
			segmentProgressLabelBaseScale = segmentProgressLabel.transform.localScale;
			EnsureSegmentLabelCanvas();
			if (_segmentLabelCanvas)
				_segmentLabelCanvas.alpha = 0f;
		}
		if (segmentProgressDial)
		{
			segmentProgressDialBaseScale = segmentProgressDial.transform.localScale;
			ConfigureSegmentProgressDial(segmentProgressDial);
			if (!segmentProgressDialFillImage)
				segmentProgressDialFillImage = segmentProgressDial.GetComponentInChildren<Image>(true);
			if (segmentProgressDialFillImage)
				_segmentDialFillBaseColor = segmentProgressDialFillImage.color;
			if (segmentProgressDialGlowImage)
				_segmentDialGlowBaseColor = segmentProgressDialGlowImage.color;
		}
		else
		{
			_segmentDialFillBaseColor = Color.white;
			_segmentDialGlowBaseColor = Color.white;
		}

		RefreshSegmentProgressTheme();
	}

	// cached scoreboard values so we only touch text when something actually changes
	int _lastDestroyed = -1;
	int _lastReleased = -1;
	int _lastTotalNotes = -1;
	int _lastMissed = -1;
	int _lastPerfect = -1;
	int _lastGood = -1;
	int _lastStreakValue = -1;
	int _lastAccuracyPct = -1;

	void Update()
	{
		EnsureScoreManagerSubscription();

		if (ScoreManagerScript.Instance == null)
		{
			SetDialTargetValue(0);
			SetDialTargetHeat(0f);
			return;
		}

		int destroyed = ScoreManagerScript.Instance.destroyedGems;
		int released = ScoreManagerScript.Instance.totalGameGems;
		int total = ChartSystem.GetTotalSpawnedNotes();
		int missed = ScoreManagerScript.Instance.missedGems;

		// Only rewrite text when the underlying value actually changes to avoid
		// unnecessary string work on WebGL.
		if (releasedGemsText)
		{
			if (released != _lastReleased || total != _lastTotalNotes)
			{
				if (total > 0)
					releasedGemsText.text = released.ToString() + "/" + total.ToString();
				else
					releasedGemsText.text = released.ToString();
				_lastReleased = released;
				_lastTotalNotes = total;
			}
		}

		if (perfectGemsText)
		{
			int perfect = ScoreManagerScript.Instance.perfectTimeGems;
			if (perfect != _lastPerfect)
			{
				perfectGemsText.text = perfect.ToString();
				_lastPerfect = perfect;
			}
		}

		if (goodGemsText)
		{
			int good = ScoreManagerScript.Instance.wellTimedGems;
			if (good != _lastGood)
			{
				goodGemsText.text = good.ToString();
				_lastGood = good;
			}
		}

		if (missedGemsText)
		{
			if (missed != _lastMissed)
			{
				missedGemsText.text = missed.ToString();
				_lastMissed = missed;
			}
		}

		int currentStreak = ScoreManagerScript.Instance.CurrentStreak;
		if (streakText && currentStreak != _lastStreakValue)
		{
			streakText.text = currentStreak.ToString();
			_lastStreakValue = currentStreak;
		}
		SetDialTargetValue(currentStreak);

		if (accuracyText)
		{
			int pct;
			if (useRollingAccuracy)
			{
				pct = Mathf.Clamp(Mathf.RoundToInt(ScoreManagerScript.Instance.RollingAccuracy * 100f), 0, 100);
			}
			else
			{
				pct = (total > 0) ? Mathf.Clamp((released - missed) * 100 / total, 0, 100) : 0;
			}

			if (pct != _lastAccuracyPct)
			{
				accuracyText.text = pct.ToString() + "%";

				if (lastAccuracyPct < 0) lastAccuracyPct = pct;
				else if (pct != lastAccuracyPct)
				{
					AnimateAccuracy(pct > lastAccuracyPct);
					lastAccuracyPct = pct;
				}

				_lastAccuracyPct = pct;
			}
		}

		// Animate streak when it changes
		if (lastStreak < 0) lastStreak = currentStreak;
		else if (currentStreak != lastStreak)
		{
			AnimateStreak(currentStreak > lastStreak, currentStreak);
			lastStreak = currentStreak;
		}

		if (timelineProgress && total > 0)
		{
			if (destroyed != _lastDestroyed || total != _lastTotalNotes)
			{
				timelineProgress.SetProgress((float)destroyed / total);
				_lastDestroyed = destroyed;
				_lastTotalNotes = total;
			}
		}

		EnsureStreakDialResolved();
		UpdateStreakDial(Time.deltaTime);
	}

	public void ApplicationClose()
	{
		Application.Quit();
	}

	// --- 🎮 In-Game Controls ---

	public void TogglePause(bool bPauseOverlay = true)
	{
		// Block manual pause while tutorial or stop popup is active
		if (TutorialManager.IsTutorialActive)
			return;

		if (stopPopup != null && stopPopup.activeSelf)
			return;

		if (isPaused)
		{
			ResumeGame(bPauseOverlay);
		}
		else
		{
			PauseGame(bPauseOverlay);
		}
	}

	private void PauseGame(bool bPauseOverlay)
	{
		isPaused = true;
		AudioManager.Instance.PauseSong();
		if (cameraMovement) cameraMovement.enabled = false;

		if (pauseOverlay && pauseCanvasGroup && bPauseOverlay)
		{
			pauseOverlay.SetActive(true);
			pauseCanvasGroup.alpha = 0f;
			pauseCanvasGroup.DOFade(1f, 0.3f).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(pauseCanvasGroup);
		}

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(true); // now shows rebinds
	}

	private void ResumeGame(bool bPauseOverlay)
	{
		isPaused = false;
		AudioManager.Instance.ResumeSong();
		if (cameraMovement) cameraMovement.enabled = true;

		if (pauseOverlay && pauseCanvasGroup && bPauseOverlay)
		{
			pauseCanvasGroup.DOFade(0f, 0.25f).SetEase(Ease.InOutSine).SetUpdate(true).SetTarget(pauseCanvasGroup)
				.OnComplete(() => pauseOverlay.SetActive(false));
		}

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(false); // hides rebinds
	}
	public void PauseForTutorial()
	{
		if (!isPaused)
		{
			isPaused = true;
			AudioManager.Instance.PauseSong();
			if (cameraMovement) cameraMovement.enabled = false;
		}

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(false);
	}

	public void ResumeFromTutorial()
	{
		if (isPaused)
		{
			isPaused = false;
			AudioManager.Instance.ResumeSong();
			if (cameraMovement) cameraMovement.enabled = true;
		}

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(false);
	}

	public void RestartGame()
	{
		AlgebraTutorialGate.SkipGateOnceForNextSceneReload();
		CleanupAndResetState();
		SceneManager.LoadScene(SceneManager.GetActiveScene().name);
	}

	public void StopGame()
	{
		// Ensure core paused state (audio + camera) is applied
		if (!isPaused)
		{
			PauseGame(false); // pause without showing the pause overlay
		}
		else
		{
			AudioManager.Instance.PauseSong();
			if (cameraMovement != null)
				cameraMovement.enabled = false;
		}

		// Hide the pause overlay if it happens to be visible
		if (pauseOverlay != null && pauseCanvasGroup != null && pauseOverlay.activeSelf)
		{
			pauseCanvasGroup.DOFade(0f, 0.25f).SetEase(Ease.InOutSine).SetUpdate(true).SetTarget(pauseCanvasGroup)
				.OnComplete(() => pauseOverlay.SetActive(false));
		}

		// Show the dedicated stop popup instead
		if (cameraMovement != null)
			cameraMovement.enabled = false;

		if (stopPopup != null)
		{
			stopPopup.SetActive(true);
		}

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(false);
	}

	public void ConfirmStopToOnboarding()
	{
		CleanupAndResetState();

		SceneManager.LoadScene("Onboarding");
	}

	public void KeepPlaying()
	{
		isPaused = false;
		AudioManager.Instance.ResumeSong();
		if (cameraMovement != null)
			cameraMovement.enabled = true;

		if (pauseOverlay != null && pauseCanvasGroup != null && pauseOverlay.activeSelf)
		{
			pauseCanvasGroup.DOFade(0f, 0.25f).SetEase(Ease.InOutSine).SetUpdate(true).SetTarget(pauseCanvasGroup)
				.OnComplete(() => pauseOverlay.SetActive(false));
		}

		if (stopPopup != null)
			stopPopup.SetActive(false);

		var cc = _cc != null ? _cc : customizeControls;
		if (cc) cc.SetVisible(false);
	}

	public void CleanupAndResetState()
	{
		AudioManager.Instance.RestartSong();
		ScoreManagerScript.Instance?.ResetScore();
	}

	public void TriggerStreakBrokenTextPulse()
	{
		if (!streakBrokenText.IsActive())
		{
			streakBrokenText.gameObject.SetActive(true);
		}

		if (streakBrokenText)
		{
			var go = streakBrokenText.gameObject;
			streakBrokenText.DOFade(1f, 0.3f)
				.SetEase(Ease.OutQuart)
				.SetTarget(streakBrokenText)
				.SetLink(go, LinkBehaviour.KillOnDestroy)
				.OnComplete(() =>
				{
					streakBrokenText.transform.DOScale(Vector3.one * 1.2f, 0.2f)
						.SetEase(Ease.OutQuad)
						.SetLink(go, LinkBehaviour.KillOnDestroy)
						.OnComplete(() =>
						{
							streakBrokenText.transform.DOShakeScale(0.3f, 0.5f, 15, 90, false, ShakeRandomnessMode.Harmonic)
								.SetLink(go, LinkBehaviour.KillOnDestroy);
						});

					streakBrokenText.DOFade(0f, 0.4f)
						.SetEase(Ease.InOutCubic)
						.SetTarget(streakBrokenText)
						.SetLink(go, LinkBehaviour.KillOnDestroy);
				});

			streakBrokenText.transform.DOScale(Vector3.one, 0.2f)
				.SetDelay(0.8f)
				.SetEase(Ease.OutQuad)
				.SetTarget(streakBrokenText.transform)
				.SetLink(go, LinkBehaviour.KillOnDestroy);
		}
	}

	private void AnimateAccuracy(bool increased)
	{
		if (!accuracyText) return;
		var target = accuracyText.transform; // animate the value only to avoid layout drift
		DOTween.Kill(target);
		DOTween.Kill(accuracyText);

		// ensure stable baseline scale so punches don't accumulate
		target.localScale = baseAccuracyScale;

		// scale pop (delta around baseline)
		float ampAcc = Mathf.Max(0.001f, accuracyPop - 1f);
		DOTween.Sequence()
			.SetTarget(target)
			.SetUpdate(true)
			.SetRecyclable(true)
			.Append(target.DOPunchScale(Vector3.one * ampAcc, Mathf.Max(0.05f, accuracyPopDuration), 8, 0.6f))
			.OnKill(() => { if (target) target.localScale = baseAccuracyScale; });

		// flash color then return
		Color flash = increased ? accuracyUpColor : accuracyDownColor;
		accuracyText.DOColor(flash, Mathf.Max(0.05f, accuracyFlashDuration * 0.6f)).SetEase(Ease.OutQuad).SetTarget(accuracyText)
			.OnComplete(() =>
			{
				if (accuracyText) accuracyText.DOColor(baseAccuracyColor, Mathf.Max(0.05f, accuracyFlashDuration * 0.8f)).SetEase(Ease.InQuad).SetTarget(accuracyText);
			});
	}

	private void AnimateStreak(bool increased, int newStreak)
	{
		if (!streakText) return;
		var target = streakText.transform; // animate the value only to avoid layout drift
		DOTween.Kill(target);
		DOTween.Kill(streakText);

		// reset baseline scale to prevent cumulative drift
		target.localScale = baseStreakScale;

		if (increased)
		{
			// punch pop on increase; slightly stronger every 10 streaks
			float mult = 1f + (newStreak % 10 == 0 ? 0.06f : 0f);
			float amp = Mathf.Max(0.001f, (streakPop - 1f) * mult);
			target.DOPunchScale(Vector3.one * amp, Mathf.Max(0.05f, streakPopDuration), 8, 0.6f)
				.SetTarget(target).SetUpdate(true).SetRecyclable(true)
				.OnKill(() => { if (target) target.localScale = baseStreakScale; });

			// warm accent flash
			streakText.DOColor(new Color(1f, 0.95f, 0.6f, 1f), streakPopDuration * 0.6f).SetTarget(streakText)
				.OnComplete(() => { if (streakText) streakText.DOColor(baseStreakColor, streakPopDuration * 0.8f).SetTarget(streakText); });

			// milestone bursts (25, 50, 100, ...)
			if (newStreak > 0 && (newStreak % 25 == 0))
			{
				var big = DOTween.Sequence()
					.SetTarget(target).SetUpdate(true).SetRecyclable(true)
					.Append(target.DOPunchScale(Vector3.one * 0.25f, 0.28f, 8, 0.7f))
					.Join(streakText.DOColor(new Color(1f, 0.95f, 0.3f, 1f), 0.18f))
					.AppendInterval(0.05f)
					.Append(streakText.DOColor(baseStreakColor, 0.22f));
			}

			if (pulseDialOnEveryIncrease)
				PulseStreakDial(_streakDialTier);
		}
		else
		{
			// slight shake on drop (miss)
			target.DOShakeScale(Mathf.Max(0.05f, streakShakeDuration), streakShakeStrength, 12, 90, false, ShakeRandomnessMode.Harmonic)
				.SetTarget(target).SetUpdate(true).SetRecyclable(true)
				.OnKill(() => { if (target) target.localScale = baseStreakScale; });
		}
	}

	// Fade to the questionnaire with a gentle dissolve instead of an abrupt cut.
	public void TriggerEndGameFade()
	{
		if (_endGameFadeStarted)
			return;
		_endGameFadeStarted = true;

		if (restartScene)
		{
			GameplayEventBus.RaisePerimeterComplete();
			SceneManager.LoadScene("WispPerimeterAnimesh");
		}
		else
		{
			if (pauseCanvasGroup != null)
			{
				//pauseOverlay.SetActive(true);
				pauseCanvasGroup.alpha = 0f;
				pauseCanvasGroup.DOFade(1f, 1f).SetEase(Ease.InOutQuad).SetTarget(pauseCanvasGroup).OnComplete(() =>
				{
					SceneManager.LoadScene("Question Perimeter");
				});
			}
			else
			{
				SceneManager.LoadScene("Question Perimeter");
			}
		}
	}
	// ========== Event Handlers ==========

	private void HandleHitRegistered(RhythmHitKind hit, int streak)
	{
		// Update counters immediately (fallback still in Update() for safety)
		UpdateCountersImmediate();

		// Drive accuracy animation based on delta change
		var (pct, increased) = ComputeAccuracyAndTrend();
		if (accuracyText)
		{
			accuracyText.text = pct + "%";
			if (lastAccuracyPct < 0) lastAccuracyPct = pct;
			else if (pct != lastAccuracyPct) { AnimateAccuracy(increased); lastAccuracyPct = pct; }
		}

		// Streak pop (increase/decrease)
		if (streakText)
		{
			bool increasedStreak = (streak > lastStreak);
			AnimateStreak(increasedStreak, streak);
			lastStreak = streak;
		}
	}

	private void HandleStreakChangedEvent(int streak)
	{
		if (streakText)
		{
			streakText.text = streak.ToString();
			// light color return if we changed it due to miss
			streakText.DOColor(baseStreakColor, 0.2f);
		}
	}

	private void HandleStreakBrokenEvent()
	{
		// your existing ExecuteEvents path already shows streakBrokenText + shake
		// we add a quick jolt on the label so it reads as "oops but keep going"
		if (streakText)
		{
			streakText.color = new Color(1f, 0.4f, 0.4f, 1f);
			streakText.DOColor(baseStreakColor, 0.35f);
			streakText.transform
				.DOShakeScale(0.22f, 0.18f, 10, 90, false, ShakeRandomnessMode.Harmonic)
				.OnKill(() => { if (streakText) streakText.transform.localScale = baseStreakScale; });
		}
	}

	private void HandleStreakTierChanged(int streak, GameplayEventBus.StreakTier tier, float heat)
	{
		// heat will also arrive via HandleHeatChanged; this is just a good place
		// for tiny tier milestone flourishes if you want (kept minimal here).
		// e.g., a slightly bigger streakText punch on tier up:
		_streakDialTier = tier;
		SetDialTargetHeat(heat);
		if (tier != GameplayEventBus.StreakTier.None)
		{
			PulseStreakDial(tier);
		}

		if (tier != GameplayEventBus.StreakTier.None && streakText)
		{
			streakText.transform.DOPunchScale(Vector3.one * 0.06f, 0.18f, 10, 0.9f);
		}
	}

	private void HandleHeatChanged(float heat)
	{
		_currentHeat = Mathf.Clamp01(heat);
		SetDialTargetHeat(_currentHeat);
		ApplyHeatTint(_currentHeat);
		UpdateStreakHeatPulse(_currentHeat);
	}
	private void ApplyHeatTint(float heat)
	{
		if (!enableHeatTint) return;

		// tint streakText baseline + any extra targets you assign
		if (streakText)
			streakText.color = HeatShift(_baseStreakTextColor, heat);

		if (heatTintTargets != null && _baseHeatColors != null)
		{
			for (int i = 0; i < heatTintTargets.Length; i++)
			{
				var t = heatTintTargets[i];
				if (!t) continue;
				t.color = HeatShift(_baseHeatColors[i], heat);
			}
		}
	}

	private void UpdateStreakHeatPulse(float heat)
	{
		if (!streakHeatPulseImage)
			return;

		float clamped = Mathf.Clamp01(heat);
		var color = streakHeatPulseImage.color;
		color.a = Mathf.Lerp(streakHeatPulseMinAlpha, streakHeatPulseMaxAlpha, clamped);
		streakHeatPulseImage.color = color;

		var target = streakHeatPulseImage.rectTransform;
		if (target)
		{
			float scale = Mathf.Lerp(1f, streakHeatPulseScale, clamped);
			target.localScale = _streakHeatPulseBaseScale * scale;
		}
	}

	private Color HeatShift(Color baseCol, float heat)
	{
		// tilt hue slightly toward warm, boost value a touch; ignore saturation on near-white
		Color.RGBToHSV(baseCol, out var h, out var s, out var v);

		// if the base is basically white/grey, give it a tiny saturation so the shift is visible
		if (s < 0.05f) s = 0.08f;

		// warm-only shift (negative = toward yellow/orange); scale by heat
		float warmShift = Mathf.Abs(heatHueShift) / 360f;   // use slider magnitude
		h = Mathf.Repeat(h - warmShift * heat, 1f);

		// small brightness lift with heat
		v = Mathf.Clamp01(v + heatValueBoost * heat);

		return Color.HSVToRGB(h, s, v);
	}

	private void SetDialTargetValue(int streakCount)
	{
		EnsureStreakDialResolved();
		_streakDialTargetValue = GetNormalizedDialValue(Mathf.Max(0, streakCount));

		if (!_streakDialConfigured || streakDial == null)
			return;

		if (!Application.isPlaying)
		{
			_streakDialDisplayValue = _streakDialTargetValue;
			streakDial.SetValueWithoutNotify(_streakDialDisplayValue);
		}
	}

	private float GetNormalizedDialValue(int streakCount)
	{
		float refMax = ResolveDialMaxStreak();
		if (refMax <= 0.0001f)
			return 0f;
		return Mathf.Clamp01(streakCount / refMax);
	}

	private float ResolveDialMaxStreak()
	{
		var score = ScoreManagerScript.Instance;
		if (score != null)
		{
			if (score.Tier3Threshold > 0) return score.Tier3Threshold;
			if (score.Tier2Threshold > 0) return score.Tier2Threshold;
			if (score.Tier1Threshold > 0) return score.Tier1Threshold;
		}
		return Mathf.Max(1, streakDialFallbackMaxStreak);
	}

	private void SetDialTargetHeat(float heat)
	{
		EnsureStreakDialResolved();
		_streakDialTargetHeat = Mathf.Clamp01(heat);

		if (!_streakDialConfigured || streakDial == null)
			return;

		if (!Application.isPlaying)
		{
			_streakDialDisplayHeat = _streakDialTargetHeat;
			UpdateStreakDialVisuals(_streakDialDisplayHeat, _streakDialTier);
		}
	}

	private void EnsureStreakDialResolved()
	{
		if (streakDial == null)
		{
			if (streakRoot)
				streakDial = streakRoot.GetComponentInChildren<SliderCircular>(true);

			if (streakDial == null && autoLocateStreakDial)
			{
				var localDial = GetComponentInChildren<SliderCircular>(true);
				if (localDial) streakDial = localDial;
			}

			if (streakDial == null && autoLocateStreakDial && !_attemptedDialAutoLocate)
			{
#if UNITY_2023_1_OR_NEWER
				var dial = UnityEngine.Object.FindFirstObjectByType<SliderCircular>(UnityEngine.FindObjectsInactive.Include);
				if (dial && dial.gameObject && dial.gameObject.scene.IsValid())
					streakDial = dial;
#else
				var allDials = Resources.FindObjectsOfTypeAll<SliderCircular>();
				foreach (var dial in allDials)
				{
					if (dial && dial.gameObject && dial.gameObject.scene.IsValid())
					{
						streakDial = dial;
						break;
					}
				}
#endif
				_attemptedDialAutoLocate = true;
			}
		}

		if (streakDial != null && !_streakDialConfigured)
			ConfigureStreakDial();
	}

	private void ConfigureStreakDial()
	{
		if (!streakDial) return;

		_streakDialConfigured = true;
		streakDial.MinValue = 0f;
		streakDial.MaxValue = 1f;
		streakDial.WholeNumbers = false;
		streakDial.HasText = false;

		if (!streakDialFillImage)
			streakDialFillImage = FindDialImage("FillArea/Fill");
		if (!streakDialGlowImage)
			streakDialGlowImage = FindDialImage("Background/Image");
		if (!streakDialHandleImage)
			streakDialHandleImage = FindDialImage("HandleArea/Handle");

		if (streakDialFillImage)
			_streakDialFillBaseColor = streakDialFillImage.color;
		if (streakDialGlowImage)
			_streakDialGlowBaseColor = streakDialGlowImage.color;
		if (streakDialHandleImage)
			_streakDialHandleBaseColor = streakDialHandleImage.color;

		var dialTransform = streakDial.transform;
		_streakDialBaseScale = dialTransform.localScale == Vector3.zero ? Vector3.one : dialTransform.localScale;

		_streakDialTargetHeat = Mathf.Clamp01(_currentHeat);
		_streakDialDisplayHeat = _streakDialTargetHeat;
		int streakCount = ScoreManagerScript.Instance ? ScoreManagerScript.Instance.CurrentStreak : 0;
		_streakDialTargetValue = GetNormalizedDialValue(streakCount);
		_streakDialDisplayValue = _streakDialTargetValue;
		streakDial.SetValueWithoutNotify(_streakDialDisplayValue);
		UpdateStreakDialVisuals(_streakDialDisplayHeat, _streakDialTier);
	}

	private Image FindDialImage(string childPath)
	{
		if (!streakDial || string.IsNullOrEmpty(childPath))
			return null;

		var t = streakDial.transform.Find(childPath);
		if (t) return t.GetComponent<Image>();

		var searchName = childPath.Contains("/")
			? childPath.Substring(childPath.LastIndexOf('/') + 1)
			: childPath;

		var images = streakDial.GetComponentsInChildren<Image>(true);
		foreach (var img in images)
		{
			if (string.Equals(img.name, searchName, StringComparison.OrdinalIgnoreCase))
				return img;
		}
		return null;
	}

	private Gradient GetDialGradient()
	{
		if (streakDialHeatGradient != null && streakDialHeatGradient.colorKeys != null && streakDialHeatGradient.colorKeys.Length > 0)
			return streakDialHeatGradient;

		if (_runtimeDialGradient == null)
		{
			_runtimeDialGradient = new Gradient();
			_runtimeDialGradient.SetKeys(
				new[]
				{
					new GradientColorKey(new Color(0.25f, 0.95f, 0.82f), 0f),
					new GradientColorKey(new Color(1f, 0.85f, 0.35f), 0.5f),
					new GradientColorKey(new Color(1f, 0.35f, 0.18f), 1f)
				},
				new[]
				{
					new GradientAlphaKey(1f, 0f),
					new GradientAlphaKey(1f, 1f)
				});
		}
		return _runtimeDialGradient;
	}

	private void UpdateStreakDial(float deltaTime)
	{
		if (!streakDial || !_streakDialConfigured)
			return;

		float heatSpeed = Mathf.Max(0.01f, streakDialHeatLerpSpeed);
		float valueSpeed = Mathf.Max(0.01f, streakDialValueLerpSpeed);
		if (!Application.isPlaying)
		{
			_streakDialDisplayHeat = _streakDialTargetHeat;
			_streakDialDisplayValue = _streakDialTargetValue;
		}
		else
		{
			_streakDialDisplayHeat = Mathf.MoveTowards(_streakDialDisplayHeat, _streakDialTargetHeat, deltaTime * heatSpeed);
			_streakDialDisplayValue = Mathf.MoveTowards(_streakDialDisplayValue, _streakDialTargetValue, deltaTime * valueSpeed);
		}

		streakDial.SetValueWithoutNotify(_streakDialDisplayValue);
		UpdateStreakDialVisuals(_streakDialDisplayHeat, _streakDialTier);
	}

	private void UpdateStreakDialVisuals(float heat, GameplayEventBus.StreakTier tier)
	{
		var gradient = GetDialGradient();
		float tierWeight = tier switch
		{
			GameplayEventBus.StreakTier.Tier1 => 0.33f,
			GameplayEventBus.StreakTier.Tier2 => 0.66f,
			GameplayEventBus.StreakTier.Tier3 => 1f,
			_ => 0f
		};
		float sample = Mathf.Clamp01(heat * 0.7f + tierWeight * 0.3f);
		Color dialColor = gradient.Evaluate(sample);

		if (streakDialFillImage)
		{
			var fill = dialColor;
			fill.a = _streakDialFillBaseColor.a;
			streakDialFillImage.color = fill;
		}
		if (streakDialHandleImage)
		{
			var handle = dialColor;
			handle.a = _streakDialHandleBaseColor.a;
			streakDialHandleImage.color = handle;
		}
		if (streakDialGlowImage)
		{
			var glow = dialColor;
			glow.a = Mathf.Lerp(streakDialGlowMinAlpha, streakDialGlowMaxAlpha, Mathf.Clamp01(heat));
			streakDialGlowImage.color = glow;
		}
	}

	private void PulseStreakDial(GameplayEventBus.StreakTier tier)
	{
		if (!streakDial || !_streakDialConfigured)
			return;

		var target = streakDial.transform;
		_streakDialPulseTween?.Kill();
		target.localScale = _streakDialBaseScale;

		float amp = tier switch
		{
			GameplayEventBus.StreakTier.Tier3 => 0.12f,
			GameplayEventBus.StreakTier.Tier2 => 0.09f,
			GameplayEventBus.StreakTier.Tier1 => 0.07f,
			_ => 0.05f
		};

		_streakDialPulseTween = target.DOPunchScale(Vector3.one * amp, 0.28f, 10, 0.8f)
			.SetTarget(target).SetUpdate(true)
			.OnKill(() =>
			{
				if (target) target.localScale = _streakDialBaseScale;
			});
	}

	private void ResetStreakDialImmediate()
	{
		EnsureStreakDialResolved();
		if (!streakDial || !_streakDialConfigured)
			return;

		_streakDialPulseTween?.Kill();
		_streakDialPulseTween = null;
		_streakDialTargetHeat = 0f;
		_streakDialDisplayHeat = 0f;
		_streakDialTargetValue = 0f;
		_streakDialDisplayValue = 0f;
		streakDial.transform.localScale = _streakDialBaseScale;
		streakDial.SetValueWithoutNotify(0f);
		UpdateStreakDialVisuals(0f, GameplayEventBus.StreakTier.None);
	}

	private (int pct, bool increased) ComputeAccuracyAndTrend()
	{
		int total = ChartSystem.GetTotalSpawnedNotes();
		int released = ScoreManagerScript.Instance ? ScoreManagerScript.Instance.totalGameGems : 0;
		int missed = ScoreManagerScript.Instance ? ScoreManagerScript.Instance.missedGems : 0;

		int pct = useRollingAccuracy
			? Mathf.Clamp(Mathf.RoundToInt((ScoreManagerScript.Instance?.RollingAccuracy ?? 0f) * 100f), 0, 100)
			: (total > 0 ? Mathf.Clamp((released - missed) * 100 / total, 0, 100) : 0);

		bool increased = (lastAccuracyPct < 0) ? true : pct > lastAccuracyPct;
		return (pct, increased);
	}

	private void UpdateCountersImmediate()
	{
		if (!ScoreManagerScript.Instance) return;

		int destroyed = ScoreManagerScript.Instance.destroyedGems;
		int released = ScoreManagerScript.Instance.totalGameGems;
		int total = ChartSystem.GetTotalSpawnedNotes();
		int missed = ScoreManagerScript.Instance.missedGems;

		if (releasedGemsText) releasedGemsText.text = total > 0 ? $"{released}/{total}" : released.ToString();
		if (perfectGemsText) perfectGemsText.text = ScoreManagerScript.Instance.perfectTimeGems.ToString();
		if (goodGemsText) goodGemsText.text = ScoreManagerScript.Instance.wellTimedGems.ToString();
		if (missedGemsText) missedGemsText.text = missed.ToString();

		if (timelineProgress && total > 0)
			timelineProgress.SetProgress((float)destroyed / total);
	}


}
