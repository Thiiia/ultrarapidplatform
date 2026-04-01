using UnityEngine;
using UnityEngine.UI;

using Shapes;
using LeTai.Asset.TranslucentImage;

public partial class DragExecutionController
{
	private Disc wispFollowRing;
	private RectTransform wispFollowRingRect;
	private Polyline wispPathUnderlayPolyline;
	private Polyline wispPathPolyline;
	private Disc wispPathStartCapDisc;
	private RectTransform wispPathStartCapRect;
	private Disc wispPathEndCapDisc;
	private RectTransform wispPathEndCapRect;
	private RectTransform wispArcFrameRect;
	private Disc wispIndicatorDisc;
	private TranslucentImage wispIndicatorGlass;
	private Graphic wispIndicatorOutlineGraphic;
	private Disc wispIndicatorOutlineDisc;
	private bool wispIndicatorUsesPrefabMovingTarget;
	private float wispGuidanceHeat01 = 1f;
	private int wispBeatEventPulseCounter;
	private float wispMovingTargetInteractionPulseCooldownUntil;
	private WispOverlapZone wispMovingTargetLastInteractionZone = WispOverlapZone.None;
	private float wispMovingTargetLastInteractionProximity = -1f;

	#region Bubble System - Wisp Path

	#endregion
}
