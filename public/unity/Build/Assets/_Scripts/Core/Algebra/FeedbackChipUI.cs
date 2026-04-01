using DG.Tweening;

using TMPro;

using UnityEngine;
using UnityEngine.UI;

using LeTai.Asset.TranslucentImage;

/// <summary>
/// Small HUD chip that shows hit feedback (Perfect/Good/Early/Late/Miss/etc).
/// Designed to be easy to prefab: a single root with a TranslucentImage + optional TMP label.
/// </summary>
public sealed class FeedbackChipUI : MonoBehaviour
{
	public enum ChipKind
	{
		None = 0,
		Perfect,
		Good,
		Early,
		Late,
		Miss,
		Info,
	}

	[Header("References")]
	[SerializeField] private TranslucentImage background;
	[SerializeField] private TMP_Text label;
	[SerializeField] private TMP_Text timingErrorLabel;
	[SerializeField] private CanvasGroup canvasGroup;

	[Header("Sprites")]
	[SerializeField] private Sprite perfectSprite;
	[SerializeField] private Sprite goodSprite;
	[SerializeField] private Sprite earlySprite;
	[SerializeField] private Sprite lateSprite;
	[SerializeField] private Sprite missSprite;
	[SerializeField] private Sprite infoSprite;

	[Header("Animation")]
	[SerializeField] private bool useSharedAlgebraMotionPreset = true;
	[SerializeField, Min(0f)] private float showFadeSeconds = 0.08f;
	[SerializeField, Min(0f)] private float holdSeconds = 0.55f;
	[SerializeField, Min(0f)] private float hideFadeSeconds = 0.18f;
	[SerializeField] private Ease showEase = Ease.OutQuad;
	[SerializeField] private Ease hideEase = Ease.InQuad;
	[SerializeField, Range(0.8f, 1.3f)] private float popScale = 1.05f;
	[SerializeField, Min(0f)] private float popSeconds = 0.12f;
	[SerializeField, Tooltip("If enabled, the chip GameObject is disabled after the hide animation completes.")]
	private bool disableGameObjectWhenHidden = true;
	[SerializeField, Tooltip("When true, judgement chips (Perfect/Good/Early/Late/Miss) rely on sprite artwork and suppress duplicate TMP label text.")]
	private bool useSpriteNativeTextForJudgement = true;

	[Header("Judgement Glass Style")]
	[SerializeField, Tooltip("When true, judgement chips use tinted TranslucentImage glass instead of baked sprite artwork.")]
	private bool enforceGlassStyleForJudgement = true;
	[SerializeField, Range(0f, 1f)] private float judgementGlassOpacity = 0.2f;
	[SerializeField, Range(0f, 1f)] private float infoGlassOpacity = 0.2f;
	[SerializeField] private Color perfectGlassTint = default; // assigned in Reset for inspector; runtime fallback below preserves existing prefabs
	[SerializeField] private Color goodGlassTint = default;
	[SerializeField] private Color earlyGlassTint = default;
	[SerializeField] private Color lateGlassTint = default;
	[SerializeField] private Color missGlassTint = default;
	[SerializeField] private Color infoGlassTint = new Color(0.88f, 0.88f, 0.9f, 1f);
	[SerializeField] private Color goodTextColor = default;
	[SerializeField] private Color earlyLateTextColor = default;
	[SerializeField] private Color perfectTextColor = default;

	[Header("Timing Error (Optional)")]
	[SerializeField] private bool showTimingError = true;
	[SerializeField, Min(0f)] private float hideTimingErrorUnderMs = 2f;
	[SerializeField] private Color timingErrorPerfectColor = default;
	[SerializeField] private Color timingErrorGoodColor = default;
	[SerializeField] private Color timingErrorMissColor = default;
	[SerializeField] private bool showTinyErrorMeter = true;
	[SerializeField, Min(10f)] private float errorMeterWidth = 78f;
	[SerializeField, Min(2f)] private float errorMeterHeight = 6f;
	[SerializeField] private Color errorMeterBg = new Color(1f, 1f, 1f, 0.16f);
	[SerializeField] private Color errorMeterFillPerfect = default;
	[SerializeField] private Color errorMeterFillGood = default;
	[SerializeField] private Color errorMeterFillMiss = default;

	private Tween activeTween;
	private static TranslucentImageSource cachedSource;
	private Image errorMeterBgImg;
	private Image errorMeterFillImg;
	private static Sprite cachedWhiteSprite;
	private Sprite defaultBackgroundSprite;

	private void Reset()
	{
		background = GetComponentInChildren<TranslucentImage>(true);
		label = GetComponentInChildren<TMP_Text>(true);
		timingErrorLabel = null;
		canvasGroup = GetComponent<CanvasGroup>();

		perfectGlassTint = AlgebraUiPalette.JudgementGreen;
		goodGlassTint = AlgebraUiPalette.JudgementYellow;
		earlyGlassTint = AlgebraUiPalette.JudgementRed;
		lateGlassTint = AlgebraUiPalette.JudgementRed;
		missGlassTint = AlgebraUiPalette.JudgementRed;
		perfectTextColor = AlgebraUiPalette.JudgementGreen;
		goodTextColor = AlgebraUiPalette.JudgementYellow;
		earlyLateTextColor = AlgebraUiPalette.JudgementRed;
		timingErrorPerfectColor = AlgebraUiPalette.JudgementGreen;
		timingErrorGoodColor = AlgebraUiPalette.JudgementYellow;
		timingErrorMissColor = AlgebraUiPalette.JudgementRed;
		errorMeterFillPerfect = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementGreen, 0.9f);
		errorMeterFillGood = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementYellow, 0.9f);
		errorMeterFillMiss = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementRed, 0.9f);
	}

	private void Awake()
	{
		ApplySharedMotionPresetIfEnabled();
		ApplyPaletteDefaultsIfUnset();

		// Be forgiving: prefab instances often forget to wire references.
		if (background == null)
		{
			background = GetComponentInChildren<TranslucentImage>(true);
		}
		if (defaultBackgroundSprite == null && background != null)
		{
			defaultBackgroundSprite = background.sprite;
		}
		if (label == null)
		{
			TMP_Text[] allTexts = GetComponentsInChildren<TMP_Text>(true);
			for (int i = 0; i < allTexts.Length; i++)
			{
				if (allTexts[i] != null && !IsLikelyTimingLabel(allTexts[i]))
				{
					label = allTexts[i];
					break;
				}
			}

			if (label == null && allTexts.Length > 0)
			{
				label = allTexts[0];
			}
		}
		if (timingErrorLabel == null)
		{
			// Try find a child explicitly named for it, else fallback to "second TMP" if present.
			TMP_Text[] all = GetComponentsInChildren<TMP_Text>(true);
			for (int i = 0; i < all.Length; i++)
			{
				if (all[i] != null && all[i] != label && all[i].name.ToLowerInvariant().Contains("timing"))
				{
					timingErrorLabel = all[i];
					break;
				}
			}

			if (timingErrorLabel == null && all.Length > 1)
			{
				for (int i = 0; i < all.Length; i++)
				{
					if (all[i] != null && all[i] != label)
					{
						timingErrorLabel = all[i];
						break;
					}
				}
			}
		}
		EnsureCanvasGroupReference();

		if (canvasGroup != null)
		{
			canvasGroup.alpha = 0f;
		}

		EnsureTranslucentSourceBound();
		EnsureTinyMeter();
	}

	private void ApplySharedMotionPresetIfEnabled()
	{
		if (!useSharedAlgebraMotionPreset)
		{
			return;
		}

		showFadeSeconds = AlgebraMotionPresets.ChipShowSeconds;
		holdSeconds = AlgebraMotionPresets.ChipHoldSeconds;
		hideFadeSeconds = AlgebraMotionPresets.ChipHideSeconds;
		showEase = AlgebraMotionPresets.UiEaseOut;
		hideEase = AlgebraMotionPresets.UiEaseIn;
		popScale = AlgebraMotionPresets.ChipPopScale;
		popSeconds = AlgebraMotionPresets.ChipPopSeconds;
	}

	private void EnsureCanvasGroupReference()
	{
		if (canvasGroup == null)
		{
			canvasGroup = GetComponent<CanvasGroup>();
		}
	}

	private void ApplyPaletteDefaultsIfUnset()
	{
		if (perfectGlassTint == default) perfectGlassTint = AlgebraUiPalette.JudgementGreen;
		if (goodGlassTint == default) goodGlassTint = AlgebraUiPalette.JudgementYellow;
		if (earlyGlassTint == default) earlyGlassTint = AlgebraUiPalette.JudgementRed;
		if (lateGlassTint == default) lateGlassTint = AlgebraUiPalette.JudgementRed;
		if (missGlassTint == default) missGlassTint = AlgebraUiPalette.JudgementRed;

		if (perfectTextColor == default) perfectTextColor = AlgebraUiPalette.JudgementGreen;
		if (goodTextColor == default) goodTextColor = AlgebraUiPalette.JudgementYellow;
		if (earlyLateTextColor == default) earlyLateTextColor = AlgebraUiPalette.JudgementRed;

		if (timingErrorPerfectColor == default) timingErrorPerfectColor = AlgebraUiPalette.JudgementGreen;
		if (timingErrorGoodColor == default) timingErrorGoodColor = AlgebraUiPalette.JudgementYellow;
		if (timingErrorMissColor == default) timingErrorMissColor = AlgebraUiPalette.JudgementRed;

		if (errorMeterFillPerfect == default) errorMeterFillPerfect = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementGreen, 0.9f);
		if (errorMeterFillGood == default) errorMeterFillGood = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementYellow, 0.9f);
		if (errorMeterFillMiss == default) errorMeterFillMiss = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementRed, 0.9f);
	}

	public void ShowFromMessage(string message, Color color)
	{
		ChipKind kind = KindFromMessage(message);
		Show(kind, message, color);
	}

	public void Show(ChipKind kind, string message, Color color)
	{
		if (background == null && label == null)
		{
			Debug.LogWarning("[FeedbackChipUI] No background/label assigned; cannot display chip.", this);
			return;
		}

		gameObject.SetActive(true);

		EnsureTranslucentSourceBound();
		bool hasDedicatedLabel = label != null && !IsLikelyTimingLabel(label);
		bool hasJudgementSprite = HasSpriteForKind(kind);
		bool preferNativeSprite = IsJudgementKind(kind) && useSpriteNativeTextForJudgement && hasJudgementSprite;
		bool useGlassStyle = enforceGlassStyleForJudgement && IsJudgementKind(kind) && !preferNativeSprite && hasDedicatedLabel;

		if (background != null)
		{
			Sprite sprite = SpriteForKind(kind);
			if (sprite != null)
			{
				background.sprite = sprite;
			}
			else if (background.sprite == null)
			{
				background.sprite = defaultBackgroundSprite != null ? defaultBackgroundSprite : GetWhiteSprite();
			}

			Color tint = useGlassStyle ? GlassTintForKind(kind) : Color.white;
			tint.a = 1f;
			background.color = tint;
			background.foregroundOpacity = useGlassStyle
				? Mathf.Clamp01(judgementGlassOpacity)
				: Mathf.Clamp01(infoGlassOpacity);
			// TranslucentImage blends via foregroundOpacity; keep color opaque and drive alpha via CanvasGroup.
		}

		if (label != null)
		{
			string displayText = BuildDisplayLabelText(kind, message, useGlassStyle);
			bool showLabel = !string.IsNullOrWhiteSpace(displayText);
			bool canToggleLabelObject = label != timingErrorLabel;
			if (canToggleLabelObject && label.gameObject.activeSelf != showLabel)
			{
				label.gameObject.SetActive(showLabel);
			}
			label.text = displayText;
			label.color = useGlassStyle ? TextColorForKind(kind, color) : color;
		}

		ApplyTimingErrorVisuals(hitResult: ChipKindToHitResult(kind), signedErrorMs: float.NaN, normalizedToMiss: float.NaN);

		PlayAnim(kind);
	}

	public void ShowJudgement(string message, Color color, HitResult hitResult, float signedErrorMs, float normalizedToMiss)
	{
		ChipKind kind;
		if (hitResult != HitResult.None)
		{
			kind = hitResult switch
			{
				HitResult.Perfect => ChipKind.Perfect,
				HitResult.Good => ChipKind.Good,
				HitResult.Miss => !float.IsNaN(signedErrorMs)
					? (signedErrorMs < 0f ? ChipKind.Early : ChipKind.Late)
					: ChipKind.Miss,
				_ => ChipKind.Info,
			};

			if (hitResult == HitResult.Miss && float.IsNaN(signedErrorMs))
			{
				ChipKind messageKind = KindFromMessage(message);
				if (messageKind == ChipKind.Early || messageKind == ChipKind.Late || messageKind == ChipKind.Miss)
				{
					kind = messageKind;
				}
			}
		}
		else
		{
			kind = KindFromMessage(message);
		}

		Show(kind, message, color);
		ApplyTimingErrorVisuals(hitResult, signedErrorMs, normalizedToMiss);

		if (hitResult == HitResult.Miss)
		{
			// Extra "sting" on miss.
			transform.DOKill();
			transform.localRotation = Quaternion.identity;
			transform.DOPunchRotation(new Vector3(0f, 0f, 10f), 0.24f, 12, 0.8f).SetUpdate(true);
		}
	}

	private void EnsureTranslucentSourceBound()
	{
		if (background == null)
		{
			return;
		}

		// Many prefabs forget to assign the TranslucentImageSource; try to bind it from the scene.
		if (background.source != null)
		{
			return;
		}

		if (cachedSource == null)
		{
			cachedSource = FindFirstObjectByType<TranslucentImageSource>();
			if (cachedSource == null)
			{
				cachedSource = FindFirstObjectByType<TranslucentImageSource>();
			}
		}

		if (cachedSource != null)
		{
			background.source = cachedSource;
		}
	}

	private void EnsureTinyMeter()
	{
		if (!showTinyErrorMeter || errorMeterBgImg != null)
		{
			return;
		}

		// Build a tiny bar under the chip, purely optional. Works even if prefab has no extra children.
		GameObject bgObj = new GameObject("TimingErrorMeterBg", typeof(RectTransform), typeof(Image));
		bgObj.transform.SetParent(transform, false);
		RectTransform bgRt = bgObj.GetComponent<RectTransform>();
		bgRt.anchorMin = new Vector2(0.5f, 0f);
		bgRt.anchorMax = new Vector2(0.5f, 0f);
		bgRt.pivot = new Vector2(0.5f, 0f);
		bgRt.anchoredPosition = new Vector2(0f, 6f);
		bgRt.sizeDelta = new Vector2(errorMeterWidth, errorMeterHeight);
		errorMeterBgImg = bgObj.GetComponent<Image>();
		errorMeterBgImg.sprite = GetWhiteSprite();
		errorMeterBgImg.type = Image.Type.Sliced;
		errorMeterBgImg.color = errorMeterBg;
		errorMeterBgImg.raycastTarget = false;

		GameObject fillObj = new GameObject("TimingErrorMeterFill", typeof(RectTransform), typeof(Image));
		fillObj.transform.SetParent(bgObj.transform, false);
		RectTransform fillRt = fillObj.GetComponent<RectTransform>();
		fillRt.anchorMin = new Vector2(0f, 0f);
		fillRt.anchorMax = new Vector2(0f, 1f);
		fillRt.pivot = new Vector2(0f, 0.5f);
		fillRt.anchoredPosition = Vector2.zero;
		fillRt.sizeDelta = new Vector2(errorMeterWidth, 0f);
		errorMeterFillImg = fillObj.GetComponent<Image>();
		errorMeterFillImg.sprite = GetWhiteSprite();
		errorMeterFillImg.type = Image.Type.Sliced;
		errorMeterFillImg.color = errorMeterFillGood;
		errorMeterFillImg.raycastTarget = false;
	}

	private void ApplyTimingErrorVisuals(HitResult hitResult, float signedErrorMs, float normalizedToMiss)
	{
		if (!showTimingError)
		{
			if (timingErrorLabel != null) timingErrorLabel.text = string.Empty;
			if (errorMeterBgImg != null) errorMeterBgImg.gameObject.SetActive(false);
			return;
		}

		bool has = !float.IsNaN(signedErrorMs);
		float abs = has ? Mathf.Abs(signedErrorMs) : 0f;

		if (timingErrorLabel != null)
		{
			if (!has || abs < hideTimingErrorUnderMs)
			{
				timingErrorLabel.text = string.Empty;
			}
			else
			{
				// Keep it readable: "+43ms" or "-12ms"
				int ms = Mathf.RoundToInt(signedErrorMs);
				timingErrorLabel.text = $"{(ms >= 0 ? "+" : "")}{ms}ms";
			}

			timingErrorLabel.color = hitResult switch
			{
				HitResult.Perfect => timingErrorPerfectColor,
				HitResult.Good => timingErrorGoodColor,
				_ => timingErrorMissColor,
			};
		}

		if (errorMeterBgImg != null)
		{
			errorMeterBgImg.gameObject.SetActive(has);
		}

		if (errorMeterFillImg != null)
		{
			float n = float.IsNaN(normalizedToMiss) ? 0f : Mathf.Clamp01(normalizedToMiss);
			float fill = has ? Mathf.Clamp01(1f - n) : 0f;
			RectTransform rt = errorMeterFillImg.rectTransform;
			rt.DOKill();
			rt.DOSizeDelta(new Vector2(errorMeterWidth * fill, rt.sizeDelta.y), 0.14f).SetEase(Ease.OutCubic).SetUpdate(true);
			errorMeterFillImg.color = hitResult switch
			{
				HitResult.Perfect => errorMeterFillPerfect,
				HitResult.Good => errorMeterFillGood,
				_ => errorMeterFillMiss,
			};
		}
	}

	private static HitResult ChipKindToHitResult(ChipKind kind)
	{
		return kind switch
		{
			ChipKind.Perfect => HitResult.Perfect,
			ChipKind.Good => HitResult.Good,
			ChipKind.Miss => HitResult.Miss,
			_ => HitResult.None,
		};
	}

	private static Sprite GetWhiteSprite()
	{
		if (cachedWhiteSprite != null)
		{
			return cachedWhiteSprite;
		}

		Texture2D tex = Texture2D.whiteTexture;
		cachedWhiteSprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
		return cachedWhiteSprite;
	}

	private Color GlassTintForKind(ChipKind kind)
	{
		return kind switch
		{
			ChipKind.Perfect => perfectGlassTint,
			ChipKind.Good => goodGlassTint,
			ChipKind.Early => earlyGlassTint,
			ChipKind.Late => lateGlassTint,
			ChipKind.Miss => missGlassTint,
			_ => infoGlassTint,
		};
	}

	private Color TextColorForKind(ChipKind kind, Color fallback)
	{
		return kind switch
		{
			ChipKind.Good => goodTextColor,
			ChipKind.Early => earlyLateTextColor,
			ChipKind.Late => earlyLateTextColor,
			ChipKind.Miss => earlyLateTextColor,
			ChipKind.Perfect => perfectTextColor,
			_ => fallback,
		};
	}

	private static bool IsJudgementKind(ChipKind kind)
	{
		return kind == ChipKind.Perfect || kind == ChipKind.Good || kind == ChipKind.Early || kind == ChipKind.Late || kind == ChipKind.Miss;
	}

	private static bool IsLikelyTimingLabel(TMP_Text text)
	{
		if (text == null)
		{
			return false;
		}

		return text.name.IndexOf("timing", System.StringComparison.OrdinalIgnoreCase) >= 0;
	}

	private static string StripJudgementPrefix(string message)
	{
		if (string.IsNullOrWhiteSpace(message))
		{
			return string.Empty;
		}

		string trimmed = message.Trim();
		if (trimmed.StartsWith("Perfect!", System.StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Perfect!".Length).TrimStart();
		if (trimmed.StartsWith("Good!", System.StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Good!".Length).TrimStart();
		if (trimmed.StartsWith("Early!", System.StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Early!".Length).TrimStart();
		if (trimmed.StartsWith("Late!", System.StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Late!".Length).TrimStart();
		if (trimmed.StartsWith("Miss!", System.StringComparison.OrdinalIgnoreCase)) return trimmed.Substring("Miss!".Length).TrimStart();
		return trimmed;
	}

	private string BuildDisplayLabelText(ChipKind kind, string message, bool useGlassStyle)
	{
		if (string.IsNullOrEmpty(message))
		{
			return string.Empty;
		}

		if (IsJudgementKind(kind) && useSpriteNativeTextForJudgement && !useGlassStyle)
		{
			// Keep chip art text as the headline; render only the dynamic tail (e.g. "4/4 hoops - release earlier.").
			return StripJudgementPrefix(message);
		}

		return message;
	}

	private bool HasSpriteForKind(ChipKind kind)
	{
		return DirectSpriteForKind(kind) != null;
	}

	private Sprite DirectSpriteForKind(ChipKind kind)
	{
		return kind switch
		{
			ChipKind.Perfect => perfectSprite,
			ChipKind.Good => goodSprite,
			ChipKind.Early => earlySprite,
			ChipKind.Late => lateSprite,
			ChipKind.Miss => missSprite,
			ChipKind.Info => infoSprite,
			_ => infoSprite,
		};
	}

	private float ForegroundPulseForKind(ChipKind kind)
	{
		return kind switch
		{
			ChipKind.Perfect => 0.24f,
			ChipKind.Good => 0.18f,
			ChipKind.Early => 0.15f,
			ChipKind.Late => 0.15f,
			ChipKind.Miss => 0.22f,
			_ => 0.1f,
		};
	}

	private float HoldBonusForKind(ChipKind kind)
	{
		return kind switch
		{
			ChipKind.Perfect => 0.08f,
			ChipKind.Miss => 0.1f,
			_ => 0f,
		};
	}

	public void HideImmediate()
	{
		activeTween?.Kill();
		activeTween = null;

		if (canvasGroup != null)
		{
			canvasGroup.alpha = 0f;
		}

		if (disableGameObjectWhenHidden)
		{
			gameObject.SetActive(false);
		}
	}

	private void PlayAnim(ChipKind kind)
	{
		activeTween?.Kill();
		EnsureCanvasGroupReference();

		if (canvasGroup != null)
		{
			canvasGroup.DOKill();
			canvasGroup.alpha = 0f;
		}

		Transform t = transform;
		t.DOKill();
		RectTransform rect = t as RectTransform;
		Vector2 basePos = rect != null ? rect.anchoredPosition : Vector2.zero;
		Vector3 baseScale = Vector3.one;
		t.localScale = baseScale * 0.9f;
		if (rect != null)
		{
			rect.anchoredPosition = basePos + new Vector2(0f, -10f);
		}

		Sequence seq = DOTween.Sequence();
		if (canvasGroup != null)
		{
			seq.Append(canvasGroup.DOFade(1f, showFadeSeconds).SetEase(showEase));
		}
		else
		{
			seq.AppendInterval(showFadeSeconds);
		}

		if (rect != null)
		{
			seq.Join(rect.DOAnchorPos(basePos, Mathf.Max(0.05f, showFadeSeconds * 1.15f)).SetEase(Ease.OutCubic));
		}

		seq.Join(t.DOScale(baseScale * Mathf.Max(0.85f, popScale), popSeconds).SetEase(Ease.OutBack));
		seq.Append(t.DOScale(baseScale, Mathf.Max(0.05f, popSeconds * 0.7f)).SetEase(Ease.OutQuad));

		if (background != null)
		{
			background.DOKill();
			float baseOpacity = background.foregroundOpacity;
			float pulseOpacity = Mathf.Clamp01(baseOpacity + ForegroundPulseForKind(kind));
			background.foregroundOpacity = pulseOpacity;
			seq.Join(DOTween.To(
				() => background.foregroundOpacity,
				v => background.foregroundOpacity = v,
				baseOpacity,
				Mathf.Max(0.08f, popSeconds)).SetEase(Ease.OutSine));
		}

		if (rect != null)
		{
			switch (kind)
			{
				case ChipKind.Perfect:
					seq.Join(t.DOPunchScale(new Vector3(0.13f, 0.13f, 0f), 0.24f, 9, 0.75f).SetDelay(showFadeSeconds * 0.28f));
					break;
				case ChipKind.Good:
					seq.Join(t.DOPunchScale(new Vector3(0.07f, 0.07f, 0f), 0.2f, 8, 0.7f).SetDelay(showFadeSeconds * 0.26f));
					break;
				case ChipKind.Early:
				case ChipKind.Late:
					seq.Join(rect.DOShakePosition(0.18f, new Vector3(10f, 0f, 0f), 16, 90f, false, true).SetDelay(showFadeSeconds * 0.22f));
					break;
				case ChipKind.Miss:
					seq.Join(rect.DOShakePosition(0.26f, new Vector3(14f, 4f, 0f), 18, 90f, false, true).SetDelay(showFadeSeconds * 0.18f));
					break;
			}
		}

		seq.AppendInterval(Mathf.Max(0f, holdSeconds + HoldBonusForKind(kind)));
		if (canvasGroup != null)
		{
			seq.Append(canvasGroup.DOFade(0f, hideFadeSeconds).SetEase(hideEase));
		}
		else
		{
			seq.AppendInterval(hideFadeSeconds);
		}

		if (disableGameObjectWhenHidden)
		{
			seq.AppendCallback(() =>
			{
				// If something else is using it, they can re-enable + call Show() again.
				if (this != null)
				{
					if (rect != null)
					{
						rect.anchoredPosition = basePos;
					}
					gameObject.SetActive(false);
				}
			});
		}

		activeTween = seq;
	}

	private Sprite SpriteForKind(ChipKind kind)
	{
		Sprite direct = DirectSpriteForKind(kind);

		if (direct != null)
		{
			return direct;
		}

		// Fallback chain prevents "white box" when one sprite slot is missing.
		return lateSprite ?? earlySprite ?? goodSprite ?? perfectSprite ?? infoSprite ?? defaultBackgroundSprite;
	}

	private static ChipKind KindFromMessage(string message)
	{
		if (string.IsNullOrEmpty(message))
		{
			return ChipKind.Info;
		}

		string m = message.Trim();
		if (m.StartsWith("Perfect", System.StringComparison.OrdinalIgnoreCase)) return ChipKind.Perfect;
		if (m.StartsWith("Good", System.StringComparison.OrdinalIgnoreCase)) return ChipKind.Good;
		if (m.StartsWith("Early", System.StringComparison.OrdinalIgnoreCase)) return ChipKind.Early;
		if (m.StartsWith("Late", System.StringComparison.OrdinalIgnoreCase)) return ChipKind.Late;
		if (m.StartsWith("Miss", System.StringComparison.OrdinalIgnoreCase)) return ChipKind.Miss;
		return ChipKind.Info;
	}
}
