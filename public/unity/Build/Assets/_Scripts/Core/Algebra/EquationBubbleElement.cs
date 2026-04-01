using System;
using System.Collections.Generic;

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

using TMPro;

using DG.Tweening;

using Febucci.UI;
using System.Collections;
using LeTai.Asset.TranslucentImage;

public enum BubbleElementType
{
	Variable,       // x
	Coefficient,    // Number before x (e.g., 2 in 2x)
	Constant,       // Standalone number
	Operator,       // + - =
	DropZone        // Empty circle for dropping
}

[RequireComponent(typeof(RectTransform))]
public class EquationBubbleElement : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerEnterHandler, IPointerExitHandler
{
	[Header("Element Configuration")]
	[SerializeField] private BubbleElementType elementType;
	[SerializeField] private int numericValue;
	[SerializeField] private int equationSide; // 0 = left, 1 = right
	[SerializeField] private bool isDraggable = true;
	[SerializeField] private string displayText;

	[Header("Visual Components")]
	[SerializeField] private Image bubbleBackground;
	[SerializeField] private Image bubbleOutline;
	[SerializeField] private TextMeshProUGUI valueText;
	[SerializeField] private Image shadowImage;
	[SerializeField] private Graphic bubbleBackgroundGraphic;
	[SerializeField] private Graphic bubbleOutlineGraphic;

	[Header("Visual Settings")]
	[SerializeField] private float bubbleSize = 100f;
	[SerializeField] private float outlineWidth = 4f;
	[SerializeField] private Color normalColor = new Color(0.1f, 0.1f, 0.1f, 0f);
	[SerializeField] private Color highlightColor = new Color(0.3f, 0.3f, 0.1f, 0.12f);
	[SerializeField] private Color dragColor = new Color(0.5f, 0.3f, 0.1f, 0.22f);
	[SerializeField] private Color outlineNormalColor = new Color(0.4f, 0.4f, 0.4f, 1f);
	[SerializeField] private Color outlineHighlightColor = new Color(1f, 1f, 0f, 1f);
	[SerializeField] private Color textColor = Color.white;
	[SerializeField] private Color variableColor = new Color(1f, 0.4f, 0.4f, 1f); // Red for x

	[Header("Fill/Text Animator")]
	[SerializeField] private bool playTextAnimatorOnFill = true;
	[SerializeField] private string fillTextEffectTag = "bounce";
	[SerializeField, Min(0.05f)] private float fillTextEffectSeconds = 0.45f;
	[SerializeField, Range(0f, 1f)] private float fillFlashAlpha = 0.65f;

	[Header("Animation Settings")]
	[SerializeField] private bool useSharedAlgebraMotionPreset = true;
	[SerializeField] private float hoverScale = 1.1f;
	[SerializeField] private float dragScale = 1.15f;
	[SerializeField] private float animationDuration = 0.15f;

	// Events
	public event Action<EquationBubbleElement> OnDragStarted;
	public event Action<EquationBubbleElement, Vector2> OnDragging;
	public event Action<EquationBubbleElement, Vector2> OnDragEnded;

	// State
	private RectTransform rectTransform;
	private Canvas parentCanvas;
	private Camera canvasCamera;
	private Vector2 originalPosition;
	private Vector2 logicalPathAnchorOffset;
	private Vector3 originalScale;
	private bool isDragging;
	private bool isHovering;
	private CanvasGroup canvasGroup;
	private Coroutine resetTextEffectRoutine;
	private int dragStartSiblingIndex = -1;
	private Transform dragStartParent;
	private Vector2 dragStartAnchoredPos;
	private Vector3 dragStartScale;
	private bool dropAccepted;



	// Linked operator (the + or - before this element)
	private EquationBubbleElement linkedOperator;
	private bool isNegative;
	private bool hasExternalVisualTargets;
	private readonly List<Graphic> externalBackgroundTargets = new List<Graphic>(4);
	private readonly List<Graphic> externalOutlineTargets = new List<Graphic>(4);

	// Properties
	public BubbleElementType ElementType => elementType;
	public int NumericValue => numericValue;
	public int EquationSide => equationSide;
	public bool IsDraggable => isDraggable && elementType != BubbleElementType.Operator && elementType != BubbleElementType.DropZone;
	public bool IsDragging => isDragging;
	public string DisplayText => displayText;
	public RectTransform RectTransform => rectTransform;
	public Vector2 OriginalPosition => originalPosition;
	public Vector2 OriginalPathAnchorPosition => originalPosition + logicalPathAnchorOffset;
	public Vector2 CurrentPathAnchorPosition => ((rectTransform != null ? rectTransform.anchoredPosition : originalPosition) + logicalPathAnchorOffset);
	public EquationBubbleElement LinkedOperator => linkedOperator;
	public bool IsNegative => isNegative;

	private Graphic BackgroundGraphic => bubbleBackground != null ? bubbleBackground : bubbleBackgroundGraphic;
	private Graphic OutlineGraphic => bubbleOutline != null ? bubbleOutline : bubbleOutlineGraphic;

	private static void SetBackgroundVisual(Graphic bg, Color desired)
	{
		if (bg == null)
		{
			return;
		}

		if (bg is TranslucentImage ti)
		{
			ti.enabled = true;
			ti.foregroundOpacity = Mathf.Clamp01(desired.a);
			Color tint = desired;
			tint.a = 1f;
			ti.color = tint;
			return;
		}

		bg.color = desired;
	}

	private static void TweenBackgroundVisual(Graphic bg, Color desired, float duration, Ease ease = Ease.OutQuad, Action onComplete = null)
	{
		if (bg == null)
		{
			return;
		}

		if (bg is TranslucentImage ti)
		{
			ti.enabled = true;
			Color tint = desired;
			tint.a = 1f;
			ti.color = tint;

			float to = Mathf.Clamp01(desired.a);
			float from = ti.foregroundOpacity;
			ti.DOKill();
			DOTween.To(() => from, v => { from = v; if (ti != null) ti.foregroundOpacity = v; }, to, duration)
				.SetEase(ease)
				.SetTarget(ti)
				.OnComplete(() => onComplete?.Invoke());
			return;
		}

		bg.DOKill();
		bg.DOColor(desired, duration).SetEase(ease).OnComplete(() => onComplete?.Invoke());
	}

	private void ForEachBackgroundTarget(Action<Graphic> action)
	{
		if (action == null)
		{
			return;
		}

		if (hasExternalVisualTargets)
		{
			for (int i = 0; i < externalBackgroundTargets.Count; i++)
			{
				Graphic g = externalBackgroundTargets[i];
				if (g != null) action(g);
			}
			return;
		}

		Graphic bg = BackgroundGraphic;
		if (bg != null) action(bg);
	}

	private void ForEachOutlineTarget(Action<Graphic> action)
	{
		if (action == null)
		{
			return;
		}

		if (hasExternalVisualTargets)
		{
			for (int i = 0; i < externalOutlineTargets.Count; i++)
			{
				Graphic g = externalOutlineTargets[i];
				if (g != null) action(g);
			}
			return;
		}

		Graphic outline = OutlineGraphic;
		if (outline != null) action(outline);
	}

	public void SetExternalVisualTargets(System.Collections.Generic.IEnumerable<Graphic> backgroundTargets, System.Collections.Generic.IEnumerable<Graphic> outlineTargets)
	{
		externalBackgroundTargets.Clear();
		externalOutlineTargets.Clear();

		if (backgroundTargets != null)
		{
			foreach (Graphic g in backgroundTargets)
			{
				if (g != null) externalBackgroundTargets.Add(g);
			}
		}

		if (outlineTargets != null)
		{
			foreach (Graphic g in outlineTargets)
			{
				if (g != null) externalOutlineTargets.Add(g);
			}
		}

		hasExternalVisualTargets = externalBackgroundTargets.Count > 0 || externalOutlineTargets.Count > 0;
	}

	public void ClearExternalVisualTargets()
	{
		externalBackgroundTargets.Clear();
		externalOutlineTargets.Clear();
		hasExternalVisualTargets = false;
	}

	private void Awake()
	{
		if (useSharedAlgebraMotionPreset)
		{
			hoverScale = AlgebraMotionPresets.BubbleHoverScale;
			dragScale = AlgebraMotionPresets.BubbleDragScale;
			animationDuration = AlgebraMotionPresets.BubbleTweenSeconds;
		}

		rectTransform = GetComponent<RectTransform>();
		canvasGroup = GetComponent<CanvasGroup>();

		if (canvasGroup == null)
		{
			canvasGroup = gameObject.AddComponent<CanvasGroup>();
		}
	}

	private void Start()
	{
		FindParentCanvas();
		originalPosition = rectTransform.anchoredPosition;
		originalScale = rectTransform.localScale;
	}

	private void FindParentCanvas()
	{
		parentCanvas = GetComponentInParent<Canvas>();
		if (parentCanvas != null)
		{
			canvasCamera = parentCanvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : parentCanvas.worldCamera;
		}
	}

	public void Initialize(BubbleElementType type, string text, int value = 0, int side = 0, bool draggable = true)
	{
		elementType = type;
		displayText = text;
		numericValue = value;
		equationSide = side;
		isDraggable = draggable;

		SetupVisuals();
	}

	public void SetLinkedOperator(EquationBubbleElement operatorElement, bool negative)
	{
		linkedOperator = operatorElement;
		isNegative = negative;
	}

	public void SetThemeColors(Color backgroundNormal, Color backgroundHighlight, Color backgroundDrag, Color outlineNormal, Color outlineHighlight, bool applyImmediately = true)
	{
		normalColor = backgroundNormal;
		highlightColor = backgroundHighlight;
		dragColor = backgroundDrag;
		outlineNormalColor = outlineNormal;
		outlineHighlightColor = outlineHighlight;

		if (!applyImmediately)
		{
			return;
		}

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.color = isHovering ? outlineHighlightColor : outlineNormalColor;
		});

		if (elementType != BubbleElementType.DropZone && !isDragging)
		{
			ForEachBackgroundTarget(bgGraphic => { SetBackgroundVisual(bgGraphic, normalColor); });
		}
	}

	public void SetOutlineTheme(Color outlineNormal, Color outlineHighlight, bool applyImmediately = true)
	{
		outlineNormalColor = outlineNormal;
		outlineHighlightColor = outlineHighlight;

		if (!applyImmediately)
		{
			return;
		}

		ForEachOutlineTarget(outlineGraphic => { outlineGraphic.color = outlineNormalColor; });
	}

	public void ApplyDropZoneVisualTheme(Color fillColor, Color outlineColor, float outlineHighlightLift = 0.2f, float duration = 0f)
	{
		if (elementType != BubbleElementType.DropZone)
		{
			return;
		}

		Color resolvedFill = fillColor;
		resolvedFill.a = Mathf.Clamp01(resolvedFill.a);
		normalColor = resolvedFill;
		highlightColor = resolvedFill;
		dragColor = resolvedFill;

		Color resolvedOutline = outlineColor;
		resolvedOutline.a = Mathf.Clamp01(resolvedOutline.a);
		float lift = Mathf.Clamp01(outlineHighlightLift);
		Color resolvedHighlight = Color.Lerp(resolvedOutline, Color.white, lift);
		resolvedHighlight.a = Mathf.Max(resolvedOutline.a, resolvedHighlight.a);
		outlineNormalColor = resolvedOutline;
		outlineHighlightColor = resolvedHighlight;

		float tweenDuration = Mathf.Max(0f, duration);
		ForEachBackgroundTarget(bgGraphic =>
		{
			if (tweenDuration <= 0f)
			{
				SetBackgroundVisual(bgGraphic, resolvedFill);
			}
			else
			{
				TweenBackgroundVisual(bgGraphic, resolvedFill, tweenDuration, AlgebraMotionPresets.UiEaseOut);
			}
		});

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			if (tweenDuration <= 0f)
			{
				outlineGraphic.color = resolvedOutline;
			}
			else
			{
				outlineGraphic.DOColor(resolvedOutline, tweenDuration).SetEase(AlgebraMotionPresets.UiEaseOut);
			}
		});
	}

	public void SetValueTextSize(float fontSize)
	{
		if (valueText != null)
		{
			valueText.enableAutoSizing = false;
			valueText.fontSize = fontSize;
		}
	}

	public void SetupVisuals()
	{
		if (rectTransform == null)
		{
			rectTransform = GetComponent<RectTransform>();
		}

		// Auto-bind existing visuals (e.g., TranslucentImage prefab background + TMP child text)
		if (valueText == null)
		{
			Transform tmpChild = transform.Find("Text (TMP)") ?? transform.Find("Text");
			if (tmpChild != null)
			{
				valueText = tmpChild.GetComponent<TextMeshProUGUI>();
			}
			if (valueText == null)
			{
				valueText = GetComponentInChildren<TextMeshProUGUI>(true);
			}
		}

		if (bubbleBackground == null && bubbleBackgroundGraphic == null)
		{
			Transform bgChild = transform.Find("Background");
			if (bgChild != null)
			{
				bubbleBackground = bgChild.GetComponent<Image>();
				if (bubbleBackground != null)
				{
					bubbleBackgroundGraphic = bubbleBackground;
				}
			}

			if (bubbleBackgroundGraphic == null)
			{
				Graphic rootGraphic = GetComponent<Graphic>();
				if (rootGraphic != null && rootGraphic != valueText)
				{
					bubbleBackgroundGraphic = rootGraphic;
					bubbleBackground = rootGraphic as Image;
				}
			}
		}

		if (bubbleOutline == null && bubbleOutlineGraphic == null && elementType != BubbleElementType.Operator)
		{
			Transform outlineChild = transform.Find("Outline");
			if (outlineChild != null)
			{
				bubbleOutline = outlineChild.GetComponent<Image>();
				if (bubbleOutline != null)
				{
					bubbleOutlineGraphic = bubbleOutline;
				}
			}

			if (bubbleOutlineGraphic == null)
			{
				Transform rootOutline = transform.Find("OutlineGraphic");
				if (rootOutline != null)
				{
					bubbleOutlineGraphic = rootOutline.GetComponent<Graphic>();
					bubbleOutline = bubbleOutlineGraphic as Image;
				}
			}
		}

		// Setup size based on element type
		float size = bubbleSize;
		if (elementType == BubbleElementType.Operator)
		{
			size = bubbleSize * 0.5f;
		}

		rectTransform.sizeDelta = new Vector2(size, size);

		// Create bubble background if not assigned
		if (bubbleBackground == null && bubbleBackgroundGraphic == null)
		{
			GameObject bgObj = new GameObject("Background", typeof(RectTransform), typeof(Image));
			bgObj.transform.SetParent(transform, false);
			bubbleBackground = bgObj.GetComponent<Image>();
			bubbleBackgroundGraphic = bubbleBackground;
			RectTransform bgRect = bgObj.GetComponent<RectTransform>();
			bgRect.anchorMin = Vector2.zero;
			bgRect.anchorMax = Vector2.one;
			bgRect.sizeDelta = Vector2.zero;
		}

		// Create outline if not assigned
		if (bubbleOutline == null && bubbleOutlineGraphic == null && elementType != BubbleElementType.Operator)
		{
			GameObject outlineObj = new GameObject("Outline", typeof(RectTransform), typeof(Image));
			outlineObj.transform.SetParent(transform, false);
			outlineObj.transform.SetAsFirstSibling();
			bubbleOutline = outlineObj.GetComponent<Image>();
			bubbleOutlineGraphic = bubbleOutline;
			RectTransform outlineRect = outlineObj.GetComponent<RectTransform>();
			outlineRect.anchorMin = Vector2.zero;
			outlineRect.anchorMax = Vector2.one;
			outlineRect.sizeDelta = new Vector2(outlineWidth * 2, outlineWidth * 2);
			outlineRect.anchoredPosition = Vector2.zero;
		}

		// Create text if not assigned
		if (valueText == null)
		{
			GameObject textObj = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
			textObj.transform.SetParent(transform, false);
			valueText = textObj.GetComponent<TextMeshProUGUI>();
			RectTransform textRect = textObj.GetComponent<RectTransform>();
			textRect.anchorMin = Vector2.zero;
			textRect.anchorMax = Vector2.one;
			textRect.sizeDelta = Vector2.zero;
		}

		// Apply visual settings
		Graphic bgGraphic = BackgroundGraphic;
		if (bgGraphic != null)
		{
			Color c = elementType == BubbleElementType.DropZone
				? new Color(normalColor.r, normalColor.g, normalColor.b, 0f)
				: normalColor;
			SetBackgroundVisual(bgGraphic, c);
			bgGraphic.raycastTarget = IsDraggable || elementType == BubbleElementType.DropZone;

			if (bubbleBackground != null)
			{
				// Make it circular (when it's an Image)
				bubbleBackground.type = Image.Type.Simple;
				// Sprite would be set externally - using a circular sprite
			}
		}

		Graphic outlineGraphic = OutlineGraphic;
		if (outlineGraphic != null)
		{
			outlineGraphic.color = outlineNormalColor;
			outlineGraphic.raycastTarget = false;
		}

		if (valueText != null)
		{
			// Force the text RectTransform to fill the bubble and clear any prefab margins
			// that were compensating for an undersized text box.
			RectTransform textRt = valueText.GetComponent<RectTransform>();
			if (textRt != null)
			{
				textRt.pivot = new Vector2(0.5f, 0.5f);
				textRt.anchorMin = Vector2.zero;
				textRt.anchorMax = Vector2.one;
				textRt.sizeDelta = Vector2.zero;
				textRt.anchoredPosition = Vector2.zero;
			}
			valueText.margin = Vector4.zero;

			SetTextInternal(displayText);
			valueText.fontSize = elementType == BubbleElementType.Operator ? 36f : 48f;
			valueText.alignment = TextAlignmentOptions.CenterGeoAligned;
			valueText.raycastTarget = false;

			// Color based on element type
			if (elementType == BubbleElementType.Variable)
			{
				valueText.color = variableColor;
			}
			else if (elementType == BubbleElementType.Operator)
			{
				valueText.color = new Color(0.7f, 0.7f, 0.7f, 1f);
			}
			else
			{
				valueText.color = textColor;
			}
		}

		// Setup raycast for drop zones
		if (elementType == BubbleElementType.DropZone && bgGraphic != null)
		{
			bgGraphic.raycastTarget = true;
		}
	}

	public void SetBubbleSprite(Sprite circleSprite)
	{
		if (bubbleBackground != null)
		{
			bubbleBackground.sprite = circleSprite;
		}

		if (bubbleOutline != null)
		{
			bubbleOutline.sprite = circleSprite;
		}
	}

	public void SetVisualAlphas(float backgroundAlpha, float outlineAlpha)
	{
		normalColor.a = backgroundAlpha;
		highlightColor.a = backgroundAlpha;
		dragColor.a = backgroundAlpha;

		outlineNormalColor.a = outlineAlpha;
		outlineHighlightColor.a = outlineAlpha;

		ForEachBackgroundTarget(bgGraphic =>
		{
			Color c = bgGraphic.color;
			c.a = backgroundAlpha;
			SetBackgroundVisual(bgGraphic, c);
		});

		ForEachOutlineTarget(outlineGraphic =>
		{
			Color c = outlineGraphic.color;
			c.a = outlineAlpha;
			outlineGraphic.color = c;
		});
	}

	public void SetOriginalPosition(Vector2 position)
	{
		originalPosition = position;
		rectTransform.anchoredPosition = position;
	}

	public void SetLogicalPathAnchorOffset(Vector2 offset)
	{
		logicalPathAnchorOffset = offset;
	}

	public void RestoreDragSiblingIndex()
	{
		if (dragStartParent == null || dragStartSiblingIndex < 0)
		{
			return;
		}

		if (transform.parent != dragStartParent)
		{
			return;
		}

		int max = transform.parent.childCount - 1;
		int idx = Mathf.Clamp(dragStartSiblingIndex, 0, Mathf.Max(0, max));
		transform.SetSiblingIndex(idx);
	}

	public void UpdateDisplayText(string newText)
	{
		displayText = newText;
		if (valueText != null)
		{
			SetTextInternal(newText ?? string.Empty);
		}
	}

	private void SetTextInternal(string text)
	{
		if (valueText == null)
		{
			return;
		}

		TextAnimator_TMP animator = valueText.GetComponent<TextAnimator_TMP>();
		if (animator != null)
		{
			animator.SetText(text ?? string.Empty);
			return;
		}

		valueText.text = text ?? string.Empty;
	}

	private TextAnimator_TMP EnsureTextAnimator()
	{
		if (valueText == null)
		{
			return null;
		}

		TextAnimator_TMP animator = valueText.GetComponent<TextAnimator_TMP>();
		if (animator != null)
		{
			return animator;
		}

		animator = valueText.gameObject.AddComponent<TextAnimator_TMP>();
		animator.timeScale = Febucci.UI.TimeScale.Unscaled;
		animator.typewriterStartsAutomatically = false;
		animator.SetText(displayText ?? string.Empty);
		return animator;
	}

	private IEnumerator ResetTextAnimatorAfterDelay(TextAnimator_TMP animator, string plainText, float delaySeconds)
	{
		yield return new WaitForSecondsRealtime(Mathf.Max(0f, delaySeconds));

		if (animator == null)
		{
			yield break;
		}

		animator.SetText(plainText ?? string.Empty);
		resetTextEffectRoutine = null;
	}

	public void SetHighlighted(bool highlighted)
	{
		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(highlighted ? outlineHighlightColor : outlineNormalColor, animationDuration);
		});

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, highlighted ? highlightColor : normalColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
			});
		}
	}

	public void SetDragFeedback(Color backgroundColor, Color outlineColor, float duration = 0.08f)
	{
		if (!isDragging)
		{
			return;
		}

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, backgroundColor, duration, AlgebraMotionPresets.UiEaseOut);
			});
		}

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineColor, duration);
		});
	}

	public void ClearDragFeedback(float duration = 0.08f)
	{
		if (!isDragging)
		{
			return;
		}

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, dragColor, duration, AlgebraMotionPresets.UiEaseOut);
			});
		}

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineHighlightColor, duration);
		});
	}

	public void SetAsDropTarget(bool isTarget)
	{
		if (elementType != BubbleElementType.DropZone)
		{
			return;
		}

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(isTarget ? outlineHighlightColor : outlineNormalColor, animationDuration);
		});
	}

	public void AnimateSuccess()
	{
		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(Color.green, 0.2f).OnComplete(() =>
			{
				if (outlineGraphic != null)
				{
					outlineGraphic.DOColor(outlineNormalColor, 0.3f);
				}
			});
		});

		if (elementType != BubbleElementType.DropZone)
		{
			Color c = Color.green;
			c.a = Mathf.Clamp01(fillFlashAlpha);
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, c, AlgebraMotionPresets.UiFast, AlgebraMotionPresets.UiEaseOut, onComplete: () =>
				{
					if (bgGraphic != null) TweenBackgroundVisual(bgGraphic, normalColor, AlgebraMotionPresets.UiSoft, AlgebraMotionPresets.UiEaseOut);
				});
			});
		}

		// Keep variable feedback subtle (no bouncing/flashing text).
		if (playTextAnimatorOnFill && elementType != BubbleElementType.Variable && !string.IsNullOrWhiteSpace(displayText))
		{
			TextAnimator_TMP animator = EnsureTextAnimator();
			if (animator != null)
			{
				if (resetTextEffectRoutine != null)
				{
					StopCoroutine(resetTextEffectRoutine);
					resetTextEffectRoutine = null;
				}

				string tag = string.IsNullOrWhiteSpace(fillTextEffectTag) ? "bounce" : fillTextEffectTag.Trim();
				animator.SetText($"<{tag}>{displayText}</>");
				resetTextEffectRoutine = StartCoroutine(ResetTextAnimatorAfterDelay(animator, displayText, fillTextEffectSeconds));
			}
		}

		rectTransform.DOScale(originalScale * 1.2f, AlgebraMotionPresets.UiFast).SetEase(AlgebraMotionPresets.UiEasePop).OnComplete(() =>
		{
			rectTransform.DOScale(originalScale, AlgebraMotionPresets.UiStandard).SetEase(AlgebraMotionPresets.UiEaseOut);
		});
	}

	public void AnimateFail()
	{
		rectTransform.DOPunchRotation(new Vector3(0f, 0f, 6f), 0.18f, 8, 0.75f);

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(Color.red, 0.1f).OnComplete(() =>
			{
				if (outlineGraphic != null)
				{
					outlineGraphic.DOColor(outlineNormalColor, 0.2f);
				}
			});
		});
	}

	public void AnimateSolvedStyle(Color outline, Color background, Color text, float duration = 0.25f, float popScale = 1.12f)
	{
		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outline, duration).SetEase(AlgebraMotionPresets.UiEaseOut);
		});

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, background, duration, AlgebraMotionPresets.UiEaseOut);
			});
		}

		if (valueText != null)
			valueText.DOColor(text, duration).SetEase(AlgebraMotionPresets.UiEaseOut);

		rectTransform.DOScale(originalScale * popScale, duration * 0.5f).SetEase(AlgebraMotionPresets.UiEasePop).OnComplete(() =>
		{
			rectTransform.DOScale(originalScale, duration * 0.5f).SetEase(AlgebraMotionPresets.UiEaseOut);
		});
	}

	public void SnapBack(float duration = 0.3f)
	{
		rectTransform.DOKill();
		rectTransform.DOAnchorPos(originalPosition, duration).SetEase(AlgebraMotionPresets.UiEasePop);
		rectTransform.DOScale(originalScale, duration);

		ForEachBackgroundTarget(bgGraphic =>
		{
			TweenBackgroundVisual(bgGraphic, normalColor, duration, AlgebraMotionPresets.UiEaseOut);
		});
	}
	public void MarkDropAccepted()
	{
		dropAccepted = true;
	}

	public void MarkDragResolutionHandled()
	{
		dropAccepted = true;
	}

	public void RestoreDragOrigin(bool animated = true)
	{
		// Restore parent + sibling first
		if (dragStartParent != null && transform.parent != dragStartParent)
		{
			transform.SetParent(dragStartParent, false);
		}

		if (dragStartParent != null && dragStartSiblingIndex >= 0 && transform.parent == dragStartParent)
		{
			int max = transform.parent.childCount - 1;
			transform.SetSiblingIndex(Mathf.Clamp(dragStartSiblingIndex, 0, Mathf.Max(0, max)));
		}

		// Restore position + scale
		if (animated)
		{
			rectTransform.DOKill();
			rectTransform.DOAnchorPos(dragStartAnchoredPos, 0.25f).SetEase(AlgebraMotionPresets.UiEasePop);
			rectTransform.DOScale(dragStartScale, AlgebraMotionPresets.BubbleTweenSeconds).SetEase(AlgebraMotionPresets.UiEaseOut);
		}
		else
		{
			rectTransform.anchoredPosition = dragStartAnchoredPos;
			rectTransform.localScale = dragStartScale;
		}

		// Restore visuals
		ForEachBackgroundTarget(bgGraphic =>
		{
			TweenBackgroundVisual(bgGraphic, normalColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
		});

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineNormalColor, animationDuration);
		});
	}


	public void MoveTo(Vector2 targetPosition, float duration = 0.5f, Action onComplete = null)
	{
		rectTransform.DOAnchorPos(targetPosition, duration).SetEase(AlgebraMotionPresets.UiEaseLoop).OnComplete(() =>
		{
			originalPosition = targetPosition;
			onComplete?.Invoke();
		});
	}

	#region Drag Handlers

	public void OnBeginDrag(PointerEventData eventData)
	{
		if (!IsDraggable)
		{
			return;
		}

		isDragging = true;
		dropAccepted = false;
		if (canvasGroup != null)
		{
			canvasGroup.blocksRaycasts = false;
		}

		dragStartParent = transform.parent;
		dragStartSiblingIndex = transform.GetSiblingIndex();
		dragStartAnchoredPos = rectTransform.anchoredPosition;
		dragStartScale = rectTransform.localScale;

		// Bring to front
		transform.SetAsLastSibling();

		// Scale up
		rectTransform.DOScale(originalScale * dragScale, animationDuration);

		// Change color
		ForEachBackgroundTarget(bgGraphic =>
		{
			TweenBackgroundVisual(bgGraphic, dragColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
		});

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineHighlightColor, animationDuration);
		});

		OnDragStarted?.Invoke(this);
	}

	public void OnDrag(PointerEventData eventData)
	{
		if (!isDragging)
		{
			return;
		}

		Vector2 localPoint;
		RectTransform parent = transform.parent as RectTransform;

		if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, eventData.position, canvasCamera, out localPoint))
		{
			rectTransform.anchoredPosition = localPoint;
		}

		OnDragging?.Invoke(this, rectTransform.anchoredPosition);
	}

	public void OnEndDrag(PointerEventData eventData)
	{
		if (!isDragging)
		{
			return;
		}

		isDragging = false;
		if (canvasGroup != null)
		{
			canvasGroup.blocksRaycasts = true;
		}


		// Reset scale
		rectTransform.DOScale(originalScale, animationDuration);

		// Reset color
		ForEachBackgroundTarget(bgGraphic =>
		{
			TweenBackgroundVisual(bgGraphic, normalColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
		});

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineNormalColor, animationDuration);
		});

		OnDragEnded?.Invoke(this, rectTransform.anchoredPosition);
		// If the controller doesn't accept the drop, return home.
		if (!dropAccepted)
		{
			RestoreDragOrigin(animated: true);
		}

	}

	public void OnPointerEnter(PointerEventData eventData)
	{
		// Touch pointers don't need desktop hover feedback; it reads as flicker during drag setup on phones/tablets.
		if (eventData != null && eventData.pointerId >= 0)
		{
			return;
		}

		if (!IsDraggable || isDragging)
		{
			return;
		}

		isHovering = true;
		rectTransform.DOScale(originalScale * hoverScale, animationDuration);

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineHighlightColor, animationDuration);
		});

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, highlightColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
			});
		}
	}

	public void OnPointerExit(PointerEventData eventData)
	{
		if (eventData != null && eventData.pointerId >= 0)
		{
			return;
		}

		if (!isHovering || isDragging)
		{
			return;
		}

		isHovering = false;
		rectTransform.DOScale(originalScale, animationDuration);

		ForEachOutlineTarget(outlineGraphic =>
		{
			outlineGraphic.DOKill();
			outlineGraphic.DOColor(outlineNormalColor, animationDuration);
		});

		if (elementType != BubbleElementType.DropZone)
		{
			ForEachBackgroundTarget(bgGraphic =>
			{
				TweenBackgroundVisual(bgGraphic, normalColor, animationDuration, AlgebraMotionPresets.UiEaseOut);
			});
		}
	}

	#endregion

	public void SetInteractable(bool interactable)
	{
		isDraggable = interactable && elementType != BubbleElementType.Operator && elementType != BubbleElementType.DropZone;

		if (canvasGroup != null)
		{
			canvasGroup.blocksRaycasts = interactable;
		}

		Graphic bgGraphic = BackgroundGraphic;
		if (bgGraphic != null)
		{
			bgGraphic.raycastTarget = interactable;
		}
	}

	public void FadeOut(float duration = 0.3f)
	{
		if (canvasGroup != null)
		{
			canvasGroup.DOFade(0f, duration);
		}

		rectTransform.DOScale(0f, duration).SetEase(AlgebraMotionPresets.UiEaseIn);
	}

	public void FadeIn(float duration = 0.3f)
	{
		rectTransform.localScale = Vector3.zero;

		if (canvasGroup != null)
		{
			canvasGroup.alpha = 0f;
			canvasGroup.DOFade(1f, duration);
		}

		rectTransform.DOScale(originalScale, duration).SetEase(AlgebraMotionPresets.UiEasePop);
	}
}
