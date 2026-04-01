using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using TMPro;
using DG.Tweening;


// Run before gameplay bootstrap behaviours so tutorial can take over the equation UI first.
[DefaultExecutionOrder(-50)]
public class EquationTutorialController : MonoBehaviour
{
	public static EquationTutorialController Instance { get; private set; }
	private static bool hasLoggedFallbackBypass;

	// ── Core References ──────────────────────────────────────────────
	[Header("Core References")]
	[SerializeField] private DragExecutionController dragController;
	[SerializeField] private TutorialManager tutorialManager;
	[SerializeField] private Canvas tutorialCanvas;

	[Header("Shared Prefabs (same objects assigned on DragExecutionController)")]
	[Tooltip("The same bubbleElementPrefab used by DragExecutionController.")]
	[SerializeField] private GameObject bubbleElementPrefab;
	[Tooltip("The same equationContainer RectTransform used by DragExecutionController.")]
	[SerializeField] private RectTransform equationContainer;

	// ── Step 1: Equation Display ─────────────────────────────────────
	[Header("Step 1 – Equation Display")]
	[Tooltip("Color for the variable 'x'. Should match DragExecutionController.variableColor.")]
	[SerializeField] private Color variableColor = new Color(1f, 0.4f, 0.4f, 1f);
	[SerializeField] private Color numberColor = Color.white;
	[SerializeField] private Color operatorColor = new Color(0.7f, 0.7f, 0.7f, 1f);
	[SerializeField] private GameObject solveForXText = null;
	[SerializeField] private GameObject howToPrompt = null;

	[Header("Step 2 – Show LockedEquationUI")]
	private Renderer solvedEquationRenderer;

	// ── Step 4: Drag Practice ────────────────────────────────────────
	[Header("Step 4 – Drag Practice")]
	[SerializeField] private int requiredDrags = 5;
	[SerializeField] private float dragThreshold = 50f;
	[SerializeField] private TextMeshProUGUI dragCountText;

	// ── Constants ────────────────────────────────────────────────────
	private const string AlgebraTutorialPrefKey = "AlgebraTutorialCompleted";
	private const string TutorialEquation = "x + 2 = 7";
	private const string SolvedEquation = "x = 5";

	// ── Runtime State ────────────────────────────────────────────────
	private int currentStepIndex = -1;
	private int tutorialDragCount;
	private bool step3DragDetected;
	private RectTransform originalDragControllerEquationContainer;
	private RectTransform originalDragControllerProgressMeterContainer;
	private RectTransform tutorialProgressMeterContainer;
	private bool hasOverriddenDragControllerEquationContainer;
	private bool hasOverriddenDragControllerProgressMeterContainer;

	// Gameplay gating – disable any progression runtime while the tutorial owns the equation UI.
	private Behaviour cachedProgressionSourceBehaviour;

	// Step-1 manually spawned visuals (cleaned up when Step 2 starts)
	private readonly List<GameObject> step1Bubbles = new List<GameObject>();
	private readonly List<GameObject> step1OperatorLabels = new List<GameObject>();

	// Step-4 drag interception
	private EquationBubbleElement interceptedBubble;
	private TutorialBubbleDragProxy dragProxy;
	private Vector2 interceptedOriginalPos;

	// Animation tracking
	private Tween currentTween;
	private Coroutine waitForAnimCoroutine;
	private Coroutine step3SetupCoroutine;

	// ── Nested proxy for Step-4 drag interception ────────────────────
	private sealed class TutorialBubbleDragProxy : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
	{
		private EquationTutorialController owner;

		public void Initialize(EquationTutorialController controller) => owner = controller;

		public void OnBeginDrag(PointerEventData eventData) => owner?.OnTutorialBeginDrag(eventData);
		public void OnDrag(PointerEventData eventData) => owner?.OnTutorialDrag(eventData);
		public void OnEndDrag(PointerEventData eventData) => owner?.OnTutorialEndDrag(eventData);
	}

	// ═══════════════════════════════════════════════════════════════
	// Lifecycle
	// ═══════════════════════════════════════════════════════════════

	private void Awake()
	{
		if (Instance != null && Instance != this)
		{
			Debug.LogWarning("[EquationTutorialController] Duplicate instance destroyed.");
			Destroy(gameObject);
			return;
		}

		Instance = this;

		if (tutorialManager == null) tutorialManager = FindFirstObjectByType<TutorialManager>();
		if (dragController == null) dragController = FindFirstObjectByType<DragExecutionController>();
		if (tutorialCanvas == null) tutorialCanvas = GetComponentInParent<Canvas>();

		bool mainTutorialPending = PlayerPrefs.GetInt("TutorialCompleted", 0) != 1;
		bool algebraTutorialPending = !HasCompletedTutorial();
		bool hasAlgebraGate = FindFirstObjectByType<AlgebraTutorialGate>() != null;

		if (mainTutorialPending && !algebraTutorialPending)
		{
			// Main tutorial will play again but algebra flag is stale — reset it.
			PlayerPrefs.DeleteKey(AlgebraTutorialPrefKey);
			PlayerPrefs.Save();
			algebraTutorialPending = true;
			Debug.Log("[EquationTutorial] Reset stale AlgebraTutorialCompleted flag (main tutorial is pending).");
		}

		if (algebraTutorialPending)
		{
			// When an AlgebraTutorialGate exists, long tutorial startup is intentionally deferred
			// until the gate triggers it. Do not hijack the gameplay equation UI yet, otherwise
			// players can see a stray tutorial symbol/container before the tutorial actually starts.
			if (hasAlgebraGate && !TutorialManager.IsTutorialActive)
			{
				Debug.Log("[EquationTutorial] Tutorial pending, but deferring runtime UI takeover until long tutorial starts via gate.");
				return;
			}

			AcquireTutorialRuntimeControl();
		}
	}

	private void OnEnable() => TutorialManager.StepChanged += OnStepEntered;
	private void OnDisable()
	{
		TutorialManager.StepChanged -= OnStepEntered;
		currentTween?.Kill();
	}

	private void OnDestroy()
	{
		if (Instance == this)
		{
			Instance = null;
		}
		CleanupStep1Visuals();
		RestoreDragController();
		RestoreDragControllerContainerOverride();
	}

	private void Start()
	{
		// Defensive sync: if TutorialManager entered a step before we subscribed.
		if (tutorialManager != null && TutorialManager.IsTutorialActive && tutorialManager.CurrentStepIndex >= 0)
		{
			OnStepEntered(tutorialManager.CurrentStepIndex);
		}
	}

	private void Update()
	{
		if (!TutorialManager.IsTutorialActive && currentStepIndex != -1)
		{
			OnTutorialEnded();
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// Step Router
	// ═══════════════════════════════════════════════════════════════

	private void OnStepEntered(int stepIndex)
	{
		AcquireTutorialRuntimeControl();

		if (currentStepIndex == stepIndex)
		{
			return;
		}

		Debug.Log($"[EquationTutorial] → Step {stepIndex}");
		currentStepIndex = stepIndex;
		GameplayEventBus.RaiseTutorialStepEntered(stepIndex);

		switch (stepIndex)
		{
			case 0: OnStep1Enter(); break;
			case 1: OnStep2Enter(); break;
			case 2: OnStep3Enter(); break;
			case 3: OnStep4Enter(); break;
			case 4: OnStep5Enter(); break;
			default:
				Debug.LogWarning($"[EquationTutorial] Unknown step index: {stepIndex}");
				break;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// STEP 1 – Display equation "x + 2 = 7" in center using real
	//          bubble prefab. No LockedEquation, no drag path.
	// ═══════════════════════════════════════════════════════════════

	private void OnStep1Enter()
	{
		Debug.Log("[EquationTutorial] Step 1: Display equation in center");
		CleanupStep1Visuals();
		if (dragController != null)
		{
			dragController.SetTutorialGuidanceVisualOverride(false);
		}

		if (solveForXText != null)
		{
			solveForXText.SetActive(false);
		}

		if (howToPrompt != null)
		{
			howToPrompt.SetActive(false);
		}

		RectTransform displayContainer = equationContainer != null ? equationContainer : GetDragControllerContainer();
		if (displayContainer == null || bubbleElementPrefab == null)
		{
			Debug.LogError("[EquationTutorial] equationContainer or bubbleElementPrefab is null!");
			return;
		}

		// Mirror DragExecutionController.CreateBubbleElements() layout logic.
		// Tokens for "x + 2 = 7": [x] [+] [2] [=] [7]
		ResolveStep1Sizing(displayContainer, out float bubbleSize, out float opSize, out float spacing);

		float totalWidth = bubbleSize + spacing + opSize + spacing + bubbleSize + spacing + opSize + spacing + bubbleSize;
		float xPos = -totalWidth / 2f;

		// x (variable)
		step1Bubbles.Add(SpawnBubble(displayContainer, "x", BubbleElementType.Variable, 0, 0, ref xPos, bubbleSize, spacing));
		// +
		step1OperatorLabels.Add(SpawnOperatorLabel(displayContainer, "+", ref xPos, opSize, bubbleSize, spacing));
		// 2 (constant, left side)
		step1Bubbles.Add(SpawnBubble(displayContainer, "2", BubbleElementType.Constant, 2, 0, ref xPos, bubbleSize, spacing));
		// =
		step1OperatorLabels.Add(SpawnOperatorLabel(displayContainer, "=", ref xPos, opSize, bubbleSize, spacing));
		// 7 (constant, right side)
		step1Bubbles.Add(SpawnBubble(displayContainer, "7", BubbleElementType.Constant, 7, 1, ref xPos, bubbleSize, 0f));

		// Animate entrance (mirrors PlayIntroAnimation pop)
		AnimateStep1Entrance();
	}

	private void ResolveStep1Sizing(RectTransform displayContainer, out float bubbleSize, out float operatorSizeForStep, out float spacing)
	{
		if (dragController != null &&
			dragController.TryGetPreviewSizing(TutorialEquation, out bubbleSize, out operatorSizeForStep, out spacing))
		{
			return;
		}

		bubbleSize = EstimateBubbleSize(displayContainer);
		operatorSizeForStep = bubbleSize * 0.55f;
		spacing = bubbleSize * 0.2f;
	}

	private float EstimateBubbleSize(RectTransform container)
	{
		if (container == null) return 140f;
		Canvas.ForceUpdateCanvases();
		float h = container.rect.height;
		if (h <= 0f && tutorialCanvas != null)
		{
			RectTransform cr = tutorialCanvas.transform as RectTransform;
			if (cr != null) h = cr.rect.height;
		}
		if (h <= 0f) h = Screen.height;
		return Mathf.Clamp(h * 0.55f, 120f, 170f);
	}

	private GameObject SpawnBubble(RectTransform container, string text, BubbleElementType type, int value, int side, ref float xPos, float size, float spacingAfter)
	{
		GameObject obj = Instantiate(bubbleElementPrefab, container);
		obj.name = $"TutBubble_{text}";

		EquationBubbleElement bubble = obj.GetComponent<EquationBubbleElement>();
		if (bubble == null)
		{
			bubble = obj.AddComponent<EquationBubbleElement>();
		}
		bubble.Initialize(type, text, value, side, false); // not draggable in Step 1
		bubble.SetValueTextSize(90.0f);
		ApplyTutorialTextVerticalOffset(obj);

		RectTransform rt = obj.GetComponent<RectTransform>();
		float s = type == BubbleElementType.Variable ? size * 1f : size;
		rt.sizeDelta = new Vector2(s, s);
		rt.anchoredPosition = new Vector2(xPos + s / 2f, 0f);

		// Start invisible for entrance animation
		CanvasGroup cg = obj.GetComponent<CanvasGroup>();
		if (cg == null)
		{
			cg = obj.AddComponent<CanvasGroup>();
		}
		cg.alpha = 0f;
		rt.localScale = Vector3.one * 0.85f;

		xPos += s + spacingAfter;
		return obj;
	}

	private GameObject SpawnOperatorLabel(RectTransform container, string text, ref float xPos, float opWidth, float bubbleHeight, float spacingAfter)
	{
		GameObject obj = new GameObject($"TutOp_{text}", typeof(RectTransform), typeof(TextMeshProUGUI));
		obj.transform.SetParent(container, false);

		RectTransform rt = obj.GetComponent<RectTransform>();
		rt.sizeDelta = new Vector2(opWidth, bubbleHeight);
		rt.anchoredPosition = new Vector2(xPos + opWidth / 2f, GetTutorialTextVerticalOffset());

		TextMeshProUGUI tmp = obj.GetComponent<TextMeshProUGUI>();
		tmp.text = text;
		tmp.fontSize = Mathf.Clamp(opWidth * 0.9f, 36f, 80f);
		tmp.fontStyle = FontStyles.Bold;
		tmp.alignment = TextAlignmentOptions.Center;
		tmp.color = operatorColor;
		tmp.raycastTarget = false;

		// Start invisible
		CanvasGroup cg = obj.AddComponent<CanvasGroup>();
		cg.alpha = 0f;
		rt.localScale = Vector3.one * 0.85f;

		xPos += opWidth + spacingAfter;
		return obj;
	}

	private float GetTutorialTextVerticalOffset()
	{
		return dragController != null ? dragController.BubbleTextVerticalOffset : 0f;
	}

	private void ApplyTutorialTextVerticalOffset(GameObject bubbleObject)
	{
		if (bubbleObject == null)
		{
			return;
		}

		TextMeshProUGUI tmp = bubbleObject.GetComponentInChildren<TextMeshProUGUI>(true);
		if (tmp == null)
		{
			return;
		}

		RectTransform textRect = tmp.rectTransform;
		if (textRect == null)
		{
			return;
		}

		textRect.anchoredPosition = new Vector2(0f, GetTutorialTextVerticalOffset());
	}

	private void AnimateStep1Entrance()
	{
		float delay = 0f;
		const float stagger = 0.06f;

		void AnimateObj(GameObject obj, float d)
		{
			if (obj == null) return;
			RectTransform rt = obj.GetComponent<RectTransform>();
			CanvasGroup cg = obj.GetComponent<CanvasGroup>();
			if (rt != null) rt.DOScale(1f, 0.35f).SetDelay(d).SetEase(Ease.OutBack).SetUpdate(true);
			if (cg != null) cg.DOFade(1f, 0.25f).SetDelay(d).SetEase(Ease.OutQuad).SetUpdate(true);
		}

		// Interleave bubbles and operators in visual order (left to right)
		// Order: x, +, 2, =, 7
		AnimateObj(step1Bubbles.Count > 0 ? step1Bubbles[0] : null, delay); delay += stagger;
		AnimateObj(step1OperatorLabels.Count > 0 ? step1OperatorLabels[0] : null, delay); delay += stagger;
		AnimateObj(step1Bubbles.Count > 1 ? step1Bubbles[1] : null, delay); delay += stagger;
		AnimateObj(step1OperatorLabels.Count > 1 ? step1OperatorLabels[1] : null, delay); delay += stagger;
		AnimateObj(step1Bubbles.Count > 2 ? step1Bubbles[2] : null, delay);
	}

	private void CleanupStep1Visuals()
	{
		foreach (GameObject obj in step1Bubbles)
		{
			if (obj != null)
			{
				KillTweensOnGameObject(obj);
				Destroy(obj);
			}
		}

		step1Bubbles.Clear();

		foreach (GameObject obj in step1OperatorLabels)
		{
			if (obj != null)
			{
				KillTweensOnGameObject(obj);
				Destroy(obj);
			}
		}

		step1OperatorLabels.Clear();
	}

	// ═══════════════════════════════════════════════════════════════
	// STEP 2 – Animate equation into the LockedEquation at the top.
	//          Uses DragExecutionController.InitializeWithEquation()
	//          which plays intro → moves to top → spawns playable
	//          bubbles. After animation finishes we disable all
	//          bubble interactability and suppress journey guidance
	//          so the player just sees the locked equation.
	// ═══════════════════════════════════════════════════════════════

	private void OnStep2Enter()
	{
		Debug.Log("[EquationTutorial] Step 2: Animate equation to LockedEquation");

		// Remove our Step 1 preview bubbles
		CleanupStep1Visuals();

		if (solveForXText != null)
		{
			solveForXText.SetActive(true);
		}

		if (dragController == null)
		{
			Debug.LogError("[EquationTutorial] dragController reference is null!");
			return;
		}

		// DragExecutionController is BubbleSystem-only now.
		dragController.SetTutorialGuidanceVisualOverride(false);

		// Suppress drag processing so no real solving happens.
		dragController.SuppressDragProcessing = true;
		// Suppress journey guidance so the wisp path doesn't appear in Step 2.
		dragController.SuppressJourneyGuidance = true;

		// This single call creates bubbles, plays intro animation, moves equation to
		// LockedInEquationUI at the top, spawns playable bubbles, creates drop zones,
		// and requests journey guidance (which will be blocked by the flag above).
		dragController.InitializeWithEquation(TutorialEquation);

		// After the intro animation finishes, lock down everything so the
		// player only sees the equation at the top — no drag path, no interaction.
		if (waitForAnimCoroutine != null) StopCoroutine(waitForAnimCoroutine);
		waitForAnimCoroutine = StartCoroutine(WaitForAnimThenLockBubbles());
	}

	/// Waits for DragExecutionController's intro animation to finish,
	/// then disables all bubble interactability.
	/// Journey guidance is suppressed via the suppressJourneyGuidance flag
	/// which Update() enforces every frame.
	private IEnumerator WaitForAnimThenLockBubbles()
	{
		yield return null;

		while (dragController != null && dragController.IsAnimating)
		{
			yield return null;
		}

		// Lock bubbles after animation so they can't be dragged in Step 2.
		SetAllBubblesInteractable(false);
		SetEquationContainerGreyed(true);

		waitForAnimCoroutine = null;
	}

	// ═══════════════════════════════════════════════════════════════
	// STEP 3 – Show the drag path (journey guidance: wisp + pulsing).
	//          Bubbles are interactable so guidance works, but
	//          SuppressDragProcessing prevents any real equation
	//          solving or progress bar changes.
	//          Next button is HIDDEN until the player drags at least once.
	// ═══════════════════════════════════════════════════════════════

	private void OnStep3Enter()
	{
		Debug.Log("[EquationTutorial] Step 3: Show drag path (journey guidance)");

		// Cancel Step 2's lock-down coroutine so it can't disable bubbles after us.
		if (waitForAnimCoroutine != null)
		{
			StopCoroutine(waitForAnimCoroutine);
			waitForAnimCoroutine = null;
		}

		step3DragDetected = false;

		// Hide Next button until the player drags at least once
		GameObject nextButton = FindNextButtonInCurrentStep();
		if (nextButton != null) nextButton.SetActive(false);

		// Suppress real drag processing so the equation doesn't solve
		// and the progress bar doesn't update.
		if (dragController != null)
		{
			dragController.SuppressDragProcessing = true;
			dragController.SetTutorialGuidanceVisualOverride(true);
		}

		// The DragExecutionController's intro animation (PlayIntroAnimation + MoveEquationToTop)
		// might still be running — it destroys old bubbles and creates new ones.
		// We must wait for it to finish before enabling bubbles and subscribing to events.
		if (step3SetupCoroutine != null) StopCoroutine(step3SetupCoroutine);
		step3SetupCoroutine = StartCoroutine(WaitForAnimThenSetupStep3());
	}

	private IEnumerator WaitForAnimThenSetupStep3()
	{
		// Wait until DragExecutionController's animation finishes.
		while (dragController != null && dragController.IsAnimating)
		{
			yield return null;
		}

		// Now the playable bubbles exist. Re-enable interactability so
		// journey guidance picks a suggestion and shows the wisp path.
		SetAllBubblesInteractable(true);
		SetEquationContainerGreyed(false);

		// Allow journey guidance to run — this is when the drag path first appears.
		if (dragController != null)
		{
			dragController.SuppressJourneyGuidance = false;
			dragController.RequestJourneyGuidanceRefresh();
		}

		// Find the "2" bubble and subscribe to its drag event.
		RectTransform container = GetDragControllerContainer();
		interceptedBubble = FindDraggableConstant(2, 0);
		if (interceptedBubble == null)
		{
			Debug.LogWarning($"[EquationTutorial] Step 3: Could not find constant '2' bubble in container '{(container != null ? container.name : "NULL")}'. Listing all bubbles:");
			if (container != null)
			{
				foreach (var b in container.GetComponentsInChildren<EquationBubbleElement>(true))
				{
					Debug.Log($"  Bubble: '{b.name}' type={b.ElementType} value={b.NumericValue} side={b.EquationSide} draggable={b.IsDraggable}");
				}
			}
			yield break;
		}

		Debug.Log($"[EquationTutorial] Step 3: Found bubble '{interceptedBubble.name}' — subscribing to OnDragEnded. IsDraggable={interceptedBubble.IsDraggable}");
		interceptedBubble.OnDragEnded += OnStep3BubbleDragEnded;
	}

	private void OnStep3BubbleDragEnded(EquationBubbleElement bubble, Vector2 position)
	{
		if (step3DragDetected) return;

		step3DragDetected = true;
		Debug.Log("[EquationTutorial] Step 3: First drag detected, unlocking Next button");

		// Unsubscribe — we only need one drag
		if (interceptedBubble != null)
			interceptedBubble.OnDragEnded -= OnStep3BubbleDragEnded;

		GameObject nextButton = FindNextButtonInCurrentStep();
		if (nextButton != null) nextButton.SetActive(true);
	}

	// ═══════════════════════════════════════════════════════════════
	// STEP 4 – Drag practice (5 times)
	//          We intercept the real EquationBubbleElement so the
	//          user can practice the drag motion without solving.
	//          Progress bar updates only during this step.
	//          Next button hidden until 5 drags are completed.
	// ═══════════════════════════════════════════════════════════════

	private Coroutine step4SetupCoroutine;

	private void OnStep4Enter()
	{
		Debug.Log("[EquationTutorial] Step 4: Drag practice");

		tutorialDragCount = 0;

		// Cancel Step 3's setup coroutine if still running
		if (step3SetupCoroutine != null)
		{
			StopCoroutine(step3SetupCoroutine);
			step3SetupCoroutine = null;
		}

		// Clean up Step 3's event subscription (if still active)
		if (interceptedBubble != null)
			interceptedBubble.OnDragEnded -= OnStep3BubbleDragEnded;

		// Keep drag processing suppressed — our proxy handles drags,
		// not DragExecutionController.
		if (dragController != null)
		{
			dragController.SuppressDragProcessing = true;
			dragController.SetTutorialGuidanceVisualOverride(true);
		}

		// Hide Next button until drags complete
		GameObject nextButton = FindNextButtonInCurrentStep();
		if (nextButton != null) nextButton.SetActive(false);

		// Wait for animation to finish before setting up the proxy
		if (step4SetupCoroutine != null) StopCoroutine(step4SetupCoroutine);
		step4SetupCoroutine = StartCoroutine(WaitForAnimThenSetupStep4());
	}

	private IEnumerator WaitForAnimThenSetupStep4()
	{
		while (dragController != null && dragController.IsAnimating)
		{
			yield return null;
		}

		// Find the draggable constant "2" bubble that DragExecutionController created
		RectTransform container = GetDragControllerContainer();
		interceptedBubble = FindDraggableConstant(2, 0);
		if (interceptedBubble == null)
		{
			Debug.LogWarning($"[EquationTutorial] Step 4: Could not find constant '2' bubble in container '{(container != null ? container.name : "NULL")}'. Listing all bubbles:");
			if (container != null)
			{
				foreach (var b in container.GetComponentsInChildren<EquationBubbleElement>(true))
				{
					Debug.Log($"  Bubble: '{b.name}' type={b.ElementType} value={b.NumericValue} side={b.EquationSide} draggable={b.IsDraggable}");
				}
			}
			yield break;
		}

		Debug.Log($"[EquationTutorial] Step 4: Found bubble '{interceptedBubble.name}' — setting up drag proxy.");

		interceptedOriginalPos = interceptedBubble.OriginalPosition;

		// Disable the real drag handler so DragExecutionController won't process drags
		interceptedBubble.SetInteractable(false);

		// Re-enable raycasts so our proxy still receives pointer events
		CanvasGroup interceptCg = interceptedBubble.GetComponent<CanvasGroup>();
		if (interceptCg != null) interceptCg.blocksRaycasts = true;

		// Also ensure the root Graphic is a raycast target
		Graphic rootGraphic = interceptedBubble.GetComponent<Graphic>();
		if (rootGraphic != null) rootGraphic.raycastTarget = true;

		// Disable raycasts on child text so it doesn't swallow events
		foreach (TextMeshProUGUI childText in interceptedBubble.GetComponentsInChildren<TextMeshProUGUI>(true))
			childText.raycastTarget = false;

		// Attach our lightweight drag proxy
		dragProxy = interceptedBubble.gameObject.GetComponent<TutorialBubbleDragProxy>();
		if (dragProxy == null) dragProxy = interceptedBubble.gameObject.AddComponent<TutorialBubbleDragProxy>();
		dragProxy.Initialize(this);
		dragProxy.enabled = true;

		UpdateProgressUI();
	}

	/// Searches the drag controller's equation container for a bubble matching type + value + side.
	private EquationBubbleElement FindDraggableConstant(int value, int side)
	{
		RectTransform container = GetDragControllerContainer();
		if (container == null) return null;

		foreach (EquationBubbleElement b in container.GetComponentsInChildren<EquationBubbleElement>(true))
		{
			if (b.ElementType == BubbleElementType.Constant && b.NumericValue == value && b.EquationSide == side)
				return b;
		}
		return null;
	}

	// ── Tutorial drag handlers (Step 4 proxy) ───────────────────────

	private void OnTutorialBeginDrag(PointerEventData eventData) { /* reserved for sfx/haptics */ }

	private void OnTutorialDrag(PointerEventData eventData)
	{
		if (interceptedBubble == null) return;

		// Follow pointer (mirrors EquationBubbleElement.OnDrag logic)
		RectTransform parent = interceptedBubble.transform.parent as RectTransform;
		Camera cam = tutorialCanvas != null && tutorialCanvas.renderMode != RenderMode.ScreenSpaceOverlay
			? tutorialCanvas.worldCamera : null;

		if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, eventData.position, cam, out Vector2 local))
		{
			interceptedBubble.RectTransform.anchoredPosition = local;
		}
	}

	private void OnTutorialEndDrag(PointerEventData eventData)
	{
		if (interceptedBubble == null)
		{
			return;
		}

		float dist = Vector2.Distance(eventData.position, eventData.pressPosition);
		if (dist > dragThreshold)
		{
			tutorialDragCount++;
			GameplayEventBus.RaiseTutorialDragCompleted(tutorialDragCount);
			Debug.Log($"[EquationTutorial] Drag {tutorialDragCount}/{requiredDrags}");
			UpdateProgressUI();

			if (tutorialDragCount >= requiredDrags)
			{
				OnDragGoalReached();
			}
		}

		if (interceptedBubble != null && interceptedBubble.RectTransform != null)
		{
			interceptedBubble.RectTransform.DOAnchorPos(interceptedOriginalPos, 0.2f).SetEase(Ease.OutBack).SetUpdate(true);
		}
	}

	private void UpdateProgressUI()
	{
		float progress = tutorialDragCount / (float)requiredDrags;

		// Update LockedInEquationUI progress via DragExecutionController
		if (dragController != null)
		{
			dragController.SetLockedProgress01(progress, 0f, false);
		}

		int remaining = requiredDrags - tutorialDragCount;
		if (dragCountText != null)
		{
			dragCountText.text = remaining > 0 ? $"{remaining} drag{(remaining > 1 ? "s" : "")} remaining!" : "Perfect! Click Next to continue";
		}
	}

	private void OnDragGoalReached()
	{
		Debug.Log("[EquationTutorial] Drag goal reached!");

		if (dragProxy != null)
		{
			dragProxy.enabled = false;
		}

		GameObject nextButton = FindNextButtonInCurrentStep();
		if (nextButton != null)
		{
			nextButton.SetActive(true);
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// STEP 5 – Show solved equation in LockedInEquationUI
	// ═══════════════════════════════════════════════════════════════

	private void OnStep5Enter()
	{
		Debug.Log("[EquationTutorial] Step 5: Solved!");

		// Cancel any pending setup coroutines from prior steps
		if (step3SetupCoroutine != null)
		{
			StopCoroutine(step3SetupCoroutine); step3SetupCoroutine = null;
		}

		if (step4SetupCoroutine != null)
		{
			StopCoroutine(step4SetupCoroutine); step4SetupCoroutine = null;
		}

		if (dragController != null)
		{
			dragController.SetTutorialGuidanceVisualOverride(false);
			dragController.SuppressDragProcessing = false;
		}

		RestoreDragController();

		if (dragController != null)
		{
			dragController.SuppressJourneyGuidance = true;
			dragController.InitializeWithEquation(SolvedEquation);
		}

		LockedInEquationUI lockedUI = dragController != null ? dragController.GetComponentInChildren<LockedInEquationUI>(true) : null;

		if (lockedUI != null)
		{
			lockedUI.SetEquationString(SolvedEquation);
			lockedUI.SetProgress01(1f, true);

			lockedUI.transform.DOPunchScale(Vector3.one * 0.15f, 0.6f, 6, 0.6f).SetUpdate(true);
		}

		if (dragController != null)
		{
			dragController.SetLockedProgress01(1f, 0f, true);
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// Tutorial End & Cleanup
	// ═══════════════════════════════════════════════════════════════

	private void OnTutorialEnded()
	{
		Debug.Log("[EquationTutorial] Tutorial ended.");

		if (waitForAnimCoroutine != null)
		{
			StopCoroutine(waitForAnimCoroutine);
			waitForAnimCoroutine = null;
		}
		if (step3SetupCoroutine != null)
		{
			StopCoroutine(step3SetupCoroutine);
			step3SetupCoroutine = null;
		}
		if (step4SetupCoroutine != null)
		{
			StopCoroutine(step4SetupCoroutine);
			step4SetupCoroutine = null;
		}

		PlayerPrefs.SetInt(AlgebraTutorialPrefKey, 1);
		PlayerPrefs.Save();

		GameplayEventBus.RaiseTutorialCompleted();

		CleanupStep1Visuals();
		RestoreDragController();

		if (howToPrompt != null)
		{
			howToPrompt.SetActive(true);
		}

		currentStepIndex = -1;

		// Clean up the DragExecutionController state from our tutorial equation
		// so it gets a fresh start when real gameplay begins.
		if (dragController != null)
		{
			dragController.SuppressDragProcessing = false;
			dragController.SuppressJourneyGuidance = false;
			dragController.TutorialLock = false;
			dragController.SetTutorialGuidanceVisualOverride(false);
			dragController.HideWispGuidanceVisualsImmediate();
			dragController.Deactivate();
			RestoreDragControllerContainerOverride();
			Debug.Log("[EquationTutorial] TutorialLock released on DragExecutionController.");
		}

		// Re-enable the progression source so normal gameplay starts now.
		// Its OnEnable() will bootstrap real gameplay if it owns runtime equation loading.
		if (cachedProgressionSourceBehaviour != null)
		{
			cachedProgressionSourceBehaviour.enabled = true;
			Debug.Log("[EquationTutorial] Re-enabled gameplay progression source. Gameplay starting.");
		}

		AlgebraTutorialGate.SkipGateOnceForNextSceneReload();
		if (AudioManager.Instance != null)
		{
			AudioManager.Instance.RestartSong();
		}

		SceneManager.LoadScene(SceneManager.GetActiveScene().name);
	}

	/// Re-enables normal drag handling on any intercepted bubble.
	private void RestoreDragController()
	{
		if (dragProxy != null)
		{
			dragProxy.enabled = false;
			KillTweensOnGameObject(dragProxy.gameObject);
			Destroy(dragProxy);
			dragProxy = null;
		}

		if (interceptedBubble != null)
		{
			// Unsubscribe from Step 3 event (safe even if not subscribed)
			interceptedBubble.OnDragEnded -= OnStep3BubbleDragEnded;
			interceptedBubble.SetInteractable(true);
			interceptedBubble = null;
		}
	}

	private void TryOverrideDragControllerContainerForTutorial()
	{
		if (dragController == null || equationContainer == null)
		{
			return;
		}

		RectTransform currentContainer = dragController.EquationContainer;
		if (currentContainer != equationContainer)
		{
			originalDragControllerEquationContainer = currentContainer;
			SyncTutorialContainerLayoutFrom(currentContainer);
			hasOverriddenDragControllerEquationContainer = true;
			dragController.SetEquationContainer(equationContainer);
			Debug.Log("[EquationTutorial] Redirected DragExecutionController equationContainer to TutorialEquationContainer.");
		}

		RectTransform tutorialProgressContainer = ResolveTutorialProgressMeterContainer(dragController.ProgressMeterContainer);
		if (tutorialProgressContainer == null)
		{
			return;
		}

		RectTransform currentProgressContainer = dragController.ProgressMeterContainer;
		if (currentProgressContainer == tutorialProgressContainer)
		{
			return;
		}

		originalDragControllerProgressMeterContainer = currentProgressContainer;
		hasOverriddenDragControllerProgressMeterContainer = true;
		dragController.SetProgressMeterContainer(tutorialProgressContainer);
		Debug.Log("[EquationTutorial] Redirected DragExecutionController progress meter container to tutorial canvas.");
	}

	private void SyncTutorialContainerLayoutFrom(RectTransform source)
	{
		if (source == null || equationContainer == null)
		{
			return;
		}

		CopyRectTransformLayout(source, equationContainer);
	}

	private void RestoreDragControllerContainerOverride()
	{
		if (dragController == null)
		{
			return;
		}

		if (hasOverriddenDragControllerEquationContainer && originalDragControllerEquationContainer != null)
		{
			dragController.SetEquationContainer(originalDragControllerEquationContainer);
		}

		hasOverriddenDragControllerEquationContainer = false;
		originalDragControllerEquationContainer = null;

		if (hasOverriddenDragControllerProgressMeterContainer && originalDragControllerProgressMeterContainer != null)
		{
			dragController.SetProgressMeterContainer(originalDragControllerProgressMeterContainer);
		}

		hasOverriddenDragControllerProgressMeterContainer = false;
		originalDragControllerProgressMeterContainer = null;

		if (tutorialProgressMeterContainer != null)
		{
			KillTweensOnGameObject(tutorialProgressMeterContainer.gameObject);
			Destroy(tutorialProgressMeterContainer.gameObject);
			tutorialProgressMeterContainer = null;
		}
	}

	private void PrepareForRuntimeReplayInternal()
	{
		if (waitForAnimCoroutine != null)
		{
			StopCoroutine(waitForAnimCoroutine);
			waitForAnimCoroutine = null;
		}
		if (step3SetupCoroutine != null)
		{
			StopCoroutine(step3SetupCoroutine);
			step3SetupCoroutine = null;
		}
		if (step4SetupCoroutine != null)
		{
			StopCoroutine(step4SetupCoroutine);
			step4SetupCoroutine = null;
		}

		currentTween?.Kill();
		currentTween = null;

		CleanupStep1Visuals();
		RestoreDragController();
		currentStepIndex = -1;

		if (howToPrompt != null)
		{
			howToPrompt.SetActive(false);
		}

		if (dragController == null)
		{
			dragController = FindFirstObjectByType<DragExecutionController>();
		}

		AcquireTutorialRuntimeControl();

		if (dragController != null)
		{
			dragController.SuppressDragProcessing = true;
			dragController.SuppressJourneyGuidance = true;
			dragController.SetTutorialGuidanceVisualOverride(false);
			dragController.HideWispGuidanceVisualsImmediate();
			dragController.Deactivate();
			TryOverrideDragControllerContainerForTutorial();
			Debug.Log("[EquationTutorial] Prepared DragExecutionController for tutorial replay.");
		}
	}

	private void AcquireTutorialRuntimeControl()
	{
		if (dragController == null)
		{
			dragController = FindFirstObjectByType<DragExecutionController>();
		}

		if (dragController != null)
		{
			// Blocks external initialization while tutorial flow owns the equation UI.
			dragController.TutorialLock = true;
			TryOverrideDragControllerContainerForTutorial();
			Debug.Log("[EquationTutorial] TutorialLock set on DragExecutionController.");
		}

		if (cachedProgressionSourceBehaviour == null)
		{
			cachedProgressionSourceBehaviour = SceneInterfaceLocator.FindFirstBehaviourImplementing<IEquationProgressionSource>();
		}

		if (cachedProgressionSourceBehaviour != null && cachedProgressionSourceBehaviour.enabled)
		{
			cachedProgressionSourceBehaviour.enabled = false;
			Debug.Log("[EquationTutorial] Disabled gameplay progression source during tutorial.");
		}
	}

	private static void KillTweensOnGameObject(GameObject obj)
	{
		if (obj == null)
		{
			return;
		}

		Transform root = obj.transform;
		if (root != null)
		{
			root.DOKill(false);
		}

		RectTransform[] rects = obj.GetComponentsInChildren<RectTransform>(true);
		for (int i = 0; i < rects.Length; i++)
		{
			if (rects[i] != null)
			{
				rects[i].DOKill(false);
			}
		}

		CanvasGroup[] groups = obj.GetComponentsInChildren<CanvasGroup>(true);
		for (int i = 0; i < groups.Length; i++)
		{
			if (groups[i] != null)
			{
				groups[i].DOKill(false);
			}
		}

		Graphic[] graphics = obj.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			if (graphics[i] != null)
			{
				graphics[i].DOKill(false);
			}
		}

		TextMeshProUGUI[] labels = obj.GetComponentsInChildren<TextMeshProUGUI>(true);
		for (int i = 0; i < labels.Length; i++)
		{
			if (labels[i] != null)
			{
				labels[i].DOKill(false);
			}
		}
	}

	private RectTransform ResolveTutorialProgressMeterContainer(RectTransform sourceTemplate)
	{
		if (tutorialProgressMeterContainer != null)
		{
			if (sourceTemplate != null)
			{
				CopyRectTransformLayout(sourceTemplate, tutorialProgressMeterContainer);
			}
			return tutorialProgressMeterContainer;
		}

		RectTransform parent = null;
		if (tutorialCanvas != null)
		{
			parent = tutorialCanvas.transform as RectTransform;
		}

		if (parent == null && equationContainer != null)
		{
			parent = equationContainer.parent as RectTransform;
		}

		if (parent == null)
		{
			return null;
		}

		GameObject runtimeContainer = new GameObject("TutorialProgressMeterContainer", typeof(RectTransform));
		tutorialProgressMeterContainer = runtimeContainer.GetComponent<RectTransform>();
		tutorialProgressMeterContainer.SetParent(parent, false);

		if (sourceTemplate != null)
		{
			CopyRectTransformLayout(sourceTemplate, tutorialProgressMeterContainer);
		}
		else if (equationContainer != null)
		{
			CopyRectTransformLayout(equationContainer, tutorialProgressMeterContainer);
			tutorialProgressMeterContainer.anchorMin = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.anchorMax = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.pivot = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.sizeDelta = new Vector2(0f, 0f);
			tutorialProgressMeterContainer.anchoredPosition = new Vector2(0f, -120f);
		}
		else
		{
			tutorialProgressMeterContainer.anchorMin = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.anchorMax = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.pivot = new Vector2(0.5f, 1f);
			tutorialProgressMeterContainer.sizeDelta = Vector2.zero;
			tutorialProgressMeterContainer.anchoredPosition = new Vector2(0f, -120f);
		}

		tutorialProgressMeterContainer.SetAsLastSibling();
		return tutorialProgressMeterContainer;
	}

	private static void CopyRectTransformLayout(RectTransform source, RectTransform target)
	{
		if (source == null || target == null)
		{
			return;
		}

		target.anchorMin = source.anchorMin;
		target.anchorMax = source.anchorMax;
		target.pivot = source.pivot;

		// Do not mix anchoredPosition/sizeDelta with offsetMin/offsetMax indiscriminately.
		// Copying both can corrupt layout when the target is under a different parent/canvas.
		bool stretchAnchors =
			!Mathf.Approximately(source.anchorMin.x, source.anchorMax.x) ||
			!Mathf.Approximately(source.anchorMin.y, source.anchorMax.y);

		if (stretchAnchors)
		{
			target.offsetMin = source.offsetMin;
			target.offsetMax = source.offsetMax;
		}
		else
		{
			target.sizeDelta = source.sizeDelta;
			target.anchoredPosition = source.anchoredPosition;
		}

		// Keep UI containers normalized when cloning into another canvas.
		target.localScale = Vector3.one;
		target.localRotation = Quaternion.identity;
	}

	// ═══════════════════════════════════════════════════════════════
	// Helpers
	// ═══════════════════════════════════════════════════════════════

	/// Returns the container that DragExecutionController parents its bubbles into.
	/// Falls back to the tutorial's own equationContainer if the drag controller
	/// doesn't have one (shouldn't happen in normal flow).
	private RectTransform GetDragControllerContainer()
	{
		if (dragController != null && dragController.EquationContainer != null)
			return dragController.EquationContainer;
		return equationContainer;
	}

	/// Sets interactable state on all EquationBubbleElement children of the drag controller's container.
	private void SetAllBubblesInteractable(bool interactable)
	{
		RectTransform container = GetDragControllerContainer();
		if (container == null) return;

		foreach (EquationBubbleElement b in container.GetComponentsInChildren<EquationBubbleElement>(true))
		{
			b.SetInteractable(interactable);
		}
	}

	/// Fades the equation container to grey (greyed=true) or back to full colour (greyed=false).
	private void SetEquationContainerGreyed(bool greyed, float duration = 0.3f)
	{
		RectTransform container = GetDragControllerContainer();
		if (container == null) return;

		CanvasGroup cg = container.GetComponent<CanvasGroup>();
		if (cg == null) cg = container.gameObject.AddComponent<CanvasGroup>();

		cg.DOKill();
		cg.DOFade(greyed ? 0.35f : 1f, duration).SetEase(Ease.OutQuad).SetUpdate(true);
	}

	private GameObject FindNextButtonInCurrentStep()
	{
		if (tutorialManager == null || tutorialManager.CurrentStepIndex < 0) return null;

		TutorialStep activeStep = null;
		foreach (TutorialStep step in tutorialManager.GetComponentsInChildren<TutorialStep>(true))
		{
			if (step != null && step.gameObject.activeInHierarchy)
			{
				activeStep = step;
				break;
			}
		}

		if (activeStep != null)
		{
			return activeStep.GetNextButton();
		}

		Debug.LogWarning("[EquationTutorial] Could not find Next button in current step.");
		return null;
	}

	// ═══════════════════════════════════════════════════════════════
	// Public API
	// ═══════════════════════════════════════════════════════════════

	/// Reset the tutorial flag. Call from a redo button; reload the scene after.
	public static void ResetTutorial()
	{
		PlayerPrefs.DeleteKey(AlgebraTutorialPrefKey);
		PlayerPrefs.Save();
		TutorialManager.ResetTutorialFlag();
		Debug.Log("[EquationTutorial] Tutorial reset. Reload scene to replay.");
	}

	public static void PrepareForRuntimeReplay()
	{
		if (Instance == null)
		{
			return;
		}

		Instance.PrepareForRuntimeReplayInternal();
	}

	/// Check if the algebra tutorial has been completed.
	public static bool HasCompletedTutorial() => PlayerPrefs.GetInt(AlgebraTutorialPrefKey, 0) == 1;

	/// Shared gameplay gate used by algebra systems.
	/// Fallback: if this controller exists but is not configured for this scene,
	/// don't block gameplay behind the algebra tutorial key.
	public static bool ShouldBlockGameplayForTutorial()
	{
		if (TutorialManager.IsTutorialActive)
		{
			return true;
		}

		EquationTutorialController controller = Instance != null ? Instance : FindFirstObjectByType<EquationTutorialController>();
		if (controller == null)
		{
			return false;
		}

		if (!controller.IsRuntimeConfigured())
		{
			if (!hasLoggedFallbackBypass)
			{
				hasLoggedFallbackBypass = true;
				Debug.LogWarning("[EquationTutorial] Fallback bypass: tutorial controller found but not fully configured in this scene.");
			}
			return false;
		}

		return !HasCompletedTutorial();
	}

	private bool IsRuntimeConfigured()
	{
		DragExecutionController resolvedDragController = dragController != null ? dragController : FindFirstObjectByType<DragExecutionController>();
		TutorialManager resolvedTutorialManager = tutorialManager != null ? tutorialManager : FindFirstObjectByType<TutorialManager>();

		bool hasEquationContainer = equationContainer != null || (resolvedDragController != null && resolvedDragController.EquationContainer != null);
		bool hasBubblePrefab = bubbleElementPrefab != null;

		return resolvedDragController != null
			&& resolvedTutorialManager != null
			&& hasEquationContainer
			&& hasBubblePrefab;
	}
}
