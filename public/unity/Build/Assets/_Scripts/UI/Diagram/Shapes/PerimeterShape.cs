using UnityEngine;

public class PerimeterShape : MonoBehaviour
{
	[SerializeField] private DiagramManager.PerimeterSegment[] perimeterSegments;
	[SerializeField, Tooltip("If enabled, hits from any lane color can advance this perimeter's segments (ignores laneColor matching).")]
	private bool acceptAnyLaneHits = false;

	public DiagramManager.PerimeterSegment[] GetPerimeterSegments()
	{
		return perimeterSegments;
	}

	public bool AcceptAnyLaneHits => acceptAnyLaneHits;
}
