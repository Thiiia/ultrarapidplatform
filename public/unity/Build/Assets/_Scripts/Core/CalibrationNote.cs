using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using DG.Tweening;

public class CalibrationNote : MonoBehaviour
{
    public double ClickDSPTime { get; private set; }

    public Transform visual;
    private Transform targetTransform;
    private Vector3 fallbackTargetPos;
    private float travelTime;
    private bool consumed = false;

    private Tween bobTween;
    private Tween hitTween;

    private float lateWindow;
    private Image[] images;

    public void Init(CalibrationManager manager, double clickDSPTime, Transform targetTransform, float travelTime)
    {
        ClickDSPTime = clickDSPTime;
        this.targetTransform = targetTransform;
        fallbackTargetPos = targetTransform != null ? targetTransform.position : transform.position;
        this.travelTime = travelTime;
        lateWindow = manager.lateWindow;

        DOTween.Kill(visual, complete: false);
        DOTween.Kill(transform, complete: false);

        if (visual != null)
        {
            visual.localPosition = Vector3.zero;
            visual.localScale = Vector3.one;

            // Animate from zero visually without setting actual baseline to zero
            visual.DOScale(Vector3.one, Mathf.Clamp(travelTime * 0.15f, 0.15f, 0.35f))
                  .From(Vector3.zero)
                  .SetEase(Ease.OutBack);
        }

        images = GetComponentsInChildren<Image>(true);
        foreach (var img in images)
        {
            var c = img.color;
            c.a = 1f;
            img.color = c;
        }

        if (visual != null)
        {
            bobTween = visual.DOLocalMoveY(10f, 0.25f)
                .SetRelative()
                .SetEase(Ease.InOutSine)
                .SetLoops(-1, LoopType.Yoyo);
        }

        StartCoroutine(MoveLemon());
        if (lateWindow > 0f)
            StartCoroutine(LateVisual());
    }



    private IEnumerator MoveLemon()
    {
        Vector3 startPos = transform.position;
        float t = 0f;

        while (t < 1f && !consumed)
        {
            t += Time.deltaTime / travelTime;
            transform.position = Vector3.Lerp(startPos, GetTargetPosition(), t);
            yield return null;
        }

        // When travel completes, leave the note sitting in the hit zone.
        // Lifetime after arrival is controlled by CalibrationManager via Expire().
        // If the note was consumed (hit/expired) during travel, we do nothing here.
    }

    private IEnumerator LateVisual()
    {
        while (!consumed)
        {
            double now = AudioSettings.dspTime;
            float lateProgress = (float)((now - ClickDSPTime) / lateWindow);

            if (lateProgress > 0f && images != null && images.Length > 0)
            {
                float t = Mathf.Clamp01(lateProgress);
                for (int i = 0; i < images.Length; i++)
                {
                    var c = images[i].color;
                    c.a = 1f - t; // fade out over the late window
                    images[i].color = c;
                }
            }

            yield return null;
        }
    }

    public void OnHitConsumed()
    {
        if (consumed) return;
        consumed = true;

        KillTweens();

        float hitDuration = Mathf.Clamp(travelTime * 0.07f, 0.07f, 0.15f);

        if (visual != null)
        {
            // Force back to normal scale before scaling up for hit
            visual.localScale = Vector3.one;

            hitTween = visual.DOScale(Vector3.one * 1.3f, hitDuration)
                .SetEase(Ease.OutQuad)
                .OnComplete(() => Destroy(gameObject));
        }
        else
        {
            Destroy(gameObject);
        }
    }


    public void Expire()
    {
        if (consumed) return;
        consumed = true;

        KillTweens();
        if (visual != null)
        {
            visual.localScale = Vector3.one;

        }
        Destroy(gameObject);
    }

    private void KillTweens()
    {
        bobTween?.Kill();
        hitTween?.Kill();
    }

    private Vector3 GetTargetPosition()
    {
        return targetTransform != null ? targetTransform.position : fallbackTargetPos;
    }

    private void OnDestroy()
    {
        KillTweens();


        if (visual != null)
        {
            visual.localScale = Vector3.one;

        }
    }

}
