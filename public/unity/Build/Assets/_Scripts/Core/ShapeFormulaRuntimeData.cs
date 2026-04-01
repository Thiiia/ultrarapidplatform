using System;

/// <summary>
/// Runtime payload describing the active perimeter formula (variables, expression, computed totals).
/// Persisted across scenes so quiz/question flows can reuse the same values.
/// </summary>
[Serializable]
public struct ShapeFormulaRuntimeData
{
	public string formulaName;
	public string expression;
	public string resolvedExpression;
	public string unitSuffix;
	public string formattedTotal;
	public float totalValue;
	public ShapeFormulaTermValue[] values;

	public bool HasValues => values != null && values.Length > 0;
	public bool IsValid => !string.IsNullOrEmpty(formulaName) && HasValues;

	public static ShapeFormulaRuntimeData Empty => new ShapeFormulaRuntimeData
	{
		formulaName = string.Empty,
		expression = string.Empty,
		resolvedExpression = string.Empty,
		unitSuffix = string.Empty,
		formattedTotal = string.Empty,
		totalValue = 0f,
		values = Array.Empty<ShapeFormulaTermValue>()
	};
}

[Serializable]
public struct ShapeFormulaTermValue
{
	public string variableName;
	public float value;
	public string formattedValue;
	public string unit;
	public string segmentId;
	public int segmentIndex;
	public float coefficient;
}
