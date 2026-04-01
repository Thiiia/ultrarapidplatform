public enum EquationSkillTag
{
	Unknown = 0,
	MoveConstant = 1,
	MoveVariable = 2,
	DivideByCoefficient = 3,
	ExpandBrackets = 4,
	Substitution = 5,
	SignFlip = 6,
	MixedMultiStep = 7
}

public static class EquationSkillTagUtility
{
	public static EquationSkillTag InferFromEquation(string equation)
	{
		string normalizedEquation = EquationStringUtil.NormalizeForParsing(equation);
		if (string.IsNullOrWhiteSpace(normalizedEquation))
			return EquationSkillTag.Unknown;

		if (normalizedEquation.StartsWith("SUB:", System.StringComparison.OrdinalIgnoreCase))
			return EquationSkillTag.Substitution;

		if (!LinearEquationParser.TryParse(
			normalizedEquation,
			allowDecimals: true,
			allowFractions: true,
			enableSubstitution: true,
			out LinearEquationParser.ParsedEquation parsed))
		{
			return EquationSkillTag.Unknown;
		}

		if (parsed.hasBrackets)
			return EquationSkillTag.ExpandBrackets;

		bool simplified = parsed.leftConst == 0 && parsed.rightVarCoef == 0;
		if (simplified && UnityEngine.Mathf.Abs(parsed.leftVarCoef) > 1)
			return EquationSkillTag.DivideByCoefficient;

		if (simplified && parsed.leftVarCoef < 0)
			return EquationSkillTag.SignFlip;

		if (parsed.rightVarCoef != 0)
			return EquationSkillTag.MoveVariable;

		if (parsed.leftConst != 0 || parsed.rightConst != 0)
			return EquationSkillTag.MoveConstant;

		return EquationSkillTag.MixedMultiStep;
	}

	public static EquationSkillTag FromOperationType(OperationType operationType)
	{
		switch (operationType)
		{
			case OperationType.AddConstant:
			case OperationType.SubtractConstant:
				return EquationSkillTag.MoveConstant;
			case OperationType.AddVariable:
			case OperationType.SubtractVariable:
				return EquationSkillTag.MoveVariable;
			case OperationType.DivideByCoefficient:
				return EquationSkillTag.DivideByCoefficient;
			case OperationType.ExpandBrackets:
				return EquationSkillTag.ExpandBrackets;
			case OperationType.SubstituteValue:
				return EquationSkillTag.Substitution;
			case OperationType.MultiplyByNegativeOne:
				return EquationSkillTag.SignFlip;
			default:
				return EquationSkillTag.Unknown;
		}
	}

	public static string ToStableKey(EquationSkillTag skillTag)
	{
		return skillTag.ToString().ToLowerInvariant();
	}
}
