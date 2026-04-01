using UnityEngine;
using DG.Tweening;
using Shapes;

[RequireComponent(typeof(Polygon))]
public class FretLineAnimator : MonoBehaviour
{
    public float pulseScale = 1.2f;
    public float pulseDuration = 0.3f;
    public float destroyDelay = 1f;

    private bool hasPlayedPulse = false;
    private bool markedForDestroy = false;

    private Polygon polygon;

    private void Awake()
    {
        polygon = GetComponent<Polygon>();
        if (polygon == null)
            Debug.LogError("[FretLineAnimator] Polygon component not found on this object.");
    }

    private void Update()
    {
        float cameraZ = Camera.main.transform.position.z;
        float lineZ = transform.position.z;

        // 🎵 Animate pulse only once when it enters camera view
        if (!hasPlayedPulse && Mathf.Abs(lineZ - cameraZ) < 20f)
        {
            hasPlayedPulse = true;
            PulseEffect();
        }

        // 💀 Fade and destroy after camera passes it
        if (!markedForDestroy && cameraZ > lineZ - 6f)
        {
            markedForDestroy = true;
            FadeOutAndDestroy();
        }
    }

    private void PulseEffect()
    {
        transform.DOScaleY(pulseScale, pulseDuration)
                 .SetLoops(2, LoopType.Yoyo)
                 .SetEase(Ease.OutQuad);
    }

    private void FadeOutAndDestroy()
    {
        if (polygon != null)
        {
            Color currentColor = polygon.Color;

            DOTween.To(() => currentColor.a, a =>
            {
                currentColor.a = a;
                polygon.Color = currentColor;
            }, 0f, 0.4f)
            .OnComplete(() => Destroy(gameObject));
        }
        else
        {
            Destroy(gameObject, destroyDelay);
        }
    }
}


