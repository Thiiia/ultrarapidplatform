public static class AlgebraRuntimeConfig
{
	public static bool IsDemoMode { get; private set; } = true;
	public static bool AllowDecimals { get; private set; } = false;
	public static bool AllowFractions { get; private set; } = false;
	public static bool EnableSubstitution { get; private set; } = false;
	public static bool ExecutionOnlyDragDemo { get; private set; } = false;
	public static EquationDataSet.SchoolYear CurrentSchoolYear { get; private set; } = EquationDataSet.SchoolYear.Year7;

	public static bool AllowBrackets { get; private set; } = true;
	public static bool AllowVariablesOnBothSides { get; private set; } = true;

	public static int MaxAbsCoefficient { get; private set; } = 12;
	public static int MaxAbsConstantNumerator { get; private set; } = 60;
	public static int MaxAbsConstantDenominator { get; private set; } = 12;

	public static void SetDemoMode(bool isDemoMode)
	{
		IsDemoMode = isDemoMode;
	}

	public static void SetEquationToggles(bool allowDecimals, bool allowFractions, bool enableSubstitution)
	{
		AllowDecimals = allowDecimals;
		AllowFractions = allowFractions;
		EnableSubstitution = enableSubstitution;
	}

	public static void SetEquationConstraints(
		bool allowBrackets,
		bool allowVariablesOnBothSides,
		int maxAbsCoefficient,
		int maxAbsConstantNumerator,
		int maxAbsConstantDenominator)
	{
		AllowBrackets = allowBrackets;
		AllowVariablesOnBothSides = allowVariablesOnBothSides;
		MaxAbsCoefficient = maxAbsCoefficient > 0 ? maxAbsCoefficient : MaxAbsCoefficient;
		MaxAbsConstantNumerator = maxAbsConstantNumerator > 0 ? maxAbsConstantNumerator : MaxAbsConstantNumerator;
		MaxAbsConstantDenominator = maxAbsConstantDenominator > 0 ? maxAbsConstantDenominator : MaxAbsConstantDenominator;
	}

	public static void SetSchoolYear(EquationDataSet.SchoolYear year)
	{
		CurrentSchoolYear = year;
		ApplyDefaultsForYear(year);
	}

	private static void ApplyDefaultsForYear(EquationDataSet.SchoolYear year)
	{
		// Defaults tuned for "keep numbers readable" and to roughly map UK Year groups.
		// Content is still primarily controlled by the EquationDataSet lists.
		switch (year)
		{
			case EquationDataSet.SchoolYear.Year5:
				SetEquationToggles(allowDecimals: false, allowFractions: false, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: false, allowVariablesOnBothSides: false, maxAbsCoefficient: 6, maxAbsConstantNumerator: 20, maxAbsConstantDenominator: 6);
				break;
			case EquationDataSet.SchoolYear.Year6:
				SetEquationToggles(allowDecimals: false, allowFractions: false, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: false, allowVariablesOnBothSides: false, maxAbsCoefficient: 8, maxAbsConstantNumerator: 30, maxAbsConstantDenominator: 8);
				break;
			case EquationDataSet.SchoolYear.Year7:
				SetEquationToggles(allowDecimals: false, allowFractions: false, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: false, allowVariablesOnBothSides: false, maxAbsCoefficient: 10, maxAbsConstantNumerator: 40, maxAbsConstantDenominator: 10);
				break;
			case EquationDataSet.SchoolYear.Year8:
				SetEquationToggles(allowDecimals: false, allowFractions: false, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: true, allowVariablesOnBothSides: true, maxAbsCoefficient: 12, maxAbsConstantNumerator: 60, maxAbsConstantDenominator: 12);
				break;
			case EquationDataSet.SchoolYear.Year9:
				SetEquationToggles(allowDecimals: false, allowFractions: true, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: true, allowVariablesOnBothSides: true, maxAbsCoefficient: 15, maxAbsConstantNumerator: 80, maxAbsConstantDenominator: 16);
				break;
			case EquationDataSet.SchoolYear.Year10:
				SetEquationToggles(allowDecimals: true, allowFractions: true, enableSubstitution: false);
				SetEquationConstraints(allowBrackets: true, allowVariablesOnBothSides: true, maxAbsCoefficient: 20, maxAbsConstantNumerator: 120, maxAbsConstantDenominator: 20);
				break;
			case EquationDataSet.SchoolYear.Year11:
				SetEquationToggles(allowDecimals: true, allowFractions: true, enableSubstitution: true);
				SetEquationConstraints(allowBrackets: true, allowVariablesOnBothSides: true, maxAbsCoefficient: 25, maxAbsConstantNumerator: 150, maxAbsConstantDenominator: 24);
				break;
			case EquationDataSet.SchoolYear.Year12:
				SetEquationToggles(allowDecimals: true, allowFractions: true, enableSubstitution: true);
				SetEquationConstraints(allowBrackets: true, allowVariablesOnBothSides: true, maxAbsCoefficient: 40, maxAbsConstantNumerator: 250, maxAbsConstantDenominator: 40);
				break;
		}
	}

	public static void SetExecutionOnlyDragDemo(bool enabled)
	{
		ExecutionOnlyDragDemo = enabled;
	}
}
