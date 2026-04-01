using UnityEngine;

[CreateAssetMenu(fileName = "RhythmClarityTuningProfile", menuName = "ULTRARAPID/Algebra/Rhythm Clarity Tuning Profile")]
public class RhythmClarityTuningProfile : ScriptableObject
{
	[Header("Miss Window")]
	[SerializeField, Min(1)] private int repeatedMissWindow = 6;
	[SerializeField, Min(2)] private int repeatedMissThreshold = 2;
	[SerializeField, Min(2)] private int hintEscalationLevel2Threshold = 3;
	[SerializeField, Min(3)] private int hintEscalationLevel3Threshold = 4;

	[Header("Hint Ladder")]
	[SerializeField] private string earlyLevel1 = "early: release a little later";
	[SerializeField] private string earlyLevel2 = "early: wait for the pulse to cross center before release";
	[SerializeField] private string earlyLevel3 = "timing cue: hold your release until the hit zone glows";
	[SerializeField] private string lateLevel1 = "late: release a little sooner";
	[SerializeField] private string lateLevel2 = "late: release as the pulse enters the ring";
	[SerializeField] private string lateLevel3 = "timing cue: commit slightly before the pulse exits the ring";
	[SerializeField] private string offPathLevel1 = "off-path: stay on the guide path";
	[SerializeField] private string offPathLevel2 = "off-path: keep the drag line centered on the guide";
	[SerializeField] private string offPathLevel3 = "path cue: slow down and follow the highlighted curve exactly";
	[SerializeField] private string invalidLevel1 = "invalid operation: pick the highlighted valid move";
	[SerializeField] private string invalidLevel2 = "operation hint: undo the operation closest to x first";
	[SerializeField] private string invalidLevel3 = "operation cue: isolate x by reversing the last operation on its side";

	[Header("Coach UI")]
	[SerializeField] private Color coachMessageColor = new Color(1f, 0.9f, 0.44f, 1f);
	[SerializeField, Min(0.2f)] private float hintHoldSeconds = 1.8f;
	[SerializeField, Min(0.2f)] private float calmModeHoldSeconds = 2f;

	[Header("Calm Mode")]
	[SerializeField] private bool enableCalmMode = true;
	[SerializeField, Min(1)] private int calmModeConsecutiveMissThreshold = 3;
	[SerializeField, Min(1)] private int calmModeRecoverySuccessThreshold = 3;
	[SerializeField] private string calmModeInstruction = "Focus mode: track the path and release in the green zone";

	public int RepeatedMissWindow => repeatedMissWindow;
	public int RepeatedMissThreshold => repeatedMissThreshold;
	public int HintEscalationLevel2Threshold => hintEscalationLevel2Threshold;
	public int HintEscalationLevel3Threshold => hintEscalationLevel3Threshold;

	public Color CoachMessageColor => coachMessageColor;
	public float HintHoldSeconds => hintHoldSeconds;
	public float CalmModeHoldSeconds => calmModeHoldSeconds;

	public bool EnableCalmMode => enableCalmMode;
	public int CalmModeConsecutiveMissThreshold => calmModeConsecutiveMissThreshold;
	public int CalmModeRecoverySuccessThreshold => calmModeRecoverySuccessThreshold;
	public string CalmModeInstruction => calmModeInstruction;

	public string GetHintMessage(RhythmClarityController.MissBucketPublic bucket, int ladderLevel)
	{
		int level = Mathf.Clamp(ladderLevel, 1, 3);
		switch (bucket)
		{
			case RhythmClarityController.MissBucketPublic.Early:
				return level == 1 ? earlyLevel1 : level == 2 ? earlyLevel2 : earlyLevel3;
			case RhythmClarityController.MissBucketPublic.Late:
				return level == 1 ? lateLevel1 : level == 2 ? lateLevel2 : lateLevel3;
			case RhythmClarityController.MissBucketPublic.InvalidOperation:
				return level == 1 ? invalidLevel1 : level == 2 ? invalidLevel2 : invalidLevel3;
			default:
				return level == 1 ? offPathLevel1 : level == 2 ? offPathLevel2 : offPathLevel3;
		}
	}
}
