using System;

/// <summary>
/// Lightweight runtime broker for perimeter formula data. Keeps the latest formula
/// alive across scene swaps and notifies interested UI/VFX systems when it changes.
/// </summary>
public static class ShapeFormulaRuntime
{
	public static event Action<ShapeFormulaRuntimeData> FormulaChanged;

	private static ShapeFormulaRuntimeData _current = ShapeFormulaRuntimeData.Empty;
	public static ShapeFormulaRuntimeData Current => _current;

	public static void SetFormula(in ShapeFormulaRuntimeData data)
	{
		_current = data;
		FormulaChanged?.Invoke(_current);
	}

	public static void Clear() => SetFormula(ShapeFormulaRuntimeData.Empty);
}
