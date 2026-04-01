using UnityEngine;
using DG.Tweening;
using Shapes;
using UnityEngine.Rendering;
using UnityEngine.UI;

public class ImpactFx : MonoBehaviour
{
    [Header("Refs")]
    [SerializeField] private Disc previewDisc;   // soft pre-hit indicator
    [SerializeField] private Disc impactRing;    // main expanding ring
    [SerializeField] private Disc arcSweep;      // small arc that sweeps along tangent
    [SerializeField] private Disc dotBurst;      // center dot pop

    [Header("Dot Center & Burst")]
    [Tooltip("Enable/disable the center dot pop animation.")]
    [SerializeField] private bool useCenterDot = true;

    [Tooltip("Optional prototype for additional small dots spawned radially on impact")]
    [SerializeField] private Disc dotPrefab;
    [SerializeField] private bool enableRadialBurst = true;
    [SerializeField, Range(0, 64)] private int burstDotCount = 10;
    [SerializeField, Range(0.01f, 1.5f)] private float burstDotLifetime = 0.28f;
    [SerializeField, Range(0f, 360f)] private float burstSpreadDegrees = 360f;
    [SerializeField, Range(0f, 2f)] private float burstDistanceMultiplier = 0.9f;
    [SerializeField, Range(0.01f, 0.3f)] private float burstDotMinRadius = 0.02f;
    [SerializeField, Range(0.01f, 0.3f)] private float burstDotMaxRadius = 0.06f;
    [Space]
    [Tooltip("Instantiate some burst dots up-front to avoid spikes on the first hits.")]
    [SerializeField] private bool prewarmBurstPool = false;
    [SerializeField, Min(0)] private int prewarmBurstCount = 16;

    [Header("Defaults")]
    [SerializeField] private float defaultRingExpansion = 1.35f;
    [SerializeField] private float defaultRingDuration = 0.18f;
    [SerializeField] private float defaultArcDuration = 0.18f;
	[SerializeField] private float defaultPreviewFadeIn = 0.12f;
	[SerializeField] private float defaultPreviewFadeOut = 0.20f;
	[SerializeField] private float defaultPreviewPop = 1.05f;
	[SerializeField] private float defaultRingPunch = 1.05f;
	[SerializeField, Tooltip("Absolute multiplier applied as a hard ceiling for ring expansion.")] private float ringExpansionHardCap = 2.2f;
	[SerializeField, Tooltip("Upper bound for the heat-driven scale multiplier.")] private float maxHeatSizeMultiplier = 1.3f;

    [Header("Ghost Rings")]
    [SerializeField, Range(0, 4)] private int ghostCount = 2;
    [SerializeField] private float ghostDelay = 0.035f;
    [SerializeField] private float ghostRadiusStep = 0.12f;
    [SerializeField] private float ghostAlpha = 0.55f;

    [Header("Heat Scaling")]
    [SerializeField, Tooltip("How much heat (0..1) scales size/speed. 0 = ignore heat")]
    private float heatSizeScale = 0.15f;     // 15% bigger at heat=1
    [SerializeField] private float heatSpeedScale = 0.20f;   // 20% faster at heat=1
	[SerializeField, Tooltip("How much heat lengthens the visible lifetime of the impact elements.")]
	private float heatSustainScale = 0.25f;

    // palette
    private Color previewTint = new(1f, 0.95f, 0.35f, 0.7f);
    private Color missTint = new(0.93f, 0.36f, 0.36f, 0.85f);
    private Color ringTint = new(0.9f, 1f, 0.6f, 0.95f);
    private Color arcTint = new(1f, 0.9f, 0.5f, 0.9f);
    private Color dotTint = new(1f, 1f, 1f, 0.95f);

    // tuning (overridable via theme)
    private float impactArcDegrees = 20f;
    private float arcSpinDegrees = 120f;
    private float arcDuration;
    private float ringThickness = 0.12f;
    private float ringExpansionMultiplier;
    private float ringExpansionDuration;
    private float ringPunchScale;
    private float ringPunchDuration;
    private float previewPopScale;
    private float previewFadeIn;
    private float previewFadeOut;

    // tween handles to avoid double-kill
    Tween _twPreview, _twRingSeq, _twArcSeq, _twRingPunch, _twDot;
    Tween _twPreviewHitScheduler, _twPreviewHitPulse;

    // ghost ring clones (created lazily)
    Disc[] _ghosts;

    // dotburst pool
    readonly System.Collections.Generic.Queue<Disc> _dotPool = new();
    readonly System.Collections.Generic.List<Disc> _dotActive = new();
    readonly System.Collections.Generic.List<Disc> _pendingDotReparent = new();
    Transform _dotRoot; // keep pooled children under a tidy container
    [SerializeField, Min(0)] int maxBurstPoolSize = 64;
    bool _isDisabling;
    float _baseRingRadius = 1f;

    [Header("Impact Splash")]
    [Tooltip("Optional UI graphic (eg. Translucent Image) used as an extra soft splash over the preview disc on hits and misses.")]
    [SerializeField] private Graphic missSplashGraphic;

    // ---------- public API ----------

    public void ApplyPalette(Color previewColor, Color missColor)
    { previewTint = previewColor; missTint = missColor; }

    public void ApplyTheme(PerimeterVfxTheme theme)
    {
        if (!theme)
        {
            ringExpansionMultiplier = defaultRingExpansion;
            ringExpansionDuration = defaultRingDuration;
            arcDuration = defaultArcDuration;
            previewPopScale = defaultPreviewPop;
            ringPunchScale = defaultRingPunch;
            ringPunchDuration = defaultRingDuration * 0.6f;
            previewFadeIn = defaultPreviewFadeIn;
            previewFadeOut = defaultPreviewFadeOut;
            return;
        }

        previewTint = theme.previewTint; missTint = theme.missTint;
        ringTint = theme.impactRingColor; arcTint = theme.arcColor; dotTint = theme.dotColor;
        impactArcDegrees = theme.impactArcDegrees; arcSpinDegrees = theme.arcSpinDegrees; arcDuration = theme.arcDuration;
        ringThickness = theme.ringThickness; ringExpansionMultiplier = theme.ringExpansionMultiplier;
        ringExpansionDuration = theme.ringExpansionDuration; ringPunchScale = theme.ringPunchScale; ringPunchDuration = theme.ringPunchDuration;
        previewPopScale = theme.previewPopScale; previewFadeIn = theme.previewFadeIn; previewFadeOut = theme.previewFadeOut;
        ghostCount = Mathf.Max(0, theme.ghostCount);
        ghostDelay = theme.ghostDelay; ghostRadiusStep = theme.ghostRadiusStep; ghostAlpha = theme.ghostAlpha;
        heatSizeScale = theme.heatSizeScale;
        heatSpeedScale = theme.heatSpeedScale;

        // Dot-burst theme controls (optional)
        useCenterDot = theme.useCenterDot;
        enableRadialBurst = theme.enableRadialBurst;
        burstDotCount = Mathf.Clamp(theme.radialBurstCount, 0, 256);
        burstDotLifetime = Mathf.Max(0.01f, theme.radialBurstLifetime);
        burstSpreadDegrees = Mathf.Clamp(theme.radialBurstSpreadDegrees, 0f, 360f);
        burstDistanceMultiplier = Mathf.Max(0f, theme.radialBurstDistanceMultiplier);
        burstDotMinRadius = Mathf.Max(0.001f, Mathf.Min(theme.radialBurstDotMinRadius, theme.radialBurstDotMaxRadius));
        burstDotMaxRadius = Mathf.Max(burstDotMinRadius, theme.radialBurstDotMaxRadius);
        prewarmBurstPool = theme.prewarmBurstPool;
        prewarmBurstCount = Mathf.Max(0, theme.prewarmBurstCount);

        if (impactRing)
            _baseRingRadius = Mathf.Max(0.0001f, impactRing.Radius);
    }

    /// <summary>Set world-space pose and tangent so arcs align with the path.</summary>
    public void SetPose(Vector3 worldPos, Vector2 tangent2D)
    {
        transform.position = worldPos;
        // rotate z so +x points along tangent (2D)
        float z = Mathf.Atan2(tangent2D.y, tangent2D.x) * Mathf.Rad2Deg;
        transform.rotation = Quaternion.Euler(0f, 0f, z);
    }

    /// <summary>Tint ring/arc/dot toward lane color (keeps original alphas).</summary>
    public void SetLaneColor(Color lane)
    {
        ringTint = new Color(lane.r, lane.g, lane.b, ringTint.a);
        arcTint = new Color(lane.r, lane.g, lane.b, arcTint.a);
        // Always tint dot color too (affects radial dots even if center dot is missing)
        dotTint = new Color(lane.r, lane.g, lane.b, dotTint.a);
    }

    /// <summary>Tiny pre-hit nudge.</summary>
    public void ShowPreview() { DoPreview(); }

    public void SchedulePreviewHitCue(float delaySeconds)
    {
        if (!previewDisc) return;
        CancelPreviewHitCue();
        delaySeconds = Mathf.Max(0f, delaySeconds);
        if (delaySeconds <= 0f)
        {
            PlayPreviewHitCue();
            return;
        }

        var scheduler = DOVirtual.DelayedCall(delaySeconds, PlayPreviewHitCue)
            .SetEase(Ease.Linear)
            .SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        _twPreviewHitScheduler = scheduler;
        scheduler.OnKill(() =>
        {
            if (_twPreviewHitScheduler == scheduler)
                _twPreviewHitScheduler = null;
        });
    }

    void PlayPreviewHitCue()
    {
        _twPreviewHitScheduler?.Kill(false);
        _twPreviewHitScheduler = null;
        if (!previewDisc) return;

        previewDisc.enabled = true;
        previewDisc.transform.localScale = Vector3.one;

        float popAmount = Mathf.Max(0.02f, (previewPopScale - 1f) * 0.35f);
        previewDisc.transform
            .DOPunchScale(Vector3.one * popAmount, 0.18f, vibrato: 1, elasticity: 0.25f)
            .SetEase(Ease.OutQuad)
            .SetLink(gameObject, LinkBehaviour.KillOnDestroy)
            .OnKill(() => { if (previewDisc) previewDisc.transform.localScale = Vector3.one; });

        float highlightAlpha = Mathf.Clamp01(previewTint.a + 0.18f);
        _twPreviewHitPulse?.Kill(false);
        var pulseTween = DOTween.Sequence()
            .Append(DOVirtual.Float(previewDisc.Color.a, highlightAlpha, 0.07f, SetPreviewAlpha).SetEase(Ease.OutQuad))
            .Append(DOVirtual.Float(highlightAlpha, previewTint.a, 0.09f, SetPreviewAlpha).SetEase(Ease.InQuad))
            .SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        _twPreviewHitPulse = pulseTween;
        pulseTween.OnKill(() =>
        {
            if (_twPreviewHitPulse == pulseTween)
                _twPreviewHitPulse = null;
        });
    }

    void CancelPreviewHitCue()
    {
        _twPreviewHitScheduler?.Kill(false);
        _twPreviewHitScheduler = null;
        _twPreviewHitPulse?.Kill(false);
        _twPreviewHitPulse = null;
    }

    void SetPreviewAlpha(float alpha)
    {
        if (!previewDisc) return;
        var c = previewTint;
        c.a = alpha;
        previewDisc.Color = c;
    }

    public void Miss()
    {
        PlayMissImpact();
    }

    /// <summary>Visual only: used when a note expires without player input (\"let it go\").</summary>
    public void MissPassive()
    {
        PlayPassiveMissImpact();
    }

    public void HitPerfect(float heat01 = 0f) => PlayImpact(1f, heat01);
    public void HitGood(float heat01 = 0f) => PlayImpact(0.7f, heat01);

    // ---------- lifecycle ----------

    void Awake()
    {
        if (impactRing)
            _baseRingRadius = Mathf.Max(0.0001f, impactRing.Radius);

        ResetToPoolState();
        if (prewarmBurstPool) PrewarmBurstPool();
    }
    void OnDisable()
    {
        _isDisabling = true;
        KillAll();
        _isDisabling = false;
    }
    void OnDestroy() => KillAll();

    public void ResetToPoolState()
    {
        KillAll();

        if (previewDisc)
        {
            previewDisc.enabled = false;
            var c = previewTint; c.a = 0f;
            previewDisc.Color = c;
            previewDisc.ZTest = CompareFunction.Always;
            previewDisc.SortingOrder = 12;
            previewDisc.transform.localScale = Vector3.one;
        }

        if (impactRing)
        {
            impactRing.enabled = false;
            var c = ringTint; c.a = 0f;
            impactRing.Color = c;
            impactRing.ZTest = CompareFunction.Always;
            impactRing.SortingOrder = 20;
            impactRing.Thickness = Mathf.Max(0.001f, ringThickness);
            impactRing.Radius = Mathf.Max(0.0001f, _baseRingRadius);
            impactRing.transform.localScale = Vector3.one;
            impactRing.transform.localRotation = Quaternion.identity;
        }

        if (arcSweep)
        {
            arcSweep.enabled = false;
            var c = arcTint; c.a = 0f;
            arcSweep.Color = c;
            arcSweep.ZTest = CompareFunction.Always;
            arcSweep.SortingOrder = 18;
            arcSweep.AngRadiansEnd = 0f;
            arcSweep.transform.localRotation = Quaternion.identity;
        }

        if (dotBurst)
        {
            var c = dotTint; c.a = 0f;
            dotBurst.Color = c;
            dotBurst.SortingOrder = 22;
            dotBurst.transform.localScale = Vector3.one;
            dotBurst.enabled = false; // keep renderer off until used
        }

        if (missSplashGraphic)
        {
            var c = missSplashGraphic.color;
            c.a = 0f;
            missSplashGraphic.color = c;
            var rt = missSplashGraphic.rectTransform;
            rt.localScale = Vector3.one;
            rt.localRotation = Quaternion.identity;
        }

        // ensure pool root exists (keeps hierarchy tidy when many pooled dots exist)
        if (_dotRoot == null)
        {
            var existing = transform.Find("DotPoolRoot");
            _dotRoot = existing ? existing : new GameObject("DotPoolRoot").transform;
            _dotRoot.SetParent(transform, false);
            _dotRoot.localPosition = Vector3.zero; _dotRoot.localRotation = Quaternion.identity; _dotRoot.localScale = Vector3.one;
        }

        FlushPendingDotReparents();

        // return any pooled dots (use central return path to avoid double-enqueue)
        while (_dotActive.Count > 0)
        {
            ReturnBurstDot(_dotActive[_dotActive.Count - 1]);
        }
    }

    // ---------- internals ----------

    void KillAll()
    {
        _twPreview?.Kill(false); _twPreview = null;
        _twRingSeq?.Kill(false); _twRingSeq = null;
        _twArcSeq?.Kill(false); _twArcSeq = null;
        _twRingPunch?.Kill(false); _twRingPunch = null;
        _twDot?.Kill(false); _twDot = null;
        CancelPreviewHitCue();

        if (previewDisc) { DOTween.Kill(previewDisc, false); DOTween.Kill(previewDisc.transform, false); }
        if (impactRing) { DOTween.Kill(impactRing, false); DOTween.Kill(impactRing.transform, false); DisableImpactRing(); }
        if (arcSweep) { DOTween.Kill(arcSweep, false); DOTween.Kill(arcSweep.transform, false); }
        if (dotBurst) { DOTween.Kill(dotBurst, false); DOTween.Kill(dotBurst.transform, false); }
        if (missSplashGraphic)
        {
            DOTween.Kill(missSplashGraphic, false);
            DOTween.Kill(missSplashGraphic.transform, false);
        }
        while (_dotActive.Count > 0)
        {
            ReturnBurstDot(_dotActive[_dotActive.Count - 1]);
        }
        if (_ghosts != null)
        {
            foreach (var g in _ghosts) if (g) { DOTween.Kill(g, false); DOTween.Kill(g.transform, false); g.enabled = false; }
        }
    }

    void EnsureGhosts()
    {
        if (ghostCount <= 0 || !impactRing) return;

        if (_ghosts == null || _ghosts.Length != ghostCount)
        {
            // clear previous
            if (_ghosts != null) foreach (var g in _ghosts) if (g) Destroy(g.gameObject);
            _ghosts = new Disc[ghostCount];
            for (int i = 0; i < ghostCount; i++)
            {
                var clone = Instantiate(impactRing, impactRing.transform.parent);
                clone.name = $"GhostRing_{i}";
                clone.SortingOrder = impactRing.SortingOrder - 1;
                clone.enabled = false;
                _ghosts[i] = clone;
            }
        }

        foreach (var g in _ghosts)
        {
            var c = ringTint; c.a = 0f;
            g.Color = c;
            g.Thickness = impactRing.Thickness * 0.9f;
            g.transform.localScale = Vector3.one;
            g.enabled = false;
        }
    }

    void DoPreview()
    {
        if (!previewDisc) return;
        _twPreview?.Kill(false);
        previewDisc.enabled = true;

        var c = previewTint; c.a = 0f; previewDisc.Color = c;
        previewDisc.transform.localScale = Vector3.one;

            var dur = Mathf.Max(0.01f, previewFadeIn);
            var amp = Mathf.Max(0.001f, previewPopScale - 1f);

        var previewTween = DOVirtual.Float(0f, previewTint.a, dur, a =>
        {
            var cc = previewDisc.Color; cc.a = a; previewDisc.Color = cc;
        }).SetEase(Ease.OutQuad).SetTarget(previewDisc).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        _twPreview = previewTween;
        previewTween.OnKill(() =>
        {
            if (_twPreview == previewTween)
                _twPreview = null;
        });

        if (amp > 0.0001f)
        {
            previewDisc.transform
                .DOPunchScale(Vector3.one * amp, dur, vibrato: 0, elasticity: 0f)
                .SetEase(Ease.OutQuad)
                .OnKill(() => { if (previewDisc) previewDisc.transform.localScale = Vector3.one; });
        }

        // Idle splash presence: keep the translucent image faintly visible and gently breathing
        // even before the note is hit, so players can see the hit area.
        if (missSplashGraphic)
        {
            DOTween.Kill(missSplashGraphic, false);
            DOTween.Kill(missSplashGraphic.transform, false);

            var sc = missSplashGraphic.color;
            sc.r = ringTint.r;
            sc.g = ringTint.g;
            sc.b = ringTint.b;
            sc.a = 0.18f; // faint but clearly visible
            missSplashGraphic.color = sc;

            var rt = missSplashGraphic.rectTransform;
            rt.localScale = Vector3.one;
            rt.localRotation = Quaternion.identity;

            // Gentle, looping pulse with a tiny spin to feel alive.
            DOTween.Sequence()
                .SetTarget(missSplashGraphic)
                .SetUpdate(true)
                .SetLink(missSplashGraphic.gameObject, LinkBehaviour.KillOnDestroy)
                .Append(rt.DOScale(1.04f, 0.85f).SetEase(Ease.InOutSine))
                .Join(rt.DOLocalRotate(new Vector3(0f, 0f, 6f), 0.85f, RotateMode.LocalAxisAdd).SetEase(Ease.InOutSine))
                .Append(rt.DOScale(1.0f, 0.85f).SetEase(Ease.InOutSine))
                .Join(rt.DOLocalRotate(new Vector3(0f, 0f, -6f), 0.85f, RotateMode.LocalAxisAdd).SetEase(Ease.InOutSine))
                .SetLoops(-1, LoopType.Restart);
        }
    }

    void FadeOutPreviewToMiss()
    {
        if (!previewDisc) return;
        _twPreview?.Kill(false);

        previewDisc.Color = missTint;
        var fadeTween = DOVirtual.Float(previewDisc.Color.a, 0f, Mathf.Max(0.01f, previewFadeOut), a =>
        {
            var cc = previewDisc.Color; cc.a = a; previewDisc.Color = cc;
        }).SetEase(Ease.InOutQuad).SetTarget(previewDisc).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        _twPreview = fadeTween;
        fadeTween.OnKill(() =>
        {
            if (_twPreview == fadeTween)
                _twPreview = null;
        });
    }

    void PlayImpact(float baseIntensity, float heat01)
    {
		float sizeMult = 1f + heatSizeScale * Mathf.Clamp01(heat01);
		sizeMult = Mathf.Clamp(sizeMult, 1f, Mathf.Max(1f, maxHeatSizeMultiplier));
		float speedMult = 1f + heatSpeedScale * Mathf.Clamp01(heat01);
		float intensity = Mathf.Clamp01(baseIntensity);
		float sustainMult = 1f + Mathf.Clamp01(heat01) * heatSustainScale;

        // Main ring
        if (impactRing)
        {
            impactRing.enabled = true;
            _twRingSeq?.Kill(false);
            impactRing.transform.DOKill(false);

            var c = ringTint; c.a = 0f;
            impactRing.Color = c;
            impactRing.Thickness = Mathf.Max(0.001f, ringThickness);

            float baseR = Mathf.Max(0.0001f, _baseRingRadius);
            float startR = baseR * 0.82f;
            impactRing.Radius = startR;
            var dur = Mathf.Max(0.01f, ringExpansionDuration / speedMult);
            var fadeDur = Mathf.Max(0.05f, Mathf.Min(dur * 0.65f, 0.25f)) * sustainMult;
            float maxRadius = baseR * Mathf.Max(1f, ringExpansionHardCap);

            var ringSeq = DOTween.Sequence()
                .Append(DOVirtual.Float(0f, 1f, dur, t =>
                {
                    float target = Mathf.Lerp(startR, startR * ringExpansionMultiplier * sizeMult, t);
                    target = Mathf.Min(target, maxRadius);
                    impactRing.Radius = target;
                    var cc = impactRing.Color;
                    cc.a = Mathf.Lerp(0f, intensity, t);
                    impactRing.Color = cc;
                }).SetEase(Ease.OutCubic))
                .Append(DOVirtual.Float(intensity, 0f, fadeDur, a =>
                {
                    var cc = impactRing.Color;
                    cc.a = a;
                    impactRing.Color = cc;
                }).SetEase(Ease.InQuad))
                .SetTarget(impactRing).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
            _twRingSeq = ringSeq;
            ringSeq.OnKill(() =>
            {
                if (_twRingSeq == ringSeq)
                {
                    DisableImpactRing();
                    _twRingSeq = null;
                }
            });

            if (ringPunchScale > 1.001f)
            {
                _twRingPunch?.Kill(false);
                var punchTween = impactRing.transform
                    .DOPunchScale(Vector3.one * (ringPunchScale - 1f) * sizeMult, Mathf.Max(0.01f, ringPunchDuration / speedMult), 0, 0)
                    .SetEase(Ease.OutQuad);
                _twRingPunch = punchTween;
                punchTween.OnKill(() =>
                {
                    if (impactRing) impactRing.transform.localScale = Vector3.one;
                    if (_twRingPunch == punchTween)
                        _twRingPunch = null;
                });
            }
        }

        // Ghost rings
        EnsureGhosts();
        if (_ghosts != null)
        {
            for (int i = 0; i < _ghosts.Length; i++)
            {
                var g = _ghosts[i];
                if (!g) continue;
                g.enabled = true;
                DOTween.Kill(g, false); DOTween.Kill(g.transform, false);

				float baseR = Mathf.Max(0.0001f, _baseRingRadius);
				float startR = baseR * 0.82f;
				g.Radius = startR;

				var dur = Mathf.Max(0.01f, (ringExpansionDuration / speedMult) * (1f + 0.08f * i));
				var fadeGhost = Mathf.Max(0.05f, Mathf.Min(dur * 0.6f, 0.2f)) * sustainMult;
				var delay = ghostDelay * i;
				float maxGhostRadius = baseR * Mathf.Max(1f, ringExpansionHardCap) * (1f + 0.08f * i);

				var ghostSeq = DOTween.Sequence()
					.SetDelay(delay)
					.Append(DOVirtual.Float(0f, 1f, dur, t =>
					{
						float target = Mathf.Lerp(startR, startR * (ringExpansionMultiplier * sizeMult + ghostRadiusStep * (i + 1)), t);
						target = Mathf.Min(target, maxGhostRadius);
						g.Radius = target;
						var cc = g.Color; cc.a = Mathf.Lerp(0f, ghostAlpha * intensity, t); g.Color = cc;
					}).SetEase(Ease.OutCubic))
                    .Append(DOVirtual.Float(ghostAlpha * intensity, 0f, fadeGhost, a =>
                    {
                        var cc = g.Color; cc.a = a; g.Color = cc;
                    }).SetEase(Ease.InQuad))
                    .SetTarget(g).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
				ghostSeq.OnKill(() => ResetGhostDisc(g));
            }
        }

        // Arc sweep (aligned to tangent by SetPose rotation)
        if (arcSweep)
        {
            arcSweep.enabled = true;
            _twArcSeq?.Kill(false);
            arcSweep.transform.DOKill(false);

            var c = arcTint; c.a = arcTint.a * intensity; arcSweep.Color = c;
            arcSweep.AngRadiansEnd = 0f;
            arcSweep.transform.localRotation = Quaternion.identity;

            var dur = Mathf.Max(0.01f, arcDuration / speedMult);
            var arcFade = Mathf.Max(dur, dur * Mathf.Max(1f, sustainMult));

            var arcSeq = DOTween.Sequence()
                .Append(DOTween.To(() => arcSweep.AngRadiansEnd, a => arcSweep.AngRadiansEnd = a,
                    Mathf.Deg2Rad * (impactArcDegrees * sizeMult), dur).SetEase(Ease.OutCubic))
                .Join(DOVirtual.Float(c.a, 0f, arcFade, a =>
                {
                    var cc = arcSweep.Color; cc.a = a; arcSweep.Color = cc;
                }).SetEase(Ease.InQuart))
                .SetTarget(arcSweep).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
            _twArcSeq = arcSeq;
            arcSeq.OnKill(() =>
            {
                if (_twArcSeq == arcSeq)
                    _twArcSeq = null;
            });

            if (Mathf.Abs(arcSpinDegrees) > 0.01f)
            {
                var spinTween = arcSweep.transform
                    .DOLocalRotate(new Vector3(0, 0, arcSpinDegrees), dur, RotateMode.LocalAxisAdd)
                    .SetEase(Ease.OutCubic)
                    .SetTarget(arcSweep.transform).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
                spinTween.OnKill(() =>
                {
                    if (arcSweep) arcSweep.transform.localRotation = Quaternion.identity;
                });
            }
        }

        // Dot pop (center) + optional radial dotburst
        if (useCenterDot && dotBurst)
        {
            _twDot?.Kill(false);
            dotBurst.enabled = true;
            var c = dotTint; c.a = Mathf.Clamp01(dotTint.a * (0.6f + 0.4f * intensity));
            dotBurst.Color = c;
            dotBurst.transform.localScale = Vector3.one * 0.4f;

			float dotFade = Mathf.Max(0.08f, (0.22f / speedMult) * sustainMult);
            var dotSeq = DOTween.Sequence()
                .Append(dotBurst.transform.DOScale(Vector3.one * (1.0f * (1f + 0.15f * sizeMult)), 0.08f / speedMult).SetEase(Ease.OutBack))
                .Join(DOVirtual.Float(c.a, 0f, dotFade, a =>
                {
                    var cc = dotBurst.Color; cc.a = a; dotBurst.Color = cc;
                }).SetEase(Ease.InQuad).SetDelay(0.05f / speedMult))
                .OnComplete(() => { if (dotBurst) dotBurst.enabled = false; })
                .SetTarget(dotBurst).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
            _twDot = dotSeq;
            dotSeq.OnKill(() =>
            {
                if (_twDot == dotSeq)
                    _twDot = null;
            });

            // additional radial dots
            if (enableRadialBurst && dotPrefab && burstDotCount > 0)
                DoDotBurst(burstDotCount, sizeMult, speedMult, intensity, sustainMult);
        }

        // Fade preview away
        if (previewDisc)
        {
            _twPreview?.Kill(false);
            var postImpactPreviewTween = DOVirtual.Float(previewDisc.Color.a, 0f, Mathf.Max(0.01f, (previewFadeOut / speedMult) * sustainMult), a =>
            {
                var cc = previewDisc.Color; cc.a = a; previewDisc.Color = cc;
            }).SetEase(Ease.InOutSine).SetTarget(previewDisc).SetLink(gameObject, LinkBehaviour.KillOnDestroy);
            _twPreview = postImpactPreviewTween;
            postImpactPreviewTween.OnKill(() =>
            {
                if (_twPreview == postImpactPreviewTween)
                    _twPreview = null;
            });
        }

        // Soft translucent splash over the preview disc (lane-coloured) on hits.
        PlayImpactSplash(intensity, sizeMult, Mathf.Clamp01(heat01));

        // PostFX ping (tiny global confirmation)
        BeatPostFx.Instance?.Ping(intensity * (0.75f + heat01 * 0.5f));
    }

    void PlayMissImpact()
    {
        // Stronger miss feedback: preview disc flashes red, a red ring pops, and an optional
        // translucent splash (Graphic) blooms out briefly.
        FadeOutPreviewToMiss();

        if (previewDisc)
        {
            DOTween.Kill(previewDisc.transform, false);
            previewDisc.transform.localScale = Vector3.one;
            previewDisc.transform
                .DOPunchScale(Vector3.one * 0.12f, 0.22f, vibrato: 0, elasticity: 0f)
                .SetEase(Ease.OutQuad)
                .SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        }

        if (impactRing)
        {
            impactRing.enabled = true;
            DOTween.Kill(impactRing, false);
            DOTween.Kill(impactRing.transform, false);

            float baseR = Mathf.Max(0.0001f, _baseRingRadius);
            float startR = baseR * 0.85f;
            float endR = baseR * 1.35f;

            var c = missTint; c.a = 0f;
            impactRing.Color = c;
            impactRing.Thickness = Mathf.Max(0.001f, ringThickness);
            impactRing.Radius = startR;

            float dur = 0.18f;
            float fade = 0.25f;

            var missSeq = DOTween.Sequence()
                .Append(DOVirtual.Float(0f, 1f, dur, t =>
                {
                    impactRing.Radius = Mathf.Lerp(startR, endR, t);
                    var cc = impactRing.Color;
                    cc.a = Mathf.Lerp(0f, missTint.a, t);
                    impactRing.Color = cc;
                }).SetEase(Ease.OutCubic))
                .Append(DOVirtual.Float(missTint.a, 0f, fade, a =>
                {
                    var cc = impactRing.Color;
                    cc.a = a;
                    impactRing.Color = cc;
                }).SetEase(Ease.InQuad))
                .SetTarget(impactRing)
                .SetLink(gameObject, LinkBehaviour.KillOnDestroy);

            missSeq.OnKill(() =>
            {
                if (impactRing)
                    DisableImpactRing();
            });
        }

        // Louder, red-tinted splash for misses.
        PlaySplashForMiss();

        // Slightly darker global post effect ping on miss so it still reads.
        BeatPostFx.Instance?.Ping(0.35f);
    }

    void PlayPassiveMissImpact()
    {
        // Softer, \"ghost\" miss when the player lets the note go without pressing.
        // Still uses red to communicate failure, but with less punch than an active mis-tap.

        if (previewDisc)
        {
            DOTween.Kill(previewDisc, false);
            DOTween.Kill(previewDisc.transform, false);

            var c = missTint;
            c.a = Mathf.Max(0.2f, previewTint.a * 0.8f);
            previewDisc.Color = c;

            // Slight shrink + fade to suggest the window closing.
            previewDisc.transform.localScale = Vector3.one;
            previewDisc.transform
                .DOScale(0.9f, Mathf.Max(0.12f, previewFadeOut))
                .SetEase(Ease.InOutSine)
                .SetLink(gameObject, LinkBehaviour.KillOnDestroy);

            DOVirtual.Float(c.a, 0f, Mathf.Max(0.14f, previewFadeOut * 1.1f), a =>
            {
                var cc = previewDisc.Color;
                cc.a = a;
                previewDisc.Color = cc;
            }).SetEase(Ease.InOutQuad)
              .SetTarget(previewDisc)
              .SetLink(gameObject, LinkBehaviour.KillOnDestroy);
        }

        // A smaller, dimmer ring to show the opportunity fading, without the sharp punch.
        if (impactRing)
        {
            impactRing.enabled = true;
            DOTween.Kill(impactRing, false);
            DOTween.Kill(impactRing.transform, false);

            float baseR = Mathf.Max(0.0001f, _baseRingRadius);
            float startR = baseR * 0.9f;
            float endR = baseR * 1.15f;

            var c = missTint;
            c.a = 0f;
            impactRing.Color = c;
            impactRing.Thickness = Mathf.Max(0.001f, ringThickness * 0.9f);
            impactRing.Radius = startR;

            float dur = 0.22f;
            float fade = 0.3f;

            DOTween.Sequence()
                .Append(DOVirtual.Float(0f, 1f, dur, t =>
                {
                    impactRing.Radius = Mathf.Lerp(startR, endR, t);
                    var cc = impactRing.Color;
                    cc.a = Mathf.Lerp(0f, missTint.a * 0.7f, t);
                    impactRing.Color = cc;
                }).SetEase(Ease.OutCubic))
                .Append(DOVirtual.Float(missTint.a * 0.7f, 0f, fade, a =>
                {
                    var cc = impactRing.Color;
                    cc.a = a;
                    impactRing.Color = cc;
                }).SetEase(Ease.InQuad))
                .SetTarget(impactRing)
                .SetLink(gameObject, LinkBehaviour.KillOnDestroy)
                .OnKill(() =>
                {
                    if (impactRing)
                        DisableImpactRing();
                });
        }

        // Use the same splash, but at a slightly lower alpha, to keep consistency with active misses.
        PlaySplashForMiss();
    }

    void PlaySplashForMiss()
    {
        if (!missSplashGraphic) return;

        DOTween.Kill(missSplashGraphic, false);
        DOTween.Kill(missSplashGraphic.transform, false);

        var c = missSplashGraphic.color;
        c.r = missTint.r;
        c.g = missTint.g;
        c.b = missTint.b;
        c.a = 0f;
        missSplashGraphic.color = c;

        var rt = missSplashGraphic.rectTransform;
        float baseScale = 0.9f;
        float targetScale = 1.18f;
        rt.localScale = Vector3.one * baseScale;

        float grow = 0.22f;
        float fade = 0.34f;
        float peakAlpha = 0.8f; // louder than hits, but still translucent
        float spin = 22f;

        var splashSeq = DOTween.Sequence()
            .SetTarget(missSplashGraphic)
            .SetLink(missSplashGraphic.gameObject, LinkBehaviour.KillOnDestroy)
            .Append(rt.DOScale(targetScale, grow).SetEase(Ease.OutBack))
            .Join(rt.DOLocalRotate(new Vector3(0f, 0f, spin), grow, RotateMode.LocalAxisAdd)
                .SetEase(Ease.OutCubic))
            .Join(DOVirtual.Float(0f, peakAlpha, grow * 0.7f, a =>
            {
                var cc = missSplashGraphic.color;
                cc.a = a;
                missSplashGraphic.color = cc;
            }).SetEase(Ease.OutQuad))
            .Append(DOVirtual.Float(peakAlpha, 0f, fade, a =>
            {
                var cc = missSplashGraphic.color;
                cc.a = a;
                missSplashGraphic.color = cc;
            }).SetEase(Ease.InQuad));
    }

    void PlayImpactSplash(float intensity, float sizeMult, float heat01)
    {
        if (!missSplashGraphic) return;

        DOTween.Kill(missSplashGraphic, false);
        DOTween.Kill(missSplashGraphic.transform, false);

        // Base colour follows the lane-tinted ring colour so it always matches the note.
        var c = missSplashGraphic.color;
        c.r = ringTint.r;
        c.g = ringTint.g;
        c.b = ringTint.b;
        c.a = 0f;
        missSplashGraphic.color = c;

        var rt = missSplashGraphic.rectTransform;
        float baseScale = 0.9f;
        float targetScale = 1.1f * (1f + 0.08f * intensity + 0.06f * heat01) * (0.9f + 0.2f * sizeMult);
        rt.localScale = Vector3.one * baseScale;

        float grow = 0.16f;
        float fade = 0.26f;
        // Stronger so the translucent blur actually reads on bright backgrounds.
        // Good hits land around ~0.45–0.6 alpha, Perfect + high heat can push toward ~0.8.
        float baseAlpha = Mathf.Lerp(0.45f, 0.7f, intensity);
        float peakAlpha = Mathf.Clamp01(baseAlpha * (1f + 0.25f * heat01));
        float spin = 14f + 10f * intensity; // a little more spin on Perfects

        var splashSeq = DOTween.Sequence()
            .SetTarget(missSplashGraphic)
            .SetLink(missSplashGraphic.gameObject, LinkBehaviour.KillOnDestroy)
            .Append(rt.DOScale(targetScale, grow).SetEase(Ease.OutBack))
            .Join(rt.DOLocalRotate(new Vector3(0f, 0f, spin), grow, RotateMode.LocalAxisAdd)
                .SetEase(Ease.OutCubic))
            .Join(DOVirtual.Float(0f, peakAlpha, grow * 0.7f, a =>
            {
                var cc = missSplashGraphic.color;
                cc.a = a;
                missSplashGraphic.color = cc;
            }).SetEase(Ease.OutQuad))
            .Append(DOVirtual.Float(peakAlpha, 0f, fade, a =>
            {
                var cc = missSplashGraphic.color;
                cc.a = a;
                missSplashGraphic.color = cc;
            }).SetEase(Ease.InQuad));
    }


    void DoDotBurst(int count, float sizeMult, float speedMult, float intensity, float sustainMult)
    {
        float ringR = impactRing ? Mathf.Max(0.0001f, impactRing.Radius) : 1f;
        float spread = Mathf.Clamp(burstSpreadDegrees, 0f, 360f);
        float baseDist = ringR * Mathf.Max(0.1f, burstDistanceMultiplier * (0.8f + 0.4f * intensity));
        float life = Mathf.Max(0.05f, (burstDotLifetime / speedMult) * sustainMult);

        for (int i = 0; i < count; i++)
        {
            var dot = GetBurstDot();
            if (!dot) continue;

            // start at center
            dot.transform.localPosition = Vector3.zero;
            dot.transform.localScale = Vector3.one;
            dot.Type = DiscType.Disc;
            dot.RadiusSpace = dotPrefab.RadiusSpace;
            dot.ThicknessSpace = dotPrefab.ThicknessSpace;
            dot.SortingOrder = dotPrefab.SortingOrder > 0 ? dotPrefab.SortingOrder : 22;
            dot.Thickness = 0f;
            dot.Radius = Random.Range(burstDotMinRadius, burstDotMaxRadius) * (0.9f + 0.2f * sizeMult);

            var c = dotTint; c.a = Mathf.Clamp01(dotTint.a * (0.5f + 0.5f * intensity));
            dot.Color = c;

            // angle: uniform across spread, with slight jitter to avoid grid alignment
            float t = (count <= 1) ? 0.5f : (i + 0.5f) / count; // even distribution
            float deg = (spread >= 359.9f)
                ? Random.Range(0f, 360f)
                : (-spread * 0.5f + spread * t + Random.Range(-6f, 6f));
            float rad = deg * Mathf.Deg2Rad;
            Vector3 dir = new Vector3(Mathf.Cos(rad), Mathf.Sin(rad), 0f);
            float dist = baseDist * (0.85f + 0.3f * Random.value);
            Vector3 to = dir * dist;

            // tween position + fade
            var seq = DOTween.Sequence()
                .SetTarget(dot).SetLink(dot.gameObject, LinkBehaviour.KillOnDestroy);

            seq.Join(dot.transform.DOLocalMove(to, life).SetEase(Ease.OutCubic));
            seq.Join(DOVirtual.Float(c.a, 0f, life, a => { var cc = dot.Color; cc.a = a; dot.Color = cc; }).SetEase(Ease.InQuad));
            seq.OnKill(() => ReturnBurstDot(dot, stopTweens: false));
        }
    }

    void PrewarmBurstPool()
    {
        if (!dotPrefab || prewarmBurstCount <= 0) return;
        int need = prewarmBurstCount - _dotPool.Count;
        for (int i = 0; i < need; i++)
        {
            var d = Instantiate(dotPrefab, transform);
            d.name = "DotBurstItem";
            d.enabled = false; d.gameObject.SetActive(false);
            _dotPool.Enqueue(d);
        }
    }

    Disc GetBurstDot()
    {
        Disc d = null;
        while (_dotPool.Count > 0 && !d) { d = _dotPool.Dequeue(); }
        if (!d)
        {
            if (!dotPrefab) return null;
            d = Instantiate(dotPrefab, transform);
            d.name = "DotBurstItem";
        }
        if (d.transform.parent != transform) d.transform.SetParent(transform, false);
        d.gameObject.SetActive(true); d.enabled = true;
        _dotActive.Add(d);
        return d;
    }

    void ReturnBurstDot(Disc d, bool stopTweens = true)
    {
        if (!d) return;
        if (stopTweens)
        {
            DOTween.Kill(d);
            DOTween.Kill(d.transform);
        }
        d.enabled = false;
        d.gameObject.SetActive(false);

        if (_dotRoot != null && !_isDisabling && d.transform.parent != _dotRoot)
        {
            d.transform.SetParent(_dotRoot, false);
        }
        else if (_isDisabling && _dotRoot != null && !_pendingDotReparent.Contains(d))
        {
            _pendingDotReparent.Add(d);
        }

        _dotActive.Remove(d);
        if (_dotPool.Count >= maxBurstPoolSize)
        {
            _pendingDotReparent.Remove(d);
            Destroy(d.gameObject);
        }
        else
        {
            _dotPool.Enqueue(d);
        }
    }

    void FlushPendingDotReparents()
    {
        if (_pendingDotReparent.Count == 0 || !_dotRoot) return;
        for (int i = _pendingDotReparent.Count - 1; i >= 0; i--)
        {
            var dot = _pendingDotReparent[i];
            if (!dot)
            {
                _pendingDotReparent.RemoveAt(i);
                continue;
            }
            dot.transform.SetParent(_dotRoot, false);
            _pendingDotReparent.RemoveAt(i);
        }
    }

    void DisableImpactRing()
    {
        if (!impactRing) return;
        var c = impactRing.Color; c.a = 0f; impactRing.Color = c;
        impactRing.Radius = Mathf.Max(0.0001f, _baseRingRadius);
        impactRing.transform.localScale = Vector3.one;
        impactRing.transform.localRotation = Quaternion.identity;
        impactRing.enabled = false;
    }

    void ResetGhostDisc(Disc disc)
    {
        if (!disc) return;
        var c = disc.Color; c.a = 0f; disc.Color = c;
        disc.Radius = Mathf.Max(0.0001f, _baseRingRadius);
        disc.transform.localScale = Vector3.one;
        disc.transform.localRotation = Quaternion.identity;
        disc.enabled = false;
    }

    // Public: allow director to override dot behaviour without touching theme
    public void ConfigureDotBehaviour(bool? center = null, bool? radial = null)
    {
        if (center.HasValue) useCenterDot = center.Value;
        if (radial.HasValue) enableRadialBurst = radial.Value;
    }
}
