using System.Collections.Generic;

using UnityEngine;

public partial class DragExecutionController
{
	private float GetWispReferenceClearance()
	{
		float baseClearance = Mathf.Max(0f, wispReferenceEquationClearance);
		float pathRadius = Mathf.Max(0f, GetWispPathWidth() * 0.5f);
		float indicatorRadius = Mathf.Max(0f, GetWispIndicatorSize() * 0.5f);
		float visualPadding = Mathf.Max(pathRadius, indicatorRadius);
		return baseClearance + visualPadding + 4f;
	}

	private float GetWispCurveFloorY(Vector2 startPos, Vector2 endPos)
	{
		float endpointMinY = Mathf.Min(startPos.y, endPos.y);
		float arc = Mathf.Max(GetWispArcHeight(startPos, endPos), GetWispPathWidth() * 1.6f);
		float dropAllowance = Mathf.Max(GetWispPathWidth() * 2f, arc * 1.35f);
		return endpointMinY - dropAllowance;
	}

	private void ClampWispPathPointsToReferenceCeiling(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (!wispClampArcBelowReferenceEquation || points == null || points.Count < 3)
		{
			return;
		}

		if (!TryGetWispReferenceCeilingY(out float ceilingY))
		{
			return;
		}

		int last = points.Count - 1;
		float floorY = GetWispCurveFloorY(startPos, endPos);
		if (floorY > ceilingY)
		{
			floorY = ceilingY;
		}

		for (int i = 1; i < last; i++)
		{
			Vector2 p = points[i];
			p.y = Mathf.Clamp(p.y, floorY, ceilingY);
			points[i] = p;
		}
	}

	private bool TryGetWispReferenceCeilingY(out float ceilingY)
	{
		ceilingY = float.PositiveInfinity;

		RectTransform pathSpace = equationContainer != null ? equationContainer : dragCanvas;
		if (pathSpace == null)
		{
			return false;
		}

		Camera cam = null;
		Canvas canvas = pathSpace.GetComponentInParent<Canvas>();
		if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
		{
			cam = canvas.worldCamera != null ? canvas.worldCamera : uiCamera;
		}

		float clearance = GetWispReferenceClearance();
		float bestY = float.PositiveInfinity;
		bool found = false;

		RectTransform lockedRect = lockedInEquationUI != null ? lockedInEquationUI.GetComponent<RectTransform>() : null;
		if (lockedRect != null && lockedRect.gameObject.activeInHierarchy && TryGetLocalRect(lockedRect, pathSpace, cam, out Rect lockedLocal))
		{
			bestY = Mathf.Min(bestY, lockedLocal.yMin - clearance);
			found = true;
		}

		if (referenceHudContainer != null &&
			referenceHudContainer.gameObject.activeInHierarchy &&
			referenceHudContainer != lockedRect &&
			TryGetLocalRect(referenceHudContainer, pathSpace, cam, out Rect progressLocal))
		{
			bestY = Mathf.Min(bestY, progressLocal.yMin - clearance);
			found = true;
		}

		if (runtimeStepPerformanceBarRoot != null &&
			runtimeStepPerformanceBarRoot.gameObject.activeInHierarchy &&
			runtimeStepPerformanceBarRoot != referenceHudContainer &&
			TryGetLocalRect(runtimeStepPerformanceBarRoot, pathSpace, cam, out Rect stepPerfLocal))
		{
			bestY = Mathf.Min(bestY, stepPerfLocal.yMin - clearance);
			found = true;
		}

		if (found)
		{
			ceilingY = bestY;
		}

		return found;
	}

	private bool TryGetWispPathPlayfieldSafeRect(out Rect safeRect, out float edgeBand)
	{
		safeRect = default;
		edgeBand = 0f;
		if (!wispConstrainPathToPlayfield)
		{
			return false;
		}

		RectTransform pathSpace = equationContainer != null ? equationContainer : dragCanvas;
		if (pathSpace == null)
		{
			return false;
		}

		Camera cam = null;
		Canvas canvas = pathSpace.GetComponentInParent<Canvas>();
		if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
		{
			cam = canvas.worldCamera != null ? canvas.worldCamera : uiCamera;
		}

		// Use the full gameplay canvas projected into path-space when possible.
		// equationContainer is often only the token row's local rect, which would over-constrain the path into a line.
		Rect raw = pathSpace.rect;
		if (dragCanvas != null && dragCanvas != pathSpace && TryGetLocalRect(dragCanvas, pathSpace, cam, out Rect canvasLocal))
		{
			raw = canvasLocal;
		}

		if (raw.width <= 1f || raw.height <= 1f)
		{
			return false;
		}

		float minDim = Mathf.Min(raw.width, raw.height);
		float visualRadius = Mathf.Max(GetRenderedWispPathWidth() * 0.75f, GetWispIndicatorSize() * 0.42f);
		float ratioMargin = minDim * Mathf.Clamp(wispPathPlayfieldSafeMarginRatio, 0f, 0.2f);
		float marginMin = Mathf.Max(0f, wispPathPlayfieldSafeMarginMin);
		float marginMax = Mathf.Max(marginMin, wispPathPlayfieldSafeMarginMax);
		float margin = Mathf.Clamp(Mathf.Max(visualRadius, ratioMargin, marginMin), 0f, marginMax);
		margin = Mathf.Min(margin, minDim * 0.42f);
		float verticalMargin = Mathf.Min(margin, raw.height * 0.38f);

		safeRect = raw;
		safeRect.xMin += margin;
		safeRect.xMax -= margin;
		safeRect.yMin += verticalMargin;
		safeRect.yMax -= verticalMargin;

		if (TryGetWispReferenceCeilingY(out float ceilingY))
		{
			safeRect.yMax = Mathf.Min(safeRect.yMax, ceilingY);
		}

		// If constraints get too tight (e.g. narrow overlay layout), disable playfield clamping rather than flattening the path.
		float minUsableWidth = Mathf.Max(8f, GetRenderedWispPathWidth() * 1.2f);
		float minUsableHeight = Mathf.Max(8f, GetRenderedWispPathWidth() * 2.4f);
		if (safeRect.width <= minUsableWidth || safeRect.height <= minUsableHeight)
		{
			return false;
		}

		edgeBand = Mathf.Clamp(Mathf.Max(GetRenderedWispPathWidth() * 0.9f, margin * 0.55f), 8f, Mathf.Min(safeRect.width, safeRect.height) * 0.5f);
		return true;
	}

	private void ClampWispPathPointsToPlayfieldBounds(List<Vector2> points, Vector2 startPos, Vector2 endPos)
	{
		if (!wispConstrainPathToPlayfield || points == null || points.Count < 3)
		{
			return;
		}

		if (!TryGetWispPathPlayfieldSafeRect(out Rect safeRect, out _))
		{
			return;
		}

		int passes = Mathf.Clamp(wispPathPlayfieldClampPasses, 0, 2);
		if (passes <= 0)
		{
			return;
		}

		int last = points.Count - 1;
		for (int pass = 0; pass < passes; pass++)
		{
			bool adjustedAny = false;
			for (int i = 1; i < last; i++)
			{
				Vector2 p = points[i];
				float x = Mathf.Clamp(p.x, safeRect.xMin, safeRect.xMax);
				float y = Mathf.Clamp(p.y, safeRect.yMin, safeRect.yMax);
				if (!Mathf.Approximately(p.x, x) || !Mathf.Approximately(p.y, y))
				{
					points[i] = new Vector2(x, y);
					adjustedAny = true;
				}
			}

			points[0] = startPos;
			points[last] = endPos;

			if (!adjustedAny)
			{
				break;
			}
		}
	}

	private float GetWispCurveCeilingY(Vector2 startPos, Vector2 endPos)
	{
		float endpointMaxY = Mathf.Max(startPos.y, endPos.y);
		float endpointCeiling = endpointMaxY + Mathf.Max(0f, wispMaxRiseAboveEndpoints);
		if (!wispClampArcBelowReferenceEquation)
		{
			return endpointCeiling;
		}

		if (TryGetWispReferenceCeilingY(out float referenceCeiling))
		{
			float clamped = Mathf.Min(endpointCeiling, referenceCeiling);
			return clamped;
		}

		return endpointCeiling;
	}

}
