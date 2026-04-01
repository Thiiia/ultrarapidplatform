using System;
using UnityEngine;

internal interface IBubbleOperationFlowHost
{
	EquationChoiceSystem ChoiceSystem { get; }
	EquationState CurrentState { get; set; }
	int CurrentStepDragCount { get; set; }
	int DragsPerStep { get; }
	int StepsCompletedForEquation { get; set; }
	int StepsRequiredForEquation { get; set; }
	int SuccessCount { get; set; }
	bool IsBubbleAnimating { get; set; }

	StepOption DetermineBubbleOperation(EquationBubbleElement element);
	EquationState ApplyOperationToState(EquationState state, StepOption operation);
	void RecordCurrentStepPerformanceOutcome();
	void ShowFeedback(string message, Color color);
	void UpdateProgressMeter();
	void StartSignChangeAnimation(EquationBubbleElement element, StepOption operation, Action onComplete);
	void UpdateBubbleProgressBar(EquationState state);
	void StartSolvedFlow();
	void ResetCurrentStepPerformanceOutcomes();
	void RefreshBubbleDisplay();
	void NotifyEquationSolved();
	void NotifyEquationUpdated();
	void NotifySuccessCountChanged();
	void NotifyDragOperationComplete();
}

internal static class BubbleOperationFlowService
{
	internal static void Apply(IBubbleOperationFlowHost host, EquationBubbleElement element, StepOption prevalidatedOperation = null)
	{
		StepOption operation = prevalidatedOperation ?? host.DetermineBubbleOperation(element);
		if (operation == null)
		{
			Debug.LogWarning("Could not determine operation for dropped element");
			host.RefreshBubbleDisplay();
			host.IsBubbleAnimating = false;
			return;
		}

		host.CurrentStepDragCount++;
		host.RecordCurrentStepPerformanceOutcome();

		string opMessage = operation.operationType == OperationType.MultiplyByNegativeOne
			? "Flip both sides!"
			: operation.description;
		if (host.DragsPerStep <= 1)
		{
			host.ShowFeedback(opMessage, host.CurrentStepDragCount >= host.DragsPerStep ? Color.green : Color.yellow);
		}

		host.UpdateProgressMeter();
		host.StartSignChangeAnimation(element, operation, () => FinalizeOperation(host, operation));
	}

	private static void FinalizeOperation(IBubbleOperationFlowHost host, StepOption operation)
	{
		if (host.CurrentStepDragCount >= host.DragsPerStep)
		{
			EquationState newState = host.ChoiceSystem != null
				? host.ChoiceSystem.ApplyOption(host.CurrentState, operation)
				: host.ApplyOperationToState(host.CurrentState, operation);

			host.CurrentState = newState;
			host.CurrentStepDragCount = 0;
			host.StepsCompletedForEquation++;
			host.SuccessCount = host.StepsCompletedForEquation;

			host.UpdateBubbleProgressBar(host.CurrentState);

			bool solvedNow = host.CurrentState.IsSolved();
			if (solvedNow)
			{
				host.ShowFeedback("Solved!", Color.green);
				host.StartSolvedFlow();
				host.StepsCompletedForEquation = host.StepsRequiredForEquation;
			}
			else
			{
				host.ResetCurrentStepPerformanceOutcomes();
				host.RefreshBubbleDisplay();
				host.ShowFeedback("Step Complete!", Color.green);
			}

			host.SuccessCount = host.StepsCompletedForEquation;
			if (solvedNow)
			{
				host.NotifyEquationSolved();
			}

			host.NotifyEquationUpdated();
		}
		else
		{
			host.RefreshBubbleDisplay();
		}

		host.UpdateProgressMeter();
		host.NotifySuccessCountChanged();
		host.NotifyDragOperationComplete();
		if (host.CurrentState == null || !host.CurrentState.IsSolved())
		{
			host.IsBubbleAnimating = false;
		}
	}
}
