using System.Collections.Generic;
using UnityEngine;

public class RhythmClarityController : MonoBehaviour
{
	public enum MissBucketPublic
	{
		None = 0,
		Early = 1,
		Late = 2,
		OffPath = 3,
		InvalidOperation = 4
	}

	[Header("Wiring")]
	[SerializeField] private AlgebraFeatureFlags featureFlagsOverride;
	[SerializeField] private DragExecutionController dragController;
	[SerializeField] private MonoBehaviour hintSinkBehaviour;
	[SerializeField] private RhythmClarityTuningProfile tuningProfile;
	[SerializeField] private bool applyTuningProfileOnAwake = true;

	[Header("Miss Messaging")]
	[SerializeField, Min(1)] private int repeatedMissWindow = 6;
	[SerializeField, Min(2)] private int repeatedMissThreshold = 2;
	[SerializeField, Min(2)] private int hintEscalationLevel2Threshold = 3;
	[SerializeField, Min(3)] private int hintEscalationLevel3Threshold = 4;
	[SerializeField] private string earlyMessage = "early: release a little later";
	[SerializeField] private string earlyMessageLevel2 = "early: wait for the pulse to cross center before release";
	[SerializeField] private string earlyMessageLevel3 = "timing cue: hold your release until the hit zone glows";
	[SerializeField] private string lateMessage = "late: release a little sooner";
	[SerializeField] private string lateMessageLevel2 = "late: release as the pulse enters the ring";
	[SerializeField] private string lateMessageLevel3 = "timing cue: commit slightly before the pulse exits the ring";
	[SerializeField] private string offPathMessage = "off-path: stay on the guide path";
	[SerializeField] private string offPathMessageLevel2 = "off-path: keep the drag line centered on the guide";
	[SerializeField] private string offPathMessageLevel3 = "path cue: slow down and follow the highlighted curve exactly";
	[SerializeField] private string invalidOperationMessage = "invalid operation: pick the highlighted valid move";
	[SerializeField] private string invalidOperationMessageLevel2 = "operation hint: undo the operation closest to x first";
	[SerializeField] private string invalidOperationMessageLevel3 = "operation cue: isolate x by reversing the last operation on its side";
	[SerializeField] private Color coachMessageColor = new Color(1f, 0.9f, 0.44f, 1f);
	[SerializeField, Min(0.2f)] private float hintHoldSeconds = 1.8f;
	[SerializeField, Min(0.2f)] private float calmModeHintHoldSeconds = 2f;

	[Header("Calm Mode")]
	[SerializeField] private bool enableCalmMode = true;
	[SerializeField, Min(1)] private int calmModeConsecutiveMissThreshold = 3;
	[SerializeField, Min(1)] private int calmModeRecoverySuccessThreshold = 3;
	[SerializeField] private string calmModeInstruction = "Focus mode: track the path and release in the green zone";

	[Header("Debug")]
	[SerializeField] private bool logDecisions;

	private readonly Queue<MissBucketPublic> recentMissBuckets = new Queue<MissBucketPublic>(8);
	private int consecutiveMisses;
	private int consecutiveSuccesses;
	private bool hasFeatureFlagGate;
	private IAlgebraHintSink hintSink;

	private void Awake()
	{
		if (!IsEnabledByFlags())
		{
			hasFeatureFlagGate = true;
			enabled = false;
			return;
		}

		ResolveReferences();
		if (tuningProfile == null)
			tuningProfile = Resources.Load<RhythmClarityTuningProfile>("RhythmClarityTuningProfile");
		if (applyTuningProfileOnAwake)
			ApplyTuningProfile(tuningProfile);
	}

	private void OnEnable()
	{
		if (hasFeatureFlagGate)
			return;

		ResolveReferences();
		Subscribe();
	}

	private void OnDisable()
	{
		if (hasFeatureFlagGate)
			return;

		Unsubscribe();
		SetCalmMode(enabled: false, MissBucketPublic.None);
	}

	private bool IsEnabledByFlags()
	{
		AlgebraFeatureFlags flags = AlgebraFeatureFlags.Resolve(featureFlagsOverride);
		if (flags == null)
			return false;

		return flags.EnableRhythmClarityTuning;
	}

	private void ResolveReferences()
	{
		if (dragController == null)
			dragController = FindFirstObjectByType<DragExecutionController>();
		if (hintSinkBehaviour == null)
			hintSinkBehaviour = SceneInterfaceLocator.FindFirstBehaviourImplementing<IAlgebraHintSink>();

		hintSink = hintSinkBehaviour as IAlgebraHintSink;
		if (hintSink == null && hintSinkBehaviour != null)
			hintSinkBehaviour = null;
	}

	private void Subscribe()
	{
		if (dragController != null)
			dragController.DragAttemptEvaluated += HandleDragAttemptEvaluated;
	}

	private void Unsubscribe()
	{
		if (dragController != null)
			dragController.DragAttemptEvaluated -= HandleDragAttemptEvaluated;
	}

	private void HandleDragAttemptEvaluated(DragExecutionController.DragAttemptTelemetry telemetry)
	{
		if (telemetry.hitResult == HitResult.Miss)
		{
			RegisterMiss(MapMissBucket(telemetry.missReason));
			return;
		}

		if (telemetry.hitResult == HitResult.Good || telemetry.hitResult == HitResult.Perfect)
			RegisterSuccess();
	}

	private void RegisterMiss(MissBucketPublic bucket)
	{
		consecutiveMisses++;
		consecutiveSuccesses = 0;

		EnqueueMissBucket(bucket);
		int bucketCount = CountMissBucket(bucket);
		if (bucketCount >= Mathf.Max(2, repeatedMissThreshold))
			ShowBucketMessage(bucket, bucketCount);

		if (enableCalmMode && consecutiveMisses >= Mathf.Max(1, calmModeConsecutiveMissThreshold))
			SetCalmMode(enabled: true, bucket);
	}

	private void RegisterSuccess()
	{
		consecutiveSuccesses++;
		consecutiveMisses = 0;

		if (!enableCalmMode)
			return;

		if (dragController != null &&
		    dragController.IsRhythmClarityCalmMode &&
		    consecutiveSuccesses >= Mathf.Max(1, calmModeRecoverySuccessThreshold))
		{
			SetCalmMode(enabled: false, MissBucketPublic.None);
		}
	}

	private void SetCalmMode(bool enabled, MissBucketPublic triggerBucket)
	{
		if (dragController != null)
			dragController.SetRhythmClarityCalmMode(enabled);

		if (hintSink != null)
		{
			hintSink.SetClarityFocus(enabled, enabled ? calmModeInstruction : null);
			if (enabled)
			{
				hintSink.ShowCoachingHint(
					BuildBucketMessage(triggerBucket, CountMissBucket(triggerBucket)),
					coachMessageColor,
					holdSeconds: Mathf.Max(0.2f, calmModeHintHoldSeconds));
			}
		}

		if (logDecisions)
			Debug.Log($"[RhythmClarityController] calm_mode={enabled} trigger={triggerBucket} misses={consecutiveMisses} successes={consecutiveSuccesses}");
	}

	private void ShowBucketMessage(MissBucketPublic bucket, int bucketCount)
	{
		int level = ResolveHintLadderLevel(bucketCount);
		string message = BuildBucketMessage(bucket, bucketCount);

		if (hintSink != null)
			hintSink.ShowCoachingHint(message, coachMessageColor, holdSeconds: Mathf.Max(0.2f, hintHoldSeconds));

		if (logDecisions)
			Debug.Log($"[RhythmClarityController] repeated_miss bucket={bucket} count={bucketCount} level={level} window={recentMissBuckets.Count}");
	}

	private string BuildBucketMessage(MissBucketPublic bucket, int bucketCount)
	{
		if (tuningProfile != null)
			return tuningProfile.GetHintMessage(bucket, ResolveHintLadderLevel(bucketCount));

		int level = ResolveHintLadderLevel(bucketCount);
		return bucket switch
		{
			MissBucketPublic.Early => level == 1 ? earlyMessage : level == 2 ? earlyMessageLevel2 : earlyMessageLevel3,
			MissBucketPublic.Late => level == 1 ? lateMessage : level == 2 ? lateMessageLevel2 : lateMessageLevel3,
			MissBucketPublic.InvalidOperation => level == 1 ? invalidOperationMessage : level == 2 ? invalidOperationMessageLevel2 : invalidOperationMessageLevel3,
			_ => level == 1 ? offPathMessage : level == 2 ? offPathMessageLevel2 : offPathMessageLevel3
		};
	}

	private int ResolveHintLadderLevel(int bucketCount)
	{
		int level3 = Mathf.Max(3, hintEscalationLevel3Threshold);
		int level2 = Mathf.Max(2, Mathf.Min(level3 - 1, hintEscalationLevel2Threshold));
		if (bucketCount >= level3)
			return 3;
		if (bucketCount >= level2)
			return 2;
		return 1;
	}

	private void EnqueueMissBucket(MissBucketPublic bucket)
	{
		if (bucket == MissBucketPublic.None)
			return;

		recentMissBuckets.Enqueue(bucket);
		int window = Mathf.Max(1, repeatedMissWindow);
		while (recentMissBuckets.Count > window)
			recentMissBuckets.Dequeue();
	}

	private int CountMissBucket(MissBucketPublic bucket)
	{
		if (bucket == MissBucketPublic.None)
			return 0;

		int count = 0;
		foreach (MissBucketPublic entry in recentMissBuckets)
		{
			if (entry == bucket)
				count++;
		}

		return count;
	}

	public void ApplyTuningProfile(RhythmClarityTuningProfile profile)
	{
		tuningProfile = profile;
		if (tuningProfile == null)
			return;

		repeatedMissWindow = Mathf.Max(1, tuningProfile.RepeatedMissWindow);
		repeatedMissThreshold = Mathf.Max(2, tuningProfile.RepeatedMissThreshold);
		hintEscalationLevel2Threshold = Mathf.Max(2, tuningProfile.HintEscalationLevel2Threshold);
		hintEscalationLevel3Threshold = Mathf.Max(3, tuningProfile.HintEscalationLevel3Threshold);
		coachMessageColor = tuningProfile.CoachMessageColor;
		hintHoldSeconds = Mathf.Max(0.2f, tuningProfile.HintHoldSeconds);
		calmModeHintHoldSeconds = Mathf.Max(0.2f, tuningProfile.CalmModeHoldSeconds);

		enableCalmMode = tuningProfile.EnableCalmMode;
		calmModeConsecutiveMissThreshold = Mathf.Max(1, tuningProfile.CalmModeConsecutiveMissThreshold);
		calmModeRecoverySuccessThreshold = Mathf.Max(1, tuningProfile.CalmModeRecoverySuccessThreshold);
		if (!string.IsNullOrWhiteSpace(tuningProfile.CalmModeInstruction))
			calmModeInstruction = tuningProfile.CalmModeInstruction;
	}

	private static MissBucketPublic MapMissBucket(DragExecutionController.DragMissReason reason)
	{
		switch (reason)
		{
			case DragExecutionController.DragMissReason.Early:
				return MissBucketPublic.Early;
			case DragExecutionController.DragMissReason.Late:
				return MissBucketPublic.Late;
			case DragExecutionController.DragMissReason.InvalidOperation:
				return MissBucketPublic.InvalidOperation;
			case DragExecutionController.DragMissReason.OffPath:
			case DragExecutionController.DragMissReason.DroppedOffTarget:
				return MissBucketPublic.OffPath;
			default:
				return MissBucketPublic.OffPath;
		}
	}
}
