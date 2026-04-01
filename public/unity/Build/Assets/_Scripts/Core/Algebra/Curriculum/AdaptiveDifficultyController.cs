using UnityEngine;

public class AdaptiveDifficultyController : MonoBehaviour
{
	[Header("Wiring")]
	[SerializeField] private AlgebraFeatureFlags featureFlagsOverride;
	[SerializeField] private EquationChoiceSystem choiceSystem;
	[SerializeField] private DragExecutionController dragController;

	[Header("Bounds")]
	[SerializeField] private int dragsPerStepMin = 3;
	[SerializeField] private int dragsPerStepMax = 6;
	[SerializeField] private float wispOverlapGoodMinMin = 0.45f;
	[SerializeField] private float wispOverlapGoodMinMax = 0.70f;
	[SerializeField] private float wispOverlapPerfectMinMin = 0.75f;
	[SerializeField] private float wispOverlapPerfectMinMax = 0.92f;

	[Header("Trigger Thresholds")]
	[SerializeField, Range(0f, 1f)] private float assistMissRateThreshold = 0.35f;
	[SerializeField, Range(0f, 1f)] private float challengeExecutionThreshold = 0.80f;
	[SerializeField, Range(0f, 1f)] private float challengePathCompletionThreshold = 0.78f;

	[Header("Debug")]
	[SerializeField] private bool logAdaptationDecisions = true;

	private readonly PlayerPerformanceModel performanceModel = new PlayerPerformanceModel(12, 40);

	private int baselineDragsPerStep;
	private float baselineGoodMin;
	private float baselinePerfectMin;

	private bool hasActiveEquation;
	private string activeEquationSignature;
	private float equationStartedAt;
	private bool hasFeatureFlagGate;

	private enum AdaptationMode
	{
		Neutral,
		Assist,
		Challenge
	}

	private void Awake()
	{
		if (!IsAdaptiveEnabledByFlags())
		{
			hasFeatureFlagGate = true;
			enabled = false;
			return;
		}

		ResolveReferences();
		CaptureBaselines();
	}

	private void OnEnable()
	{
		if (hasFeatureFlagGate)
			return;

		ResolveReferences();
		CaptureBaselines();
		Subscribe();
		BootstrapActiveEquationIfNeeded();
	}

	private void OnDisable()
	{
		if (hasFeatureFlagGate)
			return;

		Unsubscribe();
	}

	private bool IsAdaptiveEnabledByFlags()
	{
		AlgebraFeatureFlags flags = AlgebraFeatureFlags.Resolve(featureFlagsOverride);
		if (flags == null)
			return false;

		return flags.EnableAdaptiveDifficulty;
	}

	private void ResolveReferences()
	{
		if (choiceSystem == null)
			choiceSystem = FindFirstObjectByType<EquationChoiceSystem>();
		if (dragController == null)
			dragController = FindFirstObjectByType<DragExecutionController>();
	}

	private void CaptureBaselines()
	{
		if (dragController != null)
		{
			baselineDragsPerStep = dragController.DragsPerStep;
			baselineGoodMin = dragController.WispOverlapGoodMin;
			baselinePerfectMin = dragController.WispOverlapPerfectMin;
		}
		else
		{
			baselineDragsPerStep = 5;
			baselineGoodMin = 0.55f;
			baselinePerfectMin = 0.85f;
		}
	}

	private void Subscribe()
	{
		if (dragController != null)
			dragController.DragAttemptEvaluated += HandleDragAttemptEvaluated;

		if (choiceSystem != null)
			choiceSystem.OnStateChanged += HandleChoiceStateChanged;
	}

	private void Unsubscribe()
	{
		if (dragController != null)
			dragController.DragAttemptEvaluated -= HandleDragAttemptEvaluated;

		if (choiceSystem != null)
			choiceSystem.OnStateChanged -= HandleChoiceStateChanged;
	}

	private void BootstrapActiveEquationIfNeeded()
	{
		if (hasActiveEquation || choiceSystem == null || choiceSystem.CurrentState == null)
			return;

		if (choiceSystem.CurrentState.IsSolved())
			return;

		StartNewEquationBoundary(choiceSystem.CurrentState, "bootstrap");
	}

	private void HandleChoiceStateChanged(EquationState state)
	{
		if (state == null)
			return;

		if (state.IsSolved())
		{
			if (!hasActiveEquation)
				return;

			float duration = Mathf.Max(0f, Time.unscaledTime - equationStartedAt);
			performanceModel.CompleteEquation(solved: true, solveDurationSeconds: duration);
			hasActiveEquation = false;
			activeEquationSignature = string.Empty;
			return;
		}

		string signature = BuildEquationSignature(state);
		if (!hasActiveEquation || !string.Equals(activeEquationSignature, signature, System.StringComparison.Ordinal))
			StartNewEquationBoundary(state, !hasActiveEquation ? "state_change" : "equation_swap");
	}

	private void StartNewEquationBoundary(EquationState state, string reason)
	{
		if (hasActiveEquation)
		{
			float duration = Mathf.Max(0f, Time.unscaledTime - equationStartedAt);
			performanceModel.CompleteEquation(solved: false, solveDurationSeconds: duration);
		}
		else
		{
			performanceModel.DiscardActiveEquation();
		}

		hasActiveEquation = true;
		activeEquationSignature = BuildEquationSignature(state);
		equationStartedAt = Time.unscaledTime;
		ApplyBoundaryAdaptation(reason);
	}

	private static string BuildEquationSignature(EquationState state)
	{
		return EquationStringUtil.NormalizeForParsing(state != null ? state.rawEquation : string.Empty);
	}

	private void HandleDragAttemptEvaluated(DragExecutionController.DragAttemptTelemetry telemetry)
	{
		performanceModel.RecordExecution(telemetry.hitResult, telemetry.signedErrorMs, telemetry.pathCompletion01);
	}

	private void ApplyBoundaryAdaptation(string reason)
	{
		if (dragController == null)
			return;

		PlayerPerformanceModel.Snapshot snapshot = performanceModel.GetSnapshot();
		AdaptationMode mode = ResolveMode(snapshot);

		int oldDrags = dragController.DragsPerStep;
		float oldGood = dragController.WispOverlapGoodMin;
		float oldPerfect = dragController.WispOverlapPerfectMin;

		int targetDrags = oldDrags;
		float targetGood = oldGood;
		float targetPerfect = oldPerfect;

		switch (mode)
		{
			case AdaptationMode.Assist:
				targetDrags = oldDrags + 1;
				targetGood = oldGood - 0.04f;
				targetPerfect = oldPerfect - 0.04f;
				break;
			case AdaptationMode.Challenge:
				targetDrags = oldDrags - 1;
				targetGood = oldGood + 0.03f;
				targetPerfect = oldPerfect + 0.03f;
				break;
			default:
				targetDrags = MoveToward(oldDrags, baselineDragsPerStep, 1);
				targetGood = Mathf.MoveTowards(oldGood, baselineGoodMin, 0.02f);
				targetPerfect = Mathf.MoveTowards(oldPerfect, baselinePerfectMin, 0.02f);
				break;
		}

		targetDrags = Mathf.Clamp(targetDrags, dragsPerStepMin, dragsPerStepMax);
		targetGood = Mathf.Clamp(targetGood, wispOverlapGoodMinMin, wispOverlapGoodMinMax);
		targetPerfect = Mathf.Clamp(targetPerfect, wispOverlapPerfectMinMin, wispOverlapPerfectMinMax);
		targetPerfect = Mathf.Max(targetPerfect, targetGood + 0.05f);

		bool changed =
			targetDrags != oldDrags ||
			Mathf.Abs(targetGood - oldGood) > 0.0001f ||
			Mathf.Abs(targetPerfect - oldPerfect) > 0.0001f;

		if (!changed)
			return;

		dragController.SetAdaptiveDifficultySettings(targetDrags, targetGood, targetPerfect);

		if (!logAdaptationDecisions)
			return;

		Debug.Log(
			$"[AdaptiveDifficultyController] mode={mode} reason={reason} " +
			$"drags {oldDrags}->{targetDrags}, " +
			$"overlap {oldGood:F2}/{oldPerfect:F2}->{targetGood:F2}/{targetPerfect:F2}, " +
			$"metrics miss20={snapshot.executionMissRateLast20:P0}, exec={snapshot.executionGoodPerfectRate:P0}, sigma={snapshot.timingErrorStdDevMs:F1}ms, path={(float.IsNaN(snapshot.meanPathCompletion01) ? -1f : snapshot.meanPathCompletion01):F2}" );
	}

	private AdaptationMode ResolveMode(PlayerPerformanceModel.Snapshot snapshot)
	{
		if (snapshot.executionSamples >= 20 && snapshot.executionMissRateLast20 > assistMissRateThreshold)
			return AdaptationMode.Assist;

		bool challengePathReady = float.IsNaN(snapshot.meanPathCompletion01)
			|| snapshot.meanPathCompletion01 >= challengePathCompletionThreshold;
		if (snapshot.equationSamples >= 4 &&
			snapshot.executionGoodPerfectRate >= challengeExecutionThreshold &&
			challengePathReady)
		{
			return AdaptationMode.Challenge;
		}

		return AdaptationMode.Neutral;
	}

	private static int MoveToward(int current, int target, int maxDelta)
	{
		if (current < target)
			return Mathf.Min(current + Mathf.Max(1, maxDelta), target);
		if (current > target)
			return Mathf.Max(current - Mathf.Max(1, maxDelta), target);
		return current;
	}
}
