using UnityEngine;

public static class EquationPolicy
{
	public static bool IsEquationAllowed(LinearEquationParser.ParsedEquation parsed)
	{
		if (!AlgebraRuntimeConfig.AllowBrackets && parsed.hasBrackets)
			return false;

		if (!AlgebraRuntimeConfig.AllowVariablesOnBothSides && parsed.leftVarCoef != 0 && parsed.rightVarCoef != 0)
			return false;

		if (!IsCoefWithinBounds(parsed.leftVarCoef) || !IsCoefWithinBounds(parsed.rightVarCoef))
			return false;

		if (!IsConstWithinBounds(parsed.leftConst, parsed.leftConstDenominator))
			return false;

		if (!IsConstWithinBounds(parsed.rightConst, parsed.rightConstDenominator))
			return false;

		if (parsed.hasSubstitution)
		{
			if (!AlgebraRuntimeConfig.EnableSubstitution)
				return false;

			if (!IsConstWithinBounds(parsed.substitutionValue, parsed.substitutionValueDenominator))
				return false;

			if (!IsCoefWithinBounds(parsed.substitutionVarCoef))
				return false;

			if (!IsConstWithinBounds(parsed.substitutionConst, parsed.substitutionConstDenominator))
				return false;
		}

		return true;
	}

	public static bool IsStateWithinBounds(EquationState state)
	{
		if (state == null)
			return false;

		if (!AlgebraRuntimeConfig.AllowBrackets && state.hasBrackets)
			return false;

		if (!AlgebraRuntimeConfig.AllowVariablesOnBothSides && state.leftVarCoef != 0 && state.rightVarCoef != 0)
			return false;

		if (!IsCoefWithinBounds(state.leftVarCoef) || !IsCoefWithinBounds(state.rightVarCoef))
			return false;

		if (!IsConstWithinBounds(state.leftConst, state.leftConstDenominator))
			return false;

		if (!IsConstWithinBounds(state.rightConst, state.rightConstDenominator))
			return false;

		if (state.hasSubstitution)
		{
			if (!IsConstWithinBounds(state.substitutionValue, state.substitutionValueDenominator))
				return false;
			if (!IsCoefWithinBounds(state.substitutionVarCoef))
				return false;
			if (!IsConstWithinBounds(state.substitutionConst, state.substitutionConstDenominator))
				return false;
		}

		return true;
	}

	private static bool IsCoefWithinBounds(int coef)
	{
		int limit = AlgebraRuntimeConfig.MaxAbsCoefficient;
		return limit <= 0 || Mathf.Abs(coef) <= limit;
	}

	private static bool IsConstWithinBounds(int numerator, int denominator)
	{
		if (denominator == 0)
			denominator = 1;

		int numLimit = AlgebraRuntimeConfig.MaxAbsConstantNumerator;
		int denLimit = AlgebraRuntimeConfig.MaxAbsConstantDenominator;

		if (denLimit > 0 && Mathf.Abs(denominator) > denLimit)
			return false;

		if (numLimit > 0 && Mathf.Abs(numerator) > numLimit)
			return false;

		return true;
	}
}
