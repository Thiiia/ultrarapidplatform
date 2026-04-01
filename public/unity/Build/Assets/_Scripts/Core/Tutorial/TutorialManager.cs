using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;
using UnityEngine;
using UnityEngine.SceneManagement;
using Shapes;

public class TutorialManager : MonoBehaviour
{
	[SerializeField] private List<TutorialStep> tutorialSteps;
	[SerializeField] private InGameScoreDisplay inGameScoreDisplay;
	[SerializeField] private Image focusArea;
	[SerializeField] private Image vignetteImage;
	[SerializeField] private bool deferAutoStartWhenAlgebraGatePresent = true;
	private const string TutorialSeenPrefKey = "TutorialCompleted";
	private bool tutorialWillPlayAtStart = false;
	private static bool pendingRuntimeStartRequest = false;

	private static TutorialManager activeInstance;
	private readonly HashSet<Button> runtimeWiredSkipButtons = new HashSet<Button>();

	public static bool IsTutorialActive { get; private set; } = false;

	/// Public property to access current step index for external systems.
	public int CurrentStepIndex => currentStepIndex;

	/// Event raised when tutorial step changes.
	public static event System.Action<int> StepChanged;

	public static void ResetTutorialFlag()
	{
		PlayerPrefs.DeleteKey(TutorialSeenPrefKey);
		PlayerPrefs.Save();

		// Match the How-To replay path in algebra scenes by clearing the algebra-specific
		// completion bit too, then delegate to the same replay request flow.
		AlgebraTutorialGate.ResetAlgebraTutorialFlag();
		RequestTutorialReplay();
	}

	public static void RequestTutorialReplay()
	{
		// Recover if static state got stuck (common after interrupted play/replay flows).
		if (IsTutorialActive && (activeInstance == null || !activeInstance.isActiveAndEnabled))
		{
			IsTutorialActive = false;
		}
		else if (IsTutorialActive && activeInstance != null && !activeInstance.HasAnyVisibleTutorialStep())
		{
			Debug.LogWarning("TutorialManager replay requested while IsTutorialActive=true but no tutorial step is visible. Resetting stale tutorial state.");
			activeInstance.RecoverStaleTutorialStateForReplay();
			IsTutorialActive = false;
		}

		if (IsTutorialActive)
		{
			return;
		}

		PlayerPrefs.DeleteKey(TutorialSeenPrefKey);
		PlayerPrefs.Save();

		AudioManager.SuppressNextAutoStart();

		if (activeInstance != null)
		{
			activeInstance.QueueTutorialRestart();
			return;
		}

		pendingRuntimeStartRequest = true;
		Debug.Log("TutorialManager instance not found yet; queued tutorial replay for next scene instance.");
	}

	[ContextMenu("Reset Tutorial Flag")]
	private void ResetTutorialFlagContextMenu()
	{
		ResetTutorialFlag();
	}

	private void Awake()
	{
		// In Editor fast-enter-play (domain reload disabled), static state can persist
		// across play sessions and incorrectly block tutorial requests.
		IsTutorialActive = false;

		if (activeInstance != null && activeInstance != this)
		{
			Debug.LogWarning("Multiple TutorialManager instances detected; overriding with latest.");
		}
		activeInstance = this;

		bool hasSeenTutorial = PlayerPrefs.GetInt(TutorialSeenPrefKey, 0) == 1;
		bool hasAlgebraGate = deferAutoStartWhenAlgebraGatePresent && FindFirstObjectByType<AlgebraTutorialGate>() != null;
		tutorialWillPlayAtStart = !hasSeenTutorial && !hasAlgebraGate;

		if (pendingRuntimeStartRequest && !hasSeenTutorial)
		{
			tutorialWillPlayAtStart = true;
			pendingRuntimeStartRequest = false;
		}

		// Keep playback suppressed whenever tutorial is pending, regardless of whether
		// startup is immediate (no gate) or deferred (gate handoff / pending runtime request).
		if (!hasSeenTutorial)
		{
			AudioManager.SuppressNextAutoStart();
		}

		if (hasSeenTutorial && !tutorialWillPlayAtStart)
		{
			gameObject.SetActive(false);
			return;
		}

		AutoWireTutorialStepControls();
	}

	private void OnDestroy()
	{
		if (activeInstance == this)
		{
			activeInstance = null;
			IsTutorialActive = false;
		}
	}

	private int currentStepIndex = 0;

	private void Start()
	{
		if (tutorialWillPlayAtStart)
		{
			StartCoroutine(BeginTutorialNextFrame());
		}
		else
		{
			DeactivateAllSteps();
			HideTutorialOverlay();
		}
	}

	private IEnumerator BeginTutorialNextFrame()
	{
		yield return null; // let other systems finish initializing before pausing/resuming audio
		BeginTutorial();
	}

	public void StartTutorial()
	{
		BeginTutorial();
	}

	private void BeginTutorial()
	{
		if (tutorialSteps == null || tutorialSteps.Count == 0)
		{
			Debug.LogWarning("No tutorial steps defined to enter.");
			return;
		}

		AutoWireTutorialStepControls();

		IsTutorialActive = true;

		if (inGameScoreDisplay)
			inGameScoreDisplay.PauseForTutorial();

		if (!gameObject.activeSelf)
			gameObject.SetActive(true);

		// bandleader says holdif anything started early, freeze it
		if (AudioManager.Instance != null && AudioManager.Instance.IsPlaying)
			AudioManager.Instance.PauseSong();

		StopAllCoroutines();
		StartCoroutine(EnterTutorial());
	}

	private IEnumerator EnterTutorial()
	{
		// [Error] no fixed waits; keep timing snappy and DSP-driven

		Debug.Log("Entering tutorial mode.");

		if (vignetteImage)
			vignetteImage.gameObject.SetActive(true);

		currentStepIndex = 0;

		if (tutorialSteps.Count > 0)
		{
			foreach (var step in tutorialSteps)
				step.gameObject.SetActive(false);

			tutorialSteps[0].gameObject.SetActive(true);
			tutorialSteps[0].OnEnterStep();

			// Notify external systems (e.g., EquationTutorialController)
			StepChanged?.Invoke(currentStepIndex);
		}
		else
		{
			Debug.LogWarning("No tutorial steps defined to enter.");
		}

		yield break;
	}


	public void GoToNextStep()
	{
		if (currentStepIndex < tutorialSteps.Count - 1)
		{
			tutorialSteps[currentStepIndex].OnExitStep();
			currentStepIndex++;
			tutorialSteps[currentStepIndex].gameObject.SetActive(true);
			tutorialSteps[currentStepIndex].OnEnterStep();

			// Notify external systems (e.g., EquationTutorialController)
			StepChanged?.Invoke(currentStepIndex);
		}
		else
		{
			tutorialSteps[currentStepIndex].OnExitStep();
			TearDownTutorial(false);
		}
	}

	public void SkipTutorial()
	{
		if (currentStepIndex < tutorialSteps.Count - 1)
		{
			tutorialSteps[currentStepIndex].OnExitStep();
		}

		currentStepIndex = tutorialSteps.Count;

		TearDownTutorial(true);
	}

	private void MarkTutorialSeen()
	{
		PlayerPrefs.SetInt(TutorialSeenPrefKey, 1);
		PlayerPrefs.Save();
		pendingRuntimeStartRequest = false;
	}

	private void ResumeGameplayAfterTutorial()
	{
		if (inGameScoreDisplay)
		{
			inGameScoreDisplay.ResumeFromTutorial();
		}

		if (AudioManager.IsAutoStartSuppressed && AudioManager.Instance != null)
		{
			AudioManager.Instance.SchedulePlaybackNow();
		}
	}

	private void TearDownTutorial(bool wasSkipped)
	{
		IsTutorialActive = false;

		// One-way exit: clean up UI, resume play, and remember completion status.
		HideTutorialOverlay();

		foreach (TutorialStep step in tutorialSteps)
		{
			if (step != null)
			{
				step.gameObject.SetActive(false);
			}
		}

		ResumeGameplayAfterTutorial();
		MarkTutorialSeen();

		Debug.Log(wasSkipped ? "Tutorial skipped." : "Tutorial completed.");
	}

	private void HideTutorialOverlay()
	{
		// Both focus and vignette may be assigned independently, so guard each one.
		if (vignetteImage)
		{
			vignetteImage.gameObject.SetActive(false);
		}

		if (focusArea)
		{
			focusArea.gameObject.SetActive(false);
		}
	}

	private void DeactivateAllSteps()
	{
		foreach (var step in tutorialSteps)
		{
			if (step != null)
			{
				step.gameObject.SetActive(false);
			}
		}
	}

	private void QueueTutorialRestart()
	{
		if (IsTutorialActive)
			return;

		tutorialWillPlayAtStart = true;

		if (!gameObject.activeSelf)
			gameObject.SetActive(true);

		DeactivateAllSteps();
		HideTutorialOverlay();

		StopAllCoroutines();
		StartCoroutine(BeginTutorialNextFrame());
	}

	private bool HasAnyVisibleTutorialStep()
	{
		if (tutorialSteps == null)
		{
			return false;
		}

		for (int i = 0; i < tutorialSteps.Count; i++)
		{
			TutorialStep step = tutorialSteps[i];
			if (step != null && step.gameObject.activeInHierarchy)
			{
				return true;
			}
		}

		return false;
	}

	private void RecoverStaleTutorialStateForReplay()
	{
		StopAllCoroutines();
		DeactivateAllSteps();
		HideTutorialOverlay();
		currentStepIndex = 0;
	}

	private void AutoWireTutorialStepControls()
	{
		if (tutorialSteps == null || tutorialSteps.Count == 0)
		{
			return;
		}

		for (int i = 0; i < tutorialSteps.Count; i++)
		{
			TutorialStep step = tutorialSteps[i];
			if (step == null)
			{
				continue;
			}

			Button[] buttons = step.GetComponentsInChildren<Button>(true);
			for (int j = 0; j < buttons.Length; j++)
			{
				Button button = buttons[j];
				if (button == null)
				{
					continue;
				}

				if (button.name.IndexOf("skip", System.StringComparison.OrdinalIgnoreCase) < 0)
				{
					continue;
				}

				EnsureButtonRaycastSurface(button);
				EnsureSkipUnderlineHoverAnimator(button);
				// Skip buttons already have a bespoke underline hover effect; disable default
				// Button ColorTint to avoid tinting random child graphics (blur/text) on hover.
				button.transition = Selectable.Transition.None;
				if (runtimeWiredSkipButtons.Add(button))
				{
					button.onClick.AddListener(SkipTutorial);
				}
			}

			MeshRenderer[] stepLines = step.GetComponentsInChildren<MeshRenderer>(true);
			for (int j = 0; j < stepLines.Length; j++)
			{
				MeshRenderer renderer = stepLines[j];
				if (renderer == null)
				{
					continue;
				}

				if (renderer.gameObject.name.IndexOf("line", System.StringComparison.OrdinalIgnoreCase) >= 0)
				{
					renderer.gameObject.SetActive(true);
					renderer.enabled = true;
				}
			}
		}
	}

	private static void EnsureButtonRaycastSurface(Button button)
	{
		if (button == null)
		{
			return;
		}

		Image rootImage = button.GetComponent<Image>();
		if (rootImage != null && !rootImage.enabled)
		{
			rootImage.enabled = true;
			rootImage.raycastTarget = true;
			Color rootColor = rootImage.color;
			rootColor.a = 0f;
			rootImage.color = rootColor;
		}

		bool targetIsInvisibleRootImage = button.targetGraphic == rootImage && rootImage != null && rootImage.color.a <= 0.001f;
		if (targetIsInvisibleRootImage)
		{
			// Keep the invisible root image as the interaction surface; do not retarget to child
			// text/graphics or hover can tint/flash unexpected visuals.
			button.targetGraphic = rootImage;
			return;
		}

		if (button.targetGraphic != null && button.targetGraphic.isActiveAndEnabled && !targetIsInvisibleRootImage)
		{
			button.targetGraphic.raycastTarget = true;
			return;
		}

		Graphic[] graphics = button.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			Graphic graphic = graphics[i];
			if (graphic == null || !graphic.isActiveAndEnabled)
			{
				continue;
			}

			if (graphic == rootImage && rootImage != null && rootImage.color.a <= 0.001f)
			{
				continue;
			}

			graphic.raycastTarget = true;
			if (button.targetGraphic == null || targetIsInvisibleRootImage)
			{
				button.targetGraphic = graphic;
			}
			return;
		}

		Image image = button.GetComponent<Image>();
		if (image == null)
		{
			return;
		}

		image.enabled = true;
		image.raycastTarget = true;
		Color c = image.color;
		c.a = Mathf.Min(c.a, 0.001f);
		image.color = c;
		button.targetGraphic = image;
	}

	private static void EnsureSkipUnderlineHoverAnimator(Button button)
	{
		if (button == null)
		{
			return;
		}

		EnsureSkipUnderlineVisual(button);

		TutorialSkipUnderlineHover hoverAnimator = button.GetComponent<TutorialSkipUnderlineHover>();
		if (hoverAnimator == null)
		{
			hoverAnimator = button.gameObject.AddComponent<TutorialSkipUnderlineHover>();
		}

		hoverAnimator.TryAutoBind();
	}

	private static void EnsureSkipUnderlineVisual(Button button)
	{
		if (button == null)
		{
			return;
		}

		Line existing = button.GetComponentInChildren<Line>(true);
		if (existing != null)
		{
			return;
		}

		GameObject underlineObj = new GameObject("SkipUnderline", typeof(RectTransform), typeof(Line));
		underlineObj.transform.SetParent(button.transform, false);
		underlineObj.transform.SetAsLastSibling();

		RectTransform rt = underlineObj.GetComponent<RectTransform>();
		rt.anchorMin = new Vector2(0f, 0f);
		rt.anchorMax = new Vector2(0f, 0f);
		rt.pivot = new Vector2(0f, 0.5f);
		rt.anchoredPosition = new Vector2(4f, 8f);

		Line line = underlineObj.GetComponent<Line>();
		line.Start = Vector3.zero;
		line.End = new Vector3(72f, 0f, 0f);
		line.Thickness = 1f;
		line.Color = new Color(0.8862745f, 1f, 0f, 0.85f);

		MeshRenderer meshRenderer = underlineObj.GetComponent<MeshRenderer>();
		if (meshRenderer != null)
		{
			meshRenderer.enabled = true;
		}
	}

	public void ExitGameplayFromTutorial()
	{
#if WEBGL || UNITY_EDITOR
		Debug.Log("Exiting to main menu from tutorial (WebGL).");
		SceneManager.LoadScene("Start Scene");
#elif UNITY_STANDALONE_WIN || WINDOWS
		Debug.Log("Exiting application from tutorial (Windows).");
		Application.Quit();
#endif
	}

	// -------------------------------------------------------------------------
	// Runtime entry point: call when first shape is selected (or similar).
	// -------------------------------------------------------------------------
	/// <summary>
	/// Trigger the tutorial at runtime (e.g., when the player picks their first shape).
	/// No-ops if already completed or currently active.
	/// </summary>
	public static void RequestTutorialIfNotSeen()
	{
		if (IsTutorialActive) return;
		if (PlayerPrefs.GetInt(TutorialSeenPrefKey, 0) == 1) return;

		AudioManager.SuppressNextAutoStart(); // keep audio paused until tutorial runs

		if (activeInstance != null)
		{
			activeInstance.StartTutorial();
		}
		else
		{
			pendingRuntimeStartRequest = true;
			Debug.Log("TutorialManager instance not found yet; queued tutorial start for next scene instance.");
		}
	}
}
