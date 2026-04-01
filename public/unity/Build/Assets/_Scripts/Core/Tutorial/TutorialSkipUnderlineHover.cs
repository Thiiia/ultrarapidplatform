using DG.Tweening;
using Shapes;
using UnityEngine;
using UnityEngine.EventSystems;

[DisallowMultipleComponent]
public class TutorialSkipUnderlineHover : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler
{
	[SerializeField] private Line underline;
	[SerializeField] private Color fallbackVisibleColor = new Color(0.8862745f, 1f, 0f, 0.85f);
	[SerializeField, Min(1f)] private float hoverLengthMultiplier = 1.05f;
	[SerializeField, Min(0.1f)] private float hoverThicknessMultiplier = 1.15f;
	[SerializeField, Range(0f, 1f)] private float hoverAlphaBoost = 0.06f;
	[SerializeField, Min(0.01f)] private float hoverInDuration = 0.12f;
	[SerializeField, Min(0.01f)] private float hoverOutDuration = 0.10f;

	private Vector3 baseStart;
	private Vector3 baseEnd;
	private float baseThickness;
	private Color baseColor;
	private bool hasCachedState;
	private float currentLengthMultiplier = 1f;
	private float currentThicknessMultiplier = 1f;

	private Tween lengthTween;
	private Tween thicknessTween;
	private Tween colorTween;

	private void Awake()
	{
		AutoBindIfNeeded();
		CacheBaseStateIfNeeded();
		ApplyCurrentVisualState();
	}

	private void OnEnable()
	{
		AutoBindIfNeeded();
		CacheBaseStateIfNeeded();
		ApplyCurrentVisualState();
	}

	private void OnDisable()
	{
		KillTweens();
	}

	private void OnDestroy()
	{
		KillTweens();
	}

	public void TryAutoBind()
	{
		AutoBindIfNeeded();
		CacheBaseStateIfNeeded();
		ApplyCurrentVisualState();
	}

	public void OnPointerEnter(PointerEventData eventData)
	{
		AnimateToState(hoverLengthMultiplier, hoverThicknessMultiplier, ResolveHoverColor(), hoverInDuration, Ease.OutSine);
	}

	public void OnPointerExit(PointerEventData eventData)
	{
		AnimateToState(1f, 1f, baseColor, hoverOutDuration, Ease.OutSine);
	}

	public void OnPointerDown(PointerEventData eventData)
	{
		// Keep feedback calm; no extra press bounce.
	}

	public void OnPointerUp(PointerEventData eventData)
	{
		// Keep feedback calm; no extra release bounce.
	}

	private void AutoBindIfNeeded()
	{
		if (underline == null)
		{
			underline = GetComponentInChildren<Line>(true);
		}

		if (underline == null)
		{
			TutorialStep parentStep = GetComponentInParent<TutorialStep>(true);
			if (parentStep != null)
			{
				Line[] stepLines = parentStep.GetComponentsInChildren<Line>(true);
				for (int i = 0; i < stepLines.Length; i++)
				{
					Line candidate = stepLines[i];
					if (candidate == null)
					{
						continue;
					}

					string lineName = candidate.gameObject.name;
					if (lineName.IndexOf("skip", System.StringComparison.OrdinalIgnoreCase) >= 0 ||
						lineName.IndexOf("line", System.StringComparison.OrdinalIgnoreCase) >= 0)
					{
						underline = candidate;
						break;
					}
				}
			}
		}
	}

	private void CacheBaseStateIfNeeded()
	{
		if (hasCachedState || underline == null)
		{
			return;
		}

		baseStart = underline.Start;
		baseEnd = underline.End;
		baseThickness = Mathf.Max(0.8f, underline.Thickness);
		baseColor = underline.Color;
		if (Vector3.SqrMagnitude(baseEnd - baseStart) <= 0.0001f)
		{
			baseStart = new Vector3(-26f, 0f, 0f);
			baseEnd = new Vector3(26f, 0f, 0f);
			underline.Start = baseStart;
			underline.End = baseEnd;
		}

		if (baseColor.a <= 0.05f || IsNearNeutral(baseColor))
		{
			baseColor = fallbackVisibleColor;
			underline.Color = baseColor;
		}

		EnsureUnderlineRendererVisible();
		hasCachedState = true;
	}

	private void AnimateToState(float targetLengthMultiplier, float targetThicknessMultiplier, Color targetColor, float duration, Ease ease)
	{
		if (!hasCachedState || underline == null)
		{
			return;
		}

		KillTweens();

		lengthTween = DOTween.To(
			() => currentLengthMultiplier,
			v =>
			{
				currentLengthMultiplier = v;
				ApplyCurrentVisualState();
			},
			Mathf.Max(1f, targetLengthMultiplier),
			duration).SetEase(ease).SetUpdate(true);

		thicknessTween = DOTween.To(
			() => currentThicknessMultiplier,
			v =>
			{
				currentThicknessMultiplier = Mathf.Max(0.1f, v);
				ApplyCurrentVisualState();
			},
			Mathf.Max(0.1f, targetThicknessMultiplier),
			duration).SetEase(Ease.OutSine).SetUpdate(true);

		Color fromColor = underline.Color;
		colorTween = DOTween.To(
			() => fromColor,
			v =>
			{
				fromColor = v;
				underline.Color = v;
			},
			targetColor,
			duration).SetEase(Ease.OutSine).SetUpdate(true);
	}

	private void ApplyCurrentVisualState()
	{
		if (!hasCachedState || underline == null)
		{
			return;
		}

		Vector3 center = (baseStart + baseEnd) * 0.5f;
		Vector3 halfVector = (baseEnd - baseStart) * 0.5f * Mathf.Max(1f, currentLengthMultiplier);
		underline.Start = center - halfVector;
		underline.End = center + halfVector;
		underline.Thickness = Mathf.Max(0.01f, baseThickness * Mathf.Max(0.1f, currentThicknessMultiplier));
		EnsureUnderlineRendererVisible();
	}

	private Color ResolveHoverColor()
	{
		Color hoverColor = baseColor;
		hoverColor.a = Mathf.Clamp01(baseColor.a + hoverAlphaBoost);
		return hoverColor;
	}

	private void EnsureUnderlineRendererVisible()
	{
		if (underline == null)
		{
			return;
		}

		underline.gameObject.SetActive(true);

		MeshRenderer meshRenderer = underline.GetComponent<MeshRenderer>();
		if (meshRenderer != null)
		{
			meshRenderer.enabled = true;
		}
	}

	private static bool IsNearNeutral(Color c)
	{
		float max = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
		float min = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
		return (max - min) <= 0.06f;
	}

	private void KillTweens()
	{
		lengthTween?.Kill();
		lengthTween = null;
		thicknessTween?.Kill();
		thicknessTween = null;
		colorTween?.Kill();
		colorTween = null;
	}
}
