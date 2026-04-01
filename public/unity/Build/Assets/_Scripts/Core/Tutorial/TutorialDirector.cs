using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using TMPro;
using DG.Tweening;
using Shapes;

public class TutorialDirector : MonoBehaviour
{
    public static TutorialDirector Instance;
    [Header("World-Space Input Buttons (A/S/D/F)")]
    public static bool hasRunOnce = false;
    public GameObject[] inputButtons;


    [Header("World Noteblocks")]
    public GameObject[] noteblocks; // Match A/S/D/F 

    [Header("Pulse Settings")]
    public float fadeInTime = 0.2f;
    public float holdTime = 0.8f;
    public float fadeOutTime = 0.3f;
    public float punchScale = 1.3f;
    public float punchDuration = 0.4f;

    public Color glowColor = Color.white;
    public float glowFadeTime = 0.4f;

    public Action OnTutorialComplete;

    private readonly string[] keyLabels = { "A", "S", "D", "F" };
    private readonly Dictionary<ShapeRenderer, Color> cachedShapeColors = new Dictionary<ShapeRenderer, Color>();

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        CacheInputButtonShapeColors();
    }
    void Start()
    {
        if (hasRunOnce)
        {
            foreach (var button in inputButtons)
            {
                if (button == null) continue;

                button.SetActive(false);
                var text = button.GetComponentInChildren<TextMeshPro>();
                if (text != null)
                {
                    text.text = "";
                    text.alpha = 0f;
                }

                var shapes = button.GetComponentsInChildren<ShapeRenderer>();
                foreach (var shape in shapes)
                {
                    Color baseColor = GetCachedShapeColor(shape);
                    shape.Color = new Color(baseColor.r, baseColor.g, baseColor.b, 0f);
                }
            }
        }
    }

    public void StartCinematic()
    {
        if (hasRunOnce)
        {
            Debug.Log("▶ TutorialDirector: Skipping cinematic (already run).");
            return;
        }

        hasRunOnce = true;
        Debug.Log("▶ TutorialDirector: Starting cinematic...");
         foreach (var button in inputButtons)
    {
        if (button != null) button.SetActive(true);
    }

        StartCoroutine(TutorialSequence());
    }

    private IEnumerator TutorialSequence()
    {
        yield return new WaitForSeconds(0.25f);
        yield return AnimateAndFadeOutInputButtons(); // Satisfying exit 
        yield return new WaitForSeconds(0.4f);
        yield return CountdownWithJuice();           // 3,2,1 GO
        yield return AnimateAndFadeInInputButtons(); // Satisfying exit 
        yield return new WaitForSeconds(0.25f);
        yield return AnimateAndFadeOutInputButtons();

        EndTutorial();
    }


    private void HighlightNoteblock(GameObject block)
    {
        SpriteRenderer sr = block.GetComponent<SpriteRenderer>();
        if (sr == null) return;

        Color originalColor = sr.color;

        // Animate color flash
        sr.DOColor(glowColor, 0.15f).OnComplete(() =>
            sr.DOColor(originalColor, glowFadeTime)
        );

        // Animate scale punch
        block.transform.DOPunchScale(Vector3.one * 0.2f, 0.25f, 6, 0.8f);
    }
    private IEnumerator CountdownWithJuice()
    {
        string[] countdownTexts = { "3", "2", "1", "GO!" };

        foreach (var count in countdownTexts)
        {
            for (int i = 0; i < inputButtons.Length; i++)
            {
                // Update text
                var tmp = inputButtons[i].GetComponentInChildren<TextMeshPro>();
                if (tmp != null)
                {
                    tmp.text = count;
                    tmp.color = Color.white;
                    tmp.alpha = 1f;
                    tmp.transform.DOPunchScale(Vector3.one * 0.3f, 0.4f, 5, 0.8f);
                }

                // Pulse shape or model
                inputButtons[i].transform.DOPunchScale(Vector3.one * 0.2f, 0.4f, 4, 0.7f);

                // Optional: Glow note below
                if (noteblocks != null && i < noteblocks.Length && noteblocks[i] != null)
                {
                    HighlightNoteblock(noteblocks[i]);
                }
            }

            yield return new WaitForSeconds(0.8f);
        }
    }

    private IEnumerator AnimateAndFadeOutInputButtons()
    {
        for (int i = 0; i < inputButtons.Length; i++)
        {
            GameObject button = inputButtons[i];
            if (button == null) continue;

            // Bounce pop
            button.transform.DOPunchScale(Vector3.one * 0.25f, 0.4f, 5, 0.9f);

            // Fade any TextMeshPro
            var text = button.GetComponentInChildren<TextMeshPro>();
            if (text != null) text.DOFade(0f, 0.5f);

            // 🔧 Fix: Get all ShapeRenderer components
            var shapes = button.GetComponentsInChildren<ShapeRenderer>();
            foreach (var shape in shapes)
            {
                Color original = GetCachedShapeColor(shape);
                DOTween.To(() => shape.Color.a, a =>
                {
                    shape.Color = new Color(original.r, original.g, original.b, a);
                }, 0f, 0.5f);
            }

            yield return new WaitForSeconds(0.25f); // stagger fade
        }
    }
    private IEnumerator AnimateAndFadeInInputButtons()
    {
        for (int i = 0; i < inputButtons.Length; i++)
        {
            GameObject button = inputButtons[i];
            if (button == null) continue;

            // Bounce pop
            button.transform.DOPunchScale(Vector3.one * 0.25f, 0.4f, 5, 0.9f);

            // Fade any TextMeshPro
            var text = button.GetComponentInChildren<TextMeshPro>();
            if (text != null) text.DOFade(1f, 0.25f);

            // 🔧 Fix: Get all ShapeRenderer components
            var shapes = button.GetComponentsInChildren<ShapeRenderer>();
            foreach (var shape in shapes)
            {
                Color original = GetCachedShapeColor(shape);
                DOTween.To(() => shape.Color.a, a =>
                {
                    shape.Color = new Color(original.r, original.g, original.b, a);
                }, original.a, 1f);
            }

            yield return new WaitForSeconds(0.25f); // stagger fade
        }
    }

    private void CacheInputButtonShapeColors()
    {
        cachedShapeColors.Clear();

        if (inputButtons == null)
        {
            return;
        }

        foreach (GameObject button in inputButtons)
        {
            if (button == null)
            {
                continue;
            }

            ShapeRenderer[] shapes = button.GetComponentsInChildren<ShapeRenderer>(true);
            foreach (ShapeRenderer shape in shapes)
            {
                if (shape == null || cachedShapeColors.ContainsKey(shape))
                {
                    continue;
                }

                cachedShapeColors.Add(shape, shape.Color);
            }
        }
    }

    private Color GetCachedShapeColor(ShapeRenderer shape)
    {
        if (shape == null)
        {
            return Color.white;
        }

        if (!cachedShapeColors.TryGetValue(shape, out Color color))
        {
            color = shape.Color;
            cachedShapeColors[shape] = color;
        }

        return color;
    }


    private void EndTutorial()
    {
        Debug.Log(" TutorialDirector: Finished tutorial sequence.");
        OnTutorialComplete?.Invoke();
    }
    public static void ResetTutorial()
{
    hasRunOnce = false;
}
}
