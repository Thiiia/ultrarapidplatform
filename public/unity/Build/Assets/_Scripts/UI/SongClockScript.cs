using UnityEngine;
using TMPro;
using DG.Tweening;
using System.Collections;

public class SongClockScript : MonoBehaviour
{
	public TextMeshProUGUI songTimerText;
	private AudioManager audioManager;

	[SerializeField] private string syncingText = "Syncing music...";
	[SerializeField] private float syncFadeDuration = 0.35f;
	[SerializeField] private float delayBeforeTimerAppears = 0.1f;

	private bool hasStartedProperClock = false;

	public void InitiateClock()
	{
		StartCoroutine(StartClock());
	}

	private IEnumerator StartClock()
	{
		audioManager = AudioManager.Instance;

		if (audioManager == null)
		{
			Debug.LogError("SongClockScript: AudioManager instance not found!");
			enabled = false;
			yield break;
		}

		if (songTimerText != null)
		{
			songTimerText.text = syncingText;
			songTimerText.color = new Color(songTimerText.color.r, songTimerText.color.g, songTimerText.color.b, 1f);
		}


		// Wait for DSP to settle
		yield return new WaitForEndOfFrame();
		yield return new WaitForSeconds(delayBeforeTimerAppears);

		// Fade into actual song timer
		if (songTimerText != null)
		{
			DOTween.Kill(songTimerText);
			songTimerText.DOFade(0f, syncFadeDuration * 0.5f).OnComplete(() =>
			{
				hasStartedProperClock = true;


				// Fade in the song timer and pulse
				songTimerText.DOFade(1f, syncFadeDuration * 0.5f);
				PulseClock();
			});

		}
	}

	void Update()
	{
		if (!hasStartedProperClock || audioManager == null)
		{
			return;
		}

		if (audioManager.musicSource == null || !audioManager.HasSongStarted)
		{
			ShowSyncingIndicator();
			return;
		}

		double songTime = AudioManager.Instance.GetAdjustedSongTime();
		if (songTime < 0d)
		{
			songTime = 0d;
		}

		UpdateSongTimer((float)songTime);
	}

	// Updates the text 
	private void UpdateSongTimer(float currentTime)
	{
		if (currentTime < 0f)
		{
			currentTime = 0f;
		}
		//float totalTime = audioManager.songLength;

		// Pad to 8 chars: 00:00:00
		// Pad with figure spaces so the monospaced look holds even with prop fonts.
		string formattedTime = FormatTime(currentTime).PadRight(8, '\u2007'); // Figure space ( )

		//string formattedTotal = FormatTime(totalTime);

		if (songTimerText != null)
		{
			songTimerText.text = $"{formattedTime}";  //{formattedTotal}";
			if (ScoreManagerScript.Instance != null)
			{
				ScoreManagerScript.Instance.SetTotalMissionTime(formattedTime);
			}
		}
	}

	// Converts time in seconds
	private string FormatTime(float timeInSeconds)
	{
		int minutes = Mathf.FloorToInt(timeInSeconds / 60);
		int seconds = Mathf.FloorToInt(timeInSeconds % 60);
		int centiseconds = Mathf.FloorToInt((timeInSeconds * 100) % 100);

		// Snap to nearest multiple of 5ms for visual stability
		centiseconds = Mathf.RoundToInt(centiseconds / 5f) * 5;

		return $"{minutes:00}:{seconds:00}:{centiseconds:00}";
	}

	public void PulseClock()
	{
		if (songTimerText == null) return;

		// Pulse scale up and down
		songTimerText.transform.localScale = Vector3.one; // Reset in case
		songTimerText.transform
			.DOScale(1.5f, 0.10f)
			.SetEase(Ease.OutBack)
			.OnComplete(() =>
				songTimerText.transform
					.DOScale(1f, 0.05f)
					.SetEase(Ease.InOutQuad)
			);
	}

	private void ShowSyncingIndicator()
	{
		if (songTimerText == null)
		{
			return;
		}

		if (songTimerText.text != syncingText)
		{
			songTimerText.text = syncingText;
		}
	}
}
