using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public class DiagramPanController : MonoBehaviour
{
	[SerializeField, Tooltip("RectTransform that holds the perimeter art. Leave empty to auto-detect from perimeter swaps.")]
	private RectTransform diagramRoot;

	[SerializeField, Tooltip("Camera pan timeline to mirror. Auto-assigned if empty.")]
	private CameraPanAnimation cameraPanAnimation;

	[SerializeField, Tooltip("Optional DiagramManager reference used to fetch perimeter segments when no root is provided.")]
	private DiagramManager diagramManager;

	[Header("Pan Behaviour")]
	[SerializeField, Tooltip("Offset applied before the pan starts (UI units).")] private Vector2 panStartOffset = new Vector2(0f, -200f);
	[SerializeField, Tooltip("Automatically prime the offset as soon as the perimeter exists.")] private bool primeAsSoonAsReady = true;
	[SerializeField, Tooltip("Stop listening after the first successful pan.")] private bool singleUse = true;
	[SerializeField, Tooltip("Automatically switch to newly spawned perimeter instances.")] private bool listenForShapeChanges = true;
	[Header("Style")]
	[SerializeField, Tooltip("Primary curve that remaps the camera pan progress.")] private AnimationCurve masterCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
	[SerializeField, Range(0f, 1f), Tooltip("How punchy the overall motion should be. 0 = linear, 1 = big overshoot.")] private float masterOvershoot = 0.2f;
	[SerializeField, Tooltip("Scale multiplier applied at the beginning of the move (1 = unchanged).")] private float startScaleMultiplier = 0.85f;
	[SerializeField, Tooltip("Applies the pop/scale animation as well as the positional tween.")] private bool animateScale = true;
	[SerializeField, Tooltip("Apply a cascading delay across perimeter segments when no shared root exists.")] private bool useSegmentCascade = true;
	[SerializeField, Range(0f, 0.3f), Tooltip("Normalized delay between each perimeter segment when cascading.")] private float segmentCascadeSpacing = 0.05f;
	[SerializeField, Tooltip("Curve used for individual segment motion when cascading. Leave null to reuse the master curve.")] private AnimationCurve cascadeCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
	[SerializeField, Range(0f, 1f), Tooltip("Overshoot strength applied per segment when cascading.")] private float cascadeOvershoot = 0.25f;

	private Vector2 _finalAnchored;
	private Vector2 _startAnchored;
	private Coroutine _panCoroutine;
	private Coroutine _primeCoroutine;
	private bool _rootPrimed;
	private bool _segmentsPrimed;
	private bool _hasCompletedPan;
	private bool _isPrimed;
	private Vector3 _rootStartScale = Vector3.one;
	private Vector3 _rootEndScale = Vector3.one;
	private float _segmentCascadeMaxDelay;

	private readonly List<SegmentState> _segmentStates = new();

	struct SegmentState
	{
		public RectTransform rect;
		public Vector2 start;
		public Vector2 end;
		public Vector3 startScale;
		public Vector3 endScale;
		public float cascadeDelay;
	}

	private void Awake()
	{
		if (!diagramRoot)
			diagramRoot = GetComponent<RectTransform>();
	}

	private void OnEnable()
	{
		EnsurePanAnimation();
		if (cameraPanAnimation != null)
			cameraPanAnimation.OnPanStarted += HandlePanStarted;

		if (listenForShapeChanges)
			GameplayEventBus.OnPerimeterShapeChanged += HandlePerimeterShapeChanged;

		if (primeAsSoonAsReady && _primeCoroutine == null)
			_primeCoroutine = StartCoroutine(PrimeWhenReady());
	}

	private void OnDisable()
	{
		if (cameraPanAnimation != null)
			cameraPanAnimation.OnPanStarted -= HandlePanStarted;

		if (listenForShapeChanges)
			GameplayEventBus.OnPerimeterShapeChanged -= HandlePerimeterShapeChanged;

		if (_panCoroutine != null)
		{
			StopCoroutine(_panCoroutine);
			_panCoroutine = null;
		}

		if (_primeCoroutine != null)
		{
			StopCoroutine(_primeCoroutine);
			_primeCoroutine = null;
		}
	}

	private void EnsurePanAnimation()
	{
		if (cameraPanAnimation)
			return;

#if UNITY_2023_1_OR_NEWER
		cameraPanAnimation = UnityEngine.Object.FindFirstObjectByType<CameraPanAnimation>();
#else
		cameraPanAnimation = UnityEngine.Object.FindFirstObjectByType<CameraPanAnimation>();
#endif
		if (!cameraPanAnimation)
			Debug.LogWarning("[DiagramPanController] No CameraPanAnimation found to synchronize with.", this);
	}

	private void HandlePanStarted()
	{
		if (singleUse && _hasCompletedPan)
			return;

		if (!EnsureTargetsPrimed())
			return;

		if (_panCoroutine != null)
			StopCoroutine(_panCoroutine);

		_panCoroutine = StartCoroutine(PanRoutine());
	}

	private IEnumerator PanRoutine()
	{
		float duration = cameraPanAnimation ? cameraPanAnimation.Duration : 0f;
		var curve = cameraPanAnimation ? cameraPanAnimation.Curve : AnimationCurve.Linear(0f, 0f, 1f, 1f);

		if (duration <= 0f)
		{
			ApplyProgress(1f);
			CompletePan();
			yield break;
		}

		float elapsed = 0f;
		while (elapsed < duration)
		{
			float t = Mathf.Clamp01(elapsed / duration);
			float progress = curve != null ? curve.Evaluate(t) : t;
			ApplyProgress(progress);
			elapsed += Time.deltaTime;
			yield return null;
		}

		ApplyProgress(1f);
		CompletePan();
	}

	private void ApplyProgress(float progress)
	{
		if (_rootPrimed && diagramRoot)
		{
			float styled = EvaluateMasterProgress(progress);
			diagramRoot.anchoredPosition = Vector2.LerpUnclamped(_startAnchored, _finalAnchored, styled);
			if (animateScale)
				diagramRoot.localScale = Vector3.LerpUnclamped(_rootStartScale, _rootEndScale, styled);
		}
		else if (_segmentsPrimed)
		{
			for (int i = 0; i < _segmentStates.Count; i++)
			{
				var state = _segmentStates[i];
				if (!state.rect) continue;
				float cascaded = ApplyCascade(progress, state.cascadeDelay);
				float styled = EvaluateSegmentProgress(cascaded);
				state.rect.anchoredPosition = Vector2.LerpUnclamped(state.start, state.end, styled);
				if (animateScale)
					state.rect.localScale = Vector3.LerpUnclamped(state.startScale, state.endScale, styled);
			}
		}
	}

	private void CompletePan()
	{
		_panCoroutine = null;
		_hasCompletedPan = true;

		if (!singleUse)
		{
			ResetPrimedState();
			if (primeAsSoonAsReady && _primeCoroutine == null)
				_primeCoroutine = StartCoroutine(PrimeWhenReady());
			return;
		}

		_segmentStates.Clear();
	}

	private IEnumerator PrimeWhenReady()
	{
		while (!EnsureTargetsPrimed())
			yield return null;

		_primeCoroutine = null;
	}

	private bool EnsureTargetsPrimed()
	{
		if (_isPrimed)
			return true;

		if (diagramRoot)
		{
			_finalAnchored = diagramRoot.anchoredPosition;
			_startAnchored = _finalAnchored + panStartOffset;
			diagramRoot.anchoredPosition = _startAnchored;
			if (animateScale)
			{
				_rootEndScale = diagramRoot.localScale;
				_rootStartScale = _rootEndScale * Mathf.Max(0.01f, startScaleMultiplier);
				diagramRoot.localScale = _rootStartScale;
			}
			_rootPrimed = true;
			_segmentsPrimed = false;
			_isPrimed = true;
			return true;
		}

		if (PrimeFromSegments())
		{
			_rootPrimed = false;
			_isPrimed = true;
			return true;
		}

		return false;
	}

	private bool PrimeFromSegments()
	{
		var dm = ResolveDiagramManager();
		if (dm == null || dm.perimeterSegments == null || dm.perimeterSegments.Length == 0)
			return false;

		_segmentStates.Clear();

		for (int i = 0; i < dm.perimeterSegments.Length; i++)
		{
			var seg = dm.perimeterSegments[i];
			if (seg.shape == null)
				continue;

			if (seg.shape.transform is RectTransform rt)
			{
				int idx = _segmentStates.Count;
				float delay = (useSegmentCascade && segmentCascadeSpacing > 0f) ? idx * segmentCascadeSpacing : 0f;
				var state = new SegmentState
				{
					rect = rt,
					end = rt.anchoredPosition,
					endScale = rt.localScale,
					cascadeDelay = delay
				};
				state.start = state.end + panStartOffset;
				state.startScale = animateScale ? state.endScale * Mathf.Max(0.01f, startScaleMultiplier) : state.endScale;
				rt.anchoredPosition = state.start;
				if (animateScale)
					rt.localScale = state.startScale;
				_segmentStates.Add(state);
			}
		}

		if (useSegmentCascade)
			_segmentCascadeMaxDelay = (_segmentStates.Count > 0) ? segmentCascadeSpacing * Mathf.Max(0, _segmentStates.Count - 1) : 0f;
		else
			_segmentCascadeMaxDelay = 0f;

		_segmentsPrimed = _segmentStates.Count > 0;
		return _segmentsPrimed;
	}

	private DiagramManager ResolveDiagramManager()
	{
		if (diagramManager)
			return diagramManager;
		return DiagramManager.Instance;
	}

	private void HandlePerimeterShapeChanged(GameObject perimeterInstance)
	{
		if (!listenForShapeChanges || perimeterInstance == null)
			return;

		var rect = perimeterInstance.GetComponent<RectTransform>();
		if (rect)
			diagramRoot = rect;

		ResetPrimedState();

		if (primeAsSoonAsReady && _primeCoroutine == null)
			_primeCoroutine = StartCoroutine(PrimeWhenReady());
	}

	private void ResetPrimedState()
	{
		_rootPrimed = false;
		_segmentsPrimed = false;
		_isPrimed = false;
		_segmentStates.Clear();
		_hasCompletedPan = false;
		_segmentCascadeMaxDelay = 0f;
	}

	private float EvaluateMasterProgress(float t)
	{
		float curved = EvaluateCurve(masterCurve, t);
		return ApplyOvershoot(curved, masterOvershoot);
	}

	private float EvaluateSegmentProgress(float t)
	{
		AnimationCurve curve = cascadeCurve != null ? cascadeCurve : masterCurve;
		float overshoot = cascadeCurve != null ? cascadeOvershoot : masterOvershoot;
		float curved = EvaluateCurve(curve, t);
		return ApplyOvershoot(curved, overshoot);
	}

	private float ApplyCascade(float masterProgress, float delay)
	{
		if (!useSegmentCascade || segmentCascadeSpacing <= 0f || _segmentStates.Count <= 1)
			return masterProgress;

		if (_segmentCascadeMaxDelay <= 0f)
			return masterProgress;

		float normalized = Mathf.Clamp01((masterProgress - delay) / Mathf.Max(0.0001f, 1f - _segmentCascadeMaxDelay));
		return normalized;
	}

	private static float EvaluateCurve(AnimationCurve curve, float t)
	{
		float clamped = Mathf.Clamp01(t);
		if (curve != null && curve.length > 0)
			return Mathf.Clamp01(curve.Evaluate(clamped));
		return clamped;
	}

	private static float ApplyOvershoot(float value, float overshootStrength)
	{
		if (overshootStrength <= 0.0001f)
			return value;

		float s = Mathf.Lerp(0.1f, 2.5f, Mathf.Clamp01(overshootStrength));
		float t = Mathf.Clamp01(value) - 1f;
		return t * t * ((s + 1f) * t + s) + 1f;
	}
}
