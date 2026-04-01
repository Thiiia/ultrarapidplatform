using System;
using System.Collections.Generic;
using UnityEngine;
using Shapes;

[DefaultExecutionOrder(-5)]
public class PerimeterPathProvider : MonoBehaviour
{
    [Header("Diagram")]
    [SerializeField] private DiagramManager diagram;   // assign in Inspector

    public struct SegmentInfo
    {
        public string id;
        public enum Kind { Line, Arc }
        public Kind kind;

        // world-space caches
        public Transform xf;
        public Vector3 lineStartWS, lineEndWS;  // if Line
        public Vector3 arcCenterWS;             // if Disc (arc)
        public float arcRadiusLocal;            // local radius (Shapes)
        public float arcRadiusWorld;            // world radius (scaled)
        public float arcStartRadLocal;          // local radians
        public float arcEndRadLocal;
        public float length;                    // world length
        public float accumStart;                // cumulative distance at start
        public float accumEnd;                  // start + length
        public bool clockwise;                  // arc direction
        public float arcSweepRad;
    }

    public IReadOnlyList<SegmentInfo> Segments => _segments;
    private readonly List<SegmentInfo> _segments = new List<SegmentInfo>();

    private float _totalLength;
    private RectTransform _referenceRect;
    private Canvas _canvas;
    private Camera _uiCam;
    private float _planeZ;
    private bool _loggedMissingSegments;

    public float TotalLength => _totalLength;
    public RectTransform ReferenceRect => _referenceRect;
    public float PlaneZ => _planeZ;
    [Header("Reference")]
    [SerializeField] private RectTransform referenceRoot;

    void Reset() { TryAutoAssign(); }
    void Awake()
    {
        TryAutoAssign();
        if (HasDiagramSegments())
        {
            RebuildCache();
        }
    }
    void OnEnable()
    {
        GameplayEventBus.OnPerimeterShapeChanged += HandlePerimeterShapeChanged;
        ChartSystem.OnChartInitialized += OnChartHotReload;
        if (HasDiagramSegments())
        {
            RebuildCache();
        }
    }
    void OnDisable()
    {
        GameplayEventBus.OnPerimeterShapeChanged -= HandlePerimeterShapeChanged;
        ChartSystem.OnChartInitialized -= OnChartHotReload;
    }
    void OnChartHotReload()
    {
        // In Wisp/global-fill mode the DiagramManager intentionally zeroes the live fill shapes.
        // Rebuilding from those at this moment would collapse segment lengths to ~0 and break coverage math.
        // Keep using the authored-geometry cache captured earlier.
        if (diagram != null && ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter)
            return;

        if (HasDiagramSegments())
        {
            RebuildCache();
        }
    }

    void TryAutoAssign()
    {
        if (!diagram) diagram = GetComponent<DiagramManager>();
        if (!diagram) diagram = GetComponentInParent<DiagramManager>();
#if UNITY_2023_1_OR_NEWER
        if (!diagram) diagram = UnityEngine.Object.FindAnyObjectByType<DiagramManager>();
#else
        if (!diagram) diagram = UnityEngine.Object.FindFirstObjectByType<DiagramManager>();
#endif
        CacheReferenceRect();
    }

    public void RebuildCache()
    {
        CacheReferenceRect();
        _planeZ = _referenceRect ? _referenceRect.position.z : transform.position.z;

        if (!HasDiagramSegments())
        {
            if (!_loggedMissingSegments)
            {
                Debug.LogWarning("[PerimeterPathProvider] Diagram or perimeterSegments missing/empty -- using last cached path.");
                _loggedMissingSegments = true;
            }
            return;
        }

        _loggedMissingSegments = false;
        _segments.Clear();
        _totalLength = 0f;

        foreach (var ps in diagram.perimeterSegments)
        {
            if (ps.shape == null) continue;

            if (ps.shape is Line line)
            {
                var si = new SegmentInfo
                {
                    id = ps.id,
                    kind = SegmentInfo.Kind.Line,
                    xf = line.transform
                };

                RectTransform segmentRect = line.transform as RectTransform;
                if (segmentRect == null || _referenceRect == null) continue;

                // segment local â†’ world â†’ referenceRoot local (UI pixels)
                Vector3 startWorld = segmentRect.TransformPoint(line.Start);
                Vector3 endWorld = segmentRect.TransformPoint(line.End);
                Vector3 startLocal = _referenceRect.InverseTransformPoint(startWorld);
                Vector3 endLocal = _referenceRect.InverseTransformPoint(endWorld);

                si.lineStartWS = new Vector3(startLocal.x, startLocal.y, 0f);
                si.lineEndWS = new Vector3(endLocal.x, endLocal.y, 0f);

                si.length = Vector2.Distance((Vector2)si.lineStartWS, (Vector2)si.lineEndWS);
                si.accumStart = _totalLength;
                si.accumEnd = _totalLength + si.length;
                _totalLength = si.accumEnd;

                _segments.Add(si);
            }


            else if (ps.shape is Disc disc)
            {
                var si = new SegmentInfo
                {
                    id = ps.id,
                    kind = SegmentInfo.Kind.Arc,
                    xf = disc.transform,
                    arcStartRadLocal = disc.AngRadiansStart,
                    arcEndRadLocal = disc.AngRadiansEnd
                };

                RectTransform discRect = disc.transform as RectTransform;
                if (discRect == null || _referenceRect == null) continue;

                // Center in referenceRoot local
                Vector3 centerWorld = discRect.TransformPoint(Vector3.zero);
                Vector3 centerLocal = _referenceRect.InverseTransformPoint(centerWorld);
                si.arcCenterWS = new Vector3(centerLocal.x, centerLocal.y, 0f);

                // Robust radius in referenceRoot units: measure transformed sample point instead of scale ratio
                si.arcRadiusLocal = disc.Radius;
                Vector3 sampleWorld = discRect.TransformPoint(new Vector3(disc.Radius, 0f, 0f));
                Vector3 sampleLocal = _referenceRect.InverseTransformPoint(sampleWorld);
                si.arcRadiusWorld = Vector2.Distance(new Vector2(centerLocal.x, centerLocal.y), new Vector2(sampleLocal.x, sampleLocal.y));

                // compute short sweep and direction
                float shortDeg = Mathf.DeltaAngle(si.arcStartRadLocal * Mathf.Rad2Deg,
                                                  si.arcEndRadLocal * Mathf.Rad2Deg);
                si.arcSweepRad = shortDeg * Mathf.Deg2Rad;
                si.clockwise = si.arcSweepRad < 0f;

                si.length = Mathf.Abs(si.arcSweepRad) * si.arcRadiusWorld;
                si.accumStart = _totalLength;
                si.accumEnd = _totalLength + si.length;
                _totalLength = si.accumEnd;

                _segments.Add(si);
            }

        }
        if (_segments.Count >= 2)
        {
            // 4a) Make starts connect to previous ends (transform-aware)
            for (int i = 0; i < _segments.Count; i++)
            {
                int prevIdx = (i - 1 + _segments.Count) % _segments.Count;
                var prevEnd = EndPointRef(_segments[prevIdx]);

                var si = _segments[i];
                var start = StartPointRef(si);
                var end = EndPointRef(si);

                if ((prevEnd - start).sqrMagnitude > (prevEnd - end).sqrMagnitude)
                {
                    SwapOrientation(ref si);
                }

                // 4b) For arcs, pick SHORT vs LONG sweep sign that best matches previous tangent (transform-aware)
                if (si.kind == SegmentInfo.Kind.Arc)
                {
                    var prevTan = SegmentEndTangentRef(_segments[prevIdx]);

                    float shortSweep = si.arcSweepRad; // current (short) choice (DeltaAngle-based)
                    float longSweep = -Mathf.Sign(shortSweep) * (Mathf.PI * 2f - Mathf.Abs(shortSweep));

                    var tanShort = ArcTangentAtStartRef(si, shortSweep);
                    var tanLong = ArcTangentAtStartRef(si, longSweep);

                    float shortScore = Vector2.Dot(prevTan, tanShort);
                    float longScore  = Vector2.Dot(prevTan, tanLong);

                    // Prefer the shorter arc by default. Only pick the long sweep if the short one is > 180°
                    // and the alignment is strictly better.
                    bool preferShort = Mathf.Abs(shortSweep) <= Mathf.PI + 1e-4f;
                    if (preferShort)
                        si.arcSweepRad = shortSweep;
                    else
                        si.arcSweepRad = (longScore > shortScore) ? longSweep : shortSweep;

                    si.clockwise = si.arcSweepRad < 0f;
                    si.length = Mathf.Abs(si.arcSweepRad) * si.arcRadiusWorld;
                }

                _segments[i] = si;
            }

            // 4c) Recompute cumulative distances
            _totalLength = 0f;
            for (int i = 0; i < _segments.Count; i++)
            {
                var si = _segments[i];
                si.accumStart = _totalLength;
                si.accumEnd = _totalLength + si.length;
                _segments[i] = si;
                _totalLength = si.accumEnd;
            }
        }


    }

    // t in [0..1] along whole perimeter
    public Vector3 EvaluatePosition(float t01)
    {
        if (_segments.Count == 0) return transform.position;
        float target = Mathf.Repeat(t01, 1f) * _totalLength;
        GetSegAndLocal(target, out SegmentInfo si, out float u);
        return EvaluateSegmentPosition(si, u);
    }

    // Direction-aware evaluation: dirSign = +1 (CW) or -1 (CCW)
    public Vector3 EvaluatePosition(float t01, int dirSign)
    {
        float t = Mathf.Repeat(t01, 1f);
        if (dirSign < 0) t = Mathf.Repeat(1f - t, 1f);
        return EvaluatePosition(t);
    }

    public Vector3 EvaluateTangent(float t01)
    {
        if (_segments.Count == 0) return Vector3.right;
        float target = Mathf.Repeat(t01, 1f) * _totalLength;
        GetSegAndLocal(target, out SegmentInfo si, out float u);
        return EvaluateSegmentTangentTransformed(si, u);
    }

    public Vector3 EvaluateTangent(float t01, int dirSign)
    {
        float t = Mathf.Repeat(t01, 1f);
        if (dirSign < 0)
        {
            // reverse parametrization: tangent flips sign
            return -EvaluateTangent(1f - t);
        }
        return EvaluateTangent(t);
    }

    public int GetSegmentIndex(float t01)
    {
        if (_segments.Count == 0) return 0;
        float target = Mathf.Repeat(t01, 1f) * _totalLength;
        for (int i = 0; i < _segments.Count; i++)
            if (target >= _segments[i].accumStart && target <= _segments[i].accumEnd)
                return i;
        return _segments.Count - 1;
    }

    // ---------------- UI helpers (pixel-space / anchored) ----------------

    /// Evaluate and return an anchored-position (local to ReferenceRect).
    public Vector2 EvaluateAnchoredPosition(float t01)
    {
        var p = EvaluatePosition(t01); // already in referenceRoot local UI space
        return new Vector2(p.x, p.y);
    }

    public Vector2 EvaluateAnchoredPosition(float t01, int dirSign)
    {
        var p = EvaluatePosition(t01, dirSign);
        return new Vector2(p.x, p.y);
    }


    public Vector2 WorldToAnchored(Vector3 world)
    {
        if (!_referenceRect)
            return Vector2.zero;

        // project world â†’ local relative to the Diagram Manager rect
        Vector3 local = _referenceRect.InverseTransformPoint(world);
        return new Vector2(local.x, local.y);
    }

    public Vector3 FlattenToPlane(Vector3 world) => ApplyPlane(world);

    public Vector3 WorldToReferenceLocal(Vector3 world)
    {
        if (!_referenceRect) return ApplyPlane(world);
        world = ApplyPlane(world);
        var local3 = _referenceRect.InverseTransformPoint(world);
        local3.z = 0f;
        return local3;
    }

    public Vector3 ReferenceLocalToWorld(Vector3 local)
    {
        if (!_referenceRect) return ApplyPlane(local);
        local.z = 0f;
        var world = _referenceRect.TransformPoint(local);
        return ApplyPlane(world);
    }

    void CacheReferenceRect()
    {
        // Choose the UI root weâ€™ll measure against (Perimeter)
        if (!referenceRoot)
        {
            // if this component lives on Diagram Manager, use its parent as default
            var rtSelf = GetComponent<RectTransform>();
            referenceRoot = rtSelf ? rtSelf.parent as RectTransform : null;

            // final fallback: diagramâ€™s parent
            if (!referenceRoot && diagram)
                referenceRoot = diagram.GetComponent<RectTransform>()?.parent as RectTransform;
        }

        _referenceRect = referenceRoot;
        if (_referenceRect == null)
            Debug.LogWarning("[PerimeterPathProvider] ReferenceRoot not set. Assign the 'Perimeter' RectTransform.");

        // Canvas/camera info is optional here
        _canvas = _referenceRect ? _referenceRect.GetComponentInParent<Canvas>() : null;
        _uiCam = (_canvas && _canvas.renderMode == RenderMode.ScreenSpaceCamera) ? _canvas.worldCamera : null;

        // In UI/anchored space we keep Z at 0
        _planeZ = 0f;
    }

    bool HasDiagramSegments()
    {
        return diagram != null &&
               diagram.perimeterSegments != null &&
               diagram.perimeterSegments.Length > 0;
    }

    void HandlePerimeterShapeChanged(GameObject perimeterInstance)
    {
        TryAssignDiagramFrom(perimeterInstance);
        // Path cache is rebuilt from DiagramManager.Initialize once perimeterSegments have been updated.
    }

    void TryAssignDiagramFrom(GameObject perimeterInstance)
    {
        if (!perimeterInstance) return;
        if (diagram && diagram.gameObject == perimeterInstance)
            return;

        var diag = perimeterInstance.GetComponentInParent<DiagramManager>() ??
                   perimeterInstance.GetComponent<DiagramManager>();
        if (diag)
        {
            diagram = diag;
            CacheReferenceRect();
        }
    }


    // ---------------- internals ----------------

    void GetSegAndLocal(float s, out SegmentInfo si, out float u)
    {
        for (int i = 0; i < _segments.Count; i++)
        {
            si = _segments[i];
            if (s <= si.accumEnd)
            {
                float segS = Mathf.Clamp(s - si.accumStart, 0, si.length);
                u = si.length <= 0.0001f ? 0f : segS / si.length;
                return;
            }
        }
        si = _segments[_segments.Count - 1]; u = 1f;
    }

    Vector3 EvaluateSegmentPosition(SegmentInfo si, float u)
    {
        if (si.kind == SegmentInfo.Kind.Line)
        {
            var pos = Vector3.Lerp(si.lineStartWS, si.lineEndWS, u);
            return new Vector3(pos.x, pos.y, 0f);
        }
        else
        {
            // use cached sweep
            float a0 = si.arcStartRadLocal;
            float ang = a0 + si.arcSweepRad * u;

            // respect disc transform when converting angle to reference space
            Vector3 dirLocal = new Vector3(Mathf.Cos(ang), Mathf.Sin(ang), 0f);
            Vector3 dirWorld = si.xf ? si.xf.TransformDirection(dirLocal) : dirLocal;
            Vector3 dirRef = _referenceRect ? _referenceRect.InverseTransformDirection(dirWorld) : dirWorld;
            dirRef.z = 0f;
            if (dirRef.sqrMagnitude > 1e-6f) dirRef.Normalize();
            Vector3 pos2 = si.arcCenterWS + dirRef * si.arcRadiusWorld;
            return new Vector3(pos2.x, pos2.y, 0f);
        }
    }

    // Tangent that respects the Disc transform when the segment is an arc
    Vector3 EvaluateSegmentTangentTransformed(SegmentInfo si, float u)
    {
        if (si.kind == SegmentInfo.Kind.Line)
        {
            var v = si.lineEndWS - si.lineStartWS;
            v.z = 0f;
            return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.right;
        }
        else
        {
            float a0 = si.arcStartRadLocal;
            float ang = a0 + si.arcSweepRad * u;
            float d = Mathf.Sign(si.arcSweepRad);

            Vector3 tanLocal = new Vector3(-Mathf.Sin(ang) * d, Mathf.Cos(ang) * d, 0f);
            Vector3 tanWorld = si.xf ? si.xf.TransformDirection(tanLocal) : tanLocal;
            Vector3 tanRef = _referenceRect ? _referenceRect.InverseTransformDirection(tanWorld) : tanWorld;
            tanRef.z = 0f;
            return tanRef.sqrMagnitude > 1e-6f ? tanRef.normalized : Vector3.right;
        }
    }

    Vector3 EvaluateSegmentTangent(SegmentInfo si, float u)
    {
        if (si.kind == SegmentInfo.Kind.Line)
        {
            var v = si.lineEndWS - si.lineStartWS;
            v.z = 0f;
            return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.right;
        }
        else
        {
            float a0 = si.arcStartRadLocal;
            float ang = a0 + si.arcSweepRad * u;
            float dir = Mathf.Sign(si.arcSweepRad); // +CCW, â€“CW

            var t2 = new Vector2(-Mathf.Sin(ang) * dir, Mathf.Cos(ang) * dir);
            return new Vector3(t2.x, t2.y, 0f).normalized;
        }
    }


    // Transform-aware helpers used when reconciling arc orientation
    Vector2 StartPointRef(in SegmentInfo si)
    {
        if (si.kind == SegmentInfo.Kind.Line)
            return new Vector2(si.lineStartWS.x, si.lineStartWS.y);
        float ang = si.arcStartRadLocal;
        Vector3 dirLocal = new Vector3(Mathf.Cos(ang), Mathf.Sin(ang), 0f);
        Vector3 dirWorld = si.xf ? si.xf.TransformDirection(dirLocal) : dirLocal;
        Vector3 dirRef = _referenceRect ? _referenceRect.InverseTransformDirection(dirWorld) : dirWorld;
        dirRef.z = 0f; if (dirRef.sqrMagnitude > 1e-6f) dirRef.Normalize();
        Vector3 p = si.arcCenterWS + dirRef * si.arcRadiusWorld;
        return new Vector2(p.x, p.y);
    }

    Vector2 EndPointRef(in SegmentInfo si)
    {
        if (si.kind == SegmentInfo.Kind.Line)
            return new Vector2(si.lineEndWS.x, si.lineEndWS.y);
        float end = si.arcStartRadLocal + si.arcSweepRad;
        Vector3 dirLocal = new Vector3(Mathf.Cos(end), Mathf.Sin(end), 0f);
        Vector3 dirWorld = si.xf ? si.xf.TransformDirection(dirLocal) : dirLocal;
        Vector3 dirRef = _referenceRect ? _referenceRect.InverseTransformDirection(dirWorld) : dirWorld;
        dirRef.z = 0f; if (dirRef.sqrMagnitude > 1e-6f) dirRef.Normalize();
        Vector3 p = si.arcCenterWS + dirRef * si.arcRadiusWorld;
        return new Vector2(p.x, p.y);
    }

    Vector2 ArcTangentAtStartRef(in SegmentInfo si, float sweepRad)
    {
        float a0 = si.arcStartRadLocal;
        float d = Mathf.Sign(sweepRad);
        Vector3 tanLocal = new Vector3(-Mathf.Sin(a0) * d, Mathf.Cos(a0) * d, 0f);
        Vector3 tanWorld = si.xf ? si.xf.TransformDirection(tanLocal) : tanLocal;
        Vector3 tanRef = _referenceRect ? _referenceRect.InverseTransformDirection(tanWorld) : tanWorld;
        return new Vector2(tanRef.x, tanRef.y).normalized;
    }

    Vector2 SegmentEndTangentRef(in SegmentInfo prev)
    {
        if (prev.kind == SegmentInfo.Kind.Line)
            return LineTangentAtEnd(prev);
        float a1 = prev.arcStartRadLocal + prev.arcSweepRad;
        float d = Mathf.Sign(prev.arcSweepRad);
        Vector3 tanLocal = new Vector3(-Mathf.Sin(a1) * d, Mathf.Cos(a1) * d, 0f);
        Vector3 tanWorld = prev.xf ? prev.xf.TransformDirection(tanLocal) : tanLocal;
        Vector3 tanRef = _referenceRect ? _referenceRect.InverseTransformDirection(tanWorld) : tanWorld;
        return new Vector2(tanRef.x, tanRef.y).normalized;
    }

    Vector3 ApplyPlane(Vector3 world) { world.z = _planeZ; return world; }

    // -----------------------------------------------------------------------------
    // Centroid helpers 
    // -----------------------------------------------------------------------------
    public Vector3 ComputeCentroid(int samples = 36)
    {
        // Safe defaults
        if (_segments == null || _segments.Count == 0)
            return transform.position;

        samples = Mathf.Max(3, samples);

        Vector3 sum = Vector3.zero;
        for (int i = 0; i < samples; i++)
        {
            // uniform sampling over the normalized perimeter [0..1]
            float t = (i + 0.5f) / samples;
            sum += EvaluatePosition(t);   // already flattened to our diagram plane
        }

        Vector3 c = sum / samples;
        return ApplyPlane(c);
    }
    Vector2 StartPoint(in SegmentInfo si)
    {
        if (si.kind == SegmentInfo.Kind.Line)
            return new Vector2(si.lineStartWS.x, si.lineStartWS.y);

        float x = si.arcCenterWS.x + Mathf.Cos(si.arcStartRadLocal) * si.arcRadiusWorld;
        float y = si.arcCenterWS.y + Mathf.Sin(si.arcStartRadLocal) * si.arcRadiusWorld;
        return new Vector2(x, y);
    }

    Vector2 EndPoint(in SegmentInfo si)
    {
        if (si.kind == SegmentInfo.Kind.Line)
            return new Vector2(si.lineEndWS.x, si.lineEndWS.y);

        float end = si.arcStartRadLocal + si.arcSweepRad; // use chosen sweep
        float x = si.arcCenterWS.x + Mathf.Cos(end) * si.arcRadiusWorld;
        float y = si.arcCenterWS.y + Mathf.Sin(end) * si.arcRadiusWorld;
        return new Vector2(x, y);
    }

    Vector2 LineTangentAtEnd(in SegmentInfo si)
    {
        var v = new Vector2(si.lineEndWS.x - si.lineStartWS.x,
                            si.lineEndWS.y - si.lineStartWS.y);
        return v.sqrMagnitude > 1e-6f ? v.normalized : Vector2.right;
    }

    // Tangent at u=0 (start) for an arc with a specific sweep
    Vector2 ArcTangentAtStart(in SegmentInfo si, float sweepRad)
    {
        float a0 = si.arcStartRadLocal;
        float dir = Mathf.Sign(sweepRad); // +CCW, â€“CW
        return new Vector2(-Mathf.Sin(a0) * dir, Mathf.Cos(a0) * dir).normalized;
    }

    Vector2 SegmentEndTangent(in SegmentInfo prev)
    {
        if (prev.kind == SegmentInfo.Kind.Line)
            return LineTangentAtEnd(prev);

        // arc tangent at u=1 (end) = tangent at angle a0+sweep
        float a1 = prev.arcStartRadLocal + prev.arcSweepRad;
        float dir = Mathf.Sign(prev.arcSweepRad);
        return new Vector2(-Mathf.Sin(a1) * dir, Mathf.Cos(a1) * dir).normalized;
    }

    void SwapOrientation(ref SegmentInfo si)
    {
        if (si.kind == SegmentInfo.Kind.Line)
        {
            (si.lineStartWS, si.lineEndWS) = (si.lineEndWS, si.lineStartWS);
            // length doesnâ€™t change for lines
        }
        else
        {
            // flip arc start/end AND sweep
            (si.arcStartRadLocal, si.arcEndRadLocal) = (si.arcEndRadLocal, si.arcStartRadLocal);
            si.arcSweepRad = -si.arcSweepRad;
            si.clockwise = !si.clockwise;
        }
    }



#if UNITY_EDITOR
    private void OnDrawGizmosSelected()
    {
        if (_segments == null || _segments.Count == 0) return;

        Gizmos.color = Color.cyan;
        Vector3 prev = EvaluatePosition(0f);
        for (int i = 1; i <= 128; i++)
        {
            float t = i / 128f;
            Vector3 p = EvaluatePosition(t);
            Gizmos.DrawLine(prev, p);
            prev = p;
        }

        // show centroid plane
        Vector3 mid = EvaluatePosition(0.5f);
        Gizmos.color = Color.magenta;
        Gizmos.DrawWireSphere(mid, 10f);
    }
#endif



}
