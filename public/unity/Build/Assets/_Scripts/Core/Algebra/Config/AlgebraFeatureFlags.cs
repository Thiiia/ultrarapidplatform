using UnityEngine;

[CreateAssetMenu(fileName = "AlgebraFeatureFlags", menuName = "ULTRARAPID/Algebra/Feature Flags")]
public class AlgebraFeatureFlags : ScriptableObject
{
	[Header("Core Rollout")]
	[SerializeField] private bool enableSessionMetrics = false;
	[SerializeField] private bool enableAdaptiveDifficulty = false;
	[SerializeField] private bool enableMasteryProgression = false;

	[Header("Optional Tracks")]
	[SerializeField] private bool enableRhythmClarityTuning = false;
	[SerializeField] private bool enableCreativeExpansionTrack = false;
	[SerializeField] private bool enableBpmJudgementClamp = false;

	public bool EnableSessionMetrics => enableSessionMetrics;
	public bool EnableAdaptiveDifficulty => enableAdaptiveDifficulty;
	public bool EnableMasteryProgression => enableMasteryProgression;
	public bool EnableRhythmClarityTuning => enableRhythmClarityTuning;
	public bool EnableCreativeExpansionTrack => enableCreativeExpansionTrack;
	public bool EnableBpmJudgementClamp => enableBpmJudgementClamp;

	private static AlgebraFeatureFlags cachedResourceFlags;

	public static AlgebraFeatureFlags Resolve(AlgebraFeatureFlags overrideFlags = null)
	{
		if (overrideFlags != null)
			return overrideFlags;

		if (cachedResourceFlags == null)
			cachedResourceFlags = Resources.Load<AlgebraFeatureFlags>("AlgebraFeatureFlags");

		return cachedResourceFlags;
	}

	public static bool IsSessionMetricsEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableSessionMetrics;
	}

	public static bool IsAdaptiveDifficultyEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableAdaptiveDifficulty;
	}

	public static bool IsMasteryProgressionEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableMasteryProgression;
	}

	public static bool IsRhythmClarityTuningEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableRhythmClarityTuning;
	}

	public static bool IsCreativeExpansionTrackEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableCreativeExpansionTrack;
	}

	public static bool IsBpmJudgementClampEnabled(AlgebraFeatureFlags overrideFlags = null)
	{
		AlgebraFeatureFlags resolved = Resolve(overrideFlags);
		return resolved != null && resolved.EnableBpmJudgementClamp;
	}
}
