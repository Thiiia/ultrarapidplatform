using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private Sprite GetWispArcSpriteForBucket(WispPathUnitBucket bucket)
	{
		switch (bucket)
		{
			case WispPathUnitBucket.Units2: return wispArcSpriteUnits2;
			case WispPathUnitBucket.Units4: return wispArcSpriteUnits4;
			case WispPathUnitBucket.Units6: return wispArcSpriteUnits6;
			default:
				if (wispArcSpriteUnits4 != null) return wispArcSpriteUnits4;
				if (wispArcSpriteUnits2 != null) return wispArcSpriteUnits2;
				return wispArcSpriteUnits6;
		}
	}

	private float GetCanonicalPlaceholderArcHorizontalInsetRatio(WispPathUnitBucket bucket)
	{
		// Figma placeholder path nodes (2397:1569 / 1642 / 1654) render the exported PNGs
		// inside a clipped frame with horizontal overscan. Reproduce that crop in Unity instead
		// of squeezing the whole PNG into the visible arc frame.
		switch (bucket)
		{
			case WispPathUnitBucket.Units2:
				return 0.3012f;
			case WispPathUnitBucket.Units4:
				return 0.1527f;
			case WispPathUnitBucket.Units6:
				return 0.1016f;
			default:
				return 0.1527f;
		}
	}

	private float GetCanonicalPlaceholderArcVerticalInsetRatio()
	{
		// Same across the Figma placeholder path vectors.
		return 0.3275f;
	}

	private Vector2 GetCanonicalPlaceholderVisibleFrameSizeFromSprite(Sprite sprite, WispPathUnitBucket bucket)
	{
		if (sprite == null)
		{
			return Vector2.one;
		}

		float hInsetRatio = GetCanonicalPlaceholderArcHorizontalInsetRatio(bucket);
		float vInsetRatio = GetCanonicalPlaceholderArcVerticalInsetRatio();
		Rect r = sprite.rect;
		float visibleW = r.width / Mathf.Max(0.0001f, 1f + (hInsetRatio * 2f));
		float visibleH = r.height / Mathf.Max(0.0001f, 1f + (vInsetRatio * 2f));
		return new Vector2(Mathf.Max(1f, visibleW), Mathf.Max(1f, visibleH));
	}

	private void GetCanonicalPlaceholderEndpointAnchorInsetsRuntime(
		WispPathUnitBucket bucket,
		float visibleFrameWidth,
		out float leftInset,
		out float rightInset)
	{
		float frameWidth = Mathf.Max(1f, visibleFrameWidth);
		// Canonical placeholder mode renders the overscanned path art without clipping, so endpoint anchors
		// should be derived from the sampled sprite centerline, not a positive inset inside the visible frame.
		float hInsetRatio = GetCanonicalPlaceholderArcHorizontalInsetRatio(bucket);
		float artWidth = frameWidth * (1f + (hInsetRatio * 2f));
		float hInsetPx = frameWidth * hInsetRatio;
		Vector2[] samples = GetCanonicalPlaceholderSpriteUvPathSamples(bucket);
		float leftUvX = 0f;
		float rightUvX = 1f;
		if (samples != null && samples.Length >= 2)
		{
			leftUvX = samples[0].x;
			rightUvX = samples[samples.Length - 1].x;
		}

		float baseLeftInset = (leftUvX * artWidth) - hInsetPx;
		float baseRightInset = frameWidth - ((rightUvX * artWidth) - hInsetPx);

		// These trims are intentionally small and bucket-specific. They let us:
		// - nudge 4-unit starts a bit inward (e.g. X+8, +4)
		// - reduce over-inset on wider spans like 2X -> 28 (6-unit bucket)
		// - apply screenshot-driven micro-tuning on top of the sprite-derived anchor baseline
		float leftTrimRefPx = 0f;
		float rightTrimRefPx = 0f;
		float refScale = GetWispGeometryReferenceBubbleSize() / Mathf.Max(1f, 134f);
		switch (bucket)
		{
			case WispPathUnitBucket.Units2:
				leftTrimRefPx = 2f;
				rightTrimRefPx = 1f;
				break;
			case WispPathUnitBucket.Units4:
				leftTrimRefPx = 6f;
				rightTrimRefPx = 7f;
				break;
			case WispPathUnitBucket.Units6:
				leftTrimRefPx = -8f;
				rightTrimRefPx = -8f;
				break;
		}

		leftInset = Mathf.Clamp(baseLeftInset + (leftTrimRefPx * refScale), -frameWidth, frameWidth * 0.49f);
		rightInset = Mathf.Clamp(baseRightInset + (rightTrimRefPx * refScale), -frameWidth, frameWidth * 0.49f);
	}

	private float GetCanonicalPlaceholderVisualEndpointAnchorYOffsetRuntime(
		WispPathUnitBucket bucket,
		float visibleFrameHeight)
	{
		// Anchor the visible placeholder endpoint baseline from the sampled sprite centerline (not a fixed
		// bucket tweak), then apply a tiny bucket-specific trim to match the current art exports.
		float frameHeight = Mathf.Max(1f, visibleFrameHeight);
		float vInsetRatio = GetCanonicalPlaceholderArcVerticalInsetRatio();
		float artHeight = frameHeight * (1f + (vInsetRatio * 2f));
		float vInsetPx = frameHeight * vInsetRatio;
		Vector2[] samples = GetCanonicalPlaceholderSpriteUvPathSamples(bucket);
		float endpointUvY = 0f;
		if (samples != null && samples.Length >= 2)
		{
			endpointUvY = (samples[0].y + samples[samples.Length - 1].y) * 0.5f;
		}
		float baseYOffset = (endpointUvY * artHeight) - vInsetPx;

		float refScale = GetWispGeometryReferenceBubbleSize() / Mathf.Max(1f, 134f);
		float yTrimRefPx = 0f;
		switch (bucket)
		{
			case WispPathUnitBucket.Units4:
				yTrimRefPx = 1f;
				break;
			case WispPathUnitBucket.Units6:
				yTrimRefPx = 1f;
				break;
			default:
				yTrimRefPx = 0f;
				break;
		}
		return baseYOffset + (yTrimRefPx * refScale);
	}

	// Asset-derived centerline samples (top-down sprite UVs) extracted from the actual placeholder PNGs.
	// These drive the runtime path so moving target + overlap scoring follow the shown sprite path.
	private static readonly Vector2[] canonicalPlaceholderSpriteUvPathUnits2 = new Vector2[]
	{
		new Vector2(0.000000f, 0.343915f),
		new Vector2(0.032988f, 0.343915f),
		new Vector2(0.065976f, 0.343915f),
		new Vector2(0.098964f, 0.343915f),
		new Vector2(0.131952f, 0.343915f),
		new Vector2(0.159736f, 0.353769f),
		new Vector2(0.168743f, 0.386978f),
		new Vector2(0.175122f, 0.420346f),
		new Vector2(0.180139f, 0.454673f),
		new Vector2(0.183401f, 0.489230f),
		new Vector2(0.192241f, 0.522644f),
		new Vector2(0.200395f, 0.556273f),
		new Vector2(0.210063f, 0.589458f),
		new Vector2(0.224827f, 0.620222f),
		new Vector2(0.240245f, 0.650402f),
		new Vector2(0.257370f, 0.679540f),
		new Vector2(0.278408f, 0.705837f),
		new Vector2(0.302868f, 0.727513f),
		new Vector2(0.328571f, 0.746032f),
		new Vector2(0.355745f, 0.760811f),
		new Vector2(0.382751f, 0.776018f),
		new Vector2(0.411925f, 0.785714f),
		new Vector2(0.441790f, 0.793651f),
		new Vector2(0.471127f, 0.802933f),
		new Vector2(0.501522f, 0.809524f),
		new Vector2(0.531388f, 0.801587f),
		new Vector2(0.561254f, 0.793651f),
		new Vector2(0.591120f, 0.785714f),
		new Vector2(0.619945f, 0.775132f),
		new Vector2(0.646689f, 0.759259f),
		new Vector2(0.673432f, 0.743386f),
		new Vector2(0.699683f, 0.726260f),
		new Vector2(0.723745f, 0.703570f),
		new Vector2(0.744915f, 0.677374f),
		new Vector2(0.761515f, 0.647709f),
		new Vector2(0.777191f, 0.617343f),
		new Vector2(0.791065f, 0.585894f),
		new Vector2(0.801454f, 0.553023f),
		new Vector2(0.809333f, 0.519345f),
		new Vector2(0.815854f, 0.485317f),
		new Vector2(0.822756f, 0.451400f),
		new Vector2(0.828112f, 0.417205f),
		new Vector2(0.831870f, 0.382705f),
		new Vector2(0.842756f, 0.350084f),
		new Vector2(0.871170f, 0.343915f),
		new Vector2(0.902076f, 0.343915f),
		new Vector2(0.935065f, 0.343915f),
		new Vector2(0.967012f, 0.341270f),
		new Vector2(1.000000f, 0.341270f),
	};

	private static readonly Vector2[] canonicalPlaceholderSpriteUvPathUnits4 = new Vector2[]
	{
		new Vector2(0.000000f, 0.211640f),
		new Vector2(0.029692f, 0.211640f),
		new Vector2(0.059384f, 0.211640f),
		new Vector2(0.089075f, 0.211640f),
		new Vector2(0.114077f, 0.224916f),
		new Vector2(0.119334f, 0.274115f),
		new Vector2(0.125096f, 0.323400f),
		new Vector2(0.133090f, 0.371779f),
		new Vector2(0.142576f, 0.419305f),
		new Vector2(0.155207f, 0.464723f),
		new Vector2(0.169060f, 0.508987f),
		new Vector2(0.184636f, 0.551148f),
		new Vector2(0.202151f, 0.590943f),
		new Vector2(0.222238f, 0.627599f),
		new Vector2(0.243691f, 0.661276f),
		new Vector2(0.266517f, 0.689341f),
		new Vector2(0.290106f, 0.714286f),
		new Vector2(0.314457f, 0.736117f),
		new Vector2(0.339134f, 0.756614f),
		new Vector2(0.365143f, 0.771670f),
		new Vector2(0.391630f, 0.784770f),
		new Vector2(0.418502f, 0.796296f),
		new Vector2(0.446899f, 0.801587f),
		new Vector2(0.474002f, 0.812169f),
		new Vector2(0.501752f, 0.820106f),
		new Vector2(0.529502f, 0.812169f),
		new Vector2(0.556605f, 0.801587f),
		new Vector2(0.584355f, 0.793651f),
		new Vector2(0.611458f, 0.783069f),
		new Vector2(0.637914f, 0.769841f),
		new Vector2(0.663723f, 0.753968f),
		new Vector2(0.688479f, 0.733793f),
		new Vector2(0.712751f, 0.711640f),
		new Vector2(0.735971f, 0.685185f),
		new Vector2(0.758787f, 0.657080f),
		new Vector2(0.780240f, 0.623403f),
		new Vector2(0.800207f, 0.586601f),
		new Vector2(0.817505f, 0.546542f),
		new Vector2(0.833081f, 0.504381f),
		new Vector2(0.846360f, 0.459417f),
		new Vector2(0.858594f, 0.414018f),
		new Vector2(0.867967f, 0.366413f),
		new Vector2(0.875450f, 0.317822f),
		new Vector2(0.880818f, 0.268486f),
		new Vector2(0.885483f, 0.218900f),
		new Vector2(0.912219f, 0.211640f),
		new Vector2(0.941264f, 0.208995f),
		new Vector2(0.970308f, 0.211640f),
		new Vector2(1.000000f, 0.211640f),
	};

	private static readonly Vector2[] canonicalPlaceholderSpriteUvPathUnits6 = new Vector2[]
	{
		new Vector2(0.000000f, 0.211640f),
		new Vector2(0.028502f, 0.211640f),
		new Vector2(0.057003f, 0.211640f),
		new Vector2(0.082247f, 0.224497f),
		new Vector2(0.086998f, 0.290131f),
		new Vector2(0.093843f, 0.354374f),
		new Vector2(0.102578f, 0.417918f),
		new Vector2(0.114857f, 0.478193f),
		new Vector2(0.128847f, 0.535910f),
		new Vector2(0.145257f, 0.589533f),
		new Vector2(0.164756f, 0.637933f),
		new Vector2(0.185900f, 0.679613f),
		new Vector2(0.208366f, 0.713810f),
		new Vector2(0.231821f, 0.742396f),
		new Vector2(0.256268f, 0.765369f),
		new Vector2(0.281645f, 0.783069f),
		new Vector2(0.307802f, 0.796351f),
		new Vector2(0.333979f, 0.809524f),
		new Vector2(0.360612f, 0.820106f),
		new Vector2(0.386779f, 0.833333f),
		new Vector2(0.409210f, 0.867725f),
		new Vector2(0.431025f, 0.905606f),
		new Vector2(0.453160f, 0.941674f),
		new Vector2(0.475102f, 0.978836f),
		new Vector2(0.499868f, 1.000000f),
		new Vector2(0.524518f, 0.978181f),
		new Vector2(0.546323f, 0.940243f),
		new Vector2(0.568458f, 0.904175f),
		new Vector2(0.590262f, 0.866236f),
		new Vector2(0.612956f, 0.833333f),
		new Vector2(0.639123f, 0.820106f),
		new Vector2(0.665583f, 0.808539f),
		new Vector2(0.691924f, 0.796296f),
		new Vector2(0.718108f, 0.783170f),
		new Vector2(0.743545f, 0.765808f),
		new Vector2(0.767992f, 0.742835f),
		new Vector2(0.791447f, 0.714249f),
		new Vector2(0.813885f, 0.679894f),
		new Vector2(0.834727f, 0.636501f),
		new Vector2(0.854555f, 0.589972f),
		new Vector2(0.871035f, 0.536466f),
		new Vector2(0.885024f, 0.478748f),
		new Vector2(0.897304f, 0.418474f),
		new Vector2(0.906582f, 0.355316f),
		new Vector2(0.912697f, 0.290023f),
		new Vector2(0.917753f, 0.224497f),
		new Vector2(0.942997f, 0.211640f),
		new Vector2(0.971498f, 0.211640f),
		new Vector2(1.000000f, 0.211640f),
	};

	private Vector2[] GetCanonicalPlaceholderSpriteUvPathSamples(WispPathUnitBucket bucket)
	{
		switch (bucket)
		{
			case WispPathUnitBucket.Units2:
				return canonicalPlaceholderSpriteUvPathUnits2;
			case WispPathUnitBucket.Units6:
				return canonicalPlaceholderSpriteUvPathUnits6;
			case WispPathUnitBucket.Units4:
			default:
				return canonicalPlaceholderSpriteUvPathUnits4;
		}
	}

	private static Vector2 ConvertTopDownSpriteUvToRectLocal(RectTransform rect, Vector2 uvTopDown)
	{
		if (rect == null)
		{
			return Vector2.zero;
		}

		Rect r = rect.rect;
		float localX = (uvTopDown.x - rect.pivot.x) * r.width;
		float localY = ((1f - uvTopDown.y) - rect.pivot.y) * r.height;
		return new Vector2(localX, localY);
	}

	private void RebuildCanonicalPlaceholderRuntimePathFromRenderedSprite(
		WispPathUnitBucket bucket,
		RectTransform artRect,
		Vector2 srcAnchor,
		Vector2 dstAnchor)
	{
		Vector2[] template = GetCanonicalPlaceholderSpriteUvPathSamples(bucket);
		RectTransform pathContainerRect = wispPathContainer as RectTransform;
		if (template == null || template.Length < 2 || artRect == null || pathContainerRect == null)
		{
			currentWispPath.Clear();
			currentWispPath.Add(srcAnchor);
			currentWispPath.Add(dstAnchor);
			return;
		}

		currentWispPath.Clear();
		for (int i = 0; i < template.Length; i++)
		{
			Vector2 local = ConvertTopDownSpriteUvToRectLocal(artRect, template[i]);
			Vector3 world = artRect.TransformPoint(new Vector3(local.x, local.y, 0f));
			Vector2 p = pathContainerRect.InverseTransformPoint(world);
			if (currentWispPath.Count > 0 && Vector2.Distance(currentWispPath[currentWispPath.Count - 1], p) <= 0.01f)
			{
				continue;
			}

			currentWispPath.Add(p);
		}

		if (currentWispPath.Count > 0)
		{
			currentWispPath[0] = srcAnchor;
			currentWispPath[currentWispPath.Count - 1] = dstAnchor;
		}
	}

	private void RenderCurrentDotPathWithTimingMarkers()
	{
		float greenStart = wispTimingPrepared ? wispGreenZoneStartRuntime : greenZoneStart;
		float greenEnd = wispTimingPrepared ? wispGreenZoneEndRuntime : greenZoneEnd;
		float perfectStart = wispTimingPrepared ? wispPerfectZoneStartRuntime : perfectZoneStart;

		RenderWispPathAsShapesPolyline(greenStart, greenEnd, perfectStart);
		if (!ShouldRenderWispTimingMarkers())
		{
			return;
		}

		float pathWidth = GetRenderedWispPathWidth();
		AddWispTimingTickMarker(greenStart, pathWidth, greenZoneColor, 9901);
		AddWispTimingTickMarker(perfectStart, pathWidth, GetPerfectZoneColor(), 9902);
		AddWispTimingTickMarker(greenEnd, pathWidth, Color.white, 9903);
	}

	private bool TryResolveDotRuntimeEndpoints(
		Vector2 startPos,
		Vector2 endPos,
		out Vector2 srcPos,
		out Vector2 dstPos,
		out EquationBubbleElement srcBubble,
		out EquationBubbleElement dstBubble)
	{
		srcPos = startPos;
		dstPos = endPos;
		if (!TryGetActiveWispVisualEndpoints(out srcPos, out dstPos) &&
			!TryGetActiveWispEndpoints(out srcPos, out dstPos))
		{
			EquationBubbleElement srcBubbleFallback = GetActiveWispSourceElement();
			EquationBubbleElement dstBubbleFallback = GetActiveWispDestinationElement();
			srcPos = srcBubbleFallback != null ? srcBubbleFallback.CurrentPathAnchorPosition : startPos;
			dstPos = dstBubbleFallback != null ? dstBubbleFallback.CurrentPathAnchorPosition : endPos;
		}

		srcBubble = GetActiveWispSourceElement();
		dstBubble = GetActiveWispDestinationElement();
		return true;
	}

	private bool ResolvePlannedDotRuntimeBendDown(Vector2 startPos, Vector2 endPos)
	{
		if (ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			return currentWispPathUnitFlipY;
		}

		if (TryGetPreparedResolvedWispWindowState(out WispWindowState resolvedWindowState))
		{
			if (resolvedWindowState.pathHemisphere == EquationPathHemisphere.Upper)
			{
				return false;
			}

			if (resolvedWindowState.pathHemisphere == EquationPathHemisphere.Lower)
			{
				return true;
			}

			return ResolveCanonicalTemplateBendDown(resolvedWindowState.pathStyle, startPos, endPos);
		}

		// Equation placement already classified the chosen preview path. Reuse that hemisphere so
		// the runtime dot path bends the same way the row-motion/scoring systems planned around.
		if (activeEquationPathHemisphere == EquationPathHemisphere.Upper)
		{
			return false;
		}

		if (activeEquationPathHemisphere == EquationPathHemisphere.Lower)
		{
			return true;
		}

		return ResolveCanonicalTemplateBendDown(currentWispPathStyle, startPos, endPos);
	}

	private bool TryBuildDotRuntimePathCandidate(
		Vector2 srcPos,
		Vector2 dstPos,
		EquationBubbleElement srcBubble,
		EquationBubbleElement dstBubble,
		bool bendDown,
		List<Vector2> destination,
		bool applyRuntimeEndpointSeating,
		bool captureDebugSnapshot,
		out Vector2 curveStart,
		out Vector2 curveEnd)
	{
		curveStart = srcPos;
		curveEnd = dstPos;
		if (destination == null)
		{
			return false;
		}

		destination.Clear();

		Vector2 chord = dstPos - srcPos;
		float chordDistance = chord.magnitude;
		float startEndpointSeat = 0f;
		float endEndpointSeat = 0f;
		if (chordDistance > 0.001f)
		{
			Vector2 dir = chord / chordDistance;
			bool renderInFront = !wispRenderBehindEquationBubbles;
			if (renderInFront)
			{
				float edgeBias = Mathf.Clamp01(wispDotPathEndpointEdgeBias);
				float startRadius = Mathf.Max(0f, GetEquationBubbleVisualRadius(srcBubble));
				float endRadius = Mathf.Max(0f, GetEquationBubbleVisualRadius(dstBubble));
				float maxSeat = chordDistance * 0.1f;
				startEndpointSeat = Mathf.Min(maxSeat, startRadius * Mathf.Lerp(0.08f, 0.28f, edgeBias));
				endEndpointSeat = Mathf.Min(maxSeat, endRadius * Mathf.Lerp(0.08f, 0.28f, edgeBias));
				curveStart -= dir * startEndpointSeat;
				curveEnd += dir * endEndpointSeat;
			}
		}

		if (applyRuntimeEndpointSeating)
		{
			SetWispRuntimeEndpointSeating(startEndpointSeat, endEndpointSeat);
		}

		float baselineY = bendDown ? Mathf.Max(curveStart.y, curveEnd.y) : Mathf.Min(curveStart.y, curveEnd.y);
		float sagScale = Mathf.Clamp(wispDotPathSagMultiplier, 0.25f, 6f);
		float arcH = GetWispArcHeight(curveStart, curveEnd) * sagScale;
		float minArcByThickness = Mathf.Max(GetRenderedWispPathWidth() * Mathf.Clamp(wispDotPathMinDipWidthMultiplier, 1f, 3f), 4f);
		arcH = Mathf.Max(arcH, minArcByThickness);
		if (wispDotStrictClampDipToPlayfield && TryGetWispPathPlayfieldSafeRect(out Rect safeRect, out _))
		{
			float allowedArc = bendDown
				? (baselineY - safeRect.yMin)
				: (safeRect.yMax - baselineY);
			if (allowedArc > 0.001f)
			{
				arcH = Mathf.Min(arcH, Mathf.Max(1f, allowedArc));
			}
		}

		Vector2 baselineStart = new Vector2(curveStart.x, baselineY);
		Vector2 baselineEnd = new Vector2(curveEnd.x, baselineY);
		Vector2 chordVec = baselineEnd - baselineStart;
		float span = Mathf.Max(0.001f, chordVec.magnitude);
		Vector2 tangent = chordVec.sqrMagnitude > 0.0001f
			? (chordVec / span)
			: (chordDistance > 0.001f ? (chord / chordDistance) : Vector2.right);
		Vector2 bendNormal = new Vector2(tangent.y, -tangent.x);
		if (bendNormal.sqrMagnitude <= 0.0001f)
		{
			bendNormal = bendDown ? Vector2.down : Vector2.up;
		}
		else if ((bendDown && bendNormal.y > 0f) || (!bendDown && bendNormal.y < 0f))
		{
			bendNormal = -bendNormal;
		}

		float cShapeStrength = Mathf.InverseLerp(1f, 3.75f, sagScale);
		float handleInset = span * Mathf.Lerp(0.07f, 0.012f, cShapeStrength);
		handleInset = Mathf.Clamp(handleInset, 0f, span * 0.36f);
		float handleDepth = arcH * Mathf.Lerp(1.06f, 1.48f, cShapeStrength);
		Vector2 controlA = curveStart + (tangent * handleInset) + (bendNormal * handleDepth);
		Vector2 controlB = curveEnd - (tangent * handleInset) + (bendNormal * handleDepth);
		int segments = Mathf.Clamp(GetAdaptiveWispPathSegmentCount(curveStart, curveEnd) * 4, 72, 480);

		PopulateWispBezierPoints(curveStart, controlA, controlB, curveEnd, segments, destination);
		if (captureDebugSnapshot)
		{
			wispPathDebugSnapshot.inputPoints = destination.Count;
		}

		float spacingFromWidth = GetRenderedWispPathWidth() * Mathf.Clamp(wispCurvePointSpacingWidthMultiplier, 0.2f, 1.6f);
		float spacing = Mathf.Clamp(spacingFromWidth * 0.36f, 0.85f, 3.2f);
		int pointCap = Mathf.Clamp(Mathf.Max(wispCurveMaxRenderPoints, 360), 260, 900);
		ResamplePathBySpacingInPlace(destination, spacing, pointCap);
		if (captureDebugSnapshot)
		{
			wispPathDebugSnapshot.spacingUsed = spacing;
			wispPathDebugSnapshot.pointCapUsed = pointCap;
			wispPathDebugSnapshot.postResamplePoints = destination.Count;
		}

		ClampWispPathPointsToReferenceCeiling(destination, curveStart, curveEnd);
		ClampWispPathPointsToPlayfieldBounds(destination, curveStart, curveEnd);
		RefineWispEndpointShouldersInPlace(destination, curveStart, curveEnd);
		ClampWispPathPointsToReferenceCeiling(destination, curveStart, curveEnd);
		ClampWispPathPointsToPlayfieldBounds(destination, curveStart, curveEnd);

		if (destination.Count >= 4)
		{
			ApplyCornerRoundingInPlace(destination);
			float finishSpacing = Mathf.Clamp(spacing * 0.55f, 0.6f, 1.8f);
			int finishPointCap = Mathf.Clamp(pointCap + 260, 420, 1200);
			ResamplePathBySpacingInPlace(destination, finishSpacing, finishPointCap);
			ClampWispPathPointsToReferenceCeiling(destination, curveStart, curveEnd);
			ClampWispPathPointsToPlayfieldBounds(destination, curveStart, curveEnd);
		}

		LockWispPathEndpoints(destination, curveStart, curveEnd);
		return destination.Count >= 2;
	}

	private float ScoreDotRuntimeBendCandidate(
		Vector2 srcPos,
		Vector2 dstPos,
		EquationBubbleElement srcBubble,
		EquationBubbleElement dstBubble,
		bool bendDown)
	{
		if (!TryBuildDotRuntimePathCandidate(
			srcPos,
			dstPos,
			srcBubble,
			dstBubble,
			bendDown,
			wispPathProbePoints,
			applyRuntimeEndpointSeating: false,
			captureDebugSnapshot: false,
			out Vector2 curveStart,
			out Vector2 curveEnd))
		{
			return float.MaxValue;
		}

		float score = ScoreWispPathReadability(wispPathProbePoints, curveStart, curveEnd);
		float topSqueeze01 = GetWispTopSqueeze01(curveStart, curveEnd);
		float topBiasWeight = GetEffectiveWispTopBiasWeight();
		if (topSqueeze01 > 0.001f && topBiasWeight > 0f)
		{
			float upperPenalty = ScoreWispUpperClearancePenalty(wispPathProbePoints, curveStart, curveEnd);
			score += upperPenalty * topSqueeze01 * topBiasWeight;
			score += bendDown
				? (-0.05f * topSqueeze01 * topBiasWeight)
				: (0.08f * topSqueeze01 * topBiasWeight);
		}

		return score;
	}

	private bool ResolveDotRuntimeBendDown(Vector2 startPos, Vector2 endPos)
	{
		bool plannedBendDown = ResolvePlannedDotRuntimeBendDown(startPos, endPos);
		if (ShouldForceCanonicalPathForPlaceholderArcSprites())
		{
			return plannedBendDown;
		}

		if (!TryResolveDotRuntimeEndpoints(startPos, endPos, out Vector2 srcPos, out Vector2 dstPos, out EquationBubbleElement srcBubble, out EquationBubbleElement dstBubble))
		{
			return plannedBendDown;
		}

		float plannedScore = ScoreDotRuntimeBendCandidate(srcPos, dstPos, srcBubble, dstBubble, plannedBendDown);
		float alternateScore = ScoreDotRuntimeBendCandidate(srcPos, dstPos, srcBubble, dstBubble, !plannedBendDown);
		bool plannedFinite = !(float.IsNaN(plannedScore) || float.IsInfinity(plannedScore));
		bool alternateFinite = !(float.IsNaN(alternateScore) || float.IsInfinity(alternateScore));
		if (!plannedFinite)
		{
			return !alternateFinite ? plannedBendDown : !plannedBendDown;
		}

		if (!alternateFinite)
		{
			return plannedBendDown;
		}

		float improvement = plannedScore - alternateScore;
		bool plannedLooksBad = plannedScore >= 0.58f;
		bool alternateClearlyBetter = improvement > 0.08f || (plannedLooksBad && improvement > 0.025f);
		return alternateClearlyBetter ? !plannedBendDown : plannedBendDown;
	}

	private void RebuildWispPathSymmetricForDotSprite(Vector2 startPos, Vector2 endPos)
	{
		currentWispPathRuntimeMode = WispPathRuntimeMode.AdaptiveDot;
		wispPathDebugSnapshot.mode = currentWispPathRuntimeMode;
		if (!TryResolveDotRuntimeEndpoints(startPos, endPos, out Vector2 srcPos, out Vector2 dstPos, out EquationBubbleElement srcBubble, out EquationBubbleElement dstBubble))
		{
			currentWispPath.Clear();
			return;
		}

		bool bendDown = ResolveDotRuntimeBendDown(srcPos, dstPos);
		if (!TryBuildDotRuntimePathCandidate(
			srcPos,
			dstPos,
			srcBubble,
			dstBubble,
			bendDown,
			currentWispPath,
			applyRuntimeEndpointSeating: true,
			captureDebugSnapshot: true,
			out _,
			out _))
		{
			currentWispPath.Clear();
			return;
		}

		RenderCurrentDotPathWithTimingMarkers();
	}

	private void RefreshWispArcSprites(Vector2 startPos, Vector2 endPos)
	{
		if (ShouldUseProceduralGameplayPathForCanonicalPlaceholder())
		{
			// Hybrid mode: keep placeholder-influenced bucket/orientation/height selection, but let the
			// procedural symmetric runtime path be the authoritative gameplay path during active drags.
			RebuildWispPathSymmetricForDotSprite(startPos, endPos);
			return;
		}

		if (wispDotSprite != null)
		{
			// Dot-sprite mode: rebuild currentWispPath as a symmetric catenary and re-render the polyline.
			RebuildWispPathSymmetricForDotSprite(startPos, endPos);
			return;
		}

		if (!ShouldUseWispArcSpriteForCurrentPath())
		{
			return;
		}

		Sprite arcSprite = GetWispArcSpriteForBucket(currentWispPathUnitBucket);
		if (arcSprite == null || wispPathContainer == null)
			return;

		// Path placeholder sprites should drive the visible proportions. We use a lightweight
		// frame transform (no clipping) for alignment and render the overscanned imported art
		// relative to that frame so the sprite shape stays intact.
		if (wispArcFrameRect == null || wispArcLeftArm == null || wispArcLeftArm.transform.parent != wispArcFrameRect)
		{
			if (wispArcLeftArm != null)
			{
				Destroy(wispArcLeftArm.gameObject);
				wispArcLeftArm = null;
			}
			if (wispArcFrameRect != null)
			{
				Destroy(wispArcFrameRect.gameObject);
				wispArcFrameRect = null;
			}

			GameObject frameGo = new GameObject("WispArcPathFrame", typeof(RectTransform));
			frameGo.transform.SetParent(wispPathContainer, false);
			wispArcFrameRect = frameGo.GetComponent<RectTransform>();

			GameObject go = new GameObject("WispArcPath", typeof(RectTransform), typeof(Image));
			go.transform.SetParent(wispArcFrameRect, false);
			wispArcLeftArm = go.GetComponent<Image>();
			wispArcLeftArm.raycastTarget = false;
			wispPathImages.Add(wispArcLeftArm);
		}

		wispArcLeftArm.sprite = arcSprite;
		wispArcLeftArm.color  = Color.white;

		float pathWidth = Mathf.Max(1f, GetRenderedWispPathWidth());
		float endpointPad = Mathf.Max(2f, pathWidth * 0.45f);

		// For sprite placement, anchor to the active source/destination visual centres so the
		// visible path ends sit on both zones. Bucket/travel-step math may use logical anchors,
		// but the rendered path and moving target should land on the real visible targets.
		EquationBubbleElement srcBubble = GetActiveWispSourceElement();
		EquationBubbleElement dstBubble = GetActiveWispDestinationElement();
		Vector2 srcAnchor = startPos;
		Vector2 dstAnchor = endPos;
		if (!TryGetActiveWispEndpoints(out srcAnchor, out dstAnchor))
		{
			srcAnchor = srcBubble != null ? srcBubble.OriginalPosition : startPos;
			dstAnchor = dstBubble != null ? dstBubble.OriginalPosition : endPos;
		}

		float ResolveSpriteEndReach(EquationBubbleElement bubble)
		{
			if (bubble == null)
			{
				return endpointPad;
			}

			float bubbleRadius = Mathf.Max(endpointPad, GetEquationBubbleVisualRadius(bubble));
			// Full bubble-radius extension makes the baked sprite caps balloon on wider paths.
			// Blend + clamp the reach so the ends still sit on the zones without huge caps.
			float blended = Mathf.Lerp(endpointPad, bubbleRadius, 0.42f);
			float maxReach = Mathf.Max(endpointPad, pathWidth * 1.15f);
			return Mathf.Clamp(blended, endpointPad, maxReach);
		}

		float srcRadius = ResolveSpriteEndReach(srcBubble);
		float dstRadius = ResolveSpriteEndReach(dstBubble);
		bool useCanonicalPlaceholderSpan = ShouldForceCanonicalPathForPlaceholderArcSprites();

		float leftX;
		float rightX;
		if (useCanonicalPlaceholderSpan)
		{
			// Figma placeholder vectors are authored to the endpoint centre span (not centre + radius).
			// Extending by bubble radius here stretches the visible end caps near the bubbles.
			if (srcAnchor.x <= dstAnchor.x)
			{
				leftX = srcAnchor.x;
				rightX = dstAnchor.x;
			}
			else
			{
				leftX = dstAnchor.x;
				rightX = srcAnchor.x;
			}
		}
		else if (srcAnchor.x <= dstAnchor.x)
		{
			leftX = srcAnchor.x - srcRadius;
			rightX = dstAnchor.x + dstRadius;
		}
		else
		{
			leftX = dstAnchor.x - dstRadius;
			rightX = srcAnchor.x + srcRadius;
		}

		float spanWidth = Mathf.Max(1f, rightX - leftX);
		float topY = Mathf.Max(srcAnchor.y, dstAnchor.y);

		float hInsetRatio = 0f;
		float vInsetRatio = 0f;
		float endpointAnchorInsetLeft = 0f;
		float endpointAnchorInsetRight = 0f;
		float arcH;
		if (useCanonicalPlaceholderSpan)
		{
			// Bigger placeholder pass: derive height from the imported template asset itself
			// (via Figma frame overscan metadata) so we preserve the path proportions instead
			// of independently ratio-scaling width and height at runtime.
			hInsetRatio = GetCanonicalPlaceholderArcHorizontalInsetRatio(currentWispPathUnitBucket);
			vInsetRatio = GetCanonicalPlaceholderArcVerticalInsetRatio();
			Vector2 templateVisibleSize = GetCanonicalPlaceholderVisibleFrameSizeFromSprite(arcSprite, currentWispPathUnitBucket);
			float uniformScale = GetWispGeometryReferenceBubbleSize() / Mathf.Max(1f, 134f);
			float canonicalFrameWidth = Mathf.Max(1f, templateVisibleSize.x * uniformScale);
			GetCanonicalPlaceholderEndpointAnchorInsetsRuntime(
				currentWispPathUnitBucket,
				canonicalFrameWidth,
				out endpointAnchorInsetLeft,
				out endpointAnchorInsetRight);
			float expectedFrameLeft = Mathf.Min(srcAnchor.x, dstAnchor.x) - endpointAnchorInsetLeft;
			float expectedFrameRight = Mathf.Max(srcAnchor.x, dstAnchor.x) + endpointAnchorInsetRight;
			float expectedMidX = (expectedFrameLeft + expectedFrameRight) * 0.5f;
			leftX = expectedMidX - (canonicalFrameWidth * 0.5f);
			rightX = expectedMidX + (canonicalFrameWidth * 0.5f);
			spanWidth = canonicalFrameWidth;
			arcH = Mathf.Max(1f, templateVisibleSize.y * uniformScale);
		}
		else
		{
			// Legacy/non-canonical path sprites still use runtime tuning.
			arcH = Mathf.Max(1f, GetWispArcHeight(startPos, endPos));
		}

		// Mirror horizontally when source is to the right of destination.
		bool flipX = dstAnchor.x < srcAnchor.x;
		bool renderFlipY = currentWispPathUnitFlipY;

		// Placeholder sprite visuals have their own placement path and can still exceed the
		// safe play window / top UI ceiling even when runtime path points are clamped. Constrain
		// the sprite's visible arc height (and fall back to non-flipped when needed) so the
		// rendered placeholder stays where the player expects.
		if (TryGetWispPathPlayfieldSafeRect(out Rect safeRect, out _))
		{
			float maxDownArc = Mathf.Max(1f, topY - safeRect.yMin);
			float maxUpArc = Mathf.Max(1f, safeRect.yMax - topY);
			float minReadableArc = Mathf.Max(pathWidth * 1.25f, GetWispGeometryReferenceBubbleSize() * 0.4f);

			if (renderFlipY && maxUpArc < minReadableArc && maxDownArc > (maxUpArc + pathWidth))
			{
				// If there's not enough room above the row, keep the placeholder below it rather
				// than rendering a clipped/stretched upside-down arc near the locked equation.
				renderFlipY = false;
			}

			float allowedArc = renderFlipY ? maxUpArc : maxDownArc;
			arcH = Mathf.Max(1f, Mathf.Min(arcH, allowedArc));
		}

		float frameTopY = topY;
		if (useCanonicalPlaceholderSpan)
		{
			// Placeholder sprite endpoints are defined by the crop edge itself (y inset ~= 0 in the visible frame).
			frameTopY = topY + GetCanonicalPlaceholderVisualEndpointAnchorYOffsetRuntime(currentWispPathUnitBucket, arcH);
		}

		RectTransform frameRt = wispArcFrameRect;
		frameRt.anchorMin = new Vector2(0.5f, 0.5f);
		frameRt.anchorMax = new Vector2(0.5f, 0.5f);
		frameRt.pivot = new Vector2(flipX ? 1f : 0f, renderFlipY ? 0f : 1f);
		frameRt.sizeDelta = new Vector2(spanWidth, arcH);
		frameRt.anchoredPosition = new Vector2(flipX ? rightX : leftX, frameTopY);
		frameRt.localScale = Vector3.one;

		RectTransform artRt = wispArcLeftArm.rectTransform;
		artRt.anchorMin = new Vector2(flipX ? 1f : 0f, renderFlipY ? 0f : 1f);
		artRt.anchorMax = artRt.anchorMin;
		artRt.pivot = artRt.anchorMin;

		if (useCanonicalPlaceholderSpan)
		{
			float hInsetPx = spanWidth * hInsetRatio;
			float vInsetPx = arcH * vInsetRatio;
			artRt.sizeDelta = new Vector2(spanWidth + (hInsetPx * 2f), arcH + (vInsetPx * 2f));
			artRt.anchoredPosition = new Vector2(
				flipX ? hInsetPx : -hInsetPx,
				renderFlipY ? (arcH + vInsetPx) : vInsetPx);
		}
		else
		{
			artRt.sizeDelta = new Vector2(spanWidth, arcH);
			artRt.anchoredPosition = new Vector2(0f, renderFlipY ? arcH : 0f);
		}

		wispArcLeftArm.transform.localScale = new Vector3(flipX ? -1f : 1f, renderFlipY ? -1f : 1f, 1f);

		if (useCanonicalPlaceholderSpan)
		{
			// Deeper pass: drive the runtime path from the same rendered placeholder sprite transform
			// (sampled from the actual Path2/4/6 art) so moving target / overlap scoring follow the shown path.
			RebuildCanonicalPlaceholderRuntimePathFromRenderedSprite(currentWispPathUnitBucket, artRt, srcAnchor, dstAnchor);
			return;
		}

		void MirrorCurrentPathAroundTopEdge(float topEdgeY)
		{
			if (!renderFlipY || currentWispPath == null || currentWispPath.Count <= 0)
			{
				return;
			}

			for (int i = 0; i < currentWispPath.Count; i++)
			{
				Vector2 p = currentWispPath[i];
				p.y = (2f * topEdgeY) - p.y;
				currentWispPath[i] = p;
			}
		}

		// Rebuild the runtime path so the moving target follows the visible U-shaped sprite
		// more closely (vertical legs + rounded bottom) instead of a simple quadratic arc.
		float centerInset = Mathf.Clamp(pathWidth * 0.5f, 2f, arcH * 0.45f);
		float centerTopY = topY - centerInset;
		float centerBottomY = (topY - arcH) + centerInset;
		float xLeft = Mathf.Min(srcAnchor.x, dstAnchor.x);
		float xRight = Mathf.Max(srcAnchor.x, dstAnchor.x);
		float usableWidth = Mathf.Max(0f, xRight - xLeft);
		float usableDepth = Mathf.Max(0f, centerTopY - centerBottomY);

		float cornerR = Mathf.Min(usableWidth * 0.5f, usableDepth * 0.9f);
		if (cornerR <= 0.5f)
		{
			Vector2 arcStart = new Vector2(srcAnchor.x, centerTopY);
			Vector2 arcEnd = new Vector2(dstAnchor.x, centerTopY);
			Vector2 ctrl = new Vector2((arcStart.x + arcEnd.x) * 0.5f, centerBottomY);
			int segments = Mathf.Clamp(wispPathSegments, 8, 80);
			currentWispPath.Clear();
				for (int i = 0; i <= segments; i++)
				{
					float t = i / (float)segments;
					currentWispPath.Add(CalculateQuadraticBezier(t, arcStart, ctrl, arcEnd));
				}
				MirrorCurrentPathAroundTopEdge(topY);
				return;
			}

		void AddPoint(Vector2 p)
		{
			if (currentWispPath.Count > 0 && Vector2.Distance(currentWispPath[currentWispPath.Count - 1], p) <= 0.01f)
			{
				return;
			}

			currentWispPath.Add(p);
		}

		void AddLine(Vector2 a, Vector2 b, int segCount)
		{
			int count = Mathf.Max(1, segCount);
			for (int i = 0; i <= count; i++)
			{
				float t = i / (float)count;
				AddPoint(Vector2.Lerp(a, b, t));
			}
		}

		void AddArc(Vector2 center, float radius, float startDeg, float endDeg, int segCount)
		{
			int count = Mathf.Max(2, segCount);
			for (int i = 0; i <= count; i++)
			{
				float t = i / (float)count;
				float a = Mathf.Lerp(startDeg, endDeg, t) * Mathf.Deg2Rad;
				AddPoint(new Vector2(center.x + Mathf.Cos(a) * radius, center.y + Mathf.Sin(a) * radius));
			}
		}

		int totalSeg = Mathf.Clamp(wispPathSegments, 12, 96);
		int lineSeg = Mathf.Max(2, totalSeg / 6);
		int arcSeg = Mathf.Max(4, totalSeg / 5);
		int bottomSeg = Mathf.Max(4, totalSeg / 4);

		bool sourceIsLeft = srcAnchor.x <= dstAnchor.x;
		float startX = sourceIsLeft ? xLeft : xRight;
		float endX = sourceIsLeft ? xRight : xLeft;
		float yJoin = centerBottomY + cornerR;

		currentWispPath.Clear();
		AddLine(new Vector2(startX, centerTopY), new Vector2(startX, yJoin), lineSeg);

			if (sourceIsLeft)
			{
			AddArc(new Vector2(xLeft + cornerR, yJoin), cornerR, 180f, 270f, arcSeg);
			AddLine(new Vector2(xLeft + cornerR, centerBottomY), new Vector2(xRight - cornerR, centerBottomY), bottomSeg);
			AddArc(new Vector2(xRight - cornerR, yJoin), cornerR, 270f, 360f, arcSeg);
		}
		else
		{
			AddArc(new Vector2(xRight - cornerR, yJoin), cornerR, 0f, -90f, arcSeg);
			AddLine(new Vector2(xRight - cornerR, centerBottomY), new Vector2(xLeft + cornerR, centerBottomY), bottomSeg);
			AddArc(new Vector2(xLeft + cornerR, yJoin), cornerR, 270f, 180f, arcSeg);
			}

			AddLine(new Vector2(endX, yJoin), new Vector2(endX, centerTopY), lineSeg);
			MirrorCurrentPathAroundTopEdge(topY);
		}

}
