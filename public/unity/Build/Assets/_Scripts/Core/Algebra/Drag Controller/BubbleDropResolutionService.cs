using UnityEngine;

internal interface IBubbleDropResolutionHost
{
	EquationBubbleElement CurrentDropZone { get; }
	float DropAnimationDuration { get; }
	float SnapBackDuration { get; }
	bool StepPerformanceUseRawTimingResult { get; }
	AudioSource AudioSource { get; }
	AudioClip SuccessSound { get; }
	AudioClip FailSound { get; }
	bool IsBubbleAnimating { get; set; }

	void QueuePendingStepPerformanceOutcome(HitResult hitResult, float signedErrorMs);
	void ApplyBubbleOperation(EquationBubbleElement element, StepOption prevalidatedOperation);
	void MarkDragVisualSettleWindow(float seconds);
	void RestoreTermGroupAfterSnapBack(EquationBubbleElement element);
	void TryEmitAlgebraTimingImpactFxOnSuccess(HitResult hitResult);
	void TryEmitAlgebraTimingImpactFxOnMiss();
	void ShowFeedback(string message, Color color);
	void ShowFeedback(string message, Color color, HitResult hitResult, float signedErrorMs, float normalizedToMiss);
}

internal static class BubbleDropResolutionService
{
	internal static void HandleSuccessfulDrop(
		IBubbleDropResolutionHost host,
		EquationBubbleElement element,
		string timingFeedback,
		Color? timingColor,
		float timingScore,
		StepOption prevalidatedOperation,
		HitResult timingHitResult,
		float signedErrorMs,
		float normalizedToMiss,
		HitResult stepPerformanceHitResult)
	{
		host.IsBubbleAnimating = true;

		Color feedbackColor = timingColor ?? Color.green;
		HitResult stepBarResult = host.StepPerformanceUseRawTimingResult && stepPerformanceHitResult != HitResult.None
			? stepPerformanceHitResult
			: timingHitResult;
		host.QueuePendingStepPerformanceOutcome(stepBarResult, signedErrorMs);

		element.MoveTo(host.CurrentDropZone.OriginalPosition, host.DropAnimationDuration, () =>
		{
			host.ApplyBubbleOperation(element, prevalidatedOperation);
		});

		element.AnimateSuccess();
		host.TryEmitAlgebraTimingImpactFxOnSuccess(timingHitResult);

		if (host.AudioSource != null && host.SuccessSound != null)
		{
			host.AudioSource.PlayOneShot(host.SuccessSound);
		}

		string dynamicFeedback = BuildDynamicFeedbackMessage(timingFeedback, timingHitResult, signedErrorMs);
		host.ShowFeedback(dynamicFeedback, feedbackColor, timingHitResult, signedErrorMs, normalizedToMiss);

		Debug.Log($"Drop success! Timing: {timingFeedback}, Score: {timingScore:F2}");
	}

	internal static void HandleFailedDrop(IBubbleDropResolutionHost host, EquationBubbleElement element)
	{
		host.MarkDragVisualSettleWindow(host.SnapBackDuration);
		element.MarkDragResolutionHandled();
		element.RestoreDragSiblingIndex();
		element.SnapBack(host.SnapBackDuration);
		element.AnimateFail();
		host.RestoreTermGroupAfterSnapBack(element);

		if (host.AudioSource != null && host.FailSound != null)
		{
			host.AudioSource.PlayOneShot(host.FailSound);
		}

		host.TryEmitAlgebraTimingImpactFxOnMiss();
		host.ShowFeedback("Missed the target. Stay with the moving guide and release in the green zone.", Color.red);
	}

	internal static void HandleInvalidOperation(IBubbleDropResolutionHost host, EquationBubbleElement element, bool isOptimalHint)
	{
		host.MarkDragVisualSettleWindow(host.SnapBackDuration);
		element.MarkDragResolutionHandled();
		element.RestoreDragSiblingIndex();
		element.SnapBack(host.SnapBackDuration);
		element.AnimateFail();
		host.RestoreTermGroupAfterSnapBack(element);

		if (host.AudioSource != null && host.FailSound != null)
		{
			host.AudioSource.PlayOneShot(host.FailSound);
		}

		host.ShowFeedback(
			isOptimalHint ? "Valid move, but not the best one." : "That move will not help this equation.",
			Color.red);
	}

	private static string BuildDynamicFeedbackMessage(string baseMessage, HitResult hitResult, float signedErrorMs)
	{
		string head = string.IsNullOrWhiteSpace(baseMessage) ? "Nice!" : baseMessage.Trim();
		if (hitResult == HitResult.Miss && !float.IsNaN(signedErrorMs))
		{
			head += signedErrorMs < 0f ? " - release later." : " - release earlier.";
		}

		return head;
	}
}
