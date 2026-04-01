using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

[DisallowMultipleComponent]
public sealed class AlgebraResultsSessionTracker : MonoBehaviour
{
	private readonly List<float> trendSamples = new List<float>(128);

	private DragExecutionController dragController;
	private bool finalChainFlushed;
	private int currentCombo;

	public int PerfectCount { get; private set; }
	public int GoodCount { get; private set; }
	public int EarlyCount { get; private set; }
	public int LateCount { get; private set; }
	public int OtherMisses { get; private set; }
	public int EquationsSolved { get; private set; }
	public int StreakChainsAchieved { get; private set; }

	public IReadOnlyList<float> TrendSamples => trendSamples;

	public void Initialize(DragExecutionController controller)
	{
		if (dragController == controller && controller != null)
			return;

		Detach();
		dragController = controller;
		Attach();
	}

	public AlgebraResultsSnapshot BuildSnapshot(string levelDisplayName)
	{
		FlushFinalChainIfNeeded();

		AlgebraScoreSnapshot score = dragController != null
			? dragController.GetScoreSnapshot()
			: default;

		return new AlgebraResultsSnapshot
		{
			sceneKey = SceneManager.GetActiveScene().name,
			levelDisplayName = levelDisplayName,
			score = score.score,
			pastHighScore = 0,
			isNewBest = false,
			perfectCount = PerfectCount,
			goodCount = GoodCount,
			earlyCount = EarlyCount,
			lateCount = LateCount,
			otherMisses = OtherMisses,
			streakChainsAchieved = StreakChainsAchieved,
			maxCombo = score.maxCombo,
			equationsSolved = EquationsSolved,
			accuracyPercent = score.accuracyPercent,
			trendSamples = new List<float>(trendSamples)
		};
	}

	public void ResetSession()
	{
		PerfectCount = 0;
		GoodCount = 0;
		EarlyCount = 0;
		LateCount = 0;
		OtherMisses = 0;
		EquationsSolved = 0;
		StreakChainsAchieved = 0;
		currentCombo = 0;
		finalChainFlushed = false;
		trendSamples.Clear();
	}

	private void OnEnable()
	{
		Attach();
	}

	private void OnDisable()
	{
		Detach();
	}

	private void OnDestroy()
	{
		Detach();
	}

	private void Attach()
	{
		if (dragController == null)
			return;

		dragController.DragAttemptEvaluated -= HandleDragAttemptEvaluated;
		dragController.OnEquationSolved -= HandleEquationSolved;
		dragController.DragAttemptEvaluated += HandleDragAttemptEvaluated;
		dragController.OnEquationSolved += HandleEquationSolved;
	}

	private void Detach()
	{
		if (dragController == null)
			return;

		dragController.DragAttemptEvaluated -= HandleDragAttemptEvaluated;
		dragController.OnEquationSolved -= HandleEquationSolved;
	}

	private void HandleDragAttemptEvaluated(DragExecutionController.DragAttemptTelemetry telemetry)
	{
		finalChainFlushed = false;

		switch (telemetry.hitResult)
		{
			case HitResult.Perfect:
				PerfectCount++;
				currentCombo++;
				break;
			case HitResult.Good:
				GoodCount++;
				currentCombo++;
				break;
			default:
				RegisterMissReason(telemetry.missReason);
				FlushCurrentChain();
				break;
		}

		trendSamples.Add(ResolveTrendSample(telemetry));
	}

	private void HandleEquationSolved()
	{
		EquationsSolved = Mathf.Max(0, EquationsSolved + 1);
	}

	private void RegisterMissReason(DragExecutionController.DragMissReason missReason)
	{
		switch (missReason)
		{
			case DragExecutionController.DragMissReason.Early:
				EarlyCount++;
				break;
			case DragExecutionController.DragMissReason.Late:
				LateCount++;
				break;
			default:
				OtherMisses++;
				break;
		}
	}

	private void FlushCurrentChain()
	{
		if (currentCombo <= 0)
			return;

		StreakChainsAchieved++;
		currentCombo = 0;
	}

	private void FlushFinalChainIfNeeded()
	{
		if (finalChainFlushed)
			return;

		FlushCurrentChain();
		finalChainFlushed = true;
	}

	private static float ResolveTrendSample(DragExecutionController.DragAttemptTelemetry telemetry)
	{
		if (!float.IsNaN(telemetry.scoreContribution01))
		{
			float contribution = Mathf.Clamp01(telemetry.scoreContribution01);
			if (telemetry.hitResult == HitResult.Miss && telemetry.missReason != DragExecutionController.DragMissReason.Early && telemetry.missReason != DragExecutionController.DragMissReason.Late)
				return Mathf.Min(0.08f, contribution);
			return contribution;
		}

		if (!float.IsNaN(telemetry.normalizedToMiss))
		{
			float quality = 1f - Mathf.Clamp01(telemetry.normalizedToMiss);
			if (telemetry.hitResult == HitResult.Miss && telemetry.missReason != DragExecutionController.DragMissReason.Early && telemetry.missReason != DragExecutionController.DragMissReason.Late)
				return Mathf.Min(0.08f, quality);
			return quality;
		}

		return telemetry.hitResult switch
		{
			HitResult.Perfect => 1f,
			HitResult.Good => 0.72f,
			_ => 0.08f,
		};
	}
}
