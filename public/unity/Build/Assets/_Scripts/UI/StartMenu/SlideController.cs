using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

using MarksAssets.VideoPlayerWebGL;

using DG.Tweening;

using RainbowArt.CleanFlatUI;

public class SlideController : MonoBehaviour
{
	[Header("Slides")]
	public Sprite[] slides; // Starting from slide 1
	public Image slideDisplay;
	public string gameplaySceneName = "MainGameplayScene";

	[Header("Buttons")]
	public Button nextButton;
	public Button backButton;
	public Button skipIntroButton;
	[SerializeField] private Button finalGoButton;

	[Header("Video Slide")]
	public GameObject videoSlideGO;
	public VideoPlayerWebGL videoPlayer;

	[Header("Slide UI Containers")]
	public GameObject[] slideContainers;  // Must match slides.Length + 1

	[Header("Transition Settings")]
	public float transitionDuration = 0.4f;

	[Header("Other")]
	[SerializeField] private AudioSource musicAudioSource;
	[SerializeField] private ProgressBarPattern progressBar;
	[SerializeField] private float screenWidth = 1920f;
	[SerializeField] private GameObject slidesContainer;
	[SerializeField] private bool preferStaticIntroSlide = true;
	[SerializeField] private bool useDynamicSlideWidth = true;

	private float currentXPos = 0f;
	private float resolvedSlideWidth = 1920f;
	private List<CanvasGroup> canvasGroups = new List<CanvasGroup>();
	private int currentSlide = 0;
	private int totalSlides => slideContainers.Length;
	private Tween slideTween;
	private Tween containerTween;
	private Image firstSlideImage;

	private bool SupportsVideoIntro => videoSlideGO != null && videoPlayer != null;
	private static bool IsWebGLRuntime => Application.platform == RuntimePlatform.WebGLPlayer;

	private void CacheFirstSlideImage()
	{
		if (slideContainers == null || slideContainers.Length == 0 || slideContainers[0] == null)
		{
			firstSlideImage = null;
			return;
		}

		firstSlideImage = slideContainers[0].GetComponent<Image>();
	}

	private float ResolveSlideWidth()
	{
		if (useDynamicSlideWidth && slideContainers != null && slideContainers.Length > 0 && slideContainers[0] != null)
		{
			RectTransform firstSlideRect = slideContainers[0].GetComponent<RectTransform>();
			if (firstSlideRect != null && firstSlideRect.rect.width > 0f)
			{
				return firstSlideRect.rect.width;
			}
		}

		return screenWidth > 0f ? screenWidth : 1920f;
	}

	private void SetFirstSlideMediaState(bool firstSlideActive)
	{
		bool showVideo = firstSlideActive && SupportsVideoIntro && (IsWebGLRuntime || !preferStaticIntroSlide);

		if (videoSlideGO != null)
		{
			videoSlideGO.SetActive(showVideo);
		}

		if (showVideo)
		{
			videoPlayer.Play();
		}
		else if (videoPlayer != null)
		{
			videoPlayer.Stop();
		}

		// Keep the first slide sprite visible when using static intro mode.
		if (firstSlideImage != null)
		{
			firstSlideImage.enabled = !showVideo;
		}
	}

	private void InitializeSlides()
	{
		for (int i = 0; i < slideContainers.Length; i++)
		{
			bool isActive = i == currentSlide;
			if (slideContainers[i] != null)
			{
				slideContainers[i].SetActive(isActive);
			}
		}

		// Ensure correct media state for first slide.
		SetFirstSlideMediaState(currentSlide == 0);
	}

	private void StopMedia()
	{
		if (videoPlayer != null)
		{
			videoPlayer.Stop();
		}

		if (musicAudioSource != null)
		{
			musicAudioSource.DOFade(0f, 0.6f)
				.OnComplete(() => musicAudioSource.Stop());
		}
	}

	private void Start()
	{
		CacheFirstSlideImage();
		resolvedSlideWidth = ResolveSlideWidth();
		currentXPos = slidesContainer ? slidesContainer.transform.localPosition.x : 0f;

		foreach (GameObject slideContainer in slideContainers)
		{
			CanvasGroup canvasGroup = slideContainer.GetComponent<CanvasGroup>();
			canvasGroups.Add(canvasGroup);
		}

		nextButton.onClick.AddListener(NextSlide);
		backButton.onClick.AddListener(PreviousSlide);
		skipIntroButton.onClick.AddListener(SkipToMainGameplay);

		InitializeSlides();
	}

	private void ShowSlide(int index)
	{
		if (index < 0 || index >= totalSlides)
		{
			Debug.LogWarning("Invalid slide index: " + index);
			return;
		}

		slideTween?.Kill();
		containerTween?.Kill();

		// Fade out all other containers
		for (int i = 0; i < slideContainers.Length; i++)
		{
			if (i == index)
			{
				continue;
			}

			GameObject container = slideContainers[i];
			CanvasGroup canvasGroup = canvasGroups[i];

			if (container.activeSelf)
			{
				if (canvasGroup)
				{
					int captured = i;
					containerTween = canvasGroup.DOFade(0f, transitionDuration / 2)
						.SetTarget(canvasGroup)
						.SetLink(canvasGroup.gameObject, LinkBehaviour.KillOnDestroy)
						.OnComplete(() =>
						{
							slideContainers[captured].SetActive(false);
						});
				}
				else
				{
					container.SetActive(false);
				}
			}
		}

		// VIDEO slide
		if (index == 0)
		{
			if (slideDisplay != null)
			{
				slideDisplay.gameObject.SetActive(false);
			}

			SetFirstSlideMediaState(true);
		}
		else
		{
			// Image Slide
			SetFirstSlideMediaState(false);
			int spriteIndex = index - 1;

			if (slideDisplay != null && spriteIndex >= 0 && spriteIndex < slides.Length)
			{
				slideDisplay.sprite = slides[spriteIndex];
				slideDisplay.gameObject.SetActive(true);

				CanvasGroup cg = slideDisplay.GetComponent<CanvasGroup>();
				if (cg != null)
				{
					cg.alpha = 0f;
					slideTween = cg.DOFade(1f, transitionDuration / 2)
						.SetTarget(cg)
						.SetLink(cg.gameObject, LinkBehaviour.KillOnDestroy);
				}
			}
		}

		// Fade in container for current slide
		if (index >= 0 && index < slideContainers.Length)
		{
			GameObject container = slideContainers[index];
			container.SetActive(true);
			CanvasGroup canvasGroup = canvasGroups[index];

			if (canvasGroup)
			{
				canvasGroup.alpha = 0f;
				containerTween = canvasGroup.DOFade(1f, transitionDuration / 2)
					.SetTarget(canvasGroup)
					.SetLink(canvasGroup.gameObject, LinkBehaviour.KillOnDestroy);
			}
		}
	}

	private void SwipeSlide(int index, bool toLeft)
	{
		if (index < 0 || index >= totalSlides)
		{
			Debug.LogWarning("Invalid slide index: " + index);
			return;
		}

		// Ensure only target slide is active
		for (int i = 0; i < slideContainers.Length; i++)
		{
			if (slideContainers[i] != null)
			{
				slideContainers[i].SetActive(i == index);
			}
		}

		// Video on first slide, stop when leaving
		if (index == 0)
		{
			SetFirstSlideMediaState(true);
		}
		else
		{
			SetFirstSlideMediaState(false);
		}

		resolvedSlideWidth = ResolveSlideWidth();
		float targetXPos = toLeft ? currentXPos + resolvedSlideWidth : currentXPos - resolvedSlideWidth;

		if (slidesContainer)
		{
			slidesContainer.transform.DOLocalMoveX(targetXPos, transitionDuration)
				.SetEase(Ease.InOutQuad)
				.SetLink(slidesContainer.gameObject, LinkBehaviour.KillOnDestroy)
				.OnComplete(() =>
				{
					currentXPos = targetXPos;
				});
		}
	}

	public void NextSlide()
	{
		currentSlide++;

		if (currentSlide >= totalSlides)
		{
			StopMedia();
			SceneManager.LoadScene(gameplaySceneName);
		}
		else
		{
			SwipeSlide(currentSlide, false);
		}

		if (progressBar)
		{
			progressBar.CurrentValue = (float)currentSlide / (float)(totalSlides - 1) * 100f;
		}

		if (currentSlide == totalSlides - 1)
		{
			if (musicAudioSource)
			{
				musicAudioSource.DOFade(0f, 2.0f).SetEase(Ease.InOutQuad);
			}

			if (progressBar)
			{
				progressBar.gameObject.transform.DOScale(0f, 0.5f).SetEase(Ease.InBack);
			}

			if (finalGoButton)
			{
				finalGoButton.transform.localScale = Vector3.zero;
				finalGoButton.gameObject.SetActive(true);
				finalGoButton.transform.DOScale(1f, 2.0f).From(0f).SetEase(Ease.OutBack);
			}
		}
	}

	public void PreviousSlide()
	{
		currentSlide = Mathf.Max(0, currentSlide - 1);

		SwipeSlide(currentSlide, true);
		if (progressBar)
		{
			progressBar.CurrentValue = (float)currentSlide / (float)(totalSlides - 1) * 100f;
		}
	}

	public void SkipToMainGameplay()
	{
		StopMedia();
		SceneManager.LoadScene(gameplaySceneName);
	}
}
