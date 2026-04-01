using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;

using DG.Tweening;

using UnityEngine;
using UnityEngine.SceneManagement;

public class AudioManager : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	private static extern void unity_resumeAudioContext();
#endif

	// -----------------------------------------------------------------------------
	// SINGLETON (one baton, one band leader)
	// -----------------------------------------------------------------------------
	public static AudioManager Instance;
	private const string BaselinePrefKey = "Audio_BaselineSeconds";
	private const string CalibrationPrefKey = "Audio_CalibrationSeconds";

	// PlayerPrefs key the rest of the show references
	private const string TutorialSeenPrefKey = "TutorialCompleted";

	// -----------------------------------------------------------------------------
	// INSPECTOR
	// -----------------------------------------------------------------------------
	[Header("Audio Source")]
	[Tooltip("Primary music AudioSource. Must have clip assigned before scheduling.")]
	public AudioSource musicSource;

	[Header("Scheduling")]
	[Tooltip("Auto-align dspStartTime once we detect real playback has begun.")]
	public bool usePlaybackAutoAlignment = true;

	[Tooltip("Lead time (seconds) for SchedulePlaybackNow(). 2060ms is typical.")]
	[Range(0f, 0.25f)] public float defaultLeadTime = 0.05f;
	[Header("WebGL Defaults")]
	[SerializeField, Range(0f, 0.5f), Tooltip("Fallback latency baseline for WebGL when no calibration exists.")]
	private float webGlDefaultBaselineSeconds = 0.18f;

	[Header("Fades (optional polish)")]
	[Tooltip("Optional fade when pausing. 0 = instant.")]
	[Range(0f, 0.5f)] public float pauseFadeSeconds = 0f;

	[Tooltip("Optional fade when resuming. 0 = instant.")]
	[Range(0f, 0.5f)] public float resumeFadeSeconds = 0f;

	[Header("Debug")]
	[Tooltip("Verbose logs for timing nerds.")]
	public bool verboseLogging = false;

	// -----------------------------------------------------------------------------
	// PUBLIC SURFACE 
	// -----------------------------------------------------------------------------
	public double dspStartTime { get; private set; }      // authoritative DSP anchor
	public float songLength;                             // cache from clip
	public bool songRestartedFromSceneReload = false;   // ChartSystem handshake
	public bool HasSongStarted { get; private set; } = false;
	public bool AutoStartSuppressed { get; private set; } = false;
	public static bool IsAutoStartSuppressed => suppressNextAutoStart || (Instance != null && Instance.AutoStartSuppressed);

	public static double BaselineLatencySeconds { get; private set; } = 0f;
	public static double CalibrationLatencySeconds { get; private set; } = 0f;
	public static double LatencyOffsetSeconds => BaselineLatencySeconds + CalibrationLatencySeconds;
	public static bool AudioUnlocked { get; private set; }
	public static double CachedSongTime { get; private set; }

	// -----------------------------------------------------------------------------
	// EVENTS (hook UI/VFX without polling)
	// -----------------------------------------------------------------------------
	public event Action<double> OnPlaybackScheduled; // arg: scheduled DSP time
	public event Action<double> OnPlaybackAligned;   // arg: corrected DSP time
	public event Action OnPaused;
	public event Action OnResumed;
	public event Action OnStopped;
	public event Action OnPlaybackStarted;

	// -----------------------------------------------------------------------------
	// INTERNAL STATE
	// -----------------------------------------------------------------------------
	private static bool suppressNextAutoStart = false;

	private double dspPauseStartTime = -1;
	private double totalPausedDuration = 0;
	private bool pauseRequestedBeforePlayback = false;
	private bool needsPlaybackAlignment = true;
	private bool isScheduled = false;

	private Coroutine deferredPauseRoutine;
	private Coroutine fadeRoutine;
	private float originalVolume = 1f;
	private static bool pendingScheduleAfterUnlock;

	// -----------------------------------------------------------------------------
	// LIFECYCLE
	// -----------------------------------------------------------------------------
	private void Awake()
	{
		LoadPersistedLatency();

		if (Instance == null)
		{
			Instance = this;

			// Only persist if we're not in the Onboarding scene
			string currentScene = SceneManager.GetActiveScene().name;
			if (currentScene != "Onboarding")
				DontDestroyOnLoad(gameObject);

			if (pendingScheduleAfterUnlock)
			{
				pendingScheduleAfterUnlock = false;
				SchedulePlaybackNow();
			}
		}
		else
		{
			DisableOwnedAudioListeners();
			Destroy(gameObject);
		}
	}

	private void Start()
	{
		var currentScene = SceneManager.GetActiveScene().name;
		if (currentScene == "Calibration") return;

#if UNITY_WEBGL
		// Respect baseline chosen in Calibration; if none set, apply a safe default.
		if (BaselineLatencySeconds <= 0.0)
			SetPlatformLatencyBaseline(webGlDefaultBaselineSeconds);
		defaultLeadTime = 0.15f;                // small runway for browser buffering
#endif

		if (GameplayEventBus.uploadedClip != null)
		{
			musicSource.clip = GameplayEventBus.uploadedClip;
		}

		if (musicSource != null && musicSource.clip != null)
		{
			originalVolume = musicSource.volume;
			songLength = musicSource.clip.length;

			if (songRestartedFromSceneReload)
			{
				Log("Waiting for ChartSystem to re-schedule playback after scene reload");
				return;
			}

			// Auto-start is suppressed either when explicitly requested (e.g. via
			// SuppressNextAutoStart from TutorialManager) or when the tutorial has
			// not yet been completed on this device.
			bool shouldSuppress = suppressNextAutoStart || PlayerPrefs.GetInt(TutorialSeenPrefKey, 0) == 0;

#if UNITY_WEBGL && !UNITY_EDITOR
			// Browser audio contexts must be unlocked from a user gesture.
			// Never auto-schedule playback until the unlock has happened.
			if (!AudioUnlocked)
				shouldSuppress = true;
#endif

			// Normalize *every* run to current intent, so stale states don't persist
			AutoStartSuppressed = shouldSuppress;
			suppressNextAutoStart = false;
			pauseRequestedBeforePlayback = false;
			HasSongStarted = false;
			isScheduled = false;

			if (shouldSuppress)
			{
				// If AudioManager persisted from a previous scene, the source can still be playing.
				// Suppressed/manual-start flows must begin from a clean stopped state or systems that
				// read song time (ChartSystem/wisp/end watcher) will think the song is already underway.
				if (musicSource.isPlaying)
				{
					musicSource.Stop();
				}
				musicSource.time = 0f;
				musicSource.timeSamples = 0;
				ResetPauseAccounting();
				CachedSongTime = 0d;
				Log("Auto-start suppressed; waiting for manual trigger.");
			}
			else
			{
				SchedulePlaybackNow();
			}
		}
	}


	private void OnDisable()
	{
		KillCoroutine(ref deferredPauseRoutine);
		KillCoroutine(ref fadeRoutine);
	}

	private void Update()
	{
		if (musicSource == null) return;

		if (!HasSongStarted && musicSource.isPlaying)
		{
			HasSongStarted = true;
			OnPlaybackStarted?.Invoke();
		}

		if (usePlaybackAutoAlignment && HasSongStarted && needsPlaybackAlignment)
		{
#if UNITY_WEBGL
			// Wait for audible progress in WebGL to avoid early anchoring
			if (musicSource.isPlaying && musicSource.time > 0.05f)
#else
        if (musicSource.timeSamples > 0 || musicSource.time > 0f)
#endif
			{
				AlignToActualPlaybackStart();
				needsPlaybackAlignment = false;
				isScheduled = false;
			}
		}

		CachedSongTime = GetAdjustedSongTime();
	}

	// -----------------------------------------------------------------------------
	// CORE API 
	// -----------------------------------------------------------------------------
	public double GetAdjustedSongTime()
	{
		// If gameplay is not actually running yet, keep the virtual clock at 0.
		// Covers: tutorial suppression, pre-playback pause, or not scheduled at all.
		if (!HasSongStarted && (AutoStartSuppressed || pauseRequestedBeforePlayback || !isScheduled))
			return 0d;

		double pausedOffset = dspPauseStartTime > 0 ? AudioSettings.dspTime - dspPauseStartTime : 0;
		double rawTime = AudioSettings.dspTime - dspStartTime - totalPausedDuration - pausedOffset;

		// Before the scheduled dsp time arrives, rawTime can be negative; clamp it.
		if (rawTime < 0) rawTime = 0;

		// Apply latency after the base clock is established; keep non-negative.
		double adjusted = rawTime - LatencyOffsetSeconds;
		return adjusted < 0 ? 0 : adjusted;
	}


	public void RestartSong()
	{
		if (musicSource == null || musicSource.clip == null) return;

		KillCoroutine(ref deferredPauseRoutine);
		KillCoroutine(ref fadeRoutine);

		pauseRequestedBeforePlayback = false;
		HasSongStarted = false;

		musicSource.Stop();
		ResetPauseAccounting();

		songRestartedFromSceneReload = true;
		AutoStartSuppressed = false;
		suppressNextAutoStart = false;
		isScheduled = false;
		CachedSongTime = 0d;

		OnStopped?.Invoke();
		Log("Music stopped; waiting for ChartSystem to schedule after scene reload.");
	}

	public void PauseSong()
	{
		if (musicSource == null)
		{
			Debug.LogWarning("[AudioManager] PauseSong called but musicSource is null.");
			return;
		}

		// If already playing, apply fade (optional) then pause
		if (musicSource.isPlaying)
		{
			KillCoroutine(ref fadeRoutine);
			if (pauseFadeSeconds > 0f)
			{
				fadeRoutine = StartCoroutine(FadeAndThen(0f, pauseFadeSeconds, () =>
				{
					musicSource.Pause();
					dspPauseStartTime = AudioSettings.dspTime;
					pauseRequestedBeforePlayback = false;
					OnPaused?.Invoke();
					Log("Song paused (with fade).");
				}));
			}
			else
			{
				musicSource.Pause();
				dspPauseStartTime = AudioSettings.dspTime;
				pauseRequestedBeforePlayback = false;
				OnPaused?.Invoke();
				Log("Song paused.");
			}
			return;
		}

		// If nothing is scheduled yet, just record the intent to pause (no time accounting yet)
		if (!isScheduled)
		{
			pauseRequestedBeforePlayback = true;
			Log("Pause requested with no schedule; will remain paused until a schedule occurs.");
			return;
		}

		// Were scheduled but havent started  pause on first frame after start
		pauseRequestedBeforePlayback = true;
		RestartDeferredPauseRoutine();
		Log("Pause requested before playback; will pause as soon as audio begins.");
	}


	public void ResumeSong()
	{
		if (musicSource == null)
		{
			Debug.LogWarning("[AudioManager] ResumeSong called but musicSource is null.");
			return;
		}

		// If we queued a pre-playback pause but never started, just cancel that intent
		if (pauseRequestedBeforePlayback && !HasSongStarted)
		{
			pauseRequestedBeforePlayback = false;
			dspPauseStartTime = -1;
			KillCoroutine(ref deferredPauseRoutine);
			KillCoroutine(ref fadeRoutine);
			Log("Deferred pause cancelled before playback began.");
			return;
		}

		// Fold paused time into accounting
		if (dspPauseStartTime > 0)
		{
			totalPausedDuration += AudioSettings.dspTime - dspPauseStartTime;
			dspPauseStartTime = -1;
		}

		// Resume with optional fade-in
		KillCoroutine(ref fadeRoutine);
		if (resumeFadeSeconds > 0f)
		{
			// Ensure source is audible again
			musicSource.UnPause();
			fadeRoutine = FadeVolumeTo(originalVolume, resumeFadeSeconds, then: () =>
			{
				OnResumed?.Invoke();
				Log("Song resumed (with fade).");
			});
		}
		else
		{
			musicSource.UnPause();
			OnResumed?.Invoke();
			Log("Song resumed.");
		}
	}

	public void FadeMusicTo(float targetVolume, float fadeSeconds)
	{
		if (musicSource == null)
		{
			Debug.LogWarning("[AudioManager] FadeMusicTo called but musicSource is null.");
			return;
		}

		musicSource.DOFade(targetVolume, fadeSeconds);
	}

	/// <summary>Manual override of DSP anchor (rare; prefer SchedulePlaybackAt/Now).</summary>
	public void SetDSPStartTime(double dspTime)
	{
		dspStartTime = dspTime;
		HasSongStarted = false;
		needsPlaybackAlignment = true;
		isScheduled = false;
		Log($"DSP Start Time reset -> {dspTime:F6}");
	}

	public static void SetLatencyOffset(double offsetSeconds)
	{
		CalibrationLatencySeconds = offsetSeconds;
		try
		{
			PlayerPrefs.SetFloat(CalibrationPrefKey, (float)offsetSeconds);
			PlayerPrefs.Save();
		}
		catch { /* PlayerPrefs might not be available in all contexts */ }

		Debug.Log($"[AudioManager] Calibration latency -> {offsetSeconds:F3}s (total {LatencyOffsetSeconds:F3}s)");
	}

	public static void SetPlatformLatencyBaseline(double offsetSeconds)
	{
		BaselineLatencySeconds = offsetSeconds;
		try
		{
			PlayerPrefs.SetFloat(BaselinePrefKey, (float)offsetSeconds);
			PlayerPrefs.Save();
		}
		catch { /* PlayerPrefs might not be available in all contexts */ }

		Debug.Log($"[AudioManager] Platform baseline -> {offsetSeconds:F3}s (total {LatencyOffsetSeconds:F3}s)");
	}

	public static void SuppressNextAutoStart()
	{
		suppressNextAutoStart = true;
		if (Instance != null) Instance.AutoStartSuppressed = true;
	}

	public void SchedulePlaybackNow(double leadTime = -1d)
	{
		if (musicSource == null || musicSource.clip == null)
		{
			Debug.LogWarning("[AudioManager] SchedulePlaybackNow called without a valid music source.");
			return;
		}

		double lt = (leadTime < 0 ? defaultLeadTime : Mathf.Max((float)leadTime, 0f));
		double scheduledTime = AudioSettings.dspTime + lt;
		SchedulePlaybackAt(scheduledTime);
	}

	public void SchedulePlaybackAt(double scheduledDspTime)
	{
		if (musicSource == null || musicSource.clip == null)
		{
			Debug.LogWarning("[AudioManager] SchedulePlaybackAt called without a valid music source.");
			return;
		}

		// Prevent double-scheduling (e.g., tutorial + chart racing)
		if (isScheduled)
		{
			Log("SchedulePlaybackAt called but already scheduled; ignoring.");
			return;
		}

		KillCoroutine(ref deferredPauseRoutine);
		KillCoroutine(ref fadeRoutine);

		// Hard reset the source & accounting
		musicSource.Stop();
		musicSource.time = 0f;
		musicSource.timeSamples = 0;

		musicSource.volume = originalVolume; // reset any prior fades

		dspStartTime = scheduledDspTime;
		HasSongStarted = false;
		AutoStartSuppressed = false;
		suppressNextAutoStart = false;

		ResetPauseAccounting();

		needsPlaybackAlignment = true;
		isScheduled = true;
		songRestartedFromSceneReload = false; // baton is ours now

		musicSource.PlayScheduled(dspStartTime);
		OnPlaybackScheduled?.Invoke(dspStartTime);
		Log($"Music scheduled @ DSP {dspStartTime:F6} (total latency {LatencyOffsetSeconds:F3}s)");

		// If player asked to be paused before we started, re-arm the deferred pause
		if (pauseRequestedBeforePlayback)
			RestartDeferredPauseRoutine();
	}

	// -----------------------------------------------------------------------------
	// QUALITY OF LIFE (seek + getters)
	// -----------------------------------------------------------------------------
	/// <summary>Seek within the clip and keep the DSP math honest.</summary>
	public void SeekTo(double absoluteSongSeconds)
	{
		if (musicSource == null || musicSource.clip == null) return;

		absoluteSongSeconds = Mathf.Clamp((float)absoluteSongSeconds, 0f, musicSource.clip.length);
		musicSource.time = (float)absoluteSongSeconds;

		// If were playing, update the DSP anchor so GetAdjustedSongTime remains continuous.
		double correctedStart = AudioSettings.dspTime - absoluteSongSeconds;
		dspStartTime = correctedStart;
		needsPlaybackAlignment = false; // we already snapped

		Log($"Seek -> {absoluteSongSeconds:F3}s (dspStartTime corrected to {correctedStart:F6})");
	}

	public bool IsPlaying => musicSource != null && musicSource.isPlaying;
	public bool IsPaused => musicSource != null && !musicSource.isPlaying && HasSongStarted;
	public bool IsScheduledButNotStarted => isScheduled && !HasSongStarted;

	// -----------------------------------------------------------------------------
	// INTERNALS
	// -----------------------------------------------------------------------------
	private void AlignToActualPlaybackStart()
	{
		if (musicSource == null) return;

		double playbackTime = musicSource.time; // seconds
		double correctedStart = AudioSettings.dspTime - playbackTime;

		if (Mathf.Abs((float)(correctedStart - dspStartTime)) > 0.0001f)
		{
			double previousStart = dspStartTime;
			dspStartTime = correctedStart;
			OnPlaybackAligned?.Invoke(dspStartTime);
			Log($"Aligned DSP start {previousStart:F6} ? {correctedStart:F6} (t={playbackTime:F3}s) ?={(correctedStart - previousStart):F3}s");
		}
	}


	private void RestartDeferredPauseRoutine()
	{
		KillCoroutine(ref deferredPauseRoutine);
		deferredPauseRoutine = StartCoroutine(WaitForPlaybackAndPause());
	}

	private IEnumerator WaitForPlaybackAndPause()
	{
		// Sit in the wings until the band actually hits the first note
		while (pauseRequestedBeforePlayback && isScheduled && musicSource != null && !musicSource.isPlaying)
			yield return null;

		deferredPauseRoutine = null;

		if (!pauseRequestedBeforePlayback || musicSource == null)
			yield break;

		if (!musicSource.isPlaying) // schedule was cancelled
			yield break;

		// Optional fade then pause
		if (pauseFadeSeconds > 0f)
		{
			yield return FadeVolumeToEnumerator(0f, pauseFadeSeconds);
		}

		musicSource.Pause();
		dspPauseStartTime = AudioSettings.dspTime;
		pauseRequestedBeforePlayback = false;
		OnPaused?.Invoke();
		Log("Deferred pause applied after playback began.");
	}

	private void ResetPauseAccounting()
	{
		dspPauseStartTime = -1;
		totalPausedDuration = 0;
	}

	private void KillCoroutine(ref Coroutine c)
	{
		if (c != null)
		{
			StopCoroutine(c);
			c = null;
		}
	}

	private void DisableOwnedAudioListeners()
	{
		AudioListener[] listeners = GetComponentsInChildren<AudioListener>(true);
		for (int i = 0; i < listeners.Length; i++)
		{
			if (listeners[i] != null)
			{
				listeners[i].enabled = false;
			}
		}
	}

	private void Log(string msg)
	{
		if (verboseLogging) Debug.Log($"[AudioManager] {msg}");
	}

	// -----------------------------------------------------------------------------
	// FADES (simple, allocation-free coroutines)
	// -----------------------------------------------------------------------------
	public IEnumerator FadeVolumeToEnumerator(float target, float seconds)
	{
		if (musicSource == null)
		{
			yield break;
		}

		float start = musicSource.volume;
		if (Mathf.Approximately(start, target) || seconds <= 0f)
		{
			musicSource.volume = target;
			yield break;
		}

		float t = 0f;
		while (t < seconds)
		{
			t += Time.unscaledDeltaTime; // UI-like feel; unaffected by timescale
			musicSource.volume = Mathf.Lerp(start, target, t / seconds);
			yield return null;
		}
		musicSource.volume = target;
	}

	private Coroutine FadeVolumeTo(float target, float seconds, Action then = null)
	{
		KillCoroutine(ref fadeRoutine);
		fadeRoutine = StartCoroutine(FadeAndThen(target, seconds, then));
		return fadeRoutine;
	}

	private IEnumerator FadeAndThen(float target, float seconds, Action then)
	{
		yield return FadeVolumeToEnumerator(target, seconds);
		then?.Invoke();
	}

	private void OnDestroy()
	{
		if (Instance == this)
		{
			Instance = null;
		}
	}

	// -----------------------------------------------------------------------------
	// Persistence helpers
	// -----------------------------------------------------------------------------
	private static void LoadPersistedLatency()
	{
		try
		{
			if (PlayerPrefs.HasKey(BaselinePrefKey))
				BaselineLatencySeconds = PlayerPrefs.GetFloat(BaselinePrefKey, 0f);

			if (PlayerPrefs.HasKey(CalibrationPrefKey))
				CalibrationLatencySeconds = PlayerPrefs.GetFloat(CalibrationPrefKey, 0f);
		}
		catch
		{
			// Safe fallback to defaults; PlayerPrefs unavailable in some contexts (e.g., certain editor runs)
		}
	}

	// -----------------------------------------------------------------------------
	// User gesture unlock (WebGL audio context)
	// -----------------------------------------------------------------------------
	/// <summary>Call once from a user gesture (button/tap) to unlock audio; optionally schedule playback.</summary>
	public static void UnlockFromUserGesture(bool attemptScheduleMusic = true)
	{
		if (AudioUnlocked) return;
		AudioUnlocked = true;

		AudioListener.pause = false;
#if UNITY_WEBGL && !UNITY_EDITOR
		try
		{
			unity_resumeAudioContext();
		}
		catch
		{
			// Ignore bridge failures and continue with Unity-side unlock flow.
		}
#endif

		var inst = Instance;
		if (attemptScheduleMusic && inst != null)
		{
			inst.SchedulePlaybackNow();
		}
		else if (attemptScheduleMusic && inst == null)
		{
			pendingScheduleAfterUnlock = true;
		}
	}
}
