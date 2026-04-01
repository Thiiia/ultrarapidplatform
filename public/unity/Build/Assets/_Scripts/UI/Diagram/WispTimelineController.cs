using UnityEngine;
using Sirenix.OdinInspector;
using DG.Tweening;

// Keeps the wisp skating round the perimeter like FLCL scooter chases – who gave Haruko the aux, honestly?
public class WispTimelineController : MonoBehaviour
{
    public enum Direction { CW = 1, CCW = -1 }

    [Title("References", "Path the wisp traverses")]
    [SerializeField, Required] PerimeterPathProvider path;

    [Title("Motion", "How quickly the wisp laces the circle")]
    [SerializeField, Min(0.01f)] float lapDuration = 12f;
    [SerializeField] Direction direction = Direction.CW;

    // Debug: bypass audio and drive wisp with Time.unscaledTime
    [SerializeField] bool useUnscaledTimeForDebug = false;

    [Title("UI Mapping", "Anchor philosophy")]
    [Tooltip("If true, output 0..width / 0..height (bottom-left origin). If false, output centered [-w/2..+w/2].")]
    [SerializeField] bool anchoredOriginBottomLeft = false;


    Vector3 currentPos;
    RectTransform rect;

    [Header("Visuals")]
    [SerializeField, Tooltip("Any component whose color should brighten with heat (e.g., Shapes Disc, Image, SpriteRenderer).")]
    Component wispVisual;
    [SerializeField, Range(0f, 1f), Tooltip("How strongly heat brightens the wisp relative to its authored color.")]
    float heatBrightnessBoost = 0.35f;
    Color _baseWispColor;
    bool _hasCachedBaseColor;
    System.Reflection.PropertyInfo _colorProperty;

    public float T { get; private set; }
    public Vector3 CurrentPos => currentPos;
    public float LapDuration => lapDuration;
    public Direction PathDirection => direction;
    [Header("Trail Follower")]
    [SerializeField] Transform trailTarget;       // world object with TrailRenderer
    [SerializeField] bool orientAlongPath = true; // rotate to tangent

    [Header("Beat Reaction")]
    [SerializeField] bool pulseOnBeat = true;
    [SerializeField, Range(1f, 1.3f)] float beatScale = 1.08f;
    [SerializeField, Range(0.05f, 0.3f)] float beatPulseSeconds = 0.15f;
    [SerializeField] float beatRotationDegrees = 8f;
    [SerializeField, Tooltip("Extra pulse exactly when a scheduled beat lands at the preview disc.")]
    bool pulseAtPreviewHit = true;
    [SerializeField, Range(1f, 1.5f)] float previewHitScale = 1.15f;
    [SerializeField, Range(0.05f, 0.3f)] float previewHitPulseSeconds = 0.18f;

    Tween scheduledPreviewPulse;
    
    [Header("Shape Events")]
    [SerializeField, Tooltip("If true, the wisp performs a slightly longer celebratory pulse when a whole perimeter shape is completed.")]
    bool celebrateOnPerimeterComplete = true;
    
    // Keep inspector-only fields from generating compiler warnings when unused in code.
    // These reads are never executed but are enough for the compiler to consider them used.
    void __SuppressUnusedInspectorFields()
    {
        _ = anchoredOriginBottomLeft;
    }


    void Awake()
    {
        rect = GetComponent<RectTransform>();
        if (rect)
        {
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.localScale = Vector3.one;
            rect.localRotation = Quaternion.identity;
        }

        // Only cache a visual target if the user has explicitly assigned one in the inspector.
        // This keeps the authored wisp gradient intact by default.
        if (wispVisual)
            CacheBaseColor();
    }

    void OnEnable()
    {
        GameplayEventBus.BeatResolved += HandleBeatResolved;
        GameplayEventBus.BeatScheduled += HandleBeatScheduled;
        GameplayEventBus.HeatChanged += HandleHeatChanged;
        GameplayEventBus.StreakTierChanged += HandleStreakTierChanged;
        GameplayEventBus.OnPerimeterComplete += HandlePerimeterComplete;

        // Apply current heat immediately so reloading mid-song keeps visuals in sync.
        if (DiagramManager.Instance != null && wispVisual && _hasCachedBaseColor)
            ApplyHeatToWisp(DiagramManager.Instance.CurrentHeatFillColor);
    }

    void OnDisable()
    {
        GameplayEventBus.BeatResolved -= HandleBeatResolved;
        GameplayEventBus.BeatScheduled -= HandleBeatScheduled;
        GameplayEventBus.HeatChanged -= HandleHeatChanged;
        GameplayEventBus.StreakTierChanged -= HandleStreakTierChanged;
        GameplayEventBus.OnPerimeterComplete -= HandlePerimeterComplete;
        if (rect) DOTween.Kill(rect);
        if (trailTarget) DOTween.Kill(trailTarget);
        scheduledPreviewPulse?.Kill(false);
        scheduledPreviewPulse = null;
    }


    void Update()
    {
        if (!path) return;

        // 1) Make sure the path actually has geometry
        //    (if not, rebuild once; harmless if already valid)
        if (path.Segments == null || path.Segments.Count == 0 || path.TotalLength <= 1e-5f)
            path.RebuildCache();

        // 2) Time source
        double now = GetWispSongTime();

        T = GetNormalizedT(now);

        // 3) Evaluate position in the *ReferenceRect's* local space
        Vector2 posInPath = path.EvaluateAnchoredPosition(T);
        currentPos = new Vector3(posInPath.x, posInPath.y, 0f);

        // 4) Map to the wisp's RectTransform
        if (rect && path.ReferenceRect)
        {
            // Fast path: if the wisp lives under the same RectTransform as ReferenceRoot,
            // just assign the anchored position directly.
            if (rect.parent == path.ReferenceRect)
            {
                rect.anchoredPosition = posInPath;
            }
            else if (rect.parent is RectTransform myParent)
            {
                // Cross-canvas safe mapping (Overlay/Camera/World)
                Vector3 world = path.ReferenceRect.TransformPoint(currentPos);

                var myCanvas = myParent.GetComponentInParent<Canvas>();
                Camera cam = (myCanvas && myCanvas.renderMode != RenderMode.ScreenSpaceOverlay)
                    ? myCanvas.worldCamera
                    : null;

                Vector2 screen = RectTransformUtility.WorldToScreenPoint(cam, world);
                RectTransformUtility.ScreenPointToLocalPointInRectangle(myParent, screen, cam, out var local);
                rect.anchoredPosition = local;
            }
        }
        else
        {
            // Non-UI fallback (shouldn’t be needed in your scene)
            transform.position = path.ReferenceLocalToWorld(currentPos);
        }

        // 5) (optional) Move the 3D trail target, if you assign one later
        if (trailTarget)
        {
            trailTarget.position = path.ReferenceLocalToWorld(currentPos);
            if (orientAlongPath)
            {
                Vector3 tan = path.EvaluateTangent(T);
                if (tan.sqrMagnitude > 1e-6f) trailTarget.forward = tan.normalized;
            }
        }
    }
    public float GetNormalizedT(double songTime)
    {
        float period = Mathf.Max(0.01f, lapDuration);
        float baseT = (float)(songTime / period);
        int dir = direction == Direction.CW ? 1 : -1;

        float t = baseT * dir;
        return Mathf.Repeat(t, 1f);
    }


    public Vector3 EvaluatePositionAt(double songTime)
    {
        if (!path) return transform.position;
        var a = EvaluateAnchoredAt(songTime);
        return path.ReferenceLocalToWorld(new Vector3(a.x, a.y, 0f));
    }
    public Vector2 EvaluateAnchoredAt(double songTime)
    {
        return path ? path.EvaluateAnchoredPosition(GetNormalizedT(songTime)) : Vector2.zero;
    }


    public Vector3 EvaluateTangentAt(double songTime)
    {
        if (!path) return Vector3.right;
        return path.EvaluateTangent(GetNormalizedT(songTime));
    }

    double GetWispSongTime()
    {
        if (useUnscaledTimeForDebug)
            return Time.unscaledTime;

        var am = AudioManager.Instance;
        double baseNow = (am != null ? am.GetAdjustedSongTime() : AudioSettings.dspTime);

        var director = WispImpactDirector.Instance;
        double visualOffsetSeconds = director != null ? director.VisualOffsetMs * 0.001 : 0.0;

        return baseNow + visualOffsetSeconds;
    }

    void HandleBeatScheduled(BeatPayload payload)
    {
        if (!pulseAtPreviewHit || !rect) return;

        double songNow = GetWispSongTime();

        // BeatPayload.DspTime is on the same song-time axis as GetAdjustedSongTime().
        float delay = Mathf.Max(0f, (float)(payload.DspTime - songNow));
        if (delay <= 0f)
        {
            PulsePreviewHit();
            return;
        }

        scheduledPreviewPulse?.Kill(false);
        scheduledPreviewPulse = DOVirtual.DelayedCall(delay, PulsePreviewHit)
            .SetUpdate(true)
            .SetTarget(this);
    }

    void HandleHeatChanged(float heat)
    {
        if (DiagramManager.Instance == null || !wispVisual || !_hasCachedBaseColor)
            return;

        // We treat DiagramManager's heat fill color as an accent but preserve the wisp's base hue,
        // only brightening it as heat rises so the authored green stays intact.
        var heatColor = DiagramManager.Instance.CurrentHeatFillColor;
        ApplyHeatToWisp(heatColor);
    }

    void HandleStreakTierChanged(int streak, GameplayEventBus.StreakTier tier, float tierHeat01)
    {
        if (!rect)
            return;

        // On tier up, give the wisp a slightly bigger, slower punch so it feels
        // like entering a new gear. On tier drop, a small settle back toward 1.
        float targetExtraScale = 0f;
        switch (tier)
        {
            case GameplayEventBus.StreakTier.Tier1: targetExtraScale = 0.06f; break;
            case GameplayEventBus.StreakTier.Tier2: targetExtraScale = 0.1f; break;
            case GameplayEventBus.StreakTier.Tier3: targetExtraScale = 0.14f; break;
            default: targetExtraScale = 0.02f; break;
        }

        DOTween.Kill(rect);
        rect.localScale = Vector3.one;
        float punch = Mathf.Max(0.01f, targetExtraScale);
        float dur = Mathf.Lerp(0.12f, 0.22f, tierHeat01);
        rect.DOPunchScale(Vector3.one * punch, dur, 0, 0)
            .SetTarget(rect)
            .SetUpdate(true)
            .SetRecyclable(true);
    }

    void HandleBeatResolved(BeatPayload payload, HitResult result)
    {
        if (!pulseOnBeat) return;

        if (rect)
        {
            DOTween.Kill(rect);
            rect.localScale = Vector3.one;
            rect.DOPunchScale(Vector3.one * (beatScale - 1f), Mathf.Max(0.05f, beatPulseSeconds), 0, 0)
                .SetTarget(rect)
                .SetUpdate(true)
                .SetRecyclable(true);
        }

        if (trailTarget && Mathf.Abs(beatRotationDegrees) > 0.01f)
        {
            DOTween.Kill(trailTarget);
            trailTarget.DOLocalRotate(new Vector3(0f, 0f, beatRotationDegrees), Mathf.Max(0.05f, beatPulseSeconds),
                    RotateMode.LocalAxisAdd)
                .SetTarget(trailTarget)
                .SetUpdate(true)
                .SetRecyclable(true);
        }
    }

    void HandlePerimeterComplete()
    {
        if (!celebrateOnPerimeterComplete || !rect)
            return;

        DOTween.Kill(rect);
        rect.localScale = Vector3.one;

        // Slightly bigger, slower punch so finishing a shape feels distinct from a normal beat.
        float extraScale = Mathf.Max(0.05f, (beatScale - 1f) * 1.8f);
        float dur = Mathf.Max(0.2f, beatPulseSeconds * 1.8f);

        rect.DOPunchScale(Vector3.one * extraScale, dur, 0, 0)
            .SetTarget(rect)
            .SetUpdate(true)
            .SetRecyclable(true);
    }

    void PulsePreviewHit()
    {
        if (!pulseAtPreviewHit || !rect) return;

        DOTween.Kill(rect);
        rect.localScale = Vector3.one;

        float targetScale = Mathf.Max(1f, previewHitScale);
        float dur = Mathf.Max(0.05f, previewHitPulseSeconds);

        rect.DOPunchScale(Vector3.one * (targetScale - 1f), dur, 0, 0)
            .SetTarget(rect)
            .SetUpdate(true)
            .SetRecyclable(true);
    }

    void CacheBaseColor()
    {
        _hasCachedBaseColor = false;
        _colorProperty = null;

        if (!wispVisual)
            return;

        var type = wispVisual.GetType();
        // Try common naming conventions for a color property
        _colorProperty = type.GetProperty("color") ?? type.GetProperty("Color");
        if (_colorProperty == null)
            return;

        var val = _colorProperty.GetValue(wispVisual, null);
        if (val is Color c)
            _baseWispColor = c;
        else if (val is Color32 c32)
            _baseWispColor = (Color)c32;
        else
            return;

        _hasCachedBaseColor = true;
    }

    void ApplyHeatToWisp(Color heatColor)
    {
        if (!_hasCachedBaseColor || _colorProperty == null || wispVisual == null)
            return;

        // Derive brightness from the heat-controlled fill but keep the original wisp hue/sat.
        Color baseCol = _baseWispColor;
        Color.RGBToHSV(baseCol, out var h, out var s, out var vBase);

        // Use the value of the heat color as a driver.
        Color.RGBToHSV(heatColor, out _, out _, out var vHeat);
        float boost = Mathf.Clamp01(vHeat * heatBrightnessBoost);
        float v = Mathf.Clamp01(vBase + boost);

        Color lit = Color.HSVToRGB(h, s, v);
        lit.a = baseCol.a;
        if (_colorProperty.PropertyType == typeof(Color32))
            _colorProperty.SetValue(wispVisual, (Color32)lit, null);
        else
            _colorProperty.SetValue(wispVisual, lit, null);
    }
}
