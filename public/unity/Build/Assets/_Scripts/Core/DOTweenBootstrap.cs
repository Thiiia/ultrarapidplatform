using DG.Tweening;
using UnityEngine;

[DefaultExecutionOrder(-10000)]
public class DOTweenBootstrap : MonoBehaviour
{
    void Awake()
    {
        DOTween.Init(false, true, LogBehaviour.ErrorsOnly);
        DOTween.useSafeMode = true;
        DOTween.SetTweensCapacity(4096, 2048); // roomy + stable
    }
}