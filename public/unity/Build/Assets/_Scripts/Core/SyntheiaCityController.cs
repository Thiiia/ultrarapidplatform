using System.Collections.Generic;
using UnityEngine;
using Shapes;

public class SyntheiaCityController : MonoBehaviour
{
	[SerializeField] private Vector3[] synthiaCityPositions;
	[SerializeField] private Vector3[] synthiaCityScales;
	[SerializeField] private GameObject synthiaCity;
	[SerializeField, Tooltip("How long the skyline takes to fade back in on gameplay outro.")]
	private float outroCityFadeSeconds = 1.2f;
	[SerializeField, Tooltip("Multiplier applied to the base scale so the city fills the playable perimeter area.")]
	private Vector2 perimeterFitScalePadding = new Vector2(1.35f, 1.35f);
	[SerializeField] private float maxCutoffHeight = 3.0f;
	[SerializeField] private float minCutoffHeight = -2.0f;
	[SerializeField] private float dissolveSpeed = 1.5f;

	private List<Material> cityMaterials = new List<Material>();
	private bool dissolveCity = false;
	private float currentCutoffHeight = 3.0f;
	private int currentShapeIndex = 0;
	private Vector2 perimeterBoundsSize = Vector2.zero;
	private static readonly float[] discCardinals = { 0f, Mathf.PI * 0.5f, Mathf.PI, Mathf.PI * 1.5f, Mathf.PI * 2f };

	private void Awake()
	{
		currentCutoffHeight = maxCutoffHeight;

		Renderer[] renderers = GetComponentsInChildren<Renderer>(true);

		foreach (Renderer renderer in renderers)
		{
			if (renderer && renderer.sharedMaterial && !cityMaterials.Contains(renderer.sharedMaterial))
			{
				cityMaterials.Add(renderer.sharedMaterial);
			}
		}
	}

	private void Start()
	{
		TryBootstrapPerimeterBounds();
		ApplyCurrentShapeTransform();
	}

	private void OnEnable()
	{
		GameplayEventBus.CameraPannedToBirdsEye += StartDissolvingCity;
		GameplayEventBus.ChartCompleted += HandleChartCompleted;
		GameplayEventBus.OnPerimeterShapeChanged += HandlePerimeterShapeChanged;
	}

	private void OnDisable()
	{
		GameplayEventBus.CameraPannedToBirdsEye -= StartDissolvingCity;
		GameplayEventBus.ChartCompleted -= HandleChartCompleted;
		GameplayEventBus.OnPerimeterShapeChanged -= HandlePerimeterShapeChanged;
	}

	private void Update()
	{
		ToggleDissolveCity();
	}

	private void ToggleDissolveCity()
	{
		if (dissolveCity)
		{
			if (currentCutoffHeight > minCutoffHeight)
			{
				currentCutoffHeight -= Time.deltaTime * dissolveSpeed;
				ApplyCityCutoff(currentCutoffHeight);
			}
			else
			{
				dissolveCity = false;
				synthiaCity.SetActive(false);
				GameplayEventBus.RaiseWallGenerationStarted();
			}
		}
		else if (synthiaCity.activeSelf)
		{
			if (currentCutoffHeight < maxCutoffHeight)
			{
				currentCutoffHeight += Time.deltaTime * dissolveSpeed;
				ApplyCityCutoff(currentCutoffHeight);
			}
		}
	}

	private void ApplyCityCutoff(float value)
	{
		foreach (Material material in cityMaterials)
		{
			if (material.HasProperty("_Cutoff_Height"))
			{
				material.SetFloat("_Cutoff_Height", value);
			}
		}
	}

	private void SetSyntheiaCityActive()
	{
		if (synthiaCity)
		{
			synthiaCity.SetActive(true);
		}
	}

	private void StartDissolvingCity()
	{
		dissolveCity = true;
	}

	private void HandleChartCompleted()
	{
		BeginCityFadeIn(outroCityFadeSeconds);
	}

	/// <summary>
	/// Explicitly kick a cinematic-style fade in of the city.
	/// Called by shape transition orchestrators so the skyline blooms back in
	/// while the camera returns to ground level.
	/// </summary>
	public void BeginCityFadeIn(float desiredDurationSeconds = 0f)
	{
		if (!synthiaCity)
		{
			return;
		}

		dissolveCity = false;
		synthiaCity.SetActive(true);

		// Optionally retime the fade so it lines up with a camera move.
		if (desiredDurationSeconds > 0f)
		{
			float range = Mathf.Max(0.01f, maxCutoffHeight - minCutoffHeight);
			dissolveSpeed = range / Mathf.Max(0.01f, desiredDurationSeconds);
		}

		// Ensure we start from a fully "cut" state so the fade has a visible arc.
		if (currentCutoffHeight > maxCutoffHeight || currentCutoffHeight < minCutoffHeight)
		{
			currentCutoffHeight = minCutoffHeight;
		}
		ApplyCityCutoff(currentCutoffHeight);
	}

	private void HandlePerimeterShapeChanged(GameObject perimeterInstance)
	{
		UpdatePerimeterBounds(perimeterInstance);
		ApplyCurrentShapeTransform();
	}

	private void ApplyCurrentShapeTransform()
	{
		if (!synthiaCity)
		{
			return;
		}

		if (synthiaCityPositions == null || synthiaCityScales == null || synthiaCityPositions.Length == 0 || synthiaCityScales.Length == 0)
		{
			Debug.LogWarning("[SyntheiaCityController] Missing city transforms – cannot size city for perimeter.");
			return;
		}

		int maxIndex = Mathf.Min(synthiaCityPositions.Length, synthiaCityScales.Length) - 1;
		if (maxIndex < 0)
		{
			Debug.LogWarning("[SyntheiaCityController] Invalid city transform data – cannot size city for perimeter.");
			return;
		}

		currentShapeIndex = Mathf.Clamp((int)GameplayEventBus.currentShape - 1, 0, maxIndex);

		Vector3 targetPosition = synthiaCityPositions[currentShapeIndex];
		Vector3 targetScale = synthiaCityScales[currentShapeIndex];
		targetScale = ApplyDiagramAspect(targetScale);
		targetScale.x *= Mathf.Max(0.01f, perimeterFitScalePadding.x);
		targetScale.z *= Mathf.Max(0.01f, perimeterFitScalePadding.y);

		synthiaCity.transform.position = targetPosition;
		synthiaCity.transform.localScale = targetScale;
	}

	private void TryBootstrapPerimeterBounds()
	{
		if (perimeterBoundsSize != Vector2.zero)
		{
			return;
		}

		if (DiagramManager.Instance && DiagramManager.Instance.perimeterSegments != null && DiagramManager.Instance.perimeterSegments.Length > 0)
		{
			UpdatePerimeterBounds(DiagramManager.Instance.perimeterSegments);
		}
	}

	private void UpdatePerimeterBounds(GameObject perimeterInstance)
	{
		if (!perimeterInstance)
		{
			return;
		}

		PerimeterShape shape = perimeterInstance.GetComponent<PerimeterShape>();
		if (!shape)
		{
			return;
		}

		UpdatePerimeterBounds(shape.GetPerimeterSegments());
	}

	private void UpdatePerimeterBounds(DiagramManager.PerimeterSegment[] segments)
	{
		if (segments == null || segments.Length == 0)
		{
			perimeterBoundsSize = Vector2.zero;
			return;
		}

		float minX = float.PositiveInfinity;
		float maxX = float.NegativeInfinity;
		float minY = float.PositiveInfinity;
		float maxY = float.NegativeInfinity;

		foreach (var seg in segments)
		{
			if (seg.shape == null)
			{
				continue;
			}

			Transform segTransform = seg.shape.transform;

			if (seg.shape is Line line)
			{
				Accumulate(segTransform.TransformPoint(line.Start));
				Accumulate(segTransform.TransformPoint(line.End));
			}
			else if (seg.shape is Disc disc)
			{
				SampleDiscBounds(disc, segTransform, ref minX, ref maxX, ref minY, ref maxY);
			}
		}

		if (float.IsInfinity(minX) || float.IsInfinity(minY))
		{
			perimeterBoundsSize = Vector2.zero;
			return;
		}

		perimeterBoundsSize = new Vector2(Mathf.Max(0.01f, maxX - minX), Mathf.Max(0.01f, maxY - minY));

		void Accumulate(Vector3 point)
		{
			minX = Mathf.Min(minX, point.x);
			maxX = Mathf.Max(maxX, point.x);
			minY = Mathf.Min(minY, point.y);
			maxY = Mathf.Max(maxY, point.y);
		}
	}

	private void SampleDiscBounds(Disc disc, Transform segTransform, ref float minX, ref float maxX, ref float minY, ref float maxY)
	{
		float start = disc.AngRadiansStart;
		float end = disc.AngRadiansEnd;
		float sweep = Mathf.Repeat(end - start, Mathf.PI * 2f);
		if (Mathf.Approximately(sweep, 0f))
		{
			sweep = Mathf.PI * 2f;
		}

		int steps = Mathf.Max(4, Mathf.CeilToInt(sweep / (Mathf.PI / 6f)));
		for (int i = 0; i <= steps; ++i)
		{
			float angle = start + sweep * (i / (float)steps);
			AddDiscAnglePoint(disc, segTransform, angle, ref minX, ref maxX, ref minY, ref maxY);
		}

		foreach (float cardinal in discCardinals)
		{
			if (IsAngleWithinArc(start, sweep, cardinal))
			{
				AddDiscAnglePoint(disc, segTransform, cardinal, ref minX, ref maxX, ref minY, ref maxY);
			}
		}
	}

	private static void AddDiscAnglePoint(Disc disc, Transform segTransform, float radians, ref float minX, ref float maxX, ref float minY, ref float maxY)
	{
		Vector2 local2D = new Vector2(Mathf.Cos(radians), Mathf.Sin(radians)) * disc.Radius;
		Vector3 local = new Vector3(local2D.x, local2D.y, 0f);
		Vector3 world = segTransform.TransformPoint(local);
		minX = Mathf.Min(minX, world.x);
		maxX = Mathf.Max(maxX, world.x);
		minY = Mathf.Min(minY, world.y);
		maxY = Mathf.Max(maxY, world.y);
	}

	private bool IsAngleWithinArc(float start, float sweep, float test)
	{
		float normalizedSweep = Mathf.Clamp(sweep, 0f, Mathf.PI * 2f);
		if (Mathf.Approximately(normalizedSweep, 0f) || Mathf.Approximately(normalizedSweep, Mathf.PI * 2f))
		{
			return true;
		}

		float startNorm = Mathf.Repeat(start, Mathf.PI * 2f);
		float endNorm = Mathf.Repeat(startNorm + normalizedSweep, Mathf.PI * 2f);
		float testNorm = Mathf.Repeat(test, Mathf.PI * 2f);

		if (startNorm <= endNorm)
		{
			return testNorm >= startNorm && testNorm <= endNorm;
		}

		// wrapped around 2PI
		return testNorm >= startNorm || testNorm <= endNorm;
	}

	private Vector3 ApplyDiagramAspect(Vector3 baseScale)
	{
		if (perimeterBoundsSize == Vector2.zero)
		{
			return baseScale;
		}

		float width = Mathf.Max(0.01f, perimeterBoundsSize.x);
		float depth = Mathf.Max(0.01f, perimeterBoundsSize.y);
		float aspect = width / depth;

		if (!float.IsFinite(aspect) || aspect <= 0f)
		{
			return baseScale;
		}

		float baseArea = Mathf.Max(0.0001f, Mathf.Abs(baseScale.x * baseScale.z));
		float xScale = Mathf.Sqrt(baseArea * aspect);
		float zScale = Mathf.Sqrt(baseArea / aspect);
		baseScale.x = xScale;
		baseScale.z = zScale;
		return baseScale;
	}
}
