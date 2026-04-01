using System;

[Serializable]
public class AlgebraEquationMetricsRecord
{
	public string equationId;
	public string equationText;
	public string equationTextHash;
	public EquationDataSet.SchoolYear schoolYear;
	public EquationSkillTag skillTag;
	public int estimatedSteps;
	public int complexityScore;

	public string startedAtUtc;
	public string endedAtUtc;
	public float solveDurationSeconds;
	public bool solved;

	public int decisionsTaken;
	public int optimalDecisions;
	public int tagAttempts;
	public int correctTags;

	public int executionPerfect;
	public int executionGood;
	public int executionMiss;

	public int earlyMisses;
	public int lateMisses;
	public int pathMisses;
	public int invalidOperationMisses;

	public int hintsShown;
	public float meanPathCompletion01;
	public int pathCompletionSamples;
}
