using UnityEngine;

internal static class DragOperationService
{
	internal static StepOption DetermineOperation(EquationState currentState, string multiplySymbol, string divideSymbol, EquationBubbleElement element)
	{
		int value = element.NumericValue;
		int side = element.EquationSide;
		BubbleElementType type = element.ElementType;

		// Special: allow dragging the "-x" bubble once the equation is in "-x = b" form.
		// This triggers MultiplyByNegativeOne so the player can get "x = ..." and not be stuck.
		if (type == BubbleElementType.Variable)
		{
			if (currentState != null && value == -1)
			{
				bool leftForm = side == 0 &&
					currentState.leftVarCoef == -1 &&
					currentState.leftConst == 0 &&
					currentState.rightVarCoef == 0;
				bool rightForm = side == 1 &&
					currentState.rightVarCoef == -1 &&
					currentState.rightConst == 0 &&
					currentState.leftVarCoef == 0;
				if (leftForm || rightForm)
				{
					return new StepOption($"{multiplySymbol} (-1)", OperationType.MultiplyByNegativeOne, -1, true);
				}
			}

			return null;
		}

		if (type == BubbleElementType.Constant)
		{
			int magnitude = Mathf.Abs(value);
			bool termIsNegative = element.IsNegative || value < 0;

			// Moving constant across equals:
			// Left -> Right: subtract if +c, add if -c
			// Right -> Left: subtract if +c, add if -c (same operation, just interpreted as moving the term)
			if (termIsNegative)
			{
				return new StepOption($"+ {magnitude}", OperationType.AddConstant, magnitude, true);
			}

			return new StepOption($"- {magnitude}", OperationType.SubtractConstant, magnitude, true);
		}

		if (type == BubbleElementType.Coefficient)
		{
			// Two cases:
			// 1) If equation is in ax = b (or -ax = b) form, dragging coefficient performs divide.
			// 2) Otherwise treat it as moving a variable term across the equals (a rough MVP behavior).
			int abs = Mathf.Abs(value);
			bool termIsNegative = element.IsNegative || value < 0;

			if (currentState != null &&
				currentState.rightVarCoef == 0 &&
				currentState.leftConst == 0 &&
				abs > 0 &&
				Mathf.Abs(currentState.leftVarCoef) == abs)
			{
				// Special case: -x = b (coefficient is -1). Dividing by 1 does nothing, so we treat this as
				// multiplying both sides by -1 to make the variable positive.
				if (abs == 1 && currentState.leftVarCoef < 0)
				{
					return new StepOption($"{multiplySymbol} (-1)", OperationType.MultiplyByNegativeOne, -1, true);
				}

				return new StepOption($"{divideSymbol} {abs}", OperationType.DivideByCoefficient, abs, true);
			}

			// Move variable term across equals (uses coefficient as the amount).
			if (termIsNegative)
			{
				return new StepOption($"+ {abs}x", OperationType.AddVariable, abs, true);
			}

			return new StepOption($"- {abs}x", OperationType.SubtractVariable, abs, true);
		}

		return null;
	}

	internal static EquationState ApplyOperationToState(EquationState state, StepOption operation)
	{
		EquationState newState = state.Clone();

		switch (operation.operationType)
		{
			case OperationType.SubtractConstant:
				newState.leftConst -= operation.value;
				newState.rightConst -= operation.value;
				break;

			case OperationType.AddConstant:
				newState.leftConst += operation.value;
				newState.rightConst += operation.value;
				break;

			case OperationType.SubtractVariable:
				newState.leftVarCoef -= operation.value;
				newState.rightVarCoef -= operation.value;
				break;

			case OperationType.AddVariable:
				newState.leftVarCoef += operation.value;
				newState.rightVarCoef += operation.value;
				break;

			case OperationType.MultiplyByNegativeOne:
				newState.leftVarCoef = -newState.leftVarCoef;
				newState.leftConst = -newState.leftConst;
				newState.rightVarCoef = -newState.rightVarCoef;
				newState.rightConst = -newState.rightConst;
				break;

			case OperationType.DivideByCoefficient:
				if (operation.value != 0)
				{
					// MVP integer-only fallback. For fractions/decimals, ensure EquationChoiceSystem is wired.
					newState.leftVarCoef = newState.leftVarCoef < 0 ? -1 : 1;
					newState.rightConst /= operation.value;
				}
				break;
		}

		return newState;
	}
}
