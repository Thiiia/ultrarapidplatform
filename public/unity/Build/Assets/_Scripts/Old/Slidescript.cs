using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;
using DG.Tweening;
using MoreMountains.Feedbacks;

public class Slidescript : MonoBehaviour
{
    [SerializeField] private Image _fadeSlide;
    [SerializeField] private Transform _slideParent;
    [SerializeField] private GameObject _slidePrefab;
    [SerializeField] private MMF_Player pulseFeedback;

    private Button skipButton;

    private List<GameObject> _slides = new List<GameObject>();
    private float _fadeDuration = 0.2f;
    private int _currentSlide = -1;

    private AudioManager _audioManager;


    private static bool hasPlayedFirstSlides = false;

    // Slide timings
    private readonly double[] _slideTimings =
    {
        1.25, // Slide 0: Ultra Rapid Logo
        3.65, // Slide 1
        9.00, // Slide 2
        14.50, // Slide 3
        20.1, // Slide 4
        25.75, // Slide 5

        112.20, // Return at 1:52
        118.00, // Slide 7 at 1:58
        122.00  // Slide 8 at 2:02
    };

private IEnumerator Start()
{
    _audioManager = AudioManager.Instance;
    if (_audioManager == null)
    {
        Debug.LogError("Slidescript: No AudioManager found!");
        yield break;
    }
    if (ReplayBootstrapper.Instance != null && ReplayBootstrapper.Instance.isReplayRequested)
{
    Debug.Log("🎮 Replay detected! Performing post-load resets.");

    
    AudioManager.Instance?.RestartSong();
    TimelineManager.Instance?.ResetTimeline();
    ImageFlasher.ResetFlasherState();
    TutorialDirector.ResetTutorial();
    Slidescript.ResetStaticState();
}

    yield return StartCoroutine(WaitForAudioSync());

    if (hasPlayedFirstSlides)
    {
        Debug.Log("Skipping initial slides, waiting for final slideshow...");
        yield return StartCoroutine(WaitForFinalSlides());
        yield break;
    }

    LoadSlidesFromResources();
    if (_slides.Count == 0) yield break;

    _fadeSlide.color = Color.black;

    if (skipButton != null)
    {
        skipButton.onClick.AddListener(SkipToNextScene);
    }

    yield return StartCoroutine(PlaySlides());
}


    private void LoadSlidesFromResources()
    {
        Sprite[] images = Resources.LoadAll<Sprite>("Slides");

        foreach (Sprite img in images)
        {
            GameObject newSlide = Instantiate(_slidePrefab, _slideParent);
            newSlide.GetComponent<Image>().sprite = img;
            newSlide.SetActive(false);
            _slides.Add(newSlide);
        }
    }

    private IEnumerator PlaySlides()
    {
        for (int i = 0; i < _slideTimings.Length; i++)
        {
            yield return new WaitUntil(() => _audioManager.GetAdjustedSongTime() >= _slideTimings[i]);


            if (i == 1 && pulseFeedback != null)
            {
                pulseFeedback.PlayFeedbacks();
            }
            if (i == 6 && pulseFeedback != null)
            {
                pulseFeedback.PlayFeedbacks();

            }
            if (i == 7 && pulseFeedback != null)
            {
                pulseFeedback.PlayFeedbacks();
            }
            if (i == 8 && pulseFeedback != null)
            {
                pulseFeedback.PlayFeedbacks();
            }
            if (i == 9 && pulseFeedback != null)
            {
                pulseFeedback.PlayFeedbacks();
            }


            _currentSlide = i;
            StartCoroutine(SlideTransition());
        }

        hasPlayedFirstSlides = true; // don't replay
    }

    private IEnumerator WaitForFinalSlides()
    {
        yield return new WaitUntil(() => _audioManager.GetAdjustedSongTime() >= _slideTimings[6]);

        StartCoroutine(PlaySlides());
    }

    private IEnumerator SlideTransition()
    {
        yield return StartCoroutine(FadeToTargetColor(Color.black));

        for (int i = 0; i < _slides.Count; i++)
        {
            _slides[i].SetActive(i == _currentSlide);
        }

        yield return StartCoroutine(FadeToTargetColor(Color.clear));
    }

    private IEnumerator FadeToTargetColor(Color targetColor)
    {
        float elapsedTime = 0.0f;
        Color startColor = _fadeSlide.color;

        while (elapsedTime < _fadeDuration)
        {
            elapsedTime += Time.deltaTime;
            _fadeSlide.color = Color.Lerp(startColor, targetColor, elapsedTime / _fadeDuration);
            yield return null;
        }
    }

    public void SkipToNextScene()
    {
        StopAllCoroutines(); // Stop slides from progressing

        if (TimelineManager.Instance != null)
        {
            TimelineManager.Instance.SkipToGameplay(); // Tell TimelineManager to switch to MainGameplayScene
        }
        else
        {
            Debug.LogWarning("Skip button pressed, but TimelineManager is missing!");
        }
    }
    public static void ResetStaticState()
    {
        hasPlayedFirstSlides = false;
    }



    public void RestartSlides()
    {
        StopAllCoroutines(); // Stop any ongoing slides
        hasPlayedFirstSlides = false;
        _currentSlide = -1;

        foreach (GameObject slide in _slides)
        {
            slide.SetActive(false);
        }

        StartCoroutine(Start()); // Re-run the startup coroutine
    }
    private IEnumerator WaitForAudioSync()
    {
        // Wait 1 frame to ensure DSP scheduling is in place
        yield return new WaitForEndOfFrame();

        // Wait until GetCurrentSongTime is greater than ~0.01s
        yield return new WaitUntil(() => _audioManager.GetAdjustedSongTime() > 0.01f);
    }
}
