using UnityEngine;
using DG.Tweening;
using Shapes;
using System.Collections;

public class LevelSelectAnimator : MonoBehaviour
{
    public Transform[] levelButtons;
    public float delayBetween = 0.2f;
    public float bounceScale = 1.2f;
    public float appearDuration = 0.6f;

    void Start()
    {
        foreach (Transform btn in levelButtons)
        {
            btn.localScale = Vector3.zero;
            btn.gameObject.SetActive(false);
        }

        StartCoroutine(AnimateButtonsIn());
    }

    private IEnumerator AnimateButtonsIn()
    {
        for (int i = 0; i < levelButtons.Length; i++)
        {
            Transform btn = levelButtons[i];
            btn.gameObject.SetActive(true);

            btn.DOScale(bounceScale, appearDuration)
                .SetEase(Ease.OutBack)
                .OnComplete(() =>
                {
                    btn.DOScale(1f, 0.2f).SetEase(Ease.OutExpo);
                });

            yield return new WaitForSeconds(delayBetween);
        }
    }
}
