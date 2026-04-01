using DG.Tweening;
using UnityEngine;

public partial class DragExecutionController
{
	private void ShowFeedback(string message, Color color, HitResult hitResult = HitResult.None, float signedErrorMs = float.NaN, float normalizedToMiss = float.NaN)
	{
		bool isTimingJudgement = hitResult != HitResult.None;
		if (isTimingJudgement)
		{
			TryShowFeedbackTooltip(message, color, hitResult, signedErrorMs, normalizedToMiss);
			if (!feedbackTooltipAllowConcurrentWithContextual)
			{
				HideContextualGuidanceTooltipImmediate();
			}
		}

		TryEnsureFeedbackChip();

		if (feedbackChipUI != null)
		{
			if (feedbackChipPositionNearDropZone && currentDropZone != null)
			{
				TryPositionFeedbackChipNearDropZone();
			}

			feedbackChipUI.ShowJudgement(message, color, hitResult, signedErrorMs, normalizedToMiss);
			return;
		}

		if (feedbackText == null)
		{
			return;
		}

		feedbackText.text = message;
		feedbackText.color = color;
		feedbackText.alpha = 1f;

		feedbackText.transform.localScale = Vector3.one * 0.5f;
		feedbackText.transform.DOScale(1f, AlgebraMotionPresets.UiFast).SetEase(AlgebraMotionPresets.UiEasePop);

		float fadeDuration = Mathf.Max(feedbackDuration, AlgebraMotionPresets.UiSoft);
		feedbackText.DOFade(0f, fadeDuration).SetDelay(AlgebraMotionPresets.UiFast);
	}

	private void TryEnsureFeedbackChip()
	{
		// If explicitly wired, keep it.
		if (feedbackChipUI != null)
		{
			return;
		}

		// Try to find an instance in the scene.
		TryAutoFindFeedbackChipUI();
		if (feedbackChipUI != null)
		{
			return;
		}

		// If no instance, instantiate prefab on demand.
		if (feedbackChipPrefab == null || feedbackChipInstance != null)
		{
			if (feedbackChipInstance != null)
			{
				feedbackChipUI = feedbackChipInstance;
			}
			return;
		}

		RectTransform parent = null;
		if (equationContainer != null)
		{
			Canvas canvas = equationContainer.GetComponentInParent<Canvas>();
			if (canvas != null)
			{
				parent = canvas.transform as RectTransform;
			}
		}

		feedbackChipInstance = parent != null
			? Instantiate(feedbackChipPrefab, parent)
			: Instantiate(feedbackChipPrefab);

		feedbackChipUI = feedbackChipInstance;
		feedbackChipInstance.gameObject.SetActive(false);
	}

	private void TryPositionFeedbackChipNearDropZone()
	{
		if (feedbackChipUI == null || currentDropZone == null)
		{
			return;
		}

		RectTransform chipRect = feedbackChipUI.GetComponent<RectTransform>();
		RectTransform targetRect = currentDropZone.RectTransform;
		if (chipRect == null || targetRect == null)
		{
			return;
		}

		RectTransform chipParent = chipRect.parent as RectTransform;
		if (chipParent == null)
		{
			return;
		}

		Canvas canvas = chipRect.GetComponentInParent<Canvas>();
		Camera cam = null;
		if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
		{
			cam = canvas.worldCamera;
		}

		Vector3 world = targetRect.TransformPoint(targetRect.rect.center);
		Vector2 screen = RectTransformUtility.WorldToScreenPoint(cam, world);
		if (RectTransformUtility.ScreenPointToLocalPointInRectangle(chipParent, screen, cam, out Vector2 local))
		{
			Vector2 offset = feedbackChipDropZoneOffset;
			if (feedbackChipAutoFlipOffset)
			{
				// Prefer the OUTER side of the drop zone (right zone -> chip on right, left zone -> chip on left).
				if (Mathf.Abs(local.x) > 0.001f)
				{
					offset.x = local.x > 0f ? Mathf.Abs(offset.x) : -Mathf.Abs(offset.x);
				}

				// If the drop zone is near the top, prefer placing the chip lower.
				float halfH = chipParent.rect.height * 0.5f;
				if (local.y > halfH * 0.25f)
				{
					offset.y = -Mathf.Abs(offset.y);
				}
			}

			Vector2 pos = local + offset;

			// Push away from the drop zone if we overlap (prevents "chip inside target").
			if (TryGetLocalRect(targetRect, chipParent, cam, out Rect dz) &&
			    TryGetLocalRect(chipRect, chipParent, cam, out Rect chipR))
			{
				// First apply position, then compute overlap at that point.
				chipR.center = pos;
				if (dz.Overlaps(chipR))
				{
					// Push horizontally away from dz center.
					float dir = Mathf.Sign(pos.x - dz.center.x);
					if (Mathf.Abs(dir) < 0.01f)
					{
						dir = offset.x >= 0f ? 1f : -1f;
					}

					float push = (dz.width * 0.5f) + (chipR.width * 0.5f) + feedbackChipAvoidDropZonePadding;
					pos.x = dz.center.x + (push * dir);
				}
			}

			if (feedbackChipClampToScreen)
			{
				Vector2 half = chipRect.rect.size * 0.5f;
				Rect parentRect = chipParent.rect;
				pos.x = Mathf.Clamp(pos.x, parentRect.xMin + half.x + feedbackChipScreenPadding, parentRect.xMax - half.x - feedbackChipScreenPadding);
				pos.y = Mathf.Clamp(pos.y, parentRect.yMin + half.y + feedbackChipScreenPadding, parentRect.yMax - half.y - feedbackChipScreenPadding);
			}

			chipRect.anchoredPosition = pos;
			chipRect.SetAsLastSibling();
		}
	}

	private void TryAutoFindFeedbackChipUI()
	{
		if (feedbackChipUI != null || triedAutoFindFeedbackChipUI)
		{
			return;
		}

		triedAutoFindFeedbackChipUI = true;

		// Prefer something under the same Canvas as the equation UI.
		if (equationContainer != null)
		{
			Canvas canvas = equationContainer.GetComponentInParent<Canvas>();
			if (canvas != null)
			{
				feedbackChipUI = canvas.GetComponentInChildren<FeedbackChipUI>(true);
				if (feedbackChipUI != null)
				{
					return;
				}
			}
		}

		// Fallback: search the scene (includes inactive objects).
		FeedbackChipUI[] all = Resources.FindObjectsOfTypeAll<FeedbackChipUI>();
		for (int i = 0; i < all.Length; i++)
		{
			FeedbackChipUI chip = all[i];
			if (chip == null)
			{
				continue;
			}

			// Skip prefab assets; only bind scene objects.
			if (!chip.gameObject.scene.IsValid())
			{
				continue;
			}

			feedbackChipUI = chip;
			return;
		}
	}
}
