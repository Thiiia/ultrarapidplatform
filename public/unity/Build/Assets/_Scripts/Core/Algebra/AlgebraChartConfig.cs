using UnityEngine;

/// <summary>
/// Small config object that ties the Algebra "journey" to a specific chart + difficulty.
/// This is a stepping stone toward full level authoring (equation banks + chart + visuals).
/// </summary>
[CreateAssetMenu(fileName = "AlgebraChartConfig", menuName = "ULTRARAPID/Algebra/Chart Config")]
public class AlgebraChartConfig : ScriptableObject
{
	[Header("Chart")]
	public string chartPath = "Charts/Grafix - Feel Alive Chart File.chart";
	public ChartSystem.Difficulty chartDifficulty = ChartSystem.Difficulty.EasyGuitar;

	[Header("Rhythm Feel")]
	[Min(1)] public int dragsPerStep = 5;
	[Tooltip("Interpreted as 'notes ahead' when BeatScheduleMode is FromNotes.")]
	[Min(1f)] public float wispSpeedNotesAhead = 2f;
}

