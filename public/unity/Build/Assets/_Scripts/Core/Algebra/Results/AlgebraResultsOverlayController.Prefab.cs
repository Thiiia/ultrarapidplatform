using System.Collections.Generic;

using LeTai.Asset.TranslucentImage;

using TMPro;

using UnityEngine;
using UnityEngine.UI;

public sealed partial class AlgebraResultsOverlayController
{
	private const float PrefabPreviewWidth = 1512f;
	private const float PrefabPreviewHeight = 880f;

	private bool HasResolvedLayout()
	{
		return overlayRoot != null
			&& layoutRoot != null
			&& headerGroup != null
			&& scoreCardRoot != null
			&& accuracyPanelRoot != null
			&& statRowRoot != null
			&& buttonRowRoot != null
			&& overlayCanvasGroup != null
			&& titleText != null
			&& levelBadgeText != null
			&& scoreValueText != null
			&& pastHighScoreText != null
			&& streakChainsValueText != null
			&& maxComboValueText != null
			&& equationsSolvedValueText != null
			&& exitButton != null
			&& playAgainButton != null
			&& nextLevelButton != null
			&& trendPolyline != null
			&& trendUnderlayPolyline != null;
	}

	private void PostLayoutResolved()
	{
		if (sourceCanvas == null)
			sourceCanvas = GetComponentInParent<Canvas>();

		if (sourceCanvas != null && overlayRoot != null && ReferenceEquals(overlayRoot, transform))
			StretchOverlayRootToCanvas();

		uiCamera = dragController != null ? dragController.UICamera : (sourceCanvas != null ? sourceCanvas.worldCamera : uiCamera);
		WireButtonListeners();
		RefreshTranslucentSources();
		SyncGraphSorting();
	}

	private bool TryUseSelfAsOverlayRoot()
	{
		RectTransform selfRect = transform as RectTransform;
		if (selfRect == null)
			return false;

		if (sourceCanvas != null && ReferenceEquals(selfRect, sourceCanvas.transform))
			return false;

		overlayRoot = selfRect;
		overlayCanvasGroup = GetComponent<CanvasGroup>();
		if (overlayCanvasGroup == null)
			overlayCanvasGroup = gameObject.AddComponent<CanvasGroup>();

		if (sourceCanvas != null)
			StretchOverlayRootToCanvas();

		return true;
	}

	private void CreateOverlayRootUnderCanvas()
	{
		GameObject overlayObj = new GameObject("AlgebraResultsOverlay", typeof(RectTransform), typeof(CanvasGroup));
		overlayObj.transform.SetParent(sourceCanvas.transform, false);
		overlayObj.transform.SetAsLastSibling();
		overlayRoot = overlayObj.GetComponent<RectTransform>();
		overlayRoot.anchorMin = Vector2.zero;
		overlayRoot.anchorMax = Vector2.one;
		overlayRoot.offsetMin = Vector2.zero;
		overlayRoot.offsetMax = Vector2.zero;
		overlayCanvasGroup = overlayObj.GetComponent<CanvasGroup>();
	}

	private void BuildOverlayChildren()
	{
		dimmerImage = CreateImage("Dimmer", overlayRoot, overlayDimColor);
		RectTransform dimmerRect = dimmerImage.rectTransform;
		dimmerRect.anchorMin = Vector2.zero;
		dimmerRect.anchorMax = Vector2.one;
		dimmerRect.offsetMin = Vector2.zero;
		dimmerRect.offsetMax = Vector2.zero;
		dimmerImage.raycastTarget = true;

		layoutRoot = CreateRect("LayoutRoot", overlayRoot);
		layoutRoot.anchorMin = new Vector2(0.5f, 0.5f);
		layoutRoot.anchorMax = new Vector2(0.5f, 0.5f);
		layoutRoot.pivot = new Vector2(0.5f, 0.5f);
		layoutRoot.sizeDelta = new Vector2(ReferenceLayoutWidth, ReferenceLayoutHeight);
		layoutRoot.anchoredPosition = new Vector2(0f, -6f);

		headerCanvasGroup = AddCanvasGroup(CreateRect("HeaderGroup", layoutRoot));
		scoreCanvasGroup = AddCanvasGroup(CreateRect("ScoreGroup", layoutRoot));
		accuracyCanvasGroup = AddCanvasGroup(CreateRect("AccuracyGroup", layoutRoot));
		statsCanvasGroup = AddCanvasGroup(CreateRect("StatsGroup", layoutRoot));
		buttonsCanvasGroup = AddCanvasGroup(CreateRect("ButtonsGroup", layoutRoot));

		headerGroup = headerCanvasGroup.GetComponent<RectTransform>();
		scoreCardRoot = scoreCanvasGroup.GetComponent<RectTransform>();
		accuracyPanelRoot = accuracyCanvasGroup.GetComponent<RectTransform>();
		statRowRoot = statsCanvasGroup.GetComponent<RectTransform>();
		buttonRowRoot = buttonsCanvasGroup.GetComponent<RectTransform>();

		BuildHeader();
		BuildScoreCard();
		BuildAccuracyPanel();
		BuildStatCards();
		BuildButtons();
		EnsureGraphPolyline();
	}

	private void SetHiddenStateImmediate()
	{
		overlayVisible = false;

		if (overlayCanvasGroup != null)
		{
			overlayCanvasGroup.alpha = 0f;
			overlayCanvasGroup.blocksRaycasts = false;
			overlayCanvasGroup.interactable = false;
		}

		SetGroupAlpha(headerCanvasGroup, 0f);
		SetGroupAlpha(scoreCanvasGroup, 0f);
		SetGroupAlpha(accuracyCanvasGroup, 0f);
		SetGroupAlpha(statsCanvasGroup, 0f);
		SetGroupAlpha(buttonsCanvasGroup, 0f);
		SetGraphVisible(false);
	}

	private void SetPreviewVisibleState()
	{
		if (overlayCanvasGroup != null)
		{
			overlayCanvasGroup.alpha = 1f;
			overlayCanvasGroup.blocksRaycasts = false;
			overlayCanvasGroup.interactable = false;
		}

		SetGroupAlpha(headerCanvasGroup, 1f);
		SetGroupAlpha(scoreCanvasGroup, 1f);
		SetGroupAlpha(accuracyCanvasGroup, 1f);
		SetGroupAlpha(statsCanvasGroup, 1f);
		SetGroupAlpha(buttonsCanvasGroup, 1f);
		SetGraphVisible(true);
	}

	private void SetGraphVisible(bool visible)
	{
		if (trendUnderlayPolyline != null)
			trendUnderlayPolyline.gameObject.SetActive(visible);
		if (trendPolyline != null)
			trendPolyline.gameObject.SetActive(visible);
	}

	private void StretchOverlayRootToCanvas()
	{
		if (overlayRoot == null)
			return;

		overlayRoot.anchorMin = Vector2.zero;
		overlayRoot.anchorMax = Vector2.one;
		overlayRoot.offsetMin = Vector2.zero;
		overlayRoot.offsetMax = Vector2.zero;
		overlayRoot.pivot = new Vector2(0.5f, 0.5f);
		overlayRoot.localScale = Vector3.one;
		overlayRoot.anchoredPosition = Vector2.zero;
	}

	private void WireButtonListeners()
	{
		if (exitButton != null)
		{
			exitButton.onClick.RemoveListener(ReturnToLevelSelect);
			exitButton.onClick.AddListener(ReturnToLevelSelect);
		}

		if (playAgainButton != null)
		{
			playAgainButton.onClick.RemoveListener(PlayAgain);
			playAgainButton.onClick.AddListener(PlayAgain);
		}

		if (nextLevelButton != null)
		{
			nextLevelButton.onClick.RemoveListener(ReturnToLevelSelect);
			nextLevelButton.onClick.AddListener(ReturnToLevelSelect);
		}
	}

	private void RefreshTranslucentSources()
	{
		if (overlayRoot == null || translucentSource == null)
			return;

		TranslucentImage[] translucentImages = overlayRoot.GetComponentsInChildren<TranslucentImage>(true);
		for (int i = 0; i < translucentImages.Length; i++)
		{
			TranslucentImage image = translucentImages[i];
			if (image != null)
				image.source = translucentSource;
		}
	}

	private bool TryBindExistingLayout()
	{
		RectTransform selfRect = transform as RectTransform;
		if (selfRect == null)
			return false;

		overlayRoot = selfRect;
		overlayCanvasGroup = GetComponent<CanvasGroup>();
		if (overlayCanvasGroup == null)
			return false;

		dimmerImage = FindComponentInChildren<Image>("Dimmer");
		layoutRoot = FindComponentInChildren<RectTransform>("LayoutRoot");
		headerGroup = FindComponentInChildren<RectTransform>("LayoutRoot/HeaderGroup");
		scoreCardRoot = FindComponentInChildren<RectTransform>("LayoutRoot/ScoreGroup");
		accuracyPanelRoot = FindComponentInChildren<RectTransform>("LayoutRoot/AccuracyGroup");
		statRowRoot = FindComponentInChildren<RectTransform>("LayoutRoot/StatsGroup");
		buttonRowRoot = FindComponentInChildren<RectTransform>("LayoutRoot/ButtonsGroup");
		headerCanvasGroup = headerGroup != null ? headerGroup.GetComponent<CanvasGroup>() : null;
		scoreCanvasGroup = scoreCardRoot != null ? scoreCardRoot.GetComponent<CanvasGroup>() : null;
		accuracyCanvasGroup = accuracyPanelRoot != null ? accuracyPanelRoot.GetComponent<CanvasGroup>() : null;
		statsCanvasGroup = statRowRoot != null ? statRowRoot.GetComponent<CanvasGroup>() : null;
		buttonsCanvasGroup = buttonRowRoot != null ? buttonRowRoot.GetComponent<CanvasGroup>() : null;

		titleText = FindComponentInChildren<TMP_Text>("LayoutRoot/HeaderGroup/ResultsTitle");
		levelBadgeText = FindComponentInChildren<TMP_Text>("LayoutRoot/HeaderGroup/LevelBadge/LevelBadgeText");
		exitButton = FindComponentInChildren<Button>("LayoutRoot/HeaderGroup/ExitButton");

		heroGlowGraphic = FindComponentInChildren<Graphic>("LayoutRoot/ScoreGroup/ScoreCard/AccentGlow");
		newBestBadge = FindGameObjectInChildren("LayoutRoot/ScoreGroup/ScoreCard/NewBestBadge");
		scoreValueText = FindComponentInChildren<TMP_Text>("LayoutRoot/ScoreGroup/ScoreCard/ScoreValue");
		pastHighScoreText = FindComponentInChildren<TMP_Text>("LayoutRoot/ScoreGroup/ScoreCard/PastHighScore/PastHighScoreValue");

		graphRoot = FindComponentInChildren<RectTransform>("LayoutRoot/AccuracyGroup/AccuracyPanel/GraphRoot");
		trendUnderlayPolyline = FindComponentInChildren<Shapes.Polyline>("LayoutRoot/AccuracyGroup/AccuracyPanel/GraphRoot/TrendPolylineUnderlay");
		trendPolyline = FindComponentInChildren<Shapes.Polyline>("LayoutRoot/AccuracyGroup/AccuracyPanel/GraphRoot/TrendPolyline");
		graphGridLines.Clear();
		for (int i = 0; i < 3; i++)
		{
			Image line = FindComponentInChildren<Image>($"LayoutRoot/AccuracyGroup/AccuracyPanel/GraphRoot/GridLine_{i}");
			if (line != null)
				graphGridLines.Add(line);
		}

		BindRowWidgets(ref perfectRow, "LayoutRoot/AccuracyGroup/AccuracyPanel/PerfectRow");
		BindRowWidgets(ref goodRow, "LayoutRoot/AccuracyGroup/AccuracyPanel/GoodRow");
		BindRowWidgets(ref earlyRow, "LayoutRoot/AccuracyGroup/AccuracyPanel/EarlyRow");
		BindRowWidgets(ref lateRow, "LayoutRoot/AccuracyGroup/AccuracyPanel/LateRow");

		streakChainsValueText = FindComponentInChildren<TMP_Text>("LayoutRoot/StatsGroup/StreaksCard/StreaksValue");
		maxComboValueText = FindComponentInChildren<TMP_Text>("LayoutRoot/StatsGroup/MaxComboCard/MaxComboValue");
		equationsSolvedValueText = FindComponentInChildren<TMP_Text>("LayoutRoot/StatsGroup/EquationsSolvedCard/EquationsSolvedValue");

		playAgainButton = FindComponentInChildren<Button>("LayoutRoot/ButtonsGroup/PlayAgainButton");
		nextLevelButton = FindComponentInChildren<Button>("LayoutRoot/ButtonsGroup/NextLevelButton");

		return HasResolvedLayout();
	}

	private void BindRowWidgets(ref RowWidgets row, string rowPath)
	{
		if (row == null)
			row = new RowWidgets();

		string rowObjectName = GetLeafName(rowPath);
		string prefix = rowObjectName.EndsWith("Row") ? rowObjectName.Substring(0, rowObjectName.Length - 3) : rowObjectName;
		row.countText = FindComponentInChildren<TMP_Text>($"{rowPath}/{prefix}Count");
		row.fillRect = FindComponentInChildren<RectTransform>($"{rowPath}/{prefix}Track/{prefix}FillRoot");
		row.fillImage = FindComponentInChildren<Image>($"{rowPath}/{prefix}Track/{prefix}FillRoot/{prefix}Fill");
	}

	private T FindComponentInChildren<T>(string relativePath) where T : Component
	{
		if (overlayRoot == null || string.IsNullOrWhiteSpace(relativePath))
			return null;

		Transform child = overlayRoot.Find(relativePath);
		return child != null ? child.GetComponent<T>() : null;
	}

	private GameObject FindGameObjectInChildren(string relativePath)
	{
		if (overlayRoot == null || string.IsNullOrWhiteSpace(relativePath))
			return null;

		Transform child = overlayRoot.Find(relativePath);
		return child != null ? child.gameObject : null;
	}

	private static string GetLeafName(string path)
	{
		int lastSlash = path.LastIndexOf('/');
		return lastSlash >= 0 ? path.Substring(lastSlash + 1) : path;
	}

#if UNITY_EDITOR
	public void RebuildPrefabLayoutForEditor()
	{
		ClearEditorLayout();
		fontAsset = ResolveFontAsset();
		translucentSource = ResolveTranslucentSource();
		sourceCanvas = null;
		uiCamera = null;

		overlayRoot = transform as RectTransform;
		if (overlayRoot == null)
			overlayRoot = gameObject.AddComponent<RectTransform>();

		overlayRoot.anchorMin = new Vector2(0.5f, 0.5f);
		overlayRoot.anchorMax = new Vector2(0.5f, 0.5f);
		overlayRoot.pivot = new Vector2(0.5f, 0.5f);
		overlayRoot.sizeDelta = new Vector2(PrefabPreviewWidth, PrefabPreviewHeight);
		overlayRoot.anchoredPosition = Vector2.zero;
		overlayRoot.localScale = Vector3.one;

		overlayCanvasGroup = GetComponent<CanvasGroup>();
		if (overlayCanvasGroup == null)
			overlayCanvasGroup = gameObject.AddComponent<CanvasGroup>();

		BuildOverlayChildren();
		ApplySnapshot(BuildPreviewSnapshot());
		SetPreviewVisibleState();
	}

	private void ClearEditorLayout()
	{
		ClearResolvedReferences();
		graphGridLines.Clear();

		for (int i = transform.childCount - 1; i >= 0; i--)
		{
			Transform child = transform.GetChild(i);
			UnityEditor.Undo.DestroyObjectImmediate(child.gameObject);
		}
	}

	private void ClearResolvedReferences()
	{
		overlayRoot = null;
		layoutRoot = null;
		headerGroup = null;
		scoreCardRoot = null;
		statRowRoot = null;
		accuracyPanelRoot = null;
		buttonRowRoot = null;
		graphRoot = null;
		overlayCanvasGroup = null;
		headerCanvasGroup = null;
		scoreCanvasGroup = null;
		accuracyCanvasGroup = null;
		statsCanvasGroup = null;
		buttonsCanvasGroup = null;
		dimmerImage = null;
		heroGlowGraphic = null;
		newBestBadge = null;
		titleText = null;
		levelBadgeText = null;
		scoreValueText = null;
		pastHighScoreText = null;
		streakChainsValueText = null;
		maxComboValueText = null;
		equationsSolvedValueText = null;
		exitButton = null;
		playAgainButton = null;
		nextLevelButton = null;
		trendPolyline = null;
		trendUnderlayPolyline = null;
		perfectRow = null;
		goodRow = null;
		earlyRow = null;
		lateRow = null;
	}

	private AlgebraResultsSnapshot BuildPreviewSnapshot()
	{
		return new AlgebraResultsSnapshot
		{
			sceneKey = "AlgebraEquations SK Tag",
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
			trendSamples = new List<float> { 0.88f, 0.74f, 0.90f, 0.79f, 0.84f, 0.28f, 0.86f, 0.76f, 0.12f, 0.92f, 0.34f, 0.86f, 0.26f, 0.90f }
		};
	}
#endif
}
