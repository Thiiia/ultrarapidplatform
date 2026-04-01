using System.Collections;
using UnityEngine.UI;
using UnityEngine;
using DG.Tweening;

public class TutorialStep : MonoBehaviour
{
	[SerializeField] private Vector3 stepScaleDefault;
	[SerializeField] private Vector3 stepScaleEnter;
	[SerializeField] private Vector3 focusAreaAnchorPosition;
	[SerializeField] private Vector2 focusAreaSizeDelta;
	[SerializeField] private Image focusArea;
	[SerializeField] private Image vignetteImage;
	[SerializeField] private AudioSource stepAudioSource;
	[SerializeField] private bool bUseFocusArea = false;
	[SerializeField] private GameObject parentObject;
	[SerializeField] private GameObject childObject;
	[SerializeField] private GameObject nextButton = null;

	private RectTransform stepRectTransform;
	private Canvas stepForegroundCanvas;
	private GraphicRaycaster stepForegroundRaycaster;

	private void Awake()
	{
		stepRectTransform = GetComponent<RectTransform>();
		EnsureForegroundCanvasOverride();

		if (nextButton == null)
		{
			nextButton = transform.Find("NextButton")?.gameObject;
		}

		if (nextButton == null)
		{
			Button[] buttons = GetComponentsInChildren<Button>(true);
			for (int i = 0; i < buttons.Length; i++)
			{
				Button candidate = buttons[i];
				if (candidate == null)
				{
					continue;
				}

				if (candidate.name.IndexOf("next", System.StringComparison.OrdinalIgnoreCase) >= 0)
				{
					nextButton = candidate.gameObject;
					break;
				}
			}
		}

		if (nextButton == null)
		{
			Debug.LogWarning("Next Button not found in children of " + gameObject.name);
		}
	}

	private void OnDisable()
	{
		KillStepTweens();
	}

	private void OnDestroy()
	{
		KillStepTweens();
	}

	public void OnEnterStep()
	{
		Debug.Log("Entering tutorial step: " + gameObject.name);
		EnsureForegroundCanvasOverride();
		EnsureOverlayForegroundCanvas(vignetteImage != null ? vignetteImage.gameObject : null);
		EnsureOverlayForegroundCanvas(focusArea != null ? focusArea.gameObject : null);

		// Keep the active step UI above sibling gameplay/UI overlays in the shared canvas.
		if (stepRectTransform != null)
		{
			stepRectTransform.SetAsLastSibling();
		}
		else
		{
			transform.SetAsLastSibling();
		}

		if (vignetteImage != null)
		{
			vignetteImage.rectTransform.SetAsLastSibling();
		}

		if (focusArea != null)
		{
			focusArea.rectTransform.SetAsLastSibling();
		}

		if (stepAudioSource)
		{
			stepAudioSource.Play();
		}

		InterpolateStepScale(stepScaleEnter, 0.4f, true);
	}

	public void OnExitStep()
	{
		Debug.Log("Exiting tutorial step: " + gameObject.name);
		InterpolateStepScale(stepScaleDefault, 0.1f, false);
	}

	public GameObject GetNextButton()
	{
		return nextButton;
	}

	private void InterpolateStepScale(Vector3 targetScale, float duration, bool bSetActive)
	{
		if (stepRectTransform != null)
		{
			stepRectTransform.DOKill();
			stepRectTransform.DOScale(targetScale, duration).SetUpdate(true);
		}

		if (!bSetActive)
		{
			if (!bUseFocusArea && childObject && parentObject)
			{
				childObject.transform.SetParent(parentObject.transform);
			}

			gameObject.SetActive(false);
		}
		else
		{
			if (bUseFocusArea)
			{
				if (focusArea && vignetteImage)
				{
					vignetteImage.gameObject.SetActive(false);
					focusArea.gameObject.SetActive(true);
					EnsureOverlayForegroundCanvas(focusArea.gameObject);
					focusArea.rectTransform.anchoredPosition3D = focusAreaAnchorPosition;
					focusArea.rectTransform.sizeDelta = focusAreaSizeDelta;
					// Ensure the focus area stretches within the canvas to avoid partial coverage.
					focusArea.rectTransform.anchorMin = Vector2.zero;
					focusArea.rectTransform.anchorMax = Vector2.one;
				}
			}
			else
			{
				if (vignetteImage && focusArea)
				{
					focusArea.gameObject.SetActive(false);
					vignetteImage.gameObject.SetActive(true);
					EnsureOverlayForegroundCanvas(vignetteImage.gameObject);
					// Stretch the vignette to fill the screen to avoid clipping on different aspect ratios.
					var rt = vignetteImage.rectTransform;
					rt.anchorMin = Vector2.zero;
					rt.anchorMax = Vector2.one;
					rt.offsetMin = Vector2.zero;
					rt.offsetMax = Vector2.zero;
				}

				if (childObject)
				{
					childObject.transform.SetParent(vignetteImage.transform);
					EnsureOverlayForegroundCanvas(childObject);
				}
			}
		}
	}

	private void KillStepTweens()
	{
		if (stepRectTransform != null)
		{
			stepRectTransform.DOKill(false);
		}
	}

	private void EnsureForegroundCanvasOverride()
	{
		if (stepForegroundCanvas == null)
		{
			stepForegroundCanvas = GetComponent<Canvas>();
			if (stepForegroundCanvas == null)
			{
				stepForegroundCanvas = gameObject.AddComponent<Canvas>();
			}
		}

		if (stepForegroundRaycaster == null)
		{
			stepForegroundRaycaster = GetComponent<GraphicRaycaster>();
			if (stepForegroundRaycaster == null)
			{
				stepForegroundRaycaster = gameObject.AddComponent<GraphicRaycaster>();
			}
		}

		Canvas parentCanvas = transform.parent != null ? transform.parent.GetComponentInParent<Canvas>() : null;
		if (parentCanvas != null)
		{
			stepForegroundCanvas.sortingLayerID = parentCanvas.sortingLayerID;
			stepForegroundCanvas.sortingOrder = Mathf.Max(parentCanvas.sortingOrder + 5000, 30000);
		}
		else
		{
			stepForegroundCanvas.sortingOrder = Mathf.Max(stepForegroundCanvas.sortingOrder, 30000);
		}

		stepForegroundCanvas.overrideSorting = true;
	}

	private void EnsureOverlayForegroundCanvas(GameObject go)
	{
		if (go == null)
		{
			return;
		}

		Canvas overlayCanvas = go.GetComponent<Canvas>();
		if (overlayCanvas == null)
		{
			overlayCanvas = go.AddComponent<Canvas>();
		}

		GraphicRaycaster overlayRaycaster = go.GetComponent<GraphicRaycaster>();
		if (overlayRaycaster == null)
		{
			overlayRaycaster = go.AddComponent<GraphicRaycaster>();
		}

		Canvas parentCanvas = go.transform.parent != null ? go.transform.parent.GetComponentInParent<Canvas>() : null;
		if (parentCanvas != null)
		{
			overlayCanvas.sortingLayerID = parentCanvas.sortingLayerID;
			overlayCanvas.sortingOrder = Mathf.Max(parentCanvas.sortingOrder + 5000, 30000);
		}
		else
		{
			overlayCanvas.sortingOrder = Mathf.Max(overlayCanvas.sortingOrder, 30000);
		}

		overlayCanvas.overrideSorting = true;
	}
}
