using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Events;

using Febucci.UI;
using UnityEngine.UI;
using TMPro;
using DG.Tweening;
using System.Collections;

public class StartScreenAnimator : MonoBehaviour
{
	[Header("References")]
	public TypewriterByCharacter typewriter; // Link your Typewriter - By Character component
	public string sceneToLoad = "MainGameplayScene";
	public float sceneDelay = 1.5f;

	[SerializeField] private Button clickToContinueButton;
	[SerializeField] private AudioSource introMusicAudioSource;

	[Header("CTA Timing")]
	[SerializeField] private float callToActionDelay = 1.5f;
	[SerializeField] private float callToActionPopDuration = 0.5f;

	[Header("Title Hover Swap")]
	[SerializeField] private bool enableCtaHoverTitleSwap = true;
	[SerializeField, TextArea(2, 4)] private string hoverAnimatedText = "<laneGlow><wave a=0.15 w=1.25 f=0.25>START MUSIC CALIBRATION</wave></laneGlow>";
	[SerializeField, Tooltip("Per-character wait time for the hover text (higher = slower)")] private float hoverWaitForNormalChars = 0.06f;
	[SerializeField, Tooltip("Per-character wait time for mid punctuation on hover text")] private float hoverWaitMiddle = 0.25f;
	[SerializeField, Tooltip("Per-character wait time for long punctuation on hover text")] private float hoverWaitLong = 0.8f;

	[TextArea(2, 4)]
	public string animatedText = "<laneGlow><wave>ULTRA RAPID</wave></laneGlow>";

	bool hasStartedExitSequence;
	bool isSceneLoading;
	bool hasIntroFullyRevealed;
	string currentAnimatedText;
	float baseWaitForNormalChars;
	float baseWaitMiddle;
	float baseWaitLong;

	void Start()
	{
		if (clickToContinueButton != null)
		{
			clickToContinueButton.gameObject.SetActive(false);
		}

		if (typewriter != null)
		{
			// Ensure we get a callback when the disappearance finishes
			UnityAction onDisappeared = OnTextDisappeared;
			typewriter.onTextDisappeared.AddListener(onDisappeared);

			// cache base typewriter speeds so we can restore after hover
			baseWaitForNormalChars = typewriter.waitForNormalChars;
			baseWaitMiddle = typewriter.waitMiddle;
			baseWaitLong = typewriter.waitLong;
		}

		if (typewriter != null)
		{
			typewriter.ShowText(animatedText); // Triggers the animated typewriter intro
			currentAnimatedText = animatedText;
		}
	}

	void OnDestroy()
	{
		if (typewriter != null)
		{
			typewriter.onTextDisappeared.RemoveListener(OnTextDisappeared);
		}
	}

	// Called from the Typewriter's "On Text Showed" event in the Inspector
	public void OnTextFullyRevealed()
	{
		if (hasIntroFullyRevealed)
		{
			return;
		}

		hasIntroFullyRevealed = true;

		if (clickToContinueButton != null)
		{
			StartCoroutine(RevealClickToContinueButton());
		}
	}

	public void OnGoButtonClicked()
	{
		if (!hasStartedExitSequence)
		{
			if (introMusicAudioSource)
			{
				introMusicAudioSource.DOFade(0f, sceneDelay);
			}
		}

		Invoke(nameof(BeginExitSequence), sceneDelay);
	}

	public void BeginExitSequence()
	{
		if (hasStartedExitSequence || typewriter == null)
		{
			if (!isSceneLoading)
			{
				LoadNextScene();
			}
			return;
		}

		hasStartedExitSequence = true;
		CancelInvoke(nameof(BeginExitSequence));

		// Make sure all characters are visible, then play disappearance (text "flies away")
		typewriter.SkipTypewriter();
		typewriter.StartDisappearingText();
	}

	void OnTextDisappeared()
	{
		if (!isSceneLoading)
		{
			LoadNextScene();
		}
	}

	void LoadNextScene()
	{
		if (isSceneLoading) return;

		isSceneLoading = true;
		SceneManager.LoadScene(sceneToLoad);
	}

	public void HandleCtaHoverEnter()
	{
		if (!CanSwapFromCta())
		{
			return;
		}

		SwitchToHoverText();
	}

	public void HandleCtaHoverExit()
	{
		if (!CanSwapFromCta())
		{
			return;
		}

		SwitchToDefaultText();
	}

	private IEnumerator RevealClickToContinueButton()
	{
		if (callToActionDelay > 0f)
		{
			yield return new WaitForSecondsRealtime(callToActionDelay);
		}

		if (clickToContinueButton == null)
		{
			yield break;
		}

		clickToContinueButton.transform.localScale = Vector3.zero;
		clickToContinueButton.gameObject.SetActive(true);
		clickToContinueButton.transform.DOScale(Vector3.one, callToActionPopDuration).SetEase(Ease.OutBack);
	}

	private bool CanSwapFromCta()
	{
		return enableCtaHoverTitleSwap
			&& typewriter != null
			&& !string.IsNullOrEmpty(hoverAnimatedText)
			&& hasIntroFullyRevealed
			&& !hasStartedExitSequence
			&& !isSceneLoading;
	}

	private void SwitchToHoverText()
	{
		PlayAnimatedText(hoverAnimatedText);
	}

	private void SwitchToDefaultText()
	{
		PlayAnimatedText(animatedText);
	}

	private void PlayAnimatedText(string text)
	{
		if (typewriter == null || string.IsNullOrEmpty(text))
		{
			return;
		}

		if (currentAnimatedText == text)
		{
			return;
		}

		currentAnimatedText = text;
		ApplyTypewriterSpeedFor(text);
		typewriter.ShowText(text);
	}

	private void ApplyTypewriterSpeedFor(string text)
	{
		if (typewriter == null)
		{
			return;
		}

		bool useHover = enableCtaHoverTitleSwap && !string.IsNullOrEmpty(hoverAnimatedText) && text == hoverAnimatedText;
		typewriter.waitForNormalChars = useHover ? hoverWaitForNormalChars : baseWaitForNormalChars;
		typewriter.waitMiddle = useHover ? hoverWaitMiddle : baseWaitMiddle;
		typewriter.waitLong = useHover ? hoverWaitLong : baseWaitLong;
	}
}
