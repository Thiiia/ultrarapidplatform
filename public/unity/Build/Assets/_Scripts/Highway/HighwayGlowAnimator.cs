using UnityEngine;
using DG.Tweening;
using Shapes;

[DisallowMultipleComponent]
public class HighwayGlowAnimator : MonoBehaviour
{
    [System.Serializable]
    public class LaneGlow
    {
        [Tooltip("Any Shapes component: Rectangle, Disc, Line, etc.")]
        public ShapeRenderer shape;

        [Header("Colors")]
        public Color baseColor = new Color(1, 1, 1, 0); // usually transparent
        public Color burstColor = new Color(1, 1, 1, 1); // full, HDR allowed

        [Header("Timings")]
        public float holdDuration = 0.08f;
        public float fadeDuration = 0.20f;

        [Header("Scale Pulse")]
        public Transform pulseTarget;        // e.g. the shape's transform
        public float burstScale = 1.08f;     // 1 = no scale pulse
        public float scaleFadeDuration = 0.18f;

        [HideInInspector] public Tween colorTween;
        [HideInInspector] public Tween scaleTween;
        [HideInInspector] public Color currentBase;
        // Manual color driver
        [HideInInspector] public float intensity;   // 0 = base, 1 = burst
        [HideInInspector] public float holdLeft;    // unscaled seconds at burst
    }

    [Header("Per-lane glow entries (order should match note lanes)")]
    public LaneGlow[] lanes;

    // Small epsilon for comparing colors
    private const float ColorEpsilon = 0.0025f;
    private const float FailsafeFactor = 2.5f; // how long before forced reset (hold+fade)*factor

    private static bool Approximately(Color a, Color b)
    {
        return Mathf.Abs(a.r - b.r) < ColorEpsilon &&
               Mathf.Abs(a.g - b.g) < ColorEpsilon &&
               Mathf.Abs(a.b - b.b) < ColorEpsilon &&
               Mathf.Abs(a.a - b.a) < ColorEpsilon;
    }

    private void Awake()
    {
        // Initialize all lanes to base color (supports gradients by multiplying)
        for (int i = 0; i < lanes.Length; i++)
        {
            var l = lanes[i];
            if (l.shape == null) continue;

            l.colorTween?.Kill();
            l.scaleTween?.Kill();

            l.currentBase = l.baseColor;
            l.intensity = 0f;
            l.holdLeft = 0f;

            // Shapes uses a color multiplier — works with gradients too
            l.shape.Color = l.baseColor;

            if (l.pulseTarget != null)
                l.pulseTarget.localScale = Vector3.one;
        }
    }

    /// <summary>
    /// Triggers a glow on a lane. Strength (0..1+) multiplies toward burstColor.
    /// </summary>
    public void TriggerGlow(int index, float strength = 1f)
    {
        if (index < 0 || index >= lanes.Length) return;
        var l = lanes[index];
        if (l.shape == null) return;

        // Kill any existing tweens for a snappy retrigger (don't invoke callbacks)
        l.colorTween?.Kill(false);
        l.scaleTween?.Kill(false);
        // Also kill any other tweens that might be targeting this shape from elsewhere
        DOTween.Kill(l.shape, false);

        // Manual color driver: boost intensity and refresh hold
        float add = Mathf.Clamp01(strength);
        l.intensity = Mathf.Max(l.intensity, add);
        l.holdLeft = l.holdDuration;
        var start = Color.Lerp(l.baseColor, l.burstColor, l.intensity);
        l.shape.Color = start;
        l.currentBase = start;

        // Optional scale pulse
        if (l.pulseTarget != null && l.burstScale > 1f)
        {
            l.pulseTarget.localScale = Vector3.one * l.burstScale;
            l.scaleTween = l.pulseTarget.DOScale(1f, l.scaleFadeDuration).SetEase(Ease.OutQuad);
        }

        // Color is now driven manually in LateUpdate; keep only optional scale tween
        l.colorTween = null;
    }

    private void LateUpdate()
    {
        // Manual color update per lane: hold, then fade intensity to zero (unscaled time)
        if (lanes == null) return;
        for (int i = 0; i < lanes.Length; i++)
        {
            var l = lanes[i];
            if (l == null || l.shape == null) continue;

            float dt = Time.unscaledDeltaTime;
            if (l.holdLeft > 0f)
                l.holdLeft = Mathf.Max(0f, l.holdLeft - dt);
            else if (l.intensity > 0f)
            {
                float fade = l.fadeDuration <= 0f ? 1f : dt / l.fadeDuration;
                l.intensity = Mathf.Max(0f, l.intensity - fade);
            }

            var target = (l.intensity <= 0f) ? l.baseColor : Color.Lerp(l.baseColor, l.burstColor, l.intensity);
            if (!Approximately(l.shape.Color, target))
                l.shape.Color = target;
            l.currentBase = target;
        }
    }

    // Utility to change palettes at runtime
    public void SetLanePalette(int index, Color newBase, Color newBurst, bool applyNow = true)
    {
        if (index < 0 || index >= lanes.Length) return;
        var l = lanes[index];
        l.baseColor = newBase;
        l.burstColor = newBurst;
        l.currentBase = newBase;
        l.intensity = 0f;
        l.holdLeft = 0f;

        if (applyNow && l.shape != null)
            l.shape.Color = newBase;
    }

    public void ResetLane(int index)
    {
        if (index < 0 || lanes == null || index >= lanes.Length) return;
        var l = lanes[index];
        if (l == null || l.shape == null) return;
        l.colorTween?.Kill(false);
        l.scaleTween?.Kill(false);
        DOTween.Kill(l.shape, false);
        l.intensity = 0f;
        l.holdLeft = 0f;
        l.shape.Color = l.baseColor;
        l.currentBase = l.baseColor;
    }

    public void ResetAllToBase()
    {
        if (lanes == null) return;
        for (int i = 0; i < lanes.Length; i++)
            ResetLane(i);
    }
    #if UNITY_EDITOR
[ContextMenu("Auto-wire lanes from children (… Indicator)")]
private void AutoWireFromChildren()
{
    var rects = GetComponentsInChildren<Rectangle>(true);
    var order = new[] { "Green", "Red", "Yellow", "Blue", "Orange" };
    var list = new System.Collections.Generic.List<LaneGlow>();

    foreach (var name in order)
    {
        foreach (var r in rects)
        {
            if (r.name.Contains(name) && r.name.Contains("Indicator"))
            {
                list.Add(new LaneGlow { shape = r });
                break;
            }
        }
    }
    lanes = list.ToArray();
    Debug.Log($"Auto-wired {lanes.Length} lanes.");
}
#endif

}
