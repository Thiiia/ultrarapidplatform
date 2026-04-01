using System.Collections.Generic;

using UnityEngine;
using UnityEngine.Rendering;

using DG.Tweening;

using Shapes;

public partial class DragExecutionController
{
	private readonly List<PolylinePoint> wispPathPolylinePoints = new List<PolylinePoint>(256);
	private readonly List<float> wispPathArcLengthScratch = new List<float>(256);
	private readonly List<Color> wispPathBaseColors = new List<Color>(256);
	private readonly List<float> wispPathEndpointFadeMask = new List<float>(256);

	private void EnsureWispPathPolyline()
	{
		if (wispPathContainer == null)
		{
			return;
		}

		if (wispPathPolyline == null)
		{
			GameObject polyObj = new GameObject("WispPathPolyline", typeof(RectTransform), typeof(Polyline));
			polyObj.transform.SetParent(wispPathContainer, false);
			RectTransform polyRect = polyObj.GetComponent<RectTransform>();
			polyRect.anchorMin = Vector2.zero;
			polyRect.anchorMax = Vector2.one;
			polyRect.pivot = new Vector2(0.5f, 0.5f);
			polyRect.anchoredPosition = Vector2.zero;
			polyRect.sizeDelta = Vector2.zero;
			wispPathPolyline = polyObj.GetComponent<Polyline>();
		}
		if (wispPathUnderlayPolyline == null)
		{
			GameObject underlayObj = new GameObject("WispPathPolyline_Underlay", typeof(RectTransform), typeof(Polyline));
			underlayObj.transform.SetParent(wispPathContainer, false);
			RectTransform underlayRect = underlayObj.GetComponent<RectTransform>();
			underlayRect.anchorMin = Vector2.zero;
			underlayRect.anchorMax = Vector2.one;
			underlayRect.pivot = new Vector2(0.5f, 0.5f);
			underlayRect.anchoredPosition = Vector2.zero;
			underlayRect.sizeDelta = Vector2.zero;
			wispPathUnderlayPolyline = underlayObj.GetComponent<Polyline>();
		}

		wispPathUnderlayPolyline.Closed = false;
		wispPathUnderlayPolyline.Geometry = PolylineGeometry.Flat2D;
		wispPathUnderlayPolyline.ThicknessSpace = ThicknessSpace.Meters;
		wispPathUnderlayPolyline.Thickness = Mathf.Max(1f, GetRenderedWispPathWidth() * 1.18f);
		wispPathUnderlayPolyline.Joins = ResolveWispPathJoinMode();
		wispPathUnderlayPolyline.ZTest = CompareFunction.Always;
		wispPathPolyline.Closed = false;
		wispPathPolyline.Geometry = PolylineGeometry.Flat2D;
		wispPathPolyline.ThicknessSpace = ThicknessSpace.Meters;
		wispPathPolyline.Thickness = Mathf.Max(1f, GetRenderedWispPathWidth());
		wispPathPolyline.Joins = ResolveWispPathJoinMode();
		wispPathPolyline.ZTest = CompareFunction.Always;
		SyncWispPathPolylineSorting();
		EnsureWispPathEndpointCapDiscs();
	}

	private void EnsureWispPathEndpointCapDiscs()
	{
		if (wispPathContainer == null)
		{
			return;
		}

		void EnsureCap(ref Disc disc, ref RectTransform rect, string name)
		{
			if (disc == null || rect == null)
			{
				GameObject capObj = new GameObject(name, typeof(RectTransform), typeof(Disc));
				capObj.transform.SetParent(wispPathContainer, false);
				rect = capObj.GetComponent<RectTransform>();
				disc = capObj.GetComponent<Disc>();
			}

			rect.anchorMin = new Vector2(0.5f, 0.5f);
			rect.anchorMax = new Vector2(0.5f, 0.5f);
			rect.pivot = new Vector2(0.5f, 0.5f);
			rect.sizeDelta = Vector2.zero;
			rect.localRotation = Quaternion.identity;
			rect.localScale = Vector3.one;

			disc.Type = DiscType.Disc;
			disc.RadiusSpace = ThicknessSpace.Meters;
			disc.ZTest = CompareFunction.Always;
			disc.gameObject.SetActive(false);
			SyncWispPathEndpointCapSorting(disc);
		}

		EnsureCap(ref wispPathStartCapDisc, ref wispPathStartCapRect, "WispPathStartCap");
		EnsureCap(ref wispPathEndCapDisc, ref wispPathEndCapRect, "WispPathEndCap");
	}

	private void SyncWispPathPolylineSorting()
	{
		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;

		if (wispPathUnderlayPolyline != null)
		{
			if (sourceCanvas != null)
			{
				wispPathUnderlayPolyline.SortingLayerID = sourceCanvas.sortingLayerID;
			}

			wispPathUnderlayPolyline.SortingOrder = GetWispPathBodySortingBaseOrder() - 1;
		}

		if (wispPathPolyline == null)
		{
			return;
		}

		if (sourceCanvas != null)
		{
			wispPathPolyline.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		wispPathPolyline.SortingOrder = GetWispPathBodySortingBaseOrder();
	}

	private void RefreshWispPathUnderlayPolyline()
	{
		if (wispPathUnderlayPolyline == null)
		{
			return;
		}

		if (wispPathPolyline == null || wispPathPolyline.points == null || wispPathPolyline.points.Count < 2)
		{
			wispPathUnderlayPolyline.points.Clear();
			wispPathUnderlayPolyline.meshOutOfDate = true;
			wispPathUnderlayPolyline.gameObject.SetActive(false);
			return;
		}

		List<PolylinePoint> mainPts = wispPathPolyline.points;
		List<PolylinePoint> underlayPts = wispPathUnderlayPolyline.points;
		underlayPts.Clear();
		float bodyWidth = Mathf.Max(1f, wispPathPolyline.Thickness);
		wispPathUnderlayPolyline.Thickness = bodyWidth * 1.18f;
		wispPathUnderlayPolyline.Joins = wispPathPolyline.Joins;
		SyncWispPathPolylineSorting();

		for (int i = 0; i < mainPts.Count; i++)
		{
			PolylinePoint src = mainPts[i];
			Color c = Color.Lerp(src.color, Color.white, 0.03f);
			c.a = Mathf.Clamp01(src.color.a * 0.08f);
			underlayPts.Add(new PolylinePoint(src.point, c));
		}

		wispPathUnderlayPolyline.meshOutOfDate = true;
		wispPathUnderlayPolyline.gameObject.SetActive(true);
		if (wispPathUnderlayPolyline.transform.parent == wispPathContainer)
		{
			wispPathUnderlayPolyline.transform.SetAsFirstSibling();
		}
	}

	private void SyncWispPathEndpointCapSorting(Disc disc)
	{
		if (disc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			disc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		// Slightly above path body so caps hide polyline cutoffs cleanly, but still below equation bubbles in behind mode.
		disc.SortingOrder = GetWispPathBodySortingBaseOrder();
	}

	private void SyncWispTickMarkerDiscSorting(Disc disc)
	{
		if (disc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			disc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		disc.SortingOrder = GetWispPathBodySortingBaseOrder();
	}

	private void SyncActiveDragApproachRingDiscSorting()
	{
		if (activeDragApproachRingDisc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			activeDragApproachRingDisc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		// Keep the active drag ring above wisp indicator/follow ring so the dragged bubble highlight remains readable.
		activeDragApproachRingDisc.SortingOrder = GetWispShapeSortingBaseOrder() + 5;
	}

	private void SyncSourceBubbleApproachRingDiscSorting()
	{
		if (sourceBubbleApproachRingDisc == null)
		{
			return;
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			sourceBubbleApproachRingDisc.SortingLayerID = sourceCanvas.sortingLayerID;
		}

		// Keep the source cue above the path/follow ring, but below the moving target and drag ring.
		sourceBubbleApproachRingDisc.SortingOrder = GetWispShapeSortingBaseOrder() + 2;
	}

	private void SyncAllWispShapeSorting()
	{
		SyncWispPathPolylineSorting();
		SyncWispPathEndpointCapSorting(wispPathStartCapDisc);
		SyncWispPathEndpointCapSorting(wispPathEndCapDisc);
		SyncWispFollowRingSorting();
		SyncWispTargetApproachRingSorting();
		SyncWispIndicatorDiscSorting();
		SyncWispIndicatorOutlineDiscSorting();
		SyncSourceBubbleApproachRingDiscSorting();
		SyncActiveDragApproachRingDiscSorting();

		for (int i = 0; i < wispTickMarkerDiscs.Count; i++)
		{
			SyncWispTickMarkerDiscSorting(wispTickMarkerDiscs[i]);
		}
	}

	private static Vector2 SamplePathPointByNormalizedIndex(IReadOnlyList<Vector2> points, float t)
	{
		if (points == null || points.Count == 0)
		{
			return Vector2.zero;
		}

		if (points.Count == 1)
		{
			return points[0];
		}

		float clamped = Mathf.Clamp01(t);
		int last = points.Count - 1;
		float scaled = clamped * last;
		int indexA = Mathf.Clamp(Mathf.FloorToInt(scaled), 0, last);
		int indexB = Mathf.Min(last, indexA + 1);
		float localT = scaled - indexA;
		return Vector2.Lerp(points[indexA], points[indexB], localT);
	}

	private static void LockWispPathEndpoints(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (points == null || points.Count <= 0)
		{
			return;
		}

		points[0] = startPos;
		if (points.Count > 1)
		{
			points[points.Count - 1] = endPos;
		}
	}

	private static float BuildPathArcLengthTable(IReadOnlyList<Vector2> points, List<float> cumulativeLengths)
	{
		if (cumulativeLengths == null)
		{
			return 0f;
		}

		cumulativeLengths.Clear();
		if (points == null || points.Count <= 0)
		{
			return 0f;
		}

		float total = 0f;
		cumulativeLengths.Add(0f);
		for (int i = 1; i < points.Count; i++)
		{
			total += Vector2.Distance(points[i - 1], points[i]);
			cumulativeLengths.Add(total);
		}

		return total;
	}

	private static Vector2 SamplePathPointByArcLength(IReadOnlyList<Vector2> points, IReadOnlyList<float> cumulativeLengths, float targetDistance, ref int segmentCursor)
	{
		if (points == null || points.Count == 0)
		{
			return Vector2.zero;
		}

		if (points.Count == 1 || cumulativeLengths == null || cumulativeLengths.Count != points.Count)
		{
			return points[0];
		}

		int last = points.Count - 1;
		float clampedTarget = Mathf.Clamp(targetDistance, 0f, cumulativeLengths[last]);
		segmentCursor = Mathf.Clamp(segmentCursor, 0, last - 1);
		while (segmentCursor < last - 1 && cumulativeLengths[segmentCursor + 1] < clampedTarget)
		{
			segmentCursor++;
		}

		int aIndex = segmentCursor;
		int bIndex = Mathf.Min(last, aIndex + 1);
		float aLen = cumulativeLengths[aIndex];
		float bLen = cumulativeLengths[bIndex];
		float segLen = Mathf.Max(0.0001f, bLen - aLen);
		float localT = Mathf.Clamp01((clampedTarget - aLen) / segLen);
		return Vector2.Lerp(points[aIndex], points[bIndex], localT);
	}

	private void BuildWispPathPolylinePoints(float greenStart, float greenEnd, float perfectStart)
	{
		wispPathPolylinePoints.Clear();
		wispPathBaseColors.Clear();
		wispPathEndpointFadeMask.Clear();
		if (currentWispPath == null || currentWispPath.Count < 2)
		{
			return;
		}

		int total = currentWispPath.Count;
		float guidanceAlphaMul = Mathf.Clamp01(GetJourneyGuidancePathAlphaMultiplier());
		bool dotMode = wispDotSprite != null;
		int maxPoints = Mathf.Clamp(wispShapesPolylineMaxPoints, 24, dotMode ? 480 : 240);
		int minTarget = Mathf.Min(maxPoints, dotMode ? 140 : 36);
		float decimationFloorRatio = IsWispCrossingEquals(currentWispPath[0], currentWispPath[currentWispPath.Count - 1]) ? 0.6f : 0.5f;
		float effectiveDecimation = dotMode
			? Mathf.Min(Mathf.Clamp01(wispShapesPolylineDecimation), 0.08f)
			: Mathf.Clamp01(wispShapesPolylineDecimation);
		int decimatedTarget = Mathf.RoundToInt(Mathf.Lerp(maxPoints, Mathf.Max(minTarget, Mathf.RoundToInt(maxPoints * decimationFloorRatio)), effectiveDecimation));
		int targetPoints = dotMode
			? Mathf.Clamp(decimatedTarget, Mathf.Min(maxPoints, 140), maxPoints)
			: Mathf.Clamp(decimatedTarget, 2, maxPoints);

		if (total <= targetPoints)
		{
			for (int i = 0; i < total; i++)
			{
				float t = total <= 1 ? 0f : (i / (float)(total - 1));
				bool inGreenZone = t >= greenStart && t <= greenEnd;
				bool inPerfectZone = t >= perfectStart && t <= greenEnd;
				Color c = GetWispSegmentColor(inGreenZone, inPerfectZone, t);
				c.a *= guidanceAlphaMul;
				Vector2 p = currentWispPath[i];
				wispPathPolylinePoints.Add(new PolylinePoint(new Vector3(p.x, p.y, 0f), c));
				wispPathBaseColors.Add(c);
				wispPathEndpointFadeMask.Add(1f);
			}
		}
		else
		{
			float totalArcLength = BuildPathArcLengthTable(currentWispPath, wispPathArcLengthScratch);
			bool useArcLengthSampling = totalArcLength > 0.001f && wispPathArcLengthScratch.Count == currentWispPath.Count;
			int segmentCursor = 0;
			for (int i = 0; i < targetPoints; i++)
			{
				float t = targetPoints <= 1 ? 0f : (i / (float)(targetPoints - 1));
				bool inGreenZone = t >= greenStart && t <= greenEnd;
				bool inPerfectZone = t >= perfectStart && t <= greenEnd;
				Color c = GetWispSegmentColor(inGreenZone, inPerfectZone, t);
				c.a *= guidanceAlphaMul;
				Vector2 p;
				if (useArcLengthSampling)
				{
					float targetDistance = totalArcLength * t;
					p = SamplePathPointByArcLength(currentWispPath, wispPathArcLengthScratch, targetDistance, ref segmentCursor);
				}
				else
				{
					p = SamplePathPointByNormalizedIndex(currentWispPath, t);
				}
				wispPathPolylinePoints.Add(new PolylinePoint(new Vector3(p.x, p.y, 0f), c));
				wispPathBaseColors.Add(c);
				wispPathEndpointFadeMask.Add(1f);
			}
		}

		if (wispPathPolylinePoints.Count <= 0)
		{
			const float t = 1f;
			bool inGreenZone = t >= greenStart && t <= greenEnd;
			bool inPerfectZone = t >= perfectStart && t <= greenEnd;
			Color c = GetWispSegmentColor(inGreenZone, inPerfectZone, t);
			c.a *= guidanceAlphaMul;
			Vector2 p = currentWispPath[total - 1];
			wispPathPolylinePoints.Add(new PolylinePoint(new Vector3(p.x, p.y, 0f), c));
			wispPathBaseColors.Add(c);
			wispPathEndpointFadeMask.Add(1f);
		}

		if (wispPathPolylinePoints.Count > 0 && currentWispPath.Count > 0)
		{
			PolylinePoint first = wispPathPolylinePoints[0];
			Vector2 exactStart = currentWispPath[0];
			first.point = new Vector3(exactStart.x, exactStart.y, 0f);
			wispPathPolylinePoints[0] = first;

			if (wispPathPolylinePoints.Count > 1)
			{
				PolylinePoint lastPoint = wispPathPolylinePoints[wispPathPolylinePoints.Count - 1];
				Vector2 exactEnd = currentWispPath[currentWispPath.Count - 1];
				lastPoint.point = new Vector3(exactEnd.x, exactEnd.y, 0f);
				wispPathPolylinePoints[wispPathPolylinePoints.Count - 1] = lastPoint;
			}
		}

		ApplyWispPathEndpointBubbleFade();
	}

	private void ApplyWispPathEndpointBubbleFade()
	{
		bool dotMode = wispDotSprite != null;
		// In dot mode, keep full endpoint coverage by default. Only mask the source side when
		// the origin ghost is visible so the path endpoint doesn't show inside the faded ghost bubble.
		float dragGhostAlpha = dragOriginGhostCanvasGroup != null ? dragOriginGhostCanvasGroup.alpha : (dragOriginGhostObject != null ? 1f : 0f);
		bool ghostBubbleVisible = dragOriginGhostObject != null && dragGhostAlpha > 0.01f;
		bool maskSourceInsideDragGhost = dotMode && currentDraggingElement != null && ghostBubbleVisible;
		if (dotMode && !maskSourceInsideDragGhost)
		{
			return;
		}

		bool shouldRunLegacyDualEndpointFade = !dotMode;
		if (shouldRunLegacyDualEndpointFade && (!wispRenderBehindEquationBubbles || !wispEndpointBubbleFadeEnabled))
		{
			return;
		}

		if (wispPathPolylinePoints == null || wispPathPolylinePoints.Count < 2)
		{
			return;
		}

		int count = wispPathPolylinePoints.Count;
		wispPathArcLengthScratch.Clear();
		float totalLength = 0f;
		wispPathArcLengthScratch.Add(0f);
		for (int i = 1; i < count; i++)
		{
			Vector3 a3 = wispPathPolylinePoints[i - 1].point;
			Vector3 b3 = wispPathPolylinePoints[i].point;
			totalLength += Vector2.Distance(new Vector2(a3.x, a3.y), new Vector2(b3.x, b3.y));
			wispPathArcLengthScratch.Add(totalLength);
		}

		if (totalLength <= 0.001f || wispPathArcLengthScratch.Count != count)
		{
			return;
		}

		EquationBubbleElement sourceBubble = GetActiveWispSourceElement();
		EquationBubbleElement destBubble = GetActiveWispDestinationElement();
		float startRadius = Mathf.Max(8f, GetEquationBubbleVisualRadius(sourceBubble));
		float endRadius = Mathf.Max(8f, GetEquationBubbleVisualRadius(destBubble));
		float startRadiusForFade = Mathf.Max(0f, startRadius - Mathf.Max(0f, wispRuntimeStartEndpointSeatDistance));
		float endRadiusForFade = Mathf.Max(0f, endRadius - Mathf.Max(0f, wispRuntimeEndEndpointSeatDistance));
		float pathWidth = Mathf.Max(2f, GetRenderedWispPathWidth());
		bool endIsDropZone = destBubble != null && destBubble.ElementType == BubbleElementType.DropZone;
		float outlineBand01 = Mathf.Clamp01(wispEndpointBubbleFadeOutlineBand * 2f);
		float edgeFadeBand = Mathf.Max(1f, Mathf.Lerp(pathWidth * 0.02f, pathWidth * 0.55f, outlineBand01));
		if (dotMode && !maskSourceInsideDragGhost)
		{
			edgeFadeBand = Mathf.Max(edgeFadeBand, pathWidth * 0.35f);
		}
		float dropZoneBand = edgeFadeBand * (endIsDropZone ? 1.2f : 1f);

		// Keep the fade hugging the outline. For ghost masking in dot mode, fully hide the path
		// inside the source ghost bubble and gently ramp out just beyond its rim.
		float hardInset = (!maskSourceInsideDragGhost && dotMode) ? Mathf.Max(0f, pathWidth * 0.08f) : 0f;
		float startHardHideDistance = Mathf.Max(0f, startRadiusForFade - hardInset);
		float startFadeDistance = startHardHideDistance + edgeFadeBand;
		float endHardHideDistance = Mathf.Max(0f, endRadiusForFade - hardInset);
		float endFadeDistance = endHardHideDistance + dropZoneBand;
		float minEndpointAlpha = (!maskSourceInsideDragGhost && dotMode) ? 0.06f : 0f;

		if (maskSourceInsideDragGhost)
		{
			float ghostScale = Mathf.Clamp(dragOriginGhostScale, 0.85f, 1.15f);
			float ghostMaskRadius = Mathf.Max(startRadiusForFade, startRadius * ghostScale);
			startHardHideDistance = ghostMaskRadius;
			startFadeDistance = startHardHideDistance + Mathf.Max(1f, pathWidth * 0.34f);
			minEndpointAlpha = 0f;
		}

		for (int i = 0; i < count; i++)
		{
			float fromStart = wispPathArcLengthScratch[i];
			float fromEnd = totalLength - fromStart;
			float startAlpha = 1f;
			if (fromStart < startFadeDistance)
			{
				float tStart = Mathf.InverseLerp(startHardHideDistance, startFadeDistance, fromStart);
				tStart = tStart * tStart * (3f - (2f * tStart));
				startAlpha = Mathf.Lerp(minEndpointAlpha, 1f, Mathf.Clamp01(tStart));
			}

			float endAlpha = 1f;
			if (!maskSourceInsideDragGhost && fromEnd < endFadeDistance)
			{
				float tEnd = Mathf.InverseLerp(endHardHideDistance, endFadeDistance, fromEnd);
				tEnd = tEnd * tEnd * (3f - (2f * tEnd));
				endAlpha = Mathf.Lerp(minEndpointAlpha, 1f, Mathf.Clamp01(tEnd));
			}

			float alphaMul = Mathf.Min(startAlpha, endAlpha);
			if (alphaMul >= 0.999f)
			{
				if (i < wispPathEndpointFadeMask.Count)
				{
					wispPathEndpointFadeMask[i] = Mathf.Min(wispPathEndpointFadeMask[i], 1f);
				}
				continue;
			}

			PolylinePoint pt = wispPathPolylinePoints[i];
			Color c = pt.color;
			c.a *= alphaMul;
			pt.color = c;
			wispPathPolylinePoints[i] = pt;

			if (i < wispPathBaseColors.Count)
			{
				Color baseColor = wispPathBaseColors[i];
				baseColor.a *= alphaMul;
				wispPathBaseColors[i] = baseColor;
			}
			if (i < wispPathEndpointFadeMask.Count)
			{
				wispPathEndpointFadeMask[i] = Mathf.Clamp01(wispPathEndpointFadeMask[i] * alphaMul);
			}
		}
	}

	private void RenderWispPathAsShapesPolyline(float greenStart, float greenEnd, float perfectStart)
	{
		EnsureWispPathPolyline();
		if (wispPathPolyline == null)
		{
			return;
		}

		wispPathPolyline.Thickness = Mathf.Max(1f, GetRenderedWispPathWidth());
		wispPathPolyline.Joins = ResolveWispPathJoinMode();
		SyncWispPathPolylineSorting();
		BuildWispPathPolylinePoints(greenStart, greenEnd, perfectStart);
		if (wispPathUnderlayPolyline != null)
		{
			wispPathUnderlayPolyline.points.Clear();
			wispPathUnderlayPolyline.meshOutOfDate = true;
			wispPathUnderlayPolyline.gameObject.SetActive(false);
		}
		wispPathPolyline.points.Clear();
		wispPathPolyline.points.AddRange(wispPathPolylinePoints);
		wispPathPolyline.meshOutOfDate = true;
		RefreshWispPathEndpointCaps();
		wispPathPolyline.gameObject.SetActive(wispPathPolyline.points.Count >= 2);
	}

	private void RefreshWispPathEndpointCaps()
	{
		EnsureWispPathEndpointCapDiscs();
		RefreshWispPathUnderlayPolyline();
		bool hasPath = wispPathPolyline != null && wispPathPolyline.points != null && wispPathPolyline.points.Count >= 2;
		if (!hasPath)
		{
			if (wispPathStartCapDisc != null) wispPathStartCapDisc.gameObject.SetActive(false);
			if (wispPathEndCapDisc != null) wispPathEndCapDisc.gameObject.SetActive(false);
			return;
		}

		List<PolylinePoint> pts = wispPathPolyline.points;
		PolylinePoint first = pts[0];
		PolylinePoint last = pts[pts.Count - 1];
		float radius = Mathf.Max(0.5f, wispPathPolyline.Thickness * 0.5f);

		void ApplyCap(Disc disc, RectTransform rect, PolylinePoint src)
		{
			if (disc == null || rect == null)
			{
				return;
			}

			rect.anchoredPosition = new Vector2(src.point.x, src.point.y);
			rect.localScale = Vector3.one;
			disc.Radius = radius;
			disc.Color = src.color;
			SyncWispPathEndpointCapSorting(disc);
			disc.gameObject.SetActive(true);
		}

		if (wispRenderBehindEquationBubbles)
		{
			if (wispPathStartCapDisc != null) wispPathStartCapDisc.gameObject.SetActive(false);
			if (wispPathEndCapDisc != null) wispPathEndCapDisc.gameObject.SetActive(false);
			return;
		}

		if (!wispShapesPolylineRoundJoins)
		{
			if (wispPathStartCapDisc != null) wispPathStartCapDisc.gameObject.SetActive(false);
			if (wispPathEndCapDisc != null) wispPathEndCapDisc.gameObject.SetActive(false);
			return;
		}

		ApplyCap(wispPathStartCapDisc, wispPathStartCapRect, first);
		ApplyCap(wispPathEndCapDisc, wispPathEndCapRect, last);
	}

	private void AnimateWispPathSpawnVisuals()
	{
		if (wispPathPolyline == null || wispPathPolyline.points == null || wispPathPolyline.points.Count < 2)
		{
			return;
		}

		DOTween.Kill(wispPathPolyline);
		if (wispPathUnderlayPolyline != null)
		{
			DOTween.Kill(wispPathUnderlayPolyline);
		}
		float targetThickness = Mathf.Max(1f, GetRenderedWispPathWidth());
		float startThickness = Mathf.Max(0.75f, targetThickness * 0.9f);
		wispPathPolyline.Thickness = startThickness;
		if (wispPathUnderlayPolyline != null)
		{
			wispPathUnderlayPolyline.Thickness = startThickness * 1.18f;
		}

		float dur = 0.12f;
		float t = 0f;
		DOTween.To(() => t, v =>
		{
			t = v;
			if (wispPathPolyline != null)
			{
				wispPathPolyline.Thickness = Mathf.Lerp(startThickness, targetThickness, t);
			}
			if (wispPathUnderlayPolyline != null)
			{
				wispPathUnderlayPolyline.Thickness = Mathf.Lerp(startThickness, targetThickness, t) * 1.18f;
			}

			// Keep endpoint caps matched to thickness during the spawn settle.
			if (wispPathStartCapDisc != null)
			{
				wispPathStartCapDisc.Radius = Mathf.Max(0.5f, Mathf.Lerp(startThickness, targetThickness, t) * 0.5f);
			}
			if (wispPathEndCapDisc != null)
			{
				wispPathEndCapDisc.Radius = Mathf.Max(0.5f, Mathf.Lerp(startThickness, targetThickness, t) * 0.5f);
			}
		}, 1f, dur).SetEase(Ease.OutCubic).SetUpdate(true).SetTarget(wispPathPolyline);

		void AnimateCap(Disc disc, RectTransform rect)
		{
			if (disc == null || rect == null || !disc.gameObject.activeSelf)
			{
				return;
			}

			rect.DOKill();
			DOTween.Kill(disc);
			rect.localScale = Vector3.one * 0.94f;
			rect.DOScale(1f, dur).SetEase(Ease.OutBack, 0.8f).SetUpdate(true);

			Color baseColor = disc.Color;
			Color from = baseColor;
			from.a = Mathf.Clamp01(baseColor.a * 0.72f);
			disc.Color = from;
			DOTween.To(() => from, v =>
			{
				from = v;
				if (disc != null)
				{
					disc.Color = v;
				}
			}, baseColor, dur).SetEase(Ease.OutQuad).SetUpdate(true).SetTarget(disc);
		}

		AnimateCap(wispPathStartCapDisc, wispPathStartCapRect);
		AnimateCap(wispPathEndCapDisc, wispPathEndCapRect);
	}

	private void ClearWispPathPolylineVisuals()
	{
		if (wispPathPolyline == null)
		{
			return;
		}

		DOTween.Kill(wispPathPolyline);
		if (wispPathUnderlayPolyline != null)
		{
			DOTween.Kill(wispPathUnderlayPolyline);
			wispPathUnderlayPolyline.points.Clear();
			wispPathUnderlayPolyline.meshOutOfDate = true;
			wispPathUnderlayPolyline.gameObject.SetActive(false);
		}
		wispPathPolyline.points.Clear();
		wispPathPolyline.meshOutOfDate = true;
		wispPathPolyline.gameObject.SetActive(false);
		if (wispPathStartCapRect != null) wispPathStartCapRect.DOKill();
		if (wispPathEndCapRect != null) wispPathEndCapRect.DOKill();
		if (wispPathStartCapDisc != null)
		{
			DOTween.Kill(wispPathStartCapDisc);
			wispPathStartCapDisc.gameObject.SetActive(false);
		}
		if (wispPathEndCapDisc != null)
		{
			DOTween.Kill(wispPathEndCapDisc);
			wispPathEndCapDisc.gameObject.SetActive(false);
		}
	}
}
