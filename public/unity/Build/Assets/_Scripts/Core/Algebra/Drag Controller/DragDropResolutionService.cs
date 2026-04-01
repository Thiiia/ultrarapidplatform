using UnityEngine;

internal struct DragDropResolutionOutcome
{
	internal bool droppedOnTarget;
	internal bool success;
	internal bool operationAccepted;
	internal HitResult resolvedHit;
	internal float resolvedPoints01;
	internal float resolvedSignedErrorMs;
	internal float resolvedNormalizedToMiss;
	internal DragExecutionController.DragMissReason resolvedMissReason;
}

internal interface IDragDropResolutionHost : IBubbleDropResolutionHost
{
	float DropZoneRadius { get; }
	bool WispOverlapAffectsScore { get; }
	bool WispOverlapAffectsJudgement { get; }

	JudgementService.HitInfo EvaluateTimingDetailed(out string label, out Color color, out float score, out HitResult hitResult);
	bool TryGetWispOverlapScore(Vector2 position, out float overlapScore);
	HitResult ApplyOverlapToHitResult(HitResult baseResult, float overlapScore);
	void ApplyHitResultFeedback(HitResult result, ref string label, ref Color color);
	void UpdateWispPathHeatFromAccuracy(float quality01);
	bool TryValidateBubbleOperation(EquationBubbleElement element, out StepOption operation, out bool isOptimal);
	void StopOperatorFollowing(bool dropAccepted);
	void ResolveActiveBeatPayload(HitResult hitResult);
}

internal static class DragDropResolutionService
{
	internal static DragDropResolutionOutcome Resolve(IDragDropResolutionHost host, EquationBubbleElement element, Vector2 position)
	{
		DragDropResolutionOutcome outcome = new DragDropResolutionOutcome
		{
			droppedOnTarget = false,
			success = false,
			operationAccepted = false,
			resolvedHit = HitResult.Miss,
			resolvedPoints01 = 0f,
			resolvedSignedErrorMs = float.NaN,
			resolvedNormalizedToMiss = float.NaN,
			resolvedMissReason = DragExecutionController.DragMissReason.None
		};

		if (host.CurrentDropZone != null)
		{
			float distance = Vector2.Distance(position, host.CurrentDropZone.OriginalPosition);
			outcome.droppedOnTarget = distance < host.DropZoneRadius;
		}

		if (!outcome.droppedOnTarget)
		{
			host.ResolveActiveBeatPayload(HitResult.Miss);
			BubbleDropResolutionService.HandleFailedDrop(host, element);
			host.StopOperatorFollowing(false);
			outcome.resolvedMissReason = DragExecutionController.DragMissReason.DroppedOffTarget;
			return outcome;
		}

		JudgementService.HitInfo timingHitInfo = host.EvaluateTimingDetailed(
			out string timingFeedback,
			out Color timingColor,
			out float timingScore,
			out HitResult timingHitResult);
		HitResult rawTimingHitResult = timingHitResult;
		outcome.resolvedSignedErrorMs = timingHitInfo.signedErrorMs;
		outcome.resolvedNormalizedToMiss = timingHitInfo.normalizedToMiss;
		outcome.resolvedPoints01 = Mathf.Clamp01(timingScore);

		bool useOverlap = host.WispOverlapAffectsScore || host.WispOverlapAffectsJudgement;
		if (useOverlap && host.TryGetWispOverlapScore(position, out float overlapScore))
		{
			if (host.WispOverlapAffectsScore)
			{
				timingScore = Mathf.Clamp01(timingScore * overlapScore);
				outcome.resolvedPoints01 = Mathf.Clamp01(timingScore);
			}

			if (host.WispOverlapAffectsJudgement)
			{
				HitResult adjusted = host.ApplyOverlapToHitResult(timingHitResult, overlapScore);
				if (adjusted != timingHitResult)
				{
					host.ApplyHitResultFeedback(adjusted, ref timingFeedback, ref timingColor);
					timingHitResult = adjusted;
				}
			}
		}

		host.UpdateWispPathHeatFromAccuracy(outcome.resolvedPoints01);

		if (!host.TryValidateBubbleOperation(element, out StepOption pendingOp, out bool isOptimal))
		{
			BubbleDropResolutionService.HandleInvalidOperation(host, element, isOptimal);
			host.ResolveActiveBeatPayload(HitResult.Miss);
			host.StopOperatorFollowing(false);
			outcome.resolvedMissReason = DragExecutionController.DragMissReason.InvalidOperation;
			return outcome;
		}

		host.ResolveActiveBeatPayload(timingHitResult);
		element.MarkDropAccepted();
		BubbleDropResolutionService.HandleSuccessfulDrop(
			host,
			element,
			timingFeedback,
			timingColor,
			timingScore,
			pendingOp,
			timingHitResult,
			timingHitInfo.signedErrorMs,
			timingHitInfo.normalizedToMiss,
			rawTimingHitResult);

		outcome.operationAccepted = true;
		host.StopOperatorFollowing(true);
		outcome.resolvedHit = timingHitResult;
		outcome.success = outcome.resolvedHit == HitResult.Perfect || outcome.resolvedHit == HitResult.Good;
		return outcome;
	}
}
