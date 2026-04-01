using System;

[Serializable]
public class AlgebraMetricsSessionSummary
{
	public string sessionId;
	public string sceneName;
	public string startedAtUtc;
	public string endedAtUtc;
	public float durationSeconds;

	public int equationsStarted;
	public int equationsSolved;
	public float equationCompletionRate;

	public float decisionOptimalRate;
	public float taggingAccuracy;
	public float executionGoodPerfectRate;
	public float meanSolveDurationSeconds;

	public int totalHintsShown;
	public float meanPathCompletion01;
}
