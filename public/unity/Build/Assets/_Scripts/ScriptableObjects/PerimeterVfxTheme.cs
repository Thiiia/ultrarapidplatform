using UnityEngine;

[CreateAssetMenu(menuName = "Rhythm/Perimeter VFX Theme", fileName = "PerimeterVfxTheme")]
public class PerimeterVfxTheme : ScriptableObject
{
    // — Palette —
    public Color previewTint     = new Color(1f, 0.95f, 0.35f, 0.70f);
    public Color missTint        = new Color(0.93f, 0.36f, 0.36f, 0.85f);
    [Tooltip("Base colour for approach rings; defaults to previewTint when first created.")]
    public Color approachRingColor = new Color(1f, 0.95f, 0.35f, 0.70f);
    public Color impactRingColor = new Color(0.90f, 1.00f, 0.60f, 0.95f);
    public Color arcColor        = new Color(1.00f, 0.90f, 0.50f, 0.90f);
    public Color dotColor        = new Color(1.00f, 1.00f, 1.00f, 0.95f); // center pop

    // — Approach Rings —
    public bool  showGhostRings = true;
    [Range(0, 8)]    public int   ghostCount      = 2;
    [Range(0f, 0.2f)]public float ghostDelay      = 0.035f;  // NEW
    public float ghostRadiusStep = 0.12f;

    // NEW: absolute ghost alpha (0..1): first ghost opacity
    [Range(0f, 1f)]  public float ghostAlpha      = 0.55f;

    // LEGACY (for older code): geometric falloff per ghost index
    // If your code still uses ghostAlphaFalloff, keep this here.
    [Range(0.05f, 1f)] public float ghostAlphaFalloff = 0.55f;

    public float approachStartRadius = 1.10f;
    public float approachTargetRadius = 0.25f;
    public AnimationCurve approachRadius = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
    public AnimationCurve approachAlpha  = AnimationCurve.EaseInOut(0f, 1f, 1f, 0f);

    // — Impact Ring —
    public float ringThickness           = 0.12f;
    public float ringExpansionMultiplier = 1.35f;
    public float ringExpansionDuration   = 0.18f;
    public float ringPunchScale          = 1.05f;
    public float ringPunchDuration       = 0.12f;

    // — Impact Arc —
    public float impactArcDegrees = 20f;
    public float arcSpinDegrees   = 120f;
    public float arcDuration      = 0.18f;

    // — Preview Disc —
    public float previewPopScale  = 1.05f;
    public float previewFadeIn    = 0.12f;
    public float previewFadeOut   = 0.20f;

    // — Heat (theme-level multipliers) —
    [Range(0f, 1f)] public float heatSizeScale  = 0.15f;
    [Range(0f, 1f)] public float heatSpeedScale = 0.20f;

    // — Dot Burst (center pop + radial)
    public bool useCenterDot = true;
    public bool enableRadialBurst = true;
    [Range(0, 256)] public int radialBurstCount = 10;
    [Range(0.01f, 1.5f)] public float radialBurstLifetime = 0.28f;
    [Range(0f, 360f)] public float radialBurstSpreadDegrees = 360f;
    [Range(0f, 2f)] public float radialBurstDistanceMultiplier = 0.9f;
    [Range(0.001f, 0.3f)] public float radialBurstDotMinRadius = 0.02f;
    [Range(0.001f, 0.3f)] public float radialBurstDotMaxRadius = 0.06f;
    public bool prewarmBurstPool = false;
    [Min(0)] public int prewarmBurstCount = 16;
}
