
using System.Collections.Generic;
using UnityEngine;
using DG.Tweening;
using Shapes;
using UnityEngine.Rendering;

[RequireComponent(typeof(Polyline))]
public class WispPolylineTrail : MonoBehaviour
{
    [SerializeField] PerimeterPathProvider path;
    [SerializeField] WispTimelineController wisp;
    [SerializeField, Range(0.2f, 3f)] float trailSeconds = 1.2f;
    [SerializeField, Range(16, 256)] int   maxPoints    = 96;
    [SerializeField] Color trailColor = new(1f, 1f, 1f, 0.9f);

    Polyline line;
    struct P { public Vector2 pos; public float t; }
    readonly List<P> pts = new();

    void Awake()
    {
        line = GetComponent<Polyline>();
        
        line.Closed = false;
        line.ThicknessSpace = ThicknessSpace.Pixels;
        line.Thickness = 3f;
        // Ensure stable draw in UI: ignore depth and sort between outline (0) and fill (10)
        line.ZTest = CompareFunction.Always;
        line.SortingOrder = 5;
    }
    
    

    void LateUpdate()
    {
        if (path == null || wisp == null) return;
        double now = AudioManager.Instance ? AudioManager.Instance.GetAdjustedSongTime() : AudioSettings.dspTime;

        Vector2 a = path.EvaluateAnchoredPosition(wisp.GetNormalizedT(now));
        pts.Add(new P { pos = a, t = (float)now });

        float cutoff = (float)now - trailSeconds;
        while (pts.Count > 0 && pts[0].t < cutoff) pts.RemoveAt(0);
        while (pts.Count > maxPoints) pts.RemoveAt(0);

        var points = new List<PolylinePoint>(pts.Count);
        for (int i = 0; i < pts.Count; i++)
        {
            float age = Mathf.InverseLerp(cutoff, (float)now, pts[i].t); // 0 old → 1 new
            Color c = trailColor; c.a *= Mathf.SmoothStep(0f, 1f, age);
            points.Add(new PolylinePoint(new Vector3(pts[i].pos.x, pts[i].pos.y, 0f), c));
        }
        line.points = points;
    }

    // optional: public API to pulse thickness on beat
    public void Pulse(float mul = 1.3f, float seconds = 0.12f)
    {
        float start = line.Thickness;
        DG.Tweening.DOTween.Kill(line);
        line.Thickness = start * mul;
        DG.Tweening.DOTween.To(() => line.Thickness, v => line.Thickness = v, start, seconds)
            .SetEase(DG.Tweening.Ease.OutQuad).SetTarget(line).SetUpdate(true)
            .SetLink(gameObject, DG.Tweening.LinkBehaviour.KillOnDestroy);
    }
}
