using UnityEngine;

using System;
using System.Collections;
using System.Collections.Generic;

using TMPro;

using DG.Tweening;

public class LinearEquationSolver : MonoBehaviour, IEquationProgressionSource
{
	[Header("UI References")]
	[SerializeField] private RectTransform equationContainer;
	[SerializeField] private TextMeshProUGUI stepDescriptionText;
	[SerializeField, Tooltip("When enabled, replaces the description text when interactive solve starts (Bubble/Drag mode). Disable to keep whatever text is already on the UI after tutorial.")]
	private bool overwriteStepDescriptionOnInteractiveStart = true;
	[SerializeField, Tooltip("If enabled, the start-description overwrite is skipped once the tutorial completion flag is set in PlayerPrefs.")]
	private bool skipStartDescriptionOverwriteAfterTutorial = true;
	[SerializeField, Tooltip("PlayerPrefs key used to detect tutorial completion when skipping overwrite after tutorial.")]
	private string tutorialCompletionPrefKey = "TutorialCompleted";
	[SerializeField, Tooltip("Description shown when interactive solve starts if overwrite is enabled.")]
	private string interactiveStartDescriptionText = "SOLVE FOR X";
	[SerializeField, Tooltip("Keep the step description text at a fixed font size during runtime.")]
	private bool lockStepDescriptionFontSize = true;
	[SerializeField, Min(1f), Tooltip("Fixed runtime font size for the step description text when lock is enabled.")]
	private float stepDescriptionLockedFontSize = 24f;
	[SerializeField] private GameObject textPrefab;
	[SerializeField] private TextMeshProUGUI hitCounterText;

	[Header("Input")]
	[SerializeField] private TMP_InputField equationInput;
	[SerializeField] private UnityEngine.UI.Button solveButton;
	[SerializeField] private UnityEngine.UI.Button nextButton;
	[SerializeField] private UnityEngine.UI.Button prevButton;
	[SerializeField] private UnityEngine.UI.Button playAllButton;
	[SerializeField] private UnityEngine.UI.Button resetButton;

	[Header("Equation Data")]
	[SerializeField] private EquationDataSet equationDataSet;
	[SerializeField] private EquationDataSet.SchoolYear selectedDifficulty = EquationDataSet.SchoolYear.Year7;

	[Header("Sequential Equations")]
	[SerializeField, Min(1)] private int totalEquationsToSolve = 5;
	[SerializeField] private float delayBetweenEquations = 1.5f;
	[SerializeField] private EquationSessionMode sessionMode = EquationSessionMode.FixedCount;
	[SerializeField, Min(1)] private int checkpointBatchSize = 5;
	[SerializeField] private bool promptForDifficultyAdjustment = true;
	[SerializeField] private bool suppressResultsScreen = true;
	[SerializeField] private bool splitSchoolYearIntoDifficultyBands = true;
	[SerializeField] private bool startCheckpointModeInHarderHalfOfSelectedYear = true;

	[Header("Choice System")]
	[SerializeField] private EquationChoiceSystem choiceSystem;

	[Header("Animation Settings")]
	[SerializeField] private float moveSpeed = 1.0f; // Control animation speed
	[SerializeField] private float animationDuration = 1.2f;
	[SerializeField] private float fadeInDuration = 0.3f;
	[SerializeField] private Ease moveEase = Ease.InOutCubic;

	[Header("Text Settings")]
	[SerializeField] private GameObject allStepsContainer;
	[SerializeField] private float fontSize = 60f;
	[SerializeField] private float verticalSpacing = 80f; // Spacing between steps in all steps container
	[SerializeField] private Color variableColor = Color.cyan;
	[SerializeField] private Color numberColor = Color.white;
	[SerializeField] private Color operatorColor = Color.yellow;
	[SerializeField] private Color equalsColor = Color.green;

	private List<SolutionStep> steps = new List<SolutionStep>();
	private int currentStepIndex = -1;
	private int hitCounter = 0;
	private bool isAnimating = false;
	private List<TextElement> activeElements = new List<TextElement>();
	private List<GameObject> tempAnimationObjects = new List<GameObject>(); // Track temporary animation objects
	private List<GameObject> allStepsObjects = new List<GameObject>(); // Track all steps added to allStepsContainer

	// Sequential equation tracking
	private int currentEquationIndex = 0;
	private int equationsSolvedCount = 0;
	private int equationsSolvedInCurrentBatch = 0;
	private int completedCheckpointBatches = 0;
	private bool waitingForCheckpointChoice = false;
	private EquationEntry currentEquationEntry;
	private DifficultyBand currentDifficultyBand = DifficultyBand.Harder;
	private EquationDataSet.SchoolYear queuedDifficultyYear = EquationDataSet.SchoolYear.Year7;
	private DifficultyBand queuedDifficultyBand = DifficultyBand.Harder;
	private readonly Queue<EquationEntry> endlessEntryQueue = new Queue<EquationEntry>();
	private AlgebraDifficultyCheckpointPrompt checkpointPrompt;

	private const string DefaultFallbackEquation = "3(x + 2) + 5 = 14x + 7";

	[Header("Rhythm Coupling (optional)")]
	[SerializeField] private bool advanceStepsOnBroadcastHit = false;
	[SerializeField, Min(1)] private int hitsPerStep = 5;

	[Header("Input Mode")]
	[SerializeField] private InputMode inputMode = InputMode.BubbleDrag;
	[SerializeField] private DragExecutionController dragController;

	public enum InputMode
	{
		ChoiceButtons,  // Legacy: player selects from options (EquationChoiceSystem)
		DragExecution,  // Legacy: player drags tokens along path
		BubbleDrag      // Current algebra gameplay path
	}

	public enum EquationSessionMode
	{
		FixedCount,
		EndlessCheckpoint
	}

	private enum DifficultyBand
	{
		Easier,
		Harder
	}

	// Event for when player selects an option
	public System.Action<StepOption> OnOptionSelected;
	public event System.Action<EquationEntry, string, EquationDataSet.SchoolYear> EquationLoaded;

	[System.Serializable]
	public class TextElement
	{
		public GameObject obj;
		public TextMeshProUGUI text;
		public RectTransform rect;
		public string token;
		public int termId;
	}

	[System.Serializable]
	public class SolutionStep
	{
		public string equationString;
		public string description;
		public bool hasAnimation;
		public int movingTermId;
		public bool movingToRight;

		public SolutionStep(string eq, string desc, bool anim = false, int moveId = -1, bool toRight = false)
		{
			equationString = eq;
			description = desc;
			hasAnimation = anim;
			movingTermId = moveId;
			movingToRight = toRight;
		}
	}

	private void Start()
	{
		InitializeChoiceSystem();
		BindUiButtons();
		ApplyStepDescriptionFontLock();

		// Don't start gameplay while the tutorial gate is actively blocking this scene.
		if (EquationTutorialController.ShouldBlockGameplayForTutorial())
		{
			return;
		}

		EnsureEquationDataSet();
		ResetSessionState();
		LoadInitialEquation();
	}

	private void EnsureEquationDataSet()
	{
		if (equationDataSet != null)
		{
			EnsureSelectedDifficultyHasContent();
			return;
		}

		// Prefer Resources so WebGL builds reliably include the bank.
		equationDataSet = Resources.Load<EquationDataSet>("EquationDataSet");
		if (equationDataSet == null)
		{
			Debug.LogWarning("LinearEquationSolver: EquationDataSet not assigned and could not be loaded from Resources/EquationDataSet.");
			return;
		}

		EnsureSelectedDifficultyHasContent();
	}

	private void EnsureSelectedDifficultyHasContent()
	{
		if (equationDataSet == null)
		{
			return;
		}

		// If the scene has an out-of-range year selected (e.g., Year11 but bank only has Year6–8),
		// auto-fallback to a year that actually has equations so the game isn't "weird".
		if (equationDataSet.GetEquationCount(selectedDifficulty) > 0)
		{
			return;
		}

		EquationDataSet.SchoolYear preferred = AlgebraRuntimeConfig.CurrentSchoolYear;
		if (equationDataSet.GetEquationCount(preferred) > 0)
		{
			selectedDifficulty = preferred;
			return;
		}

		foreach (EquationDataSet.DifficultyLevel level in equationDataSet.GetAllLevels())
		{
			if (level != null && equationDataSet.GetEquationCount(level.schoolYear) > 0)
			{
				selectedDifficulty = level.schoolYear;
				Debug.LogWarning($"LinearEquationSolver: Selected year had no equations; falling back to {selectedDifficulty}.");
				return;
			}
		}
	}

	private void ResetSessionState()
	{
		equationsSolvedCount = 0;
		equationsSolvedInCurrentBatch = 0;
		completedCheckpointBatches = 0;
		currentEquationIndex = 0;
		currentEquationEntry = null;
		waitingForCheckpointChoice = false;
		endlessEntryQueue.Clear();
		ResetDifficultyCursor();
		HideCheckpointPrompt();
		UpdateLockedEquationProgress(false);
	}

	private void ResetDifficultyCursor()
	{
		currentDifficultyBand = startCheckpointModeInHarderHalfOfSelectedYear
			? DifficultyBand.Harder
			: DifficultyBand.Easier;
		endlessEntryQueue.Clear();
		queuedDifficultyYear = selectedDifficulty;
		queuedDifficultyBand = currentDifficultyBand;
		ApplyRuntimeDifficultySelection();
	}

	private void ApplyRuntimeDifficultySelection()
	{
		AlgebraRuntimeConfig.SetSchoolYear(selectedDifficulty);
	}

	private void LoadInitialEquation()
	{
		if (TryLoadNextEquationIntoBoard())
			return;

		Debug.LogWarning($"LinearEquationSolver: No equations found for {selectedDifficulty}. Using default equation.");
		currentEquationEntry = null;
		if (equationInput != null)
			equationInput.text = DefaultFallbackEquation;
		StartInteractiveSolve();
		UpdateLockedEquationProgress(false);
	}

	private bool TryLoadNextEquationIntoBoard()
	{
		if (equationInput == null)
			return false;

		EnsureEquationDataSet();
		if (!TryResolveNextEquation(out EquationEntry entry, out string equation))
			return false;

		currentEquationIndex++;
		currentEquationEntry = entry;
		equationInput.text = equation;
		Debug.Log(BuildLoadEquationDebugMessage(equation));
		StartInteractiveSolve();
		UpdateLockedEquationProgress(false);
		EquationLoaded?.Invoke(entry, equation, selectedDifficulty);
		return true;
	}

	private bool TryResolveNextEquation(out EquationEntry entry, out string equation)
	{
		entry = null;
		equation = string.Empty;

		if (equationDataSet == null)
			return false;

		ApplyRuntimeDifficultySelection();
		entry = UsesEndlessCheckpointMode ? GetNextCheckpointModeEntry() : equationDataSet.GetRandomEntry(selectedDifficulty);
		if (entry == null)
			return false;

		equation = entry.GetNormalizedEquation();
		return !string.IsNullOrWhiteSpace(equation);
	}

	private EquationEntry GetNextCheckpointModeEntry()
	{
		if (equationDataSet == null)
			return null;

		if (endlessEntryQueue.Count == 0 ||
			queuedDifficultyYear != selectedDifficulty ||
			queuedDifficultyBand != currentDifficultyBand)
		{
			RebuildCheckpointQueue();
		}

		if (endlessEntryQueue.Count == 0)
			return equationDataSet.GetRandomEntry(selectedDifficulty);

		return endlessEntryQueue.Dequeue();
	}

	private void RebuildCheckpointQueue()
	{
		endlessEntryQueue.Clear();
		queuedDifficultyYear = selectedDifficulty;
		queuedDifficultyBand = currentDifficultyBand;

		List<EquationEntry> entries = ResolveCheckpointEntries(selectedDifficulty, currentDifficultyBand);
		if (entries.Count == 0)
			entries = equationDataSet.GetEntriesForYear(selectedDifficulty);
		if (entries.Count == 0)
			return;

		ShuffleEntries(entries);
		for (int i = 0; i < entries.Count; i++)
			endlessEntryQueue.Enqueue(entries[i]);
	}

	private List<EquationEntry> ResolveCheckpointEntries(EquationDataSet.SchoolYear year, DifficultyBand band)
	{
		List<EquationEntry> entries = equationDataSet.GetEntriesForYear(year);
		if (entries.Count == 0)
			return entries;

		entries.Sort((a, b) => a.complexityScore.CompareTo(b.complexityScore));
		if (!splitSchoolYearIntoDifficultyBands || entries.Count < 2)
			return entries;

		int splitIndex = Mathf.Clamp(entries.Count / 2, 1, entries.Count - 1);
		return band == DifficultyBand.Easier
			? entries.GetRange(0, splitIndex)
			: entries.GetRange(splitIndex, entries.Count - splitIndex);
	}

	private static void ShuffleEntries(List<EquationEntry> entries)
	{
		for (int i = entries.Count - 1; i > 0; i--)
		{
			int swapIndex = UnityEngine.Random.Range(0, i + 1);
			EquationEntry temp = entries[i];
			entries[i] = entries[swapIndex];
			entries[swapIndex] = temp;
		}
	}

	private void AdvanceDifficultyBand(int nodeStep)
	{
		if (nodeStep == 0)
			return;

		int currentNode = ((int)selectedDifficulty * 2) + (currentDifficultyBand == DifficultyBand.Harder ? 1 : 0);
		int maxNode = (Enum.GetValues(typeof(EquationDataSet.SchoolYear)).Length * 2) - 1;
		int nextNode = Mathf.Clamp(currentNode + nodeStep, 0, maxNode);

		selectedDifficulty = (EquationDataSet.SchoolYear)(nextNode / 2);
		currentDifficultyBand = (nextNode % 2) == 0 ? DifficultyBand.Easier : DifficultyBand.Harder;
		endlessEntryQueue.Clear();
		ApplyRuntimeDifficultySelection();
	}

	private string BuildLoadEquationDebugMessage(string equation)
	{
		if (UsesEndlessCheckpointMode)
		{
			int nextBatchEquation = Mathf.Clamp(equationsSolvedInCurrentBatch + 1, 1, Mathf.Max(1, checkpointBatchSize));
			return $"Loading equation {equationsSolvedCount + 1} total | equation run {nextBatchEquation}/{Mathf.Max(1, checkpointBatchSize)} | {GetCurrentDifficultySetLabel()}: {equation}";
		}

		return $"Loading equation {equationsSolvedCount + 1}/{Mathf.Max(1, totalEquationsToSolve)} from data set (Difficulty: {selectedDifficulty}): '{equation}'";
	}

	private string GetCurrentDifficultySetLabel()
	{
		if (!UsesEndlessCheckpointMode)
			return FormatSchoolYearLabel(selectedDifficulty);

		string bandLabel = currentDifficultyBand == DifficultyBand.Easier ? "easier set" : "harder set";
		return $"{FormatSchoolYearLabel(selectedDifficulty)} {bandLabel}";
	}

	private static string FormatSchoolYearLabel(EquationDataSet.SchoolYear year)
	{
		string raw = year.ToString();
		return raw.StartsWith("Year") ? $"Year {raw.Substring(4)}" : raw;
	}

	private void ShowCheckpointPrompt()
	{
		Canvas canvas = dragController != null ? dragController.ParentCanvas : GetComponentInParent<Canvas>();
		checkpointPrompt = AlgebraDifficultyCheckpointPrompt.GetOrCreate(canvas);
		if (checkpointPrompt == null)
		{
			Debug.LogWarning("LinearEquationSolver: Could not create checkpoint prompt. Continuing at current difficulty.");
			ResolveCheckpointChoice(0);
			return;
		}

		string title = "Equation Run Complete";
		string description =
			$"Solved {equationsSolvedCount} equations so far.\n" +
			$"Current set: {GetCurrentDifficultySetLabel()}.\n" +
			"Choose the next equation run.";

		checkpointPrompt.Show(
			title,
			description,
			"Easier",
			"Keep Going",
			"Harder",
			() => ResolveCheckpointChoice(-1),
			() => ResolveCheckpointChoice(0),
			() => ResolveCheckpointChoice(1));
	}

	private void ResolveCheckpointChoice(int nodeStep)
	{
		waitingForCheckpointChoice = false;
		HideCheckpointPrompt();
		AdvanceDifficultyBand(nodeStep);
		equationsSolvedInCurrentBatch = 0;
		UpdateLockedEquationProgress(false);
		StartCoroutine(LoadNextEquationAfterDelay());
	}

	private void HideCheckpointPrompt()
	{
		if (checkpointPrompt != null)
			checkpointPrompt.HideImmediate();
	}

	private void OnEnable()
	{
		if (advanceStepsOnBroadcastHit)
		{
			GameplayEventBus.BroadcastHit += HandleHit;
		}
	}

	private void OnDisable()
	{
		GameplayEventBus.BroadcastHit -= HandleHit;
	}

	private void BindUiButtons()
	{
		if (solveButton != null)
		{
			solveButton.onClick.RemoveListener(OnSolveClicked);
			solveButton.onClick.AddListener(OnSolveClicked);
		}

		if (nextButton != null)
		{
			nextButton.onClick.RemoveListener(NextStep);
			nextButton.onClick.AddListener(NextStep);
		}

		if (prevButton != null)
		{
			prevButton.onClick.RemoveListener(PreviousStep);
			prevButton.onClick.AddListener(PreviousStep);
		}

		if (playAllButton != null)
		{
			playAllButton.onClick.RemoveListener(PlayAll);
			playAllButton.onClick.AddListener(PlayAll);
		}

		if (resetButton != null)
		{
			resetButton.onClick.RemoveListener(Reset);
			resetButton.onClick.AddListener(Reset);
		}
	}

	private void UnbindUiButtons()
	{
		if (solveButton != null) solveButton.onClick.RemoveListener(OnSolveClicked);
		if (nextButton != null) nextButton.onClick.RemoveListener(NextStep);
		if (prevButton != null) prevButton.onClick.RemoveListener(PreviousStep);
		if (playAllButton != null) playAllButton.onClick.RemoveListener(PlayAll);
		if (resetButton != null) resetButton.onClick.RemoveListener(Reset);
	}

	private void HandleHit()
	{
		hitCounter++;
		Debug.Log("Hit counter: " + hitCounter);

		if (hitCounterText != null)
		{
			hitCounterText.text = "Hits : " + hitCounter;
			hitCounterText.DOColor(Color.yellow, 0.1f).SetLoops(2, LoopType.Yoyo);
		}

		if (hitCounter % Mathf.Max(1, hitsPerStep) == 0)
		{
			TriggerStepInteraction();
		}
	}

	/// Triggers the step interaction based on the current input mode.
	private void TriggerStepInteraction()
	{
		if (choiceSystem == null)
			return;

		// Check if already waiting for input
		if (choiceSystem.IsWaitingForChoice)
			return;

		if (dragController != null && dragController.IsActive)
			return;

		switch (inputMode)
		{
			case InputMode.ChoiceButtons:
				choiceSystem.DisplayCurrentOptions();
				break;

			case InputMode.DragExecution:
			case InputMode.BubbleDrag:
				if (dragController != null)
				{
					Debug.Log("LinearEquationSolver: Bubble drag system active, waiting for user interaction");
				}
				break;
		}
		}

	/// Called when the drag controller completes a successful drag operation.
	private void HandleDragOperationComplete()
	{
		if (choiceSystem == null || dragController == null)
		{
			return;
		}

		if (dragController.CurrentState != null)
		{
			choiceSystem.SetState(dragController.CurrentState);
		}

		// DragExecutionController owns operation application and equation visuals.
		// Solver only mirrors authoritative state and handles solved transition.
		if (dragController.CurrentState != null && dragController.CurrentState.IsSolved())
		{
			SetStepDescriptionText("Solved!");
			OnEquationSolved();
		}
	}


	public void OnSolveClicked()
	{
		if (string.IsNullOrEmpty(equationInput.text))
		{
			return;
		}
		ParseAndSolveEquation(equationInput.text);
	}

	private void ParseAndSolveEquation(string equation)
	{
		if (choiceSystem == null)
		{
			Debug.LogWarning("EquationChoiceSystem not assigned. Cannot build solver steps.");
			return;
		}

		if (!TryCreateEquationState(equation, out _, out EquationState initialState))
		{
			Debug.LogError($"Invalid or unsupported equation format: '{equation}'.");
			return;
		}

		steps.Clear();
		currentStepIndex = -1;
		ClearAllStepsContainer();

		steps.Add(new SolutionStep(FormatEquation(initialState), "Starting equation"));
		if (!TryAppendAutoSolveSteps(initialState))
		{
			Debug.LogError($"Could not determine solution steps for '{equation}'.");
			return;
		}

		NextStep();
	}

	private bool TryCreateEquationState(string rawEquation, out string normalizedEquation, out EquationState state)
	{
		normalizedEquation = EquationStringUtil.NormalizeForParsing(rawEquation ?? string.Empty);
		state = null;

		if (string.IsNullOrWhiteSpace(normalizedEquation))
		{
			return false;
		}

		if (!LinearEquationParser.TryParse(
			normalizedEquation,
			AlgebraRuntimeConfig.AllowDecimals,
			AlgebraRuntimeConfig.AllowFractions,
			AlgebraRuntimeConfig.EnableSubstitution,
			out LinearEquationParser.ParsedEquation parsed))
		{
			return false;
		}

		state = CreateEquationState(normalizedEquation, parsed);
		return true;
	}

	private static EquationState CreateEquationState(string normalizedEquation, LinearEquationParser.ParsedEquation parsed)
	{
		string rawEquation = parsed.hasSubstitution
			? parsed.normalizedEquation
			: normalizedEquation;

		return new EquationState(
			parsed.leftVarCoef,
			parsed.leftConst,
			parsed.rightVarCoef,
			parsed.rightConst,
			parsed.hasBrackets,
			rawEquation)
		{
			leftConstDenominator = parsed.leftConstDenominator,
			rightConstDenominator = parsed.rightConstDenominator,
			hasSubstitution = parsed.hasSubstitution,
			substitutionValue = parsed.substitutionValue,
			substitutionValueDenominator = parsed.substitutionValueDenominator,
			substitutionVarCoef = parsed.substitutionVarCoef,
			substitutionConst = parsed.substitutionConst,
			substitutionConstDenominator = parsed.substitutionConstDenominator,
			substitutionExpression = parsed.substitutionExpression
		};
	}

	private bool TryAppendAutoSolveSteps(EquationState initialState)
	{
		if (choiceSystem == null || initialState == null)
		{
			return false;
		}

		EquationState currentState = initialState.Clone();
		const int maxSolveIterations = 16;

		for (int iteration = 0; iteration < maxSolveIterations && !currentState.IsSolved(); iteration++)
		{
			List<StepOption> options = choiceSystem.GenerateAvailableOptions(currentState);
			if (options == null || options.Count == 0)
			{
				return false;
			}

			StepOption selectedOption = options.Find(option => option != null && option.isOptimal) ?? options[0];
			if (selectedOption == null)
			{
				return false;
			}

			EquationState nextState = choiceSystem.ApplyOption(currentState, selectedOption);
			AppendGeneratedSolveSteps(currentState, nextState, selectedOption);
			currentState = nextState;
		}

		return currentState.IsSolved();
	}

	private void AppendGeneratedSolveSteps(EquationState stateBefore, EquationState stateAfter, StepOption option)
	{
		if (stateBefore == null || stateAfter == null || option == null || choiceSystem == null)
		{
			return;
		}

		if (option.operationType == OperationType.ExpandBrackets)
		{
			string expandedEquation = !string.IsNullOrWhiteSpace(stateAfter.rawEquation)
				? stateAfter.rawEquation
				: FormatEquation(stateAfter);
			steps.Add(new SolutionStep(expandedEquation, "Expand brackets using distributive property", false));

			string simplifiedStep = FormatEquation(stateAfter);
			if (EquationStringUtil.NormalizeForParsing(expandedEquation) != EquationStringUtil.NormalizeForParsing(simplifiedStep))
			{
				steps.Add(new SolutionStep(simplifiedStep, "Combine like terms", false));
			}

			return;
		}

		string operationStep = choiceSystem.CreateOperationStepString(stateBefore, option);
		string simplified = FormatEquation(stateAfter);
		steps.Add(new SolutionStep(operationStep, option.description, false));

		if (operationStep != simplified)
		{
			steps.Add(new SolutionStep(simplified, "Simplify", false));
		}
	}

	private string FormatEquation(int leftVarCoef, int leftConst, int rightVarCoef, int rightConst)
	{
		return FormatEquation(leftVarCoef, leftConst, 1, rightVarCoef, rightConst, 1);
	}

	private string FormatEquation(EquationState state)
	{
		if (state == null)
		{
			return "0 = 0";
		}

		if (choiceSystem != null)
		{
			return choiceSystem.FormatEquation(state);
		}

		if ((state.hasBrackets || state.hasSubstitution) && !string.IsNullOrWhiteSpace(state.rawEquation))
		{
			return state.rawEquation;
		}

		return FormatEquation(
			state.leftVarCoef,
			state.leftConst,
			state.leftConstDenominator,
			state.rightVarCoef,
			state.rightConst,
			state.rightConstDenominator);
	}

	private string ResolveSolvedValueText(EquationState state)
	{
		if (state == null)
		{
			return string.Empty;
		}

		if (state.leftVarCoef == 1 && state.leftConst == 0 && state.rightVarCoef == 0)
		{
			return FormatSignedValue(state.rightConst, state.rightConstDenominator);
		}

		if (state.rightVarCoef == 1 && state.rightConst == 0 && state.leftVarCoef == 0)
		{
			return FormatSignedValue(state.leftConst, state.leftConstDenominator);
		}

		return FormatEquation(state);
	}

	private string FormatEquation(int leftVarCoef, int leftConst, int leftConstDenominator, int rightVarCoef, int rightConst, int rightConstDenominator)
	{
		string left = FormatLeftSide(leftVarCoef, leftConst, leftConstDenominator);
		string right = FormatRightSide(rightVarCoef, rightConst, rightConstDenominator);

		return left + " = " + right;
	}

	private string FormatLeftSide(int varCoef, int constVal)
	{
		return FormatLeftSide(varCoef, constVal, 1);
	}

	private string FormatLeftSide(int varCoef, int constVal, int constDenominator)
	{
		string left = "";

		if (varCoef != 0)
		{
			if (varCoef == 1)
			{
				left = "x";
			}
			else if (varCoef == -1)
			{
				left = "-x";
			}
			else
			{
				left = varCoef + "x";
			}
		}

		if (constVal != 0)
		{
			string absConst = FormatAbsoluteValue(Mathf.Abs(constVal), constDenominator);
			if (left != "")
			{
				if (constVal > 0)
				{
					left += " + " + absConst;
				}
				else
				{
					left += " - " + absConst;
				}
			}
			else
			{
				left = constVal < 0 ? "-" + absConst : FormatSignedValue(constVal, constDenominator);
			}
		}

		if (left == "")
		{
			left = "0";
		}
		return left;
	}

	private string FormatRightSide(int varCoef, int constVal)
	{
		return FormatRightSide(varCoef, constVal, 1);
	}

	private string FormatRightSide(int varCoef, int constVal, int constDenominator)
	{
		string right = "";

		if (varCoef != 0)
		{
			if (varCoef == 1)
			{
				right = "x";
			}
			else if (varCoef == -1)
			{
				right = "-x";
			}
			else
			{
				right = varCoef + "x";
			}
		}

		if (constVal != 0)
		{
			string absConst = FormatAbsoluteValue(Mathf.Abs(constVal), constDenominator);
			if (right != "")
			{
				if (constVal > 0)
				{
					right += " + " + absConst;
				}
				else
				{
					right += " - " + absConst;
				}
			}
			else
			{
				right = constVal < 0 ? "-" + absConst : FormatSignedValue(constVal, constDenominator);
			}
		}

		if (right == "")
		{
			right = "0";
		}
		return right;
	}

	private static string FormatSignedValue(int numerator, int denominator)
	{
		string absValue = FormatAbsoluteValue(Mathf.Abs(numerator), denominator);
		return numerator < 0 ? "-" + absValue : absValue;
	}

	private static string FormatAbsoluteValue(int numeratorAbs, int denominator)
	{
		if (denominator <= 1)
		{
			return numeratorAbs.ToString();
		}

		if (AlgebraRuntimeConfig.AllowDecimals)
		{
			float value = numeratorAbs / (float)denominator;
			return value.ToString("0.###");
		}

		return $"{numeratorAbs}/{denominator}";
	}

	public void NextStep()
	{
		if (isAnimating || currentStepIndex >= steps.Count - 1)
		{
			return;
		}

		currentStepIndex++;
		StartCoroutine(AnimateStep(steps[currentStepIndex]));
	}

	public void PreviousStep()
	{
		if (isAnimating || currentStepIndex <= 0)
		{
			return;
		}

		currentStepIndex--;
		StartCoroutine(AnimateStep(steps[currentStepIndex]));
	}

	private IEnumerator AnimateStep(SolutionStep step)
	{
		isAnimating = true;
		SetStepDescriptionText(step.description);

		if (step.hasAnimation)
		{
			if (currentStepIndex > 0)
			{
				// Display the previous equation first
				SolutionStep previousStep = steps[currentStepIndex - 1];
				ClearAllText();
				yield return StartCoroutine(DisplayEquation(previousStep.equationString));
				yield return new WaitForSeconds(0.5f / moveSpeed);
			}

			yield return StartCoroutine(AnimateMoveOnly());
		}
		else
		{
			ClearAllText();
			yield return StartCoroutine(DisplayEquation(step.equationString));
		}

		// Add this step to the all steps container
		AddStepToAllStepsContainer(step);

		isAnimating = false;
	}

	private void AddStepToAllStepsContainer(SolutionStep step)
	{
		if (allStepsContainer == null || textPrefab == null)
		{
			return;
		}

		// Calculate Y position based on number of existing steps
		float yPosition = -allStepsObjects.Count * verticalSpacing;

		// Create single text element for the whole equation - right aligned
		GameObject equationObj = Instantiate(textPrefab, allStepsContainer.transform);
		TextMeshProUGUI equationText = equationObj.GetComponent<TextMeshProUGUI>();
		RectTransform equationRect = equationObj.GetComponent<RectTransform>();

		// Anchor to top-right of container
		equationRect.anchorMin = new Vector2(1f, 1f);
		equationRect.anchorMax = new Vector2(1f, 1f);
		equationRect.pivot = new Vector2(1f, 1f); // Right-aligned pivot
		equationRect.anchoredPosition = new Vector2(-10f, yPosition); // 10px padding from right

		// Format the equation with colors
		equationText.text = FormatEquationWithColors(step.equationString);
		equationText.fontSize = fontSize * 0.6f;
		equationText.alignment = TextAlignmentOptions.Right;
		equationText.textWrappingMode = TextWrappingModes.NoWrap;

		allStepsObjects.Add(equationObj);
	}

	private string FormatSideWithColors(string side)
	{
		List<string> tokens = TokenizeEquation(side);
		string result = "";

		for (int i = 0; i < tokens.Count; i++)
		{
			string token = tokens[i];
			Color color = GetColorForToken(token);

			string hexColor = ColorUtility.ToHtmlStringRGB(color);
			result += $"<color=#{hexColor}>{token}</color>";

			if (i < tokens.Count - 1)
			{
				string nextToken = tokens[i + 1];
				if (nextToken == "(")
				{
					result += "";
				}
				else
				{
					result += " ";
				}
			}
		}

		return result;
	}

	private string FormatEquationWithColors(string equation)
	{
		List<string> tokens = TokenizeEquation(equation);
		string result = "";

		for (int i = 0; i < tokens.Count; i++)
		{
			string token = tokens[i];
			Color color = GetColorForToken(token);

			// Convert color to hex
			string hexColor = ColorUtility.ToHtmlStringRGB(color);
			result += $"<color=#{hexColor}>{token}</color>";

			// Add spacing
			if (i < tokens.Count - 1)
			{
				string nextToken = tokens[i + 1];
				if (nextToken == "(")
				{
					result += ""; // No space before parenthesis
				}
				else
				{
					result += " ";
				}
			}
		}

		return result;
	}

	private IEnumerator AnimateMoveOnly()
	{
		SolutionStep currentStep = steps[currentStepIndex];

		if (currentStep == null)
		{
			yield break;
		}

		int moveValue = currentStep.movingTermId;
		bool movingLeft = !currentStep.movingToRight; // false = moving right, true = moving left

		TextElement movingElement = null;
		TextElement operatorBefore = null;

		// Determine what type of value we're moving
		bool isVariable = Mathf.Abs(moveValue) >= 100;
		bool isConstant = Mathf.Abs(moveValue) < 100;

		// Find the element to move
		for (int i = 0; i < activeElements.Count; i++)
		{
			string token = activeElements[i].token;

			if (isConstant && token == Mathf.Abs(moveValue).ToString())
			{
				movingElement = activeElements[i];
				if (i > 0 && (activeElements[i - 1].token == "+" || activeElements[i - 1].token == "-"))
				{
					operatorBefore = activeElements[i - 1];
				}
				break;
			}
			else if (isVariable)
			{
				int coef = Mathf.Abs(moveValue) / 100;
				if (Mathf.Abs(moveValue) >= 1000)
				{
					coef = Mathf.Abs(moveValue) / 1000; // Handle left-moving variables
				}
				// Case 1: Token is "14x" as a single token
				if (token.Contains("x"))
				{
					string numPart = token.Replace("x", "");
					if (numPart == coef.ToString() || (numPart == "" && coef == 1))
					{
						movingElement = activeElements[i];
						if (i > 0 && (activeElements[i - 1].token == "+" || activeElements[i - 1].token == "-"))
						{
							operatorBefore = activeElements[i - 1];
						}
						break;
					}
				}
				// Case 2: Token is just "14" followed by "x"
				else if (token == coef.ToString())
				{
					if (i < activeElements.Count - 1 && activeElements[i + 1].token == "x")
					{
						movingElement = activeElements[i];
						if (i > 0 && (activeElements[i - 1].token == "+" || activeElements[i - 1].token == "-"))
						{
							operatorBefore = activeElements[i - 1];
						}
						break;
					}
				}
			}
		}

		if (movingElement == null)
		{
			Debug.LogWarning("Could not find element to move: " + moveValue);
			Debug.Log("Available tokens: " + string.Join(", ", activeElements.ConvertAll(e => e.token)));
			yield break;
		}

		Debug.Log($"Found moving element: token='{movingElement.token}', moveValue={moveValue}, isVariable={isVariable}, movingLeft={movingLeft}");

		// Find equals sign position
		float equalsX = 0;
		foreach (TextElement elem in activeElements)
		{
			if (elem.token == "=")
			{
				equalsX = elem.rect.anchoredPosition.x;
				break;
			}
		}

		// Calculate destination position based on direction
		float destinationX = 0f;
		GameObject destinationOpObj = null;
		TextMeshProUGUI destinationOpText = null;
		GameObject destinationNumObj = null;
		TextMeshProUGUI destinationNumText = null;

		if (movingLeft)
		{
			// Moving to LEFT side - place it BEYOND (to the left of) all existing left elements
			List<TextElement> leftSideElements = activeElements.FindAll(e => e.rect.anchoredPosition.x < equalsX);

			float operatorX;

			if (leftSideElements.Count > 0)
			{
				// Find the LEFTMOST position on the LEFT side
				float minX = 999999f;
				foreach (TextElement elem in leftSideElements)
				{
					float elemLeft = elem.rect.anchoredPosition.x - (elem.text.preferredWidth / 2);
					if (elemLeft < minX) minX = elemLeft;
				}

				// Place operator BEFORE (to the left of) the leftmost element
				operatorX = minX - 100f; // Go beyond the leftmost
			}
			else
			{
				// No existing left side elements - place it before equals sign
				operatorX = equalsX - 120f;
			}

			// For variables moving left, create the destination with minus operator
			int coef = Mathf.Abs(moveValue) / 1000;

			destinationOpObj = Instantiate(textPrefab, equationContainer);
			destinationOpText = destinationOpObj.GetComponent<TextMeshProUGUI>();
			RectTransform opRect = destinationOpObj.GetComponent<RectTransform>();

			destinationOpText.text = "-";
			destinationOpText.fontSize = fontSize;
			destinationOpText.color = operatorColor;
			destinationOpText.alignment = TextAlignmentOptions.Center;
			destinationOpText.alpha = 0;

			opRect.anchoredPosition = new Vector2(operatorX, 0);
			tempAnimationObjects.Add(destinationOpObj);

			destinationNumObj = Instantiate(textPrefab, equationContainer);
			destinationNumText = destinationNumObj.GetComponent<TextMeshProUGUI>();
			RectTransform numRect = destinationNumObj.GetComponent<RectTransform>();

			destinationNumText.text = coef + "x" + "+";
			destinationNumText.fontSize = fontSize;
			destinationNumText.color = variableColor;
			destinationNumText.alignment = TextAlignmentOptions.Center;
			destinationNumText.alpha = 0;

			float variableX = operatorX + 40f;
			numRect.anchoredPosition = new Vector2(variableX, 0);
			destinationX = variableX;
			tempAnimationObjects.Add(destinationNumObj);
		}
		else
		{
			// Moving to RIGHT side
			List<TextElement> rightSideElements = activeElements.FindAll(e => e.rect.anchoredPosition.x > equalsX && e.token != "=");
			destinationX = equalsX + 30f;

			if (rightSideElements.Count > 0)
			{
				float maxX = rightSideElements[0].rect.anchoredPosition.x;
				foreach (TextElement elem in rightSideElements)
				{
					float elemRight = elem.rect.anchoredPosition.x + (elem.text.preferredWidth / 2);
					if (elemRight > maxX)
					{
						maxX = elemRight;
					}
				}
				destinationX = maxX + 30f;
			}

			// Handle coefficient division or constant subtraction
			if (Mathf.Abs(moveValue) >= 100)
			{
				// Coefficient - create division
				int coef = Mathf.Abs(moveValue) / 100;

				destinationOpObj = Instantiate(textPrefab, equationContainer);
				destinationOpText = destinationOpObj.GetComponent<TextMeshProUGUI>();
				RectTransform opRect = destinationOpObj.GetComponent<RectTransform>();

				destinationOpText.text = "/";
				destinationOpText.fontSize = fontSize;
				destinationOpText.color = operatorColor;
				destinationOpText.alignment = TextAlignmentOptions.Center;
				destinationOpText.alpha = 0;

				opRect.anchoredPosition = new Vector2(destinationX, 0);
				tempAnimationObjects.Add(destinationOpObj);

				destinationNumObj = Instantiate(textPrefab, equationContainer);
				destinationNumText = destinationNumObj.GetComponent<TextMeshProUGUI>();
				RectTransform numRect = destinationNumObj.GetComponent<RectTransform>();

				destinationNumText.text = coef.ToString();
				destinationNumText.fontSize = fontSize;
				destinationNumText.color = numberColor;
				destinationNumText.alignment = TextAlignmentOptions.Center;
				destinationNumText.alpha = 0;

				numRect.anchoredPosition = new Vector2(destinationX + 40f, 0);
				destinationX = numRect.anchoredPosition.x;
				tempAnimationObjects.Add(destinationNumObj);
			}
			else
			{
				// Constant - create subtraction
				int constVal = moveValue;

				destinationOpObj = Instantiate(textPrefab, equationContainer);
				destinationOpText = destinationOpObj.GetComponent<TextMeshProUGUI>();
				RectTransform opRect = destinationOpObj.GetComponent<RectTransform>();

				destinationOpText.text = "-";
				destinationOpText.fontSize = fontSize;
				destinationOpText.color = operatorColor;
				destinationOpText.alignment = TextAlignmentOptions.Center;
				destinationOpText.alpha = 0;

				opRect.anchoredPosition = new Vector2(destinationX, 0);
				tempAnimationObjects.Add(destinationOpObj);

				destinationNumObj = Instantiate(textPrefab, equationContainer);
				destinationNumText = destinationNumObj.GetComponent<TextMeshProUGUI>();
				RectTransform numRect = destinationNumObj.GetComponent<RectTransform>();

				destinationNumText.text = Mathf.Abs(constVal).ToString();
				destinationNumText.fontSize = fontSize;
				destinationNumText.color = numberColor;
				destinationNumText.alignment = TextAlignmentOptions.Center;
				destinationNumText.alpha = 0;

				numRect.anchoredPosition = new Vector2(destinationX + 40f, 0);
				destinationX = numRect.anchoredPosition.x;
				tempAnimationObjects.Add(destinationNumObj);
			}
		}

		// Prepare the element to animate
		TextMeshProUGUI elementToAnimate = movingElement.text;
		RectTransform elementRect = movingElement.rect;

		// Special handling for coefficients moving right (split 3x into 3 and x)
		if (!movingLeft && Mathf.Abs(moveValue) >= 100 && movingElement.token.Contains("x"))
		{
			int coef = Mathf.Abs(moveValue) / 100;

			GameObject tempCoefObj = Instantiate(textPrefab, equationContainer);
			TextMeshProUGUI tempCoefText = tempCoefObj.GetComponent<TextMeshProUGUI>();
			RectTransform tempCoefRect = tempCoefObj.GetComponent<RectTransform>();

			tempCoefText.text = coef.ToString();
			tempCoefText.fontSize = fontSize;
			tempCoefText.color = numberColor;
			tempCoefText.alignment = TextAlignmentOptions.Center;

			tempCoefRect.anchoredPosition = movingElement.rect.anchoredPosition;
			movingElement.text.text = "x";

			elementToAnimate = tempCoefText;
			elementRect = tempCoefRect;

			tempAnimationObjects.Add(tempCoefObj);
		}

		// Highlight
		elementToAnimate.DOColor(Color.yellow, (0.3f / moveSpeed)).SetLoops(2, LoopType.Yoyo);
		if (operatorBefore != null)
		{
			operatorBefore.text.DOColor(Color.yellow, (0.3f / moveSpeed)).SetLoops(2, LoopType.Yoyo);
		}

		yield return new WaitForSeconds(0.6f / moveSpeed);

		// Animate the move
		float arcHeight = 120f;
		float totalDuration = animationDuration / moveSpeed;

		Sequence moveSeq = DOTween.Sequence();
		moveSeq.Append(elementRect.DOAnchorPosY(arcHeight, totalDuration * 0.4f).SetEase(Ease.OutQuad));
		moveSeq.Join(elementRect.DOAnchorPosX(destinationX, totalDuration).SetEase(moveEase));
		moveSeq.Append(elementRect.DOAnchorPosY(0, totalDuration * 0.4f).SetEase(Ease.InQuad));

		moveSeq.InsertCallback(totalDuration * 0.8f, () =>
		{
			elementToAnimate.DOFade(0, totalDuration * 0.2f);

			if (destinationOpText != null)
			{
				destinationOpText.DOFade(1, 0.3f / moveSpeed);
			}

			if (destinationNumText != null)
			{
				destinationNumText.DOFade(1, 0.3f / moveSpeed);
			}
		});

		if (operatorBefore != null)
		{
			RectTransform opRect = operatorBefore.rect;
			TextMeshProUGUI opText = operatorBefore.text;

			opRect.DOAnchorPosY(arcHeight, totalDuration * 0.4f).SetEase(Ease.OutQuad);
			opRect.DOAnchorPosX(destinationX - 40, totalDuration).SetEase(moveEase);
			opRect.DOAnchorPosY(0, totalDuration * 0.4f).SetEase(Ease.InQuad).SetDelay(totalDuration * 0.4f);
			opText.DOFade(0, totalDuration * 0.3f).SetDelay(totalDuration * 0.6f);
		}

		yield return moveSeq.WaitForCompletion();
	}

	private IEnumerator AnimateMove(SolutionStep fromStep, SolutionStep toStep)
	{
		yield return new WaitForSeconds(0.3f / moveSpeed);

		int moveValue = toStep.movingTermId;

		TextElement movingElement = null;
		TextElement operatorBefore = null;

		// Find the number element that matches the move value
		for (int i = 0; i < activeElements.Count; i++)
		{
			string token = activeElements[i].token;

			// For constants (like 5), find the matching number
			if (moveValue < 100 && token == Mathf.Abs(moveValue).ToString())
			{
				movingElement = activeElements[i];

				// Check if there's an operator before it
				if (i > 0 && (activeElements[i - 1].token == "+" || activeElements[i - 1].token == "-"))
				{
					operatorBefore = activeElements[i - 1];
				}
				break;
			}
			// For coefficients (like 3 from 3x), look for the coefficient part
			else if (moveValue >= 100)
			{
				int coef = moveValue / 100;
				// Look for the number before 'x'
				if (token == coef.ToString() && i < activeElements.Count - 1 && activeElements[i + 1].token == "x")
				{
					movingElement = activeElements[i];
					break;
				}
				else if (token == coef.ToString())
				{
					movingElement = activeElements[i];
					break;
				}
			}
		}

		if (movingElement == null)
		{
			Debug.LogWarning("Could not find moving element for value: " + moveValue);
			ClearAllText();
			yield return StartCoroutine(DisplayEquation(toStep.equationString));
			yield break;
		}

		// Highlight the moving element(s)
		movingElement.text.DOColor(Color.yellow, (0.3f / moveSpeed)).SetLoops(2, LoopType.Yoyo);

		if (operatorBefore != null)
		{
			operatorBefore.text.DOColor(Color.yellow, (0.3f / moveSpeed)).SetLoops(2, LoopType.Yoyo);
		}

		yield return new WaitForSeconds(0.6f / moveSpeed);

		// Find equals sign position
		float equalsX = 0;
		foreach (TextElement elem in activeElements)
		{
			if (elem.token == "=")
			{
				equalsX = elem.rect.anchoredPosition.x;
				break;
			}
		}

		// Calculate target position on the other side
		Vector2 startPos = movingElement.rect.anchoredPosition;
		float targetX = equalsX + 150;

		// Determine the arc height and duration based on moveSpeed
		float arcHeight = 120f;
		float totalDuration = animationDuration / moveSpeed;

		Sequence moveSeq = DOTween.Sequence();

		moveSeq.Append(movingElement.rect.DOAnchorPosY(arcHeight, totalDuration * 0.4f).SetEase(Ease.OutQuad));
		moveSeq.Join(movingElement.rect.DOAnchorPosX(targetX, totalDuration).SetEase(moveEase));
		moveSeq.Append(movingElement.rect.DOAnchorPosY(0, totalDuration * 0.4f).SetEase(Ease.InQuad));
		moveSeq.Join(movingElement.text.DOFade(0, totalDuration * 0.2f).SetDelay(totalDuration * 0.6f));

		// Animate operator if present
		if (operatorBefore != null)
		{
			operatorBefore.rect.DOAnchorPosY(arcHeight, totalDuration * 0.4f).SetEase(Ease.OutQuad);
			operatorBefore.rect.DOAnchorPosX(targetX - 40, totalDuration).SetEase(moveEase);
			operatorBefore.rect.DOAnchorPosY(0, totalDuration * 0.4f).SetEase(Ease.InQuad).SetDelay(totalDuration * 0.4f);
			operatorBefore.text.DOFade(0, totalDuration * 0.2f).SetDelay(totalDuration * 0.6f);
		}

		yield return moveSeq.WaitForCompletion();
		yield return new WaitForSeconds(0.3f / moveSpeed);

		ClearAllText();
		yield return StartCoroutine(DisplayEquation(toStep.equationString));
	}

	private IEnumerator DisplayEquation(string equation)
	{
		ClearAllText();

		// Split equation into left and right sides for fixed equals sign positioning
		string[] sides = equation.Split('=');
		string leftSide = sides.Length > 0 ? sides[0].Trim() : "";
		string rightSide = sides.Length > 1 ? sides[1].Trim() : "";

		// Create left side text (right-aligned to equals sign)
		GameObject leftObj = Instantiate(textPrefab, equationContainer);
		TextMeshProUGUI leftText = leftObj.GetComponent<TextMeshProUGUI>();
		RectTransform leftRect = leftObj.GetComponent<RectTransform>();

		leftRect.anchorMin = new Vector2(0.5f, 0.5f);
		leftRect.anchorMax = new Vector2(0.5f, 0.5f);
		leftRect.pivot = new Vector2(1f, 0.5f); // Right-aligned pivot
		leftRect.anchoredPosition = new Vector2(-30f, 0); // Position to left of center

		leftText.text = FormatSideWithColors(leftSide);
		leftText.fontSize = fontSize;
		leftText.alignment = TextAlignmentOptions.Right;

		leftText.alpha = 0;
		leftText.DOFade(1, fadeInDuration);
		leftRect.localScale = Vector3.one * 0.7f;
		leftRect.DOScale(1f, fadeInDuration).SetEase(Ease.OutBack);

		activeElements.Add(new TextElement { obj = leftObj, text = leftText, rect = leftRect, token = leftSide });

		// Create equals sign (fixed center position)
		GameObject equalsObj = Instantiate(textPrefab, equationContainer);
		TextMeshProUGUI equalsTextComp = equalsObj.GetComponent<TextMeshProUGUI>();
		RectTransform equalsRect = equalsObj.GetComponent<RectTransform>();

		equalsRect.anchorMin = new Vector2(0.5f, 0.5f);
		equalsRect.anchorMax = new Vector2(0.5f, 0.5f);
		equalsRect.pivot = new Vector2(0.5f, 0.5f);
		equalsRect.anchoredPosition = new Vector2(0, 0); // Fixed center

		equalsTextComp.text = "=";
		equalsTextComp.fontSize = fontSize;
		equalsTextComp.color = equalsColor;
		equalsTextComp.alignment = TextAlignmentOptions.Center;

		equalsTextComp.alpha = 0;
		equalsTextComp.DOFade(1, fadeInDuration);
		equalsRect.localScale = Vector3.one * 0.7f;
		equalsRect.DOScale(1f, fadeInDuration).SetEase(Ease.OutBack);

		activeElements.Add(new TextElement { obj = equalsObj, text = equalsTextComp, rect = equalsRect, token = "=" });

		// Create right side text (left-aligned from equals sign)
		GameObject rightObj = Instantiate(textPrefab, equationContainer);
		TextMeshProUGUI rightText = rightObj.GetComponent<TextMeshProUGUI>();
		RectTransform rightRect = rightObj.GetComponent<RectTransform>();

		rightRect.anchorMin = new Vector2(0.5f, 0.5f);
		rightRect.anchorMax = new Vector2(0.5f, 0.5f);
		rightRect.pivot = new Vector2(0f, 0.5f); // Left-aligned pivot
		rightRect.anchoredPosition = new Vector2(30f, 0); // Position to right of center

		rightText.text = FormatSideWithColors(rightSide);
		rightText.fontSize = fontSize;
		rightText.alignment = TextAlignmentOptions.Left;

		rightText.alpha = 0;
		rightText.DOFade(1, fadeInDuration);
		rightRect.localScale = Vector3.one * 0.7f;
		rightRect.DOScale(1f, fadeInDuration).SetEase(Ease.OutBack);

		activeElements.Add(new TextElement { obj = rightObj, text = rightText, rect = rightRect, token = rightSide });

		yield return new WaitForSeconds(fadeInDuration);
	}

	private List<string> TokenizeEquation(string equation)
	{
		List<string> tokens = new List<string>();
		string current = "";

		for (int i = 0; i < equation.Length; i++)
		{
			char c = equation[i];

			if (c == ' ')
			{
				if (current != "")
				{
					tokens.Add(current);
					current = "";
				}
				continue;
			}

			if (c == '=' || c == '/' || c == '(' || c == ')')
			{
				if (current != "")
				{
					tokens.Add(current);
					current = "";
				}
				tokens.Add(c.ToString());
			}
			else if (c == '+' || c == '-')
			{
				// Always treat + and - as separate tokens (operators)
				// Exception: if it's at the start or after an operator/equals (negative number)
				bool isSign = current == "" && (tokens.Count == 0 ||
					tokens[tokens.Count - 1] == "=" ||
					tokens[tokens.Count - 1] == "(" ||
					tokens[tokens.Count - 1] == "+" ||
					tokens[tokens.Count - 1] == "-");

				if (isSign)
				{
					// This is a sign for a number, not an operator
					current += c;
				}
				else
				{
					if (current != "")
					{
						tokens.Add(current);
						current = "";
					}
					tokens.Add(c.ToString());
				}
			}
			else
			{
				current += c;
			}
		}

		if (current != "")
		{
			tokens.Add(current);
		}

		return tokens;
	}

	private Color GetColorForToken(string token)
	{
		if (token == "=")
		{
			return equalsColor;
		}

		if (token == "+" || token == "-" || token == "/" || token == "(" || token == ")")
		{
			return operatorColor;
		}

		if (token.Contains("x"))
		{
			return variableColor;
		}

		return numberColor;
	}

	private float CalculateWidth(List<string> tokens)
	{
		GameObject tempObj = Instantiate(textPrefab, equationContainer);
		TextMeshProUGUI textMeshProUGUI = tempObj.GetComponent<TextMeshProUGUI>();
		textMeshProUGUI.fontSize = fontSize;

		float width = 0;
		for (int i = 0; i < tokens.Count; i++)
		{
			string token = tokens[i];
			textMeshProUGUI.text = token;
			textMeshProUGUI.ForceMeshUpdate();

			width += textMeshProUGUI.preferredWidth;

			if (i < tokens.Count - 1)
			{
				string nextToken = tokens[i + 1];

				if (nextToken == "(")
				{
					width += 5f;
				}
				else
				{
					width += 20f;
				}
			}
		}

		Destroy(tempObj);
		return width;
	}

	private float CreateTextElement(string token, float xPosition, Color color)
	{
		GameObject obj = Instantiate(textPrefab, equationContainer);
		TextMeshProUGUI textMeshProUGUI = obj.GetComponent<TextMeshProUGUI>();
		RectTransform rect = obj.GetComponent<RectTransform>();

		textMeshProUGUI.text = token;
		textMeshProUGUI.fontSize = fontSize;
		textMeshProUGUI.color = color;
		textMeshProUGUI.alignment = TextAlignmentOptions.Center;

		rect.anchoredPosition = new Vector2(xPosition, 0);

		textMeshProUGUI.alpha = 0;
		textMeshProUGUI.DOFade(1, fadeInDuration);

		rect.localScale = Vector3.one * 0.7f;
		rect.DOScale(1f, fadeInDuration).SetEase(Ease.OutBack);

		TextElement elem = new TextElement
		{
			obj = obj,
			text = textMeshProUGUI,
			rect = rect,
			token = token
		};

		activeElements.Add(elem);
		textMeshProUGUI.ForceMeshUpdate();

		// NO SPACING HERE - return just position + width
		return xPosition + textMeshProUGUI.preferredWidth;
	}

	private void ClearAllText()
	{
		foreach (TextElement elem in activeElements)
		{
			if (elem.obj != null)
			{
				Destroy(elem.obj);
			}
		}
		activeElements.Clear();

		foreach (GameObject obj in tempAnimationObjects)
		{
			if (obj != null)
			{
				Destroy(obj);
			}
		}
		tempAnimationObjects.Clear();
	}

	private void ClearAllStepsContainer()
	{
		foreach (GameObject obj in allStepsObjects)
		{
			if (obj != null)
			{
				Destroy(obj);
			}
		}
		allStepsObjects.Clear();
	}

	public void PlayAll()
	{
		StartCoroutine(PlayAllCoroutine());
	}

	private IEnumerator PlayAllCoroutine()
	{
		currentStepIndex = -1;
		ClearAllText();

		while (currentStepIndex < steps.Count - 1)
		{
			NextStep();
			yield return new WaitUntil(() => !isAnimating);
			yield return new WaitForSeconds(1.5f);
		}
	}

	public void Reset()
	{
		ClearAllText();
		ClearAllStepsContainer();
		currentStepIndex = -1;

		if (choiceSystem != null)
		{
			choiceSystem.ClearOptions();
		}

		if (steps.Count > 0)
		{
			NextStep();
		}
	}

	#region Player Choice System Integration

	private void InitializeChoiceSystem()
	{
		if (choiceSystem != null)
		{
			choiceSystem.OnOptionSelected += HandleOptionSelected;
		}

		if (dragController != null)
		{
			dragController.OnDragOperationComplete += HandleDragOperationComplete;
		}
	}

	private void OnDestroy()
	{
		UnbindUiButtons();
		HideCheckpointPrompt();

		if (choiceSystem != null)
		{
			choiceSystem.OnOptionSelected -= HandleOptionSelected;
		}

		if (dragController != null)
		{
			dragController.OnDragOperationComplete -= HandleDragOperationComplete;
		}
	}

	private void HandleOptionSelected(StepOption option)
	{
		// Handle bracket expansion specially
		if (option.operationType == OperationType.ExpandBrackets)
		{
			StartCoroutine(ContinueAfterBracketExpansionCoroutine());
			OnOptionSelected?.Invoke(option);
			return;
		}

		// Use the state BEFORE the option was applied (stored in EquationChoiceSystem)
		EquationState stateBefore = choiceSystem.StateBeforeLastOption;
		EquationState stateAfter = choiceSystem.CurrentState;

		// Generate the step for the selected option using the state BEFORE applying
		string operationStep = choiceSystem.CreateOperationStepString(stateBefore, option);
		string simplifiedStep = FormatEquation(stateAfter);

		// Add the operation step
		steps.Add(new SolutionStep(operationStep, option.description, false));

		// Add the simplified result step
		if (operationStep != simplifiedStep)
		{
			steps.Add(new SolutionStep(simplifiedStep, "Simplify", false));
		}

		// Trigger event
		OnOptionSelected?.Invoke(option);

		// Start coroutine to advance and then show next options
		StartCoroutine(AdvanceAndShowOptions());
	}

	private IEnumerator AdvanceAndShowOptions()
	{
		// Advance to show the operation step
		NextStep();
		yield return new WaitUntil(() => !isAnimating);

		// If there's a simplify step, show it too
		if (currentStepIndex < steps.Count - 1 && steps[currentStepIndex + 1].description == "Simplify")
		{
			yield return new WaitForSeconds(0.5f);
			NextStep();
			yield return new WaitUntil(() => !isAnimating);
		}

		yield return new WaitForSeconds(0.3f);

		EquationState currentState = choiceSystem.CurrentState;

		// Check if solved
		if (currentState.IsSolved())
		{
			// Add final step if needed
			string finalStep = FormatEquation(currentState);
			string solvedValueText = ResolveSolvedValueText(currentState);

			if (steps[steps.Count - 1].equationString != finalStep)
			{
				steps.Add(new SolutionStep(finalStep, $"Solution: x = {solvedValueText}", false));
				NextStep();
			}

			SetStepDescriptionText($"Solved! x = {solvedValueText}");

			// Trigger loading next equation
			OnEquationSolved();
			yield break;
		}

		// Only show options immediately if not waiting for rhythm hits
		if (!advanceStepsOnBroadcastHit)
		{
			// Use appropriate input mode
			if ((inputMode == InputMode.DragExecution || inputMode == InputMode.BubbleDrag) && dragController != null)
			{
				yield return new WaitForSeconds(0.3f);
			}
			else
			{
				choiceSystem.DisplayCurrentOptions();
			}
		}
	}

	/// Starts interactive solving mode where player chooses each step
	public void StartInteractiveSolve()
	{
		// Block only when the shared tutorial gate says this scene is currently locked.
		if (EquationTutorialController.ShouldBlockGameplayForTutorial())
		{
			return;
		}

		if (choiceSystem == null)
		{
			Debug.LogWarning("EquationChoiceSystem not assigned. Cannot start interactive solve.");
			return;
		}

		if (string.IsNullOrEmpty(equationInput.text))
		{
			Debug.LogWarning("Equation input is empty.");
			return;
		}

		if (!TryCreateEquationState(equationInput != null ? equationInput.text : string.Empty, out string normalizedEquation, out EquationState initialState))
		{
			Debug.LogError($"Invalid or unsupported equation format: '{equationInput.text}'.");
			return;
		}

		Debug.Log($"Parsing equation: '{equationInput.text}' -> '{normalizedEquation}'");

		steps.Clear();
		currentStepIndex = -1;
		ClearAllStepsContainer();
		choiceSystem.ClearOptions();

		// Add starting equation
		steps.Add(new SolutionStep(FormatEquation(initialState), "Starting equation"));

		// DragExecution is aliased to bubble drag mode.
		if ((inputMode == InputMode.BubbleDrag || inputMode == InputMode.DragExecution) && dragController != null)
		{
			// Ensure no legacy equation TMPs are lingering in the equation container
			ClearAllText();

			ApplyInteractiveStartDescriptionText();

			dragController.InitializeWithState(initialState.Clone());

			Debug.Log("LinearEquationSolver: Initialized bubble drag system");
			return;
		}

		choiceSystem.Initialize(initialState.Clone());

		// Show the starting equation
		NextStep();

		// Only show options immediately if not waiting for rhythm hits
		if (!advanceStepsOnBroadcastHit && !choiceSystem.CurrentState.IsSolved())
		{
			choiceSystem.DisplayCurrentOptions();
		}
	}

	private void ApplyInteractiveStartDescriptionText()
	{
		ApplyStepDescriptionFontLock();

		if (!overwriteStepDescriptionOnInteractiveStart || stepDescriptionText == null)
		{
			return;
		}

		if (skipStartDescriptionOverwriteAfterTutorial
			&& !string.IsNullOrWhiteSpace(tutorialCompletionPrefKey)
			&& PlayerPrefs.GetInt(tutorialCompletionPrefKey, 0) == 1)
		{
			return;
		}

		if (string.IsNullOrWhiteSpace(interactiveStartDescriptionText))
		{
			return;
		}

		SetStepDescriptionText(interactiveStartDescriptionText);
	}

	private void SetStepDescriptionText(string value)
	{
		if (stepDescriptionText == null)
		{
			return;
		}

		ApplyStepDescriptionFontLock();
		stepDescriptionText.text = value ?? string.Empty;
	}

	private void ApplyStepDescriptionFontLock()
	{
		if (!lockStepDescriptionFontSize || stepDescriptionText == null)
		{
			return;
		}

		float lockedSize = Mathf.Max(1f, stepDescriptionLockedFontSize);
		stepDescriptionText.enableAutoSizing = false;
		stepDescriptionText.fontSize = lockedSize;
		stepDescriptionText.fontSizeMin = lockedSize;
		stepDescriptionText.fontSizeMax = lockedSize;
	}

	private IEnumerator ContinueAfterBracketExpansionCoroutine()
	{
		EquationState currentState = choiceSystem.CurrentState;
		if (currentState == null)
		{
			yield break;
		}

		string expandedEquation = !string.IsNullOrWhiteSpace(currentState.rawEquation)
			? currentState.rawEquation
			: FormatEquation(currentState);

		// Add expansion step
		steps.Add(new SolutionStep(expandedEquation, "Expand brackets using distributive property"));

		// Check if we need combine like terms step
		string simplified = FormatEquation(currentState);

		bool needsCombineStep = EquationStringUtil.NormalizeForParsing(expandedEquation) != EquationStringUtil.NormalizeForParsing(simplified);
		if (needsCombineStep)
		{
			steps.Add(new SolutionStep(simplified, "Combine like terms"));
		}

		// Show expansion step
		NextStep();
		yield return new WaitUntil(() => !isAnimating);

		// Show combine like terms step if needed
		if (needsCombineStep)
		{
			yield return new WaitForSeconds(0.5f);
			NextStep();
			yield return new WaitUntil(() => !isAnimating);
		}

		yield return new WaitForSeconds(0.3f);

		// Generate options for next move
		if (!choiceSystem.CurrentState.IsSolved())
		{
			choiceSystem.DisplayCurrentOptions();
		}
	}

	/// Advances to the next step and shows options if in interactive mode
	public void NextStepInteractive()
	{
		if (isAnimating || choiceSystem == null) return;

		EquationState currentState = choiceSystem.CurrentState;

		if (currentState != null && currentState.IsSolved())
		{
			// Equation is solved, no more options
			if (currentStepIndex < steps.Count - 1)
			{
				NextStep();
			}
			return;
		}

		// Check if we need to handle bracket expansion
		if (currentState != null && currentState.hasBrackets)
		{
			StartCoroutine(ContinueAfterBracketExpansionCoroutine());
			return;
		}

		// Generate and show options
		if (currentState != null && !currentState.IsSolved())
		{
			choiceSystem.DisplayCurrentOptions();
		}
	}

	/// Check if currently waiting for player input
	public bool IsWaitingForChoice()
	{
		return choiceSystem != null && choiceSystem.IsWaitingForChoice;
	}

	/// Get current available options
	public List<StepOption> GetCurrentOptions()
	{
		if (choiceSystem == null) return new List<StepOption>();
		return choiceSystem.CurrentOptions;
	}

	#endregion

	#region Equation Data Set
	[SerializeField] private bool useEquationCountForLockedReferenceProgress = false;

	private void UpdateLockedEquationProgress(bool pulse)
	{
		if (!useEquationCountForLockedReferenceProgress || dragController == null)
		{
			return;
		}

		float baseProgress = 0f;
		float segmentSpan = 0f;
		if (UsesEndlessCheckpointMode)
		{
			int batchSize = Mathf.Max(1, checkpointBatchSize);
			baseProgress = Mathf.Clamp01(equationsSolvedInCurrentBatch / (float)batchSize);
			segmentSpan = 1f / batchSize;
		}
		else if (totalEquationsToSolve > 0)
		{
			baseProgress = Mathf.Clamp01(equationsSolvedCount / (float)totalEquationsToSolve);
			segmentSpan = 1f / totalEquationsToSolve;
		}

		dragController.SetLockedProgress01(baseProgress, segmentSpan, pulse);
	}

	/// Load a random equation from the data set based on selected difficulty
	public void LoadRandomEquation()
	{
		EnsureEquationDataSet();
		if (equationDataSet == null)
		{
			Debug.LogWarning("EquationDataSet not assigned.");
			return;
		}

		EquationEntry entry = equationDataSet.GetRandomEntry(selectedDifficulty);
		string equation = entry != null ? entry.GetNormalizedEquation() : string.Empty;
		if (!string.IsNullOrEmpty(equation) && equationInput != null)
		{
			currentEquationEntry = entry;
			equationInput.text = equation;
			StartInteractiveSolve();
			UpdateLockedEquationProgress(false);
			EquationLoaded?.Invoke(entry, equation, selectedDifficulty);
		}
	}

	/// Load the next equation in the sequence, clearing all previous steps
	public void LoadNextEquation()
	{
		EnsureEquationDataSet();
		if (waitingForCheckpointChoice)
		{
			return;
		}

		if (!UsesEndlessCheckpointMode && equationsSolvedCount >= totalEquationsToSolve)
		{
			Debug.Log($"All {totalEquationsToSolve} equations completed!");
			SetStepDescriptionText($"Completed all {totalEquationsToSolve} equations!");
			return;
		}

		// Clear all current state
		ClearAllText();
		ClearAllStepsContainer();
		steps.Clear();
		currentStepIndex = -1;

		if (choiceSystem != null)
		{
			choiceSystem.ClearOptions();
		}

		if (!TryLoadNextEquationIntoBoard())
		{
			Debug.LogWarning($"No equations available for difficulty {selectedDifficulty}");
		}
	}

	/// Called when an equation is solved to trigger loading the next one
	private void OnEquationSolved()
	{
		equationsSolvedCount++;
		if (UsesEndlessCheckpointMode)
		{
			equationsSolvedInCurrentBatch++;
			UpdateLockedEquationProgress(true);
			Debug.Log($"Equation solved! total={equationsSolvedCount}, batch={equationsSolvedInCurrentBatch}/{Mathf.Max(1, checkpointBatchSize)}, set={GetCurrentDifficultySetLabel()}");

			if (equationsSolvedInCurrentBatch >= Mathf.Max(1, checkpointBatchSize))
			{
				completedCheckpointBatches++;
				SetStepDescriptionText($"Equation run clear. {equationsSolvedCount} equations solved.");

				if (promptForDifficultyAdjustment)
				{
					waitingForCheckpointChoice = true;
					ShowCheckpointPrompt();
					return;
				}

				equationsSolvedInCurrentBatch = 0;
			}

			StartCoroutine(LoadNextEquationAfterDelay());
			return;
		}

		Debug.Log($"Equation solved! ({equationsSolvedCount}/{totalEquationsToSolve})");
		UpdateLockedEquationProgress(true);

		if (equationsSolvedCount < totalEquationsToSolve)
		{
			StartCoroutine(LoadNextEquationAfterDelay());
		}
		else
		{
			SetStepDescriptionText($"Completed all {totalEquationsToSolve} equations!");
			Debug.Log($"All {totalEquationsToSolve} equations completed!");
		}
	}

	private IEnumerator LoadNextEquationAfterDelay()
	{
		if (waitingForCheckpointChoice)
		{
			yield break;
		}

		if (UsesEndlessCheckpointMode)
		{
			int nextBatchEquation = Mathf.Clamp(equationsSolvedInCurrentBatch + 1, 1, Mathf.Max(1, checkpointBatchSize));
			SetStepDescriptionText($"Priming next equation... {nextBatchEquation}/{Mathf.Max(1, checkpointBatchSize)}");
		}
		else
		{
			SetStepDescriptionText($"Equation solved! Loading next... ({equationsSolvedCount}/{totalEquationsToSolve})");
		}

		yield return new WaitForSeconds(delayBetweenEquations);
		LoadNextEquation();
	}

	/// Get current progress
	public int GetEquationsSolved() => equationsSolvedCount;
	public int GetTotalEquations() => UsesEndlessCheckpointMode ? Mathf.Max(1, checkpointBatchSize) : totalEquationsToSolve;

	/// Reset the equation sequence to start fresh
	public void ResetEquationSequence()
	{
		ResetSessionState();
		LoadInitialEquation();
	}

	/// Load a specific equation from the data set
	public void LoadEquation(EquationDataSet.SchoolYear difficulty, int index)
	{
		EnsureEquationDataSet();
		if (equationDataSet == null)
		{
			Debug.LogWarning("EquationDataSet not assigned.");
			return;
		}

		List<EquationEntry> entries = equationDataSet.GetEntriesForYear(difficulty);
		if (index >= 0 && index < entries.Count && equationInput != null)
		{
			SetDifficulty(difficulty);
			currentEquationEntry = entries[index];
			equationInput.text = currentEquationEntry.GetNormalizedEquation();
			StartInteractiveSolve();
			UpdateLockedEquationProgress(false);
			EquationLoaded?.Invoke(currentEquationEntry, currentEquationEntry.GetNormalizedEquation(), selectedDifficulty);
		}
	}

	/// Set the difficulty level
	public void SetDifficulty(EquationDataSet.SchoolYear difficulty)
	{
		selectedDifficulty = difficulty;
		AlgebraRuntimeConfig.SetSchoolYear(difficulty);
		ResetDifficultyCursor();
	}

	#endregion

	#region Input Mode

	public InputMode CurrentInputMode => inputMode;
	public bool UsesEndlessCheckpointMode => sessionMode == EquationSessionMode.EndlessCheckpoint;
	public bool SuppressResultsOverlay => suppressResultsScreen;

	public void SetInputMode(InputMode mode)
	{
		// Deactivate current mode if switching
		if (inputMode != mode)
		{
			if ((inputMode == InputMode.DragExecution || inputMode == InputMode.BubbleDrag) && dragController != null)
			{
				dragController.Deactivate();
			}

			if (inputMode == InputMode.ChoiceButtons && choiceSystem != null)
			{
				choiceSystem.ClearOptions();
			}
		}

		inputMode = mode;

		Debug.Log($"LinearEquationSolver: Input mode set to {mode}");
	}

	public void ToggleInputMode()
	{
		// Cycle through modes: ChoiceButtons -> DragExecution -> BubbleDrag -> ChoiceButtons
		InputMode newMode;
		switch (inputMode)
		{
			case InputMode.ChoiceButtons:
				newMode = InputMode.DragExecution;
				break;
			case InputMode.DragExecution:
				newMode = InputMode.BubbleDrag;
				break;
			default:
				newMode = InputMode.ChoiceButtons;
				break;
		}

		SetInputMode(newMode);
	}

	/// Sets the input mode directly to bubble drag.
	public void UseBubbleDragMode()
	{
		SetInputMode(InputMode.BubbleDrag);
	}

	public DragExecutionController GetDragController() => dragController;

	#endregion
}
