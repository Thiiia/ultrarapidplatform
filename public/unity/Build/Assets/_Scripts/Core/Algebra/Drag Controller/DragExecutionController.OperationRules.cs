using System;
using System.Collections.Generic;
using UnityEngine;

public partial class DragExecutionController
{
	private EquationBubbleElement GetTargetDropZoneForElement(EquationBubbleElement element)
	{
		if (!enableBidirectionalDropZones || leftDropZone == null || rightDropZone == null || element == null)
		{
			return rightDropZone != null ? rightDropZone : currentDropZone;
		}

		// Drag across the equals: left terms target RHS, right terms target LHS.
		return element.EquationSide == 0 ? rightDropZone : leftDropZone;
	}

	private void UpdateBubbleInteractabilityForCurrentState()
	{
		bool gateMoves = preventWrongMoves || restrictToOptimalMoves;
		if (!gateMoves || choiceSystem == null || currentState == null)
		{
			return;
		}

		List<StepOption> options = choiceSystem.GenerateAvailableOptions(currentState);
		if (options == null || options.Count == 0)
		{
			return;
		}

		for (int i = 0; i < bubbleElements.Count; i++)
		{
			EquationBubbleElement bubble = bubbleElements[i];
			if (bubble == null)
				continue;

			// Only gate actual draggable tokens; don't mess with drop zones or passive variable bubbles.
			// Exception: "-x" uses a draggable variable bubble to allow MultiplyByNegativeOne once in "-x = b" form.
			if (bubble.ElementType != BubbleElementType.Constant &&
				bubble.ElementType != BubbleElementType.Coefficient &&
				!(bubble.ElementType == BubbleElementType.Variable && bubble.NumericValue == -1))
				continue;

			StepOption op = DetermineBubbleOperation(bubble);
			if (op == null)
			{
				bubble.SetInteractable(false);
				continue;
			}

			bool allowed = false;
			for (int j = 0; j < options.Count; j++)
			{
				StepOption opt = options[j];
				if (opt == null)
					continue;

				if (!OperationsMatch(opt, op))
					continue;

				if (restrictToOptimalMoves && !opt.isOptimal)
					continue;

				allowed = true;
				break;
			}

			bubble.SetInteractable(allowed);
		}
	}

	private void RecomputeStepProgressTargets(EquationState state)
	{
		stepsRequiredForEquation = Mathf.Max(1, EstimateStepsToSolve(state));
		stepsCompletedForEquation = Mathf.Clamp(stepsCompletedForEquation, 0, stepsRequiredForEquation);
		currentStepRequiredDrags = ResolveStepRequiredDragCount(state);
		UpdateProgressMeter();
	}

	private int GetCurrentRequiredDragsForStep()
	{
		if (currentStepRequiredDrags <= 0)
		{
			currentStepRequiredDrags = ResolveStepRequiredDragCount(currentState);
		}

		return Mathf.Max(1, currentStepRequiredDrags);
	}

	private int ResolveStepRequiredDragCount(EquationState state)
	{
		int fallback = Mathf.Max(1, dragsPerStep);
		if (!deriveStepRepetitionsFromOptimalTarget || choiceSystem == null || state == null || state.IsSolved())
		{
			return fallback;
		}

		List<StepOption> options = choiceSystem.GenerateAvailableOptions(state);
		if (options == null || options.Count == 0)
		{
			return fallback;
		}

		StepOption target = options.Find(o => o != null && o.isOptimal) ?? options[0];
		if (target == null)
		{
			return fallback;
		}

		switch (target.operationType)
		{
			case OperationType.MultiplyByNegativeOne:
				return ClampDerivedRepetitionCount(1);

			case OperationType.ExpandBrackets:
			case OperationType.CombineLikeTerms:
			case OperationType.SubstituteValue:
				return ClampDerivedRepetitionCount(derivedSpecialOperationRepetitions);

			case OperationType.AddConstant:
			case OperationType.SubtractConstant:
			case OperationType.AddVariable:
			case OperationType.SubtractVariable:
			case OperationType.DivideByCoefficient:
			{
				if (target.valueDenominator != 1)
				{
					return fallback;
				}

				int magnitude = Mathf.Abs(target.value);
				if (magnitude <= 0)
				{
					return fallback;
				}

				if (target.operationType == OperationType.DivideByCoefficient)
				{
					return ClampDerivedRepetitionCount(MapDivisionMagnitudeToRepetitions(magnitude));
				}

				return ClampDerivedRepetitionCount(MapMoveMagnitudeToRepetitions(magnitude));
			}
		}

		return fallback;
	}

	private int ClampDerivedRepetitionCount(int count)
	{
		int min = Mathf.Max(1, derivedStepRepetitionMin);
		int max = Mathf.Max(min, derivedStepRepetitionMax);
		return Mathf.Clamp(count, min, max);
	}

	private static int MapMoveMagnitudeToRepetitions(int magnitude)
	{
		if (magnitude <= 4)
		{
			return magnitude;
		}

		if (magnitude <= 8)
		{
			return 4;
		}

		return 5;
	}

	private static int MapDivisionMagnitudeToRepetitions(int magnitude)
	{
		if (magnitude <= 3)
		{
			return magnitude;
		}

		if (magnitude <= 6)
		{
			return 3;
		}

		return 4;
	}

	private int EstimateStepsToSolve(EquationState state)
	{
		if (state == null)
			return 1;

		EquationState temp = state.Clone();
		int steps = 0;
		int guard = 16;

		while (guard-- > 0 && temp != null && !temp.IsSolved())
		{
			StepOption best = null;
			if (choiceSystem != null)
			{
				List<StepOption> options = choiceSystem.GenerateAvailableOptions(temp);
				if (options != null && options.Count > 0)
				{
					best = options.Find(o => o != null && o.isOptimal) ?? options[0];
				}
			}

			if (best == null)
			{
				break;
			}

			temp = choiceSystem != null ? choiceSystem.ApplyOption(temp, best) : ApplyOperationToState(temp, best);
			steps++;
		}

		return Mathf.Max(1, steps);
	}

	private bool TryValidateBubbleOperation(EquationBubbleElement element, out StepOption operation, out bool isOptimal)
	{
		isOptimal = false;
		operation = DetermineBubbleOperation(element);
		if (operation == null || choiceSystem == null || currentState == null)
		{
			return operation != null;
		}

		List<StepOption> options = choiceSystem.GenerateAvailableOptions(currentState);
		if (options == null || options.Count == 0)
		{
			return false;
		}

		for (int i = 0; i < options.Count; i++)
		{
			StepOption opt = options[i];
			if (opt == null) continue;

			if (OperationsMatch(opt, operation))
			{
				isOptimal = opt.isOptimal;
				return true;
			}
		}

		return false;
	}

	private static bool OperationsMatch(StepOption a, StepOption b)
	{
		if (a == null || b == null)
			return false;

		if (a.operationType != b.operationType)
			return false;

		if (a.valueDenominator != b.valueDenominator)
			return false;

		return Mathf.Abs(a.value) == Mathf.Abs(b.value);
	}

	private StepOption DetermineBubbleOperation(EquationBubbleElement element)
	{
		return DragOperationService.DetermineOperation(currentState, GetMultiplySymbol(), GetDivideSymbol(), element);
	}

	private EquationState ApplyOperationToState(EquationState state, StepOption operation)
	{
		return DragOperationService.ApplyOperationToState(state, operation);
	}

	private void NotifyEquationSolved()
	{
		OnEquationSolved?.Invoke();
	}

	private void NotifyEquationUpdated()
	{
		OnEquationUpdated?.Invoke(currentState);
	}

	private void NotifySuccessCountChanged()
	{
		OnSuccessCountChanged?.Invoke(successCount);
	}

	private void NotifyDragOperationComplete()
	{
		OnDragOperationComplete?.Invoke();
	}

	EquationChoiceSystem IBubbleOperationFlowHost.ChoiceSystem => choiceSystem;

	EquationState IBubbleOperationFlowHost.CurrentState
	{
		get => currentState;
		set => currentState = value;
	}

	int IBubbleOperationFlowHost.CurrentStepDragCount
	{
		get => currentStepDragCount;
		set => currentStepDragCount = value;
	}

	int IBubbleOperationFlowHost.DragsPerStep => GetCurrentRequiredDragsForStep();

	int IBubbleOperationFlowHost.StepsCompletedForEquation
	{
		get => stepsCompletedForEquation;
		set => stepsCompletedForEquation = value;
	}

	int IBubbleOperationFlowHost.StepsRequiredForEquation
	{
		get => stepsRequiredForEquation;
		set => stepsRequiredForEquation = value;
	}

	int IBubbleOperationFlowHost.SuccessCount
	{
		get => successCount;
		set => successCount = value;
	}

	bool IBubbleOperationFlowHost.IsBubbleAnimating
	{
		get => isBubbleAnimating;
		set => isBubbleAnimating = value;
	}

	StepOption IBubbleOperationFlowHost.DetermineBubbleOperation(EquationBubbleElement element)
	{
		return DetermineBubbleOperation(element);
	}

	EquationState IBubbleOperationFlowHost.ApplyOperationToState(EquationState state, StepOption operation)
	{
		return ApplyOperationToState(state, operation);
	}

	void IBubbleOperationFlowHost.RecordCurrentStepPerformanceOutcome()
	{
		RecordCurrentStepPerformanceOutcome();
	}

	void IBubbleOperationFlowHost.ShowFeedback(string message, Color color)
	{
		ShowFeedback(message, color);
	}

	void IBubbleOperationFlowHost.UpdateProgressMeter()
	{
		UpdateProgressMeter();
	}

	void IBubbleOperationFlowHost.StartSignChangeAnimation(EquationBubbleElement element, StepOption operation, Action onComplete)
	{
		StartCoroutine(AnimateSignChange(element, operation, onComplete));
	}

	void IBubbleOperationFlowHost.UpdateBubbleProgressBar(EquationState state)
	{
		UpdateBubbleProgressBar(state);
	}

	void IBubbleOperationFlowHost.StartSolvedFlow()
	{
		StartCoroutine(PlaySolvedBurstAndReveal());
	}

	void IBubbleOperationFlowHost.ResetCurrentStepPerformanceOutcomes()
	{
		ResetCurrentStepPerformanceOutcomes();
	}

	void IBubbleOperationFlowHost.RefreshBubbleDisplay()
	{
		RefreshBubbleDisplay();
	}

	void IBubbleOperationFlowHost.NotifyEquationSolved()
	{
		NotifyEquationSolved();
	}

	void IBubbleOperationFlowHost.NotifyEquationUpdated()
	{
		NotifyEquationUpdated();
	}

	void IBubbleOperationFlowHost.NotifySuccessCountChanged()
	{
		NotifySuccessCountChanged();
	}

	void IBubbleOperationFlowHost.NotifyDragOperationComplete()
	{
		NotifyDragOperationComplete();
	}
}
