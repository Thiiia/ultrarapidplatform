using System;
using System.Collections;
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;
using LeTai.Asset.TranslucentImage;
using LeTai.Paraform.Scaffold;

public partial class DragExecutionController
{
	private void SetupDefaultTrailGradient()
	{
		if (trailGradient == null || trailGradient.colorKeys.Length == 0)
		{
			trailGradient = new Gradient();
			trailGradient.SetKeys(
				new GradientColorKey[]
				{
					new GradientColorKey(AlgebraUiPalette.JudgementRed, 0f),
					new GradientColorKey(AlgebraUiPalette.JudgementYellow, 0.5f),
					new GradientColorKey(AlgebraUiPalette.JudgementGreen, 1f)
				},
				new GradientAlphaKey[]
				{
					new GradientAlphaKey(0.8f, 0f),
					new GradientAlphaKey(0.6f, 0.5f),
					new GradientAlphaKey(0.3f, 1f)
				}
			);
		}
	}

	private IEnumerator AnimateSignChange(EquationBubbleElement element, StepOption operation, Action onComplete)
	{
		if (operation != null && operation.operationType == OperationType.MultiplyByNegativeOne)
		{
			if (equationContainer != null)
			{
				equationContainer.DOKill();
				equationContainer.DOPunchRotation(new Vector3(0f, 0f, 10f), signFlipDuration, 8, 0.7f);
			}
		}

		Transform outline = element.transform.Find("Outline");
		if (outline != null)
		{
			Image outlineImage = outline.GetComponent<Image>();
			if (outlineImage != null)
			{
				Color originalColor = outlineImage.color;
				outlineImage.DOKill(false);

				Sequence flashSequence = DOTween.Sequence();
				flashSequence.SetLink(outlineImage.gameObject, LinkBehaviour.KillOnDestroy);
				flashSequence.Append(outlineImage.DOColor(Color.yellow, signFlipDuration * 0.5f));
				flashSequence.Append(outlineImage.DOColor(originalColor, signFlipDuration * 0.5f));
			}
		}

		yield return new WaitForSeconds(signFlipDuration);

		onComplete?.Invoke();
	}

	private static void TryConfigureTranslucentCircle(GameObject obj, RectTransform rect)
	{
		if (obj == null || rect == null)
		{
			return;
		}

		TranslucentImage translucentImage = obj.GetComponent<TranslucentImage>();
		if (translucentImage == null)
		{
			return;
		}

		float diameter = Mathf.Max(1f, Mathf.Min(rect.rect.width, rect.rect.height));
		float radius = diameter * 0.5f;

		ParaformConfig config = translucentImage.paraformConfig;
		config.CornerRadii = new Vector4(radius, radius, radius, radius);
		translucentImage.paraformConfig = config;
		translucentImage.SetVerticesDirty();
	}

	private static void TryConfigureTranslucentCapsule(GameObject obj, RectTransform rect)
	{
		if (obj == null || rect == null)
		{
			return;
		}

		TranslucentImage translucentImage = obj.GetComponent<TranslucentImage>();
		if (translucentImage == null)
		{
			return;
		}

		float height = Mathf.Max(1f, rect.rect.height);
		float radius = height * 0.5f;

		ParaformConfig config = translucentImage.paraformConfig;
		config.CornerRadii = new Vector4(radius, radius, radius, radius);
		translucentImage.paraformConfig = config;
		translucentImage.SetVerticesDirty();
	}
}
