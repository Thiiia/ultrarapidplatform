using System.Collections.Generic;

using UnityEngine;

public partial class DragExecutionController
{
	private static float Cross2D(Vector2 a, Vector2 b)
	{
		return (a.x * b.y) - (a.y * b.x);
	}

	private static bool SegmentsIntersect(Vector2 p1, Vector2 p2, Vector2 q1, Vector2 q2)
	{
		const float epsilon = 0.0001f;
		Vector2 r = p2 - p1;
		Vector2 s = q2 - q1;
		float rxs = Cross2D(r, s);
		float qpxr = Cross2D(q1 - p1, r);

		if (Mathf.Abs(rxs) < epsilon && Mathf.Abs(qpxr) < epsilon)
		{
			float rr = Vector2.Dot(r, r);
			if (rr < epsilon)
			{
				return false;
			}

			float t0 = Vector2.Dot(q1 - p1, r) / rr;
			float t1 = Vector2.Dot(q2 - p1, r) / rr;
			if (t0 > t1)
			{
				(t0, t1) = (t1, t0);
			}

			return t0 <= (1f - epsilon) && t1 >= epsilon;
		}

		if (Mathf.Abs(rxs) < epsilon)
		{
			return false;
		}

		float t = Cross2D(q1 - p1, s) / rxs;
		float u = Cross2D(q1 - p1, r) / rxs;
		return t > epsilon && t < (1f - epsilon) && u > epsilon && u < (1f - epsilon);
	}

	private float ScoreWispPathSelfIntersections(List<Vector2> points)
	{
		if (points == null || points.Count < 4)
		{
			return 0f;
		}

		int segmentCount = points.Count - 1;
		int intersections = 0;
		for (int i = 0; i < segmentCount; i++)
		{
			Vector2 a1 = points[i];
			Vector2 a2 = points[i + 1];
			for (int j = i + 2; j < segmentCount; j++)
			{
				if (i == 0 && j == segmentCount - 1)
				{
					continue;
				}

				Vector2 b1 = points[j];
				Vector2 b2 = points[j + 1];
				if (SegmentsIntersect(a1, a2, b1, b2))
				{
					intersections++;
				}
			}
		}

		float normalized = intersections / Mathf.Max(1f, segmentCount * 0.35f);
		return Mathf.Clamp01(normalized);
	}

	private float ScoreWispPathCurvatureJerk(List<Vector2> points)
	{
		if (points == null || points.Count < 4)
		{
			return 0f;
		}

		float jerkAccum = 0f;
		int jerkSamples = 0;
		float sharpAccum = 0f;
		int sharpSamples = 0;
		float prevTurn = 0f;
		bool hasPrev = false;

		for (int i = 1; i < points.Count - 1; i++)
		{
			Vector2 d0 = points[i] - points[i - 1];
			Vector2 d1 = points[i + 1] - points[i];
			if (d0.sqrMagnitude <= 0.000001f || d1.sqrMagnitude <= 0.000001f)
			{
				continue;
			}

			float turn = Mathf.Abs(Vector2.SignedAngle(d0.normalized, d1.normalized)) / 180f;
			sharpAccum += Mathf.Max(0f, turn - 0.2f);
			sharpSamples++;
			if (hasPrev)
			{
				jerkAccum += Mathf.Abs(turn - prevTurn);
				jerkSamples++;
			}

			prevTurn = turn;
			hasPrev = true;
		}

		float jerk = jerkSamples > 0 ? (jerkAccum / jerkSamples) : 0f;
		float sharp = sharpSamples > 0 ? (sharpAccum / sharpSamples) : 0f;
		return Mathf.Clamp01((jerk * 1.6f) + (sharp * 0.9f));
	}

	private float ScoreWispPathOcclusion(List<Vector2> points)
	{
		if (!wispAvoidEquationBubbles || points == null || points.Count < 2 || wispBubbleAvoidZones.Count == 0)
		{
			return 0f;
		}

		int samples = 0;
		int insideCount = 0;
		int run = 0;
		int longestRun = 0;

		void Sample(bool inside)
		{
			samples++;
			if (inside)
			{
				insideCount++;
				run++;
				if (run > longestRun)
				{
					longestRun = run;
				}
			}
			else
			{
				run = 0;
			}
		}

		for (int i = 0; i < points.Count - 1; i++)
		{
			Vector2 a = points[i];
			Vector2 b = points[i + 1];
			Vector2 mid = (a + b) * 0.5f;
			Sample(IsPointInsideWispBubbleAvoidZone(a));
			Sample(IsPointInsideWispBubbleAvoidZone(mid));
			Sample(IsPointInsideWispBubbleAvoidZone(b));
		}

		if (samples <= 0)
		{
			return 0f;
		}

		float insideRatio = insideCount / (float)samples;
		float runRatio = longestRun / (float)samples;
		return insideRatio + (runRatio * 1.35f);
	}

	private float ScoreWispPathBubbleProximity(List<Vector2> points)
	{
		if (!wispAvoidEquationBubbles || points == null || points.Count < 2 || wispBubbleAvoidZones.Count == 0)
		{
			return 0f;
		}

		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float proximityBand = Mathf.Max(pathWidth * 1.1f, bubbleSize * 0.14f);
		float pressure = 0f;
		int samples = 0;

		float SamplePressure(Vector2 p)
		{
			float worst = 0f;
			for (int i = 0; i < wispBubbleAvoidZones.Count; i++)
			{
				(Vector2 center, float radius) zone = wispBubbleAvoidZones[i];
				float dist = Vector2.Distance(p, zone.center);
				float clearance = dist - zone.radius;
				if (clearance <= 0f)
				{
					return 1f;
				}

				if (clearance >= proximityBand)
				{
					continue;
				}

				float t = 1f - Mathf.Clamp01(clearance / proximityBand);
				worst = Mathf.Max(worst, t * t);
			}

			return worst;
		}

		for (int i = 0; i < points.Count - 1; i++)
		{
			Vector2 a = points[i];
			Vector2 b = points[i + 1];
			Vector2 mid = (a + b) * 0.5f;
			pressure += SamplePressure(a); samples++;
			pressure += SamplePressure(mid); samples++;
			pressure += SamplePressure(b); samples++;
		}

		if (samples <= 0)
		{
			return 0f;
		}

		return Mathf.Clamp01((pressure / samples) * 1.25f);
	}

	private float ScoreWispPathPlayfieldPenalty(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (!wispConstrainPathToPlayfield || points == null || points.Count < 2)
		{
			return 0f;
		}

		if (!TryGetWispPathPlayfieldSafeRect(out Rect safeRect, out float edgeBand))
		{
			return 0f;
		}

		float edgeWeight = Mathf.Clamp(wispPathPlayfieldEdgePenaltyWeight, 0f, 3f);
		float runWeight = Mathf.Clamp(wispPathPlayfieldEdgeRunPenaltyWeight, 0f, 2f);
		if (edgeWeight <= 0f && runWeight <= 0f)
		{
			return 0f;
		}

		int samples = 0;
		int nearCount = 0;
		int outsideCount = 0;
		int run = 0;
		int longestRun = 0;
		float pressure = 0f;

		void Sample(Vector2 p)
		{
			samples++;
			float distLeft = p.x - safeRect.xMin;
			float distRight = safeRect.xMax - p.x;
			float distBottom = p.y - safeRect.yMin;
			float distTop = safeRect.yMax - p.y;
			float nearest = Mathf.Min(Mathf.Min(distLeft, distRight), Mathf.Min(distBottom, distTop));

			float samplePenalty = 0f;
			bool nearOrOutside = false;
			if (nearest < 0f)
			{
				outsideCount++;
				nearOrOutside = true;
				float outsideNorm = Mathf.Clamp01((-nearest) / Mathf.Max(4f, edgeBand));
				samplePenalty += 1f + outsideNorm;
			}
			else if (nearest < edgeBand)
			{
				nearCount++;
				nearOrOutside = true;
				float t = 1f - Mathf.Clamp01(nearest / Mathf.Max(0.001f, edgeBand));
				samplePenalty += t * t;
			}

			pressure += samplePenalty;
			if (nearOrOutside)
			{
				run++;
				if (run > longestRun)
				{
					longestRun = run;
				}
			}
			else
			{
				run = 0;
			}
		}

		int last = points.Count - 1;
		for (int i = 0; i < last; i++)
		{
			Vector2 a = points[i];
			Vector2 b = points[i + 1];
			Sample(a);
			Sample((a + b) * 0.5f);
		}
		Sample(points[last]);

		if (samples <= 0)
		{
			return 0f;
		}

		float pressureMean = pressure / samples;
		float nearRatio = nearCount / (float)samples;
		float outsideRatio = outsideCount / (float)samples;
		float runRatio = longestRun / (float)samples;

		// Slightly de-prioritize penalties when endpoints themselves are near edges and the path has limited options.
		float endpointEdgeRelief = 1f;
		if (!safeRect.Contains(startPos) || !safeRect.Contains(endPos))
		{
			endpointEdgeRelief = 0.85f;
		}

		float penalty = (pressureMean + (nearRatio * 0.35f) + (outsideRatio * 0.9f)) * edgeWeight;
		penalty += runRatio * runWeight;
		return penalty * endpointEdgeRelief;
	}

	private float ScoreWispPathEndpointStemPenalty(List<Vector2> points)
	{
		if (points == null || points.Count < 4)
		{
			return 0f;
		}

		int last = points.Count - 1;
		int tangentSpan = Mathf.Clamp(Mathf.RoundToInt(points.Count * 0.12f), 2, 6);
		int startIdx = Mathf.Min(last, tangentSpan);
		int endIdx = Mathf.Max(0, last - tangentSpan);
		if (startIdx <= 0 || endIdx >= last)
		{
			return 0f;
		}

		Vector2 startTangent = points[startIdx] - points[0];
		Vector2 endTangent = points[last] - points[endIdx];
		if (startTangent.sqrMagnitude <= 0.000001f || endTangent.sqrMagnitude <= 0.000001f)
		{
			return 0f;
		}

		float startVertical = Mathf.Abs(startTangent.normalized.y);
		float endVertical = Mathf.Abs(endTangent.normalized.y);
		float threshold = 0.78f;
		float startPenalty = Mathf.InverseLerp(threshold, 1f, startVertical);
		float endPenalty = Mathf.InverseLerp(threshold, 1f, endVertical);
		return Mathf.Clamp01((startPenalty * 0.55f) + (endPenalty * 0.55f));
	}

	private float ScoreWispPathBottomDwellPenalty(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 5)
		{
			return 0f;
		}

		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float chord = Vector2.Distance(startPos, endPos);
		if (chord <= pathWidth * 2f)
		{
			return 0f;
		}

		float endpointFloor = Mathf.Min(startPos.y, endPos.y);
		float minY = float.MaxValue;
		for (int i = 0; i < points.Count; i++)
		{
			if (points[i].y < minY)
			{
				minY = points[i].y;
			}
		}

		float dip = Mathf.Max(0f, endpointFloor - minY);
		if (dip <= pathWidth * 1.1f)
		{
			return 0f;
		}

		float dwellBand = Mathf.Max(pathWidth * 0.6f, dip * 0.22f);
		int bottomSamples = 0;
		int flatBottomSamples = 0;
		int sampleCount = 0;

		for (int i = 1; i < points.Count - 1; i++)
		{
			Vector2 p = points[i];
			Vector2 d = points[i + 1] - points[i - 1];
			if (d.sqrMagnitude <= 0.000001f)
			{
				continue;
			}

			sampleCount++;
			bool nearBottom = (p.y - minY) <= dwellBand;
			if (!nearBottom)
			{
				continue;
			}

			bottomSamples++;
			float horizontalness = Mathf.Abs(d.normalized.x);
			if (horizontalness >= 0.8f)
			{
				flatBottomSamples++;
			}
		}

		if (sampleCount <= 0)
		{
			return 0f;
		}

		float dipPenalty = Mathf.Clamp01(dip / Mathf.Max(pathWidth * 2.4f, chord * 0.28f));
		float dwellPenalty = bottomSamples / (float)sampleCount;
		float flatBottomPenalty = flatBottomSamples / (float)sampleCount;
		return Mathf.Clamp01((dipPenalty * 0.5f) + (dwellPenalty * 0.75f) + (flatBottomPenalty * 0.65f));
	}

	private float ScoreWispPathTopDwellPenalty(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 5 || !TryGetWispReferenceCeilingY(out float ceilingY))
		{
			return 0f;
		}

		float previewDeltaY = GetEquationRepeatPreviewDeltaForCurrentStep().y;
		if (!Mathf.Approximately(previewDeltaY, 0f))
		{
			startPos.y += previewDeltaY;
			endPos.y += previewDeltaY;
		}

		float endpointTop = Mathf.Max(startPos.y, endPos.y);
		float headroom = ceilingY - endpointTop;
		if (headroom <= 0.001f)
		{
			return 1f;
		}

		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float maxY = float.NegativeInfinity;
		for (int i = 1; i < points.Count - 1; i++)
		{
			float sampleY = points[i].y + previewDeltaY;
			if (sampleY > maxY)
			{
				maxY = sampleY;
			}
		}

		float rise = Mathf.Max(0f, maxY - endpointTop);
		if (rise <= pathWidth * 0.75f)
		{
			return 0f;
		}

		float ceilingGap = Mathf.Max(0f, ceilingY - maxY);
		float topBand = Mathf.Max(pathWidth * 0.85f, headroom * 0.18f);
		if (ceilingGap > topBand)
		{
			return 0f;
		}

		int topSamples = 0;
		int flatTopSamples = 0;
		float shoulderSpike = 0f;
		int sampleCount = 0;

		for (int i = 1; i < points.Count - 1; i++)
		{
			Vector2 prev = points[i - 1];
			Vector2 curr = points[i];
			Vector2 next = points[i + 1];
			Vector2 tangent = next - prev;
			if (tangent.sqrMagnitude <= 0.000001f)
			{
				continue;
			}

			sampleCount++;
			float sampleY = curr.y + previewDeltaY;
			bool nearCeiling = (ceilingY - sampleY) <= topBand;
			if (!nearCeiling)
			{
				continue;
			}

			topSamples++;
			float horizontalness = Mathf.Abs(tangent.normalized.x);
			if (horizontalness >= 0.82f)
			{
				flatTopSamples++;
			}

			Vector2 a = curr - prev;
			Vector2 b = next - curr;
			if (a.sqrMagnitude > 0.000001f && b.sqrMagnitude > 0.000001f)
			{
				float turn01 = Mathf.Abs(Vector2.SignedAngle(a.normalized, b.normalized)) / 180f;
				shoulderSpike += Mathf.Max(0f, turn01 - 0.12f) * 1.65f;
			}
		}

		if (sampleCount <= 0 || topSamples <= 0)
		{
			return 0f;
		}

		float squeezePenalty = 1f - Mathf.Clamp01(ceilingGap / Mathf.Max(0.0001f, topBand));
		float dwellPenalty = topSamples / (float)sampleCount;
		float flatTopPenalty = flatTopSamples / (float)sampleCount;
		float shoulderPenalty = Mathf.Clamp01(shoulderSpike / topSamples);
		return Mathf.Clamp01((squeezePenalty * 0.45f) + (dwellPenalty * 0.8f) + (flatTopPenalty * 0.9f) + (shoulderPenalty * 0.65f));
	}

	private float ScoreWispPathExcessDipPenalty(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 3)
		{
			return 0f;
		}

		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float chord = Vector2.Distance(startPos, endPos);
		if (chord <= pathWidth * 1.5f)
		{
			return 0f;
		}

		float endpointFloor = Mathf.Min(startPos.y, endPos.y);
		float minY = float.MaxValue;
		int minIndex = 0;
		for (int i = 0; i < points.Count; i++)
		{
			if (points[i].y < minY)
			{
				minY = points[i].y;
				minIndex = i;
			}
		}

		float dip = Mathf.Max(0f, endpointFloor - minY);
		if (dip <= pathWidth * 1.1f)
		{
			return 0f;
		}

		float dipThreshold = Mathf.Max(pathWidth * 2.2f, chord * 0.18f);
		float dipHard = Mathf.Max(dipThreshold + (pathWidth * 2f), chord * 0.34f);
		float dip01 = Mathf.InverseLerp(dipThreshold, dipHard, dip);

		// Penalize "single valley" bottoms (big V/U apex concentrated in one region).
		float valleyBand = Mathf.Max(pathWidth * 0.9f, dip * 0.18f);
		int valleySamples = 0;
		for (int i = 0; i < points.Count; i++)
		{
			if ((points[i].y - minY) <= valleyBand)
			{
				valleySamples++;
			}
		}

		float valleyRatio = points.Count > 0 ? valleySamples / (float)points.Count : 0f;
		float narrowValley01 = dip01 * (1f - Mathf.Clamp01(valleyRatio / 0.26f));

		// Midpoint bias: very deep minima near center create the "big pendulum U" look.
		float centerBias = points.Count <= 1 ? 0f : 1f - Mathf.Abs(((minIndex / (float)(points.Count - 1)) * 2f) - 1f);
		float centerValley01 = dip01 * Mathf.Clamp01(centerBias);

		return Mathf.Clamp01((dip01 * 0.8f) + (narrowValley01 * 0.45f) + (centerValley01 * 0.35f));
	}

	private float ScoreWispPathCornerSpikePenalty(List<Vector2> points)
	{
		if (points == null || points.Count < 4)
		{
			return 0f;
		}

		float maxTurn = 0f;
		float spikeAccum = 0f;
		int samples = 0;
		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float shortSpanRef = Mathf.Max(pathWidth * 5f, 24f);

		for (int i = 1; i < points.Count - 1; i++)
		{
			Vector2 a = points[i] - points[i - 1];
			Vector2 b = points[i + 1] - points[i];
			float lenA = a.magnitude;
			float lenB = b.magnitude;
			if (lenA <= 0.0001f || lenB <= 0.0001f)
			{
				continue;
			}

			float turn = Mathf.Abs(Vector2.SignedAngle(a / lenA, b / lenB)) / 180f;
			maxTurn = Mathf.Max(maxTurn, turn);

			float localSpan = lenA + lenB;
			float shortness = 1f - Mathf.Clamp01(localSpan / shortSpanRef);
			float spike = Mathf.Max(0f, turn - 0.14f) * (0.75f + (shortness * 0.85f));
			spikeAccum += spike;
			samples++;
		}

		if (samples <= 0)
		{
			return 0f;
		}

		float meanSpike = spikeAccum / samples;
		float maxTurnPenalty = Mathf.Max(0f, maxTurn - 0.22f) * 1.15f;
		return Mathf.Clamp01((meanSpike * 1.35f) + maxTurnPenalty);
	}

	private float ScoreWispPathWobblePenalty(List<Vector2> points)
	{
		if (points == null || points.Count < 6)
		{
			return 0f;
		}

		float signFlipPressure = 0f;
		int signFlips = 0;
		float previousSignedTurn = 0f;
		bool hasPrev = false;

		for (int i = 1; i < points.Count - 1; i++)
		{
			Vector2 a = points[i] - points[i - 1];
			Vector2 b = points[i + 1] - points[i];
			if (a.sqrMagnitude <= 0.000001f || b.sqrMagnitude <= 0.000001f)
			{
				continue;
			}

			float signedTurn = Vector2.SignedAngle(a.normalized, b.normalized) / 180f;
			float absTurn = Mathf.Abs(signedTurn);
			if (absTurn < 0.035f)
			{
				continue;
			}

			if (hasPrev)
			{
				bool signChanged = (signedTurn > 0f && previousSignedTurn < 0f) || (signedTurn < 0f && previousSignedTurn > 0f);
				if (signChanged)
				{
					signFlips++;
					// Small alternating turns read as "wobble/hand-drawn" more than big intentional S-curves.
					float pairStrength = Mathf.Min(absTurn, Mathf.Abs(previousSignedTurn));
					signFlipPressure += 1f - Mathf.Clamp01(pairStrength / 0.18f);
				}
			}

			previousSignedTurn = signedTurn;
			hasPrev = true;
		}

		if (signFlips <= 0)
		{
			return 0f;
		}

		float flipCountPenalty = Mathf.Clamp01((signFlips - 1) / 3f); // allow one intentional inflection
		float flipPressurePenalty = Mathf.Clamp01(signFlipPressure / Mathf.Max(1f, signFlips));
		return Mathf.Clamp01((flipCountPenalty * 0.65f) + (flipPressurePenalty * 0.6f));
	}

	private float ScoreWispPathReadability(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		float score = ScoreWispPathOcclusion(points);
		score += ScoreWispPathBubbleProximity(points) * 0.9f;
		score += ScoreWispPathCurvatureJerk(points) * Mathf.Clamp(wispPathCurvaturePenaltyWeight, 0f, 2f);
		score += ScoreWispPathCornerSpikePenalty(points) * 1.1f;
		score += ScoreWispPathWobblePenalty(points) * 0.85f;
		score += ScoreWispPathSelfIntersections(points) * Mathf.Clamp(wispPathSelfIntersectionPenaltyWeight, 0f, 3f);
		score += ScoreWispPathEndpointStemPenalty(points) * Mathf.Clamp(wispPathEndpointStemPenaltyWeight, 0f, 2f);
		score += ScoreWispPathBottomDwellPenalty(points, startPos, endPos) * Mathf.Clamp(wispPathBottomDwellPenaltyWeight, 0f, 2f);
		score += ScoreWispPathTopDwellPenalty(points, startPos, endPos) * 1.05f;
		score += ScoreWispPathExcessDipPenalty(points, startPos, endPos) * 0.95f;
		score += ScoreWispPathPlayfieldPenalty(points, startPos, endPos);
		return score;
	}

	private float GetEffectiveWispTopBiasWeight()
	{
		float weight = Mathf.Clamp(wispPreferUnderCloseWeight, 0f, 2f);
		if (weight <= 0f || !moveEquationBetweenRepeats || !equationFollowPathHemisphere)
		{
			return weight;
		}

		float verticalBudget =
			Mathf.Max(0f, equationRepeatMoveRadiusY) +
			Mathf.Max(0f, equationPathBottomInset) +
			Mathf.Max(0f, -equationRepeatMotionBaselineOffset.y);
		float relief01 = Mathf.Clamp01(verticalBudget / Mathf.Max(1f, bubbleSize * 2f));
		return Mathf.Lerp(weight, weight * 0.35f, relief01);
	}

	private float GetWispTopSqueeze01(Vector2 startPos, Vector2 endPos)
	{
		if (!wispPreferUnderWhenReferenceIsClose || !TryGetWispReferenceCeilingY(out float ceilingY))
		{
			return 0f;
		}

		float previewDeltaY = GetEquationRepeatPreviewDeltaForCurrentStep().y;
		if (!Mathf.Approximately(previewDeltaY, 0f))
		{
			startPos.y += previewDeltaY;
			endPos.y += previewDeltaY;
		}

		float endpointTop = Mathf.Max(startPos.y, endPos.y);
		float headroom = ceilingY - endpointTop;
		float width = Mathf.Max(2f, GetWispPathWidth());
		float arc = Mathf.Max(width * 2f, GetWispArcHeight(startPos, endPos));
		float desired = arc * Mathf.Clamp(wispReferenceCloseHeadroomRatio, 0.4f, 3f);
		float roomy = desired * 2.8f;
		if (roomy <= desired)
		{
			roomy = desired + 1f;
		}

		return 1f - Mathf.InverseLerp(desired, roomy, headroom);
	}

	private float ScoreWispUpperClearancePenalty(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 3 || !TryGetWispReferenceCeilingY(out float ceilingY))
		{
			return 0f;
		}

		float previewDeltaY = GetEquationRepeatPreviewDeltaForCurrentStep().y;
		if (!Mathf.Approximately(previewDeltaY, 0f))
		{
			startPos.y += previewDeltaY;
			endPos.y += previewDeltaY;
		}

		float endpointTop = Mathf.Max(startPos.y, endPos.y);
		float headroom = ceilingY - endpointTop;
		if (headroom <= 0.001f)
		{
			return 1f;
		}

		float mean = 0f;
		float peak = 0f;
		int samples = 0;
		int last = points.Count - 1;
		for (int i = 1; i < last; i++)
		{
			float sampleY = points[i].y + previewDeltaY;
			float aboveEndpoints = Mathf.Max(0f, sampleY - endpointTop);
			float ratio = Mathf.Clamp01(aboveEndpoints / headroom);
			mean += ratio;
			peak = Mathf.Max(peak, ratio);
			samples++;
		}

		if (samples <= 0)
		{
			return 0f;
		}

		mean /= samples;
		return Mathf.Clamp01((mean * 0.7f) + (peak * 0.85f));
	}

	private WispPathStyle ResolveOcclusionAwareWispStyle(Vector2 startPos, Vector2 endPos, WispPathStyle preferred)
	{
		// Placeholder bucket sprites are canonical U-shapes. While iterating on placeholders,
		// skip full procedural silhouette generation and choose only the U orientation.
		if (ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			bool bendDown = ResolveCanonicalTemplateBendDown(preferred, startPos, endPos);
			return bendDown ? WispPathStyle.ArcDown : WispPathStyle.ArcUp;
		}

		if (wispAvoidEquationBubbles)
		{
			RefreshWispBubbleAvoidZonesThrottled(GetWispPathWidth(), force: true);
		}

		// Visual language pass: keep Auto outcomes in smooth C/S families.
		if (preferred == WispPathStyle.Jitter)
		{
			preferred = WispPathStyle.SCurve;
		}

		float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
		float topBiasWeight = GetEffectiveWispTopBiasWeight();
		WispPathStyle best = preferred;
		float bestScore = float.MaxValue;

		void Evaluate(WispPathStyle candidate, bool biasPreferred)
		{
			BuildWispPathPoints(startPos, endPos, candidate, wispPathProbePoints, allowReadabilityRefinement: false);
			float score = ScoreWispPathReadability(wispPathProbePoints, startPos, endPos);
			if (topSqueeze01 > 0.001f && topBiasWeight > 0f)
			{
				float upperPenalty = ScoreWispUpperClearancePenalty(wispPathProbePoints, startPos, endPos);
				score += upperPenalty * topSqueeze01 * topBiasWeight;
				if (candidate == WispPathStyle.ArcUp)
				{
					score += 0.08f * topSqueeze01 * topBiasWeight;
				}
				else if (candidate == WispPathStyle.ArcDown)
				{
					score -= 0.05f * topSqueeze01 * topBiasWeight;
				}
			}

			score += GetWispPathCadencePenalty(startPos, endPos, candidate);

			if (biasPreferred)
			{
				score -= 0.01f;
			}

			if (candidate == WispPathStyle.Jitter)
			{
				score += 0.35f;
			}
			else if (candidate == WispPathStyle.MWave)
			{
				score += 0.035f;
			}
			else if (candidate == WispPathStyle.WWave)
			{
				score += 0.055f;
			}

			if (score < bestScore)
			{
				bestScore = score;
				best = candidate;
			}
		}

		Evaluate(preferred, biasPreferred: true);
		Evaluate(WispPathStyle.ArcUp, biasPreferred: false);
		Evaluate(WispPathStyle.ArcDown, biasPreferred: false);
		Evaluate(WispPathStyle.ArcLeft, biasPreferred: false);
		Evaluate(WispPathStyle.ArcRight, biasPreferred: false);
		Evaluate(WispPathStyle.SCurve, biasPreferred: false);
		Evaluate(WispPathStyle.MWave, biasPreferred: false);
		Evaluate(WispPathStyle.WWave, biasPreferred: false);

		return best;
	}

}
