using UnityEngine;
using DG.Tweening;

public class CADPartBouncer : MonoBehaviour
{
    private Vector3 originalPosition;

    [Header("Bounce Settings")]
    public Vector3 moveOffset = new Vector3(0, 0.1f, 0);
    public float moveDuration = 0.2f;

    void Start()
    {
        originalPosition = transform.localPosition;
        ChartSystem.OnBeat += DoBounce;
    }

    void OnDestroy()
    {
        ChartSystem.OnBeat -= DoBounce;
    }

    void DoBounce()
    {
        Sequence seq = DOTween.Sequence();
        seq.Append(transform.DOLocalMove(originalPosition + moveOffset, moveDuration).SetEase(Ease.OutQuad));
        seq.Append(transform.DOLocalMove(originalPosition, moveDuration).SetEase(Ease.InOutQuad));
    }
}
