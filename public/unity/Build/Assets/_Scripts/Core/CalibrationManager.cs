using System.Collections;
using System.Collections.Generic;

using TMPro;

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

using DG.Tweening;

public class CalibrationManager : MonoBehaviour
{
	[Header("Calibration Settings")]
	public int lemonTargetCount = 5;
	public float beatInterval = 2f;
	public AudioSource clickSource;
	public GameObject lemonPrefab;
	public Transform lemonSpawnPoint;
	public Transform hitZone;
	public KeyCode calibrationKey = KeyCode.Space;

	[Header("Hit Window (seconds)")]
	public float earlyWindow = 0.15f;
	public float lateWindow = 0.15f;

	[Header("Collector UI")]
	public Image[] collectorIcons;

	[Header("Feedback")]
	public TextMeshProUGUI instructionText;

	[Header("Scene Flow")]
	public string nextSceneName;

	[Header("Platform Latency Baseline")]
	[SerializeField] private bool applyPlatformBaseline = true;
	[SerializeField] private double defaultBaselineSeconds = 0.0;
	[SerializeField] private double webGlBaselineSeconds = 0.18;

	[Header("Pop Audio")]
	[SerializeField] private bool forceClick2D = true;
	[SerializeField, Range(0.5f, 3f)] private float webGlClickVolumeMultiplier = 1.6f;

	[Header("Pop Ups")]
	[SerializeField] private GameObject mainCalibrationScreen;
	[SerializeField] private Image calibrationStartPopup;
	[SerializeField] private Image calibrationCompletePopup;
	[SerializeField] private TextMeshProUGUI calibrationCountdownText;
	[SerializeField] private TextMeshProUGUI calibrationCompleteText;
	[SerializeField] private string[] completionPopupMessages;

	[Header("Responsive Layout")]
	[SerializeField] private bool applyResponsiveLayout = true;
	[SerializeField] private Vector2 referenceResolution = new Vector2(1920f, 1080f);
	[SerializeField] private RectTransform canvasRect;
	[SerializeField] private RectTransform backgroundImageRect;
	[SerializeField] private RectTransform calibrationCompletePopupRect;
	[SerializeField] private RectTransform laneRect;
	[SerializeField] private RectTransform spaceIconRect;
	[SerializeField] private RectTransform upArrowRect;
	[SerializeField] private RectTransform hitZoneRect;
	[SerializeField] private Canvas calibrationCanvas;
	[SerializeField] private Vector2 tapTargetPadding = new Vector2(42f, 28f);
	[SerializeField] private Shapes.Rectangle mainBackgroundShape;
	[SerializeField] private Shapes.Rectangle laneShape;

	// --- runtime state ---
	private readonly List<double> latencies = new();
	private readonly List<CalibrationNote> activeNotes = new();
	private int collectedCount = 0;
	private bool isCalibrating = false;
	private double startDSPTime;
	private int beatIndex;
	private Vector2 lastAppliedCanvasSize = Vector2.zero;

	private const double CLICK_LEAD = 0.2; // schedule clicks 200ms ahead
	private const float ReferenceLaneYOffset = -256.6f;
	private const float ReferenceLaneHeight = 217.8f;
	private const float ReferenceSpaceIconOffsetX = -850f;
	private const float ReferenceUpArrowOffsetY = -367f;
	private const float ReferenceHitZoneSize = 109f;
	private const float ReferenceSpaceIconSize = 100f;
	private const float ReferenceUpArrowWidth = 15f;
	private const float ReferenceUpArrowHeight = 62f;

	void Awake()
	{
		if (applyPlatformBaseline)
		{
			double baseline = defaultBaselineSeconds;
			if (Application.platform == RuntimePlatform.WebGLPlayer)
			{
				baseline = webGlBaselineSeconds;
			}

			AudioManager.SetPlatformLatencyBaseline(baseline);
		}

		if (clickSource != null && forceClick2D)
		{
			clickSource.spatialBlend = 0f;
			clickSource.dopplerLevel = 0f;
		}

#if UNITY_WEBGL
		if (clickSource != null && webGlClickVolumeMultiplier > 0f)
		{
			clickSource.volume = Mathf.Clamp01(clickSource.volume * webGlClickVolumeMultiplier);
		}
#endif
	}

	void Start()
	{
		ApplyResponsiveLayout(force: true);

		// Hide all icons
		foreach (var icon in collectorIcons)
		{
			var c = icon.color;
			c.a = 0f;
			icon.color = c;
			icon.transform.localScale = Vector3.one;
		}
	}

	public void StartCalibration()
	{
		if (isCalibrating)
		{
			return;
		}

		ApplyResponsiveLayout(force: true);
		AudioManager.UnlockFromUserGesture(false); // ensure WebAudio context is ready for metronome clicks

		latencies.Clear();
		collectedCount = 0;
		isCalibrating = true;
		instructionText.text = "Tap or click the center target, or press Space, as each node reaches it.";

		foreach (var icon in collectorIcons)
		{
			// Show at 40% alpha
			var c = icon.color;
			c.a = 0.4f;
			icon.color = c;

			// Kill any previous tweens & reset scale
			DOTween.Kill(icon.transform);
			icon.transform.localScale = Vector3.one;

			// Idle pulse
			icon.transform.DOScale(1.05f, 0.6f).SetEase(Ease.InOutSine).SetLoops(-1, LoopType.Yoyo).SetRelative(false)
				.SetLink(icon.gameObject, LinkBehaviour.KillOnDestroy);
		}

		clickSource.Stop();

		startDSPTime = AudioSettings.dspTime + beatInterval;
		beatIndex = 0;

		StartCoroutine(BeatLoop());
	}

	private IEnumerator BeatLoop()
	{
		while (isCalibrating && collectedCount < lemonTargetCount)
		{
			double baseBeatTime = startDSPTime + (beatIndex * beatInterval);

			double clickTime = baseBeatTime;
			double nowDSP = AudioSettings.dspTime;

			// Ensure safe lead time
			if (clickTime - nowDSP < CLICK_LEAD)
			{
				clickTime = nowDSP + CLICK_LEAD;
			}

			// Calculate travel time dynamically for this note
			float actualTravelTime = (float)(clickTime - nowDSP);

			// Play click
			clickSource.Stop();
			clickSource.PlayScheduled(clickTime);

			// Spawn lemon with correct timing
			SpawnLemon(clickTime, actualTravelTime);

			beatIndex++;
			yield return new WaitForSecondsRealtime(beatInterval);
		}

		yield return new WaitForSecondsRealtime(0.75f);
		FinishCalibration();
	}

	private void SpawnLemon(double clickTime, float travelTime)
	{
		var go = Instantiate(lemonPrefab, lemonSpawnPoint.position, Quaternion.identity, lemonSpawnPoint.parent);
		go.transform.localScale = Vector3.one;

		var note = go.GetComponent<CalibrationNote>();

		if (note.visual != null)
		{
			note.visual.localScale = Vector3.one;
		}

		foreach (var img in go.GetComponentsInChildren<Image>(true))
		{
			var c = img.color;
			c.a = 1f;
			img.color = c;
		}

		note.Init(this, clickTime, hitZone, travelTime);
		activeNotes.Add(note);
	}



	void Update()
	{
		ApplyResponsiveLayout();

		if (!isCalibrating)
		{
			return;
		}

		for (int i = activeNotes.Count - 1; i >= 0; i--)
		{
			if (activeNotes[i] == null)
			{
				activeNotes.RemoveAt(i);
			}
		}

		if (activeNotes.Count > 0)
		{
			if (Input.GetKeyDown(calibrationKey))
			{
				TryConsumeBestCalibrationNote(AudioSettings.dspTime);
			}

			if (TryGetPointerDownScreenPosition(out Vector2 pointerScreenPosition) && IsPointerInsideCalibrationTarget(pointerScreenPosition))
			{
				TryConsumeBestCalibrationNote(AudioSettings.dspTime);
			}
		}

		double tnow = AudioSettings.dspTime;
		for (int i = activeNotes.Count - 1; i >= 0; i--)
		{
			var n = activeNotes[i];
			if (n == null) { activeNotes.RemoveAt(i); continue; }

			if (tnow > n.ClickDSPTime + lateWindow)
			{
				n.Expire();
				activeNotes.RemoveAt(i);
			}
		}
	}

	public void RegisterHit(double latency)
	{
		if (!isCalibrating) return;

		latencies.Add(latency);

		if (collectedCount < collectorIcons.Length)
		{
			var icon = collectorIcons[collectedCount];
			Vector3 baseScale = Vector3.one;

			// Kill any running tweens
			DOTween.Kill(icon.transform);

			// Reset to base scale
			icon.transform.localScale = baseScale;

			// Pop animation for hit
			icon.transform
				.DOScale(baseScale * 1.05f, 0.15f)
				.SetEase(Ease.OutBack)
				.SetLink(icon.gameObject, LinkBehaviour.KillOnDestroy)
				.OnComplete(() =>
				{
					icon.transform
						.DOScale(baseScale, 0.1f)
						.SetEase(Ease.InOutSine)
						.SetLink(icon.gameObject, LinkBehaviour.KillOnDestroy)
						.OnComplete(() =>
						{
							// Lock to exact scale
							icon.transform.localScale = baseScale;

							// Resume smaller idle pulse for hit icon
							icon.transform.DOScale(1.02f, 0.6f)
								.SetEase(Ease.InOutSine)
								.SetLoops(-1, LoopType.Yoyo)
								.SetRelative(false)
								.SetLink(icon.gameObject, LinkBehaviour.KillOnDestroy);
						});
				});

			// Full opacity
			var c = icon.color;
			c.a = 1f;
			icon.color = c;
		}

		collectedCount++;
		if (collectedCount >= lemonTargetCount) FinishCalibration();
	}


	private void FinishCalibration()
	{
		if (!isCalibrating)
		{
			return;
		}

		isCalibrating = false;

		// Reject obvious outliers (>350ms) to keep calibration stable across misses.
		double chosen;
		var clean = new List<double>();

		if (latencies != null && latencies.Count > 0)
		{
			// Filter out obvious outliers without using LINQ (WebGL-safe)
			for (int i = 0; i < latencies.Count; i++)
			{
				double v = latencies[i];
				if (System.Math.Abs(v) <= 0.35)
				{
					clean.Add(v);
				}
			}

			// Sort ascending so we can take the median
			clean.Sort();
		}

		if (clean.Count == 0)
		{
			// Fallback to simple average of all samples (also LINQ-free)
			if (latencies != null && latencies.Count > 0)
			{
				double sum = 0.0;
				for (int i = 0; i < latencies.Count; i++)
				{
					sum += latencies[i];
				}
				chosen = sum / latencies.Count;
			}
			else
			{
				chosen = 0.0;
			}
		}
		else
		{
			// Median of the cleaned list
			if (clean.Count % 2 == 1)
			{
				chosen = clean[clean.Count / 2];
			}
			else
			{
				int upper = clean.Count / 2;
				int lower = upper - 1;
				chosen = 0.5 * (clean[lower] + clean[upper]);
			}
		}

		AudioManager.SetLatencyOffset(chosen);
		double totalOffset = AudioManager.LatencyOffsetSeconds;
		instructionText.text = $"Calibration complete! Total offset: {totalOffset:F3}s (calibration {chosen:F3}s)";

		if (!string.IsNullOrEmpty(nextSceneName))
		{
			if (calibrationCompletePopup != null)
			{
				calibrationCompletePopup.transform.DOScale(1f, 0.30f).From(0.0f).SetEase(Ease.OutBack);
			}
		}
	}

	public void LoadNextScene()
	{
		SceneManager.LoadScene(nextSceneName);
	}

	private void TryConsumeBestCalibrationNote(double now)
	{
		CalibrationNote best = null;
		double bestAbsDelta = double.MaxValue;

		foreach (var note in activeNotes)
		{
			if (note == null)
				continue;

			double delta = now - note.ClickDSPTime;
			if (delta < -earlyWindow || delta > lateWindow)
				continue;

			double absDelta = System.Math.Abs(delta);
			if (absDelta < bestAbsDelta)
			{
				bestAbsDelta = absDelta;
				best = note;
			}
		}

		if (best == null)
			return;

		double latency = now - best.ClickDSPTime;
		RegisterHit(latency);
		best.OnHitConsumed();
		activeNotes.Remove(best);
	}

	private void ApplyResponsiveLayout(bool force = false)
	{
		if (!applyResponsiveLayout)
			return;

		ResolveResponsiveLayoutReferences();

		if (canvasRect == null || referenceResolution.x <= 0f || referenceResolution.y <= 0f)
			return;

		Vector2 canvasSize = canvasRect.rect.size;
		if (canvasSize.x <= 0f || canvasSize.y <= 0f)
			return;

		if (!force && Approximately(lastAppliedCanvasSize, canvasSize))
			return;

		lastAppliedCanvasSize = canvasSize;

		float xScale = canvasSize.x / referenceResolution.x;
		float yScale = canvasSize.y / referenceResolution.y;
		float uniformScale = Mathf.Min(xScale, yScale);

		if (backgroundImageRect != null)
			SetRectSize(backgroundImageRect, canvasSize);

		if (calibrationCompletePopupRect != null)
			SetRectSize(calibrationCompletePopupRect, canvasSize);

		if (mainBackgroundShape != null)
		{
			mainBackgroundShape.Width = canvasSize.x;
			mainBackgroundShape.Height = canvasSize.y;
		}

		if (laneRect != null)
			laneRect.anchoredPosition = new Vector2(0f, ReferenceLaneYOffset * yScale);

		if (laneShape != null)
		{
			laneShape.Width = canvasSize.x;
			laneShape.Height = ReferenceLaneHeight * yScale;
		}

		if (spaceIconRect != null)
		{
			spaceIconRect.anchoredPosition = new Vector2(ReferenceSpaceIconOffsetX * xScale, 0f);
			SetUniformRectSize(spaceIconRect, ReferenceSpaceIconSize * uniformScale);
		}

		if (upArrowRect != null)
		{
			upArrowRect.anchoredPosition = new Vector2(0f, ReferenceUpArrowOffsetY * yScale);
			SetRectSize(upArrowRect, new Vector2(ReferenceUpArrowWidth * uniformScale, ReferenceUpArrowHeight * uniformScale));
		}

		if (hitZoneRect != null)
			SetUniformRectSize(hitZoneRect, ReferenceHitZoneSize * uniformScale);
	}

	private void ResolveResponsiveLayoutReferences()
	{
		if (canvasRect == null)
			canvasRect = GetComponent<RectTransform>();

		if (calibrationCanvas == null)
			calibrationCanvas = GetComponent<Canvas>();

		if (backgroundImageRect == null)
			backgroundImageRect = FindChildRectTransform("BGImage");

		if (calibrationCompletePopupRect == null)
			calibrationCompletePopupRect = FindChildRectTransform("CalibrationCompletePopUp");

		if (laneRect == null)
			laneRect = FindChildRectTransform("Lane");

		if (spaceIconRect == null)
			spaceIconRect = FindChildRectTransform("SpaceIcon");

		if (upArrowRect == null)
			upArrowRect = FindChildRectTransform("UpArrow");

		if (hitZoneRect == null)
			hitZoneRect = hitZone as RectTransform;

		if (mainBackgroundShape == null)
		{
			RectTransform backgroundRect = FindChildRectTransform("MainCalibration(Rectangle)");
			if (backgroundRect != null)
				mainBackgroundShape = backgroundRect.GetComponent<Shapes.Rectangle>();
		}

		if (laneShape == null && laneRect != null)
			laneShape = laneRect.GetComponent<Shapes.Rectangle>();
	}

	private RectTransform FindChildRectTransform(string targetName)
	{
		RectTransform[] rects = GetComponentsInChildren<RectTransform>(true);
		for (int i = 0; i < rects.Length; i++)
		{
			RectTransform rect = rects[i];
			if (rect != null && rect.name == targetName)
				return rect;
		}

		return null;
	}

	private static void SetUniformRectSize(RectTransform rect, float size)
	{
		SetRectSize(rect, new Vector2(size, size));
	}

	private static void SetRectSize(RectTransform rect, Vector2 size)
	{
		rect.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, size.x);
		rect.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, size.y);
	}

	private static bool Approximately(Vector2 a, Vector2 b)
	{
		return Mathf.Abs(a.x - b.x) < 0.5f && Mathf.Abs(a.y - b.y) < 0.5f;
	}

	private bool TryGetPointerDownScreenPosition(out Vector2 screenPosition)
	{
		for (int i = 0; i < Input.touchCount; i++)
		{
			Touch touch = Input.GetTouch(i);
			if (touch.phase == TouchPhase.Began)
			{
				screenPosition = touch.position;
				return true;
			}
		}

		if (Input.GetMouseButtonDown(0))
		{
			screenPosition = Input.mousePosition;
			return true;
		}

		screenPosition = default;
		return false;
	}

	private bool IsPointerInsideCalibrationTarget(Vector2 screenPosition)
	{
		if (hitZoneRect == null)
			return false;

		Camera eventCamera = GetCalibrationEventCamera();
		if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(hitZoneRect, screenPosition, eventCamera, out Vector2 localPoint))
			return false;

		float scale = hitZoneRect.rect.width > 0f ? hitZoneRect.rect.width / ReferenceHitZoneSize : 1f;
		Vector2 scaledPadding = tapTargetPadding * Mathf.Max(scale, 0.75f);
		Rect paddedRect = hitZoneRect.rect;
		paddedRect.xMin -= scaledPadding.x;
		paddedRect.xMax += scaledPadding.x;
		paddedRect.yMin -= scaledPadding.y;
		paddedRect.yMax += scaledPadding.y;
		return paddedRect.Contains(localPoint);
	}

	private Camera GetCalibrationEventCamera()
	{
		if (calibrationCanvas == null)
			return null;

		return calibrationCanvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : calibrationCanvas.worldCamera;
	}
}
