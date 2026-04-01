using UnityEngine;

public class CreativeExpansionTrackController : MonoBehaviour
{
	[Header("Wiring")]
	[SerializeField] private AlgebraFeatureFlags featureFlagsOverride;
	[SerializeField] private MonoBehaviour progressionSourceBehaviour;
	[SerializeField] private CreativeExpansionContentProfile contentProfile;

	[Header("Sequence Packs")]
	[SerializeField] private bool enableSkillSequencePacks = true;

	[Header("Boss Encounters")]
	[SerializeField] private bool enableBossEquationEncounters = true;
	[SerializeField, Min(3)] private int bossEncounterEveryNEquations = 6;

	[Header("Dynamic Intensity")]
	[SerializeField] private bool enableDynamicAudioIntensity = true;
	[SerializeField, Range(0f, 1f)] private float baseIntensity = 0.2f;
	[SerializeField, Min(0.1f)] private float intensityLerpSpeed = 3f;

	[Header("Debug")]
	[SerializeField] private bool logSignals = true;

	public event System.Action<string> SequencePackActivated;
	public event System.Action<CreativeExpansionContentProfile.SkillPackDefinition> SequencePackResolved;
	public event System.Action<int> BossEncounterTriggered;
	public event System.Action<CreativeExpansionContentProfile.BossCueDefinition> BossCueResolved;
	public event System.Action<float> DynamicIntensityChanged;

	public string ActiveSequencePackKey => activeSequencePackKey;
	public float CurrentIntensity => currentIntensity;
	public CreativeExpansionContentProfile.SkillPackDefinition ActiveSequencePack => activeSequencePack;

	private bool hasFeatureFlagGate;
	private int equationLoadCount;
	private int bossEncounterCount;
	private string activeSequencePackKey = string.Empty;
	private CreativeExpansionContentProfile.SkillPackDefinition activeSequencePack;
	private float targetIntensity;
	private float currentIntensity;
	private IEquationProgressionSource progressionSource;

	private void Awake()
	{
		if (!IsEnabledByFlags())
		{
			hasFeatureFlagGate = true;
			enabled = false;
			return;
		}

		ResolveReferences();
		targetIntensity = Mathf.Clamp01(baseIntensity);
		currentIntensity = targetIntensity;
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
	}

	private void Update()
	{
		if (!enableDynamicAudioIntensity)
			return;

		float next = Mathf.Lerp(currentIntensity, targetIntensity, Time.unscaledDeltaTime * Mathf.Max(0.1f, intensityLerpSpeed));
		if (Mathf.Abs(next - currentIntensity) < 0.0001f)
			return;

		currentIntensity = next;
		DynamicIntensityChanged?.Invoke(currentIntensity);
	}

	private bool IsEnabledByFlags()
	{
		AlgebraFeatureFlags flags = AlgebraFeatureFlags.Resolve(featureFlagsOverride);
		if (flags == null)
			return false;
		return flags.EnableCreativeExpansionTrack;
	}

	private void ResolveReferences()
	{
		ResolveProgressionSource();
		if (contentProfile == null)
			contentProfile = Resources.Load<CreativeExpansionContentProfile>("CreativeExpansionContentProfile");
	}

	private void Subscribe()
	{
		if (progressionSource != null)
			progressionSource.EquationLoaded += HandleEquationLoaded;
		GameplayEventBus.StreakTierChanged += HandleStreakTierChanged;
	}

	private void Unsubscribe()
	{
		if (progressionSource != null)
			progressionSource.EquationLoaded -= HandleEquationLoaded;
		GameplayEventBus.StreakTierChanged -= HandleStreakTierChanged;
	}

	private void ResolveProgressionSource()
	{
		if (progressionSourceBehaviour == null)
			progressionSourceBehaviour = SceneInterfaceLocator.FindFirstBehaviourImplementing<IEquationProgressionSource>();

		progressionSource = progressionSourceBehaviour as IEquationProgressionSource;
		if (progressionSource == null && progressionSourceBehaviour != null)
			progressionSourceBehaviour = null;
	}

	private void HandleEquationLoaded(EquationEntry entry, string normalizedEquation, EquationDataSet.SchoolYear year)
	{
		equationLoadCount++;

		if (enableSkillSequencePacks)
			ActivatePackForSkill(entry != null ? entry.skillTag : EquationSkillTag.Unknown);

		if (enableBossEquationEncounters && equationLoadCount % Mathf.Max(3, bossEncounterEveryNEquations) == 0)
		{
			bossEncounterCount++;
			CreativeExpansionContentProfile.BossCueDefinition cue = ResolveBossCue();
			BossEncounterTriggered?.Invoke(equationLoadCount);
			BossCueResolved?.Invoke(cue);
			if (logSignals)
				Debug.Log($"[CreativeExpansionTrackController] Boss encounter trigger @equation={equationLoadCount} cue={(cue != null ? cue.cueId : "none")}");
		}
	}

	private void HandleStreakTierChanged(int streak, GameplayEventBus.StreakTier tier, float heat)
	{
		if (!enableDynamicAudioIntensity)
			return;

		float tierBoost = tier switch
		{
			GameplayEventBus.StreakTier.Tier1 => 0.18f,
			GameplayEventBus.StreakTier.Tier2 => 0.34f,
			GameplayEventBus.StreakTier.Tier3 => 0.52f,
			_ => 0f
		};

		targetIntensity = Mathf.Clamp01(baseIntensity + tierBoost + Mathf.Clamp01(heat) * 0.24f);
	}

	private void ActivatePackForSkill(EquationSkillTag skillTag)
	{
		activeSequencePack = contentProfile != null ? contentProfile.ResolvePack(skillTag) : null;
		string nextPack = ResolvePackKey(skillTag, activeSequencePack);
		if (string.Equals(nextPack, activeSequencePackKey, System.StringComparison.Ordinal))
			return;

		activeSequencePackKey = nextPack;
		SequencePackActivated?.Invoke(activeSequencePackKey);
		SequencePackResolved?.Invoke(activeSequencePack);
		if (logSignals)
		{
			string display = activeSequencePack != null && !string.IsNullOrWhiteSpace(activeSequencePack.displayName)
				? activeSequencePack.displayName
				: activeSequencePackKey;
			Debug.Log($"[CreativeExpansionTrackController] Sequence pack -> {display}");
		}
	}

	private CreativeExpansionContentProfile.BossCueDefinition ResolveBossCue()
	{
		if (contentProfile == null)
			return null;
		return contentProfile.ResolveBossCue(Mathf.Max(0, bossEncounterCount - 1));
	}

	private string ResolvePackKey(EquationSkillTag skillTag, CreativeExpansionContentProfile.SkillPackDefinition profilePack)
	{
		if (profilePack != null && !string.IsNullOrWhiteSpace(profilePack.packKey))
			return profilePack.packKey;

		string legacyKey = GetPackKey(skillTag);
		if (!string.IsNullOrWhiteSpace(legacyKey))
			return legacyKey;

		if (contentProfile != null && !string.IsNullOrWhiteSpace(contentProfile.DefaultPackKey))
			return contentProfile.DefaultPackKey;

		return "pack_baseline";
	}

	private static string GetPackKey(EquationSkillTag skillTag)
	{
		return skillTag switch
		{
			EquationSkillTag.MoveConstant => "pack_move_constant",
			EquationSkillTag.MoveVariable => "pack_move_variable",
			EquationSkillTag.DivideByCoefficient => "pack_divide",
			EquationSkillTag.ExpandBrackets => "pack_expand",
			EquationSkillTag.Substitution => "pack_substitute",
			EquationSkillTag.SignFlip => "pack_sign_flip",
			EquationSkillTag.MixedMultiStep => "pack_mixed",
			_ => "pack_baseline"
		};
	}
}
