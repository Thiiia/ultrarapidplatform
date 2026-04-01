using UnityEngine;
using System.Collections;
using UnityEngine.SceneManagement;
using DG.Tweening;
using UnityEngine.UI;

public class ShapeShifterSequence : MonoBehaviour
{
	[SerializeField] private GameObject[] shapePrefabs;
	[SerializeField] private Transform perimeterShapeParent;
	[SerializeField] private string questionSceneName = "Question Perimeter";
	[SerializeField] private CameraPanAnimation cameraPanAnimation;
	[Header("Study Formulae")]
	[SerializeField, Tooltip("Optional overrides per shape. Leave empty to use built-in defaults.")]
	private ShapeFormulaDefinition[] shapeFormulas;

	[Header("Transition Tuning")]
	[SerializeField, Tooltip("Small hold after perimeter completes before we start the reset animation.")]
	private float postPerimeterHoldSeconds = 0.25f;
	[SerializeField, Tooltip("Duration of the hologram dissolve for the current perimeter shape.")]
	private float hologramDissolveSeconds = 0.6f;
#pragma warning disable CS0414
	[SerializeField, Tooltip("If > 0, retimes the city fade-in to line up with the camera reverse between shapes.")]
	private float cityFadeInSeconds = 0.8f;
#pragma warning restore CS0414


	[SerializeField] private Image missionCompleteOverlay;

	private static int currentShapeIndex = 0;
	private GameObject currentShapeInstance;
	private Coroutine pendingSwitch;
	private bool isSwitching;
	private SyntheiaCityController cityController;
	private WallGenerator wallGenerator;

	private void Start()
	{
		if (shapePrefabs == null || shapePrefabs.Length == 0)
			return;

		ShapeFormulaRuntime.Clear();

		int requestedIndex = (int)GameplayEventBus.currentShape - 1;
		if (requestedIndex < 0 || requestedIndex >= shapePrefabs.Length)
			requestedIndex = 0;

		currentShapeIndex = requestedIndex;
		SpawnShapeAtCurrentIndex();
	}

	private void OnEnable()
	{
		GameplayEventBus.OnPerimeterComplete += NextShape;
		GameplayEventBus.ChartCompleted += EndOfMission;
	}

	private void OnDisable()
	{
		GameplayEventBus.OnPerimeterComplete -= NextShape;
		GameplayEventBus.ChartCompleted -= EndOfMission;
	}

	private void NextShape()
	{
		if (shapePrefabs == null || shapePrefabs.Length == 0)
			return;

		if (pendingSwitch == null)
			pendingSwitch = StartCoroutine(DelayNextShape());
	}

	private IEnumerator DelayNextShape()
	{
		if (isSwitching)
			yield break;

		isSwitching = true;
		EnsureCameraPanReference();

		// 1) Let the completed diagram breathe for a beat.
		if (postPerimeterHoldSeconds > 0f)
		{
			yield return new WaitForSeconds(postPerimeterHoldSeconds);
		}

		// 2) Collapse the current perimeter shape like a dissolving hologram.
		yield return StartCoroutine(PlayPerimeterHologramOutro());

		try
		{
			currentShapeIndex++;

			if (currentShapeIndex >= shapePrefabs.Length)
			{
				EndOfMission();
				yield break;
			}

			SpawnShapeAtCurrentIndex();
		}
		finally
		{
			isSwitching = false;
			pendingSwitch = null;
		}
	}

	private void EndOfMission()
	{
		ScoreManagerScript.Instance?.PreparePerimeterQuizFromLastShape();
		StartCoroutine(TriggerMissionCompleteMessage());
	}

	private IEnumerator TriggerMissionCompleteMessage()
	{
		if (AudioManager.Instance != null)
		{
			AudioManager.Instance.FadeMusicTo(0f, 3.0f);
		}

		yield return new WaitForSeconds(1.0f);

		if (missionCompleteOverlay)
		{
			missionCompleteOverlay.transform.localScale = Vector3.zero;
			missionCompleteOverlay.gameObject.SetActive(true);
			missionCompleteOverlay.transform.DOScale(1f, 2.5f).From(0f).SetEase(Ease.OutBack);
		}

		StartCoroutine(GoToQuestionSceneAfterDelay(3.0f));
	}

	private IEnumerator GoToQuestionSceneAfterDelay(float delaySeconds)
	{
		if (delaySeconds > 0f)
		{
			yield return new WaitForSeconds(delaySeconds);
		}

		SceneManager.LoadScene(questionSceneName);
	}

	private void SpawnShapeAtCurrentIndex()
	{
		if (shapePrefabs == null || shapePrefabs.Length == 0)
			return;

		int clamped = Mathf.Clamp(currentShapeIndex, 0, shapePrefabs.Length - 1);
		currentShapeIndex = clamped;
		SpawnShape(shapePrefabs[clamped], clamped);
	}

	private void SpawnShape(GameObject shapePrefab, int ordinal)
	{
		if (shapePrefab == null || perimeterShapeParent == null)
			return;

		ClearShapeScopedVfx();
		if (currentShapeInstance != null)
		{
			Destroy(currentShapeInstance);
		}

		currentShapeInstance = Instantiate(shapePrefab, perimeterShapeParent);
		currentShapeInstance.transform.localPosition = Vector3.zero;
		currentShapeInstance.transform.localRotation = Quaternion.identity;

		EnsureDiagramManagerActive();

		GameplayEventBus.currentShape = (ShapeSelectButton.ShapeType)(currentShapeIndex + 1);
		ScoreManagerScript.Instance?.SetShapeRunContext(ordinal, shapePrefabs.Length);
		ScoreManagerScript.Instance?.BeginPerimeterShape(GameplayEventBus.currentShape);
		GameplayEventBus.RaisePerimeterShapeChanged(currentShapeInstance);
		ApplyShapeFormulaForCurrentShape();
		// Kick walls + camera cycle for the new shape without bringing the city back into view.
		EnsureWallGeneratorReference();
		if (wallGenerator != null)
		{
			wallGenerator.BeginWallGenerationForCurrentShape();
		}
		TriggerCameraCycle();
	}

	private void ClearShapeScopedVfx()
	{
		foreach (var director in UnityEngine.Object.FindObjectsByType<WispImpactDirector>(UnityEngine.FindObjectsSortMode.None))
		{
			director?.ForceClearVfx();
		}

		var diagram = DiagramManager.Instance;
		if (diagram != null)
		{
			if (!diagram.gameObject.activeSelf)
				diagram.gameObject.SetActive(true);

			diagram.ResetDiagramSegments();
		}
	}

	private void TriggerCameraCycle()
	{
		EnsureCameraPanReference();
		cameraPanAnimation?.RestartPanFromStart();
	}

	private IEnumerator PlayPerimeterHologramOutro()
	{
		if (currentShapeInstance == null || hologramDissolveSeconds <= 0f)
		{
			yield break;
		}

		Transform root = currentShapeInstance.transform;
		Vector3 baseScale = root.localScale;
		float duration = hologramDissolveSeconds;

		Sequence seq = DOTween.Sequence()
			.SetTarget(root)
			.SetUpdate(true)
			.SetRecyclable(true);

		// Subtle pulse before collapse so it feels like the hologram is destabilising.
		seq.Append(root.DOPunchScale(baseScale * 0.08f, duration * 0.35f, 0, 0.6f)
			.SetEase(Ease.OutQuad));

		// Collapse the shape and fade its renderers.
		seq.Join(root.DOScale(baseScale * 0.6f, duration * 0.6f)
			.SetEase(Ease.InQuad));

		var renderers = currentShapeInstance.GetComponentsInChildren<Renderer>(true);
		foreach (var renderer in renderers)
		{
			if (!renderer)
				continue;

			var material = renderer.material;
			if (!material)
				continue;

			if (material.HasProperty("_Color"))
			{
				Color start = material.color;
				Color target = new Color(start.r, start.g, start.b, 0f);
				seq.Join(DOTween.To(() => material.color, c => material.color = c, target, duration * 0.6f)
					.SetEase(Ease.InQuad));
			}
			else if (material.HasProperty("_BaseColor"))
			{
				Color start = material.GetColor("_BaseColor");
				Color target = new Color(start.r, start.g, start.b, 0f);
				seq.Join(DOTween.To(() => material.GetColor("_BaseColor"), c => material.SetColor("_BaseColor", c), target, duration * 0.6f)
					.SetEase(Ease.InQuad));
			}
		}

		seq.OnKill(() =>
		{
			if (root)
			{
				root.localScale = Vector3.zero;
			}
		});

		yield return seq.WaitForCompletion();
	}

	private void EnsureCameraPanReference()
	{
		if (cameraPanAnimation != null)
		{
			return;
		}

#if UNITY_2023_1_OR_NEWER
		cameraPanAnimation = UnityEngine.Object.FindFirstObjectByType<CameraPanAnimation>(UnityEngine.FindObjectsInactive.Include);
#else
		cameraPanAnimation = UnityEngine.Object.FindFirstObjectByType<CameraPanAnimation>();
#endif
	}

	private void EnsureWallGeneratorReference()
	{
		if (wallGenerator != null)
		{
			return;
		}

#if UNITY_2023_1_OR_NEWER
		wallGenerator = UnityEngine.Object.FindFirstObjectByType<WallGenerator>(UnityEngine.FindObjectsInactive.Include);
#else
		wallGenerator = UnityEngine.Object.FindFirstObjectByType<WallGenerator>();
#endif
	}

	private void EnsureCityControllerReference()
	{
		if (cityController != null)
		{
			return;
		}

#if UNITY_2023_1_OR_NEWER
		cityController = UnityEngine.Object.FindFirstObjectByType<SyntheiaCityController>(UnityEngine.FindObjectsInactive.Include);
#else
		cityController = UnityEngine.Object.FindFirstObjectByType<SyntheiaCityController>();
#endif
	}

	private void RestartChartForNextShape()
	{
		ChartSystem chartSystem = null;
#if UNITY_2023_1_OR_NEWER
		chartSystem = UnityEngine.Object.FindFirstObjectByType<ChartSystem>();
#else
		chartSystem = UnityEngine.Object.FindFirstObjectByType<ChartSystem>();
#endif

		if (chartSystem != null)
		{
			chartSystem.ReloadChart(true);
		}
		else
		{
			Debug.LogWarning("[ShapeShifterSequence] ChartSystem not found when trying to restart for the next shape.");
		}
	}

	private void EnsureDiagramManagerActive()
	{
		var diagram = DiagramManager.Instance;
		if (diagram != null && !diagram.gameObject.activeSelf)
		{
			diagram.gameObject.SetActive(true);
		}
	}

	private void ApplyShapeFormulaForCurrentShape()
	{
		var diagram = DiagramManager.Instance;
		var segments = diagram != null ? diagram.perimeterSegments : null;
		var shapeType = GameplayEventBus.currentShape;

		var definition = ResolveShapeFormula(shapeType, segments);
		if (definition != null)
		{
			var runtimeData = definition.GenerateRuntimeData(segments);
			ShapeFormulaRuntime.SetFormula(runtimeData);
		}
		else
		{
			ShapeFormulaRuntime.Clear();
		}
	}

	private ShapeFormulaDefinition ResolveShapeFormula(ShapeSelectButton.ShapeType shapeType, DiagramManager.PerimeterSegment[] segments)
	{
		if (shapeFormulas != null)
		{
			for (int i = 0; i < shapeFormulas.Length; i++)
			{
				var def = shapeFormulas[i];
				if (def != null && def.Shape == shapeType)
					return def;
			}
		}
		return ShapeFormulaDefinition.CreateFallback(shapeType, segments);
	}
}
