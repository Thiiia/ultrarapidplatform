using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public enum SegmentType { Horizontal, Vertical, Diagonal, Curved, Special }

[System.Serializable]
public class DiagramSegment {
    public SegmentType type;
    public Vector3 startPoint;
    public Vector3 endPoint;
    public Color color;
    public bool isVisible = false; // revealed by note hits
}

