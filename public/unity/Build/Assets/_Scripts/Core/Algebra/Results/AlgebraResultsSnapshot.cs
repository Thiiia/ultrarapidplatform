using System;
using System.Collections.Generic;

[Serializable]
public sealed class AlgebraResultsSnapshot
{
	public string sceneKey;
	public string levelDisplayName;
	public int score;
	public int pastHighScore;
	public bool isNewBest;
	public int perfectCount;
	public int goodCount;
	public int earlyCount;
	public int lateCount;
	public int otherMisses;
	public int streakChainsAchieved;
	public int maxCombo;
	public int equationsSolved;
	public int accuracyPercent;
	public List<float> trendSamples;

	public int VisibleTimingTotal => perfectCount + goodCount + earlyCount + lateCount;
}
