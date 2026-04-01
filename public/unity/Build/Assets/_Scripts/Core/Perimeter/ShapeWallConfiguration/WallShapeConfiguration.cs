using UnityEngine;

[CreateAssetMenu(fileName = "Data", menuName = "ScriptableObjects/WallShapeConfigurationObject", order = 1)]
public class WallShapeConfiguration : ScriptableObject
{
	public GameObject[] wallPrefabs;
	public GameObject wallsTransformsPrefab;
	public WallGenerator.WallType[] wallTypes;
	public float targetCurvedWallArcDegrees = 180f;
	public float curvedWallInnerRadius = 5f;
	public float curvedWallHeight = 3f;
	public float curvedWallGenerationSpeed = 0.25f;
}
