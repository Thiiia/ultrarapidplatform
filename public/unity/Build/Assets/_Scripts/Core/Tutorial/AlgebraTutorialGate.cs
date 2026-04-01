using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;

public class AlgebraTutorialGate : MonoBehaviour
{
	private static bool skipGateOnceForNextSceneLoad;

	private enum FirstRunLaunchMode
	{
		ShortTutorial = 0,
		LongTutorial = 1
	}

	private enum TutorialCopyAgeBand
	{
		Years5To6 = 0,
		Years7To9 = 1,
		Years10To12 = 2
	}

	private struct TutorialCopyContent
	{
		public string title;
		public string highlightLine;
		public string ruleLine;
		public string summaryLine;
	}

	[SerializeField] private string algebraTutorialSeenPrefKey = "AlgebraTutorialCompleted";
	private const string MainTutorialSeenPrefKey = "TutorialCompleted";

	[ContextMenu("Reset Algebra Tutorial Flag")]
	private void ResetAlgebraTutorialFlagContextMenu()
	{
		ResetAlgebraTutorialFlag(algebraTutorialSeenPrefKey);
	}

	public static void ResetAlgebraTutorialFlag(string prefKey = "AlgebraTutorialCompleted")
	{
		PlayerPrefs.DeleteKey(prefKey);
		PlayerPrefs.Save();
	}

	private static bool GetBoolPref(string key)
	{
		return PlayerPrefs.GetInt(key, 0) == 1;
	}

	private bool HasSeenMainTutorial()
	{
		return GetBoolPref(MainTutorialSeenPrefKey);
	}

	private bool HasSeenAlgebraTutorial()
	{
		return GetBoolPref(algebraTutorialSeenPrefKey);
	}

	private void MarkShortTutorialGateAsSeen()
	{
		if (!HasSeenMainTutorial())
		{
			PlayerPrefs.SetInt(MainTutorialSeenPrefKey, 1);
		}

		PlayerPrefs.SetInt(algebraTutorialSeenPrefKey, 1);
		PlayerPrefs.Save();
	}

	private void ResumeGameplayAfterGateStart()
	{
		if (inGameScoreDisplay != null)
		{
			inGameScoreDisplay.ResumeFromTutorial();
		}
		else if (AudioManager.Instance != null)
		{
			AudioManager.Instance.ResumeSong();
		}
	}

	private static void TryStartGameplayAudioFromUserGesture()
	{
		if (AudioManager.Instance == null || AudioManager.Instance.HasSongStarted)
		{
			return;
		}

		if (!AudioManager.AudioUnlocked)
		{
			AudioManager.UnlockFromUserGesture(attemptScheduleMusic: true);
			return;
		}

		AudioManager.Instance.SchedulePlaybackNow();
	}

	[Header("How-To Toggle")]
	[SerializeField] private GameObject howToButtonObject;
	[SerializeField] private string howToButtonObjectName = "? How to";
	[SerializeField] private bool autoWireHowToButton = true;
	[SerializeField] private string howToButtonLabel = "Tutorial";

	[Header("Scene Navigation")]
	[SerializeField] private string primaryLevelSelectSceneName = "LevelSelectScene";
	[SerializeField] private string fallbackLevelSelectSceneName = "Level Select";

	[Header("UI (child object names)")]
	[SerializeField] private string startPlayingObjectName = "Start Playing";
	[SerializeField] private string startShortObjectName = string.Empty;
	[SerializeField] private string startLongObjectName = string.Empty;
	[SerializeField] private string exitObjectName = "Exit";

	[Header("Gameplay (optional)")]
	[SerializeField] private InGameScoreDisplay inGameScoreDisplay;
	[SerializeField] private DragExecutionController dragExecutionController;

	[Header("Behavior")]
	[SerializeField] private bool showIfNotSeen = true;
	[SerializeField] private bool showIfWebGlAudioLocked = true;
	[SerializeField] private bool alwaysShowShortGateAfterFirstRun = true;
	[SerializeField] private bool allowContextualAutoOpen = false;
	[SerializeField] private FirstRunLaunchMode firstRunLaunchMode = FirstRunLaunchMode.LongTutorial;
	[SerializeField] private bool disableLongTutorialTemporarily = true;

	[Header("Adaptive Tutorial Copy")]
	[SerializeField] private bool adaptCopyToSelectedYear = true;
	[SerializeField] private TextMeshProUGUI tutorialTitleText;
	[SerializeField] private TextMeshProUGUI tutorialHighlightText;
	[SerializeField] private TextMeshProUGUI tutorialRuleText;
	[SerializeField] private TextMeshProUGUI tutorialSummaryText;

	[Header("Responsive Panel")]
	[SerializeField] private bool autoFitPanelToCanvas = true;
	[SerializeField] private Vector2 panelReferenceSize = new Vector2(1250f, 450f);
	[SerializeField, Range(0.5f, 1f)] private float panelMinScale = 0.72f;
	[SerializeField, Min(0.5f)] private float panelMaxScale = 1f;

	private bool _gateVisible;
	public bool IsGateVisible => _gateVisible;
	private RectTransform panelRect;
	private RectTransform parentCanvasRect;
	private Vector3 defaultPanelScale = Vector3.one;
	private bool hasAppliedAdaptiveCopy;
	private bool loggedAdaptiveCopyResolveWarning;
	private EquationDataSet.SchoolYear lastAdaptiveCopyYear = EquationDataSet.SchoolYear.Year7;
	private bool gateSuppressedJourneyGuidance;
	private bool gateSuppressedJourneyGuidancePrevious;
	private bool gatePreemptedStartupSuppression;
	private bool skipGateForThisSceneInstance;

	/// <summary>
	/// One-shot bypass for scene reloads (e.g. manual restart / post-tutorial handoff)
	/// where we want to land directly back in gameplay instead of re-showing the gate.
	/// </summary>
	public static void SkipGateOnceForNextSceneReload()
	{
		skipGateOnceForNextSceneLoad = true;
	}

	private void Awake()
	{
		if (skipGateOnceForNextSceneLoad)
		{
			skipGateForThisSceneInstance = true;
			skipGateOnceForNextSceneLoad = false;
		}

		panelRect = transform as RectTransform;
		if (panelRect != null)
		{
			defaultPanelScale = panelRect.localScale;
		}

		if (inGameScoreDisplay == null)
		{
			inGameScoreDisplay = FindFirstObjectByType<InGameScoreDisplay>();
		}

		if (dragExecutionController == null)
		{
			dragExecutionController = FindFirstObjectByType<DragExecutionController>(FindObjectsInactive.Include);
		}

		if (howToButtonObject == null && !string.IsNullOrWhiteSpace(howToButtonObjectName))
		{
			howToButtonObject = ResolveHowToButtonObject();
		}

		EnsureWiredButtons();
		EnsureHowToButtonLabel();
		RefreshTutorialCopyForSelectedYear(force: true);
		ResolveCanvasRect();
		ApplyResponsivePanelScale();

		// Preempt gameplay/audio startup before Start()-order races can schedule playback
		// ahead of the gate (especially on first scene entry / WebGL).
		if (ShouldShowGate())
		{
			PreemptGameplayStartupForGate();
		}
	}

	private void Start()
	{
		if (ShouldShowGate())
		{
			ShowGate();
		}
		else
		{
			HideGate();
		}
	}

	private void Update()
	{
		if (!_gateVisible || !adaptCopyToSelectedYear)
		{
			return;
		}

		RefreshTutorialCopyForSelectedYear();
	}

	private bool ShouldShowGate()
	{
		if (skipGateForThisSceneInstance)
		{
			return false;
		}

		// Main tutorial completion is the source of truth for first-run onboarding.
		bool hasSeenMainTutorial = HasSeenMainTutorial();

		if (!hasSeenMainTutorial)
			return showIfNotSeen;

		// Requested flow: after first completion, always show the short gate first.
		if (alwaysShowShortGateAfterFirstRun)
			return true;

		// Keep the algebra-specific completion bit for backward compatibility with
		// existing saves and UI toggles.
		bool hasSeenAlgebraTutorial = HasSeenAlgebraTutorial();
		if (!hasSeenAlgebraTutorial)
			return showIfNotSeen;

		if (showIfWebGlAudioLocked
			&& Application.platform == RuntimePlatform.WebGLPlayer
			&& !AudioManager.AudioUnlocked)
		{
			return true;
		}

		return false;
	}

	private void ShowGate()
	{
		SetGateVisible(true);
		ApplyTutorialOverlayGameplayVisualSuppression(enable: true);
		RefreshTutorialCopyForSelectedYear();
		ApplyResponsivePanelScale();

		// Ensure ChartSystem doesn't auto-schedule and keep the beat clock frozen until the user starts.
		AudioManager.SuppressNextAutoStart();

		if (inGameScoreDisplay != null && AudioManager.Instance != null)
		{
			inGameScoreDisplay.PauseForTutorial();
		}
		else if (AudioManager.Instance != null)
		{
			AudioManager.Instance.PauseSong();
		}
	}

	private void HideGate()
	{
		ApplyTutorialOverlayGameplayVisualSuppression(enable: false);
		SetGateVisible(false);
	}

	// Hide the gate UI while handing control to the long tutorial without restoring the
	// pre-gate gameplay guidance state. EquationTutorialController now owns suppression.
	private void HideGateForLongTutorialLaunch()
	{
		SetGateVisible(false);
		gateSuppressedJourneyGuidance = false;
		gateSuppressedJourneyGuidancePrevious = false;
	}

	private void SetGateVisible(bool visible)
	{
		_gateVisible = visible;

		// Toggle all children (the actual tutorial UI panel). If the How-to button is under
		// this object for some reason, exclude it so it can remain a toggle entry point.
		for (int i = 0; i < transform.childCount; i++)
		{
			Transform child = transform.GetChild(i);
			if (howToButtonObject != null && child.gameObject == howToButtonObject)
				continue;
			if (!string.IsNullOrWhiteSpace(howToButtonObjectName) && child.name == howToButtonObjectName)
				continue;

			child.gameObject.SetActive(visible);
		}

		SetHowToButtonVisible(!visible);
	}

	private void SetHowToButtonVisible(bool visible)
	{
		if (howToButtonObject != null)
			howToButtonObject.SetActive(visible);
	}

	private void EnsureWiredButtons()
	{
		EnsureButton(startPlayingObjectName, OnStartPlayingPressed);
		EnsureButton(startShortObjectName, OnStartShortTutorialPressed);
		EnsureButton(startLongObjectName, OnStartLongTutorialPressed);
		EnsureButton(exitObjectName, OnExitPressed);

		if (howToButtonObject == null && !string.IsNullOrWhiteSpace(howToButtonObjectName))
		{
			howToButtonObject = ResolveHowToButtonObject();
		}

		if (autoWireHowToButton && howToButtonObject != null)
		{
			EnsureButtonOnObject(howToButtonObject, OnHowToPressed);
		}
	}

	private void EnsureButton(string childName, UnityEngine.Events.UnityAction handler)
	{
		if (string.IsNullOrWhiteSpace(childName))
			return;

		Transform child = FindDescendantByName(transform, childName);
		if (child == null)
		{
			Debug.LogWarning($"[AlgebraTutorialGate] Could not find child '{childName}' under '{name}'.");
			return;
		}

		Button button = child.GetComponent<Button>();
		if (button == null)
			button = child.gameObject.AddComponent<Button>();

		Graphic graphic = child.GetComponent<Graphic>();
		if (button.targetGraphic == null && graphic != null)
			button.targetGraphic = graphic;

		button.transition = Selectable.Transition.None;
		button.onClick.RemoveListener(handler);
		button.onClick.AddListener(handler);
	}

	private void EnsureButtonOnObject(GameObject go, UnityEngine.Events.UnityAction handler)
	{
		if (go == null)
			return;

		Button button = go.GetComponent<Button>();
		if (button == null)
			button = go.AddComponent<Button>();

		Graphic graphic = go.GetComponent<Graphic>();
		if (button.targetGraphic == null && graphic != null)
			button.targetGraphic = graphic;

		button.onClick.RemoveListener(handler);
		button.onClick.AddListener(handler);
	}

	private void EnsureHowToButtonLabel()
	{
		if (howToButtonObject == null || string.IsNullOrWhiteSpace(howToButtonLabel))
		{
			return;
		}

		TextMeshProUGUI label = howToButtonObject.GetComponentInChildren<TextMeshProUGUI>(true);
		if (label == null)
		{
			GameObject labelObj = new GameObject("Label (TMP)", typeof(RectTransform), typeof(TextMeshProUGUI));
			labelObj.transform.SetParent(howToButtonObject.transform, false);

			RectTransform rect = labelObj.GetComponent<RectTransform>();
			rect.anchorMin = Vector2.zero;
			rect.anchorMax = Vector2.one;
			rect.offsetMin = Vector2.zero;
			rect.offsetMax = Vector2.zero;

			label = labelObj.GetComponent<TextMeshProUGUI>();
		}

		label.text = howToButtonLabel;
		label.alignment = TextAlignmentOptions.Center;
		label.enableAutoSizing = false;
		label.fontSize = 26f;
		label.fontStyle = FontStyles.Bold;
		label.color = new Color(0.93f, 0.93f, 0.93f, 1f);
		label.raycastTarget = false;
	}

	public void OnStartPlayingPressed()
	{
		if (disableLongTutorialTemporarily)
		{
			StartShortTutorial();
			return;
		}

		bool hasSeenMainTutorial = HasSeenMainTutorial();
		if (!hasSeenMainTutorial && firstRunLaunchMode == FirstRunLaunchMode.LongTutorial)
		{
			StartLongTutorial();
			return;
		}

		StartShortTutorial();
	}

	public void OnStartShortTutorialPressed()
	{
		StartShortTutorial();
	}

	public void OnStartLongTutorialPressed()
	{
		if (disableLongTutorialTemporarily)
		{
			StartShortTutorial();
			return;
		}

		StartLongTutorial();
	}

	private void StartShortTutorial()
	{
		MarkShortTutorialGateAsSeen();

		// Clear any "pause before playback" intent so scheduling doesn't instantly pause.
		ResumeGameplayAfterGateStart();

		// This click counts as a user gesture (important for WebGL). Start the song/game now.
		TryStartGameplayAudioFromUserGesture();

		// Only reveal / unsuppress gameplay visuals after audio start has been requested.
		// This avoids wisp guidance spinning up on fallback timing before the song is scheduled.
		HideGate();
	}

	private void StartLongTutorial()
	{
		if (disableLongTutorialTemporarily)
		{
			if (_gateVisible)
			{
				StartShortTutorial();
			}
			else
			{
				OpenFullOverlayInternal();
			}
			return;
		}

		// Use the same replay path for first-run and replay. The previous first-run-only path
		// is what was intermittently breaking while the How-To replay path worked.
		ResetAlgebraTutorialFlag(algebraTutorialSeenPrefKey);
		EquationTutorialController.PrepareForRuntimeReplay();
		HideGateForLongTutorialLaunch();
		TutorialManager.RequestTutorialReplay();
	}

	public void OnHowToPressed()
	{
		if (disableLongTutorialTemporarily)
		{
			OpenFullOverlayInternal();
			return;
		}

		// After first run, the tutorial button should launch the long tutorial replay.
		if (HasSeenMainTutorial())
		{
			StartLongTutorial();
			return;
		}

		OpenFullOverlayInternal();
	}

	/// <summary>
	/// External entry point for buttons that should always reopen the short tutorial gate.
	/// </summary>
	public void OpenShortTutorialOverlay()
	{
		OpenFullOverlayInternal();
	}

	/// <summary>
	/// Backward-compatible alias for existing callers that expect the short tutorial gate.
	/// </summary>
	public void OpenTutorialOverlayFromExternalHowTo()
	{
		OpenShortTutorialOverlay();
	}

	public bool TryOpenOverlayFromContextualTrigger()
	{
		if (!allowContextualAutoOpen)
		{
			return false;
		}

		if (_gateVisible)
		{
			return false;
		}

		OpenFullOverlayInternal();
		return true;
	}

	public void OnExitPressed()
	{
		PrepareSessionForLevelSelect();

		// Keep tutorial as "not completed" so it will show again next time if they backed out.
		string levelSelect = ResolveLevelSelectSceneName();
		if (!string.IsNullOrEmpty(levelSelect))
		{
			SceneManager.LoadScene(levelSelect);
		}
		else
		{
			Debug.LogWarning("[AlgebraTutorialGate] Could not resolve a Level Select scene name to load.");
		}
	}

	private static void PrepareSessionForLevelSelect()
	{
		ChartSystem chartSystem = FindFirstObjectByType<ChartSystem>();
		if (chartSystem != null)
		{
			chartSystem.ResetLoaderState();
		}

		if (AudioManager.Instance != null)
		{
			AudioManager.Instance.RestartSong();
		}
	}

	private void PreemptGameplayStartupForGate()
	{
		if (gatePreemptedStartupSuppression)
		{
			return;
		}

		gatePreemptedStartupSuppression = true;

		// This sets the static one-shot suppression flag even if AudioManager hasn't
		// initialized yet, and also marks the current instance suppressed when present.
		AudioManager.SuppressNextAutoStart();

		// If gameplay objects already exist, hide guidance immediately so the player
		// doesn't see beat-driven/path visuals animate behind the gate.
		ApplyTutorialOverlayGameplayVisualSuppression(enable: true);

		// Pre-arm a pause in case something schedules before the gate is fully shown.
		// InGameScoreDisplay path also pauses camera movement.
		if (inGameScoreDisplay != null && AudioManager.Instance != null)
		{
			inGameScoreDisplay.PauseForTutorial();
		}
		else if (AudioManager.Instance != null)
		{
			AudioManager.Instance.PauseSong();
		}
	}

	private static Transform FindDescendantByName(Transform root, string targetName)
	{
		if (root == null || string.IsNullOrWhiteSpace(targetName))
			return null;

		// Includes inactive objects.
		Transform[] all = root.GetComponentsInChildren<Transform>(includeInactive: true);
		for (int i = 0; i < all.Length; i++)
		{
			Transform t = all[i];
			if (t != null && t.name == targetName)
				return t;
		}

		return null;
	}

	private GameObject ResolveHowToButtonObject()
	{
		Transform local = FindDescendantByName(transform, howToButtonObjectName);
		if (local != null)
		{
			return local.gameObject;
		}

		Canvas canvas = GetComponentInParent<Canvas>(true);
		if (canvas != null)
		{
			Transform fromCanvas = FindDescendantByName(canvas.transform, howToButtonObjectName);
			if (fromCanvas != null)
			{
				return fromCanvas.gameObject;
			}
		}

		Transform fromRoot = FindDescendantByName(transform.root, howToButtonObjectName);
		return fromRoot != null ? fromRoot.gameObject : null;
	}

	private void OpenFullOverlayInternal()
	{
		if (_gateVisible)
		{
			return;
		}

		ShowGate();
	}

	private void OnRectTransformDimensionsChange()
	{
		ApplyResponsivePanelScale();
	}

	private void ResolveCanvasRect()
	{
		if (parentCanvasRect != null)
		{
			return;
		}

		Canvas canvas = GetComponentInParent<Canvas>(true);
		if (canvas != null)
		{
			parentCanvasRect = canvas.transform as RectTransform;
		}
	}

	private void ApplyResponsivePanelScale()
	{
		if (panelRect == null)
		{
			return;
		}

		if (!autoFitPanelToCanvas)
		{
			panelRect.localScale = defaultPanelScale;
			return;
		}

		ResolveCanvasRect();
		if (parentCanvasRect == null || panelReferenceSize.x <= 0f || panelReferenceSize.y <= 0f)
		{
			return;
		}

		float widthScale = parentCanvasRect.rect.width / panelReferenceSize.x;
		float heightScale = parentCanvasRect.rect.height / panelReferenceSize.y;
		float uniformScale = Mathf.Clamp(Mathf.Min(widthScale, heightScale), panelMinScale, panelMaxScale);
		panelRect.localScale = defaultPanelScale * uniformScale;
	}

	private string ResolveLevelSelectSceneName()
	{
		if (!string.IsNullOrEmpty(primaryLevelSelectSceneName) && Application.CanStreamedLevelBeLoaded(primaryLevelSelectSceneName))
			return primaryLevelSelectSceneName;

		if (!string.IsNullOrEmpty(fallbackLevelSelectSceneName) && Application.CanStreamedLevelBeLoaded(fallbackLevelSelectSceneName))
			return fallbackLevelSelectSceneName;

		return null;
	}

	private void ApplyTutorialOverlayGameplayVisualSuppression(bool enable)
	{
		if (dragExecutionController == null)
		{
			dragExecutionController = FindFirstObjectByType<DragExecutionController>(FindObjectsInactive.Include);
		}

		if (dragExecutionController == null)
		{
			return;
		}

		if (enable)
		{
			if (!gateSuppressedJourneyGuidance)
			{
				gateSuppressedJourneyGuidancePrevious = dragExecutionController.SuppressJourneyGuidance;
				gateSuppressedJourneyGuidance = true;
			}

			dragExecutionController.SuppressJourneyGuidance = true;
			dragExecutionController.HideWispGuidanceVisualsImmediate();
			return;
		}

		if (!gateSuppressedJourneyGuidance)
		{
			return;
		}

		dragExecutionController.SuppressJourneyGuidance = gateSuppressedJourneyGuidancePrevious;
		gateSuppressedJourneyGuidance = false;

		if (!dragExecutionController.SuppressJourneyGuidance)
		{
			dragExecutionController.RequestJourneyGuidanceRefresh();
		}
	}

	private void RefreshTutorialCopyForSelectedYear(bool force = false)
	{
		if (!adaptCopyToSelectedYear)
		{
			return;
		}

		EquationDataSet.SchoolYear selectedYear = AlgebraRuntimeConfig.CurrentSchoolYear;
		if (!force && hasAppliedAdaptiveCopy && lastAdaptiveCopyYear == selectedYear)
		{
			return;
		}

		EnsureTutorialCopyTextReferences();
		if (tutorialTitleText == null || tutorialHighlightText == null || tutorialRuleText == null || tutorialSummaryText == null)
		{
			if (!loggedAdaptiveCopyResolveWarning)
			{
				Debug.LogWarning("[AlgebraTutorialGate] Adaptive tutorial copy could not resolve all TMP text references. Assign them in the inspector to enable year-based copy.");
				loggedAdaptiveCopyResolveWarning = true;
			}

			return;
		}

		TutorialCopyContent copy = GetTutorialCopyForYear(selectedYear);
		tutorialTitleText.text = copy.title;
		tutorialHighlightText.text = copy.highlightLine;
		tutorialRuleText.text = copy.ruleLine;
		tutorialSummaryText.text = copy.summaryLine;

		lastAdaptiveCopyYear = selectedYear;
		hasAppliedAdaptiveCopy = true;
	}

	private void EnsureTutorialCopyTextReferences()
	{
		if (tutorialTitleText != null && tutorialHighlightText != null && tutorialRuleText != null && tutorialSummaryText != null)
		{
			return;
		}

		TextMeshProUGUI[] textFields = GetComponentsInChildren<TextMeshProUGUI>(includeInactive: true);
		for (int i = 0; i < textFields.Length; i++)
		{
			TextMeshProUGUI tmp = textFields[i];
			if (tmp == null)
			{
				continue;
			}

			string currentText = tmp.text ?? string.Empty;
			if (tutorialTitleText == null && (ContainsIgnoreCase(currentText, "HOW TO SOLVE FOR X") || ContainsIgnoreCase(currentText, "HOW TO FIND x") || ContainsIgnoreCase(currentText, "HOW TO SOLVE FOR x")))
			{
				tutorialTitleText = tmp;
				continue;
			}

			if (tutorialHighlightText == null && (ContainsIgnoreCase(currentText, "get X by itself") || ContainsIgnoreCase(currentText, "get x by itself") || ContainsIgnoreCase(currentText, "opposite operation")))
			{
				tutorialHighlightText = tmp;
				continue;
			}

			if (tutorialRuleText == null && (ContainsIgnoreCase(currentText, "crosses the = sign") || ContainsIgnoreCase(currentText, "operation symbol flips") || ContainsIgnoreCase(currentText, "operation symbol inverts") || ContainsIgnoreCase(currentText, "keep it balanced")))
			{
				tutorialRuleText = tmp;
				continue;
			}

			if (tutorialSummaryText == null && (ContainsIgnoreCase(currentText, "Solve the equation") || ContainsIgnoreCase(currentText, "Isolate X") || ContainsIgnoreCase(currentText, "Isolate x")))
			{
				tutorialSummaryText = tmp;
			}
		}
	}

	private static bool ContainsIgnoreCase(string source, string value)
	{
		if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(value))
		{
			return false;
		}

		return source.IndexOf(value, StringComparison.OrdinalIgnoreCase) >= 0;
	}

	private static TutorialCopyContent GetTutorialCopyForYear(EquationDataSet.SchoolYear year)
	{
		switch (GetTutorialCopyAgeBand(year))
		{
			case TutorialCopyAgeBand.Years5To6:
				return new TutorialCopyContent
				{
					title = "HOW TO FIND X",
					highlightLine = "<color=#E2FF00>Get X by itself using the opposite operation.</color>",
					ruleLine = "Do the same thing to both sides so the equation stays balanced.",
					summaryLine = "Get X alone. Keep it balanced. Solve!"
				};

			case TutorialCopyAgeBand.Years10To12:
				return new TutorialCopyContent
				{
					title = "HOW TO SOLVE FOR X",
					highlightLine = "<color=#E2FF00>Isolate X by applying inverse operations.</color>",
					ruleLine = "Apply the same inverse operation to both sides to preserve equality.",
					summaryLine = "Simplify. Isolate X. Check your solution."
				};

			case TutorialCopyAgeBand.Years7To9:
			default:
				return new TutorialCopyContent
				{
					title = "HOW TO SOLVE FOR X",
					highlightLine = "<color=#E2FF00>Use opposite operations to get X by itself.</color>",
					ruleLine = "Do the same operation on both sides to keep the equation balanced.",
					summaryLine = "Use opposite operations on both sides. Solve for X!"
				};
		}
	}

	private static TutorialCopyAgeBand GetTutorialCopyAgeBand(EquationDataSet.SchoolYear year)
	{
		switch (year)
		{
			case EquationDataSet.SchoolYear.Year5:
			case EquationDataSet.SchoolYear.Year6:
				return TutorialCopyAgeBand.Years5To6;

			case EquationDataSet.SchoolYear.Year10:
			case EquationDataSet.SchoolYear.Year11:
			case EquationDataSet.SchoolYear.Year12:
				return TutorialCopyAgeBand.Years10To12;

			case EquationDataSet.SchoolYear.Year7:
			case EquationDataSet.SchoolYear.Year8:
			case EquationDataSet.SchoolYear.Year9:
			default:
				return TutorialCopyAgeBand.Years7To9;
		}
	}
}
