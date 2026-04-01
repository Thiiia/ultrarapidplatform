using System;
using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;

using TMPro;

using DG.Tweening;

using TooltipSpecial = RainbowArt.CleanFlatUI.TooltipSpecial;

public partial class DragExecutionController
{
	[Header("Feedback")]
	[SerializeField] private TextMeshProUGUI feedbackText;
	[SerializeField] private float feedbackDuration = 1f;
	[SerializeField, Tooltip("Optional: Figma-style feedback chip UI (sprite-swapped translucent image). If set, this is preferred over plain feedbackText.")]
	private FeedbackChipUI feedbackChipUI;
	private bool triedAutoFindFeedbackChipUI;
	[SerializeField, Tooltip("If enabled and feedbackChipUI is set, the chip is positioned near the active drop zone when showing drag timing feedback.")]
	private bool feedbackChipPositionNearDropZone = true;
	[SerializeField] private Vector2 feedbackChipDropZoneOffset = new Vector2(120f, 0f);
	[SerializeField, Tooltip("Keeps the chip fully on screen (clamped to its parent rect).")]
	private bool feedbackChipClampToScreen = true;
	[SerializeField, Min(0f)] private float feedbackChipScreenPadding = 18f;
	[Tooltip("If the chip overlaps the drop zone, it is pushed away by this many pixels.")]
	[SerializeField, Min(0f)] private float feedbackChipAvoidDropZonePadding = 14f;
	[SerializeField, Tooltip("Auto-flips the chip offset so it prefers the inside of the play area.")]
	private bool feedbackChipAutoFlipOffset = true;
	[SerializeField, Tooltip("Optional: if feedbackChipUI is not set, instantiate this prefab on demand (kept disabled when not used).")]
	private FeedbackChipUI feedbackChipPrefab;
	private FeedbackChipUI feedbackChipInstance;
	[SerializeField, Tooltip("Optional: CleanFlatUI tooltip instance (ex: TooltipSpecialRound) used for timing/judgement feedback instead of the feedback chip.")]
	private TooltipSpecial feedbackTooltipUI;
	[SerializeField, Tooltip("Optional: if feedbackTooltipUI is not set, instantiate this prefab on demand (assign TooltipSpecialRound here).")]
	private TooltipSpecial feedbackTooltipPrefab;
	[SerializeField, Tooltip("If enabled, timing/judgement feedback (Perfect/Good/Early/Late/Miss) is shown with TooltipSpecial when available.")]
	private bool feedbackTooltipUseForTimingJudgements = true;
	[SerializeField, Tooltip("Allows contextual guidance tooltip + judgement tooltip to be visible at the same time when they use separate instances.")]
	private bool feedbackTooltipAllowConcurrentWithContextual = true;
	[SerializeField] private Vector2 feedbackTooltipPerfectOffset = new Vector2(0f, 104f);
	[SerializeField] private Vector2 feedbackTooltipGoodOffset = new Vector2(0f, 92f);
	[SerializeField] private Vector2 feedbackTooltipEarlyOffset = new Vector2(-132f, 70f);
	[SerializeField] private Vector2 feedbackTooltipLateOffset = new Vector2(132f, 70f);
	[SerializeField] private Vector2 feedbackTooltipMissOffset = new Vector2(0f, 58f);
	[SerializeField] private Vector2 feedbackTooltipInfoOffset = new Vector2(0f, 84f);
	[SerializeField, Min(0f)] private float feedbackTooltipAutoHideSeconds = 1.35f;
	[SerializeField, Tooltip("Tint TooltipSpecialRound background/view/text to match the current feedback color.")]
	private bool tooltipSpecialUseDynamicColor = true;
	[SerializeField, Tooltip("Clamp TooltipSpecial instances fully inside their parent canvas/rect.")]
	private bool tooltipSpecialClampToParentBounds = true;
	[SerializeField, Min(0f)] private float tooltipSpecialParentBoundsPadding = 18f;
	[SerializeField, Tooltip("Push TooltipSpecial instances away from the locked/reference equation HUD when they overlap.")]
	private bool tooltipSpecialAvoidLockedEquation = true;
	[SerializeField, Min(0f)] private float tooltipSpecialAvoidLockedEquationPadding = 14f;
	[SerializeField, Tooltip("Apply runtime typography polish to TooltipSpecial description text (spacing, sizing, rich-text formatting).")]
	private bool tooltipSpecialEnhanceTypography = true;
	[SerializeField, Tooltip("Use DOTween typewriter reveal on tooltip copy (with bounce/fade popup). Tooltip wave-style per-character effects stay disabled.")]
	private bool tooltipSpecialUseTextAnimator = true;
	[SerializeField, Min(10f), Tooltip("Characters per second for tooltip text type-in reveal (used instead of wave-like text effects).")]
	private float tooltipSpecialTypewriterCharsPerSecond = 90f;
	[SerializeField, Min(0.05f)] private float tooltipSpecialTypewriterMaxSeconds = 0.42f;
	[SerializeField, Range(1f, 1.2f)] private float tooltipSpecialDotweenPopScale = 1.035f;
	[SerializeField, Min(0f)] private float tooltipSpecialDotweenRise = 10f;
	[SerializeField, Min(0.04f)] private float tooltipSpecialDotweenShowSeconds = 0.16f;
	[SerializeField, Range(0f, 6f)] private float tooltipSpecialDotweenPunchRotation = 1.2f;
	[SerializeField] private AudioSource audioSource;
	[SerializeField] private AudioClip successSound;
	[SerializeField] private AudioClip failSound;

	private bool triedAutoFindFeedbackTooltipUI;
	private bool triedAutoFindContextualGuidanceTooltipUI;
	private TooltipSpecial feedbackTooltipInstance;
	private Tween feedbackTooltipHideTween;
	private TooltipSpecial contextualGuidanceTooltipInstance;
	private Tween contextualGuidanceTooltipHideTween;

	private bool TryShowContextualGuidanceTooltip(string message, Color accentColor, HitResult timingHitResult, float signedErrorMs)
	{
		if (string.IsNullOrWhiteSpace(message))
		{
			return false;
		}

		TryEnsureContextualGuidanceTooltip();
		if (contextualGuidanceTooltipUI == null)
		{
			return false;
		}

		RectTransform tooltipRect = contextualGuidanceTooltipUI.transform as RectTransform;
		RectTransform tooltipParent = tooltipRect != null ? tooltipRect.parent as RectTransform : null;
		if (tooltipRect == null || tooltipParent == null)
		{
			return false;
		}

		Vector2 anchorLocal = Vector2.zero;
		if (TryResolveContextualGuidanceTooltipAnchor(tooltipParent, out Vector2 resolvedAnchor))
		{
			anchorLocal = resolvedAnchor;
		}

		if (contextualGuidanceTooltipUI == feedbackTooltipUI)
		{
			feedbackTooltipHideTween?.Kill();
			feedbackTooltipHideTween = null;
		}

		ApplyTooltipSpecialContent(
			contextualGuidanceTooltipUI,
			BuildContextualGuidanceTooltipMessage(message, timingHitResult, signedErrorMs),
			accentColor);
		contextualGuidanceTooltipUI.InitTooltip(anchorLocal + contextualGuidanceTooltipOffset, tooltipParent);
		contextualGuidanceTooltipUI.ShowTooltip();
		ApplyTooltipSpecialPlacementSafety(contextualGuidanceTooltipUI, tooltipParent);
		PlayTooltipSpecialPresentationAnimation(contextualGuidanceTooltipUI);
		ScheduleContextualGuidanceTooltipHide();
		return true;
	}

	private static string BuildContextualGuidanceTooltipMessage(string message, HitResult timingHitResult, float signedErrorMs)
	{
		string baseMessage = string.IsNullOrWhiteSpace(message) ? string.Empty : message.Trim();
		string timingText = FormatTimingErrorTextForTooltip(timingHitResult, signedErrorMs);
		if (string.IsNullOrEmpty(timingText))
		{
			return baseMessage;
		}

		if (string.IsNullOrEmpty(baseMessage))
		{
			return timingText;
		}

		return baseMessage + "\n" + timingText;
	}

	private static string FormatTimingErrorTextForTooltip(HitResult timingHitResult, float signedErrorMs)
	{
		// Mirror FeedbackChipUI timing label behavior for contextual hints: only show for timing-based outcomes.
		if (timingHitResult == HitResult.None || float.IsNaN(signedErrorMs))
		{
			return string.Empty;
		}

		float abs = Mathf.Abs(signedErrorMs);
		const float hideUnderMs = 2f; // matches FeedbackChipUI default
		if (abs < hideUnderMs)
		{
			return string.Empty;
		}

		int ms = Mathf.RoundToInt(signedErrorMs);
		return $"Timing: {(ms >= 0 ? "+" : "")}{ms}ms";
	}

	private void TryEnsureContextualGuidanceTooltip()
	{
		if (contextualGuidanceTooltipUI != null)
		{
			return;
		}

		TryAutoFindContextualGuidanceTooltip();
		if (contextualGuidanceTooltipUI != null)
		{
			return;
		}

		TooltipSpecial prefab = contextualGuidanceTooltipPrefab != null ? contextualGuidanceTooltipPrefab : feedbackTooltipPrefab;
		if (prefab == null || contextualGuidanceTooltipInstance != null)
		{
			if (contextualGuidanceTooltipInstance != null)
			{
				contextualGuidanceTooltipUI = contextualGuidanceTooltipInstance;
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

		contextualGuidanceTooltipInstance = parent != null
			? Instantiate(prefab, parent)
			: Instantiate(prefab);

		contextualGuidanceTooltipUI = contextualGuidanceTooltipInstance;
		contextualGuidanceTooltipUI.HideTooltip();
	}

	private void TryAutoFindContextualGuidanceTooltip()
	{
		if (contextualGuidanceTooltipUI != null || triedAutoFindContextualGuidanceTooltipUI)
		{
			return;
		}

		triedAutoFindContextualGuidanceTooltipUI = true;

		if (equationContainer != null)
		{
			Canvas c = equationContainer.GetComponentInParent<Canvas>();
			if (c != null)
			{
				TooltipSpecial[] local = c.GetComponentsInChildren<TooltipSpecial>(true);
				for (int i = 0; i < local.Length; i++)
				{
					TooltipSpecial tooltip = local[i];
					if (tooltip == null || tooltip == feedbackTooltipUI)
					{
						continue;
					}

					contextualGuidanceTooltipUI = tooltip;
					return;
				}
			}
		}

		TooltipSpecial[] all = Resources.FindObjectsOfTypeAll<TooltipSpecial>();
		for (int i = 0; i < all.Length; i++)
		{
			TooltipSpecial tooltip = all[i];
			if (tooltip == null || tooltip == feedbackTooltipUI)
			{
				continue;
			}

			if (!tooltip.gameObject.scene.IsValid())
			{
				continue;
			}

			contextualGuidanceTooltipUI = tooltip;
			return;
		}
	}

	private bool TryResolveContextualGuidanceTooltipAnchor(RectTransform tooltipParent, out Vector2 anchorLocal)
	{
		anchorLocal = Vector2.zero;
		if (tooltipParent == null)
		{
			return false;
		}

		Camera cam = ResolveUiCameraForRect(tooltipParent);
		if (feedbackTooltipUI != null)
		{
			RectTransform feedbackTooltipRect = feedbackTooltipUI.transform as RectTransform;
			if (feedbackTooltipRect != null && feedbackTooltipRect.gameObject.activeInHierarchy &&
				TryGetLocalRect(feedbackTooltipRect, tooltipParent, cam, out Rect feedbackTooltipBounds))
			{
				anchorLocal = new Vector2(feedbackTooltipBounds.center.x, feedbackTooltipBounds.yMax);
				return true;
			}
		}

		TryEnsureFeedbackChip();
		if (feedbackChipUI != null)
		{
			if (feedbackChipPositionNearDropZone && currentDropZone != null)
			{
				TryPositionFeedbackChipNearDropZone();
			}

			RectTransform chipRect = feedbackChipUI.transform as RectTransform;
			if (chipRect != null && TryGetLocalRect(chipRect, tooltipParent, cam, out Rect chipBounds))
			{
				anchorLocal = new Vector2(chipBounds.center.x, chipBounds.yMax);
				return true;
			}
		}

		if (currentDropZone != null && currentDropZone.RectTransform != null &&
			TryGetLocalRect(currentDropZone.RectTransform, tooltipParent, cam, out Rect dropZoneBounds))
		{
			Vector2 fallbackOffset = feedbackChipPositionNearDropZone ? feedbackChipDropZoneOffset : Vector2.zero;
			if (feedbackChipAutoFlipOffset && Mathf.Abs(dropZoneBounds.center.x) > 0.001f)
			{
				fallbackOffset.x = dropZoneBounds.center.x > 0f ? Mathf.Abs(fallbackOffset.x) : -Mathf.Abs(fallbackOffset.x);
			}

			anchorLocal = dropZoneBounds.center + fallbackOffset;
			return true;
		}

		if (equationContainer != null && TryGetLocalRect(equationContainer, tooltipParent, cam, out Rect eqBounds))
		{
			anchorLocal = new Vector2(eqBounds.center.x, eqBounds.yMax);
			return true;
		}

		return false;
	}

	private void ScheduleContextualGuidanceTooltipHide()
	{
		contextualGuidanceTooltipHideTween?.Kill();
		contextualGuidanceTooltipHideTween = null;

		if (contextualGuidanceTooltipUI == null || contextualGuidanceTooltipAutoHideSeconds <= 0f)
		{
			return;
		}

		contextualGuidanceTooltipHideTween = DOVirtual.DelayedCall(contextualGuidanceTooltipAutoHideSeconds, () =>
		{
			contextualGuidanceTooltipHideTween = null;
			if (contextualGuidanceTooltipUI != null)
			{
				contextualGuidanceTooltipUI.HideTooltip();
			}
		}).SetUpdate(true);
	}

	private void HideContextualGuidanceTooltipImmediate()
	{
		contextualGuidanceTooltipHideTween?.Kill();
		contextualGuidanceTooltipHideTween = null;

		if (contextualGuidanceTooltipUI == null)
		{
			return;
		}

		contextualGuidanceTooltipUI.HideTooltip();
	}

	private bool TryShowFeedbackTooltip(string message, Color accentColor, HitResult hitResult, float signedErrorMs, float normalizedToMiss)
	{
		if (!feedbackTooltipUseForTimingJudgements || hitResult == HitResult.None)
		{
			return false;
		}

		TryEnsureFeedbackTooltip();
		if (feedbackTooltipUI == null)
		{
			return false;
		}

		RectTransform tooltipRect = feedbackTooltipUI.transform as RectTransform;
		RectTransform tooltipParent = tooltipRect != null ? tooltipRect.parent as RectTransform : null;
		if (tooltipRect == null || tooltipParent == null)
		{
			return false;
		}

		Vector2 anchorLocal = Vector2.zero;
		TryResolveFeedbackTooltipAnchor(tooltipParent, hitResult, signedErrorMs, out anchorLocal);

		if (feedbackTooltipUI == contextualGuidanceTooltipUI)
		{
			contextualGuidanceTooltipHideTween?.Kill();
			contextualGuidanceTooltipHideTween = null;
		}

		string tooltipMessage = BuildFeedbackTooltipMessage(message, hitResult, signedErrorMs, normalizedToMiss);
		if (string.IsNullOrWhiteSpace(tooltipMessage))
		{
			return false;
		}

		ApplyTooltipSpecialContent(feedbackTooltipUI, tooltipMessage, accentColor);
		feedbackTooltipUI.InitTooltip(anchorLocal + GetFeedbackTooltipOffset(hitResult, signedErrorMs), tooltipParent);
		feedbackTooltipUI.ShowTooltip();
		ApplyTooltipSpecialPlacementSafety(feedbackTooltipUI, tooltipParent);
		PlayTooltipSpecialPresentationAnimation(feedbackTooltipUI);
		ScheduleFeedbackTooltipHide();
		return true;
	}

	private void TryEnsureFeedbackTooltip()
	{
		if (feedbackTooltipUI != null)
		{
			return;
		}

		if (feedbackTooltipInstance != null)
		{
			feedbackTooltipUI = feedbackTooltipInstance;
			return;
		}

		TooltipSpecial prefab = feedbackTooltipPrefab != null ? feedbackTooltipPrefab : contextualGuidanceTooltipPrefab;
		if (prefab != null)
		{
			RectTransform parent = null;
			if (equationContainer != null)
			{
				Canvas canvas = equationContainer.GetComponentInParent<Canvas>();
				if (canvas != null)
				{
					parent = canvas.transform as RectTransform;
				}
			}

			feedbackTooltipInstance = parent != null
				? Instantiate(prefab, parent)
				: Instantiate(prefab);

			feedbackTooltipUI = feedbackTooltipInstance;
			feedbackTooltipUI.HideTooltip();
			return;
		}

		TryAutoFindFeedbackTooltip();
	}

	private void TryAutoFindFeedbackTooltip()
	{
		if (feedbackTooltipUI != null || triedAutoFindFeedbackTooltipUI)
		{
			return;
		}

		triedAutoFindFeedbackTooltipUI = true;

		if (equationContainer != null)
		{
			Canvas c = equationContainer.GetComponentInParent<Canvas>();
			if (c != null)
			{
				TooltipSpecial[] local = c.GetComponentsInChildren<TooltipSpecial>(true);
				for (int i = 0; i < local.Length; i++)
				{
					TooltipSpecial tooltip = local[i];
					if (tooltip == null || tooltip == contextualGuidanceTooltipUI)
					{
						continue;
					}

					feedbackTooltipUI = tooltip;
					return;
				}
			}
		}

		TooltipSpecial[] all = Resources.FindObjectsOfTypeAll<TooltipSpecial>();
		for (int i = 0; i < all.Length; i++)
		{
			TooltipSpecial tooltip = all[i];
			if (tooltip == null || tooltip == contextualGuidanceTooltipUI)
			{
				continue;
			}

			if (!tooltip.gameObject.scene.IsValid())
			{
				continue;
			}

			feedbackTooltipUI = tooltip;
			return;
		}
	}

	private bool TryResolveFeedbackTooltipAnchor(RectTransform tooltipParent, HitResult hitResult, float signedErrorMs, out Vector2 anchorLocal)
	{
		anchorLocal = Vector2.zero;
		if (tooltipParent == null)
		{
			return false;
		}

		Camera cam = ResolveUiCameraForRect(tooltipParent);

		if (currentDropZone != null && currentDropZone.RectTransform != null &&
			TryGetLocalRect(currentDropZone.RectTransform, tooltipParent, cam, out Rect dropZoneBounds))
		{
			if (hitResult == HitResult.Miss && !float.IsNaN(signedErrorMs))
			{
				anchorLocal = new Vector2(
					signedErrorMs < 0f ? dropZoneBounds.xMin : dropZoneBounds.xMax,
					dropZoneBounds.yMax);
			}
			else if (hitResult == HitResult.Miss)
			{
				anchorLocal = new Vector2(dropZoneBounds.center.x, dropZoneBounds.yMin);
			}
			else
			{
				anchorLocal = new Vector2(dropZoneBounds.center.x, dropZoneBounds.yMax);
			}

			return true;
		}

		if (currentDraggingElement != null && currentDraggingElement.RectTransform != null &&
			TryGetLocalRect(currentDraggingElement.RectTransform, tooltipParent, cam, out Rect dragBounds))
		{
			anchorLocal = new Vector2(dragBounds.center.x, dragBounds.yMax);
			return true;
		}

		if (equationContainer != null && TryGetLocalRect(equationContainer, tooltipParent, cam, out Rect eqBounds))
		{
			anchorLocal = new Vector2(eqBounds.center.x, eqBounds.yMax);
			return true;
		}

		return false;
	}

	private Vector2 GetFeedbackTooltipOffset(HitResult hitResult, float signedErrorMs)
	{
		return hitResult switch
		{
			HitResult.Perfect => feedbackTooltipPerfectOffset,
			HitResult.Good => feedbackTooltipGoodOffset,
			HitResult.Miss when !float.IsNaN(signedErrorMs) && signedErrorMs < 0f => feedbackTooltipEarlyOffset,
			HitResult.Miss when !float.IsNaN(signedErrorMs) && signedErrorMs >= 0f => feedbackTooltipLateOffset,
			HitResult.Miss => feedbackTooltipMissOffset,
			_ => feedbackTooltipInfoOffset,
		};
	}

	private string BuildFeedbackTooltipMessage(string message, HitResult hitResult, float signedErrorMs, float normalizedToMiss)
	{
		string baseMessage = NormalizeFeedbackTooltipExtraInfoText(StripJudgementPrefixForTooltip(message));
		string primaryExtra = string.IsNullOrEmpty(baseMessage)
			? BuildFeedbackTooltipSmartHint(hitResult, signedErrorMs)
			: baseMessage;

		if ((preventWrongMoves || restrictToOptimalMoves) && hitResult == HitResult.Miss)
		{
			primaryExtra = PrefixCorrectMoveTimingNote(primaryExtra);
		}

		string timingText = FormatTimingErrorTextForTooltip(hitResult, signedErrorMs);
		string marginText = FormatFeedbackTooltipWindowMarginText(normalizedToMiss);
		return JoinTooltipLines(primaryExtra, timingText, marginText);
	}

	private static string StripJudgementPrefixForTooltip(string message)
	{
		if (string.IsNullOrWhiteSpace(message))
		{
			return string.Empty;
		}

		string trimmed = message.Trim();
		if (trimmed.StartsWith("Perfect!", StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Perfect!".Length).TrimStart();
		if (trimmed.StartsWith("Good!", StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Good!".Length).TrimStart();
		if (trimmed.StartsWith("Early!", StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Early!".Length).TrimStart();
		if (trimmed.StartsWith("Late!", StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Late!".Length).TrimStart();
		if (trimmed.StartsWith("Miss!", StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Miss!".Length).TrimStart();
		return trimmed;
	}

	private static string NormalizeFeedbackTooltipExtraInfoText(string extra)
	{
		if (string.IsNullOrWhiteSpace(extra))
		{
			return string.Empty;
		}

		string value = extra.Trim();
		while (value.Length > 0)
		{
			char c = value[0];
			if (c == '-' || c == ':' || c == '|' || c == '•')
			{
				value = value.Substring(1).TrimStart();
				continue;
			}

			break;
		}

		return value;
	}

	private static string BuildFeedbackTooltipSmartHint(HitResult hitResult, float signedErrorMs)
	{
		switch (hitResult)
		{
			case HitResult.Perfect:
			{
				if (float.IsNaN(signedErrorMs))
				{
					return "Centered in the timing window.";
				}

				float abs = Mathf.Abs(signedErrorMs);
				if (abs < 6f)
				{
					return "Centered in the green window.";
				}

				return signedErrorMs < 0f
					? "Slightly early, but still in green."
					: "Slightly late, but still in green.";
			}
			case HitResult.Good:
			{
				if (float.IsNaN(signedErrorMs))
				{
					return "Close. Aim for the center of green.";
				}

				return signedErrorMs < 0f
					? "Close. Hold a touch longer before release."
					: "Close. Release a touch sooner.";
			}
			case HitResult.Miss:
			{
				if (float.IsNaN(signedErrorMs))
				{
					return "Missed the timing window. Track the center of green.";
				}

				float abs = Mathf.Abs(signedErrorMs);
				string magnitude = abs < 20f
					? "Barely missed."
					: (abs < 55f ? "Close miss." : "Large timing miss.");
				string direction = signedErrorMs < 0f
					? " Release later."
					: " Release earlier.";
				return magnitude + direction;
			}
			default:
				return string.Empty;
		}
	}

	private static string PrefixCorrectMoveTimingNote(string text)
	{
		const string prefix = "Correct move. Timing was off.";
		if (string.IsNullOrWhiteSpace(text))
		{
			return prefix;
		}

		if (text.StartsWith("Correct move", StringComparison.OrdinalIgnoreCase))
		{
			return text;
		}

		return prefix + " " + text;
	}

	private static string FormatFeedbackTooltipWindowMarginText(float normalizedToMiss)
	{
		if (float.IsNaN(normalizedToMiss))
		{
			return string.Empty;
		}

		int marginPercent = Mathf.RoundToInt((1f - Mathf.Clamp01(normalizedToMiss)) * 100f);
		return $"Window margin: {marginPercent}%";
	}

	private static string JoinTooltipLines(string line1, string line2, string line3)
	{
		List<string> lines = new List<string>(3);
		if (!string.IsNullOrWhiteSpace(line1)) lines.Add(line1.Trim());
		if (!string.IsNullOrWhiteSpace(line2)) lines.Add(line2.Trim());
		if (!string.IsNullOrWhiteSpace(line3)) lines.Add(line3.Trim());
		return lines.Count == 0 ? string.Empty : string.Join("\n", lines);
	}

	private void ScheduleFeedbackTooltipHide()
	{
		feedbackTooltipHideTween?.Kill();
		feedbackTooltipHideTween = null;

		if (feedbackTooltipUI == null || feedbackTooltipAutoHideSeconds <= 0f)
		{
			return;
		}

		feedbackTooltipHideTween = DOVirtual.DelayedCall(feedbackTooltipAutoHideSeconds, () =>
		{
			feedbackTooltipHideTween = null;
			if (feedbackTooltipUI != null)
			{
				feedbackTooltipUI.HideTooltip();
			}
		}).SetUpdate(true);
	}

	private void HideFeedbackTooltipImmediate()
	{
		feedbackTooltipHideTween?.Kill();
		feedbackTooltipHideTween = null;

		if (feedbackTooltipUI == null)
		{
			return;
		}

		feedbackTooltipUI.HideTooltip();
	}

	private void ApplyTooltipSpecialTheme(TooltipSpecial tooltip, Color accentColor)
	{
		if (!tooltipSpecialUseDynamicColor || tooltip == null)
		{
			return;
		}

		Color accent = accentColor;
		accent.a = 1f;
		Color bgTint = Color.Lerp(new Color(0.14f, 0.14f, 0.16f, 1f), accent, 0.72f);
		Color viewTint = Color.Lerp(new Color(0.1f, 0.1f, 0.12f, 1f), accent, 0.9f);
		// Keep tooltip copy near-black with a hint of the accent hue for readability and stronger visual grounding.
		Color textTint = Color.Lerp(new Color(0.02f, 0.02f, 0.03f, 1f), accent, 0.22f);

		Graphic[] graphics = tooltip.GetComponentsInChildren<Graphic>(true);
		for (int i = 0; i < graphics.Length; i++)
		{
			Graphic g = graphics[i];
			if (g == null || g is TMP_Text)
			{
				continue;
			}

			string nameLower = g.gameObject.name.ToLowerInvariant();
			Color target = nameLower.Contains("background")
				? bgTint
				: (nameLower.Contains("view") ? viewTint : Color.Lerp(g.color, viewTint, 0.35f));

			g.color = PreserveRgbWithAlpha(target, g.color.a);
		}

		TMP_Text[] texts = tooltip.GetComponentsInChildren<TMP_Text>(true);
		for (int i = 0; i < texts.Length; i++)
		{
			TMP_Text text = texts[i];
			if (text == null)
			{
				continue;
			}

			// Always restore readable alpha; tooltip hides can interrupt fades and leave TMP alpha at 0.
			text.color = PreserveRgbWithAlpha(textTint, 1f);
		}
	}

	private static Color PreserveRgbWithAlpha(Color rgbSource, float alpha)
	{
		rgbSource.a = alpha;
		return rgbSource;
	}

	private void ApplyTooltipSpecialContent(TooltipSpecial tooltip, string rawMessage, Color accentColor)
	{
		if (tooltip == null)
		{
			return;
		}

		ApplyTooltipSpecialTheme(tooltip, accentColor);
		SetTooltipSpecialDescriptionText(tooltip, rawMessage);
	}

	private void PlayTooltipSpecialPresentationAnimation(TooltipSpecial tooltip)
	{
		if (tooltip == null)
		{
			return;
		}

		RectTransform root = tooltip.transform as RectTransform;
		if (root != null)
		{
			root.DOKill(false);
			Vector2 basePos = root.anchoredPosition;
			root.localScale = Vector3.one * 0.96f;
			root.anchoredPosition = basePos + new Vector2(0f, -Mathf.Abs(tooltipSpecialDotweenRise));

			Sequence seq = DOTween.Sequence().SetUpdate(true).SetTarget(root);
			seq.Append(root.DOAnchorPos(basePos, Mathf.Max(0.04f, tooltipSpecialDotweenShowSeconds)).SetEase(Ease.OutCubic));
			seq.Join(root.DOScale(tooltipSpecialDotweenPopScale, Mathf.Max(0.04f, tooltipSpecialDotweenShowSeconds * 0.9f)).SetEase(Ease.OutBack));
			seq.Append(root.DOScale(1f, Mathf.Max(0.04f, tooltipSpecialDotweenShowSeconds * 0.75f)).SetEase(Ease.OutQuad));

			if (tooltipSpecialDotweenPunchRotation > 0f)
			{
				root.localRotation = Quaternion.identity;
				root.DOPunchRotation(new Vector3(0f, 0f, tooltipSpecialDotweenPunchRotation), 0.22f, 8, 0.75f).SetUpdate(true);
			}
		}

		TextMeshProUGUI description = TryGetTooltipSpecialDescriptionText(tooltip);
		if (description != null)
		{
			description.DOKill(false);
			Color c = description.color;
			float baseAlpha = Mathf.Max(0.98f, c.a);
			c.a = 0f;
			description.color = c;
			description.DOFade(baseAlpha, Mathf.Max(0.05f, tooltipSpecialDotweenShowSeconds * 1.1f)).SetEase(Ease.OutQuad).SetUpdate(true);

			// Start the typewriter after TooltipSpecial.InitTooltip()/ShowTooltip have already
			// measured the full text. Starting earlier can shrink the tooltip height to the
			// partially revealed text and clip the rest.
			if (tooltipSpecialUseTextAnimator)
			{
				StartTooltipSpecialTypewriterReveal(description);
			}
		}
	}

	private void SetTooltipSpecialDescriptionText(TooltipSpecial tooltip, string rawMessage)
	{
		if (tooltip == null)
		{
			return;
		}

		TextMeshProUGUI description = TryGetTooltipSpecialDescriptionText(tooltip);
		string stable = BuildTooltipSpecialRichText(rawMessage, headlineAnimatorTag: null);
		if (description == null)
		{
			tooltip.DescriptionValue = string.IsNullOrWhiteSpace(rawMessage) ? string.Empty : rawMessage.Trim();
			return;
		}

		if (tooltipSpecialEnhanceTypography)
		{
			ApplyTooltipSpecialTypography(description);
		}

		// Disable any lingering Febucci component on tooltip copy. The tooltip should type in,
		// not wave/pulse per-character (that can feel visually uncomfortable).
		TryDisableTextAnimator(description);

		description.text = stable;
		description.maxVisibleCharacters = int.MaxValue;
	}

	private void ApplyTooltipSpecialTypography(TextMeshProUGUI description)
	{
		if (description == null)
		{
			return;
		}

		description.richText = true;
		description.textWrappingMode = TextWrappingModes.Normal;
		description.overflowMode = TextOverflowModes.Overflow;
		description.alignment = TextAlignmentOptions.TopLeft;
		description.enableAutoSizing = true;
		description.fontSizeMin = 17f;
		description.fontSizeMax = 24f;
		description.lineSpacing = 2f;
		description.paragraphSpacing = 4f;
		description.margin = new Vector4(0f, 0f, 2f, 0f);
	}

	private void StartTooltipSpecialTypewriterReveal(TextMeshProUGUI description)
	{
		if (description == null)
		{
			return;
		}

		RectTransform tweenTarget = description.rectTransform;
		if (tweenTarget != null)
		{
			DOTween.Kill(tweenTarget, complete: false);
		}

		description.ForceMeshUpdate();
		int totalVisibleChars = description.textInfo != null ? description.textInfo.characterCount : 0;
		if (totalVisibleChars <= 0)
		{
			description.maxVisibleCharacters = int.MaxValue;
			return;
		}

		description.maxVisibleCharacters = 0;
		float cps = Mathf.Max(10f, tooltipSpecialTypewriterCharsPerSecond);
		float duration = Mathf.Clamp(totalVisibleChars / cps, 0.07f, Mathf.Max(0.07f, tooltipSpecialTypewriterMaxSeconds));

		DOVirtual.Int(0, totalVisibleChars, duration, v =>
		{
			if (description != null)
			{
				description.maxVisibleCharacters = v;
			}
		})
		.SetEase(Ease.Linear)
		.SetUpdate(true)
		.SetTarget(tweenTarget != null ? (object)tweenTarget : description);
	}

	private static TextMeshProUGUI TryGetTooltipSpecialDescriptionText(TooltipSpecial tooltip)
	{
		if (tooltip == null)
		{
			return null;
		}

		TextMeshProUGUI[] texts = tooltip.GetComponentsInChildren<TextMeshProUGUI>(true);
		if (texts == null || texts.Length == 0)
		{
			return null;
		}

		for (int i = 0; i < texts.Length; i++)
		{
			TextMeshProUGUI tmp = texts[i];
			if (tmp == null)
			{
				continue;
			}

			if (tmp.gameObject.name.IndexOf("description", StringComparison.OrdinalIgnoreCase) >= 0)
			{
				return tmp;
			}
		}

		return texts[0];
	}

	private static string BuildTooltipSpecialRichText(string rawMessage, string headlineAnimatorTag)
	{
		if (string.IsNullOrWhiteSpace(rawMessage))
		{
			return string.Empty;
		}

		string[] split = rawMessage.Replace("\r", string.Empty).Split('\n');
		List<string> lines = new List<string>(split.Length);
		for (int i = 0; i < split.Length; i++)
		{
			string line = split[i]?.Trim();
			if (!string.IsNullOrWhiteSpace(line))
			{
				lines.Add(line);
			}
		}

		if (lines.Count == 0)
		{
			return string.Empty;
		}

		int headlineIndex = -1;
		for (int i = 0; i < lines.Count; i++)
		{
			if (!IsTooltipMetricLine(lines[i]))
			{
				headlineIndex = i;
				break;
			}
		}

		System.Text.StringBuilder sb = new System.Text.StringBuilder(lines.Count * 32);
		for (int i = 0; i < lines.Count; i++)
		{
			if (i > 0)
			{
				sb.Append('\n');
			}

			string line = lines[i];
			bool isMetric = IsTooltipMetricLine(line);
			string display = isMetric && !line.StartsWith("- ", StringComparison.Ordinal) ? $"- {line}" : line;

			if (i == headlineIndex)
			{
				if (!string.IsNullOrWhiteSpace(headlineAnimatorTag))
				{
					sb.Append('<').Append(headlineAnimatorTag).Append('>');
				}

				sb.Append("<b>").Append(display).Append("</b>");

				if (!string.IsNullOrWhiteSpace(headlineAnimatorTag))
				{
					sb.Append("</>");
				}
				continue;
			}

			if (isMetric)
			{
				sb.Append("<size=82%>").Append(display).Append("</size>");
			}
			else
			{
				sb.Append("<size=90%>").Append(display).Append("</size>");
			}
		}

		return sb.ToString();
	}

	private static bool IsTooltipMetricLine(string line)
	{
		if (string.IsNullOrWhiteSpace(line))
		{
			return false;
		}

		string trimmed = line.TrimStart('•', '-', ' ').TrimStart();
		return trimmed.StartsWith("Timing:", StringComparison.OrdinalIgnoreCase) ||
		       trimmed.StartsWith("Window margin:", StringComparison.OrdinalIgnoreCase);
	}
}
