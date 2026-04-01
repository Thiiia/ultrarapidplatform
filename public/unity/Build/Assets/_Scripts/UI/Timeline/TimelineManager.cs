using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;
using DG.Tweening;
using TMPro;

public class TimelineManager : MonoBehaviour
{
    public static TimelineManager Instance;

    private AudioManager _audioManager;
    [SerializeField] private TextMeshProUGUI instructionsText;
    [SerializeField] private string prompt1Text = "WARNING! ANTI-VIRUS CODE CLOAKING ACTIVATED";
    [SerializeField] private string prompt2Text = "Build the factor trees ASAP to push the code";

    private bool transitionedToGameplay = false;
    private bool transitionedBackToSlideshow = false;
    private bool finalTransitioned = false;
    private bool triggeredSOE = false;
    private bool triggeredInstructions = false; // Track if the 0:46 popup has been shown
    private bool welcometohighscore = false;
    private bool fadedClockOut = false;
    private bool InstructionsPrompt1 = false;
    private bool InstructionsPrompt2 = false;

    private const double CLOCK_FADE_OUT_TIME = 30.85;
    private const double SWITCH_TO_GAMEPLAY_TIME = 31;
    private const double INSTRUCTIONS_TIME = 46.0; // Show popup at 0:46
    private const double INSTRUCTIONS_PROMPT1 = 49.0; // First Prompt
    private const double INSTRUCTIONS_PROMPT2 = 55.0; // Second Prompt

    private const double INSTRUCTIONS_END_TIME = 57.25; // Hide popup at 0:57
    private const double SOE_TRIGGER_TIME = 86.0;
    private const double RETURN_TO_SLIDESHOW_TIME = 112.2;
    private const double FINAL_SCENE_TRANSITION = 128.0;

    private const double HIGHSCORE = 158.0;
    private AsyncOperation gameplayLoadOp;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
            return;
        }
    }

    void Start()
    {
        _audioManager = AudioManager.Instance;
        if (_audioManager == null)
        {
            Debug.LogError("TimelineManager: No AudioManager found!");
            return;
        }

        // Begin preloading the gameplay scene
        StartCoroutine(PreloadGameplayScene());
    }

    void Update()
    {
        if (_audioManager == null || !_audioManager.musicSource.isPlaying) return;

        double currentTime = _audioManager.GetAdjustedSongTime();
        if (currentTime >= CLOCK_FADE_OUT_TIME && !fadedClockOut)
        {
            fadedClockOut = true;
            FadeOutClock(); // Just fade it 
        }

        if (currentTime >= SWITCH_TO_GAMEPLAY_TIME && !transitionedToGameplay)
        {
            transitionedToGameplay = true;
            if (gameplayLoadOp != null && !gameplayLoadOp.isDone)
            {
                gameplayLoadOp.allowSceneActivation = true;
            }
            else
            {
                SceneManager.LoadScene("MainGameplayScene"); // Fallback in case preload failed
            }

            StartCoroutine(PulseClockIfExists());
            //TriggerSOEPopup();

        }

        if (currentTime >= INSTRUCTIONS_TIME && !triggeredInstructions)
        {
            triggeredInstructions = true;
            // Debug.Log("Triggering UI Popup at 0:46");
            ShowInstructions();
        }
        if (currentTime >= INSTRUCTIONS_PROMPT1 && !InstructionsPrompt1)
        {
            InstructionsPrompt1 = true;
            PlayInstructionsAnimation(prompt1Text);
        }
        if (currentTime >= INSTRUCTIONS_PROMPT2 && !InstructionsPrompt2)
        {
            InstructionsPrompt2 = true;
            PlayInstructionsAnimation(prompt2Text);
        }

        if (currentTime >= INSTRUCTIONS_END_TIME && triggeredInstructions)
        {
            //  Debug.Log("Closing UI Popup at 0:57");
            CloseInstructions();
            triggeredInstructions = false;
        }

        if (currentTime >= SOE_TRIGGER_TIME && !triggeredSOE)
        {
            triggeredSOE = true;
            // Debug.Log("Triggering SOE Popup at 1:24");
            if (gameplayLoadOp != null && !gameplayLoadOp.isDone)
            {
                gameplayLoadOp.allowSceneActivation = true;
            }
            else
            {
                SceneManager.LoadScene("MainGameplayScene"); // Fallback in case preload failed
            }

           // TriggerSOEPopup();

        }

        if (currentTime >= RETURN_TO_SLIDESHOW_TIME && !transitionedBackToSlideshow)
        {
            transitionedBackToSlideshow = true;
            // Debug.Log("Returning to SlideshowScene at 1:52");
            StartCoroutine(TransitionToScene("Slideshow"));
        }

        if (currentTime >= FINAL_SCENE_TRANSITION && !finalTransitioned)
        {
            finalTransitioned = true;
            // Debug.Log("Final transition to MainGameplayScene at 2:08");
            if (gameplayLoadOp != null && !gameplayLoadOp.isDone)
            {
                gameplayLoadOp.allowSceneActivation = true;
            }
            else
            {
                SceneManager.LoadScene("MainGameplayScene"); // Fallback in case preload failed
            }

           //TriggerSOEPopup();
        }
        if (currentTime >= HIGHSCORE && !welcometohighscore)
        {
            welcometohighscore = true;
            //  Debug.Log("transition to highscore scene at 2:38");
            {

                PlayerPrefs.SetInt("ReplayFinished", 1);
                StartCoroutine(TransitionToScene("Highscore"));
            }

        }
    }

    private IEnumerator TransitionToScene(string sceneName)
    {
        Debug.Log($"TimelineManager: Transitioning to {sceneName}");
        yield return new WaitForSeconds(0f);
        PlayerPrefs.Save();
        SceneManager.LoadScene(sceneName);
    }

    public void SkipToGameplay()
    {
        if (!transitionedToGameplay)
        {
            transitionedToGameplay = true;
            Debug.Log("Skipping slideshow, switching to MainGameplayScene now!");
            if (gameplayLoadOp != null && !gameplayLoadOp.isDone)
            {
                gameplayLoadOp.allowSceneActivation = true;
            }
            else
            {
                SceneManager.LoadScene("MainGameplayScene"); // Fallback in case preload failed
            }

        }
    }

       private void ShowInstructions()
    {
        GameObject Instructions = GameObject.Find("Instructions");
        if (Instructions != null)
        {
            //  Instructions.SetActive(true);
        }
        else
        {

        }
    }

    private void CloseInstructions()
    {
        GameObject Instructions = GameObject.Find("Instructions");
        if (Instructions != null)
        {
            Instructions.SetActive(false);
        }
    }
    private IEnumerator PreloadGameplayScene()
    {
        gameplayLoadOp = SceneManager.LoadSceneAsync("MainGameplayScene");
        gameplayLoadOp.allowSceneActivation = false; // Prevent it from switching immediately
        yield return gameplayLoadOp; // Let it preload in the background
    }
    private IEnumerator PulseClockIfExists()
    {
        yield return null; // wait briefly after scene load

        SongClockScript clock = GetSongClockScript();
        if (clock != null && clock.songTimerText != null)
        {
            // Fade back in before pulsing
            clock.songTimerText.DOFade(1f, 0.000025f).OnComplete(() =>
            {
                clock.PulseClock();
            });
        }
    }


    private void FadeOutClock()
    {
        SongClockScript clock = GetSongClockScript();
        if (clock != null && clock.songTimerText != null)
        {
            clock.songTimerText.DOFade(0f, 0.15f);
        }
    }

    private SongClockScript GetSongClockScript()
    {
#if UNITY_2023_1_OR_NEWER
        return Object.FindFirstObjectByType<SongClockScript>();
#else
        return FindFirstObjectByType<SongClockScript>();
#endif
    }

    public void ResetTimeline()
    {
        transitionedToGameplay = false;
        transitionedBackToSlideshow = false;
        finalTransitioned = false;
        triggeredSOE = false;
        triggeredInstructions = false;
        welcometohighscore = false;
        fadedClockOut = false;

        Debug.Log("TimelineManager: Timeline state has been reset.");
    }
    private void PlayInstructionsAnimation(string textToDisplay)
    {
        if (instructionsText == null)
        {
            GameObject instructionsObj = GameObject.Find("Instructions Prompt");
            if (instructionsObj != null)
            {
                instructionsText = instructionsObj.GetComponent<TextMeshProUGUI>();
                if (instructionsText != null)
                {
                    instructionsText.gameObject.SetActive(true);
                    // Start fully invisible
                    Color invisibleColor = instructionsText.color;
                    invisibleColor.a = 0f;
                    instructionsText.color = invisibleColor;
                }
            }
            else
            {
                Debug.LogWarning("Could not find Instructions Text in the scene!");
                return;
            }
        }

        instructionsText.text = ""; // Clear previous text
        instructionsText.alpha = 0f; // Start invisible
        instructionsText.transform.localScale = Vector3.zero; // Start tiny

        string finalText = textToDisplay;
        float perLetterDelay = 0.035f;

        Sequence fullSequence = DOTween.Sequence();

        // Fade in and scale up at the same time
        fullSequence.Append(instructionsText.DOFade(1f, 0.25f)); // Quick fade
        fullSequence.Join(instructionsText.transform.DOScale(1.1f, 0.3f).SetEase(Ease.OutBack));

        // Typing effect
        for (int i = 0; i < finalText.Length; i++)
        {
            int index = i;
            fullSequence.AppendCallback(() =>
            {
                instructionsText.text = finalText.Substring(0, index + 1);
            });
            fullSequence.AppendInterval(perLetterDelay);
        }

        // After typing finishes, small punch scale (impact)
        fullSequence.Append(instructionsText.transform.DOPunchScale(Vector3.one * 0.1f, 0.3f, 5, 0.8f));

        fullSequence.AppendInterval(1.5f); // Stay on screen
        fullSequence.Append(instructionsText.DOFade(0f, 0.5f)
            .OnComplete(() =>
            {
                instructionsText.gameObject.SetActive(false);
            })
        );
    }



}
