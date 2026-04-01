using System.Collections.Generic;
using UnityEngine;

public partial class DragExecutionController
{
	private float wispRuntimeStartEndpointSeatDistance = 0f;
	private float wispRuntimeEndEndpointSeatDistance = 0f;
	private static readonly float[] WispArcScaleCandidates = { 1f, 1.06f, 1.12f, 1.2f, 0.94f, 1.3f, 0.88f };
	private static readonly float[] WispLateralCandidates = { 0f, 0.1f, -0.1f, 0.18f, -0.18f, 0.28f, -0.28f };
	private static readonly float[] WispChordSkewCandidates = { 0f, -0.06f, 0.06f, -0.12f, 0.12f };
	private static readonly float[] WispArcAsymmetryCandidates = { 0f, -0.08f, 0.08f, -0.14f, 0.14f };
	private bool lastWispBuildUsedUniformTemplate;
	private WispUniformTemplateMode currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
	private WispPathRuntimeMode currentWispPathRuntimeMode = WispPathRuntimeMode.BezierReadability;
	private WispPathDebugSnapshot wispPathDebugSnapshot;
	private readonly List<(Vector2 center, float radius)> wispBubbleAvoidZones = new List<(Vector2 center, float radius)>(16);
	private readonly List<Vector2> wispPathProbePoints = new List<Vector2>(64);
	private readonly List<Vector2> wispSmoothPathScratchA = new List<Vector2>(256);
	private readonly List<Vector2> wispSmoothPathScratchB = new List<Vector2>(256);

	private static Vector2 GetBubbleVisualCenterOrOriginal(EquationBubbleElement bubble)
	{
		if (bubble == null)
		{
			return Vector2.zero;
		}

		RectTransform rt = bubble.RectTransform;
		if (rt != null)
		{
			return rt.anchoredPosition;
		}

		return bubble.OriginalPosition;
	}

	private bool TryGetActiveWispVisualEndpoints(out Vector2 startPos, out Vector2 endPos)
	{
		if (currentDraggingElement != null && currentDropZone != null)
		{
			startPos = GetBubbleVisualCenterOrOriginal(currentDraggingElement);
			endPos = GetBubbleVisualCenterOrOriginal(currentDropZone);
			return true;
		}

		if (journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			startPos = GetBubbleVisualCenterOrOriginal(journeySuggestedElement);
			endPos = GetBubbleVisualCenterOrOriginal(journeySuggestedDropZone);
			return true;
		}

		startPos = journeyWispStart;
		endPos = journeyWispEnd;
		return (endPos - startPos).sqrMagnitude > 0.0001f;
	}

	private void SetWispRuntimeEndpointSeating(float startSeatDistance, float endSeatDistance)
	{
		wispRuntimeStartEndpointSeatDistance = Mathf.Max(0f, startSeatDistance);
		wispRuntimeEndEndpointSeatDistance = Mathf.Max(0f, endSeatDistance);
	}

	private bool TryGetActiveWispEndpoints(out Vector2 startPos, out Vector2 endPos)
	{
		if (currentDraggingElement != null && currentDropZone != null)
		{
			startPos = currentDraggingElement.CurrentPathAnchorPosition;
			endPos = currentDropZone.CurrentPathAnchorPosition;
			return true;
		}

		if (journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			// Idle preview can be evaluated while the equation row is still settling.
			// Prefer live visual rect positions so rendered path placement matches what is visible.
			startPos = journeySuggestedElement.CurrentPathAnchorPosition;
			endPos = journeySuggestedDropZone.CurrentPathAnchorPosition;
			return true;
		}

		startPos = journeyWispStart;
		endPos = journeyWispEnd;
		return (endPos - startPos).sqrMagnitude > 0.0001f;
	}

	private bool TryGetActiveWispLogicalEndpoints(out Vector2 startPos, out Vector2 endPos)
	{
		if (currentDraggingElement != null && currentDropZone != null)
		{
			startPos = currentDraggingElement.OriginalPathAnchorPosition;
			endPos = currentDropZone.OriginalPathAnchorPosition;
			return true;
		}

		if (journeySuggestedElement != null && journeySuggestedDropZone != null)
		{
			startPos = journeySuggestedElement.CurrentPathAnchorPosition;
			endPos = journeySuggestedDropZone.CurrentPathAnchorPosition;
			return true;
		}

		startPos = journeyWispStart;
		endPos = journeyWispEnd;
		return (endPos - startPos).sqrMagnitude > 0.0001f;
	}

	private void ClearLockedWispPathUnitVariant()
	{
		hasLockedWindowPathUnitVariant = false;
		lockedWindowPathUnitBucket = WispPathUnitBucket.None;
		lockedWindowPathUnitFlipX = false;
		lockedWindowPathUnitFlipY = false;
		lockedPlaceholderVariantRepeatIndex = -1;
	}

	private float ResolveWispPathUnitPitchPixels()
	{
		if (wispFixedUnitPathPitchOverride > 0f)
		{
			return Mathf.Max(1f, wispFixedUnitPathPitchOverride);
		}

		// Fixed path art is based on stable equation spacing, so use the center-to-center layout pitch.
		float referenceBubble = GetWispGeometryReferenceBubbleSize();
		float autoPitch = referenceBubble + bubbleSpacing;
		autoPitch *= Mathf.Clamp(wispPathUnitPitchScale, 0.65f, 1.45f);
		return Mathf.Max(1f, autoPitch);
	}

	private static WispPathUnitBucket ResolveWispPathUnitBucketNearest(float unitDistance)
	{
		float clamped = Mathf.Max(0f, unitDistance);
		float d2 = Mathf.Abs(clamped - 2f);
		float d4 = Mathf.Abs(clamped - 4f);
		float d6 = Mathf.Abs(clamped - 6f);
		if (d2 < d4 && d2 <= d6)
		{
			return WispPathUnitBucket.Units2;
		}

		if (d4 < d6)
		{
			return WispPathUnitBucket.Units4;
		}

		return WispPathUnitBucket.Units6;
	}

	private WispPathUnitBucket ResolvePlaceholderArcSpriteBucket(float unitDistance)
	{
		float units = Mathf.Max(0f, unitDistance);
		if (units < 2.45f)
		{
			return WispPathUnitBucket.Units2;
		}

		if (units < 5.15f)
		{
			return WispPathUnitBucket.Units4;
		}

		return WispPathUnitBucket.Units6;
	}

	private void ResolveCurrentWispPathUnitVariant(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		currentWispPathResolvedUnitPitch = 0f;
		currentWispPathResolvedUnitDistance = 0f;
		currentWispPathUnitBucket = WispPathUnitBucket.None;
		currentWispPathUnitFlipX = false;
		currentWispPathUnitFlipY = false;

		if (!wispUseFixedUnitPathBuckets)
		{
			return;
		}

		bool useWindowLock = lockPathPerHitZoneWindow && hasLockedWindowPathStyle;
		if (useWindowLock &&
			TryGetPreparedResolvedWispWindowState(out WispWindowState resolvedWindowState) &&
			resolvedWindowState.pathUnitBucket != WispPathUnitBucket.None)
		{
			currentWispPathUnitBucket = resolvedWindowState.pathUnitBucket;
			currentWispPathUnitFlipX = resolvedWindowState.pathUnitFlipX;
			currentWispPathUnitFlipY = resolvedWindowState.pathUnitFlipY;
			currentWispPathResolvedUnitPitch = ResolveWispPathUnitPitchPixels();
			float units = (int)currentWispPathUnitBucket;
			currentWispPathResolvedUnitDistance = Mathf.Max(0f, units);
			return;
		}

		if (useWindowLock && hasLockedWindowPathUnitVariant)
		{
			currentWispPathUnitBucket = lockedWindowPathUnitBucket;
			currentWispPathUnitFlipX = lockedWindowPathUnitFlipX;
			currentWispPathUnitFlipY = lockedWindowPathUnitFlipY;
			currentWispPathResolvedUnitPitch = ResolveWispPathUnitPitchPixels();
			float units = (int)currentWispPathUnitBucket;
			currentWispPathResolvedUnitDistance = Mathf.Max(0f, units);
			return;
		}

		float pitch = ResolveWispPathUnitPitchPixels();
		Vector2 bucketStart = startPos;
		Vector2 bucketEnd = endPos;
		if (TryGetActiveWispVisualEndpoints(out Vector2 activeVisualStart, out Vector2 activeVisualEnd))
		{
			bucketStart = activeVisualStart;
			bucketEnd = activeVisualEnd;
		}
		else if (TryGetActiveWispLogicalEndpoints(out Vector2 activeLogicalStart, out Vector2 activeLogicalEnd))
		{
			bucketStart = activeLogicalStart;
			bucketEnd = activeLogicalEnd;
		}

		float horizontalDistance = Mathf.Abs(bucketEnd.x - bucketStart.x);
		float unitsDistance = horizontalDistance / Mathf.Max(1f, pitch);
		WispPathUnitBucket bucket = ShouldForceCanonicalPathForPlaceholderArcSprites()
			? ResolvePlaceholderArcSpriteBucket(unitsDistance)
			: ResolveWispPathUnitBucketNearest(unitsDistance);
		bool flipX = bucketEnd.x < bucketStart.x;
		bool flipY = ResolveCanonicalTemplateBendDown(style, startPos, endPos);

		currentWispPathResolvedUnitPitch = pitch;
		currentWispPathResolvedUnitDistance = unitsDistance;
		currentWispPathUnitBucket = bucket;
		currentWispPathUnitFlipX = flipX;
		currentWispPathUnitFlipY = flipY;

		if (useWindowLock)
		{
			lockedWindowPathUnitBucket = bucket;
			lockedWindowPathUnitFlipX = flipX;
			lockedWindowPathUnitFlipY = flipY;
			hasLockedWindowPathUnitVariant = true;
		}
	}

	private EquationBubbleElement GetActiveWispSourceElement()
	{
		if (currentDraggingElement != null)
		{
			return currentDraggingElement;
		}

		return journeySuggestedElement;
	}

	private EquationBubbleElement GetActiveWispDestinationElement()
	{
		if (currentDraggingElement != null)
		{
			return currentDropZone;
		}

		return journeySuggestedDropZone;
	}

	private bool IsWispCrossingEquals(Vector2 startPos, Vector2 endPos)
	{
		if (!TryGetEqualsX(out float equalsX))
		{
			return false;
		}

		float a = startPos.x - equalsX;
		float b = endPos.x - equalsX;
		return (a * b) < 0f;
	}

	private int GetAdaptiveWispTravelStepCount()
	{
		float baseBeats = Mathf.Max(1f, wispSpeed);
		if (!wispUseAdaptiveTravelSteps || !TryGetActiveWispLogicalEndpoints(out Vector2 startPos, out Vector2 endPos))
		{
			return Mathf.Clamp(Mathf.RoundToInt(baseBeats), 1, 12);
		}

		float distance = Vector2.Distance(startPos, endPos);
		float unit = Mathf.Max(8f, bubbleSize);
		float distance01 = Mathf.InverseLerp(unit * 1.2f, unit * 7.5f, distance);

		float maxMul = Mathf.Max(0.8f, wispAdaptiveTravelMaxMultiplier);
		float multiplier = Mathf.Lerp(0.92f, maxMul, distance01);
		if (IsWispCrossingEquals(startPos, endPos))
		{
			multiplier += Mathf.Clamp(wispAdaptiveTravelEqualsCrossBonus, 0f, 0.6f);
		}

		EquationBubbleElement source = GetActiveWispSourceElement();
		if (source != null && (source.ElementType == BubbleElementType.Variable || source.ElementType == BubbleElementType.Coefficient))
		{
			multiplier += Mathf.Clamp(wispAdaptiveTravelVariableBonus, 0f, 0.4f);
		}

		float beats = baseBeats * multiplier;
		return Mathf.Clamp(Mathf.RoundToInt(beats), 1, 12);
	}

	private Vector2 GetPointOnCurrentWispPath(float progress01, out int pathIndex)
	{
		pathIndex = 0;
		if (currentWispPath == null || currentWispPath.Count <= 0)
		{
			return Vector2.zero;
		}

		if (currentWispPath.Count == 1)
		{
			return currentWispPath[0];
		}

		float normalized = Mathf.Clamp01(progress01);
		float totalLength = 0f;
		for (int i = 1; i < currentWispPath.Count; i++)
		{
			totalLength += Vector2.Distance(currentWispPath[i - 1], currentWispPath[i]);
		}

		if (totalLength <= 0.0001f)
		{
			float p = normalized * (currentWispPath.Count - 1);
			int i = Mathf.Clamp(Mathf.FloorToInt(p), 0, currentWispPath.Count - 2);
			float t = p - i;
			pathIndex = Mathf.Clamp(Mathf.RoundToInt(p), 0, currentWispPath.Count - 1);
			return Vector2.Lerp(currentWispPath[i], currentWispPath[i + 1], t);
		}

		float targetDistance = totalLength * normalized;
		float traversed = 0f;
		for (int i = 1; i < currentWispPath.Count; i++)
		{
			Vector2 a = currentWispPath[i - 1];
			Vector2 b = currentWispPath[i];
			float segLength = Vector2.Distance(a, b);
			if (segLength <= 0.0001f)
			{
				continue;
			}

			if (traversed + segLength >= targetDistance)
			{
				float t = Mathf.Clamp01((targetDistance - traversed) / segLength);
				pathIndex = Mathf.Clamp(Mathf.RoundToInt(Mathf.Lerp(i - 1, i, t)), 0, currentWispPath.Count - 1);
				return Vector2.Lerp(a, b, t);
			}

			traversed += segLength;
		}

		pathIndex = currentWispPath.Count - 1;
		return currentWispPath[pathIndex];
	}

	private bool HasWispArcSprites()
	{
		return wispArcSpriteUnits2 != null || wispArcSpriteUnits4 != null || wispArcSpriteUnits6 != null;
	}

	private bool ShouldForceCanonicalPathForPlaceholderArcSprites()
	{
		// Dot-sprite mode is procedural. Keep placeholder-arc canonical forcing scoped to
		// actual placeholder sprite workflows so dot scenes can still use full path variants.
		return wispDotSprite == null
			&& wispPlaceholderArcSpritesForceCanonicalPath
			&& HasWispArcSprites();
	}

	private bool ShouldUseProceduralGameplayPathForCanonicalPlaceholder()
	{
		return ShouldForceCanonicalPathForPlaceholderArcSprites()
			&& wispDotSprite == null
			&& currentDraggingElement != null;
	}

	private bool ShouldUseWispArcSpriteForCurrentPath()
	{
		if (wispDotSprite != null)
		{
			return false;
		}

		if (ShouldUseProceduralGameplayPathForCanonicalPlaceholder())
		{
			return false;
		}

		return HasWispArcSprites();
	}

	private void RefreshWispBubbleAvoidZones(float pathWidth)
	{
		wispBubbleAvoidZones.Clear();
		if (!wispAvoidEquationBubbles || bubbleElements == null || bubbleElements.Count == 0)
		{
			return;
		}

		float pathInfluence = Mathf.Max(0f, pathWidth) * 0.5f;
		float maxAdaptivePadding = Mathf.Max(4f, bubbleSize * 0.22f);
		float configuredPadding = Mathf.Min(Mathf.Max(0f, wispBubbleAvoidancePadding), maxAdaptivePadding);
		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null || bubble.RectTransform == null)
			{
				continue;
			}

			RectTransform rt = bubble.RectTransform;
			if (!rt.gameObject.activeInHierarchy)
			{
				continue;
			}

			float bubbleDiameter = Mathf.Max(rt.rect.width, rt.rect.height);
			bool tinyOperatorToken = bubble.ElementType == BubbleElementType.Operator &&
				bubbleDiameter < Mathf.Max(20f, bubbleSize * 0.38f);
			if (tinyOperatorToken || bubble.ElementType == BubbleElementType.DropZone)
			{
				continue;
			}

			if (bubble == currentDraggingElement || bubble == currentDropZone || bubble == journeySuggestedElement || bubble == journeySuggestedDropZone)
			{
				continue;
			}

			float baseRadius = bubbleDiameter * 0.5f;
			float adaptivePad = configuredPadding
				+ Mathf.Min(pathInfluence, baseRadius * 0.34f)
				+ Mathf.Max(1.25f, GetWispPathWidth() * 0.22f);
			float radius = baseRadius + adaptivePad;
			wispBubbleAvoidZones.Add((rt.anchoredPosition, radius));
		}
	}

	private void InvalidateWispBubbleAvoidZoneCache()
	{
		wispNextBubbleZoneRefreshTime = -1f;
	}

	private void RefreshWispBubbleAvoidZonesThrottled(float pathWidth, bool force)
	{
		if (!wispAvoidEquationBubbles)
		{
			wispBubbleAvoidZones.Clear();
			return;
		}

		float now = Time.unscaledTime;
		if (!force && wispBubbleAvoidZones.Count > 0 && now < wispNextBubbleZoneRefreshTime)
		{
			return;
		}

		RefreshWispBubbleAvoidZones(pathWidth);
		float interval = currentDraggingElement != null
			? Mathf.Max(0f, wispOcclusionZoneRefreshWhileDraggingSeconds)
			: Mathf.Max(0f, wispOcclusionZoneRefreshSeconds);
		wispNextBubbleZoneRefreshTime = now + interval;
	}

	private bool IsPointInsideWispBubbleAvoidZone(Vector2 point)
	{
		if (!wispAvoidEquationBubbles || wispBubbleAvoidZones.Count == 0)
		{
			return false;
		}

		for (int i = 0; i < wispBubbleAvoidZones.Count; i++)
		{
			(Vector2 center, float radius) zone = wispBubbleAvoidZones[i];
			if ((point - zone.center).sqrMagnitude <= zone.radius * zone.radius)
			{
				return true;
			}
		}

		return false;
	}

	private float GetWispIndicatorSize()
	{
		float referenceBubble = GetWispGeometryReferenceBubbleSize();
		if (wispAutoScaleToBubble)
		{
			return Mathf.Max(6f, referenceBubble * Mathf.Clamp(wispIndicatorSizeRatio, 0.12f, 0.75f));
		}

		return Mathf.Max(6f, wispSize);
	}

	private float GetWispPathWidth()
	{
		float referenceBubble = GetWispGeometryReferenceBubbleSize();
		float maxWidthByBubble = Mathf.Max(2f, referenceBubble * Mathf.Clamp(wispPathMaxWidthToBubbleRatio, 0.08f, 0.9f));

		if (wispAutoScaleToBubble)
		{
			float width = Mathf.Max(2f, referenceBubble * Mathf.Clamp(wispPathWidthRatio, 0.04f, 0.75f));
			return Mathf.Min(width, maxWidthByBubble);
		}

		float manual = Mathf.Max(2f, wispPathWidth);
		return Mathf.Min(manual, maxWidthByBubble);
	}

	private static float GetVisualRadius(RectTransform rect)
	{
		if (rect == null)
		{
			return 0f;
		}

		float scale = Mathf.Max(Mathf.Abs(rect.localScale.x), Mathf.Abs(rect.localScale.y));
		float diameter = Mathf.Max(rect.rect.width, rect.rect.height) * Mathf.Max(0.01f, scale);
		return diameter * 0.5f;
	}

	private float GetEquationBubbleVisualRadius(EquationBubbleElement bubble)
	{
		if (bubble == null || bubble.RectTransform == null)
		{
			return Mathf.Max(6f, bubbleSize * 0.5f);
		}

		RectTransform root = bubble.RectTransform;
		float radius = GetVisualRadius(root);
		Transform outline = root.Find("Outline");
		if (outline is RectTransform outlineRect)
		{
			radius = Mathf.Max(radius, GetVisualRadius(outlineRect));
		}

		return Mathf.Max(6f, radius);
	}

	private float GetWispGeometryReferenceBubbleSize()
	{
		float configured = Mathf.Max(8f, bubbleSize);
		if (!wispGeometrySampleActiveBubbles)
		{
			return configured;
		}

		EquationBubbleElement src = GetActiveWispSourceElement();
		EquationBubbleElement dst = GetActiveWispDestinationElement();
		float diameterSum = 0f;
		int count = 0;

		if (src != null)
		{
			diameterSum += GetEquationBubbleVisualRadius(src) * 2f;
			count++;
		}

		if (dst != null)
		{
			diameterSum += GetEquationBubbleVisualRadius(dst) * 2f;
			count++;
		}

		if (count <= 0)
		{
			return configured;
		}

		float measured = Mathf.Max(8f, diameterSum / count);
		float blend = Mathf.Clamp01(wispGeometryUseRenderedBubbleBlend);
		return Mathf.Lerp(configured, measured, blend);
	}

	private float GetWispFollowRingRadius()
	{
		if (wispFollowRingUseBubbleRadius)
		{
			EquationBubbleElement activeBubble = currentDraggingElement != null
				? currentDraggingElement
				: journeySuggestedElement != null ? journeySuggestedElement : null;
			float bubbleRadius = GetEquationBubbleVisualRadius(activeBubble);

			float ratio = Mathf.Clamp(wispFollowRingBubbleRadiusRatio, 0.35f, 1.6f);
			return Mathf.Max(4f, (bubbleRadius * ratio) + Mathf.Max(0f, wispFollowRingRadiusPadding));
		}

		float indicatorSize = GetWispIndicatorSize();
		return Mathf.Max(1f, indicatorSize * 0.5f * Mathf.Clamp(wispOverlapDistanceMultiplier, 0.4f, 2f));
	}

	private float GetWispArcHeight(Vector2 startPos, Vector2 endPos)
	{
		bool useFigmaPlaceholderArcRatio = wispDotSprite != null || ShouldForceCanonicalPathForPlaceholderArcSprites();
		float referenceBubble = GetWispGeometryReferenceBubbleSize();
		float arcScale = Mathf.Clamp(wispArcHeightMultiplier, 0.35f, 2.4f);
		if (useFigmaPlaceholderArcRatio && wispAutoScaleToBubble)
		{
			float figmaPathHeightToBubbleRatio = Mathf.Clamp(wispCanonicalArcHeightToBubbleRatio, 0.6f, 2.4f);
			float target = referenceBubble * figmaPathHeightToBubbleRatio * arcScale;
			float min = Mathf.Max(wispArcHeightMin, bubbleSize * 0.6f);
			float max = Mathf.Max(min, wispArcHeightMax);
			return Mathf.Clamp(target, min, max);
		}

		float arc = wispPathArcHeight;
		if (wispArcHeightScalesWithDistance)
		{
			float dist = Vector2.Distance(startPos, endPos);
			arc = dist * Mathf.Clamp(wispArcHeightDistanceRatio, 0.05f, 0.75f);
		}
		arc *= arcScale;

		if (wispAutoScaleToBubble)
		{
			float min = Mathf.Max(wispArcHeightMin, referenceBubble * 0.6f);
			float max = Mathf.Max(min, wispArcHeightMax);
			return Mathf.Clamp(arc, min, max);
		}

		return Mathf.Clamp(arc, wispArcHeightMin, Mathf.Max(wispArcHeightMin, wispArcHeightMax));
	}

	private static Vector2 CalculateCubicBezier(float t, Vector2 p0, Vector2 p1, Vector2 p2, Vector2 p3)
	{
		float u = 1f - t;
		float uu = u * u;
		float tt = t * t;
		float uuu = uu * u;
		float ttt = tt * t;
		return (uuu * p0) + (3f * uu * t * p1) + (3f * u * tt * p2) + (ttt * p3);
	}

	private static void PopulateWispBezierPoints(
		Vector2 startPos,
		Vector2 controlA,
		Vector2 controlB,
		Vector2 endPos,
		int segments,
		List<Vector2> destination)
	{
		if (destination == null)
		{
			return;
		}

		destination.Clear();
		int seg = Mathf.Max(2, segments);
		for (int i = 0; i <= seg; i++)
		{
			float t = i / (float)seg;
			destination.Add(CalculateCubicBezier(t, startPos, controlA, controlB, endPos));
		}
	}

	private void ResamplePathBySpacingInPlace(List<Vector2> points, float spacing, int maxPoints)
	{
		if (points == null || points.Count < 2)
		{
			return;
		}

		float step = Mathf.Max(1f, spacing);
		int limit = Mathf.Max(8, maxPoints);
		List<Vector2> dst = wispSmoothPathScratchB;
		dst.Clear();
		dst.Add(points[0]);

		float carried = 0f;
		for (int i = 1; i < points.Count && dst.Count < limit - 1; i++)
		{
			Vector2 a = points[i - 1];
			Vector2 b = points[i];
			Vector2 delta = b - a;
			float segLen = delta.magnitude;
			if (segLen < 0.0001f)
			{
				continue;
			}

			Vector2 dir = delta / segLen;
			float next = step - carried;
			while (next < segLen && dst.Count < limit - 1)
			{
				dst.Add(a + (dir * next));
				next += step;
			}

			carried = Mathf.Max(0f, next - segLen);
		}

		dst.Add(points[points.Count - 1]);
		points.Clear();
		points.AddRange(dst);
	}

	private void ApplyCornerRoundingInPlace(List<Vector2> points)
	{
		if (!wispCurveCornerRounding || points == null || points.Count < 3)
		{
			return;
		}

		float minTurn = Mathf.Clamp(wispCurveCornerRoundMinTurnDegrees, 8f, 80f);
		float blend = Mathf.Clamp(wispCurveCornerRoundBlend, 0.15f, 0.45f);

		List<Vector2> src = wispSmoothPathScratchA;
		List<Vector2> dst = wispSmoothPathScratchB;
		src.Clear();
		src.AddRange(points);
		dst.Clear();
		dst.Add(src[0]);

		for (int i = 1; i < src.Count - 1; i++)
		{
			Vector2 prev = src[i - 1];
			Vector2 curr = src[i];
			Vector2 next = src[i + 1];
			Vector2 d0 = curr - prev;
			Vector2 d1 = next - curr;
			if (d0.sqrMagnitude <= 0.000001f || d1.sqrMagnitude <= 0.000001f)
			{
				dst.Add(curr);
				continue;
			}

			float turn = Mathf.Abs(Vector2.SignedAngle(d0.normalized, d1.normalized));
			if (turn < minTurn)
			{
				dst.Add(curr);
				continue;
			}

			Vector2 a = Vector2.Lerp(prev, curr, 1f - blend);
			Vector2 b = Vector2.Lerp(curr, next, blend);
			dst.Add(a);
			dst.Add(b);
		}

		dst.Add(src[src.Count - 1]);
		points.Clear();
		points.AddRange(dst);
	}

	private void RefineWispEndpointShouldersInPlace(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 6)
		{
			return;
		}

		int last = points.Count - 1;
		float pathWidth = Mathf.Max(2f, GetWispPathWidth());
		float chord = Vector2.Distance(startPos, endPos);
		if (chord <= pathWidth * 1.25f)
		{
			return;
		}

		int span = Mathf.Clamp(Mathf.RoundToInt(points.Count * 0.14f), 2, 6);
		int startAnchor = Mathf.Clamp(span + 1, 2, last - 2);
		int endAnchor = Mathf.Clamp(last - span - 1, 2, last - 2);
		if (startAnchor >= endAnchor)
		{
			return;
		}

		float startStrength = 0.5f;
		float endStrength = 0.62f;

		for (int i = 1; i < startAnchor; i++)
		{
			float t = i / (float)startAnchor;
			float envelope = 1f - Mathf.Clamp01(t);
			envelope = envelope * envelope;
			Vector2 target = Vector2.Lerp(startPos, points[startAnchor], t);
			points[i] = Vector2.Lerp(points[i], target, startStrength * envelope);
		}

		int endSpanCount = last - endAnchor;
		for (int i = endAnchor + 1; i < last; i++)
		{
			float t = (i - endAnchor) / (float)Mathf.Max(1, endSpanCount);
			float envelope = t * t;
			Vector2 target = Vector2.Lerp(points[endAnchor], endPos, t);
			points[i] = Vector2.Lerp(points[i], target, endStrength * envelope);
		}
	}

	private void FinalizeWispPathGeometry(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count < 3)
		{
			return;
		}

		ProjectWispPathOutsideBubbleZones(points);
		ClampWispPathPointsToReferenceCeiling(points, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(points, startPos, endPos);
		ApplyCornerRoundingInPlace(points);
		ProjectWispPathOutsideBubbleZones(points);
		ClampWispPathPointsToReferenceCeiling(points, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(points, startPos, endPos);

		float spacing = Mathf.Max(2f, GetWispPathWidth() * Mathf.Clamp(wispCurvePointSpacingWidthMultiplier, 0.2f, 1.6f));
		ResamplePathBySpacingInPlace(points, spacing, wispCurveMaxRenderPoints);
		wispPathDebugSnapshot.spacingUsed = spacing;
		wispPathDebugSnapshot.pointCapUsed = wispCurveMaxRenderPoints;
		wispPathDebugSnapshot.postResamplePoints = points.Count;

		ProjectWispPathOutsideBubbleZones(points);
		ClampWispPathPointsToReferenceCeiling(points, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(points, startPos, endPos);
		RefineWispEndpointShouldersInPlace(points, startPos, endPos);
		ProjectWispPathOutsideBubbleZones(points);
		ClampWispPathPointsToReferenceCeiling(points, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(points, startPos, endPos);
		ApplyCornerRoundingInPlace(points);
		ProjectWispPathOutsideBubbleZones(points);
		ClampWispPathPointsToReferenceCeiling(points, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(points, startPos, endPos);

		LockWispPathEndpoints(points, startPos, endPos);
	}

	private int GetAdaptiveWispPathSegmentCount(Vector2 startPos, Vector2 endPos)
	{
		int baseSegments = Mathf.Max(2, wispPathSegments);
		float distance = Vector2.Distance(startPos, endPos);
		float width = Mathf.Max(2f, GetWispPathWidth());
		float targetSegmentLength = Mathf.Max(6f, width * 0.95f);
		int distanceSegments = Mathf.CeilToInt(distance / targetSegmentLength);
		return Mathf.Clamp(Mathf.Max(baseSegments, distanceSegments), 4, 180);
	}

	private void ProjectWispPathOutsideBubbleZones(List<Vector2> points)
	{
		if (!wispAvoidEquationBubbles || points == null || points.Count < 3 || wispBubbleAvoidZones.Count == 0)
		{
			return;
		}

		int last = points.Count - 1;
		float extraClearance = Mathf.Max(1f, GetWispPathWidth() * 0.34f);
		for (int pass = 0; pass < 3; pass++)
		{
			bool adjustedAny = false;
			for (int i = 1; i < last; i++)
			{
				Vector2 point = points[i];
				Vector2 prev = points[Mathf.Max(0, i - 1)];
				Vector2 next = points[Mathf.Min(last, i + 1)];
				Vector2 tangent = next - prev;

				for (int z = 0; z < wispBubbleAvoidZones.Count; z++)
				{
					(Vector2 center, float radius) zone = wispBubbleAvoidZones[z];
					float minDistance = zone.radius + extraClearance;
					Vector2 offset = point - zone.center;
					float distance = offset.magnitude;
					if (distance >= minDistance)
					{
						continue;
					}

					Vector2 dir;
					if (distance > 0.001f)
					{
						dir = offset / distance;
					}
					else if (tangent.sqrMagnitude > 0.0001f)
					{
						Vector2 perp = new Vector2(-tangent.y, tangent.x).normalized;
						float ySign = Mathf.Sign(point.y - zone.center.y);
						if (Mathf.Approximately(ySign, 0f))
						{
							ySign = pass % 2 == 0 ? 1f : -1f;
						}

						dir = perp * ySign;
					}
					else
					{
						dir = Vector2.up;
					}

					float push = minDistance - distance;
					point += dir * push;
					adjustedAny = true;
				}

				points[i] = point;
			}

			if (!adjustedAny)
			{
				break;
			}

			for (int i = 1; i < last; i++)
			{
				Vector2 smoothed = (points[i - 1] + points[i] + points[i + 1]) / 3f;
				if (IsPointInsideWispBubbleAvoidZone(smoothed))
				{
					continue;
				}

				points[i] = Vector2.Lerp(points[i], smoothed, 0.36f);
			}
		}

		for (int i = 1; i < last; i++)
		{
			Vector2 relaxed = (points[i - 1] + (points[i] * 2f) + points[i + 1]) * 0.25f;
			if (IsPointInsideWispBubbleAvoidZone(relaxed))
			{
				continue;
			}

			points[i] = Vector2.Lerp(points[i], relaxed, 0.42f);
		}
	}

	private void ClampWispControlPoints(ref Vector2 c1, ref Vector2 c2, Vector2 startPos, Vector2 endPos)
	{
		float ceilingY = GetWispCurveCeilingY(startPos, endPos);
		c1.y = Mathf.Min(c1.y, ceilingY);
		c2.y = Mathf.Min(c2.y, ceilingY);

		if (!wispAvoidEquationBubbles)
		{
			return;
		}

		RefreshWispBubbleAvoidZonesThrottled(GetWispPathWidth(), force: true);
		PushControlPointOutsideBubbleZones(ref c1, startPos, endPos, ceilingY);
		PushControlPointOutsideBubbleZones(ref c2, startPos, endPos, ceilingY);
	}

	private void ApplyWispControlPointBias(
		ref Vector2 c1,
		ref Vector2 c2,
		Vector2 startPos,
		Vector2 endPos,
		float arcScale,
		float lateralBias)
	{
		ApplyWispControlPointBias(ref c1, ref c2, startPos, endPos, arcScale, lateralBias, 0f, 0f);
	}

	private void ApplyWispControlPointBias(
		ref Vector2 c1,
		ref Vector2 c2,
		Vector2 startPos,
		Vector2 endPos,
		float arcScale,
		float lateralBias,
		float chordSkew,
		float arcAsymmetry)
	{
		Vector2 d = endPos - startPos;
		float dist = d.magnitude;
		if (dist < 0.001f)
		{
			return;
		}

		float skew = Mathf.Clamp(chordSkew, -0.35f, 0.35f);
		float tShift = skew * 0.13f;
		float t1 = Mathf.Clamp(0.33f + tShift, 0.14f, 0.48f);
		float t2 = Mathf.Clamp(0.66f + tShift, 0.52f, 0.86f);
		if (t2 <= t1 + 0.04f)
		{
			t2 = Mathf.Clamp(t1 + 0.04f, 0.52f, 0.86f);
		}

		Vector2 chord1 = startPos + (d * t1);
		Vector2 chord2 = startPos + (d * t2);
		float scale = Mathf.Clamp(arcScale, 0.65f, 1.8f);
		float asym = Mathf.Clamp(arcAsymmetry, -0.45f, 0.45f);
		float scale1 = scale * (1f + (asym * 0.22f));
		float scale2 = scale * (1f - (asym * 0.22f));
		Vector2 dir = d / dist;
		Vector2 perp = new Vector2(-dir.y, dir.x);
		float sideDistance = dist * Mathf.Clamp(lateralBias, -0.45f, 0.45f) * 0.18f;
		Vector2 sideOffset = perp * sideDistance;
		Vector2 asymSideOffset = perp * (dist * asym * 0.045f);

		c1 = chord1 + ((c1 - chord1) * scale1) + sideOffset + asymSideOffset;
		c2 = chord2 + ((c2 - chord2) * scale2) + sideOffset - asymSideOffset;
		ClampWispControlPoints(ref c1, ref c2, startPos, endPos);
	}

	private int GetWispBezierFlavorVarietySeed(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		int ax = Mathf.RoundToInt(startPos.x * 0.125f);
		int ay = Mathf.RoundToInt(startPos.y * 0.125f);
		int bx = Mathf.RoundToInt(endPos.x * 0.125f);
		int by = Mathf.RoundToInt(endPos.y * 0.125f);
		int seed = unchecked((ax * 73856093) ^ (ay * 19349663) ^ (bx * 83492791) ^ (by * 265443576));
		seed ^= unchecked((dragBeatSequenceCounter + 1) * 374761393);
		seed ^= ((int)style + 1) * 668265263;
		return seed & int.MaxValue;
	}

	private void PushControlPointOutsideBubbleZones(ref Vector2 point, Vector2 startPos, Vector2 endPos, float ceilingY)
	{
		if (wispBubbleAvoidZones.Count == 0)
		{
			return;
		}

		float floorY = GetWispCurveFloorY(startPos, endPos);
		if (floorY > ceilingY)
		{
			floorY = ceilingY;
		}

		for (int pass = 0; pass < 2; pass++)
		{
			bool adjusted = false;
			for (int i = 0; i < wispBubbleAvoidZones.Count; i++)
			{
				(Vector2 center, float radius) zone = wispBubbleAvoidZones[i];
				Vector2 offset = point - zone.center;
				float distance = offset.magnitude;
				float minDistance = zone.radius + 2f;
				if (distance >= minDistance)
				{
					continue;
				}

				Vector2 dir;
				if (distance > 0.001f)
				{
					dir = offset / distance;
				}
				else
				{
					dir = new Vector2(point.x <= zone.center.x ? -1f : 1f, 0.2f).normalized;
				}

				float push = minDistance - distance;
				point += dir * push;
				point.y = Mathf.Clamp(point.y, floorY, ceilingY);
				adjusted = true;
			}

			if (!adjusted)
			{
				break;
			}
		}
	}

	private void GetWispControlPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, out Vector2 c1, out Vector2 c2)
	{
		Vector2 d = endPos - startPos;
		float dist = d.magnitude;
		Vector2 dir = dist > 0.001f ? (d / dist) : Vector2.right;
		Vector2 perp = new Vector2(-dir.y, dir.x);

		float arc = GetWispArcHeight(startPos, endPos);
		Vector2 up = Vector2.up;

		c1 = startPos + (d * 0.33f) + (up * arc);
		c2 = startPos + (d * 0.66f) + (up * arc * 0.55f);

		switch (style)
		{
			case WispPathStyle.ArcDown:
				c1 = startPos + (d * 0.33f) - (up * arc);
				c2 = startPos + (d * 0.66f) - (up * arc * 0.55f);
				break;

			case WispPathStyle.ArcLeft:
				c1 = startPos + (d * 0.33f) + (perp * arc);
				c2 = startPos + (d * 0.66f) + (perp * arc * 0.55f);
				break;

			case WispPathStyle.ArcRight:
				c1 = startPos + (d * 0.33f) - (perp * arc);
				c2 = startPos + (d * 0.66f) - (perp * arc * 0.55f);
				break;

			case WispPathStyle.SCurve:
				c1 = startPos + (d * 0.33f) + (perp * arc);
				c2 = startPos + (d * 0.66f) - (perp * arc);
				break;

			case WispPathStyle.Jitter:
			{
				float k = Mathf.Clamp01(wispJitterStrength);
				float j = arc * k;
				Vector2 jitter1;
				Vector2 jitter2;
				if (wispVariantDeterministic)
				{
					int seed = unchecked((wispVariantSeed * 16777619) ^ (dragBeatSequenceCounter * 1315423911));
					System.Random rng = new System.Random(seed);
					float rx1 = (float)(rng.NextDouble() * 2.0 - 1.0);
					float ry1 = (float)(rng.NextDouble() * 2.0 - 1.0);
					float rx2 = (float)(rng.NextDouble() * 2.0 - 1.0);
					float ry2 = (float)(rng.NextDouble() * 2.0 - 1.0);
					jitter1 = new Vector2(rx1, ry1) * j;
					jitter2 = new Vector2(rx2, ry2) * j;
				}
				else
				{
					jitter1 = new Vector2(UnityEngine.Random.Range(-1f, 1f), UnityEngine.Random.Range(-1f, 1f)) * j;
					jitter2 = new Vector2(UnityEngine.Random.Range(-1f, 1f), UnityEngine.Random.Range(-1f, 1f)) * j;
				}

				c1 = startPos + (d * 0.33f) + (up * arc) + jitter1;
				c2 = startPos + (d * 0.66f) + (up * arc * 0.55f) + jitter2;
				break;
			}

			case WispPathStyle.MWave:
			case WispPathStyle.WWave:
				c1 = startPos + (d * 0.33f) + (perp * arc * 0.65f);
				c2 = startPos + (d * 0.66f) - (perp * arc * 0.45f);
				break;
		}

		ClampWispControlPoints(ref c1, ref c2, startPos, endPos);
	}

	private void CalculateWispPath(Vector2 startPos, Vector2 endPos)
	{
		WispPathStyle style =
			(lockPathPerHitZoneWindow && hasLockedWindowPathStyle)
				? lockedWindowPathStyle
				: PickWispPathStyle();
		CalculateWispPath(startPos, endPos, style);
	}

	private void BuildWispPathPoints(Vector2 startPos, Vector2 endPos, WispPathStyle style, List<Vector2> destination, bool allowReadabilityRefinement = true)
	{
		if (destination == null)
		{
			lastWispBuildUsedUniformTemplate = false;
			currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;
			return;
		}

		currentWispResolvedTemplateMode = WispUniformTemplateMode.Off;

		if (BuildWaveTemplatePathPoints(startPos, endPos, style, destination))
		{
			lastWispBuildUsedUniformTemplate = false;
			wispPathDebugSnapshot.inputPoints = destination.Count;
			FinalizeWispPathGeometry(destination, startPos, endPos);
			LockWispPathEndpoints(destination, startPos, endPos);
			return;
		}

		if (TryBuildUniformTemplatePathPoints(startPos, endPos, style, destination))
		{
			lastWispBuildUsedUniformTemplate = true;
			return;
		}

		lastWispBuildUsedUniformTemplate = false;

		GetWispControlPoints(startPos, endPos, style, out Vector2 baseC1, out Vector2 baseC2);
		int segmentCount = GetAdaptiveWispPathSegmentCount(startPos, endPos);
		PopulateWispBezierPoints(startPos, baseC1, baseC2, endPos, segmentCount, destination);
		wispPathDebugSnapshot.inputPoints = destination.Count;
		ProjectWispPathOutsideBubbleZones(destination);
		ClampWispPathPointsToReferenceCeiling(destination, startPos, endPos);
		ClampWispPathPointsToPlayfieldBounds(destination, startPos, endPos);
		FinalizeWispPathGeometry(destination, startPos, endPos);
		LockWispPathEndpoints(destination, startPos, endPos);

		if (destination.Count < 2 || !allowReadabilityRefinement)
		{
			return;
		}

		float topSqueeze01 = GetWispTopSqueeze01(startPos, endPos);
		float topBiasWeight = GetEffectiveWispTopBiasWeight();
		float bestScore = ScoreWispPathReadability(destination, startPos, endPos);
		if (topSqueeze01 > 0.001f && topBiasWeight > 0f)
		{
			bestScore += ScoreWispUpperClearancePenalty(destination, startPos, endPos) * topSqueeze01 * topBiasWeight;
		}

		bool hasAvoidZones = wispAvoidEquationBubbles && wispBubbleAvoidZones.Count > 0;
		if (!hasAvoidZones && topSqueeze01 <= 0.08f)
		{
			return;
		}

		float acceptedScore = (Mathf.Clamp(wispSegmentCullConfidenceThreshold, 0.5f, 0.95f) * 0.42f) + 0.14f;
		if (bestScore <= acceptedScore)
		{
			return;
		}

		bool crossesEquals = IsWispCrossingEquals(startPos, endPos);
		bool useExpandedProbe = topSqueeze01 > 0.2f || wispBubbleAvoidZones.Count > 2 || crossesEquals;
		int arcCandidates = useExpandedProbe ? WispArcScaleCandidates.Length : Mathf.Min(3, WispArcScaleCandidates.Length);
		int lateralCandidates = useExpandedProbe ? WispLateralCandidates.Length : Mathf.Min(4, WispLateralCandidates.Length);
		bool constrainFlavorVariance = topSqueeze01 > 0.12f || (crossesEquals && (wispBubbleAvoidZones.Count > 1 || topSqueeze01 > 0.04f));
		bool supportsBezierFlavorVariance =
			style == WispPathStyle.SCurve ||
			style == WispPathStyle.ArcLeft ||
			style == WispPathStyle.ArcRight ||
			style == WispPathStyle.MWave ||
			style == WispPathStyle.WWave;
		int skewCandidates = constrainFlavorVariance
			? 1
			: (crossesEquals ? Mathf.Min(WispChordSkewCandidates.Length, 3) : (useExpandedProbe ? Mathf.Min(WispChordSkewCandidates.Length, 4) : Mathf.Min(WispChordSkewCandidates.Length, 3)));
		int asymCandidates = constrainFlavorVariance
			? 1
			: (supportsBezierFlavorVariance
				? (crossesEquals ? Mathf.Min(WispArcAsymmetryCandidates.Length, 3) : (useExpandedProbe ? WispArcAsymmetryCandidates.Length : Mathf.Min(WispArcAsymmetryCandidates.Length, 2)))
				: 1);
		int flavorSeed = GetWispBezierFlavorVarietySeed(startPos, endPos, style);
		int preferredArcIndex = arcCandidates > 0 ? ((flavorSeed / 3) % arcCandidates) : 0;
		int preferredLateralIndex = lateralCandidates > 0 ? ((flavorSeed / 5) % lateralCandidates) : 0;
		int preferredSkewIndex = skewCandidates > 0 ? (flavorSeed % skewCandidates) : 0;
		int preferredAsymIndex = asymCandidates > 0 ? ((flavorSeed / 7) % asymCandidates) : 0;

		for (int arcIndex = 0; arcIndex < arcCandidates; arcIndex++)
		{
			float arcScale = WispArcScaleCandidates[arcIndex];
			for (int lateralIndex = 0; lateralIndex < lateralCandidates; lateralIndex++)
			{
				float lateralBias = WispLateralCandidates[lateralIndex];
				for (int skewIndex = 0; skewIndex < skewCandidates; skewIndex++)
				{
					float chordSkew = WispChordSkewCandidates[skewIndex];
					for (int asymIndex = 0; asymIndex < asymCandidates; asymIndex++)
					{
						float arcAsymmetry = WispArcAsymmetryCandidates[asymIndex];
						if (arcIndex == 0 && lateralIndex == 0 && skewIndex == 0 && asymIndex == 0)
						{
							continue;
						}

						Vector2 c1 = baseC1;
						Vector2 c2 = baseC2;
						ApplyWispControlPointBias(ref c1, ref c2, startPos, endPos, arcScale, lateralBias, chordSkew, arcAsymmetry);
						PopulateWispBezierPoints(startPos, c1, c2, endPos, segmentCount, wispPathProbePoints);
						ProjectWispPathOutsideBubbleZones(wispPathProbePoints);
						ClampWispPathPointsToReferenceCeiling(wispPathProbePoints, startPos, endPos);
						ClampWispPathPointsToPlayfieldBounds(wispPathProbePoints, startPos, endPos);
						FinalizeWispPathGeometry(wispPathProbePoints, startPos, endPos);
						LockWispPathEndpoints(wispPathProbePoints, startPos, endPos);

						float score = ScoreWispPathReadability(wispPathProbePoints, startPos, endPos);
						if (topSqueeze01 > 0.001f && topBiasWeight > 0f)
						{
							score += ScoreWispUpperClearancePenalty(wispPathProbePoints, startPos, endPos) * topSqueeze01 * topBiasWeight;
						}

						score += Mathf.Abs(arcScale - 1f) * 0.02f;
						score += Mathf.Abs(lateralBias) * 0.012f;
						score += Mathf.Abs(chordSkew) * 0.018f;
						score += Mathf.Abs(arcAsymmetry) * 0.024f;

						if (arcCandidates > 1 && arcIndex == preferredArcIndex)
						{
							score -= crossesEquals ? 0.006f : 0.011f;
						}

						if (lateralCandidates > 1 && lateralIndex == preferredLateralIndex)
						{
							score -= crossesEquals ? 0.005f : 0.009f;
						}

						if (skewIndex == preferredSkewIndex)
						{
							score -= crossesEquals ? 0.0025f : 0.006f;
						}

						if (asymCandidates > 1 && asymIndex == preferredAsymIndex)
						{
							score -= crossesEquals ? 0.002f : 0.0045f;
						}

						if (score >= bestScore - 0.001f)
						{
							continue;
						}

						bestScore = score;
						destination.Clear();
						destination.AddRange(wispPathProbePoints);
						if (bestScore <= acceptedScore * 0.7f)
						{
							return;
						}
					}
				}
			}
		}
	}

	private void CalculateWispPath(Vector2 startPos, Vector2 endPos, WispPathStyle style)
	{
		currentWispPathStyle = ResolveOcclusionAwareWispStyle(startPos, endPos, style);
		ResolveCurrentWispPathUnitVariant(startPos, endPos, currentWispPathStyle);
		BuildWispPathPoints(startPos, endPos, currentWispPathStyle, currentWispPath);
		RecordWispPathVisualFamily(startPos, endPos, currentWispPathStyle);
	}

	private WispPathRuntimeMode ResolveWispPathRuntimeMode()
	{
		if (wispDotSprite != null || ShouldUseProceduralGameplayPathForCanonicalPlaceholder())
		{
			return WispPathRuntimeMode.AdaptiveDot;
		}

		return lastWispBuildUsedUniformTemplate
			? WispPathRuntimeMode.UniformTemplate
			: WispPathRuntimeMode.BezierReadability;
	}

	private void BuildRuntimeWispPath(Vector2 startPos, Vector2 endPos, bool useStyleOverride, WispPathStyle styleOverride = WispPathStyle.ArcUp)
	{
		wispPathDebugSnapshot = default;
		if (useStyleOverride)
		{
			CalculateWispPath(startPos, endPos, styleOverride);
		}
		else
		{
			CalculateWispPath(startPos, endPos);
		}

		currentWispPathRuntimeMode = ResolveWispPathRuntimeMode();
		wispPathDebugSnapshot.mode = currentWispPathRuntimeMode;
		if (wispPathDebugSnapshot.inputPoints <= 0)
		{
			int points = currentWispPath != null ? currentWispPath.Count : 0;
			wispPathDebugSnapshot.inputPoints = points;
			wispPathDebugSnapshot.postResamplePoints = points;
		}
	}

	private Vector2 CalculateQuadraticBezier(float t, Vector2 p0, Vector2 p1, Vector2 p2)
	{
		float u = 1f - t;
		return u * u * p0 + 2f * u * t * p1 + t * t * p2;
	}
}
