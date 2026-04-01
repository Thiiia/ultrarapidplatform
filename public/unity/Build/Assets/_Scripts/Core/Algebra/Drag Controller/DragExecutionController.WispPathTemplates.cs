using System.Collections.Generic;

using UnityEngine;

public partial class DragExecutionController
{
	private enum WispPathVisualFamily
	{
		Unknown = 0,
		Arc = 1,
		SemiCircle = 2,
		HalfRectangle = 3,
		SCurve = 4,
		Jitter = 5,
		MWave = 6,
		WWave = 7,
	}

	private WispPathVisualFamily lastWispPathVisualFamily = WispPathVisualFamily.Unknown;
	private int wispPathVisualFamilyRepeatCount;
	private readonly List<Vector2> wispCanonicalAnchorGuideScratch = new List<Vector2>(24);

	private static void AddWispPointNoDuplicate(List<Vector2> destination, Vector2 point, float epsilon = 0.01f)
	{
		if (destination == null)
		{
			return;
		}

		if (destination.Count == 0)
		{
			destination.Add(point);
			return;
		}

		if ((destination[destination.Count - 1] - point).sqrMagnitude > (epsilon * epsilon))
		{
			destination.Add(point);
		}
	}

	private static void AppendWispLineSamples(List<Vector2> destination, Vector2 from, Vector2 to, int segments, bool includeFrom)
	{
		if (destination == null)
		{
			return;
		}

		int seg = Mathf.Max(1, segments);
		int startIndex = includeFrom ? 0 : 1;
		for (int i = startIndex; i <= seg; i++)
		{
			float t = i / (float)seg;
			AddWispPointNoDuplicate(destination, Vector2.Lerp(from, to, t));
		}
	}

	private static void AppendWispArcSamples(List<Vector2> destination, Vector2 center, float radius, float startAngleDeg, float endAngleDeg, int segments, bool includeStart)
	{
		if (destination == null)
		{
			return;
		}

		int seg = Mathf.Max(2, segments);
		int startIndex = includeStart ? 0 : 1;
		for (int i = startIndex; i <= seg; i++)
		{
			float t = i / (float)seg;
			float angle = Mathf.Lerp(startAngleDeg, endAngleDeg, t) * Mathf.Deg2Rad;
			Vector2 point = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
			AddWispPointNoDuplicate(destination, point);
		}
	}

	private static void AppendWispQuadraticSamples(List<Vector2> destination, Vector2 p0, Vector2 p1, Vector2 p2, int segments, bool includeStart)
	{
		if (destination == null)
		{
			return;
		}

		int seg = Mathf.Max(2, segments);
		int startIndex = includeStart ? 0 : 1;
		for (int i = startIndex; i <= seg; i++)
		{
			float t = i / (float)seg;
			float u = 1f - t;
			Vector2 point = (u * u * p0) + (2f * u * t * p1) + (t * t * p2);
			AddWispPointNoDuplicate(destination, point);
		}
	}

	private bool ResolveCanonicalTemplateBendDown(WispPathStyle style, Vector2 startPos, Vector2 endPos)
	{
		if (wispUniformPreferLowerHemisphere)
		{
			return true;
		}

		if (wispCanonicalForceLowerWhenTopConstrained && ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
			float threshold = Mathf.Clamp01(wispCanonicalTopConstraintForceLowerThreshold);
			if (topSqueeze01 >= threshold)
			{
				return true;
			}
		}

		// In placeholder mode we collapse to a canonical U silhouette. During repeated drags within
		// the same step, explicitly alternate the hemisphere so the player gets visible variety
		// instead of the same U orientation every repeat.
		int requiredDrags = GetCurrentRequiredDragsForStep();
		if (wispCanonicalHemisphereAlternation &&
		    ShouldForceCanonicalPathForPlaceholderArcSprites() &&
		    requiredDrags > 1 &&
		    currentStepDragCount > 0 &&
		    currentStepDragCount < requiredDrags)
		{
			return (currentStepDragCount % 2) == 0;
		}

		return style switch
		{
			WispPathStyle.ArcUp => false,
			WispPathStyle.ArcDown => true,
			_ => endPos.y <= startPos.y,
		};
	}

	private Vector2 ResolveCanonicalNormal(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		Vector2 chord = endPos - startPos;
		float dist = chord.magnitude;
		if (dist <= 0.0001f)
		{
			return Vector2.down;
		}

		Vector2 dir = chord / dist;
		Vector2 perpA = new Vector2(-dir.y, dir.x);
		Vector2 perpB = -perpA;
		bool bendDown = ResolveCanonicalTemplateBendDown(style, startPos, endPos);

		if (Mathf.Abs(perpA.y - perpB.y) <= 0.0001f)
		{
			if (style == WispPathStyle.ArcLeft) return perpA;
			if (style == WispPathStyle.ArcRight) return perpB;
			return bendDown ? Vector2.down : Vector2.up;
		}

		if (bendDown)
		{
			return perpA.y <= perpB.y ? perpA : perpB;
		}

		return perpA.y >= perpB.y ? perpA : perpB;
	}

	private bool BuildSemiCircleTemplatePathPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, List<Vector2> destination)
	{
		if (destination == null)
		{
			return false;
		}

		destination.Clear();
		Vector2 chord = endPos - startPos;
		float dist = chord.magnitude;
		if (dist <= 0.001f)
		{
			AddWispPointNoDuplicate(destination, startPos);
			AddWispPointNoDuplicate(destination, endPos);
			return destination.Count >= 2;
		}

		Vector2 normal = ResolveCanonicalNormal(startPos, endPos, style);
		Vector2 midpoint = (startPos + endPos) * 0.5f;
		float sagittaRatio = Mathf.Clamp(wispUniformSemiCircleSagittaRatio, 0.45f, 1f);
		if (wispUniformTemplateMode == WispUniformTemplateMode.Auto)
		{
			float dx = Mathf.Abs(endPos.x - startPos.x);
			float dy = Mathf.Abs(endPos.y - startPos.y);
			float pathWidth = Mathf.Max(2f, GetWispPathWidth());
			bool crossesEquals = IsWispCrossingEquals(startPos, endPos);
			bool bendDown = ResolveCanonicalTemplateBendDown(style, startPos, endPos);
			float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
			float wideFlat01 = Mathf.Clamp01(dx / Mathf.Max(pathWidth * 4f, (dy * 1.2f) + (pathWidth * 2f)));
			float crowd01 = Mathf.Clamp01((wispBubbleAvoidZones.Count - 1) / 4f);
			float shallowing01 = 0f;
			if (bendDown)
			{
				shallowing01 = Mathf.Max(shallowing01, crowd01 * 0.55f);
				if (crossesEquals)
				{
					shallowing01 = Mathf.Max(shallowing01, 0.3f + (wideFlat01 * 0.45f));
				}
			}

			shallowing01 = Mathf.Max(shallowing01, topSqueeze01 * 0.35f);
			float ratioMul = Mathf.Lerp(1f, 0.72f, Mathf.Clamp01(shallowing01));
			sagittaRatio = Mathf.Clamp(sagittaRatio * ratioMul, 0.4f, 0.9f);
		}

		float sagitta = Mathf.Max(GetWispPathWidth() * 1.15f, (dist * 0.5f) * sagittaRatio);
		sagitta = Mathf.Clamp(sagitta, dist * 0.12f, dist * 0.96f);
		float radius = ((dist * dist) / (8f * sagitta)) + (sagitta * 0.5f);
		Vector2 center = midpoint + (normal * Mathf.Max(0f, radius - sagitta));

		float startDeg = Mathf.Atan2(startPos.y - center.y, startPos.x - center.x) * Mathf.Rad2Deg;
		float endDeg = Mathf.Atan2(endPos.y - center.y, endPos.x - center.x) * Mathf.Rad2Deg;
		float deltaShort = Mathf.DeltaAngle(startDeg, endDeg);
		float deltaLong = deltaShort > 0f ? deltaShort - 360f : deltaShort + 360f;
		float midShortDeg = (startDeg + (deltaShort * 0.5f)) * Mathf.Deg2Rad;
		float midLongDeg = (startDeg + (deltaLong * 0.5f)) * Mathf.Deg2Rad;
		Vector2 midShortPoint = center + new Vector2(Mathf.Cos(midShortDeg), Mathf.Sin(midShortDeg)) * radius;
		Vector2 midLongPoint = center + new Vector2(Mathf.Cos(midLongDeg), Mathf.Sin(midLongDeg)) * radius;
		float shortScore = Vector2.Dot(midShortPoint - midpoint, normal);
		float longScore = Vector2.Dot(midLongPoint - midpoint, normal);
		float chosenDelta = longScore > shortScore ? deltaLong : deltaShort;
		int arcSegments = Mathf.Clamp(GetAdaptiveWispPathSegmentCount(startPos, endPos) + 8, 12, 240);
		AppendWispArcSamples(destination, center, radius, startDeg, startDeg + chosenDelta, arcSegments, includeStart: true);
		AddWispPointNoDuplicate(destination, endPos);
		return destination.Count >= 2;
	}

	private bool BuildHalfRectangleTemplatePathPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, List<Vector2> destination)
	{
		if (destination == null)
		{
			return false;
		}

		destination.Clear();
		float dx = endPos.x - startPos.x;
		float horizontalSpan = Mathf.Abs(dx);
		if (horizontalSpan <= Mathf.Max(4f, GetWispPathWidth() * 0.8f))
		{
			return BuildSemiCircleTemplatePathPoints(startPos, endPos, style, destination);
		}

		float dirX = Mathf.Sign(dx);
		if (Mathf.Approximately(dirX, 0f))
		{
			dirX = 1f;
		}

		bool bendDown = ResolveCanonicalTemplateBendDown(style, startPos, endPos);
		float endpointEdgeY = bendDown ? Mathf.Min(startPos.y, endPos.y) : Mathf.Max(startPos.y, endPos.y);
		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float endpointDy = Mathf.Abs(endPos.y - startPos.y);
		float depth = Mathf.Max(pathWidth * 2f, GetWispArcHeight(startPos, endPos) * Mathf.Clamp(wispUniformHalfRectDepthMultiplier, 0.75f, 1.8f));
		float depthCapBySpan = Mathf.Max(pathWidth * 1.8f, horizontalSpan * 0.36f);
		float depthCapByAsymmetry = Mathf.Max(pathWidth * 1.8f, endpointDy + (horizontalSpan * 0.12f));
		depth = Mathf.Min(depth, Mathf.Min(depthCapBySpan, depthCapByAsymmetry));
		float bendY = bendDown ? endpointEdgeY - depth : endpointEdgeY + depth;
		float bendSign = bendDown ? 1f : -1f;
		float verticalSpanStart = Mathf.Abs(startPos.y - bendY);
		float verticalSpanEnd = Mathf.Abs(endPos.y - bendY);
		float cornerBase = horizontalSpan * Mathf.Clamp(wispUniformHalfRectCornerRadiusRatio, 0.08f, 0.45f);
		float minCorner = Mathf.Max(1f, pathWidth * 0.35f);
		float maxCorner = Mathf.Max(
			minCorner,
			Mathf.Min(horizontalSpan * 0.45f, Mathf.Min(verticalSpanStart * 0.9f, verticalSpanEnd * 0.9f)));
		float corner = Mathf.Clamp(cornerBase, minCorner, maxCorner);

		Vector2 v1 = new Vector2(startPos.x, bendY + (bendSign * corner));
		Vector2 h1 = new Vector2(startPos.x + (dirX * corner), bendY);
		Vector2 h2 = new Vector2(endPos.x - (dirX * corner), bendY);
		Vector2 v2 = new Vector2(endPos.x, bendY + (bendSign * corner));

		int baseSegments = Mathf.Clamp(GetAdaptiveWispPathSegmentCount(startPos, endPos), 14, 260);
		int lineSegments = Mathf.Clamp(baseSegments / 7, 2, 18);
		int arcSegments = Mathf.Clamp(baseSegments / 10, 6, 28);
		int bridgeSegments = Mathf.Clamp(baseSegments / 3, 8, 56);

		AddWispPointNoDuplicate(destination, startPos);
		AppendWispLineSamples(destination, startPos, v1, lineSegments, includeFrom: false);

		Vector2 c1 = new Vector2(startPos.x + (dirX * corner), bendY + (bendSign * corner));
		float c1Start = Mathf.Atan2(v1.y - c1.y, v1.x - c1.x) * Mathf.Rad2Deg;
		float c1End = Mathf.Atan2(h1.y - c1.y, h1.x - c1.x) * Mathf.Rad2Deg;
		float c1Delta = Mathf.DeltaAngle(c1Start, c1End);
		AppendWispArcSamples(destination, c1, corner, c1Start, c1Start + c1Delta, arcSegments, includeStart: false);

		float bridgeDip = Mathf.Max(pathWidth * 0.32f, depth * Mathf.Clamp(wispUniformHalfRectBridgeDipRatio, 0f, 0.45f));
		float bridgeDipCap = Mathf.Max(pathWidth * 0.75f, Mathf.Min(depth * 0.22f, corner * 0.8f));
		bridgeDip = Mathf.Min(bridgeDip, bridgeDipCap);
		Vector2 bridgeControl = (h1 + h2) * 0.5f;
		bridgeControl += Vector2.up * (-bendSign * bridgeDip);
		AppendWispQuadraticSamples(destination, h1, bridgeControl, h2, bridgeSegments, includeStart: false);

		Vector2 c2 = new Vector2(endPos.x - (dirX * corner), bendY + (bendSign * corner));
		float c2Start = Mathf.Atan2(h2.y - c2.y, h2.x - c2.x) * Mathf.Rad2Deg;
		float c2End = Mathf.Atan2(v2.y - c2.y, v2.x - c2.x) * Mathf.Rad2Deg;
		float c2Delta = Mathf.DeltaAngle(c2Start, c2End);
		AppendWispArcSamples(destination, c2, corner, c2Start, c2Start + c2Delta, arcSegments, includeStart: false);

		AppendWispLineSamples(destination, v2, endPos, lineSegments, includeFrom: false);
		AddWispPointNoDuplicate(destination, endPos);
		return destination.Count >= 2;
	}

	private bool BuildWaveTemplatePathPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, List<Vector2> destination)
	{
		if (destination == null || (style != WispPathStyle.MWave && style != WispPathStyle.WWave))
		{
			return false;
		}

		destination.Clear();
		Vector2 chord = endPos - startPos;
		float dist = chord.magnitude;
		if (dist <= 0.001f)
		{
			AddWispPointNoDuplicate(destination, startPos);
			AddWispPointNoDuplicate(destination, endPos);
			return destination.Count >= 2;
		}

		bool bendDown = ResolveCanonicalTemplateBendDown(style, startPos, endPos);
		Vector2 normal = ResolveCanonicalNormal(startPos, endPos, bendDown ? WispPathStyle.ArcDown : WispPathStyle.ArcUp);
		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
		float amplitude = Mathf.Max(pathWidth * 1.9f, GetWispArcHeight(startPos, endPos) * 0.58f);
		amplitude = Mathf.Min(amplitude, dist * 0.34f);
		amplitude *= Mathf.Lerp(1f, 0.74f, topSqueeze01);
		if (IsWispCrossingEquals(startPos, endPos))
		{
			amplitude *= 0.86f;
		}

		float[] fractions = { 0f, 0.14f, 0.28f, 0.5f, 0.72f, 0.86f, 1f };
		float[] offsets = style == WispPathStyle.MWave
			? new[] { 0f, 0.42f, 0.82f, -0.34f, 0.78f, 0.38f, 0f }
			: new[] { 0f, -0.28f, 0.72f, -0.58f, 0.72f, -0.28f, 0f };
		int lineSegments = Mathf.Clamp(GetAdaptiveWispPathSegmentCount(startPos, endPos) / 6, 2, 14);

		Vector2 previous = startPos;
		AddWispPointNoDuplicate(destination, previous);
		for (int i = 1; i < fractions.Length; i++)
		{
			Vector2 anchor = startPos + (chord * fractions[i]) + (normal * (amplitude * offsets[i]));
			AppendWispLineSamples(destination, previous, anchor, lineSegments, includeFrom: false);
			previous = anchor;
		}

		if (destination.Count >= 2)
		{
			destination[0] = startPos;
			destination[destination.Count - 1] = endPos;
		}

		return destination.Count >= 2;
	}

	private WispUniformTemplateMode ResolveAutoWispUniformTemplateMode(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		bool useWindowTemplateLock = lockPathPerHitZoneWindow && hasLockedWindowPathStyle;
		if (useWindowTemplateLock && TryGetPreparedResolvedWispWindowState(out WispWindowState resolvedWindowState))
		{
			// Reuse the fully resolved template decision from the active hit-window rather than
			// re-deriving it from slightly shifted endpoints.
			return resolvedWindowState.templateMode;
		}

		if (useWindowTemplateLock && hasLockedWindowTemplateMode)
		{
			// Reuse the previously resolved template for this hit-window so the path doesn't flip
			// between idle preview and drag start because of tiny endpoint shifts.
			return lockedWindowTemplateMode;
		}

		WispUniformTemplateMode ResolveWithOptionalWindowLock(WispUniformTemplateMode mode)
		{
			if (useWindowTemplateLock)
			{
				lockedWindowTemplateMode = mode;
				hasLockedWindowTemplateMode = true;
			}

			return mode;
		}

		// Preserve intentional freeform families in Auto mode.
		if (style == WispPathStyle.SCurve || style == WispPathStyle.MWave || style == WispPathStyle.WWave)
		{
			return ResolveWithOptionalWindowLock(WispUniformTemplateMode.Off);
		}

		float dx = Mathf.Abs(endPos.x - startPos.x);
		float dy = Mathf.Abs(endPos.y - startPos.y);
		bool crossesEquals = IsWispCrossingEquals(startPos, endPos);
		bool stylePrefersRect = style == WispPathStyle.ArcLeft || style == WispPathStyle.ArcRight;
		float halfRectBias = Mathf.Clamp01(wispUniformAutoHalfRectBias);
		float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
		bool roomyForSemiCircle = topSqueeze01 <= Mathf.Lerp(0.18f, 0.08f, halfRectBias);

		// In roomy spaces, semicircles are a good option, but not the only one.
		// Allow deterministic freeform fallbacks so the path language stays varied while remaining smooth.
		if (!crossesEquals && roomyForSemiCircle && (style == WispPathStyle.ArcUp || style == WispPathStyle.ArcDown))
		{
			bool allowSmoothFreeformVariant =
				dx >= Mathf.Max(bubbleSize * 2.6f, dy * 1.1f) &&
				topSqueeze01 <= 0.1f;
			if (allowSmoothFreeformVariant)
			{
				bool repeatedSemiCircle = wispPathFamilyCadenceEnabled &&
					lastWispPathVisualFamily == WispPathVisualFamily.SemiCircle &&
					wispPathVisualFamilyRepeatCount >= 1;
				int varietySeed = GetWispBezierFlavorVarietySeed(startPos, endPos, style);
				bool seedPrefersFreeform = (varietySeed % 3) == 1;
				if (repeatedSemiCircle || seedPrefersFreeform)
				{
					return ResolveWithOptionalWindowLock(WispUniformTemplateMode.Off);
				}
			}

			return ResolveWithOptionalWindowLock(WispUniformTemplateMode.SemiCircle);
		}

		float minRectSpan = Mathf.Max(28f, bubbleSize * Mathf.Lerp(2.2f, 1.9f, halfRectBias));
		float flatnessThreshold = Mathf.Lerp(1.34f, 1.08f, halfRectBias);
		bool flatEnoughForRect = dx >= Mathf.Max(dy * flatnessThreshold, minRectSpan);
		bool strongRectSpan = dx >= Mathf.Max(minRectSpan * Mathf.Lerp(1.22f, 1.02f, halfRectBias), Mathf.Max(36f, GetWispPathWidth() * 4.2f));
		bool lateralRectFriendly = stylePrefersRect &&
			flatEnoughForRect &&
			strongRectSpan &&
			(!roomyForSemiCircle || dx >= Mathf.Max(minRectSpan * 1.42f, dy * 1.75f));

		// Auto mode visual language pass: keep paths in smooth C/S families.
		// Half-rectangle remains available only when explicitly selected by template mode.
		bool preferFreeformForEqualsCross =
			crossesEquals &&
			(topSqueeze01 > 0.02f || wispBubbleAvoidZones.Count > 0 || dx < Mathf.Max(bubbleSize * 5.6f, minRectSpan * 1.32f));
		if (preferFreeformForEqualsCross && !lateralRectFriendly)
		{
			return ResolveWithOptionalWindowLock(WispUniformTemplateMode.Off);
		}

		// Apply visible-family cadence at the template level too (style cadence alone can't break repeated semicircles
		// when the same style keeps mapping to SemiCircle in Auto mode).
		if (wispPathFamilyCadenceEnabled)
		{
			int maxConsecutive = Mathf.Max(1, wispPathFamilyMaxConsecutive);
			bool repeatedTooMuch = wispPathVisualFamilyRepeatCount >= maxConsecutive;
			if (repeatedTooMuch)
			{
				if (lastWispPathVisualFamily == WispPathVisualFamily.HalfRectangle && roomyForSemiCircle)
				{
					return ResolveWithOptionalWindowLock(WispUniformTemplateMode.SemiCircle);
				}

				if (lastWispPathVisualFamily == WispPathVisualFamily.SemiCircle)
				{
					return ResolveWithOptionalWindowLock(WispUniformTemplateMode.Off);
				}
			}
		}

		bool preferFreeformWideCross =
			crossesEquals &&
			dx >= Mathf.Max(minRectSpan * 1.08f, dy * 1.35f) &&
			(topSqueeze01 > 0.01f || wispBubbleAvoidZones.Count > 0);

		WispUniformTemplateMode resolved = preferFreeformWideCross
			? WispUniformTemplateMode.Off
			: WispUniformTemplateMode.SemiCircle;
		return ResolveWithOptionalWindowLock(resolved);
	}

	private static WispPathVisualFamily MapWispStyleToVisualFamily(WispPathStyle style)
	{
		return style switch
		{
			WispPathStyle.SCurve => WispPathVisualFamily.SCurve,
			WispPathStyle.Jitter => WispPathVisualFamily.Jitter,
			WispPathStyle.MWave => WispPathVisualFamily.MWave,
			WispPathStyle.WWave => WispPathVisualFamily.WWave,
			WispPathStyle.ArcUp => WispPathVisualFamily.Arc,
			WispPathStyle.ArcDown => WispPathVisualFamily.Arc,
			WispPathStyle.ArcLeft => WispPathVisualFamily.Arc,
			WispPathStyle.ArcRight => WispPathVisualFamily.Arc,
			_ => WispPathVisualFamily.Unknown
		};
	}

	private WispPathVisualFamily PredictWispPathVisualFamily(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		WispUniformTemplateMode mode = wispUniformTemplateMode;
		if (mode == WispUniformTemplateMode.Auto)
		{
			mode = ResolveAutoWispUniformTemplateMode(startPos, endPos, style);
		}

		return mode switch
		{
			WispUniformTemplateMode.HalfRectangle => WispPathVisualFamily.HalfRectangle,
			WispUniformTemplateMode.SemiCircle => WispPathVisualFamily.SemiCircle,
			_ => MapWispStyleToVisualFamily(style)
		};
	}

	private float GetWispPathCadencePenalty(Vector2 startPos, Vector2 endPos, WispPathStyle candidate)
	{
		if (!wispPathFamilyCadenceEnabled)
		{
			return 0f;
		}

		WispPathVisualFamily family = PredictWispPathVisualFamily(startPos, endPos, candidate);
		if (family == WispPathVisualFamily.Unknown || family != lastWispPathVisualFamily)
		{
			return 0f;
		}

		int maxConsecutive = Mathf.Max(1, wispPathFamilyMaxConsecutive);
		if (wispPathVisualFamilyRepeatCount < maxConsecutive)
		{
			return 0f;
		}

		int overflow = (wispPathVisualFamilyRepeatCount - maxConsecutive) + 1;
		float penalty = Mathf.Clamp(wispPathFamilyRepeatPenalty, 0f, 0.6f) * Mathf.Max(1, overflow);
		if (family == WispPathVisualFamily.SemiCircle)
		{
			penalty += Mathf.Clamp(wispPathSemiCircleRepeatBonusPenalty, 0f, 0.25f);
		}

		return penalty;
	}

	private void RecordWispPathVisualFamily(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		WispPathVisualFamily family = PredictWispPathVisualFamily(startPos, endPos, style);
		if (family == WispPathVisualFamily.Unknown)
		{
			lastWispPathVisualFamily = WispPathVisualFamily.Unknown;
			wispPathVisualFamilyRepeatCount = 0;
			return;
		}

		if (family == lastWispPathVisualFamily)
		{
			wispPathVisualFamilyRepeatCount = Mathf.Clamp(wispPathVisualFamilyRepeatCount + 1, 1, 99);
		}
		else
		{
			lastWispPathVisualFamily = family;
			wispPathVisualFamilyRepeatCount = 1;
		}
	}

	private void RefineCanonicalTemplatePathWithAnchorGuides(
		List<Vector2> points,
		Vector2 startPos,
		Vector2 endPos,
		bool ignoreBubbleAvoidance,
		float resampleSpacing,
		int pointCap)
	{
		if (points == null || points.Count < 4)
		{
			return;
		}

		List<Vector2> anchors = wispCanonicalAnchorGuideScratch;
		anchors.Clear();

		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float endpointDistance = Vector2.Distance(startPos, endPos);
		int desiredAnchorCount = Mathf.Clamp(
			Mathf.RoundToInt((endpointDistance / Mathf.Max(18f, pathWidth * 1.55f)) + 5f),
			6,
			12);

		for (int i = 0; i < desiredAnchorCount; i++)
		{
			float t = desiredAnchorCount <= 1 ? 0f : (i / (float)(desiredAnchorCount - 1));
			anchors.Add(SamplePathPointByNormalizedIndex(points, t));
		}

		if (anchors.Count >= 2)
		{
			anchors[0] = startPos;
			anchors[anchors.Count - 1] = endPos;
		}

		if (!ignoreBubbleAvoidance)
		{
			ProjectWispPathOutsideBubbleZones(anchors);
		}

		ClampWispPathPointsToReferenceCeiling(anchors, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(anchors, startPos, endPos);

		ApplyCornerRoundingInPlace(anchors);
		ResamplePathBySpacingInPlace(anchors, resampleSpacing, pointCap);
		if (anchors.Count >= 2)
		{
			anchors[0] = startPos;
			anchors[anchors.Count - 1] = endPos;
		}

		if (!ignoreBubbleAvoidance)
		{
			ProjectWispPathOutsideBubbleZones(anchors);
		}

		ClampWispPathPointsToReferenceCeiling(anchors, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(anchors, startPos, endPos);

		points.Clear();
		points.AddRange(anchors);
	}

	private bool TryBuildUniformTemplatePathPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, List<Vector2> destination)
	{
		if (wispUniformTemplateMode == WispUniformTemplateMode.Off || destination == null)
		{
			currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
			return false;
		}

		WispUniformTemplateMode mode = wispUniformTemplateMode;
		if (mode == WispUniformTemplateMode.Auto)
		{
			mode = ResolveAutoWispUniformTemplateMode(startPos, endPos, style);
			if (mode == WispUniformTemplateMode.Off)
			{
				currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
				return false;
			}
		}

		currentWispResolvedTemplateMode = mode;

		bool built = mode switch
		{
			WispUniformTemplateMode.SemiCircle => BuildSemiCircleTemplatePathPoints(startPos, endPos, style, destination),
			WispUniformTemplateMode.HalfRectangle => BuildHalfRectangleTemplatePathPoints(startPos, endPos, style, destination),
			_ => false
		};

		if (!built || destination.Count < 2)
		{
			currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
			return false;
		}

		wispPathDebugSnapshot.inputPoints = destination.Count;
		wispPathDebugSnapshot.postResamplePoints = destination.Count;

		bool ignoreBubbleAvoidance = wispUniformIgnoreBubbleAvoidance;
		if (wispAvoidEquationBubbles)
		{
			RefreshWispBubbleAvoidZonesThrottled(GetWispPathWidth(), force: true);
			if (wispBubbleAvoidZones.Count > 0)
			{
				ignoreBubbleAvoidance = false;
			}
		}

		float templateSpacing = Mathf.Max(1.25f, GetWispPathWidth() * Mathf.Clamp(wispUniformTemplateSpacingWidthMultiplier, 0.12f, 0.6f));
		int templatePointCap = Mathf.Clamp(Mathf.Max(wispCurveMaxRenderPoints + 60, 180), 96, 360);
		ResamplePathBySpacingInPlace(destination, templateSpacing, templatePointCap);
		wispPathDebugSnapshot.spacingUsed = templateSpacing;
		wispPathDebugSnapshot.pointCapUsed = templatePointCap;
		wispPathDebugSnapshot.postResamplePoints = destination.Count;
		ApplyCornerRoundingInPlace(destination);
		if (destination.Count >= 2)
		{
			destination[0] = startPos;
			destination[destination.Count - 1] = endPos;
		}

		if (!ignoreBubbleAvoidance)
		{
			ProjectWispPathOutsideBubbleZones(destination);
		}

		ClampWispPathPointsToReferenceCeiling(destination, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(destination, startPos, endPos);

		if (!ignoreBubbleAvoidance)
		{
			ProjectWispPathOutsideBubbleZones(destination);
			ClampWispPathPointsToReferenceCeiling(destination, startPos, endPos);
			ClampWispPathPointsToPlayfieldBounds(destination, startPos, endPos);
		}

		if (destination.Count >= 3)
		{
			RefineCanonicalTemplatePathWithAnchorGuides(
				destination,
				startPos,
				endPos,
				ignoreBubbleAvoidance,
				templateSpacing,
				templatePointCap);
		}

		RefineWispEndpointShouldersInPlace(destination, startPos, endPos);
		if (!ignoreBubbleAvoidance)
		{
			ProjectWispPathOutsideBubbleZones(destination);
		}
		ClampWispPathPointsToReferenceCeiling(destination, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(destination, startPos, endPos);

		LockWispPathEndpoints(destination, startPos, endPos);

		if (wispUniformTemplateMode == WispUniformTemplateMode.Auto && mode != WispUniformTemplateMode.Off)
		{
			bool crossesEquals = IsWispCrossingEquals(startPos, endPos);
			float cornerSpike = ScoreWispPathCornerSpikePenalty(destination);
			float wobble = ScoreWispPathWobblePenalty(destination);
			float proximity = ScoreWispPathBubbleProximity(destination);
			float excessDip = ScoreWispPathExcessDipPenalty(destination, startPos, endPos);
			float readability = ScoreWispPathReadability(destination, startPos, endPos);
			bool templateLooksCornery = mode == WispUniformTemplateMode.HalfRectangle
				? cornerSpike > (crossesEquals ? 0.07f : 0.1f)
				: cornerSpike > 0.11f;
			bool templateLooksWobbly = wobble > 0.16f;
			bool templateLooksTooHeavy = excessDip > 0.16f || (excessDip > 0.1f && proximity > 0.14f);
			bool templateTooClose = proximity > (crossesEquals ? 0.18f : 0.22f);
			bool templateTooJaggyForCross = crossesEquals && (cornerSpike > 0.055f || readability > 0.56f);
			if (templateLooksCornery || templateLooksWobbly || templateLooksTooHeavy || templateTooClose || templateTooJaggyForCross || readability > 0.62f)
			{
				currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
				destination.Clear();
				return false;
			}
		}

		return destination.Count >= 2;
	}

}
