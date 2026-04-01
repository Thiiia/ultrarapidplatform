using UnityEngine;

public partial class DragExecutionController
{
	private void EnforceModernRuntimeModes(bool logCorrection)
	{
		bool corrected = false;

		// Canonical placeholder arc sprites are aligned to a fixed template span, so
		// drag-time compaction can break path/template alignment there. Dot/procedural
		// path mode can safely use compaction again.
		bool forceCompactionOffForPlaceholderMode = wispDotSprite == null && ShouldForceCanonicalPathForPlaceholderArcSprites();
		if (forceCompactionOffForPlaceholderMode && compactEquationLayoutWhileDragging)
		{
			compactEquationLayoutWhileDragging = false;
			corrected = true;
		}

		if (corrected && logCorrection && !runtimeModeLockLogged)
		{
			runtimeModeLockLogged = true;
			Debug.LogWarning("DragExecutionController: Corrected incompatible runtime settings.");
		}
	}

	private static bool IsSceneComponentAlive(Component component)
	{
		return component != null && component.gameObject != null && component.gameObject.scene.IsValid();
	}

	private LinearEquationSolver ResolveEquationSolver()
	{
		if (equationSolver == null)
		{
			equationSolver = FindFirstObjectByType<LinearEquationSolver>();
		}

		return equationSolver;
	}

	private ChartSystem ResolveChartSystem()
	{
		if (chartSystem == null)
		{
			chartSystem = FindFirstObjectByType<ChartSystem>();
		}

		return chartSystem;
	}

	private void Awake()
	{
		EnforceModernRuntimeModes(logCorrection: false);
		ResolveEquationSolver();
		ResolveChoiceSystem();

		if (parentCanvas == null)
		{
			parentCanvas = GetComponentInParent<Canvas>();
		}

		if (dragCanvas == null && parentCanvas != null)
		{
			dragCanvas = parentCanvas.transform as RectTransform;
		}

		if (uiCamera == null)
		{
			if (parentCanvas != null && parentCanvas.worldCamera != null)
			{
				uiCamera = parentCanvas.worldCamera;
			}
			else
			{
				uiCamera = Camera.main;
			}
		}

		// Runtime is locked to BubbleSystem + Shapes.
		SetupDefaultTrailGradient();

		hasStableBubbleSizing = false;
		CacheAutoSizeLayoutState();
		runtimeSettingsNormalized = false;
		ApplySceneBackgroundOverridesIfEnabled();
	}

	private void Start()
	{
		EnforceModernRuntimeModes(logCorrection: true);
		NormalizeSerializedSettings(logRuntimeCorrection: true);
		ApplyProceduralWispVisualProfileIfNeeded();
		runtimeSettingsNormalized = true;
		contextualAutoTutorialShownThisSession = false;

		CreateReferenceHud();
		CreateTrailContainer();
		CreateWispSystem();
		ApplyAlgebraChartConfigIfNeeded();
		MaybeConfigureChartSystem();
	}

	private void OnEnable()
	{
		GameplayEventBus.Beat += HandleBeat;
		ChartSystem.OnChartInitialized += HandleChartInitialized;
		ApplySceneBackgroundOverridesIfEnabled();
		if (algebraTutorialGate == null)
		{
			algebraTutorialGate = ResolveAlgebraTutorialGateIncludingInactive();
		}

		BindContextualGuidanceHelpButton();
		BindExternalStateSync();
	}

	private void OnDisable()
	{
		GameplayEventBus.Beat -= HandleBeat;
		ChartSystem.OnChartInitialized -= HandleChartInitialized;
		UnbindContextualGuidanceHelpButton();

		UnbindExternalStateSync();

		ClearJourneyGuidance();
		HideFeedbackTooltipImmediate();
		HideContextualGuidanceTooltipImmediate();
		KillManagedTweens();

		if (deferredStepPerformanceAnchorRefreshCoroutine != null)
		{
			StopCoroutine(deferredStepPerformanceAnchorRefreshCoroutine);
			deferredStepPerformanceAnchorRefreshCoroutine = null;
		}

		hasValidStepPerformanceAutoAnchor = false;
		cachedStepPerformanceSource = null;
	}

	private void HandleBeat()
	{
		if (!isActive)
		{
			return;
		}

		// Pulse wisp on beat.
		PulseWispOnBeat();
	}

	private static bool TrySetParentSafe(Transform child, Transform newParent, bool worldPositionStays, string context)
	{
		if (child == null || newParent == null)
		{
			return false;
		}

		if (child == newParent || newParent.IsChildOf(child))
		{
			Debug.LogError($"DragExecutionController: Prevented hierarchy cycle in {context}. Child='{child.name}' Parent='{newParent.name}'");
			return false;
		}

		if (child.parent == newParent)
		{
			return true;
		}

		child.SetParent(newParent, worldPositionStays);
		return true;
	}

	private static bool AreStatesEquivalent(EquationState a, EquationState b)
	{
		if (a == null || b == null)
		{
			return false;
		}

		return a.leftVarCoef == b.leftVarCoef &&
			   a.leftConst == b.leftConst &&
			   a.leftConstDenominator == b.leftConstDenominator &&
			   a.rightVarCoef == b.rightVarCoef &&
			   a.rightConst == b.rightConst &&
			   a.rightConstDenominator == b.rightConstDenominator &&
			   a.hasBrackets == b.hasBrackets &&
			   a.hasSubstitution == b.hasSubstitution &&
			   a.substitutionValue == b.substitutionValue &&
			   a.substitutionValueDenominator == b.substitutionValueDenominator &&
			   a.substitutionVarCoef == b.substitutionVarCoef &&
			   a.substitutionConst == b.substitutionConst &&
			   a.substitutionConstDenominator == b.substitutionConstDenominator;
	}

	private void Update()
	{
		if (!isActive)
		{
			return;
		}

		// Bubble system handles drag input via EventSystem.
		if (!runtimeSettingsNormalized)
		{
			NormalizeSerializedSettings(logRuntimeCorrection: true);
			ApplyProceduralWispVisualProfileIfNeeded();
			runtimeSettingsNormalized = true;
		}

		TryRefreshAutoSizedLayout();
		UpdateJourneyGuidance();
		UpdateSourceBubbleApproachRing();
	}
}
