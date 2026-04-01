using System.Collections.Generic;
using UnityEngine;
using TMPro;
using DG.Tweening;
public class PrimeNumberFacts : MonoBehaviour
{
    [Header("Reference to your TextMeshProUGUI object")]
    public TextMeshProUGUI factText;

    private List<string> primeFacts = new List<string>()
    {
        "The number 2 is the only even prime number.",
        "Every prime greater than 3 can be written as 6n ± 1.",
        "There are infinitely many primes — proved by Euclid!",
        "The largest known prime has over 24 million digits!",
        "A prime number is a whole number greater than 1 that has exactly two factors: 1 and itself.",
        "Prime numbers cannot be divided evenly by any other numbers except for 1 and themselves",
        "Numbers ending with 0, 2, 4, 5, 6, or 8 are not prime numbers, except the number 2 itself."
    };

    private int currentFactIndex;

    private void Start()
    {
        if (PlayerPrefs.GetInt("ReplayFinished", 0) == 1)
        {
            // Replay was finished, so show next fact
            ShowNextFact();

            // Reset the flag so it doesn't keep advancing
            PlayerPrefs.SetInt("ReplayFinished", 0);
        }
        else
        {
            // Just refresh the current fact normally
            currentFactIndex = PlayerPrefs.GetInt("PrimeFactIndex", 0);
            UpdateFact();
        }
    }


    public void ShowNextFact()
    {
        if (primeFacts.Count == 0) return;

        int newFactIndex = Random.Range(0, primeFacts.Count);

        // make sure we don't repeat the same fact twice in a row
        if (newFactIndex == currentFactIndex && primeFacts.Count > 1)
        {
            newFactIndex = (newFactIndex + 1) % primeFacts.Count;
        }

        currentFactIndex = newFactIndex;
        UpdateFact();
        PlayerPrefs.SetInt("PrimeFactIndex", currentFactIndex);
    }


    private void UpdateFact()
{
    if (factText != null && primeFacts.Count > 0)
    {
        factText.text = primeFacts[currentFactIndex];

        // Reset scale and alpha instantly
        factText.rectTransform.localScale = Vector3.one * 0.85f; // slightly smaller
        factText.alpha = 0f;

        // Create a sequence: Fade in + Scale bounce
        Sequence seq = DOTween.Sequence();
        seq.Append(factText.DOFade(1f, 0.5f)) // Fade to full opacity
           .Join(factText.rectTransform.DOScale(1.4f, 0.4f).SetEase(Ease.OutBack)) // Bounce outward a bit
           .Append(factText.rectTransform.DOScale(1f, 0.25f).SetEase(Ease.OutBounce)); // Settle back to normal size
    }
}

}
