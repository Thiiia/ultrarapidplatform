using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Shapes;

public partial class DragExecutionController
{
	private void ResetWispMovingTargetInteractionPulseState()
	{
		wispMovingTargetInteractionPulseCooldownUntil = 0f;
		wispMovingTargetLastInteractionZone = WispOverlapZone.None;
		wispMovingTargetLastInteractionProximity = -1f;
	}

	private void CreateWispSystem()
	{
		if (wispPathContainer == null)
		{
			GameObject container = new GameObject("WispPathContainer", typeof(RectTransform));
			container.transform.SetParent(equationContainer, false);
			if (wispRenderBehindEquationBubbles)
			{
				container.transform.SetAsFirstSibling();
			}
			else
			{
				container.transform.SetAsLastSibling();
			}

			wispPathContainer = container.GetComponent<RectTransform>();
			wispPathContainer.anchorMin = Vector2.zero;
			wispPathContainer.anchorMax = Vector2.one;
			wispPathContainer.sizeDelta = Vector2.zero;
		}

		if (wispFrontVisualContainer == null)
		{
			GameObject frontContainer = new GameObject("WispFrontVisualContainer", typeof(RectTransform));
			frontContainer.transform.SetParent(equationContainer, false);
			frontContainer.transform.SetAsLastSibling();
			wispFrontVisualContainer = frontContainer.GetComponent<RectTransform>();
			wispFrontVisualContainer.anchorMin = Vector2.zero;
			wispFrontVisualContainer.anchorMax = Vector2.one;
			wispFrontVisualContainer.sizeDelta = Vector2.zero;
		}

		EnsureWispOverlayCanvas();
		EnsureWispFrontOverlayCanvas();

		if (wispFollowRing == null)
		{
			GameObject ringObj = new GameObject("WispFollowRing", typeof(RectTransform), typeof(Disc));
			ringObj.transform.SetParent(wispFrontVisualContainer != null ? wispFrontVisualContainer : wispPathContainer, false);
			wispFollowRing = ringObj.GetComponent<Disc>();
			wispFollowRingRect = ringObj.GetComponent<RectTransform>();

			wispFollowRing.Type = DiscType.Ring;
			wispFollowRing.RadiusSpace = ThicknessSpace.Meters;
			wispFollowRing.ThicknessSpace = ThicknessSpace.Meters;
			wispFollowRing.Thickness = Mathf.Max(1f, ToWispShapeUnits(wispFollowRingThickness));
			wispFollowRing.ZTest = CompareFunction.Always;
			wispFollowRing.Color = new Color(wispFollowRingColor.r, wispFollowRingColor.g, wispFollowRingColor.b, wispFollowRingAlpha);
			SyncWispFollowRingSorting();
			ringObj.SetActive(false);
		}

		if (wispTargetApproachRingDisc == null)
		{
			GameObject ringObj = new GameObject("WispTargetApproachRing", typeof(RectTransform), typeof(Disc));
			ringObj.transform.SetParent(wispFrontVisualContainer != null ? wispFrontVisualContainer : wispPathContainer, false);
			wispTargetApproachRingDisc = ringObj.GetComponent<Disc>();
			wispTargetApproachRingRect = ringObj.GetComponent<RectTransform>();

			wispTargetApproachRingDisc.Type = DiscType.Ring;
			wispTargetApproachRingDisc.RadiusSpace = ThicknessSpace.Meters;
			wispTargetApproachRingDisc.ThicknessSpace = ThicknessSpace.Meters;
			wispTargetApproachRingDisc.ZTest = CompareFunction.Always;
			wispTargetApproachRingDisc.Color = new Color(wispTargetApproachRingColor.r, wispTargetApproachRingColor.g, wispTargetApproachRingColor.b, 0f);
			SyncWispTargetApproachRingSorting();
			ringObj.SetActive(false);
		}

		EnsureWispIndicatorVisual();

		EnsureWispPathPolyline();
		EnsureAlgebraTargetImpactFx();
	}

	private static float ToWispShapeUnits(float uiUnits)
	{
		return Mathf.Max(0f, uiUnits);
	}

	private float GetRenderedWispPathWidth()
	{
		float width = GetWispPathWidth() * Mathf.Clamp(wispPathThicknessMultiplier, 0.35f, 3f);
		float thicknessMultiplier = Mathf.Clamp(wispShapesPolylineThicknessMultiplier, 0.75f, 4f);
		if (wispDotSprite != null)
		{
			thicknessMultiplier = Mathf.Clamp(wispDotPathThicknessMultiplier, 0.25f, 4f);
		}

		return Mathf.Max(1f, ToWispShapeUnits(width * thicknessMultiplier));
	}

	private float GetRenderedWispIndicatorSize()
	{
		float size = GetWispIndicatorSize();
		return Mathf.Max(2f, ToWispShapeUnits(size));
	}

	private bool IsWispPathGradientOnlyModeEnabled()
	{
		return wispPathGradientOnlyMode;
	}

	private bool ShouldApplyWispPathHeatFeedback()
	{
		return wispPathHeatByAccuracy && !IsWispPathGradientOnlyModeEnabled();
	}

	private bool ShouldApplyWispMovingTargetPathAccent()
	{
		return wispPathAnimateWithMovingTarget && !IsWispPathGradientOnlyModeEnabled();
	}

	private bool ShouldRenderWispTimingMarkers()
	{
		return wispTimingTickMarkers && !IsWispPathGradientOnlyModeEnabled();
	}

	private bool ShouldApplyWispPathBeatAccents()
	{
		return !IsWispPathGradientOnlyModeEnabled();
	}

	private PolylineJoins ResolveWispPathJoinMode()
	{
		if (wispDotSprite != null)
		{
			return PolylineJoins.Round;
		}

		return wispShapesPolylineRoundJoins ? PolylineJoins.Round : PolylineJoins.Miter;
	}

	private int GetWispShapeSortingBaseOrder()
	{
		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas == null)
		{
			return 0;
		}

		int offset = Mathf.Max(1, wispOverlaySortingOrderOffset);
		return wispRenderBehindEquationBubbles ? sourceCanvas.sortingOrder : sourceCanvas.sortingOrder + offset;
	}

	private int GetWispPathBodySortingBaseOrder()
	{
		return GetWispShapeSortingBaseOrder();
	}

	private void EnsureWispOverlayCanvas()
	{
		if (wispPathContainer == null)
		{
			return;
		}

		Canvas overlayCanvas = wispPathContainer.GetComponent<Canvas>();
		if (overlayCanvas == null)
		{
			overlayCanvas = wispPathContainer.gameObject.AddComponent<Canvas>();
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			overlayCanvas.sortingLayerID = sourceCanvas.sortingLayerID;
			int offset = Mathf.Max(1, wispOverlaySortingOrderOffset);
			overlayCanvas.sortingOrder = wispRenderBehindEquationBubbles ? sourceCanvas.sortingOrder : sourceCanvas.sortingOrder + offset;
		}

		overlayCanvas.overrideSorting = !wispRenderBehindEquationBubbles;
		SyncAllWispShapeSorting();
	}

	private void EnsureWispFrontOverlayCanvas()
	{
		if (wispFrontVisualContainer == null)
		{
			return;
		}

		Canvas frontCanvas = wispFrontVisualContainer.GetComponent<Canvas>();
		if (frontCanvas == null)
		{
			frontCanvas = wispFrontVisualContainer.gameObject.AddComponent<Canvas>();
		}

		Canvas sourceCanvas = parentCanvas != null ? parentCanvas : equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : null;
		if (sourceCanvas != null)
		{
			frontCanvas.sortingLayerID = sourceCanvas.sortingLayerID;
			int offset = Mathf.Max(1, wispOverlaySortingOrderOffset);
			frontCanvas.sortingOrder = sourceCanvas.sortingOrder + offset;
		}

		frontCanvas.overrideSorting = true;
	}

	private void EnsureWispContainerOrder()
	{
		if (wispPathContainer == null)
		{
			return;
		}

		if (wispRenderBehindEquationBubbles)
		{
			wispPathContainer.SetAsFirstSibling();
		}
		else
		{
			wispPathContainer.SetAsLastSibling();
		}

		EnsureWispOverlayCanvas();
		EnsureWispFrontOverlayCanvas();

		if (wispFrontVisualContainer != null)
		{
			wispFrontVisualContainer.SetAsLastSibling();
		}

		if (wispPathPolyline != null)
		{
			wispPathPolyline.transform.SetAsFirstSibling();
		}

		if (wispFollowRingRect != null && wispFrontVisualContainer != null && wispFollowRingRect.parent != wispFrontVisualContainer)
		{
			wispFollowRingRect.SetParent(wispFrontVisualContainer, false);
		}

		if (wispTargetApproachRingRect != null && wispFrontVisualContainer != null && wispTargetApproachRingRect.parent != wispFrontVisualContainer)
		{
			wispTargetApproachRingRect.SetParent(wispFrontVisualContainer, false);
		}

		Transform indicatorTransform = GetWispIndicatorTransform();
		if (indicatorTransform != null)
		{
			if (wispFrontVisualContainer != null && indicatorTransform.parent != wispFrontVisualContainer)
			{
				indicatorTransform.SetParent(wispFrontVisualContainer, false);
			}

			indicatorTransform.SetAsLastSibling();
		}
	}
}
