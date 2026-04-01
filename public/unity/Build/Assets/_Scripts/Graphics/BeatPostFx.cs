using DG.Tweening;

using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

/// Beat-synced post-processing pulses using URP Volume components.
/// Attach anywhere in your gameplay scene. It will create a lightweight
/// global Volume at runtime if none is assigned.
public class BeatPostFx : MonoBehaviour
{
    public static BeatPostFx Instance;

    [SerializeField] bool useChromatic = true;
    [Range(0f, 1f)] public float caBoost = 0.15f;
    [Range(0.01f, 0.5f)] public float caTime = 0.12f;

    private ChromaticAberration ca;
    [Header("Volume")]
    [Tooltip("Existing global Volume. If null, one is created at runtime.")]
    public Volume volume;

    [Header("Bloom Pulse")]
    [Range(0f, 5f)] public float bloomBase = 0.25f;
    [Range(0f, 5f)] public float bloomBoost = 0.75f;
    [Range(0.01f, 0.5f)] public float bloomTime = 0.12f;

    [Header("Exposure Nudge")]
    [Range(-2f, 2f)] public float exposureBase = 0f;
    [Range(0f, 1f)] public float exposureBoost = 0.25f;
    [Range(0.01f, 0.5f)] public float exposureTime = 0.10f;

    [Header("Vignette Flick")]
    public bool useVignette = true;
    [Range(0f, 1f)] public float vignetteBase = 0.18f;
    [Range(0f, 1f)] public float vignetteBoost = 0.14f;
    [Range(0.01f, 0.5f)] public float vignetteTime = 0.10f;

    private Bloom bloom;
    private ColorAdjustments color;
    private Vignette vignette;
    private Tonemapping tonemapping;

    private void Awake()
    {
        Instance = this;

        // Ensure we have a Volume and a valid profile before accessing any components
        EnsureVolume();

        if (volume.profile == null)
            volume.profile = ScriptableObject.CreateInstance<VolumeProfile>();

        if (useChromatic && !volume.profile.TryGet(out ca))
            ca = volume.profile.Add<ChromaticAberration>(true);

        if (ca != null) { ca.active = true; ca.intensity.Override(0f); }

        if (!volume.profile.TryGet(out bloom))
            bloom = volume.profile.Add<Bloom>(true);
        if (!volume.profile.TryGet(out color))
            color = volume.profile.Add<ColorAdjustments>(true);
        if (useVignette && !volume.profile.TryGet(out vignette))
            vignette = volume.profile.Add<Vignette>(true);

    
    }

    private void OnEnable()
    {
        ChartSystem.OnBeat += HandleBeat;
    }

    private void OnDisable()
    {
        ChartSystem.OnBeat -= HandleBeat;

        // Kill only the specific tweens we own, not everything tagged with this MonoBehaviour.
        if (bloom != null) DOTween.Kill(bloom);
        if (ca != null) DOTween.Kill(ca);
        if (color != null) DOTween.Kill(color);
        if (vignette != null) DOTween.Kill(vignette);
    }

    private void EnsureVolume()
    {
        if (volume != null) return;

        var go = new GameObject("Beat FX Volume");
        go.hideFlags = HideFlags.DontSave;
        DontDestroyOnLoad(go);
        volume = go.AddComponent<Volume>();
        volume.isGlobal = true;
        volume.priority = 1000f; // above defaults
        volume.weight = 1f;
    }
    /// One-shot impact ping (scaled 0..1). Keeps your beat pulses intact.
    public void Ping(float strength = 1f)
    {
        strength = Mathf.Clamp01(strength);

        if (bloom != null)
        {
            float target = bloomBase + bloomBoost * strength;
            DOTween.Kill(bloom);
            DOTween.Sequence().SetTarget(bloom).SetUpdate(true)
                .Append(DOTween.To(() => bloom.intensity.value, v => bloom.intensity.Override(v), target, bloomTime)
                    .SetEase(Ease.OutCubic))
                .Append(DOTween.To(() => bloom.intensity.value, v => bloom.intensity.Override(v), bloomBase, bloomTime * 0.8f)
                    .SetEase(Ease.InQuad));
        }

        if (useChromatic && ca != null)
        {
            DOTween.Kill(ca);
            DOTween.Sequence().SetTarget(ca).SetUpdate(true)
                .Append(DOTween.To(() => ca.intensity.value, v => ca.intensity.Override(v), caBoost * strength, caTime)
                    .SetEase(Ease.OutCubic))
                .Append(DOTween.To(() => ca.intensity.value, v => ca.intensity.Override(v), 0f, caTime * 0.7f)
                    .SetEase(Ease.InQuad));
        }
    }


    private void HandleBeat()
    {
        if (bloom != null)
        {
            float target = bloomBase + bloomBoost;
            DOTween.Kill(bloom); // cancel any in-flight tween
            DOTween.To(() => bloom.intensity.value, v => bloom.intensity.Override(v), target, bloomTime)
                  .SetTarget(bloom).SetEase(Ease.OutQuad).SetUpdate(true)
                  .OnComplete(() => bloom.intensity.Override(bloomBase));
        }

        if (color != null)
        {
            float target = exposureBase + exposureBoost;
            DOTween.Kill(color);
            DOTween.To(() => color.postExposure.value, v => color.postExposure.Override(v), target, exposureTime)
                  .SetTarget(color).SetEase(Ease.OutQuad).SetUpdate(true)
                  .OnComplete(() => color.postExposure.Override(exposureBase));
        }

        if (useVignette && vignette != null)
        {
            float target = Mathf.Clamp01(vignetteBase + vignetteBoost);
            DOTween.Kill(vignette);
            DOTween.To(() => vignette.intensity.value, v => vignette.intensity.Override(v), target, vignetteTime)
                  .SetTarget(vignette).SetEase(Ease.OutQuad).SetUpdate(true)
                  .OnComplete(() => vignette.intensity.Override(vignetteBase));
        }
    }
}
