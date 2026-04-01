using System;
using System.Collections.Generic;
using DG.Tweening;
using LeTai.Asset.TranslucentImage;
using LeTai.Paraform.Scaffold;
using Shapes;
using TMPro;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

[DisallowMultipleComponent]
public sealed partial class AlgebraResultsOverlayController : MonoBehaviour
{
	private const float ReferenceLayoutWidth = 1120f;
	private const float ReferenceLayoutHeight = 760f;
	private const string FontResourcePath = "MVP Assets/BaiJamjuree-Medium SDF";
	private const string FallbackLevelSelectSceneName = "Level Select";
	private const int OverlayForegroundSortingOrderOffset = 1024;
	public const string ResultsScreenPrefabResourcePath = "Prefabs/UI/Results Screen";

	[SerializeField] private string levelDisplayName = "ALGEBRA SK TAG";
	[SerializeField] private string levelSelectSceneName = "LevelSelectScene";
	[SerializeField] private bool pauseAudioOnShow = true;

	[Header("Palette")]
	[SerializeField] private Color overlayDimColor = new Color(0.03f, 0.04f, 0.07f, 0.88f);
	[SerializeField] private Color accentColor = new Color(0.81f, 1f, 0.02f, 1f);
	[SerializeField] private Color accentSoftColor = new Color(0.72f, 0.96f, 0.24f, 1f);
	[SerializeField] private Color panelColor = new Color(0.15f, 0.16f, 0.19f, 0.92f);
	[SerializeField] private Color panelStrongColor = new Color(0.12f, 0.13f, 0.15f, 0.96f);
	[SerializeField] private Color panelLineColor = new Color(1f, 1f, 1f, 0.08f);
	[SerializeField] private Color mutedTextColor = new Color(1f, 1f, 1f, 0.58f);
	[SerializeField] private Color brightTextColor = Color.white;
	[SerializeField] private Color barTrackColor = new Color(1f, 1f, 1f, 0.08f);
	[SerializeField] private Color perfectColor = new Color(0.13f, 1f, 0.38f, 1f);
	[SerializeField] private Color goodColor = new Color(1f, 0.86f, 0.11f, 1f);
	[SerializeField] private Color earlyColor = new Color(1f, 0.42f, 0.12f, 1f);
	[SerializeField] private Color lateColor = new Color(1f, 0.18f, 0.20f, 1f);
	[SerializeField] private int graphSortingOffset = 1;

	private DragExecutionController dragController;
	private AlgebraResultsSessionTracker tracker;
	private LinearEquationSolver equationSolver;
	private Canvas sourceCanvas;
	private Camera uiCamera;
	private TMP_FontAsset fontAsset;
	private TranslucentImageSource translucentSource;
	private bool initialized;
	private bool overlayVisible;
	private bool chartEventHooked;

	private RectTransform overlayRoot;
	private RectTransform layoutRoot;
	private RectTransform headerGroup;
	private RectTransform scoreCardRoot;
	private RectTransform statRowRoot;
	private RectTransform accuracyPanelRoot;
	private RectTransform buttonRowRoot;
	private RectTransform graphRoot;
	private CanvasGroup overlayCanvasGroup;
	private Canvas overlayForegroundCanvas;
	private GraphicRaycaster overlayForegroundRaycaster;
	private CanvasGroup headerCanvasGroup;
	private CanvasGroup scoreCanvasGroup;
	private CanvasGroup accuracyCanvasGroup;
	private CanvasGroup statsCanvasGroup;
	private CanvasGroup buttonsCanvasGroup;
	private Image dimmerImage;
	private Graphic heroGlowGraphic;
	private GameObject newBestBadge;
	private TMP_Text titleText;
	private TMP_Text levelBadgeText;
	private TMP_Text scoreValueText;
	private TMP_Text pastHighScoreText;
	private TMP_Text streakChainsValueText;
	private TMP_Text maxComboValueText;
	private TMP_Text equationsSolvedValueText;
	private Button exitButton;
	private Button playAgainButton;
	private Button nextLevelButton;
	private Polyline trendPolyline;
	private Polyline trendUnderlayPolyline;
	private readonly List<PolylinePoint> graphPoints = new List<PolylinePoint>(128);
	private readonly List<PolylinePoint> graphUnderlayPoints = new List<PolylinePoint>(128);
	private readonly List<Image> graphGridLines = new List<Image>(3);
	private RowWidgets perfectRow;
	private RowWidgets goodRow;
	private RowWidgets earlyRow;
	private RowWidgets lateRow;
	private Sequence revealSequence;

	[Serializable]
	private sealed class RowWidgets
	{
		public TMP_Text countText;
		public RectTransform fillRect;
		public Image fillImage;
	}

	public void Initialize(DragExecutionController drag, AlgebraResultsSessionTracker sessionTracker, Canvas canvas)
	{
		dragController = drag;
		tracker = sessionTracker;
		equationSolver = FindFirstObjectByType<LinearEquationSolver>();
		sourceCanvas = canvas != null ? canvas : GetComponentInParent<Canvas>();
		uiCamera = drag != null ? drag.UICamera : (sourceCanvas != null ? sourceCanvas.worldCamera : null);
		fontAsset = ResolveFontAsset();
		translucentSource = ResolveTranslucentSource();

		EnsureUiBuilt();
		SetHiddenStateImmediate();
		initialized = true;
		HookChartComplete();
	}

	private void OnEnable()
	{
		if (initialized)
			HookChartComplete();
	}

	private void Awake()
	{
		if (!Application.isPlaying)
			return;

		ForceHiddenBeforeInitialization();
	}

	private void OnDisable()
	{
		UnhookChartComplete();
		KillOverlayTweens();
	}

	private void OnDestroy()
	{
		UnhookChartComplete();
		KillOverlayTweens();
	}

	private void OnRectTransformDimensionsChange()
	{
		ApplyLayoutScale();
	}

	[ContextMenu("Show Debug Results Overlay")]
	private void ShowDebugResultsOverlay()
	{
		if (sourceCanvas == null)
			sourceCanvas = GetComponent<Canvas>();
		if (fontAsset == null)
			fontAsset = ResolveFontAsset();
		if (translucentSource == null)
			translucentSource = ResolveTranslucentSource();

		EnsureUiBuilt();

		AlgebraResultsSnapshot snapshot = new AlgebraResultsSnapshot
		{
			sceneKey = SceneManager.GetActiveScene().name,
			levelDisplayName = levelDisplayName,
			score = 12450,
			pastHighScore = 10200,
			isNewBest = true,
			perfectCount = 14,
			goodCount = 6,
			earlyCount = 3,
			lateCount = 1,
			otherMisses = 0,
			streakChainsAchieved = 7,
			maxCombo = 18,
			equationsSolved = 24,
			accuracyPercent = 82,
			trendSamples = new List<float> { 0.88f, 0.74f, 0.9f, 0.79f, 0.84f, 0.28f, 0.86f, 0.76f, 0.12f, 0.92f, 0.34f, 0.86f, 0.26f, 0.9f }
		};

		ApplySnapshot(snapshot);
		ShowOverlayAnimated();
	}

	private void HookChartComplete()
	{
		if (chartEventHooked)
			return;

		GameplayEventBus.ChartCompleted += HandleChartCompleted;
		chartEventHooked = true;
	}

	private void UnhookChartComplete()
	{
		if (!chartEventHooked)
			return;

		GameplayEventBus.ChartCompleted -= HandleChartCompleted;
		chartEventHooked = false;
	}

	private void HandleChartCompleted()
	{
		if (!initialized || overlayVisible || tracker == null)
			return;
		if (equationSolver != null && equationSolver.SuppressResultsOverlay)
			return;

		AlgebraResultsSnapshot snapshot = tracker.BuildSnapshot(levelDisplayName);
		AlgebraResultsPersistence.SaveBestResult saveResult = AlgebraResultsPersistence.SaveIfBest(snapshot.sceneKey, snapshot);
		snapshot.pastHighScore = saveResult.previousBestScore > 0 ? saveResult.previousBestScore : saveResult.bestScore;
		snapshot.isNewBest = saveResult.isNewBest;

		ApplySnapshot(snapshot);
		ShowOverlayAnimated();
	}

	private void EnsureUiBuilt()
	{
		fontAsset = fontAsset != null ? fontAsset : ResolveFontAsset();
		translucentSource = ResolveTranslucentSource();

		if (HasResolvedLayout() || TryBindExistingLayout())
		{
			PostLayoutResolved();
			return;
		}

		if (TryUseSelfAsOverlayRoot())
		{
			BuildOverlayChildren();
			PostLayoutResolved();
			return;
		}

		if (sourceCanvas == null)
			sourceCanvas = GetComponent<Canvas>();
		if (sourceCanvas == null)
			sourceCanvas = GetComponentInParent<Canvas>();
		if (sourceCanvas == null)
			return;

		CreateOverlayRootUnderCanvas();
		BuildOverlayChildren();
		PostLayoutResolved();
	}

	private void BuildHeader()
	{
		headerGroup.anchorMin = new Vector2(0.5f, 0.5f);
		headerGroup.anchorMax = new Vector2(0.5f, 0.5f);
		headerGroup.pivot = new Vector2(0.5f, 0.5f);
		headerGroup.sizeDelta = new Vector2(1030f, 110f);
		headerGroup.anchoredPosition = new Vector2(0f, 282f);

		exitButton = CreateTextButton(
			"ExitButton",
			headerGroup,
			new Vector2(0f, 0.5f),
			new Vector2(0f, 0.5f),
			new Vector2(0f, 0.5f),
			new Vector2(0f, 0f),
			new Vector2(140f, 34f),
			"< EXIT",
			brightTextColor,
			Color.clear,
			18f,
			FontStyles.Bold,
			characterSpacing: 8f);
		exitButton.onClick.RemoveAllListeners();
		exitButton.onClick.AddListener(ReturnToLevelSelect);
		Shadow exitUnderline = exitButton.gameObject.AddComponent<Shadow>();
		exitUnderline.effectColor = accentColor;
		exitUnderline.effectDistance = new Vector2(0f, -3f);

		titleText = CreateText(
			"ResultsTitle",
			headerGroup,
			"RESULTS",
			36f,
			brightTextColor,
			TextAlignmentOptions.Center,
			FontStyles.Bold,
			2.9f);
		StretchToRect(titleText.rectTransform, new Vector2(250f, 42f), new Vector2(0f, 18f));

		Graphic badgeGraphic = CreateGlassPanel("LevelBadge", headerGroup, new Vector2(192f, 30f), new Vector2(0f, -24f), accentColor, 0.10f, 16f, 0.14f);
		levelBadgeText = CreateText(
			"LevelBadgeText",
			badgeGraphic.rectTransform,
			levelDisplayName,
			10.5f,
			accentColor,
			TextAlignmentOptions.Center,
			FontStyles.Bold,
			2.2f);
		StretchToRect(levelBadgeText.rectTransform, badgeGraphic.rectTransform.sizeDelta, Vector2.zero);
	}

	private void BuildScoreCard()
	{
		scoreCardRoot.anchorMin = new Vector2(0.5f, 0.5f);
		scoreCardRoot.anchorMax = new Vector2(0.5f, 0.5f);
		scoreCardRoot.pivot = new Vector2(0.5f, 0.5f);
		scoreCardRoot.sizeDelta = new Vector2(392f, 278f);
		scoreCardRoot.anchoredPosition = new Vector2(-198f, 96f);

		Graphic cardGraphic = CreateGlassPanel("ScoreCard", scoreCardRoot, scoreCardRoot.sizeDelta, Vector2.zero, panelStrongColor, 0.30f, 18f, 0.10f);
		cardGraphic.rectTransform.anchoredPosition = Vector2.zero;

		Image accentGlow = CreateImage("AccentGlow", cardGraphic.rectTransform, new Color(accentColor.r, accentColor.g, accentColor.b, 0.19f));
		accentGlow.rectTransform.anchorMin = new Vector2(0f, 0f);
		accentGlow.rectTransform.anchorMax = new Vector2(1f, 1f);
		accentGlow.rectTransform.offsetMin = new Vector2(18f, 18f);
		accentGlow.rectTransform.offsetMax = new Vector2(-18f, -18f);
		Shadow glowShadow = accentGlow.gameObject.AddComponent<Shadow>();
		glowShadow.effectColor = new Color(accentColor.r, accentColor.g, accentColor.b, 0.36f);
		glowShadow.effectDistance = Vector2.zero;
		heroGlowGraphic = accentGlow;

		TMP_Text label = CreateText("ScoreLabel", cardGraphic.rectTransform, "SCORE", 13f, brightTextColor, TextAlignmentOptions.Center, FontStyles.Bold, 2.2f);
		StretchToRect(label.rectTransform, new Vector2(120f, 24f), new Vector2(0f, 82f));

		Graphic badgeGraphic = CreateGlassPanel("NewBestBadge", cardGraphic.rectTransform, new Vector2(112f, 30f), new Vector2(0f, 46f), accentColor, 0.12f, 15f, 0.16f);
		TMP_Text newBestText = CreateText("NewBestText", badgeGraphic.rectTransform, "NEW BEST", 11f, accentColor, TextAlignmentOptions.Center, FontStyles.Bold, 1.4f);
		StretchToRect(newBestText.rectTransform, badgeGraphic.rectTransform.sizeDelta, Vector2.zero);
		newBestBadge = badgeGraphic.gameObject;

		scoreValueText = CreateText("ScoreValue", cardGraphic.rectTransform, "0", 70f, accentColor, TextAlignmentOptions.Center, FontStyles.Bold, -1.4f);
		StretchToRect(scoreValueText.rectTransform, new Vector2(280f, 76f), new Vector2(0f, -8f));

		Graphic pbGraphic = CreateGlassPanel("PastHighScore", cardGraphic.rectTransform, new Vector2(232f, 42f), new Vector2(0f, -92f), brightTextColor, 0.05f, 12f, 0.12f);
		TMP_Text pbLabel = CreateText("PastHighScoreLabel", pbGraphic.rectTransform, "PAST HIGH SCORE", 11f, brightTextColor, TextAlignmentOptions.MidlineLeft, FontStyles.Bold, 2.1f);
		pbLabel.rectTransform.anchorMin = new Vector2(0f, 0f);
		pbLabel.rectTransform.anchorMax = new Vector2(0f, 1f);
		pbLabel.rectTransform.pivot = new Vector2(0f, 0.5f);
		pbLabel.rectTransform.sizeDelta = new Vector2(140f, 42f);
		pbLabel.rectTransform.anchoredPosition = new Vector2(14f, 0f);

		pastHighScoreText = CreateText("PastHighScoreValue", pbGraphic.rectTransform, "0", 25f, brightTextColor, TextAlignmentOptions.MidlineRight, FontStyles.Bold, 0f);
		pastHighScoreText.rectTransform.anchorMin = new Vector2(1f, 0f);
		pastHighScoreText.rectTransform.anchorMax = new Vector2(1f, 1f);
		pastHighScoreText.rectTransform.pivot = new Vector2(1f, 0.5f);
		pastHighScoreText.rectTransform.sizeDelta = new Vector2(100f, 42f);
		pastHighScoreText.rectTransform.anchoredPosition = new Vector2(-14f, 0f);
	}

	private void BuildAccuracyPanel()
	{
		accuracyPanelRoot.anchorMin = new Vector2(0.5f, 0.5f);
		accuracyPanelRoot.anchorMax = new Vector2(0.5f, 0.5f);
		accuracyPanelRoot.pivot = new Vector2(0.5f, 0.5f);
		accuracyPanelRoot.sizeDelta = new Vector2(382f, 431f);
		accuracyPanelRoot.anchoredPosition = new Vector2(220f, 18f);

		Graphic panelGraphic = CreateGlassPanel("AccuracyPanel", accuracyPanelRoot, accuracyPanelRoot.sizeDelta, Vector2.zero, panelColor, 0.24f, 16f, 0.08f);

		TMP_Text label = CreateText("AccuracyLabel", panelGraphic.rectTransform, "ACCURACY", 13f, brightTextColor, TextAlignmentOptions.Center, FontStyles.Bold, 2f);
		StretchToRect(label.rectTransform, new Vector2(160f, 24f), new Vector2(0f, 156f));

		graphRoot = CreateRect("GraphRoot", panelGraphic.rectTransform);
		graphRoot.anchorMin = new Vector2(0.5f, 0.5f);
		graphRoot.anchorMax = new Vector2(0.5f, 0.5f);
		graphRoot.pivot = new Vector2(0.5f, 0.5f);
		graphRoot.sizeDelta = new Vector2(338f, 112f);
		graphRoot.anchoredPosition = new Vector2(0f, 80f);

		Image bottomGlow = CreateImage("BottomGlow", graphRoot, new Color(lateColor.r, lateColor.g * 0.9f, lateColor.b, 0.18f));
		bottomGlow.rectTransform.anchorMin = new Vector2(0f, 0f);
		bottomGlow.rectTransform.anchorMax = new Vector2(1f, 0f);
		bottomGlow.rectTransform.pivot = new Vector2(0.5f, 0f);
		bottomGlow.rectTransform.sizeDelta = new Vector2(0f, 44f);
		bottomGlow.rectTransform.anchoredPosition = new Vector2(0f, 0f);

		for (int i = 0; i < 3; i++)
		{
			Image line = CreateImage($"GridLine_{i}", graphRoot, new Color(1f, 1f, 1f, 0.10f));
			line.rectTransform.anchorMin = new Vector2(0f, 0.22f + (i * 0.23f));
			line.rectTransform.anchorMax = new Vector2(1f, 0.22f + (i * 0.23f));
			line.rectTransform.pivot = new Vector2(0.5f, 0.5f);
			line.rectTransform.sizeDelta = new Vector2(0f, 1.6f);
			graphGridLines.Add(line);
		}

		TMP_Text startText = CreateText("GraphStart", panelGraphic.rectTransform, "START", 10.5f, mutedTextColor, TextAlignmentOptions.Left, FontStyles.Bold, 1.6f);
		startText.rectTransform.anchorMin = new Vector2(0f, 0.5f);
		startText.rectTransform.anchorMax = new Vector2(0f, 0.5f);
		startText.rectTransform.pivot = new Vector2(0f, 0.5f);
		startText.rectTransform.sizeDelta = new Vector2(90f, 18f);
		startText.rectTransform.anchoredPosition = new Vector2(23f, 22f);

		TMP_Text endText = CreateText("GraphEnd", panelGraphic.rectTransform, "END", 10.5f, mutedTextColor, TextAlignmentOptions.Right, FontStyles.Bold, 1.6f);
		endText.rectTransform.anchorMin = new Vector2(1f, 0.5f);
		endText.rectTransform.anchorMax = new Vector2(1f, 0.5f);
		endText.rectTransform.pivot = new Vector2(1f, 0.5f);
		endText.rectTransform.sizeDelta = new Vector2(90f, 18f);
		endText.rectTransform.anchoredPosition = new Vector2(-23f, 22f);

		perfectRow = BuildAccuracyRow(panelGraphic.rectTransform, "Perfect", perfectColor, new Vector2(0f, -72f));
		goodRow = BuildAccuracyRow(panelGraphic.rectTransform, "Good", goodColor, new Vector2(0f, -113f));
		earlyRow = BuildAccuracyRow(panelGraphic.rectTransform, "Early", earlyColor, new Vector2(0f, -154f));
		lateRow = BuildAccuracyRow(panelGraphic.rectTransform, "Late", lateColor, new Vector2(0f, -195f));
	}

	private void BuildStatCards()
	{
		statRowRoot.anchorMin = new Vector2(0.5f, 0.5f);
		statRowRoot.anchorMax = new Vector2(0.5f, 0.5f);
		statRowRoot.pivot = new Vector2(0.5f, 0.5f);
		statRowRoot.sizeDelta = new Vector2(392f, 118f);
		statRowRoot.anchoredPosition = new Vector2(-198f, -128f);

		BuildStatCard(statRowRoot, new Vector2(-136f, 0f), "Streaks", "STREAKS", "ST", out streakChainsValueText);
		BuildStatCard(statRowRoot, new Vector2(0f, 0f), "MaxCombo", "MAX COMBO", "MX", out maxComboValueText);
		BuildStatCard(statRowRoot, new Vector2(136f, 0f), "EquationsSolved", "EQUATIONS\nSOLVED", "EQ", out equationsSolvedValueText);
	}

	private void BuildButtons()
	{
		buttonRowRoot.anchorMin = new Vector2(0.5f, 0.5f);
		buttonRowRoot.anchorMax = new Vector2(0.5f, 0.5f);
		buttonRowRoot.pivot = new Vector2(0.5f, 0.5f);
		buttonRowRoot.sizeDelta = new Vector2(800f, 64f);
		buttonRowRoot.anchoredPosition = new Vector2(0f, -270f);

		playAgainButton = CreateActionButton("PlayAgainButton", buttonRowRoot, new Vector2(-202f, 0f), new Vector2(320f, 52f), "PLAY AGAIN", new Color(0.08f, 0.08f, 0.10f, 1f), accentColor, solidFill: true);
		playAgainButton.onClick.RemoveAllListeners();
		playAgainButton.onClick.AddListener(PlayAgain);

		nextLevelButton = CreateActionButton("NextLevelButton", buttonRowRoot, new Vector2(202f, 0f), new Vector2(320f, 52f), "NEXT LEVEL >", brightTextColor, accentColor, solidFill: false);
		nextLevelButton.onClick.RemoveAllListeners();
		nextLevelButton.onClick.AddListener(ReturnToLevelSelect);
	}

	private RowWidgets BuildAccuracyRow(Transform parent, string label, Color fillColor, Vector2 anchoredPosition)
	{
		RectTransform row = CreateRect($"{label}Row", parent);
		row.anchorMin = new Vector2(0.5f, 0.5f);
		row.anchorMax = new Vector2(0.5f, 0.5f);
		row.pivot = new Vector2(0.5f, 0.5f);
		row.sizeDelta = new Vector2(338f, 34f);
		row.anchoredPosition = anchoredPosition;

		TMP_Text labelText = CreateText($"{label}Label", row, label, 16f, brightTextColor, TextAlignmentOptions.MidlineLeft, FontStyles.Normal, 0f);
		labelText.rectTransform.anchorMin = new Vector2(0f, 0.5f);
		labelText.rectTransform.anchorMax = new Vector2(0f, 0.5f);
		labelText.rectTransform.pivot = new Vector2(0f, 0.5f);
		labelText.rectTransform.sizeDelta = new Vector2(80f, 24f);
		labelText.rectTransform.anchoredPosition = new Vector2(0f, 0f);

		Image track = CreateImage($"{label}Track", row, barTrackColor);
		track.rectTransform.anchorMin = new Vector2(0f, 0.5f);
		track.rectTransform.anchorMax = new Vector2(0f, 0.5f);
		track.rectTransform.pivot = new Vector2(0f, 0.5f);
		track.rectTransform.sizeDelta = new Vector2(160f, 8f);
		track.rectTransform.anchoredPosition = new Vector2(98f, 0f);

		RectTransform fillRect = CreateRect($"{label}FillRoot", track.rectTransform);
		fillRect.anchorMin = new Vector2(0f, 0f);
		fillRect.anchorMax = new Vector2(0f, 1f);
		fillRect.pivot = new Vector2(0f, 0.5f);
		fillRect.sizeDelta = new Vector2(0f, 0f);
		fillRect.anchoredPosition = Vector2.zero;

		Image fill = CreateImage($"{label}Fill", fillRect, fillColor);
		fill.rectTransform.anchorMin = Vector2.zero;
		fill.rectTransform.anchorMax = Vector2.one;
		fill.rectTransform.offsetMin = Vector2.zero;
		fill.rectTransform.offsetMax = Vector2.zero;

		TMP_Text countText = CreateText($"{label}Count", row, "0", 16f, brightTextColor, TextAlignmentOptions.MidlineRight, FontStyles.Bold, 0f);
		countText.rectTransform.anchorMin = new Vector2(1f, 0.5f);
		countText.rectTransform.anchorMax = new Vector2(1f, 0.5f);
		countText.rectTransform.pivot = new Vector2(1f, 0.5f);
		countText.rectTransform.sizeDelta = new Vector2(44f, 24f);
		countText.rectTransform.anchoredPosition = new Vector2(0f, 0f);

		return new RowWidgets
		{
			countText = countText,
			fillRect = fillRect,
			fillImage = fill
		};
	}

	private void BuildStatCard(Transform parent, Vector2 anchoredPosition, string objectNamePrefix, string caption, string icon, out TMP_Text valueText)
	{
		Graphic cardGraphic = CreateGlassPanel($"{objectNamePrefix}Card", parent, new Vector2(120f, 104f), anchoredPosition, panelColor, 0.24f, 14f, 0.08f);
		RectTransform root = cardGraphic.rectTransform;

		TMP_Text iconText = CreateText($"{objectNamePrefix}Icon", root, icon, 22f, accentColor, TextAlignmentOptions.Center, FontStyles.Bold, 0f);
		StretchToRect(iconText.rectTransform, new Vector2(56f, 24f), new Vector2(0f, 24f));

		valueText = CreateText($"{objectNamePrefix}Value", root, "0", 28f, brightTextColor, TextAlignmentOptions.Center, FontStyles.Bold, 0f);
		StretchToRect(valueText.rectTransform, new Vector2(76f, 30f), new Vector2(0f, -2f));

		TMP_Text captionText = CreateText($"{objectNamePrefix}Caption", root, caption, 11f, mutedTextColor, TextAlignmentOptions.Center, FontStyles.Bold, 1.8f);
		StretchToRect(captionText.rectTransform, new Vector2(96f, 28f), new Vector2(0f, -34f));
		captionText.textWrappingMode = TextWrappingModes.Normal;
	}

	private void EnsureGraphPolyline()
	{
		if (graphRoot == null)
			return;

		if (trendUnderlayPolyline == null)
		{
			GameObject underlayObj = new GameObject("TrendPolylineUnderlay", typeof(RectTransform), typeof(Polyline));
			underlayObj.transform.SetParent(graphRoot, false);
			RectTransform rect = underlayObj.GetComponent<RectTransform>();
			rect.anchorMin = Vector2.zero;
			rect.anchorMax = Vector2.one;
			rect.offsetMin = Vector2.zero;
			rect.offsetMax = Vector2.zero;
			trendUnderlayPolyline = underlayObj.GetComponent<Polyline>();
		}

		if (trendPolyline == null)
		{
			GameObject polyObj = new GameObject("TrendPolyline", typeof(RectTransform), typeof(Polyline));
			polyObj.transform.SetParent(graphRoot, false);
			RectTransform rect = polyObj.GetComponent<RectTransform>();
			rect.anchorMin = Vector2.zero;
			rect.anchorMax = Vector2.one;
			rect.offsetMin = Vector2.zero;
			rect.offsetMax = Vector2.zero;
			trendPolyline = polyObj.GetComponent<Polyline>();
		}

		ConfigurePolyline(trendUnderlayPolyline, 6f);
		ConfigurePolyline(trendPolyline, 3.4f);
		SyncGraphSorting();
	}

	private void ConfigurePolyline(Polyline polyline, float thickness)
	{
		if (polyline == null)
			return;

		polyline.Closed = false;
		polyline.Geometry = PolylineGeometry.Flat2D;
		polyline.ThicknessSpace = ThicknessSpace.Meters;
		polyline.Thickness = thickness;
		polyline.Joins = PolylineJoins.Round;
		polyline.ZTest = CompareFunction.Always;
	}

	private void SyncGraphSorting()
	{
		EnsureOverlayForegroundCanvas();
		Canvas sortingCanvas = overlayForegroundCanvas != null ? overlayForegroundCanvas : sourceCanvas;
		if (sortingCanvas == null)
			return;

		// Shapes polylines are not normal UI Graphics, so they need a small positive sort
		// offset to render above the canvas at all. Keep it minimal to avoid jumping layers.
		int baseOrder = sortingCanvas.sortingOrder + Mathf.Max(0, graphSortingOffset);
		if (trendUnderlayPolyline != null)
		{
			trendUnderlayPolyline.SortingLayerID = sortingCanvas.sortingLayerID;
			trendUnderlayPolyline.SortingOrder = baseOrder;
		}
		if (trendPolyline != null)
		{
			trendPolyline.SortingLayerID = sortingCanvas.sortingLayerID;
			trendPolyline.SortingOrder = baseOrder + 1;
		}
	}

	private void ApplySnapshot(AlgebraResultsSnapshot snapshot)
	{
		if (snapshot == null)
			return;

		EnsureUiBuilt();
		if (titleText == null || levelBadgeText == null || scoreValueText == null || pastHighScoreText == null)
			return;

		titleText.text = "RESULTS";
		levelBadgeText.text = snapshot.levelDisplayName;
		scoreValueText.text = FormatScore(snapshot.score);
		pastHighScoreText.text = FormatScore(snapshot.pastHighScore);
		if (streakChainsValueText != null)
			streakChainsValueText.text = snapshot.streakChainsAchieved.ToString();
		if (maxComboValueText != null)
			maxComboValueText.text = snapshot.maxCombo.ToString();
		if (equationsSolvedValueText != null)
			equationsSolvedValueText.text = snapshot.equationsSolved.ToString();
		if (newBestBadge != null)
			newBestBadge.SetActive(snapshot.isNewBest);
		UpdateHeroGlow(snapshot.isNewBest);

		int visibleTotal = Mathf.Max(1, snapshot.VisibleTimingTotal);
		ApplyRow(perfectRow, snapshot.perfectCount, visibleTotal, perfectColor);
		ApplyRow(goodRow, snapshot.goodCount, visibleTotal, goodColor);
		ApplyRow(earlyRow, snapshot.earlyCount, visibleTotal, earlyColor);
		ApplyRow(lateRow, snapshot.lateCount, visibleTotal, lateColor);

		RenderTrend(snapshot.trendSamples);
	}

	private void ApplyRow(RowWidgets widgets, int count, int total, Color fillColor)
	{
		if (widgets == null)
			return;

		float width = 160f * Mathf.Clamp01(total > 0 ? count / (float)total : 0f);
		widgets.countText.text = count.ToString();
		widgets.fillRect.sizeDelta = new Vector2(width, 0f);
		if (widgets.fillImage != null)
			widgets.fillImage.color = fillColor;
	}

	private void RenderTrend(List<float> samples)
	{
		if (trendPolyline == null || trendUnderlayPolyline == null || graphRoot == null)
			return;

		graphPoints.Clear();
		graphUnderlayPoints.Clear();

		List<float> source = samples != null && samples.Count > 0 ? samples : new List<float> { 0.62f, 0.62f };
		List<float> anchors = BuildAnchorSamples(source, 10, 18);
		if (anchors.Count < 2)
		{
			anchors.Clear();
			anchors.Add(0.62f);
			anchors.Add(0.62f);
		}

		const int subdivisions = 4;
		float width = graphRoot.rect.width;
		float height = graphRoot.rect.height;
		float left = -width * 0.5f;
		float bottom = -height * 0.5f;

		for (int i = 0; i < anchors.Count - 1; i++)
		{
			float start = anchors[i];
			float end = anchors[i + 1];
			for (int s = 0; s < subdivisions; s++)
			{
				float t = s / (float)subdivisions;
				float x01 = (i + t) / (anchors.Count - 1f);
				float eased = t * t * (3f - (2f * t));
				float value = Mathf.Lerp(start, end, eased);
				AddGraphPoint(x01, value, left, bottom, width, height);
			}
		}

		AddGraphPoint(1f, anchors[anchors.Count - 1], left, bottom, width, height);

		trendUnderlayPolyline.points = new List<PolylinePoint>(graphUnderlayPoints);
		trendUnderlayPolyline.meshOutOfDate = true;
		trendUnderlayPolyline.gameObject.SetActive(graphUnderlayPoints.Count >= 2);

		trendPolyline.points = new List<PolylinePoint>(graphPoints);
		trendPolyline.meshOutOfDate = true;
		trendPolyline.gameObject.SetActive(graphPoints.Count >= 2);
	}

	private void AddGraphPoint(float x01, float value, float left, float bottom, float width, float height)
	{
		float x = left + (width * Mathf.Clamp01(x01));
		float y = bottom + (height * Mathf.Lerp(0.10f, 0.92f, Mathf.Clamp01(value)));
		Color color = ResolveTrendColor(value);

		Vector3 point = new Vector3(x, y, 0f);
		graphPoints.Add(new PolylinePoint(point, color));
		graphUnderlayPoints.Add(new PolylinePoint(point, new Color(color.r, color.g, color.b, 0.15f)));
	}

	private static List<float> BuildAnchorSamples(List<float> samples, int minCount, int maxCount)
	{
		int count = Mathf.Clamp(samples != null ? samples.Count : 0, 0, maxCount);
		if (count == 0)
			return new List<float> { 0.62f, 0.62f };

		if (samples.Count <= minCount)
			return new List<float>(samples);

		List<float> anchors = new List<float>(maxCount);
		float step = (samples.Count - 1f) / Mathf.Max(1f, maxCount - 1f);
		for (int i = 0; i < maxCount; i++)
		{
			float rawIndex = i * step;
			int left = Mathf.Clamp(Mathf.FloorToInt(rawIndex), 0, samples.Count - 1);
			int right = Mathf.Clamp(left + 1, 0, samples.Count - 1);
			float lerp = rawIndex - left;
			anchors.Add(Mathf.Lerp(samples[left], samples[right], lerp));
		}
		return anchors;
	}

	private Color ResolveTrendColor(float value)
	{
		if (value >= 0.80f)
			return perfectColor;
		if (value >= 0.52f)
			return Color.Lerp(goodColor, perfectColor, Mathf.InverseLerp(0.52f, 0.80f, value));
		if (value >= 0.22f)
			return Color.Lerp(earlyColor, goodColor, Mathf.InverseLerp(0.22f, 0.52f, value));
		return Color.Lerp(lateColor, earlyColor, Mathf.InverseLerp(0f, 0.22f, value));
	}

	private void ShowOverlayAnimated()
	{
		if (overlayRoot == null)
			return;

		EnsureOverlayForegroundCanvas();
		KillOverlayTweens();
		overlayVisible = true;
		SetGraphVisible(true);

		if (dragController != null)
		{
			dragController.SuppressDragProcessing = true;
			dragController.SuppressJourneyGuidance = true;
		}

		if (pauseAudioOnShow && AudioManager.Instance != null)
			AudioManager.Instance.PauseSong();

		overlayCanvasGroup.alpha = 0f;
		overlayCanvasGroup.blocksRaycasts = true;
		overlayCanvasGroup.interactable = true;

		SetGroupAlpha(headerCanvasGroup, 0f);
		SetGroupAlpha(scoreCanvasGroup, 0f);
		SetGroupAlpha(accuracyCanvasGroup, 0f);
		SetGroupAlpha(statsCanvasGroup, 0f);
		SetGroupAlpha(buttonsCanvasGroup, 0f);

		float targetScale = GetLayoutScale();
		layoutRoot.localScale = Vector3.one * Mathf.Max(0.001f, targetScale * 0.975f);

		revealSequence = DOTween.Sequence().SetUpdate(true);
		revealSequence.Append(overlayCanvasGroup.DOFade(1f, 0.24f).SetEase(Ease.OutQuad));
		revealSequence.Join(dimmerImage.DOFade(overlayDimColor.a, 0.24f).From(0f).SetEase(Ease.OutQuad));
		revealSequence.Append(headerCanvasGroup.DOFade(1f, 0.18f));
		revealSequence.Join(scoreCanvasGroup.DOFade(1f, 0.22f));
		revealSequence.Append(accuracyCanvasGroup.DOFade(1f, 0.18f));
		revealSequence.Append(statsCanvasGroup.DOFade(1f, 0.16f));
		revealSequence.Append(buttonsCanvasGroup.DOFade(1f, 0.16f));
		revealSequence.Join(layoutRoot.DOScale(targetScale, 0.34f).SetEase(Ease.OutBack));
		revealSequence.OnComplete(() =>
		{
			if (scoreCardRoot != null)
				scoreCardRoot.DOPunchScale(new Vector3(0.025f, 0.025f, 0f), 0.24f, 6, 0.6f).SetUpdate(true);
		});
	}

	private void KillOverlayTweens()
	{
		revealSequence?.Kill();
		revealSequence = null;
		if (overlayCanvasGroup != null)
			DOTween.Kill(overlayCanvasGroup);
		if (layoutRoot != null)
			DOTween.Kill(layoutRoot);
		if (scoreCardRoot != null)
			DOTween.Kill(scoreCardRoot);
		if (dimmerImage != null)
			DOTween.Kill(dimmerImage);
	}

	private void PlayAgain()
	{
		PrepareForSceneChange();
		AlgebraTutorialGate.SkipGateOnceForNextSceneReload();
		SceneManager.LoadScene(SceneManager.GetActiveScene().name);
	}

	private void ReturnToLevelSelect()
	{
		PrepareForSceneChange();
		string targetScene = ResolveLevelSelectSceneName();
		if (!string.IsNullOrEmpty(targetScene))
		{
			SceneManager.LoadScene(targetScene);
			return;
		}

		Debug.LogWarning("[AlgebraResultsOverlayController] Could not resolve a Level Select scene to load.");
	}

	private float ApplyLayoutScale()
	{
		if (layoutRoot == null || sourceCanvas == null)
			return 1f;

		float targetScale = GetLayoutScale();
		layoutRoot.localScale = Vector3.one * targetScale;
		return targetScale;
	}

	private float GetLayoutScale()
	{
		if (sourceCanvas == null)
			return 1f;

		Rect pixelRect = sourceCanvas.pixelRect;
		float widthScale = pixelRect.width / ReferenceLayoutWidth;
		float heightScale = pixelRect.height / ReferenceLayoutHeight;
		return Mathf.Clamp(Mathf.Min(widthScale, heightScale), 0.72f, 1f);
	}

	private void UpdateHeroGlow(bool isNewBest)
	{
		if (heroGlowGraphic == null)
			return;

		heroGlowGraphic.color = isNewBest
			? new Color(accentColor.r, accentColor.g, accentColor.b, 0.19f)
			: new Color(accentSoftColor.r, accentSoftColor.g, accentSoftColor.b, 0.08f);
	}

	private TMP_FontAsset ResolveFontAsset()
	{
		TMP_FontAsset font = Resources.Load<TMP_FontAsset>(FontResourcePath);
		return font != null ? font : TMP_Settings.defaultFontAsset;
	}

	private TranslucentImageSource ResolveTranslucentSource()
	{
#if UNITY_2023_1_OR_NEWER
		TranslucentImageSource source = FindFirstObjectByType<TranslucentImageSource>(FindObjectsInactive.Include);
#else
		TranslucentImageSource source = FindFirstObjectByType<TranslucentImageSource>();
#endif
		if (source != null)
			return source;

		TranslucentImageSource[] all = Resources.FindObjectsOfTypeAll<TranslucentImageSource>();
		for (int i = 0; i < all.Length; i++)
		{
			if (all[i] != null && all[i].gameObject.scene.IsValid())
				return all[i];
		}

		return null;
	}

	private Graphic CreateGlassPanel(string name, Transform parent, Vector2 size, Vector2 anchoredPosition, Color tint, float foregroundOpacity, float cornerRadius, float borderAlpha)
	{
		GameObject panel = new GameObject(name, typeof(RectTransform));
		panel.transform.SetParent(parent, false);
		RectTransform rect = panel.GetComponent<RectTransform>();
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = size;
		rect.anchoredPosition = anchoredPosition;

		TranslucentImage translucent = panel.AddComponent<TranslucentImage>();
		if (translucentSource != null)
			translucent.source = translucentSource;
		translucent.color = tint;
		translucent.foregroundOpacity = foregroundOpacity;
		translucent.raycastTarget = false;
		ApplyRoundedRectToTranslucent(translucent, cornerRadius);
		Graphic graphic = translucent;

		Image border = CreateImage("Border", rect, new Color(1f, 1f, 1f, borderAlpha));
		border.rectTransform.anchorMin = Vector2.zero;
		border.rectTransform.anchorMax = Vector2.one;
		border.rectTransform.offsetMin = Vector2.zero;
		border.rectTransform.offsetMax = Vector2.zero;
		border.raycastTarget = false;
		Outline outline = border.gameObject.AddComponent<Outline>();
		outline.effectColor = new Color(accentColor.r, accentColor.g, accentColor.b, borderAlpha * 0.55f);
		outline.effectDistance = new Vector2(0.6f, 0.6f);

		Image shine = CreateImage("TopShine", rect, new Color(1f, 1f, 1f, 0.04f));
		shine.rectTransform.anchorMin = new Vector2(0.06f, 1f);
		shine.rectTransform.anchorMax = new Vector2(0.94f, 1f);
		shine.rectTransform.pivot = new Vector2(0.5f, 1f);
		shine.rectTransform.sizeDelta = new Vector2(0f, 1.4f);
		shine.rectTransform.anchoredPosition = new Vector2(0f, -6f);
		shine.raycastTarget = false;

		return graphic;
	}

	private Button CreateActionButton(string name, Transform parent, Vector2 anchoredPosition, Vector2 size, string label, Color textColor, Color accent, bool solidFill)
	{
		GameObject buttonObject = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
		buttonObject.transform.SetParent(parent, false);
		RectTransform rect = buttonObject.GetComponent<RectTransform>();
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = size;
		rect.anchoredPosition = anchoredPosition;

		Image image = buttonObject.GetComponent<Image>();
		image.color = solidFill ? accent : new Color(panelStrongColor.r, panelStrongColor.g, panelStrongColor.b, 0.92f);
		Shadow shadow = buttonObject.AddComponent<Shadow>();
		shadow.effectColor = solidFill
			? new Color(accent.r, accent.g, accent.b, 0.30f)
			: new Color(accent.r, accent.g, accent.b, 0.16f);
		shadow.effectDistance = Vector2.zero;

		if (!solidFill)
		{
			Outline outline = buttonObject.AddComponent<Outline>();
			outline.effectColor = new Color(accent.r, accent.g, accent.b, 0.82f);
			outline.effectDistance = new Vector2(1.2f, 1.2f);
		}

		Button button = buttonObject.GetComponent<Button>();
		ColorBlock colors = button.colors;
		colors.normalColor = image.color;
		colors.highlightedColor = solidFill
			? Color.Lerp(accent, Color.white, 0.08f)
			: Color.Lerp(image.color, accent, 0.12f);
		colors.pressedColor = solidFill
			? Color.Lerp(accent, Color.black, 0.12f)
			: Color.Lerp(image.color, accent, 0.2f);
		colors.selectedColor = colors.highlightedColor;
		colors.disabledColor = new Color(image.color.r, image.color.g, image.color.b, 0.45f);
		button.colors = colors;

		TMP_Text buttonText = CreateText($"{name}_Label", rect, label, 14f, solidFill ? new Color(0.07f, 0.08f, 0.10f, 1f) : textColor, TextAlignmentOptions.Center, FontStyles.Bold, 2.2f);
		StretchToRect(buttonText.rectTransform, size, Vector2.zero);

		return button;
	}

	private Button CreateTextButton(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 anchoredPosition, Vector2 size, string label, Color textColor, Color fillColor, float fontSize, FontStyles fontStyles, float characterSpacing)
	{
		GameObject buttonObject = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
		buttonObject.transform.SetParent(parent, false);
		RectTransform rect = buttonObject.GetComponent<RectTransform>();
		rect.anchorMin = anchorMin;
		rect.anchorMax = anchorMax;
		rect.pivot = pivot;
		rect.sizeDelta = size;
		rect.anchoredPosition = anchoredPosition;

		Image image = buttonObject.GetComponent<Image>();
		image.color = fillColor;
		Button button = buttonObject.GetComponent<Button>();
		button.transition = Selectable.Transition.ColorTint;

		TMP_Text text = CreateText($"{name}_Text", rect, label, fontSize, textColor, TextAlignmentOptions.Left, fontStyles, characterSpacing);
		StretchToRect(text.rectTransform, size, Vector2.zero);
		text.margin = new Vector4(8f, 0f, 8f, 0f);

		return button;
	}

	private TMP_Text CreateText(string name, Transform parent, string textValue, float fontSize, Color color, TextAlignmentOptions alignment, FontStyles fontStyles, float characterSpacing)
	{
		GameObject textObject = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
		textObject.transform.SetParent(parent, false);
		TMP_Text text = textObject.GetComponent<TextMeshProUGUI>();
		text.text = textValue;
		text.font = fontAsset != null ? fontAsset : TMP_Settings.defaultFontAsset;
		text.fontSize = fontSize;
		text.color = color;
		text.alignment = alignment;
		text.fontStyle = fontStyles;
		text.characterSpacing = characterSpacing;
		text.textWrappingMode = TextWrappingModes.NoWrap;
		text.raycastTarget = false;
		return text;
	}

	private static Image CreateImage(string name, Transform parent, Color color)
	{
		GameObject imageObject = new GameObject(name, typeof(RectTransform), typeof(Image));
		imageObject.transform.SetParent(parent, false);
		Image image = imageObject.GetComponent<Image>();
		image.color = color;
		return image;
	}

	private static RectTransform CreateRect(string name, Transform parent)
	{
		GameObject go = new GameObject(name, typeof(RectTransform));
		go.transform.SetParent(parent, false);
		return go.GetComponent<RectTransform>();
	}

	private static CanvasGroup AddCanvasGroup(RectTransform rect)
	{
		CanvasGroup group = rect.gameObject.GetComponent<CanvasGroup>();
		if (group == null)
			group = rect.gameObject.AddComponent<CanvasGroup>();
		return group;
	}

	private static void SetGroupAlpha(CanvasGroup group, float alpha)
	{
		if (group == null)
			return;

		group.alpha = alpha;
		group.blocksRaycasts = alpha > 0.999f;
		group.interactable = alpha > 0.999f;
	}

	private static void StretchToRect(RectTransform rect, Vector2 size, Vector2 anchoredPosition)
	{
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = size;
		rect.anchoredPosition = anchoredPosition;
	}

	private static string FormatScore(int value)
	{
		return Mathf.Max(0, value).ToString("N0");
	}

	private void PrepareForSceneChange()
	{
		KillOverlayTweens();
		overlayVisible = false;

		if (overlayCanvasGroup != null)
		{
			overlayCanvasGroup.blocksRaycasts = false;
			overlayCanvasGroup.interactable = false;
		}

		if (dragController != null)
		{
			dragController.SuppressDragProcessing = false;
			dragController.SuppressJourneyGuidance = false;
		}

		ChartSystem chartSystem = FindFirstObjectByType<ChartSystem>();
		if (chartSystem != null)
			chartSystem.ResetLoaderState();

		if (AudioManager.Instance != null)
			AudioManager.Instance.RestartSong();
	}

	private string ResolveLevelSelectSceneName()
	{
		if (!string.IsNullOrWhiteSpace(levelSelectSceneName) && Application.CanStreamedLevelBeLoaded(levelSelectSceneName))
			return levelSelectSceneName;

		if (Application.CanStreamedLevelBeLoaded(FallbackLevelSelectSceneName))
			return FallbackLevelSelectSceneName;

		return string.Empty;
	}

	private static void ApplyRoundedRectToTranslucent(TranslucentImage image, float radius)
	{
		if (image == null)
			return;

		ParaformConfig config = image.paraformConfig;
		Vector4 target = new Vector4(radius, radius, radius, radius);
		if (config.CornerRadii == target)
			return;

		config.CornerRadii = target;
		image.paraformConfig = config;
		image.SetVerticesDirty();
	}

	private void ForceHiddenBeforeInitialization()
	{
		CanvasGroup group = overlayCanvasGroup != null ? overlayCanvasGroup : GetComponent<CanvasGroup>();
		if (group == null)
			return;

		overlayCanvasGroup = group;
		group.alpha = 0f;
		group.blocksRaycasts = false;
		group.interactable = false;
		overlayVisible = false;
		SetGraphVisible(false);
	}

	private void EnsureOverlayForegroundCanvas()
	{
		if (overlayRoot == null)
			return;

		if (overlayForegroundCanvas == null)
		{
			overlayForegroundCanvas = overlayRoot.GetComponent<Canvas>();
			if (overlayForegroundCanvas == null)
				overlayForegroundCanvas = overlayRoot.gameObject.AddComponent<Canvas>();
		}

		if (overlayForegroundRaycaster == null)
		{
			overlayForegroundRaycaster = overlayRoot.GetComponent<GraphicRaycaster>();
			if (overlayForegroundRaycaster == null)
				overlayForegroundRaycaster = overlayRoot.gameObject.AddComponent<GraphicRaycaster>();
		}

		Canvas referenceCanvas = ResolveOverlayForegroundReferenceCanvas();
		if (referenceCanvas == null)
			referenceCanvas = sourceCanvas;
		if (referenceCanvas == null)
			return;

		overlayForegroundCanvas.overrideSorting = true;
		overlayForegroundCanvas.sortingLayerID = referenceCanvas.sortingLayerID;
		overlayForegroundCanvas.sortingOrder = referenceCanvas.sortingOrder + OverlayForegroundSortingOrderOffset;
	}

	private Canvas ResolveOverlayForegroundReferenceCanvas()
	{
		Canvas bestCanvas = sourceCanvas;
		int bestLayerValue = bestCanvas != null ? SortingLayer.GetLayerValueFromID(bestCanvas.sortingLayerID) : int.MinValue;
		int bestSortingOrder = bestCanvas != null ? bestCanvas.sortingOrder : int.MinValue;

#if UNITY_2023_1_OR_NEWER
		Canvas[] canvases = FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
		Canvas[] canvases = FindObjectsOfType<Canvas>();
#endif
		for (int i = 0; i < canvases.Length; i++)
		{
			Canvas candidate = canvases[i];
			if (candidate == null || !candidate.isActiveAndEnabled)
				continue;

			if (overlayRoot != null && (candidate.transform == overlayRoot || candidate.transform.IsChildOf(overlayRoot)))
				continue;

			Canvas candidateRoot = candidate.rootCanvas != null ? candidate.rootCanvas : candidate;
			if (candidateRoot == null || !candidateRoot.isActiveAndEnabled)
				continue;

			if (overlayRoot != null && (candidateRoot.transform == overlayRoot || candidateRoot.transform.IsChildOf(overlayRoot)))
				continue;

			int candidateLayerValue = SortingLayer.GetLayerValueFromID(candidateRoot.sortingLayerID);
			int candidateSortingOrder = candidateRoot.sortingOrder;
			if (bestCanvas == null ||
				candidateLayerValue > bestLayerValue ||
				(candidateLayerValue == bestLayerValue && candidateSortingOrder > bestSortingOrder))
			{
				bestCanvas = candidateRoot;
				bestLayerValue = candidateLayerValue;
				bestSortingOrder = candidateSortingOrder;
			}
		}

		return bestCanvas;
	}
}
