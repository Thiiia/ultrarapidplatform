using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ChartLoader.NET.Framework;
using TMPro;
using UnityEngine.UI;
using DG.Tweening;

/// <summary>
/// Shows a high-fidelity city/status overlay whenever the chart has a long gap between hits.
/// Also raises bus events so other systems can react (camera moves, wisp pacing, etc.).
/// </summary>
public class DowntimeStatusDirector : MonoBehaviour
{
	[SerializeField] private CanvasGroup overlay;
	[SerializeField] private TMP_Text statusLabel;
	[SerializeField] private Image cityBackdrop;
	[SerializeField] private Sprite[] cityShots;
	[SerializeField, Tooltip("Minimum seconds without notes before we surface the status overlay.")]
	private float minDowntimeSeconds = 3f;
	[SerializeField, Tooltip("How often (in seconds) we check for downtime windows.")]
	private float checkIntervalSeconds = 0.25f;
	[SerializeField, Tooltip("Fade duration when showing/hiding the overlay.")]
	private float overlayFadeSeconds = 0.35f;
	[SerializeField, Tooltip("Refresh cadence for the percentage text while the overlay is visible.")]
	private float statusRefreshInterval = 0.5f;

	private readonly List<float> noteTimes = new List<float>();
	private Coroutine monitorRoutine;
	private bool downtimeActive;
	private float statusRefreshTimer;

	void Awake()
	{
		if (overlay)
		{
			overlay.alpha = 0f;
			overlay.interactable = false;
			overlay.blocksRaycasts = false;
		}
	}

	void OnEnable()
	{
		GameplayEventBus.ChartInitialized += HandleChartInitialized;
		GameplayEventBus.ChartRestarted += HandleChartRestarted;
	}

	void OnDisable()
	{
		GameplayEventBus.ChartInitialized -= HandleChartInitialized;
		GameplayEventBus.ChartRestarted -= HandleChartRestarted;
		StopWatcher();
	}

	void Update()
	{
		if (!downtimeActive || statusRefreshInterval <= 0f) return;

		statusRefreshTimer -= Time.unscaledDeltaTime;
		if (statusRefreshTimer <= 0f)
		{
			statusRefreshTimer = statusRefreshInterval;
			RefreshStatusLabel();
		}
	}

	private void HandleChartInitialized(Chart chart, Note[] notes)
	{
		noteTimes.Clear();
		if (notes != null)
		{
			for (int i = 0; i < notes.Length; i++)
				noteTimes.Add(ChartSystem.GetNoteHitTime(notes[i]));
			noteTimes.Sort();
		}
		StopWatcher();
		monitorRoutine = StartCoroutine(DowntimeWatcher());
	}

	private void HandleChartRestarted()
	{
		noteTimes.Clear();
		StopWatcher();
		downtimeActive = false;
		FadeOverlay(0f, true);
	}

	private IEnumerator DowntimeWatcher()
	{
		AudioManager audio = null;
		while (audio == null)
		{
			audio = AudioManager.Instance;
			yield return null;
		}

		var wait = new WaitForSecondsRealtime(Mathf.Max(0.05f, checkIntervalSeconds));
		while (enabled)
		{
			if (!audio)
			{
				audio = AudioManager.Instance;
				yield return wait;
				continue;
			}

			double now = audio ? audio.GetAdjustedSongTime() : AudioSettings.dspTime;
			float nextNote = GetNextNoteAfter((float)now);
			float timeUntilNext = nextNote - (float)now;
			bool shouldShow = audio && audio.HasSongStarted && timeUntilNext >= minDowntimeSeconds;

			if (shouldShow && !downtimeActive)
			{
				BeginDowntime(timeUntilNext);
			}
			else if (!shouldShow && downtimeActive)
			{
				EndDowntime();
			}

			yield return wait;
		}
	}

	private float GetNextNoteAfter(float currentTime)
	{
		for (int i = 0; i < noteTimes.Count; i++)
		{
			if (noteTimes[i] > currentTime)
				return noteTimes[i];
		}
		return float.PositiveInfinity;
	}

	private void BeginDowntime(float expectedDuration)
	{
		downtimeActive = true;
		statusRefreshTimer = 0f;
		RefreshStatusLabel();
		PickCitySprite();
		FadeOverlay(1f);
		float duration = float.IsPositiveInfinity(expectedDuration) ? minDowntimeSeconds : expectedDuration;
		GameplayEventBus.RaiseDowntimeWindowStarted(duration);
	}

	private void EndDowntime()
	{
		downtimeActive = false;
		FadeOverlay(0f);
		GameplayEventBus.RaiseDowntimeWindowEnded();
	}

	private void RefreshStatusLabel()
	{
		if (!statusLabel) return;

		int resolved = ScoreManagerScript.Instance ? ScoreManagerScript.Instance.destroyedGems : 0;
		int total = ChartSystem.CachedNotes != null ? ChartSystem.CachedNotes.Length : noteTimes.Count;
		float pct = (total <= 0) ? 0f : Mathf.Clamp01((float)resolved / Mathf.Max(1, total));
		statusLabel.text = $"{Mathf.RoundToInt(pct * 100f)}% OF THE PERIMETER SECURED";
	}

	private void PickCitySprite()
	{
		if (!cityBackdrop || cityShots == null || cityShots.Length == 0) return;
		var sprite = cityShots[Random.Range(0, cityShots.Length)];
		cityBackdrop.sprite = sprite;
	}

	private void FadeOverlay(float targetAlpha, bool immediate = false)
	{
		if (!overlay) return;

		overlay.DOKill();
		if (immediate)
		{
			overlay.alpha = targetAlpha;
		}
		else
		{
			overlay.DOFade(targetAlpha, overlayFadeSeconds)
				.SetEase(Ease.OutQuad)
				.SetUpdate(true);
		}

		bool isVisible = targetAlpha > 0.01f;
		overlay.blocksRaycasts = isVisible;
		overlay.interactable = isVisible;
	}

	private void StopWatcher()
	{
		if (monitorRoutine != null)
			StopCoroutine(monitorRoutine);
		monitorRoutine = null;
	}
}
