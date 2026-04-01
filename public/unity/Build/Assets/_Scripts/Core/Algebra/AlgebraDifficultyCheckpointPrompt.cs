using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

[DisallowMultipleComponent]
public sealed class AlgebraDifficultyCheckpointPrompt : MonoBehaviour
{
	private const float PanelWidth = 760f;
	private const float PanelHeight = 320f;
	private const float ButtonWidth = 200f;
	private const float ButtonHeight = 58f;

	private CanvasGroup canvasGroup;
	private RectTransform rootRect;
	private RectTransform panelRect;
	private TMP_Text titleText;
	private TMP_Text descriptionText;
	private Button easierButton;
	private Button keepButton;
	private Button harderButton;
	private TMP_Text easierLabel;
	private TMP_Text keepLabel;
	private TMP_Text harderLabel;

	public bool IsVisible => gameObject.activeSelf;

	public static AlgebraDifficultyCheckpointPrompt GetOrCreate(Canvas parentCanvas)
	{
		if (parentCanvas == null)
			return null;

		AlgebraDifficultyCheckpointPrompt existing = parentCanvas.GetComponentInChildren<AlgebraDifficultyCheckpointPrompt>(true);
		if (existing != null)
			return existing;

		GameObject go = new GameObject(
			nameof(AlgebraDifficultyCheckpointPrompt),
			typeof(RectTransform),
			typeof(CanvasGroup),
			typeof(GraphicRaycaster),
			typeof(AlgebraDifficultyCheckpointPrompt));
		go.layer = parentCanvas.gameObject.layer;
		go.transform.SetParent(parentCanvas.transform, false);
		return go.GetComponent<AlgebraDifficultyCheckpointPrompt>();
	}

	public void Show(
		string title,
		string description,
		string easierText,
		string keepText,
		string harderText,
		Action onEasier,
		Action onKeep,
		Action onHarder)
	{
		EnsureBuilt();

		titleText.text = string.IsNullOrWhiteSpace(title) ? "Checkpoint" : title;
		descriptionText.text = description ?? string.Empty;
		easierLabel.text = string.IsNullOrWhiteSpace(easierText) ? "Easier" : easierText;
		keepLabel.text = string.IsNullOrWhiteSpace(keepText) ? "Keep Going" : keepText;
		harderLabel.text = string.IsNullOrWhiteSpace(harderText) ? "Harder" : harderText;

		BindButton(easierButton, onEasier);
		BindButton(keepButton, onKeep);
		BindButton(harderButton, onHarder);

		transform.SetAsLastSibling();
		gameObject.SetActive(true);
		canvasGroup.alpha = 1f;
		canvasGroup.interactable = true;
		canvasGroup.blocksRaycasts = true;
	}

	public void HideImmediate()
	{
		if (canvasGroup != null)
		{
			canvasGroup.alpha = 0f;
			canvasGroup.interactable = false;
			canvasGroup.blocksRaycasts = false;
		}

		gameObject.SetActive(false);
	}

	private void Awake()
	{
		EnsureBuilt();
		HideImmediate();
	}

	private void EnsureBuilt()
	{
		if (canvasGroup != null && panelRect != null)
			return;

		rootRect = transform as RectTransform;
		canvasGroup = GetComponent<CanvasGroup>();
		if (rootRect == null || canvasGroup == null)
			return;

		rootRect.anchorMin = Vector2.zero;
		rootRect.anchorMax = Vector2.one;
		rootRect.offsetMin = Vector2.zero;
		rootRect.offsetMax = Vector2.zero;
		rootRect.pivot = new Vector2(0.5f, 0.5f);

		CreateDimmer();
		CreatePanel();
	}

	private void CreateDimmer()
	{
		Image dimmer = CreateImage("Dimmer", rootRect, new Color(0f, 0f, 0f, 0.72f));
		RectTransform rect = dimmer.rectTransform;
		rect.anchorMin = Vector2.zero;
		rect.anchorMax = Vector2.one;
		rect.offsetMin = Vector2.zero;
		rect.offsetMax = Vector2.zero;
	}

	private void CreatePanel()
	{
		Image panel = CreateImage("Panel", rootRect, new Color(0.10f, 0.11f, 0.14f, 0.97f));
		panelRect = panel.rectTransform;
		panelRect.anchorMin = new Vector2(0.5f, 0.5f);
		panelRect.anchorMax = new Vector2(0.5f, 0.5f);
		panelRect.pivot = new Vector2(0.5f, 0.5f);
		panelRect.sizeDelta = new Vector2(PanelWidth, PanelHeight);
		panelRect.anchoredPosition = Vector2.zero;

		Outline panelOutline = panel.gameObject.AddComponent<Outline>();
		panelOutline.effectColor = AlgebraUiPalette.WithAlpha(AlgebraUiPalette.AccentPurple, 0.75f);
		panelOutline.effectDistance = new Vector2(2f, -2f);

		Shadow panelShadow = panel.gameObject.AddComponent<Shadow>();
		panelShadow.effectColor = new Color(0f, 0f, 0f, 0.35f);
		panelShadow.effectDistance = new Vector2(0f, -14f);

		titleText = CreateText(
			"Title",
			panelRect,
			"Checkpoint",
			32f,
			AlgebraUiPalette.White,
			FontStyles.Bold,
			TextAlignmentOptions.Center);
		StretchRect(titleText.rectTransform, new Vector2(PanelWidth - 64f, 44f), new Vector2(0f, 106f));

		descriptionText = CreateText(
			"Description",
			panelRect,
			string.Empty,
			22f,
			AlgebraUiPalette.WithAlpha(AlgebraUiPalette.White, 0.92f),
			FontStyles.Normal,
			TextAlignmentOptions.Center);
		descriptionText.textWrappingMode = TextWrappingModes.Normal;
		StretchRect(descriptionText.rectTransform, new Vector2(PanelWidth - 96f, 118f), new Vector2(0f, 18f));

		easierButton = CreateButton(
			"EasierButton",
			panelRect,
			new Vector2(-220f, -102f),
			AlgebraUiPalette.WithAlpha(AlgebraUiPalette.JudgementYellow, 0.18f),
			AlgebraUiPalette.JudgementYellow,
			out easierLabel);
		keepButton = CreateButton(
			"KeepButton",
			panelRect,
			new Vector2(0f, -102f),
			new Color(1f, 1f, 1f, 0.08f),
			AlgebraUiPalette.White50,
			out keepLabel);
		harderButton = CreateButton(
			"HarderButton",
			panelRect,
			new Vector2(220f, -102f),
			AlgebraUiPalette.WithAlpha(AlgebraUiPalette.AccentPurple, 0.88f),
			AlgebraUiPalette.AccentPurple,
			out harderLabel);

		harderLabel.color = AlgebraUiPalette.White;
	}

	private static void BindButton(Button button, Action callback)
	{
		if (button == null)
			return;

		button.onClick.RemoveAllListeners();
		if (callback != null)
			button.onClick.AddListener(() => callback.Invoke());
	}

	private static void StretchRect(RectTransform rect, Vector2 size, Vector2 position)
	{
		if (rect == null)
			return;

		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = size;
		rect.anchoredPosition = position;
	}

	private static Image CreateImage(string name, RectTransform parent, Color color)
	{
		GameObject go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
		RectTransform rect = go.GetComponent<RectTransform>();
		rect.SetParent(parent, false);
		Image image = go.GetComponent<Image>();
		image.color = color;
		return image;
	}

	private static TMP_Text CreateText(
		string name,
		RectTransform parent,
		string value,
		float fontSize,
		Color color,
		FontStyles style,
		TextAlignmentOptions alignment)
	{
		GameObject go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
		RectTransform rect = go.GetComponent<RectTransform>();
		rect.SetParent(parent, false);

		TextMeshProUGUI text = go.GetComponent<TextMeshProUGUI>();
		text.font = TMP_Settings.defaultFontAsset;
		text.text = value;
		text.fontSize = fontSize;
		text.color = color;
		text.fontStyle = style;
		text.alignment = alignment;
		text.enableAutoSizing = false;
		return text;
	}

	private static Button CreateButton(
		string name,
		RectTransform parent,
		Vector2 position,
		Color fillColor,
		Color outlineColor,
		out TMP_Text label)
	{
		GameObject go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
		RectTransform rect = go.GetComponent<RectTransform>();
		rect.SetParent(parent, false);
		rect.anchorMin = new Vector2(0.5f, 0.5f);
		rect.anchorMax = new Vector2(0.5f, 0.5f);
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.sizeDelta = new Vector2(ButtonWidth, ButtonHeight);
		rect.anchoredPosition = position;

		Image image = go.GetComponent<Image>();
		image.color = fillColor;

		Outline outline = go.AddComponent<Outline>();
		outline.effectColor = outlineColor;
		outline.effectDistance = new Vector2(1.5f, -1.5f);

		Shadow shadow = go.AddComponent<Shadow>();
		shadow.effectColor = new Color(0f, 0f, 0f, 0.22f);
		shadow.effectDistance = new Vector2(0f, -8f);

		Button button = go.GetComponent<Button>();
		ColorBlock colors = button.colors;
		colors.normalColor = fillColor;
		colors.highlightedColor = Color.Lerp(fillColor, Color.white, 0.14f);
		colors.pressedColor = Color.Lerp(fillColor, Color.black, 0.08f);
		colors.selectedColor = colors.highlightedColor;
		colors.disabledColor = new Color(fillColor.r, fillColor.g, fillColor.b, fillColor.a * 0.45f);
		button.colors = colors;
		button.transition = Selectable.Transition.ColorTint;

		label = CreateText(
			"Label",
			rect,
			name,
			22f,
			outlineColor,
			FontStyles.Bold,
			TextAlignmentOptions.Center);
		StretchRect(label.rectTransform, rect.sizeDelta, Vector2.zero);
		return button;
	}
}
