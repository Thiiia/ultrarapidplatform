using System;

[Serializable]
public struct AlgebraScoreSnapshot
{
	public int score;
	public int accuracyPercent;
	public int totalAttempts;
	public int currentStreak;
	public int maxCombo;
	public int perfectCount;
	public int goodCount;
	public int missCount;
	public float perfectPoints;
	public float goodPoints;
	public float missPoints;
}
