using UnityEngine;

public partial class DragExecutionController
{
	private enum WispOverlapZone
	{
		None,
		Early,
		Good,
		Perfect,
		Late
	}

	private WispOverlapZone lastOverlapZone = WispOverlapZone.None;
	private float lastOverlapProximity = -1f;
	private float lastOverlapOutlineProgress = -1f;
	private bool overlapFeedbackActive;

	private void UpdateWispPathHeatDuringDrag(Vector2 dragPosition)
	{
		if (!wispActive)
		{
			return;
		}

		if (TryGetWispOverlapInfo(dragPosition, out _, out float overlapScore, out _))
		{
			TrackJourneyPathGuidanceSample(overlapScore);
			UpdateWispPathHeatFromAccuracy(overlapScore);
			return;
		}

		UpdateWispPathHeatFromAccuracy(0.28f);
	}

	private void UpdateWispOverlapFeedback(EquationBubbleElement element, Vector2 position)
	{
		if (!enableWispOverlapFeedback || element == null)
		{
			return;
		}

		if (!TryGetWispOverlapInfo(position, out float proximity, out _, out WispOverlapZone zone))
		{
			if (overlapFeedbackActive)
			{
				element.ClearDragFeedback();
				overlapFeedbackActive = false;
				lastOverlapZone = WispOverlapZone.None;
				lastOverlapProximity = -1f;
				lastOverlapOutlineProgress = -1f;
			}

			ResetWispMovingTargetInteractionPulseState();
			return;
		}

		TryPulseWispMovingTargetInteraction(zone, proximity);
		float outlineProgress = Mathf.Clamp01(wispProgress);

		if (overlapFeedbackActive &&
			zone == lastOverlapZone &&
			Mathf.Abs(proximity - lastOverlapProximity) < wispOverlapProximityEpsilon &&
			Mathf.Abs(outlineProgress - lastOverlapOutlineProgress) < 0.012f)
		{
			return;
		}

		Color zoneColor = zone switch
		{
			WispOverlapZone.Perfect => wispOverlapPerfectColor,
			WispOverlapZone.Good => wispOverlapGoodColor,
			WispOverlapZone.Early => wispOverlapEarlyColor,
			WispOverlapZone.Late => wispOverlapLateColor,
			_ => wispOverlapGoodColor
		};
		Color outlineColor = ResolveWispAccuracyOutlineColor(zone, proximity, zoneColor);

		Color background = zoneColor;
		background.a = Mathf.Lerp(0f, wispOverlapMaxAlpha, proximity);
		element.SetDragFeedback(background, outlineColor, 0.05f);
		overlapFeedbackActive = true;
		lastOverlapZone = zone;
		lastOverlapProximity = proximity;
		lastOverlapOutlineProgress = outlineProgress;
	}

	private Color ResolveWispAccuracyOutlineColor(WispOverlapZone zone, float proximity, Color zoneColor)
	{
		float zoneAccuracy = zone switch
		{
			WispOverlapZone.Perfect => 1f,
			WispOverlapZone.Good => 0.8f,
			WispOverlapZone.Early => 0.24f,
			WispOverlapZone.Late => 0.24f,
			_ => 0f
		};

		float overlapAccuracy = Mathf.Clamp01(proximity * zoneAccuracy);
		float progress01 = Mathf.Clamp01(wispProgress);
		float endWeight = Mathf.SmoothStep(0.15f, 1f, progress01);
		float gradientStrength = Mathf.Lerp(0.35f, 1f, endWeight);
		float blend = Mathf.Clamp01(overlapAccuracy * gradientStrength);

		Color gradientColor = EvaluateWispBasePathColor(progress01);
		Color outline = Color.Lerp(zoneColor, gradientColor, blend);
		outline.a = Mathf.Clamp01(Mathf.Max(outline.a, bubbleDraggingOutline.a));
		return outline;
	}

	private bool TryGetWispOverlapInfo(Vector2 position, out float proximity, out float overlapScore, out WispOverlapZone zone)
	{
		proximity = 0f;
		overlapScore = 0f;
		zone = WispOverlapZone.None;

		if (!wispActive || wispRect == null)
		{
			return false;
		}

		float indicatorSize = GetWispIndicatorSize();
		float radius = Mathf.Max(1f, indicatorSize * 0.5f * GetAdaptiveWispOverlapDistanceMultiplier());
		float distance = Vector2.Distance(position, wispRect.anchoredPosition);
		proximity = 1f - Mathf.Clamp01(distance / radius);
		if (proximity <= 0f)
		{
			return false;
		}

		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		float zoneWeight;
		if (wispProgress >= perfectStart && wispProgress <= greenEnd)
		{
			zone = WispOverlapZone.Perfect;
			zoneWeight = wispOverlapPerfectWeight;
		}
		else if (wispProgress >= greenStart && wispProgress <= greenEnd)
		{
			zone = WispOverlapZone.Good;
			zoneWeight = wispOverlapGoodWeight;
		}
		else if (wispProgress < greenStart)
		{
			zone = WispOverlapZone.Early;
			zoneWeight = wispOverlapEarlyWeight;
		}
		else
		{
			zone = WispOverlapZone.Late;
			zoneWeight = wispOverlapLateWeight;
		}

		float proximityScore = Mathf.Lerp(wispOverlapScoreFloor, 1f, proximity);
		overlapScore = Mathf.Clamp01(proximityScore * zoneWeight);
		return true;
	}

	private HitResult ApplyOverlapToHitResult(HitResult baseResult, float overlapScore)
	{
		if (!wispOverlapAffectsJudgement)
		{
			return baseResult;
		}

		if (baseResult == HitResult.None || baseResult == HitResult.Miss)
		{
			return baseResult;
		}

		float goodMin = GetAdaptiveWispOverlapGoodMin();
		if (overlapScore < goodMin)
		{
			return HitResult.Miss;
		}

		float perfectMin = GetAdaptiveWispOverlapPerfectMin(goodMin);
		if (baseResult == HitResult.Perfect && overlapScore < perfectMin)
		{
			return HitResult.Good;
		}

		return baseResult;
	}

	private static void ApplyHitResultFeedback(HitResult result, ref string label, ref Color color)
	{
		switch (result)
		{
			case HitResult.Perfect:
				label = "Perfect!";
				color = Color.green;
				break;
			case HitResult.Good:
				label = "Good!";
				color = new Color(0.7f, 1f, 0.3f);
				break;
			case HitResult.Miss:
				label = "Miss!";
				color = new Color(1f, 0.35f, 0.35f);
				break;
		}
	}
}
