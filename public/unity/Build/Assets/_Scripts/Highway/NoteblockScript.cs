using System.Collections;
using System;
using System.Collections.Generic;
using DG.Tweening;
using UnityEngine;
using TMPro;
using Shapes;
using UnityEngine.EventSystems;
using MoreMountains.Feedbacks;

public class NoteBlockScript : MonoBehaviour
{
	[SerializeField] private GameObject diagramManagerGameObject;
	[SerializeField] private GameObject InteractionHandlerGameObject;
	[SerializeField] private ChartSystem chartLoader;
	public HighwayGlowAnimator RefToHighwayGlowAnimator;

	public XplorerGuitarInput RefToInputController;
	public GameObject[] RefToNoteblocks;
	public enum NoteBlockType { GNoteblocks, DNoteblocks }
	public NoteBlockType BlockType;
	private const int LaneCount = 5;
	private readonly List<Transform>[] activeNotesByLane = new List<Transform>[LaneCount]; // Notes currently in each lane trigger
	private double dspNoteHitTime;

	Color defaultGreenColor, defaultRedColor, defaultYellowColor, defaultBlueColor, defaultOrangeColor;
	Vector3 originalScaleGreen, originalScaleRed, originalScaleYellow, originalScaleBlue, originalScaleOrange;
	Tween greenTween, redTween, yellowTween, blueTween, orangeTween;

	Color defaultDPadLeftColor, defaultDPadRightColor, defaultDPadUpColor, defaultDPadDownColor;
	Vector3 originalScaleDPadLeft, originalScaleDPadRight, originalScaleDPadUp, originalScaleDPadDown;
	Tween dpadLeftTween, dpadRightTween, dpadUpTween, dpadDownTween;

	public GameObject UINoteGreenPrefab, UINoteRedPrefab, UINoteYellowPrefab, UINoteBluePrefab, UINoteOrangePrefab;
	private Dictionary<string, GameObject> noteColorToPrefab = new Dictionary<string, GameObject>();

	public Camera GMainCamera;
	public Camera DMainCamera;
	private AudioSource audioSource;
	// Prevent spamming TriggerGlow every frame while a key is held
	private bool[] lanePressedPrev = new bool[5];
	// Track current animation state per lane to avoid restarting tweens every frame
	private bool[] laneAnimActive = new bool[5];

	[Header("Debug (optional)")]
	[SerializeField] private bool debugHitDetection = false;

	[Header("UI/FX (optional)")]
	[Tooltip("UI canvas used by gem flight effects. If null, first active Canvas will be used.")]
	public Canvas uiCanvas;

	// --- Lane label + FX config ---
	[Header("Inline Lane Labels")]
	[SerializeField] private TextMeshProUGUI[] laneLabels = new TextMeshProUGUI[5];
	[SerializeField] private bool tintLabelByLane = true;

	[Header("Accuracy Colours")]
	[SerializeField] private Color perfectLabel = new Color32(0x62, 0xEF, 0x48, 0xFF);
	[SerializeField] private Color goodLabel = new Color32(0xFF, 0xD4, 0x5A, 0xFF);
	[SerializeField] private Color missLabel = new Color32(0xFF, 0x3C, 0x00, 0xFF);

	[Header("Label Timing (ms)")]
	[SerializeField][Range(0.35f, 0.7f)] private float labelLifetime = 0.5f; // 400–600ms target
	[SerializeField][Range(0.20f, 0.6f)] private float beatThrottleSeconds = 0.35f; // “one per beat” default ~174 BPM

	// throttle book-keeping (per lane)
	private double[] lastLabelDSP = new double[5];
	private Tween[] labelTweens = new Tween[5];
	[Header("Perfect FX (Shapes Discs as ring ripple)")]
	[SerializeField] private Disc[] laneRipples = new Disc[5]; // optional; can be null
	[SerializeField] private float rippleMinRadius = 0.12f;
	[SerializeField] private float rippleMaxRadius = 0.32f;
	[SerializeField] private float rippleTime = 0.18f;

	[Header("Handle Animation")]
	[SerializeField] private float pressPopScale = 1.20f;   // peak scale on press
	[SerializeField] private float settleScale = 1.025f;    // slight overshoot before returning
	[SerializeField] private float pressPopDuration = 0.25f;
	[SerializeField] private float settleDuration = 0.15f;
	[SerializeField] private float returnDuration = 0.12f;
	[SerializeField] private float hitBumpScale = 1.12f;
	[SerializeField] private float hitBumpDuration = 0.12f;

	[Header("Lane Colours (for ripple / subtle tint)")]
	[SerializeField]
	private Color[] laneColors = new Color[5]
	{
	new Color32(  4,170,  0,255), // S = Green
    new Color32(201, 20, 20,255), // F = Red
    new Color32(245,185, 13,255), // Space = Yellow
    new Color32(  7,101,234,255), // J = Blue
    new Color32(255,165,  0,255)  // L = Orange
	};

	private void Awake()
	{
		for (int i = 0; i < activeNotesByLane.Length; i++)
		{
			if (activeNotesByLane[i] == null)
			{
				activeNotesByLane[i] = new List<Transform>();
			}
		}

		if (chartLoader != null && RefToNoteblocks != null && RefToNoteblocks.Length > 0 && RefToNoteblocks[0] != null)
		{
			chartLoader.SetHighwayHitLine(RefToNoteblocks[0].transform);
		}
	}

	void Start()
	{
		audioSource = GetFirstObjectOfType<AudioSource>();
		if (audioSource == null)
		{
			Debug.LogError("AudioSource not found in the scene.");
		}

		// Initializing default colors and scales for Noteblocks
		if (this.gameObject.name == "GNoteblocks")
		{
			defaultGreenColor = RefToNoteblocks[0].GetComponent<SpriteRenderer>().color;
			defaultRedColor = RefToNoteblocks[1].GetComponent<SpriteRenderer>().color;
			defaultYellowColor = RefToNoteblocks[2].GetComponent<SpriteRenderer>().color;
			defaultBlueColor = RefToNoteblocks[3].GetComponent<SpriteRenderer>().color;
			defaultOrangeColor = RefToNoteblocks[4].GetComponent<SpriteRenderer>().color;

			originalScaleGreen = RefToNoteblocks[0].transform.localScale;
			originalScaleRed = RefToNoteblocks[1].transform.localScale;
			originalScaleYellow = RefToNoteblocks[2].transform.localScale;
			originalScaleBlue = RefToNoteblocks[3].transform.localScale;
			originalScaleOrange = RefToNoteblocks[4].transform.localScale;
		}
		//Cacheing for resource optimisation
		noteColorToPrefab.Add("Green", UINoteGreenPrefab);
		noteColorToPrefab.Add("Red", UINoteRedPrefab);
		noteColorToPrefab.Add("Yellow", UINoteYellowPrefab);
		noteColorToPrefab.Add("Blue", UINoteBluePrefab);
		noteColorToPrefab.Add("Orange", UINoteOrangePrefab);


		/* 
        if (this.gameObject.name == "DNoteblocks")
        {
            defaultDPadLeftColor = RefToNoteblocks[0].GetComponent<SpriteRenderer>().color;
            defaultDPadRightColor = RefToNoteblocks[1].GetComponent<SpriteRenderer>().color;
            defaultDPadUpColor = RefToNoteblocks[2].GetComponent<SpriteRenderer>().color;
            defaultDPadDownColor = RefToNoteblocks[3].GetComponent<SpriteRenderer>().color;

            originalScaleDPadLeft = RefToNoteblocks[0].transform.localScale;
            originalScaleDPadRight = RefToNoteblocks[1].transform.localScale;
            originalScaleDPadUp = RefToNoteblocks[2].transform.localScale;
            originalScaleDPadDown = RefToNoteblocks[3].transform.localScale;
		}
		*/
	}

	public void OnChildTriggerEnter(GameObject child, Collider other)
	{
		Transform noteTransform = other.transform;
		if (!IsGameplayNote(noteTransform))
		{
			return;
		}

		int laneIndex = GetLaneIndexFromTrigger(child);
		if (laneIndex < 0 || laneIndex >= activeNotesByLane.Length)
		{
			return;
		}

		if (ScoreManagerScript.Instance)
		{
			ScoreManagerScript.Instance.RegisterNoteDestroyed();
		}

		var laneNotes = activeNotesByLane[laneIndex];
		if (!laneNotes.Contains(noteTransform))
		{
			laneNotes.Add(noteTransform);

			// Start the fade effect for the TextMeshPro component
			SpriteRenderer noteImg = other.GetComponentInChildren<SpriteRenderer>();
			if (noteImg != null)
			{
				noteImg.DOFade(0.4f, 0.35f).SetEase(Ease.InOutQuad); // Fades to 50% alpha over 0.5s
			}
		}
	}

	public void OnChildTriggerExit(GameObject child, Collider other)
	{
		Transform noteTransform = other.transform;
		if (!IsGameplayNote(noteTransform))
		{
			return;
		}

		int laneIndex = GetLaneIndexFromTrigger(child);
		if (laneIndex < 0 || laneIndex >= activeNotesByLane.Length)
		{
			return;
		}

		var laneNotes = activeNotesByLane[laneIndex];
		if (noteTransform != null && laneNotes.Contains(noteTransform))
		{
			laneNotes.Remove(noteTransform);
			KillTweens(noteTransform);
			Destroy(noteTransform.gameObject);
		}

		if (noteTransform != null)
		{
			Debug.Log($"Destroyed {noteTransform.name} on trigger exit.");
		}
	}

	private void Update()
	{
		// Suspend lane animations while the rebind panel is visible
		if (CustomizeControls.PanelVisible)
		{
			return;
		}

		// If this is the GNoteblocks GameObject, run thine code my good sir
		if (this.gameObject.name == "GNoteblocks")
		{
			// Handle interactions and animations based on input
			bool laneHeld = RefToInputController.A > 0;
			HandleColourAndAnimation(0, laneHeld, RefToNoteblocks[0], ref greenTween, new Color(4f / 255f, 170f / 255f, 0f, 1f), defaultGreenColor, originalScaleGreen);
			ProcessLaneInput(0, RefToNoteblocks[0], RefToInputController.A == 1, laneHeld);

			laneHeld = RefToInputController.B > 0;
			HandleColourAndAnimation(1, laneHeld, RefToNoteblocks[1], ref redTween, new Color(201f / 255f, 20f / 255f, 20f / 255f, 1f), defaultRedColor, originalScaleRed);
			ProcessLaneInput(1, RefToNoteblocks[1], RefToInputController.B == 1, laneHeld);

			laneHeld = RefToInputController.Y > 0;
			HandleColourAndAnimation(2, laneHeld, RefToNoteblocks[2], ref yellowTween, new Color(245f / 255f, 185f / 255f, 13f / 255f, 1f), defaultYellowColor, originalScaleYellow);
			ProcessLaneInput(2, RefToNoteblocks[2], RefToInputController.Y == 1, laneHeld);

			laneHeld = RefToInputController.X > 0;
			HandleColourAndAnimation(3, laneHeld, RefToNoteblocks[3], ref blueTween, new Color(7f / 255f, 101f / 255f, 234f / 255f, 1f), defaultBlueColor, originalScaleBlue);
			ProcessLaneInput(3, RefToNoteblocks[3], RefToInputController.X == 1, laneHeld);

			laneHeld = RefToInputController.leftShoulder > 0;
			HandleColourAndAnimation(4, laneHeld, RefToNoteblocks[4], ref orangeTween, new Color(1f, 0.647f, 0f, 1f), defaultOrangeColor, originalScaleOrange);
			ProcessLaneInput(4, RefToNoteblocks[4], RefToInputController.leftShoulder == 1, laneHeld);
		}

		// Likewise for DNoteblocks
		/*
        if (this.gameObject.name == "DNoteblocks")
        {
            HandleColourAndAnimation(RefToInputController.DPadLeft > 0, RefToNoteblocks[0], ref dpadLeftTween, new Color(4f / 255f, 170f / 255f, 0f, 1f), defaultDPadLeftColor, originalScaleDPadLeft);
            HandleInteractions(RefToInputController.DPadLeft > 0, RefToNoteblocks[0]);

            HandleColourAndAnimation(RefToInputController.DPadUp > 0, RefToNoteblocks[1], ref dpadRightTween, new Color(201f / 255f, 20f / 255f, 20f / 255f, 1f), defaultDPadRightColor, originalScaleDPadRight);
            HandleInteractions(RefToInputController.DPadUp > 0, RefToNoteblocks[1]);

            HandleColourAndAnimation(RefToInputController.DPadDown > 0, RefToNoteblocks[2], ref dpadUpTween, new Color(245f / 255f, 185f / 255f, 13f / 255f, 1f), defaultDPadUpColor, originalScaleDPadUp);
            HandleInteractions(RefToInputController.DPadDown > 0, RefToNoteblocks[2]);

            HandleColourAndAnimation(RefToInputController.DPadRight > 0, RefToNoteblocks[3], ref dpadDownTween, new Color(7f / 255f, 101f / 255f, 234f / 255f, 1f), defaultDPadDownColor, originalScaleDPadDown);
            HandleInteractions(RefToInputController.DPadRight > 0, RefToNoteblocks[3]);
        }
        */
	}

	// Handles the visual effects and scaling for button presses
	void HandleColourAndAnimation(int laneIndex, bool isActive, GameObject noteBlock, ref Tween currentTween, Color targetColor, Color defaultColor, Vector3 originalScale)
	{
		SpriteRenderer sr = noteBlock.GetComponent<SpriteRenderer>();

		// Only (re)create tweens on state changes to avoid jitter
		if (isActive && !laneAnimActive[laneIndex])
		{
			laneAnimActive[laneIndex] = true;
			currentTween?.Kill(false);
			currentTween = DOTween.Sequence()
				.SetTarget(noteBlock)
				.SetLink(noteBlock, LinkBehaviour.KillOnDestroy)
				.SetUpdate(true)
				// Start scale pop immediately, color join runs concurrently
				.Append(noteBlock.transform.DOScale(originalScale * pressPopScale, pressPopDuration).SetEase(Ease.OutBack))
				.Join(sr.DOColor(targetColor, 0.15f).SetEase(Ease.Linear))
				.Append(noteBlock.transform.DOScale(originalScale * settleScale, settleDuration).SetEase(Ease.OutQuad))
				.Append(noteBlock.transform.DOScale(originalScale, returnDuration).SetEase(Ease.OutQuad));
		}
		else if (!isActive && laneAnimActive[laneIndex])
		{
			laneAnimActive[laneIndex] = false;
			currentTween?.Kill(false);
			currentTween = DOTween.Sequence()
				.SetTarget(noteBlock)
				.SetLink(noteBlock, LinkBehaviour.KillOnDestroy)
				.SetUpdate(true)
				.Append(sr.DOColor(defaultColor, 0.15f).SetEase(Ease.Linear))
				.Join(noteBlock.transform.DOScale(originalScale, 0.1f));
		}
	}

	void ProcessLaneInput(int laneIndex, GameObject noteBlock, bool pressedDown, bool isHeld)
	{
		bool isHighway = ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.Highway;

		if (pressedDown)
		{
			if (isHighway && noteBlock)
			{
				TriggerLaneGlow(noteBlock);
			}
			EvaluateLaneHit(laneIndex, noteBlock);
		}
		else if (isHighway && !isHeld && noteBlock)
		{
			ResetLaneGlow(noteBlock);
		}
	}

	void EvaluateLaneHit(int laneIndex, GameObject noteBlock)
	{
		if (!noteBlock)
		{
			return;
		}

		if (laneIndex < 0 || laneIndex >= activeNotesByLane.Length)
		{
			return;
		}

		string inputColor = ResolveInputColor(noteBlock.name);
		float targetX = noteBlock.transform.position.x;
		float targetZ = noteBlock.transform.position.z;

		var laneNotes = activeNotesByLane[laneIndex];

		Transform bestMatch = null;
		NoteVisualDriver bestDriver = null;
		HitResult bestResult = HitResult.None;
		double bestDelta = double.MaxValue;
		double now = ResolveSongTime(out bool clockValid);
		double missWindow = clockValid ? JudgementService.Windows.miss : double.MaxValue;

		if (debugHitDetection)
		{
			Debug.Log($"[NoteBlockScript] Lane {laneIndex} press | notesInLane={laneNotes.Count} | now={now:F3} | clockValid={clockValid} | missWindow={(clockValid ? JudgementService.Windows.miss : -1):F3}");
		}

		for (int i = laneNotes.Count - 1; i >= 0; i--)
		{
			Transform note = laneNotes[i];
			if (!note)
			{
				laneNotes.RemoveAt(i);
				continue;
			}

			var drv = note.GetComponent<NoteVisualDriver>();
			if (!drv)
			{
				continue;
			}

			double expected = drv.expectedHitTime;
			double delta = Math.Abs(now - expected);
			if (delta > missWindow)
			{
				continue;
			}

			if (delta < bestDelta)
			{
				bestDelta = delta;
				bestMatch = note;
				bestDriver = drv;
				bestResult = JudgementService.Judge(expected, now);
			}
		}

		// If audio isn't running (tutorial suppression, paused, etc.), still allow consuming a note that's inside the lane trigger.
		if (!clockValid && bestMatch == null && laneNotes.Count > 0)
		{
			float bestDistance = float.MaxValue;
			Vector3 targetPos = noteBlock.transform.position;
			for (int i = laneNotes.Count - 1; i >= 0; i--)
			{
				Transform note = laneNotes[i];
				if (!note)
				{
					continue;
				}

				float distance = Vector3.SqrMagnitude(note.position - targetPos);
				if (distance < bestDistance)
				{
					bestDistance = distance;
					bestMatch = note;
				}
			}

			if (bestMatch != null)
			{
				bestDriver = bestMatch.GetComponent<NoteVisualDriver>();
				bestResult = bestDriver != null ? JudgementService.Judge(bestDriver.expectedHitTime, now) : HitResult.Miss;
				bestDelta = bestDriver != null ? Math.Abs(now - bestDriver.expectedHitTime) : double.MaxValue;
			}
		}

		if (debugHitDetection)
		{
			string noteName = bestMatch != null ? bestMatch.name : "null";
			string expectedStr = bestDriver != null ? bestDriver.expectedHitTime.ToString("F3") : "n/a";
			string deltaStr = bestDriver != null ? bestDelta.ToString("F3") : "n/a";
			Debug.Log($"[NoteBlockScript] Lane {laneIndex} result | match={noteName} | expected={expectedStr} | delta={deltaStr} | hitResult={bestResult}");
		}

		if (ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.WispPerimeter && bestMatch != null && bestDriver != null)
		{
			WispImpactDirector.ReportJudgement(bestDriver.expectedHitTime, bestResult);
		}

		string hitType = "Miss";
		if (bestMatch != null)
		{
			switch (bestResult)
			{
				case HitResult.Perfect:
					hitType = "Perfect";
					break;
				case HitResult.Good:
					hitType = "Good";
					break;
				default:
					hitType = "Miss";
					break;
			}
		}

			HandleLaneAnimations(bestMatch, hitType, laneIndex, bestDriver, noteBlock, inputColor, targetX, targetZ);
		}

	private double ResolveSongTime(out bool clockValid)
	{
		clockValid = false;

		if (AudioManager.Instance != null)
		{
			clockValid = AudioManager.Instance.HasSongStarted;
			return AudioManager.Instance.GetAdjustedSongTime();
		}

		// Fallback for scenes that use ChartSystem's AudioSource without AudioManager.
		if (chartLoader != null && chartLoader.Music != null)
		{
			clockValid = chartLoader.Music.isPlaying;
			return chartLoader.Music.time;
		}

		return Time.unscaledTimeAsDouble;
	}

		string ResolveInputColor(string noteBlockName)
		{
			if (string.IsNullOrEmpty(noteBlockName))
			{
			return "Unknown";
		}
		if (noteBlockName.Contains("Green")) return "Green";
		if (noteBlockName.Contains("Red")) return "Red";
		if (noteBlockName.Contains("Yellow")) return "Yellow";
		if (noteBlockName.Contains("Blue")) return "Blue";
			if (noteBlockName.Contains("Orange")) return "Orange";
			return "Unknown";
		}

			private bool ShouldSuppressScoring(int laneIndex)
			{
				return false;
			}

		private IEnumerator BurstAndDestroy(Transform note, string inputColor, bool suppressGameplayEvents = false)
		{
			if (note == null)
			{
				yield break;
			}

		// Cache start position outside in case the note is killed mid-burst
		Vector3 worldStartPos = note.position;

		SpriteRenderer sr = note.GetComponentInChildren<SpriteRenderer>();
		if (sr != null)
		{
			DOTween.Kill(sr);
			DOTween.Kill(note);

			// worldStartPos was cached before in case the note is killed mid-burst

			Sequence burst = DOTween.Sequence()
				.SetTarget(note)
				.SetLink(note.gameObject, LinkBehaviour.KillOnDestroy)
				.SetUpdate(true)
				.Join(note.DOScale(note.localScale * 1.5f, 0.15f).SetEase(Ease.OutQuad))
				.Join(sr.DOFade(0f, 0.15f).SetEase(Ease.InQuad));

			// Wait for completion or kill to avoid hanging if something interrupts this tween
			yield return burst.WaitForKill();
		}

		// Defer destruction until end of frame
		yield return new WaitForEndOfFrame();
		{
			var dm = DiagramManager.Instance;
			if (dm != null)
			{
				string segId = dm.GetNextIncompleteSegmentIdByColor(inputColor);
				if (!string.IsNullOrEmpty(segId))
				{
					Canvas canvas = uiCanvas != null ? uiCanvas : GetFirstObjectOfType<Canvas>();
					Camera cam = GMainCamera != null ? GMainCamera : Camera.main;

					if (canvas && cam && noteColorToPrefab.TryGetValue(inputColor, out var uiPrefab) && uiPrefab)
					{
						GemFlight.FlyToWorldTarget
						(
							canvas, cam, uiPrefab,
							worldStart: (note ? note.position : worldStartPos),
							worldTarget: dm.GetSegmentWorldTip(segId),
							duration: 0.6f
						);

					}
				}
			}
		}

		// your existing scale + notify flow
		if (note)
		{
			// Preserve original scale sign to avoid flipping colliders (negative scale warnings)
			var sign = new Vector3(Mathf.Sign(note.localScale.x), Mathf.Sign(note.localScale.y), Mathf.Sign(note.localScale.z));
			var shrink = Vector3.Scale(sign, new Vector3(0.2f, 0.2f, 0.2f));
			note.DOScale(shrink, 0.1f).SetEase(Ease.InBack);

			bool handled = false;
			if (diagramManagerGameObject != null)
			{
				handled = ExecuteEvents.Execute<IHitZoneNotesGameplayMessage>(diagramManagerGameObject, null, (x, y) => x.OnNotesHitting(note, inputColor));
			}
			else if (DiagramManager.Instance != null)
			{
				handled = ExecuteEvents.Execute<IHitZoneNotesGameplayMessage>(DiagramManager.Instance.gameObject, null, (x, y) => x.OnNotesHitting(note, inputColor));
			}

			GameplayEventBus.RaiseBroadcastHit();

				// If there's no DiagramManager (e.g., Algebra scene), retire the note so it doesn't linger in the hit zone forever.
				if (!handled && note != null)
				{
					note.gameObject.SetActive(false);
				}
			}
		}

	// Removed old global perfect pulse UI; lane-dependent FX now handle this.
	int GetLaneIndex(GameObject noteBlock) => Array.IndexOf(RefToNoteblocks, noteBlock);

	bool IsLaneActive(int laneIndex)
	{
		if (RefToInputController == null)
		{
			return false;
		}

		switch (laneIndex)
		{
			case 0: return RefToInputController.A > 0;
			case 1: return RefToInputController.B > 0;
			case 2: return RefToInputController.Y > 0;
			case 3: return RefToInputController.X > 0;
			case 4: return RefToInputController.leftShoulder > 0;
			default: return false;
		}
	}

	Vector3 GetOriginalScaleForLane(int laneIndex)
	{
		// Currently using GNoteblocks originals
		switch (laneIndex)
		{
			case 0: return originalScaleGreen;
			case 1: return originalScaleRed;
			case 2: return originalScaleYellow;
			case 3: return originalScaleBlue;
			case 4: return originalScaleOrange;
			default: return Vector3.one;
		}
	}

	void PlayHitBump(int laneIndex, GameObject noteBlock)
	{
		if (!noteBlock)
		{
			return;
		}

		var tr = noteBlock.transform;
		var baseScale = GetOriginalScaleForLane(laneIndex);
		var endScale = IsLaneActive(laneIndex) ? (baseScale * settleScale) : baseScale;

		// Kill only tweens targeted to this lane object, then do a quick bump
		DOTween.Kill(noteBlock, false);
		DOTween.Sequence()
			.SetTarget(noteBlock)
			.SetLink(noteBlock, LinkBehaviour.KillOnDestroy)
			.SetUpdate(true)
			.Append(tr.DOScale(baseScale * hitBumpScale, hitBumpDuration).SetEase(Ease.OutBack))
			.Append(tr.DOScale(endScale, 0.12f).SetEase(Ease.OutQuad));
	}

	Color AccuracyToColor(string type)
	{
		switch (type)
		{
			case "Perfect": return perfectLabel;
			case "Good": return goodLabel;
			case "Miss": return missLabel;
			default: return Color.white;
		}
	}

	private static RhythmHitKind HitTypeToKind(string type)
	{
		switch (type)
		{
			case "Perfect": return RhythmHitKind.Perfect;
			case "Good": return RhythmHitKind.Good;
			case "Miss": return RhythmHitKind.Miss;
			default: return RhythmHitKind.Unknown;
		}
	}

	public void HandleLaneAnimations
	(
		Transform bestMatch, string hitType, int laneIndex, NoteVisualDriver bestDriver, GameObject noteBlock, string inputColor, float targetX, float targetZ
	)
	{
		bool isHighway = ChartSystem.CurrentVisualizationMode == ChartSystem.VisualizationMode.Highway;

		if (laneIndex < 0 || laneIndex >= activeNotesByLane.Length)
		{
			return;
		}

		var laneNotes = activeNotesByLane[laneIndex];

		if (bestMatch && laneNotes.Contains(bestMatch))
		{
			laneNotes.Remove(bestMatch);

			// lane-local UI label + ripple + lane pulse
			if (isHighway)
			{
				ShowLaneLabel(laneIndex, hitType);
				PlayLaneRipple(laneIndex, hitType);

				if (RefToHighwayGlowAnimator)        // subtle lane pulse; stronger on Perfect
				{
					RefToHighwayGlowAnimator.TriggerGlow(laneIndex, hitType == "Perfect" ? 1f : (hitType == "Good" ? 0.6f : 0.0f));
				}

				// extra, snappy lane bump on Good/Perfect (even if key is held)
				if (hitType == "Perfect" || hitType == "Good")
				{
					PlayHitBump(laneIndex, noteBlock);
				}
			}

				// starburst on the gem (Shapes prefab)
				if (bestDriver)
				{
					bestDriver.PlayHitFX(hitType);
				}

				// keep your scoring + gem flight
					bool suppressGameplayEvents = false;
				if (!suppressGameplayEvents)
					ScoreManagerScript.Instance?.RegisterNoteHit(hitType);

				StartCoroutine(BurstAndDestroy(bestMatch, inputColor, suppressGameplayEvents));
			}
			else
			{
			// Only show Miss if something was actually in-lane and near timing
			bool nearby = false;
			foreach (var note in laneNotes)
			{
				if (!note)
				{
					continue;
				}

				var drv = note.GetComponent<NoteVisualDriver>();
				if (!drv)
				{
					continue;
				}

				if (Mathf.Abs(drv.GetTimingDifference()) <= 1.0f)
				{
					nearby = true;
					break;
				}
			}

				if (isHighway && nearby)
				{
					ShowLaneLabel(laneIndex, "Miss");
					PlayLaneRipple(laneIndex, "Miss");
					if (!ShouldSuppressScoring(laneIndex))
						ScoreManagerScript.Instance?.RegisterNoteHit("Miss");
				}
			}
		}

	public void TriggerLaneGlow(GameObject noteBlock)
	{
		if (ChartSystem.CurrentVisualizationMode != ChartSystem.VisualizationMode.Highway)
		{
			return;
		}

		if (RefToHighwayGlowAnimator != null)
		{
			int blockIndex = Array.IndexOf(RefToNoteblocks, noteBlock);
			if (blockIndex >= 0 && blockIndex < lanePressedPrev.Length)
			{
				// Only trigger the glow on the rising edge of the input
				if (!lanePressedPrev[blockIndex])
				{
					RefToHighwayGlowAnimator.TriggerGlow(blockIndex);
				}
				lanePressedPrev[blockIndex] = true;
			}
		}
	}

	public void ResetLaneGlow(GameObject noteBlock)
	{
		if (ChartSystem.CurrentVisualizationMode != ChartSystem.VisualizationMode.Highway)
		{
			return;
		}

		// Reset rising-edge gate when the lane input is not active
		int blockIndex = Array.IndexOf(RefToNoteblocks, noteBlock);
		if (blockIndex >= 0 && blockIndex < lanePressedPrev.Length)
		{
			lanePressedPrev[blockIndex] = false;
		}
	}

	public void ShowLaneLabel(int laneIndex, string type)
	{
		if (ChartSystem.CurrentVisualizationMode != ChartSystem.VisualizationMode.Highway)
		{
			return;
		}

		if (laneIndex < 0 || laneIndex >= laneLabels.Length)
		{
			return;
		}
		var lbl = laneLabels[laneIndex];
		if (!lbl)
		{
			return;
		}

		// throttle: one label per beat (or 0.35s by default)
		double now = AudioManager.Instance != null ? AudioManager.Instance.GetAdjustedSongTime() : Time.unscaledTimeAsDouble;
		if (now - lastLabelDSP[laneIndex] < beatThrottleSeconds)
		{
			return;
		}
		lastLabelDSP[laneIndex] = now;

		// kill any running tween on this label (no stacking)
		if (labelTweens[laneIndex] != null) labelTweens[laneIndex].Kill(false);
		DOTween.Kill(lbl, false);
		DOTween.Kill(lbl.transform, false);

		lbl.text = type;
		lbl.color = AccuracyToColor(type);
		if (tintLabelByLane)
		{
			// subtle lane tint via vertex alpha multiply
			var c = lbl.color;
			lbl.color = new Color
			(
				Mathf.Clamp01(c.r * (0.85f + 0.15f * laneColors[laneIndex].r)),
				Mathf.Clamp01(c.g * (0.85f + 0.15f * laneColors[laneIndex].g)),
				Mathf.Clamp01(c.b * (0.85f + 0.15f * laneColors[laneIndex].b)),
				c.a
			);
		}

		// start small & transparent
		lbl.alpha = 0f;
		lbl.transform.localScale = Vector3.one * 0.88f;

		// scale-in + fade-out (400–600ms total)
		var seq = DOTween.Sequence().SetTarget(lbl).SetUpdate(true).OnKill(() =>
		{
			if (lbl)
			{
				lbl.alpha = 0f; lbl.transform.localScale = Vector3.one;
			}
		});
		seq.Append(lbl.DOFade(1f, 0.08f)).Join(lbl.transform.DOScale(1.06f, 0.12f).SetEase(Ease.OutBack)).AppendInterval(Mathf.Max(0.05f, labelLifetime - 0.24f)).Append(lbl.DOFade(0f, 0.2f).SetEase(Ease.OutCubic).OnStart(() => lbl.transform.DOScale(0.96f, 0.2f).SetEase(Ease.InQuad)));
		labelTweens[laneIndex] = seq;
	}

	public void PlayLaneRipple(int laneIndex, string type)
	{
		if (ChartSystem.CurrentVisualizationMode != ChartSystem.VisualizationMode.Highway)
		{
			return;
		}

		if (laneIndex < 0 || laneIndex >= laneRipples.Length) return;
		var ring = laneRipples[laneIndex];
		if (!ring) return;

		// stronger for Perfect, softer for Good, none for Miss
		float strength = (type == "Perfect") ? 1f : (type == "Good" ? 0.6f : 0f);
		if (strength <= 0f) return;

		// kill old, then reset
		DOTween.Kill(ring, false);
		ring.Radius = rippleMinRadius;
		var c = laneColors[laneIndex]; c.a = Mathf.Lerp(0.5f, 0.25f, 1f - strength);
		ring.Color = c;

		// expand + fade as a single sequence (robust to pauses/kills)
		var seq = DOTween.Sequence().SetTarget(ring).SetUpdate(true).OnKill(() =>
		{
			if (ring)
			{
				var cc = ring.Color; cc.a = 0f; ring.Color = cc; ring.Radius = rippleMinRadius;
			}
		});
		seq.Join(DOTween.To(() => ring.Radius, r => ring.Radius = r, rippleMaxRadius * (0.9f + 0.2f * strength), rippleTime).SetEase(Ease.OutQuad));
		seq.Join(DOTween.To(() => ring.Color, col => ring.Color = col, new Color(c.r, c.g, c.b, 0f), rippleTime).SetEase(Ease.InQuad));
	}

	void KillTweens(Transform target)
	{
		if (target != null)
		{
			DOTween.Kill(target, true); // Kill only tweens associated with this Transform
		}
	}

	private T GetFirstObjectOfType<T>() where T : UnityEngine.Object
	{
#if UNITY_2023_1_OR_NEWER
		return UnityEngine.Object.FindFirstObjectByType<T>();
#else
		return FindFirstObjectByType<T>();
#endif
	}

	private bool IsGameplayNote(Transform noteTransform)
	{
		if (noteTransform == null)
		{
			return false;
		}

		if (chartLoader == null)
		{
			return true;
		}

		return noteTransform.IsChildOf(chartLoader.transform);
	}

	private int GetLaneIndexFromTrigger(GameObject triggerObject)
	{
		if (triggerObject == null || RefToNoteblocks == null)
		{
			return -1;
		}

		int laneIndex = Array.IndexOf(RefToNoteblocks, triggerObject);
		if (laneIndex >= 0)
		{
			return laneIndex;
		}

		// Some scenes may place the trigger collider on a child object; walk upward to find the lane root.
		Transform current = triggerObject.transform.parent;
		while (current != null)
		{
			laneIndex = Array.IndexOf(RefToNoteblocks, current.gameObject);
			if (laneIndex >= 0)
			{
				return laneIndex;
			}
			current = current.parent;
		}

		return -1;
	}
}
