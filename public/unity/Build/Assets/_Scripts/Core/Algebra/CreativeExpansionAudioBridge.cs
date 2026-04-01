using UnityEngine;

public class CreativeExpansionAudioBridge : MonoBehaviour
{
	[Header("Wiring")]
	[SerializeField] private AlgebraFeatureFlags featureFlagsOverride;
	[SerializeField] private CreativeExpansionTrackController expansionController;
	[SerializeField] private AudioManager audioManager;
	[SerializeField] private AudioSource bossCueSource;

	[Header("Volume Mapping")]
	[SerializeField, Range(0.5f, 1f)] private float minVolumeMultiplier = 0.86f;
	[SerializeField, Range(1f, 1.4f)] private float maxVolumeMultiplier = 1.08f;
	[SerializeField, Min(0.1f)] private float volumeLerpSpeed = 4f;
	[SerializeField, Range(0f, 0.25f)] private float bossPulseBoost = 0.08f;
	[SerializeField, Range(0f, 0.25f)] private float maxPackIntensityBias = 0.15f;
	[SerializeField, Min(0.1f)] private float bossPulseDecayPerSecond = 0.3f;

	[Header("Debug")]
	[SerializeField] private bool logSignals;

	private bool hasFeatureFlagGate;
	private float baselineMusicVolume = -1f;
	private float targetMusicVolume = -1f;
	private float activePackIntensityBias;
	private float pendingBossPulse;

	private void Awake()
	{
		if (!IsEnabledByFlags())
		{
			hasFeatureFlagGate = true;
			enabled = false;
			return;
		}

		ResolveReferences();
		CaptureBaselineVolume();
	}

	private void OnEnable()
	{
		if (hasFeatureFlagGate)
			return;

		ResolveReferences();
		CaptureBaselineVolume();
		Subscribe();
	}

	private void OnDisable()
	{
		if (hasFeatureFlagGate)
			return;

		Unsubscribe();
		RestoreBaselineVolume();
	}

	private void Update()
	{
		if (audioManager == null || audioManager.musicSource == null)
			return;

		if (pendingBossPulse > 0f)
			pendingBossPulse = Mathf.Max(0f, pendingBossPulse - Time.unscaledDeltaTime * Mathf.Max(0.1f, bossPulseDecayPerSecond));

		if (targetMusicVolume < 0f)
			targetMusicVolume = audioManager.musicSource.volume;

		float next = Mathf.MoveTowards(
			audioManager.musicSource.volume,
			targetMusicVolume,
			Time.unscaledDeltaTime * Mathf.Max(0.1f, volumeLerpSpeed));
		audioManager.musicSource.volume = Mathf.Clamp01(next);
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
		if (expansionController == null)
			expansionController = FindFirstObjectByType<CreativeExpansionTrackController>();
		if (audioManager == null)
			audioManager = AudioManager.Instance != null ? AudioManager.Instance : FindFirstObjectByType<AudioManager>();
	}

	private void Subscribe()
	{
		if (expansionController == null)
			return;

		expansionController.DynamicIntensityChanged += HandleDynamicIntensityChanged;
		expansionController.BossCueResolved += HandleBossCueResolved;
		expansionController.SequencePackResolved += HandleSequencePackResolved;
	}

	private void Unsubscribe()
	{
		if (expansionController == null)
			return;

		expansionController.DynamicIntensityChanged -= HandleDynamicIntensityChanged;
		expansionController.BossCueResolved -= HandleBossCueResolved;
		expansionController.SequencePackResolved -= HandleSequencePackResolved;
	}

	private void CaptureBaselineVolume()
	{
		if (audioManager == null || audioManager.musicSource == null)
			return;

		if (baselineMusicVolume < 0f)
			baselineMusicVolume = Mathf.Clamp01(audioManager.musicSource.volume);

		if (targetMusicVolume < 0f)
			targetMusicVolume = baselineMusicVolume;
	}

	private void RestoreBaselineVolume()
	{
		if (audioManager == null || audioManager.musicSource == null)
			return;
		if (baselineMusicVolume < 0f)
			return;

		audioManager.musicSource.volume = Mathf.Clamp01(baselineMusicVolume);
		targetMusicVolume = baselineMusicVolume;
		pendingBossPulse = 0f;
		activePackIntensityBias = 0f;
	}

	private void HandleDynamicIntensityChanged(float intensity01)
	{
		if (audioManager == null || audioManager.musicSource == null)
			return;

		if (baselineMusicVolume < 0f)
			baselineMusicVolume = Mathf.Clamp01(audioManager.musicSource.volume);

		float clamped = Mathf.Clamp01(intensity01 + activePackIntensityBias + pendingBossPulse);
		float multiplier = Mathf.Lerp(minVolumeMultiplier, maxVolumeMultiplier, clamped);
		targetMusicVolume = Mathf.Clamp01(baselineMusicVolume * multiplier);

		if (logSignals)
			Debug.Log($"[CreativeExpansionAudioBridge] intensity={clamped:F2} targetVolume={targetMusicVolume:F2}");
	}

	private void HandleBossCueResolved(CreativeExpansionContentProfile.BossCueDefinition cue)
	{
		if (cue == null)
		{
			ApplyBossPulseBoost(Mathf.Clamp(bossPulseBoost, 0f, 0.25f), equationCount: -1, cueId: null);
			return;
		}

		ApplyBossPulseBoost(Mathf.Clamp(cue.intensityPulseBoost, 0f, 0.25f), equationCount: -1, cueId: cue.cueId);
		if (bossCueSource != null && cue.cueClip != null)
			bossCueSource.PlayOneShot(cue.cueClip, 1f);
	}

	private void HandleSequencePackResolved(CreativeExpansionContentProfile.SkillPackDefinition pack)
	{
		activePackIntensityBias = pack != null
			? Mathf.Clamp(pack.intensityBias, -Mathf.Abs(maxPackIntensityBias), Mathf.Abs(maxPackIntensityBias))
			: 0f;

		if (logSignals)
			Debug.Log($"[CreativeExpansionAudioBridge] pack_intensity_bias={activePackIntensityBias:F2}");
	}

	private void ApplyBossPulseBoost(float boost, int equationCount, string cueId)
	{
		if (audioManager == null || audioManager.musicSource == null)
			return;
		if (baselineMusicVolume < 0f)
			return;

		pendingBossPulse = Mathf.Clamp01(Mathf.Max(pendingBossPulse, boost));
		targetMusicVolume = Mathf.Clamp01(targetMusicVolume + boost);
		if (!logSignals)
			return;

		if (!string.IsNullOrWhiteSpace(cueId))
			Debug.Log($"[CreativeExpansionAudioBridge] boss_cue={cueId} pulse={boost:F2} targetVolume={targetMusicVolume:F2}");
		else
			Debug.Log($"[CreativeExpansionAudioBridge] boss_pulse eq={equationCount} pulse={boost:F2} targetVolume={targetMusicVolume:F2}");
	}
}
