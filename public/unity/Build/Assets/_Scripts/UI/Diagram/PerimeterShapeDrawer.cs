using UnityEngine;
using Shapes;
using System.Collections.Generic;

public class PerimeterShapeDrawer : ImmediateModeShapeDrawer
{
    public static PerimeterShapeDrawer Instance;
    public List<DiagramSegment> segments;

    private void Awake()
    {
        Instance = this;
    }

    public override void DrawShapes(Camera cam)
    {
        using (Draw.Command(cam))
        {
            foreach (var segment in segments)
            {
                if (!segment.isVisible) continue;
                Draw.Line(segment.startPoint, segment.endPoint, 0.1f, segment.color);
            }
        }
    }

    public void RevealNextSegment(SegmentType type)
    {
        foreach (var segment in segments)
        {
            if (!segment.isVisible && segment.type == type)
            {
                segment.isVisible = true;
                break; // reveal one per hit
            }
        }
    }

    public void ResetDiagram()
    {
        foreach (var segment in segments)
        {
            segment.isVisible = false;
        }
    }
}
