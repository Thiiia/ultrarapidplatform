using UnityEngine;
using UnityEngine.UI;
using DG.Tweening;
using Shapes;
using System.Collections;
public class ImageFlasher : MonoBehaviour
{
    [Header("Main Sequence Images (5 total)")]
    public Sprite[] mainSprites;

    [Header("References")]
    public Image deerHeadImage;
    public Rectangle flashOverlayRectangle;
    public Color startColor = new Color(0.5f, 0.8f, 1f, 1f); // 
    public Color endColor = new Color(1f, 0.5f, 1f, 1f);   //




    [Header("Timing Settings")]
    public float startInterval = 0.1f;
    public float targetInterval = 0.025f;
    public float totalDuration = 5.4f;
    public float fadeDuration = 0.1f;
    public float introPopDuration = 0.4f; // how fast the first appearance flickers

    private float flashInterval;
    private double sequenceStartTime;
    private double nextFlashTime;
    private int spriteIndex = 0;
    private bool isFlashing = false;
    public static bool hasRunOnce = false;

    void Start()
    {
        if (!hasRunOnce)
        {
            hasRunOnce = true;
            StartFlashSequence();
        }
        else
        {
            deerHeadImage.gameObject.SetActive(false);

        }
    }

    public void StartFlashSequence()
    {
        flashInterval = startInterval;
        isFlashing = true;
        sequenceStartTime = AudioSettings.dspTime;
        nextFlashTime = sequenceStartTime;

        // Smooth pop-in when appearing
        if (deerHeadImage != null)
        {
            deerHeadImage.gameObject.SetActive(true);
            deerHeadImage.color = new Color(1f, 1f, 1f, 0f);
            deerHeadImage.DOFade(1f, introPopDuration).SetEase(Ease.OutCubic);
        }
        if (flashOverlayRectangle != null)
        {
            flashOverlayRectangle.gameObject.SetActive(true);
            flashOverlayRectangle.Color = startColor;
        }

    }

    void Update()
    {
        if (!isFlashing) return;

        double currentDSP = AudioSettings.dspTime;

        if (currentDSP >= nextFlashTime)
        {
            if (mainSprites.Length > 0)
            {
                deerHeadImage.sprite = mainSprites[spriteIndex];
                spriteIndex = (spriteIndex + 1) % mainSprites.Length;
            }

            ApplyVisualEffect();

            // Gradually tighten the flash interval over time
            float elapsed = (float)(currentDSP - sequenceStartTime);
            flashInterval = Mathf.Lerp(startInterval, targetInterval, elapsed / totalDuration);

            nextFlashTime += flashInterval;

            // Stop after total duration
            if (elapsed >= totalDuration)
            {
                StartFadeOut();
                isFlashing = false;
            }
        }
        if (flashOverlayRectangle != null && isFlashing)
        {
            float elapsed = (float)(currentDSP - sequenceStartTime);
            float t = Mathf.Clamp01(elapsed / totalDuration); // progress 0-1

            // Lerp between two colors for color shifting
            Color lerpedColor = Color.Lerp(startColor, endColor, t);

            // pulsing/fade
            lerpedColor.a = Mathf.Lerp(1f, 1f, t); // stays 1 during flashes

            flashOverlayRectangle.Color = lerpedColor;
        }

    }

    private void ApplyVisualEffect()
    {
        float targetAlpha = 0.925f;
        float flickerTime = 0.0035f;

        deerHeadImage.DOFade(targetAlpha, flickerTime)
            .SetLoops(2, LoopType.Yoyo)
            .SetEase(Ease.Linear);

        if (flashOverlayRectangle != null)
        {
            Color c = flashOverlayRectangle.Color;
            flashOverlayRectangle.Color = new Color(
                Mathf.Clamp01(c.r * 1.1f),
                Mathf.Clamp01(c.g * 1.1f),
                Mathf.Clamp01(c.b * 1.1f),
                c.a
            );
        }
    }

    private void StartFadeOut()
    {
        Sequence fadeOutSeq = DOTween.Sequence();

        fadeOutSeq.Join(deerHeadImage.DOFade(0f, fadeDuration).SetEase(Ease.OutCubic));
        StartCoroutine(FadeOutFlashOverlay());


        fadeOutSeq.OnComplete(() =>
        {
            deerHeadImage.gameObject.SetActive(false);
            if (flashOverlayRectangle != null) flashOverlayRectangle.gameObject.SetActive(false);
        });

    }
    private IEnumerator FadeOutFlashOverlay()
    {
        if (flashOverlayRectangle == null) yield break;

        float elapsed = 0f;
        float duration = fadeDuration;

        Color currentColor = flashOverlayRectangle.Color;
        Color targetColor = flashOverlayRectangle.Color;
        targetColor.a = 0f; // fade to transparent

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            flashOverlayRectangle.Color = Color.Lerp(currentColor, targetColor, t);
            yield return null;
        }

        flashOverlayRectangle.gameObject.SetActive(false); // fully hide it
    }

    public static void ResetFlasherState()
    {
        hasRunOnce = false;
    }
}
