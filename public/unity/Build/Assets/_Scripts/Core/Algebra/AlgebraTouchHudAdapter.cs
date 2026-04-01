using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using TMPro;

[DefaultExecutionOrder(900)]
public sealed class AlgebraTouchHudAdapter : MonoBehaviour
{
	private const string RuntimeObjectName = nameof(AlgebraTouchHudAdapter);
	private const string HowToButtonObjectName = "? How to";
	private const string HowToLabelKeyword = "Tutorial";
	private const string ExitLabelKeyword = "EXIT";
	private const float MinTouchShortEdgePx = 600f;
	private const float MaxTabletShortEdgePx = 1700f;
	private const float ResolveRetryIntervalSeconds = 0.5f;

	private RectTransform howToButtonRect;
	private RectTransform exitButtonRect;
	private RectTransform topHudCanvasRect;
	private TextMeshProUGUI howToLabel;
	private TextMeshProUGUI exitLabel;
	private int lastScreenW = -1;
	private int lastScreenH = -1;
	private Rect lastSafeArea = new Rect(-1f, -1f, -1f, -1f);
	private int defaultPixelDragThreshold = -1;
	private bool? defaultMultiTouchEnabled;
	private bool touchLayoutApplied;
	private float nextResolveAttemptTime;

	private struct RectBaseline
	{
		public Vector2 sizeDelta;
		public Vector2 anchoredPosition;
		public Vector2 anchorMin;
		public Vector2 anchorMax;
		public Vector2 pivot;
		public Vector3 localScale;
		public float fontSizeMax;
		public float fontSizeMin;
		public Color color;
		public bool enableAutoSizing;
	}

	private RectBaseline howToBaseline;
	private RectBaseline exitBaseline;
	private bool howToBaselineCaptured;
	private bool exitBaselineCaptured;

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
	private static void InstallIfNeeded()
	{
		if (FindFirstObjectByType<AlgebraTouchHudAdapter>() != null)
		{
			return;
		}

		if (FindFirstObjectByType<DragExecutionController>() == null)
		{
			return;
		}

		GameObject go = new GameObject(RuntimeObjectName);
		go.hideFlags = HideFlags.DontSave;
		go.AddComponent<AlgebraTouchHudAdapter>();
	}

	private void Awake()
	{
		TryResolveReferences();
		RefreshIfNeeded(force: true);
	}

	private void LateUpdate()
	{
		RefreshIfNeeded(force: false);
	}

	private void OnDestroy()
	{
		RestoreAuthoringState();
		RestoreInputDefaults();
	}

	private void RefreshIfNeeded(bool force)
	{
		if (ShouldRetryReferenceResolution(force))
		{
			TryResolveReferences();
			nextResolveAttemptTime = Time.unscaledTime + ResolveRetryIntervalSeconds;
		}

		Rect safe = Screen.safeArea;
		bool changed = force
			|| Screen.width != lastScreenW
			|| Screen.height != lastScreenH
			|| !ApproximatelyRect(safe, lastSafeArea);

		if (!changed)
		{
			return;
		}

		lastScreenW = Screen.width;
		lastScreenH = Screen.height;
		lastSafeArea = safe;

		ApplyTouchInputTuning();
		ApplyTouchButtonLayout();
	}

	private void TryResolveReferences()
	{
		howToButtonRect = null;
		exitButtonRect = null;
		howToLabel = null;
		exitLabel = null;
		topHudCanvasRect = null;

		TextMeshProUGUI[] texts = FindObjectsByType<TextMeshProUGUI>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
		TryResolveNamedButton(HowToButtonObjectName, out howToButtonRect, out howToLabel);
		TryResolveButtonFromTexts(texts, HowToLabelKeyword, ref howToButtonRect, ref howToLabel);
		TryResolveButtonFromTexts(texts, ExitLabelKeyword, ref exitButtonRect, ref exitLabel);

		topHudCanvasRect = ResolveRootCanvasRect(howToButtonRect != null ? howToButtonRect : exitButtonRect);

		CaptureBaseline(ref howToBaseline, ref howToBaselineCaptured, howToButtonRect, howToLabel);
		CaptureBaseline(ref exitBaseline, ref exitBaselineCaptured, exitButtonRect, exitLabel);
	}

	private bool ShouldRetryReferenceResolution(bool force)
	{
		return NeedsReferenceResolution()
			&& (force || Time.unscaledTime >= nextResolveAttemptTime);
	}

	private void TryResolveNamedButton(string objectName, out RectTransform rect, out TextMeshProUGUI label)
	{
		rect = null;
		label = null;

		GameObject go = GameObject.Find(objectName);
		if (go == null || IsTutorialOverlayObject(go.transform))
		{
			return;
		}

		rect = ResolveButtonRoot(go.transform);
		if (rect != null)
		{
			label = rect.GetComponentInChildren<TextMeshProUGUI>(true);
		}
	}

	private static void TryResolveButtonFromTexts(
		TextMeshProUGUI[] texts,
		string keyword,
		ref RectTransform rect,
		ref TextMeshProUGUI label)
	{
		if (rect != null)
		{
			return;
		}

		for (int i = 0; i < texts.Length; i++)
		{
			TextMeshProUGUI tmp = texts[i];
			if (tmp == null || IsTutorialOverlayObject(tmp.transform))
			{
				continue;
			}

			string text = (tmp.text ?? string.Empty).Trim();
			if (text.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) < 0)
			{
				continue;
			}

			rect = ResolveButtonRoot(tmp.transform);
			label = tmp;
			return;
		}
	}

	private static void CaptureBaseline(
		ref RectBaseline baseline,
		ref bool captured,
		RectTransform rect,
		TextMeshProUGUI label)
	{
		if (captured || rect == null)
		{
			return;
		}

		baseline = new RectBaseline
		{
			sizeDelta = rect.sizeDelta,
			anchoredPosition = rect.anchoredPosition,
			anchorMin = rect.anchorMin,
			anchorMax = rect.anchorMax,
			pivot = rect.pivot,
			localScale = rect.localScale,
			fontSizeMax = label != null ? label.fontSizeMax : 0f,
			fontSizeMin = label != null ? label.fontSizeMin : 0f,
			color = label != null ? label.color : Color.white,
			enableAutoSizing = label != null && label.enableAutoSizing
		};
		captured = true;
	}

	private bool NeedsReferenceResolution()
	{
		return topHudCanvasRect == null
			|| howToButtonRect == null
			|| exitButtonRect == null;
	}

	private void ApplyTouchButtonLayout()
	{
		if (topHudCanvasRect == null)
		{
			return;
		}

		bool touchProfile = IsMobileTabletTouchTarget();
		if (!touchProfile)
		{
			RestoreAuthoringState();
			return;
		}

		GetCanvasSpaceMetrics(topHudCanvasRect, out float canvasW, out float canvasH, out float safeLeft, out float safeRight, out float safeTop);
		float shortEdge = Mathf.Min(canvasW, canvasH);
		float scale = Mathf.Clamp(Mathf.Min(canvasW / 1920f, canvasH / 1080f), 0.78f, 1.1f);

		float sidePad = Mathf.Round(Mathf.Clamp(64f * scale, 40f, 82f));
		float topPad = Mathf.Round(Mathf.Clamp(46f * scale, 28f, 72f));
		sidePad += Mathf.Round(Mathf.Clamp(shortEdge * 0.01f, 6f, 18f));
		topPad += Mathf.Round(Mathf.Clamp(shortEdge * 0.008f, 4f, 14f));

		sidePad += safeLeft;
		float rightPad = sidePad + safeRight;
		float topInsetPad = topPad + safeTop;
		ApplyEdgeButtonLayout(
			howToButtonRect,
			howToLabel,
			howToBaseline,
			howToBaselineCaptured,
			anchorRight: true,
			xPad: rightPad,
			yPad: topInsetPad + (26f * scale));

		ApplyEdgeButtonLayout(
			exitButtonRect,
			exitLabel,
			exitBaseline,
			exitBaselineCaptured,
			anchorRight: false,
			xPad: sidePad,
			yPad: topInsetPad + (26f * scale));

		touchLayoutApplied = true;
	}

	private void RestoreAuthoringState()
	{
		if (!touchLayoutApplied)
		{
			return;
		}

		RestoreButtonLayout(howToButtonRect, howToLabel, howToBaseline, howToBaselineCaptured);
		RestoreButtonLayout(exitButtonRect, exitLabel, exitBaseline, exitBaselineCaptured);
		touchLayoutApplied = false;
	}

	private void ApplyEdgeButtonLayout(
		RectTransform rect,
		TextMeshProUGUI label,
		RectBaseline baseline,
		bool hasBaseline,
		bool anchorRight,
		float xPad,
		float yPad)
	{
		if (rect == null || !hasBaseline)
		{
			return;
		}

		rect.localScale = baseline.localScale == Vector3.zero ? Vector3.one : baseline.localScale * 1.08f;
		rect.sizeDelta = new Vector2(Mathf.Max(baseline.sizeDelta.x, 180f), Mathf.Max(baseline.sizeDelta.y, 82f));

		if (anchorRight)
		{
			rect.anchorMin = new Vector2(1f, 1f);
			rect.anchorMax = new Vector2(1f, 1f);
			rect.pivot = new Vector2(0.5f, 0.5f);
			rect.anchoredPosition = new Vector2(-xPad, -yPad);
		}
		else
		{
			rect.anchorMin = new Vector2(0f, 1f);
			rect.anchorMax = new Vector2(0f, 1f);
			rect.pivot = new Vector2(0.5f, 0.5f);
			rect.anchoredPosition = new Vector2(xPad, -yPad);
		}

		if (label != null)
		{
			label.enableAutoSizing = true;
			float baseMax = baseline.fontSizeMax > 0f ? baseline.fontSizeMax : label.fontSize;
			float baseMin = baseline.fontSizeMin > 0f ? baseline.fontSizeMin : Mathf.Max(12f, baseMax * 0.6f);
			label.fontSizeMin = Mathf.Clamp(baseMin * 0.9f, 10f, 28f);
			label.fontSizeMax = Mathf.Clamp(baseMax * 1.05f, 12f, 48f);
			label.color = baseline.color != default ? baseline.color : label.color;
		}
	}

	private static void RestoreButtonLayout(RectTransform rect, TextMeshProUGUI label, RectBaseline baseline, bool hasBaseline)
	{
		if (rect == null || !hasBaseline)
		{
			return;
		}

		rect.anchorMin = baseline.anchorMin;
		rect.anchorMax = baseline.anchorMax;
		rect.pivot = baseline.pivot;
		rect.anchoredPosition = baseline.anchoredPosition;
		rect.sizeDelta = baseline.sizeDelta;
		rect.localScale = baseline.localScale == Vector3.zero ? Vector3.one : baseline.localScale;

		if (label != null)
		{
			label.enableAutoSizing = baseline.enableAutoSizing;
			if (baseline.fontSizeMin > 0f)
			{
				label.fontSizeMin = baseline.fontSizeMin;
			}
			if (baseline.fontSizeMax > 0f)
			{
				label.fontSizeMax = baseline.fontSizeMax;
			}
			label.color = baseline.color != default ? baseline.color : label.color;
		}
	}

	private void ApplyTouchInputTuning()
	{
		EventSystem evt = EventSystem.current;
		if (evt == null)
		{
			return;
		}

		if (defaultPixelDragThreshold < 0)
		{
			defaultPixelDragThreshold = evt.pixelDragThreshold;
		}

		if (!defaultMultiTouchEnabled.HasValue)
		{
			defaultMultiTouchEnabled = Input.multiTouchEnabled;
		}

		if (IsMobileTabletTouchTarget())
		{
			float shortEdge = Mathf.Min(Screen.width, Screen.height);
			int targetThreshold = Mathf.RoundToInt(Mathf.Clamp(shortEdge * 0.018f, 16f, 34f));
			evt.pixelDragThreshold = Mathf.Max(defaultPixelDragThreshold, targetThreshold);
			Input.multiTouchEnabled = true;
		}
		else if (defaultPixelDragThreshold > 0)
		{
			evt.pixelDragThreshold = defaultPixelDragThreshold;
			if (defaultMultiTouchEnabled.HasValue)
			{
				Input.multiTouchEnabled = defaultMultiTouchEnabled.Value;
			}
		}
	}

	private void RestoreInputDefaults()
	{
		EventSystem evt = EventSystem.current;
		if (evt != null && defaultPixelDragThreshold > 0)
		{
			evt.pixelDragThreshold = defaultPixelDragThreshold;
		}

		if (defaultMultiTouchEnabled.HasValue)
		{
			Input.multiTouchEnabled = defaultMultiTouchEnabled.Value;
		}
	}

	private static RectTransform ResolveButtonRoot(Transform leaf)
	{
		if (leaf == null)
		{
			return null;
		}

		Transform t = leaf;
		while (t != null)
		{
			if (t.GetComponent<Button>() != null)
			{
				return t as RectTransform;
			}
			t = t.parent;
		}

		return leaf as RectTransform;
	}

	private static bool IsTutorialOverlayObject(Transform t)
	{
		Transform cursor = t;
		while (cursor != null)
		{
			string name = cursor.name ?? string.Empty;
			if (name.Equals("Game Tut", StringComparison.OrdinalIgnoreCase)
				|| name.Equals("Game Tutorial", StringComparison.OrdinalIgnoreCase)
				|| name.IndexOf("TutorialManager", StringComparison.OrdinalIgnoreCase) >= 0)
			{
				return true;
			}

			cursor = cursor.parent;
		}

		return false;
	}

	private static RectTransform ResolveRootCanvasRect(Transform t)
	{
		if (t == null)
		{
			return null;
		}

		Canvas canvas = t.GetComponentInParent<Canvas>();
		if (canvas == null)
		{
			return null;
		}

		Canvas root = canvas.rootCanvas != null ? canvas.rootCanvas : canvas;
		return root.transform as RectTransform;
	}

	private static void GetCanvasSpaceMetrics(
		RectTransform canvasRect,
		out float canvasW,
		out float canvasH,
		out float safeLeft,
		out float safeRight,
		out float safeTop)
	{
		float screenW = Mathf.Max(1f, Screen.width);
		float screenH = Mathf.Max(1f, Screen.height);

		canvasW = (canvasRect != null && canvasRect.rect.width > 1f) ? canvasRect.rect.width : screenW;
		canvasH = (canvasRect != null && canvasRect.rect.height > 1f) ? canvasRect.rect.height : screenH;

		Rect safe = Screen.safeArea;
		float sx = canvasW / screenW;
		float sy = canvasH / screenH;

		safeLeft = Mathf.Max(0f, safe.xMin * sx);
		safeRight = Mathf.Max(0f, (screenW - safe.xMax) * sx);
		safeTop = Mathf.Max(0f, (screenH - safe.yMax) * sy);
	}

	private static bool ApproximatelyRect(Rect a, Rect b)
	{
		return Mathf.Abs(a.x - b.x) < 0.5f
			&& Mathf.Abs(a.y - b.y) < 0.5f
			&& Mathf.Abs(a.width - b.width) < 0.5f
			&& Mathf.Abs(a.height - b.height) < 0.5f;
	}

	private static bool IsMobileTabletTouchTarget()
	{
		float shortEdge = Mathf.Min(Screen.width, Screen.height);
		bool touchCapable = Input.touchSupported;
		bool handheld = SystemInfo.deviceType == DeviceType.Handheld || Application.isMobilePlatform;
		bool likelyTabletBrowser = Application.platform == RuntimePlatform.WebGLPlayer
			&& touchCapable
			&& shortEdge >= MinTouchShortEdgePx
			&& shortEdge <= MaxTabletShortEdgePx;

		return handheld || likelyTabletBrowser;
	}
}
