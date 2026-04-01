using System;
using System.Collections.Generic;

using UnityEngine;

public class WallGenerator : MonoBehaviour
{
	public enum WallType
	{
		STRAIGHT,
		CURVED
	}

	[SerializeField] private WallShapeConfiguration[] wallShapeConfigurations;
	[SerializeField] private GameObject wallsContainer;

	[Header("Modifiable Settings")]
	[SerializeField] private float wallGenerationSpeedMultiplier = 100f;
	[SerializeField] private float wallGenerationSpeed = 50f;
	[SerializeField] private float curvedWallGenerationSpeed = 0.0001f;
	[SerializeField] private float maxWallSizeMultiplier = 100f;
	[SerializeField] private float targetCurvedWallArcDegrees = 180f;

	private List<CurvedWallGenerator> curvedWallGenerators = new List<CurvedWallGenerator>();
	private GameObject[] wallInstances;
	private int currentCurvedWallIndex = 0;
	private int currentWallIndex = 0;
	private bool progressWalls = false;
	private bool wallsStarted = false;
	private bool wallsCompleted = false;
	private int currentShapeIndex = 0;
	private float wallPerimeterLength = 0f;
	private WallShapeConfiguration wallShapeConfig = null;
	private Transform[] segmentTransforms;
	private GameObject currentTransformsRoot;
	private readonly List<GameObject> spawnedWalls = new List<GameObject>();

	private void OnEnable()
	{
		GameplayEventBus.WallGenerationStarted += HandleWallGenerationStartedBroadcast;
		GameplayEventBus.OnPerimeterShapeChanged += InitializeWalls;
		GameplayEventBus.BeatResolved += HandleBeatResolved;
		GameplayEventBus.OnNotesSpawned += SetWallGenerationSpeed;
		GameplayEventBus.OnPerimeterComplete += HandlePerimeterComplete;
	}

	private void OnDisable()
	{
		GameplayEventBus.WallGenerationStarted -= HandleWallGenerationStartedBroadcast;
		GameplayEventBus.OnPerimeterShapeChanged -= InitializeWalls;
		GameplayEventBus.BeatResolved -= HandleBeatResolved;
		GameplayEventBus.OnNotesSpawned -= SetWallGenerationSpeed;
		GameplayEventBus.OnPerimeterComplete -= HandlePerimeterComplete;
	}

	private void Start()
	{
		currentShapeIndex = (int)GameplayEventBus.currentShape - 1;
	}

	private void InitializeWalls(GameObject currentShapeInstance)
	{
		ResetWallState();

		if (wallShapeConfigurations == null || wallShapeConfigurations.Length == 0)
			return;

		currentShapeIndex = Mathf.Clamp((int)GameplayEventBus.currentShape - 1, 0, wallShapeConfigurations.Length - 1);
		wallShapeConfig = wallShapeConfigurations[currentShapeIndex];
		if (wallShapeConfig == null)
			return;

		// Align curved-wall completion target with this shape's configuration.
		targetCurvedWallArcDegrees = wallShapeConfig.targetCurvedWallArcDegrees;

		GameObject wallsTransformObject = Instantiate(wallShapeConfig.wallsTransformsPrefab);
		wallsTransformObject.transform.parent = transform;
		currentTransformsRoot = wallsTransformObject;
		WallTransforms wallTransforms = wallsTransformObject.GetComponent<WallTransforms>();

		if (wallTransforms)
		{
			segmentTransforms = wallTransforms.wallTransforms;
		}

		if (segmentTransforms.Length <= 0 || segmentTransforms.Length != wallShapeConfig.wallPrefabs.Length)
		{
			Debug.LogWarning("[WallGenerator] No transforms found in wallsTransformsPrefab.");
			return;
		}

		wallInstances = new GameObject[wallShapeConfig.wallPrefabs.Length];

		for (int i = 0; i < wallShapeConfig.wallPrefabs.Length; i++)
		{
			CurvedWallGenerator curvedWallGenerator = wallShapeConfig.wallPrefabs[i].transform.GetComponentInChildren<CurvedWallGenerator>();

			if (segmentTransforms[i])
			{
				if (curvedWallGenerator)
				{
					wallShapeConfig.wallTypes[i] = WallType.CURVED;
					wallInstances[i] = Instantiate(wallShapeConfig.wallPrefabs[i], segmentTransforms[i].position, segmentTransforms[i].rotation);
					CurvedWallGenerator curvedWallGeneratorInstant = wallInstances[i].GetComponentInChildren<CurvedWallGenerator>();
					curvedWallGenerationSpeed = wallShapeConfig.curvedWallGenerationSpeed;

					if (curvedWallGeneratorInstant)
					{
						curvedWallGeneratorInstant.InitializeCurvedWall();
						curvedWallGeneratorInstant.SetInnerRadiusAndHeight(wallShapeConfig.curvedWallInnerRadius, wallShapeConfig.curvedWallHeight);
						curvedWallGenerator.SetArcDegrees(1f);
						curvedWallGenerators.Add(curvedWallGeneratorInstant);

						// Approximate half-circle arc length for perimeter scaling.
						wallPerimeterLength += wallShapeConfig.curvedWallInnerRadius * Mathf.PI;
					}
				}
				else
				{
					wallShapeConfig.wallTypes[i] = WallType.STRAIGHT;
					wallInstances[i] = Instantiate(wallShapeConfig.wallPrefabs[i], segmentTransforms[i].position, Quaternion.identity);
					wallInstances[i].transform.rotation = Quaternion.LookRotation(segmentTransforms[(i + 1) % segmentTransforms.Length].position - segmentTransforms[i].position);

					wallPerimeterLength += Vector3.Distance(segmentTransforms[i].position, segmentTransforms[(i + 1) % segmentTransforms.Length].position);
				}
			}

			if (wallsContainer)
			{
				wallInstances[i].transform.parent = wallsContainer.transform;
			}
			spawnedWalls.Add(wallInstances[i]);

			if (i != 0)
			{
				wallInstances[i].gameObject.SetActive(false);
			}
		}
	}

	private void SetWallGenerationSpeed(int totalNotes)
	{
		// Prefer per-shape quotas (how many hits this shape expects) over raw chart note count.
		int shapeHits = totalNotes;
		var diagram = DiagramManager.Instance;
		if (diagram != null && diagram.CurrentShapeRequiredHitsTotal > 0)
		{
			shapeHits = diagram.CurrentShapeRequiredHitsTotal;
		}

		shapeHits = Mathf.Max(1, shapeHits);

		// Original growth model, but using per-shape hit count so the wall roughly
		// finishes once the diagram segments have reached their quotas.
		wallGenerationSpeed = curvedWallGenerationSpeed = wallGenerationSpeedMultiplier * (wallPerimeterLength / shapeHits);

		Debug.Log("[WallGenerator] Wall Generation Started. Wall Perimeter Length: " + wallPerimeterLength +
		          ", shapeHits " + shapeHits + ", wallGenerationSpeed " + wallGenerationSpeed);
	}

	private void TriggerWallGeneration()
	{
		if (!progressWalls)
		{
			return;
		}

		ProgressWalls();
	}

	private void StartWallGeneration(bool broadcast)
	{
		if (wallsStarted)
		{
			return;
		}

		wallsStarted = true;
		wallsCompleted = false;
		progressWalls = true;

		if (broadcast)
		{
			GameplayEventBus.RaiseWallGenerationStarted();
		}
	}

	private void HandleBeatResolved(BeatPayload payload, HitResult result)
	{
		TriggerWallGeneration();
	}

	private void ProgressWalls()
	{
		if (currentWallIndex >= wallInstances.Length)
		{
			return;
		}

		if (wallShapeConfig.wallTypes[currentWallIndex] == WallType.CURVED)
		{
			ProgressCurvedWall();
		}
		else
		{
			ProgressStraightWall();
		}
	}
	private void ResetWallState()
	{
		wallPerimeterLength = 0f;
		currentWallIndex = 0;
		currentCurvedWallIndex = 0;
		progressWalls = false;
		wallsStarted = false;
		wallsCompleted = false;
		curvedWallGenerators.Clear();

		foreach (var wall in spawnedWalls)
		{
			if (wall)
				Destroy(wall);
		}
		spawnedWalls.Clear();

		if (wallInstances != null)
		{
			for (int i = 0; i < wallInstances.Length; i++)
			{
				if (wallInstances[i])
					Destroy(wallInstances[i]);
			}
		}
		wallInstances = null;

		if (currentTransformsRoot)
		{
			Destroy(currentTransformsRoot);
			currentTransformsRoot = null;
		}
		segmentTransforms = System.Array.Empty<Transform>();
	}

	private void ProgressStraightWall()
	{
		int nextWallIndex = currentWallIndex < wallInstances.Length - 1 ? currentWallIndex + 1 : 0;

		if (segmentTransforms[currentWallIndex])
		{
			float maxCurrentWallSize = maxWallSizeMultiplier * Vector3.Distance(
				segmentTransforms[currentWallIndex].position,
				segmentTransforms[nextWallIndex].position);
			float currentWallLength = wallInstances[currentWallIndex].transform.localScale.z;

			if (maxCurrentWallSize - currentWallLength <= 0.1f)
			{
				currentWallIndex++;

				if (currentWallIndex < wallInstances.Length)
				{
					wallInstances[currentWallIndex].gameObject.SetActive(true);
				}
				else
				{
					CompleteWallGeneration();
				}

				GameplayEventBus.RaiseWallSectionCompleted(currentWallIndex);
			}
			else
			{
				currentWallLength += wallGenerationSpeed * wallPerimeterLength;
				wallInstances[currentWallIndex].transform.localScale = new Vector3(1, 1, currentWallLength);
			}
		}
	}

	private void ProgressCurvedWall()
	{
		if (currentCurvedWallIndex >= curvedWallGenerators.Count)
		{
			return;
		}

		CurvedWallGenerator currentCurvedWall = curvedWallGenerators[currentCurvedWallIndex];

		if (currentCurvedWall)
		{
			if (targetCurvedWallArcDegrees - currentCurvedWall.arcDegrees <= 0.1f)
			{
				currentCurvedWallIndex++;
				currentWallIndex++;
				GameplayEventBus.RaiseWallSectionCompleted(currentWallIndex);

				if (currentWallIndex < wallInstances.Length)
				{
					wallInstances[currentWallIndex].gameObject.SetActive(true);
				}
				else
				{
					CompleteWallGeneration();
				}
			}
			else
				currentCurvedWall.SetArcDegrees(curvedWallGenerationSpeed * wallPerimeterLength);
		}
	}

	private void CompleteWallGeneration()
	{
		if (wallsCompleted)
		{
			return;
		}

		wallsCompleted = true;
		progressWalls = false;

		GameplayEventBus.RaiseWallGenerationFinished();
	}

	// Handles external broadcasts so we don't loop on our own RaiseWallGenerationStarted call.
	private void HandleWallGenerationStartedBroadcast()
	{
		StartWallGeneration(false);
	}

	/// <summary>
	/// Explicit hook so shape transition controllers can restart wall growth
	/// for the current perimeter without rebroadcasting the event bus signal.
	/// </summary>
	public void BeginWallGenerationForCurrentShape()
	{
		StartWallGeneration(false);
	}

	// Exposed for inspector or manual triggering without duplication.
	public void BeginWallGenerationManually()
	{
		StartWallGeneration(true);
	}

	// When a shape is fully completed, guarantee the perimeter visually closes,
	// even if note density / timing would otherwise leave gaps.
	private void HandlePerimeterComplete()
	{
		if (wallsCompleted || wallInstances == null || wallInstances.Length == 0)
			return;

		for (int i = 0; i < wallInstances.Length; i++)
		{
			if (!segmentTransforms[i] || !wallInstances[i])
				continue;

			wallInstances[i].gameObject.SetActive(true);

			if (wallShapeConfig.wallTypes[i] == WallType.STRAIGHT)
			{
				int nextWallIndex = i < wallInstances.Length - 1 ? i + 1 : 0;
				float fullLen = maxWallSizeMultiplier *
					Vector3.Distance(segmentTransforms[i].position, segmentTransforms[nextWallIndex].position);

				var t = wallInstances[i].transform;
				t.localScale = new Vector3(t.localScale.x, t.localScale.y, fullLen);
			}
			else if (wallShapeConfig.wallTypes[i] == WallType.CURVED)
			{
				var curved = wallInstances[i].GetComponentInChildren<CurvedWallGenerator>();
				if (curved != null)
				{
					float deltaDeg = Mathf.Max(0f, targetCurvedWallArcDegrees - curved.arcDegrees);
					if (deltaDeg > 0f && curved.innerRadius > 0f)
					{
						float arcLenDelta = (deltaDeg * Mathf.Deg2Rad) * curved.innerRadius;
						curved.SetArcDegrees(arcLenDelta);
					}
				}
			}
		}

		CompleteWallGeneration();
	}
}
