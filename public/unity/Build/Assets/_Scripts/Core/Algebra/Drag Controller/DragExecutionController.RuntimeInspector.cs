using UnityEngine;

using Sirenix.OdinInspector;

public partial class DragExecutionController
{
	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Quick Actions"), Button("Refresh Bubbles (Play Mode)", ButtonSizes.Medium)]
	[EnableIf("@UnityEngine.Application.isPlaying")]
	private void RefreshBubblesFromInspector()
	{
		RefreshBubbleDisplay();
	}

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Quick Actions"), Button("Clear Bubbles (Play Mode)", ButtonSizes.Medium)]
	[EnableIf("@UnityEngine.Application.isPlaying")]
	private void ClearBubblesFromInspector()
	{
		ClearBubbleElements();
	}

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Controller Active")]
	private bool InspectorRuntimeIsActive => isActive;

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Drag Mode")]
	private string InspectorRuntimeDragMode => "BubbleSystem";

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Success Count")]
	private int InspectorRuntimeSuccessCount => successCount;

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Step Progress")]
	private string InspectorRuntimeStepProgress => $"{stepsCompletedForEquation}/{Mathf.Max(stepsRequiredForEquation, 1)}";

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[ProgressBar(0f, 1f, ColorGetter = nameof(GetInspectorRuntimeStepProgressColor))]
	[LabelText("Step Progress %")]
	private float InspectorRuntimeStepProgress01 => stepsRequiredForEquation <= 0 ? 0f : Mathf.Clamp01((float)stepsCompletedForEquation / stepsRequiredForEquation);

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Drag Speed (UI px/s)")]
	private float InspectorRuntimeDragSpeed => dragSpeedUiPerSecondSmoothed;

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Current Equation")]
	[PropertyOrder(1)]
	private string InspectorRuntimeEquation
	{
		get
		{
			try
			{
				return currentState != null ? (FormatEquation(currentState) ?? string.Empty) : string.Empty;
			}
			catch
			{
				// Keep Odin runtime polling resilient during transient state swaps.
				return string.Empty;
			}
		}
	}

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Wisp Path Mode")]
	private string InspectorRuntimeWispPathMode => currentWispPathRuntimeMode.ToString();

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Wisp Path Snapshot")]
	private WispPathDebugSnapshot InspectorRuntimeWispPathSnapshot => wispPathDebugSnapshot;

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Runtime"), ShowInInspector, ReadOnly, ShowIf("@UnityEngine.Application.isPlaying")]
	[LabelText("Wisp Path Metrics")]
	private string InspectorRuntimeWispPathMetrics =>
		$"in:{wispPathDebugSnapshot.inputPoints} " +
		$"resample:{wispPathDebugSnapshot.postResamplePoints} " +
		$"spacing:{wispPathDebugSnapshot.spacingUsed:F2} cap:{wispPathDebugSnapshot.pointCapUsed}";

	private Color GetInspectorRuntimeStepProgressColor()
	{
		float t = InspectorRuntimeStepProgress01;
		return Color.Lerp(AlgebraUiPalette.JudgementRed, AlgebraUiPalette.JudgementGreen, t);
	}
}
