using UnityEngine;

using TooltipSpecial = RainbowArt.CleanFlatUI.TooltipSpecial;

public partial class DragExecutionController
{
	private void ApplyTooltipSpecialPlacementSafety(TooltipSpecial tooltip, RectTransform tooltipParent)
	{
		if (tooltip == null || tooltipParent == null)
		{
			return;
		}

		RectTransform tooltipRect = tooltip.transform as RectTransform;
		if (tooltipRect == null)
		{
			return;
		}

		Canvas.ForceUpdateCanvases();

		Camera cam = ResolveUiCameraForRect(tooltipParent);
		if (!TryGetLocalRect(tooltipRect, tooltipParent, cam, out Rect tooltipLocal))
		{
			return;
		}

		Vector2 desiredCenter = tooltipLocal.center;
		Vector2 tooltipSize = tooltipLocal.size;
		Rect parentRect = tooltipParent.rect;

		if (tooltipSpecialAvoidLockedEquation &&
			TryGetLockedEquationLocalRect(tooltipParent, cam, out Rect lockedLocal))
		{
			Rect lockedExpanded = ExpandRect(lockedLocal, tooltipSpecialAvoidLockedEquationPadding);
			if (RectWithCenterAndSize(desiredCenter, tooltipSize).Overlaps(lockedExpanded))
			{
				desiredCenter = ResolveTooltipCenterAvoidingRect(
					desiredCenter,
					tooltipSize,
					lockedExpanded,
					parentRect,
					tooltipSpecialClampToParentBounds ? tooltipSpecialParentBoundsPadding : 0f);
			}
		}

		if (tooltipSpecialClampToParentBounds)
		{
			desiredCenter = ClampRectCenterToParent(desiredCenter, tooltipSize, parentRect, tooltipSpecialParentBoundsPadding);
		}

		Vector2 delta = desiredCenter - tooltipLocal.center;
		if (delta.sqrMagnitude > 0.0001f)
		{
			Vector3 local = tooltipRect.localPosition;
			tooltipRect.localPosition = new Vector3(local.x + delta.x, local.y + delta.y, local.z);
		}
	}

	private bool TryGetLockedEquationLocalRect(RectTransform relativeTo, Camera cam, out Rect rect)
	{
		rect = default;
		if (relativeTo == null || lockedInEquationUI == null)
		{
			return false;
		}

		RectTransform lockedRect = lockedInEquationUI.GetComponent<RectTransform>();
		if (lockedRect == null || !lockedRect.gameObject.activeInHierarchy)
		{
			return false;
		}

		return TryGetLocalRect(lockedRect, relativeTo, cam, out rect);
	}

	private static Rect ExpandRect(Rect rect, float padding)
	{
		if (padding <= 0f)
		{
			return rect;
		}

		return Rect.MinMaxRect(rect.xMin - padding, rect.yMin - padding, rect.xMax + padding, rect.yMax + padding);
	}

	private static Rect RectWithCenterAndSize(Vector2 center, Vector2 size)
	{
		return new Rect(center - (size * 0.5f), size);
	}

	private static Vector2 ClampRectCenterToParent(Vector2 center, Vector2 size, Rect parentRect, float padding)
	{
		float halfW = size.x * 0.5f;
		float halfH = size.y * 0.5f;

		float minX = parentRect.xMin + halfW + padding;
		float maxX = parentRect.xMax - halfW - padding;
		float minY = parentRect.yMin + halfH + padding;
		float maxY = parentRect.yMax - halfH - padding;

		if (minX > maxX)
		{
			center.x = parentRect.center.x;
		}
		else
		{
			center.x = Mathf.Clamp(center.x, minX, maxX);
		}

		if (minY > maxY)
		{
			center.y = parentRect.center.y;
		}
		else
		{
			center.y = Mathf.Clamp(center.y, minY, maxY);
		}

		return center;
	}

	private static Vector2 ResolveTooltipCenterAvoidingRect(
		Vector2 currentCenter,
		Vector2 tooltipSize,
		Rect avoidRect,
		Rect parentRect,
		float clampPadding)
	{
		Vector2 bestCenter = currentCenter;
		float bestScore = float.PositiveInfinity;

		float halfW = tooltipSize.x * 0.5f;
		float halfH = tooltipSize.y * 0.5f;

		Vector2[] candidates = new Vector2[8];
		int count = 0;
		candidates[count++] = currentCenter;
		candidates[count++] = new Vector2(currentCenter.x, avoidRect.yMax + halfH);
		candidates[count++] = new Vector2(currentCenter.x, avoidRect.yMin - halfH);
		candidates[count++] = new Vector2(avoidRect.xMin - halfW, currentCenter.y);
		candidates[count++] = new Vector2(avoidRect.xMax + halfW, currentCenter.y);
		candidates[count++] = new Vector2(avoidRect.xMin - halfW, avoidRect.yMax + halfH);
		candidates[count++] = new Vector2(avoidRect.xMax + halfW, avoidRect.yMax + halfH);
		candidates[count++] = new Vector2(currentCenter.x, parentRect.yMin + halfH + clampPadding);

		for (int i = 0; i < count; i++)
		{
			Vector2 candidate = ClampRectCenterToParent(candidates[i], tooltipSize, parentRect, clampPadding);
			Rect candidateRect = RectWithCenterAndSize(candidate, tooltipSize);
			if (candidateRect.Overlaps(avoidRect))
			{
				continue;
			}

			float score = (candidate - currentCenter).sqrMagnitude;
			if (score < bestScore)
			{
				bestScore = score;
				bestCenter = candidate;
			}
		}

		if (float.IsPositiveInfinity(bestScore))
		{
			return ClampRectCenterToParent(currentCenter, tooltipSize, parentRect, clampPadding);
		}

		return bestCenter;
	}

	private static Camera ResolveUiCameraForRect(RectTransform rect)
	{
		if (rect == null)
		{
			return null;
		}

		Canvas canvas = rect.GetComponentInParent<Canvas>();
		if (canvas == null || canvas.renderMode == RenderMode.ScreenSpaceOverlay)
		{
			return null;
		}

		return canvas.worldCamera;
	}

	private static bool TryGetLocalRect(RectTransform rt, RectTransform relativeTo, Camera cam, out Rect rect)
	{
		rect = default;
		if (rt == null || relativeTo == null)
		{
			return false;
		}

		Vector3[] corners = new Vector3[4];
		rt.GetWorldCorners(corners);

		Vector2 min = new Vector2(float.PositiveInfinity, float.PositiveInfinity);
		Vector2 max = new Vector2(float.NegativeInfinity, float.NegativeInfinity);

		for (int i = 0; i < 4; i++)
		{
			Vector2 sp = RectTransformUtility.WorldToScreenPoint(cam, corners[i]);
			if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(relativeTo, sp, cam, out Vector2 lp))
			{
				return false;
			}

			min = Vector2.Min(min, lp);
			max = Vector2.Max(max, lp);
		}

		rect = Rect.MinMaxRect(min.x, min.y, max.x, max.y);
		return true;
	}
}
