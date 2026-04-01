using UnityEngine;
using DG.Tweening;
using Shapes;

public class NoteVisualDriver : MonoBehaviour
{
    [Header("Timing")]
    public float expectedHitTime;
    private float spawnTime;

    [Header("Shapes parts")]
    public RegularPolygon hexFrame;
    public Disc coreDisc;
    public Disc packetArc; // use Disc component set to Arc type
    public Polyline starTrace;

    [Header("Lane + Accuracy Colors")]
    public Color laneColor = Color.green;
    public Color perfectColor = new Color32(0x62, 0xEF, 0x48, 0xFF);
    public Color goodColor = new Color32(0x6F, 0x37, 0x94, 0xFF);
    public Color missColor = new Color32(0xFF, 0x3C, 0x00, 0xFF);

    void Start()
    {
        spawnTime = ResolveSongTime();

        // Ensure the packet arc uses Arc type (in case not set in prefab)
        if (packetArc != null)
        {
            packetArc.Type = DiscType.Arc;
        }

        ApplyLaneColors();
    }

    void Update()
    {
        double now = ResolveSongTime();
        float t = Mathf.InverseLerp(spawnTime, expectedHitTime, (float)now);

        // Core approach growth
        if (coreDisc != null)
        {
            coreDisc.Radius = Mathf.Lerp(0.12f, 0.20f, t);
            coreDisc.Color = Color.Lerp(laneColor * 0.5f, laneColor, t);
        }

        // Packet arc spin
        if (packetArc != null)
            packetArc.AngRadiansStart += 180f * Mathf.Deg2Rad * Time.deltaTime;
    }

    void ApplyLaneColors()
    {
        if (hexFrame != null)
        {
            hexFrame.Color = laneColor;
        }

        if (packetArc != null)
        {
            packetArc.Color = laneColor * 0.9f;
        }

        if (starTrace != null)
        {
            starTrace.Color = laneColor * 0.8f;
        }
    }

    public void PlayHitFX(string type)
    {
        Color target = type == "Perfect" ? perfectColor :
                       type == "Good" ? goodColor : missColor;

        // kill tweens to avoid stacking
        DOTween.Kill(hexFrame);
        DOTween.Kill(coreDisc);
        DOTween.Kill(packetArc);

        // Tween Colors via property tweens (DOTween has no direct extensions for Shapes components)
        if (hexFrame != null)
            DOTween.To(() => hexFrame.Color, c => hexFrame.Color = c, target, 0.1f).SetTarget(hexFrame);
        if (coreDisc != null)
            DOTween.To(() => coreDisc.Color, c => coreDisc.Color = c, target, 0.1f).SetTarget(coreDisc);
        if (packetArc != null)
        {
            DOTween.To(() => packetArc.Color, c => packetArc.Color = c, target, 0.1f).SetTarget(packetArc);
            DOTween.To(() => packetArc.Color.a,
                       a => { var c = packetArc.Color; c.a = a; packetArc.Color = c; },
                       0f, 0.2f)
                   .SetTarget(packetArc)
                   .OnComplete(() =>
                   {
                       // Keep the note alive if a DiagramManager is actively consuming hit notes.
                       if (DiagramManager.Instance == null)
                       {
                           gameObject.SetActive(false);
                       }
                   });
        }
    }
      public float GetTimingDifference()
{
    double now = ResolveSongTime();
    return (float)(now - expectedHitTime);
}

    private float ResolveSongTime()
    {
        if (AudioManager.Instance != null)
        {
            return (float)AudioManager.Instance.GetAdjustedSongTime();
        }

        // Fallback so the driver doesn't null-ref in scenes where AudioManager isn't active.
        return Time.unscaledTime;
    }

}
