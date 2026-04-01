using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class PlayerPerformanceModel
{
	[Serializable]
	private class EquationAttempt
	{
		public int decisions;
		public int optimalDecisions;
		public int tagAttempts;
		public int correctTags;
		public bool solved;
		public float solveDurationSeconds;
	}

	[Serializable]
	private struct ExecutionAttempt
	{
		public HitResult result;
		public float signedErrorMs;
		public float pathCompletion01;
	}

	public struct Snapshot
	{
		public int equationSamples;
		public int executionSamples;

		public float optimalDecisionRate;
		public float taggingAccuracy;
		public float executionGoodPerfectRate;
		public float executionMissRateLast20;
		public float timingErrorStdDevMs;
		public float meanPathCompletion01;
	}

	private readonly Queue<EquationAttempt> equationWindow = new Queue<EquationAttempt>(12);
	private readonly Queue<ExecutionAttempt> executionWindow = new Queue<ExecutionAttempt>(40);
	private readonly int equationWindowSize;
	private readonly int executionWindowSize;

	private EquationAttempt activeEquation;

	public PlayerPerformanceModel(int equationWindowSize = 12, int executionWindowSize = 40)
	{
		this.equationWindowSize = Mathf.Max(1, equationWindowSize);
		this.executionWindowSize = Mathf.Max(1, executionWindowSize);
		BeginEquation();
	}

	public void BeginEquation()
	{
		activeEquation = new EquationAttempt();
	}

	public void RecordDecision(bool wasOptimal)
	{
		EnsureActiveEquation();
		activeEquation.decisions++;
		if (wasOptimal)
			activeEquation.optimalDecisions++;
	}

	public void RecordTag(bool wasCorrect)
	{
		EnsureActiveEquation();
		activeEquation.tagAttempts++;
		if (wasCorrect)
			activeEquation.correctTags++;
	}

	public void RecordExecution(HitResult result, float signedErrorMs, float pathCompletion01)
	{
		ExecutionAttempt attempt = new ExecutionAttempt
		{
			result = result,
			signedErrorMs = signedErrorMs,
			pathCompletion01 = pathCompletion01
		};

		executionWindow.Enqueue(attempt);
		while (executionWindow.Count > executionWindowSize)
			executionWindow.Dequeue();
	}

	public void CompleteEquation(bool solved, float solveDurationSeconds)
	{
		EnsureActiveEquation();
		activeEquation.solved = solved;
		activeEquation.solveDurationSeconds = Mathf.Max(0f, solveDurationSeconds);

		equationWindow.Enqueue(activeEquation);
		while (equationWindow.Count > equationWindowSize)
			equationWindow.Dequeue();

		BeginEquation();
	}

	public void DiscardActiveEquation()
	{
		BeginEquation();
	}

	public Snapshot GetSnapshot()
	{
		Snapshot snapshot = new Snapshot
		{
			equationSamples = equationWindow.Count,
			executionSamples = executionWindow.Count,
			optimalDecisionRate = 0f,
			taggingAccuracy = 0f,
			executionGoodPerfectRate = 0f,
			executionMissRateLast20 = 0f,
			timingErrorStdDevMs = 0f,
			meanPathCompletion01 = float.NaN
		};

		int decisionCount = 0;
		int optimalCount = 0;
		int tagCount = 0;
		int correctTagCount = 0;

		foreach (EquationAttempt attempt in equationWindow)
		{
			if (attempt == null)
				continue;

			decisionCount += Mathf.Max(0, attempt.decisions);
			optimalCount += Mathf.Max(0, attempt.optimalDecisions);
			tagCount += Mathf.Max(0, attempt.tagAttempts);
			correctTagCount += Mathf.Max(0, attempt.correctTags);
		}

		snapshot.optimalDecisionRate = decisionCount > 0 ? optimalCount / (float)decisionCount : 0f;
		snapshot.taggingAccuracy = tagCount > 0 ? correctTagCount / (float)tagCount : 0f;

		int executionCount = 0;
		int goodOrPerfect = 0;
		int last20Count = 0;
		int last20Misses = 0;

		float meanError = 0f;
		float sqError = 0f;
		int timingSamples = 0;

		float pathSum = 0f;
		int pathSamples = 0;

		ExecutionAttempt[] executionArray = executionWindow.ToArray();
		for (int i = 0; i < executionArray.Length; i++)
		{
			ExecutionAttempt attempt = executionArray[i];
			executionCount++;

			if (attempt.result == HitResult.Perfect || attempt.result == HitResult.Good)
				goodOrPerfect++;

			if (!float.IsNaN(attempt.signedErrorMs))
			{
				meanError += attempt.signedErrorMs;
				sqError += attempt.signedErrorMs * attempt.signedErrorMs;
				timingSamples++;
			}

			if (!float.IsNaN(attempt.pathCompletion01))
			{
				pathSum += Mathf.Clamp01(attempt.pathCompletion01);
				pathSamples++;
			}
		}

		int startLast20 = Mathf.Max(0, executionArray.Length - 20);
		for (int i = startLast20; i < executionArray.Length; i++)
		{
			last20Count++;
			if (executionArray[i].result == HitResult.Miss)
				last20Misses++;
		}

		snapshot.executionGoodPerfectRate = executionCount > 0 ? goodOrPerfect / (float)executionCount : 0f;
		snapshot.executionMissRateLast20 = last20Count > 0 ? last20Misses / (float)last20Count : 0f;

		if (timingSamples > 1)
		{
			float mean = meanError / timingSamples;
			float variance = Mathf.Max(0f, (sqError / timingSamples) - (mean * mean));
			snapshot.timingErrorStdDevMs = Mathf.Sqrt(variance);
		}
		else
		{
			snapshot.timingErrorStdDevMs = 0f;
		}

		snapshot.meanPathCompletion01 = pathSamples > 0 ? pathSum / pathSamples : float.NaN;
		return snapshot;
	}

	private void EnsureActiveEquation()
	{
		if (activeEquation == null)
			activeEquation = new EquationAttempt();
	}
}
