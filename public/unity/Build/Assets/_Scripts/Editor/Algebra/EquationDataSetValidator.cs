#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

public static class EquationDataSetValidator
{
	private const string DataSetResourcePath = "EquationDataSet";

	private struct RuntimeConfigSnapshot
	{
		public EquationDataSet.SchoolYear schoolYear;
		public bool allowDecimals;
		public bool allowFractions;
		public bool enableSubstitution;
		public bool allowBrackets;
		public bool allowVariablesOnBothSides;
		public int maxAbsCoefficient;
		public int maxAbsConstantNumerator;
		public int maxAbsConstantDenominator;
	}

	private struct Issue
	{
		public bool fatal;
		public string message;
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Validate EquationDataSet")]
	public static void ValidateFromMenu()
	{
		EquationDataSet dataSet = LoadDataSet();
		if (dataSet == null)
		{
			Debug.LogError("[EquationDataSetValidator] Could not load Assets/Resources/EquationDataSet.asset");
			return;
		}

		Validate(dataSet, logAllIssues: true);
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Migrate Legacy Equations To Entries")]
	public static void MigrateLegacyToEntriesFromMenu()
	{
		EquationDataSet dataSet = LoadDataSet();
		if (dataSet == null)
		{
			Debug.LogError("[EquationDataSetValidator] Could not load Assets/Resources/EquationDataSet.asset");
			return;
		}

		int added = MigrateLegacyEquationsToEntries(dataSet);
		if (added <= 0)
		{
			Debug.Log("[EquationDataSetValidator] No legacy equations needed migration.");
			return;
		}

		EditorUtility.SetDirty(dataSet);
		AssetDatabase.SaveAssets();
		AssetDatabase.Refresh();
		Debug.Log($"[EquationDataSetValidator] Added {added} inferred metadata entries. Re-run validation next.");
	}

	public static bool Validate(EquationDataSet dataSet, bool logAllIssues)
	{
		if (dataSet == null)
			return false;

		List<Issue> issues = new List<Issue>(64);
		RuntimeConfigSnapshot snapshot = CaptureRuntimeConfig();

		try
		{
			List<EquationDataSet.DifficultyLevel> levels = dataSet.GetAllLevels();
			foreach (EquationDataSet.SchoolYear year in Enum.GetValues(typeof(EquationDataSet.SchoolYear)))
			{
				EquationDataSet.DifficultyLevel level = levels.Find(l => l != null && l.schoolYear == year);
				if (level == null)
				{
					issues.Add(Fatal($"Missing level for {year}."));
					continue;
				}

				AlgebraRuntimeConfig.SetSchoolYear(year);

				List<EquationEntry> runtimeEntries = dataSet.GetEntriesForYear(year);
				int minCount = GetMinimumCountForYear(year);
				if (runtimeEntries.Count < minCount)
				{
					issues.Add(Fatal($"{year}: expected at least {minCount} equations, found {runtimeEntries.Count}."));
				}

				ValidateCoverageExpectations(year, runtimeEntries, issues);

				if (level.entries == null || level.entries.Count == 0)
				{
					issues.Add(Fatal($"{year}: metadata entries list is empty. Populate DifficultyLevel.entries."));
				}
				else if (level.equations != null && level.entries.Count < level.equations.Count)
				{
					issues.Add(Fatal($"{year}: metadata entry count ({level.entries.Count}) is lower than legacy equation count ({level.equations.Count})."));
				}

				ValidateLegacyEquationStrings(level, year, issues);
				ValidateMetadataEntries(level, year, issues);
			}
		}
		finally
		{
			RestoreRuntimeConfig(snapshot);
		}

		int fatalCount = 0;
		for (int i = 0; i < issues.Count; i++)
		{
			if (issues[i].fatal)
				fatalCount++;

			if (!logAllIssues)
				continue;

			if (issues[i].fatal)
				Debug.LogError($"[EquationDataSetValidator] {issues[i].message}");
			else
				Debug.LogWarning($"[EquationDataSetValidator] {issues[i].message}");
		}

		if (fatalCount > 0)
		{
			Debug.LogError($"[EquationDataSetValidator] Validation failed: {fatalCount} fatal issues ({issues.Count} total)." );
			return false;
		}

		Debug.Log($"[EquationDataSetValidator] Validation passed with {issues.Count} non-fatal issues.");
		return true;
	}

	private static void ValidateLegacyEquationStrings(EquationDataSet.DifficultyLevel level, EquationDataSet.SchoolYear year, List<Issue> issues)
	{
		if (level == null || level.equations == null)
			return;

		for (int i = 0; i < level.equations.Count; i++)
		{
			string raw = level.equations[i];
			string normalized = EquationStringUtil.NormalizeForParsing(raw);
			if (string.IsNullOrWhiteSpace(normalized))
			{
				issues.Add(Fatal($"{year} legacy equation[{i}] is empty."));
				continue;
			}

			if (!LinearEquationParser.TryParse(
				normalized,
				AlgebraRuntimeConfig.AllowDecimals,
				AlgebraRuntimeConfig.AllowFractions,
				AlgebraRuntimeConfig.EnableSubstitution,
				out LinearEquationParser.ParsedEquation parsed))
			{
				issues.Add(Fatal($"{year} legacy equation[{i}] failed parse: '{normalized}'"));
				continue;
			}

			if (!EquationPolicy.IsEquationAllowed(parsed))
			{
				issues.Add(Fatal($"{year} legacy equation[{i}] failed policy bounds: '{normalized}'"));
				continue;
			}

			if (ViolatesYearSpecificGuidance(year, parsed, out string guidanceReason))
				issues.Add(Fatal($"{year} legacy equation[{i}] violates year guidance ({guidanceReason}): '{normalized}'"));
		}
	}

	private static void ValidateMetadataEntries(EquationDataSet.DifficultyLevel level, EquationDataSet.SchoolYear year, List<Issue> issues)
	{
		if (level == null || level.entries == null)
			return;

		for (int i = 0; i < level.entries.Count; i++)
		{
			EquationEntry entry = level.entries[i];
			if (entry == null)
			{
				issues.Add(Fatal($"{year} entry[{i}] is null."));
				continue;
			}

			string normalized = entry.GetNormalizedEquation();
			if (string.IsNullOrWhiteSpace(normalized))
			{
				issues.Add(Fatal($"{year} entry[{i}] has empty equation text."));
				continue;
			}

			if (string.IsNullOrWhiteSpace(entry.id))
				issues.Add(Fatal($"{year} entry[{i}] missing id."));

			if (entry.skillTag == EquationSkillTag.Unknown)
				issues.Add(Fatal($"{year} entry[{i}] missing skillTag (Unknown)."));

			if (entry.estimatedSteps < 1 || entry.estimatedSteps > 6)
				issues.Add(Fatal($"{year} entry[{i}] estimatedSteps out of range [1..6]: {entry.estimatedSteps}"));

			if (entry.complexityScore < 1 || entry.complexityScore > 10)
				issues.Add(Fatal($"{year} entry[{i}] complexityScore out of range [1..10]: {entry.complexityScore}"));

			if (!LinearEquationParser.TryParse(
				normalized,
				AlgebraRuntimeConfig.AllowDecimals,
				AlgebraRuntimeConfig.AllowFractions,
				AlgebraRuntimeConfig.EnableSubstitution,
				out LinearEquationParser.ParsedEquation parsed))
			{
				issues.Add(Fatal($"{year} entry[{i}] failed parse: '{normalized}'"));
				continue;
			}

			if (!EquationPolicy.IsEquationAllowed(parsed))
			{
				issues.Add(Fatal($"{year} entry[{i}] failed policy bounds: '{normalized}'"));
				continue;
			}

			if (ViolatesYearSpecificGuidance(year, parsed, out string guidanceReason))
				issues.Add(Fatal($"{year} entry[{i}] violates year guidance ({guidanceReason}): '{normalized}'"));
		}
	}

	private static bool ViolatesYearSpecificGuidance(EquationDataSet.SchoolYear year, LinearEquationParser.ParsedEquation parsed, out string reason)
	{
		reason = string.Empty;

		if (year == EquationDataSet.SchoolYear.Year6)
		{
			if (parsed.leftConstDenominator != 1 || parsed.rightConstDenominator != 1)
			{
				reason = "Year 6 disallows fractions/decimals";
				return true;
			}

			if (parsed.leftVarCoef < 0 || parsed.rightVarCoef < 0 || parsed.leftConst < 0 || parsed.rightConst < 0)
			{
				reason = "Year 6 disallows negatives";
				return true;
			}

			if (Mathf.Abs(parsed.leftVarCoef) > 99 || Mathf.Abs(parsed.rightVarCoef) > 99 ||
			    Mathf.Abs(parsed.leftConst) > 99 || Mathf.Abs(parsed.rightConst) > 99)
			{
				reason = "Year 6 values must be <= 99";
				return true;
			}
		}

		if (year == EquationDataSet.SchoolYear.Year7 && WouldSolveToNegative(parsed))
		{
			reason = "Year 7 avoids negative solutions";
			return true;
		}

		return false;
	}

	private static void ValidateCoverageExpectations(EquationDataSet.SchoolYear year, List<EquationEntry> runtimeEntries, List<Issue> issues)
	{
		if (runtimeEntries == null || runtimeEntries.Count == 0)
			return;

		HashSet<EquationSkillTag> skills = new HashSet<EquationSkillTag>();
		int minComplexity = int.MaxValue;
		int maxComplexity = int.MinValue;
		int minSteps = int.MaxValue;
		int maxSteps = int.MinValue;
		bool hasFractions = false;
		bool hasDecimals = false;
		bool hasBrackets = false;
		bool hasSubstitution = false;

		for (int i = 0; i < runtimeEntries.Count; i++)
		{
			EquationEntry entry = runtimeEntries[i];
			if (entry == null)
				continue;

			skills.Add(entry.skillTag);
			minComplexity = Mathf.Min(minComplexity, entry.complexityScore);
			maxComplexity = Mathf.Max(maxComplexity, entry.complexityScore);
			minSteps = Mathf.Min(minSteps, entry.estimatedSteps);
			maxSteps = Mathf.Max(maxSteps, entry.estimatedSteps);

			string normalized = entry.GetNormalizedEquation();
			if (string.IsNullOrWhiteSpace(normalized))
				continue;

			if (normalized.StartsWith("SUB:", StringComparison.OrdinalIgnoreCase))
				hasSubstitution = true;

			if (!LinearEquationParser.TryParse(
				normalized,
				allowDecimals: true,
				allowFractions: true,
				enableSubstitution: true,
				out LinearEquationParser.ParsedEquation parsed))
			{
				continue;
			}

			if (parsed.hasBrackets)
				hasBrackets = true;
			if (parsed.leftConstDenominator > 1 || parsed.rightConstDenominator > 1 || parsed.substitutionValueDenominator > 1 || parsed.substitutionConstDenominator > 1)
				hasFractions = true;
			if (normalized.Contains("."))
				hasDecimals = true;
			if (parsed.hasSubstitution)
				hasSubstitution = true;
		}

		if (skills.Count < 3)
			issues.Add(Warning($"{year}: only {skills.Count} distinct skill families present."));

		if (maxComplexity < minComplexity + 2)
			issues.Add(Warning($"{year}: complexity spread is shallow ({minComplexity}..{maxComplexity})."));

		if (year >= EquationDataSet.SchoolYear.Year8 && !skills.Contains(EquationSkillTag.MoveVariable))
			issues.Add(Warning($"{year}: expected variable-on-both-sides coverage but none was found."));

		if (year >= EquationDataSet.SchoolYear.Year8 && !hasBrackets)
			issues.Add(Warning($"{year}: expected bracket-expansion coverage but none was found."));

		if (year >= EquationDataSet.SchoolYear.Year9 && !hasFractions)
			issues.Add(Warning($"{year}: expected fraction coverage but none was found."));

		if (year >= EquationDataSet.SchoolYear.Year10 && !hasDecimals)
			issues.Add(Warning($"{year}: expected decimal coverage but none was found."));

		if (year >= EquationDataSet.SchoolYear.Year11 && !hasSubstitution)
			issues.Add(Warning($"{year}: expected substitution coverage but none was found."));

		if (year >= EquationDataSet.SchoolYear.Year9 && maxSteps < 3)
			issues.Add(Warning($"{year}: highest estimated step count is only {maxSteps}."));
	}

	private static bool WouldSolveToNegative(LinearEquationParser.ParsedEquation parsed)
	{
		double a = parsed.leftVarCoef - parsed.rightVarCoef;
		if (Math.Abs(a) < 0.000001d)
			return false;

		double leftConst = parsed.leftConstDenominator != 0
			? parsed.leftConst / (double)parsed.leftConstDenominator
			: parsed.leftConst;
		double rightConst = parsed.rightConstDenominator != 0
			? parsed.rightConst / (double)parsed.rightConstDenominator
			: parsed.rightConst;

		double b = rightConst - leftConst;
		double x = b / a;
		return x < 0d;
	}

	private static int MigrateLegacyEquationsToEntries(EquationDataSet dataSet)
	{
		if (dataSet == null)
			return 0;

		int added = 0;
		List<EquationDataSet.DifficultyLevel> levels = dataSet.GetAllLevels();
		for (int i = 0; i < levels.Count; i++)
		{
			EquationDataSet.DifficultyLevel level = levels[i];
			if (level == null)
				continue;

			if (level.entries == null)
				level.entries = new List<EquationEntry>();

			HashSet<string> existing = new HashSet<string>();
			for (int e = 0; e < level.entries.Count; e++)
			{
				EquationEntry entry = level.entries[e];
				if (entry == null)
					continue;
				string normalizedExisting = entry.GetNormalizedEquation();
				if (!string.IsNullOrWhiteSpace(normalizedExisting))
					existing.Add(normalizedExisting);
			}

			if (level.equations == null)
				continue;

			for (int q = 0; q < level.equations.Count; q++)
			{
				string normalized = EquationStringUtil.NormalizeForParsing(level.equations[q]);
				if (string.IsNullOrWhiteSpace(normalized) || !existing.Add(normalized))
					continue;

				EquationEntry inferred = CreateInferredEntry(normalized, level.schoolYear, level.entries.Count + 1);
				level.entries.Add(inferred);
				added++;
			}
		}

		return added;
	}

	private static EquationEntry CreateInferredEntry(string normalizedEquation, EquationDataSet.SchoolYear year, int fallbackIndex)
	{
		EquationSkillTag skillTag = InferSkillTag(normalizedEquation);
		int estimatedSteps = InferEstimatedSteps(normalizedEquation);
		int complexity = InferComplexityScore(normalizedEquation);

		return new EquationEntry
		{
			id = EquationEntryUtility.BuildFallbackId(normalizedEquation, year, fallbackIndex),
			equation = normalizedEquation,
			skillTag = skillTag,
			estimatedSteps = Mathf.Clamp(estimatedSteps, 1, 6),
			complexityScore = Mathf.Clamp(complexity, 1, 10)
		};
	}

	private static EquationSkillTag InferSkillTag(string normalizedEquation)
	{
		if (string.IsNullOrWhiteSpace(normalizedEquation))
			return EquationSkillTag.Unknown;

		if (normalizedEquation.StartsWith("SUB:", StringComparison.OrdinalIgnoreCase))
			return EquationSkillTag.Substitution;

		if (!LinearEquationParser.TryParse(normalizedEquation, allowDecimals: true, allowFractions: true, enableSubstitution: true, out LinearEquationParser.ParsedEquation parsed))
			return EquationSkillTag.Unknown;

		if (parsed.hasBrackets)
			return EquationSkillTag.ExpandBrackets;

		bool simplified = parsed.leftConst == 0 && parsed.rightVarCoef == 0;
		if (simplified && Mathf.Abs(parsed.leftVarCoef) > 1)
			return EquationSkillTag.DivideByCoefficient;

		if (simplified && parsed.leftVarCoef < 0)
			return EquationSkillTag.SignFlip;

		if (parsed.rightVarCoef != 0)
			return EquationSkillTag.MoveVariable;

		if (parsed.leftConst != 0 || parsed.rightConst != 0)
			return EquationSkillTag.MoveConstant;

		return EquationSkillTag.MixedMultiStep;
	}

	private static int InferEstimatedSteps(string normalizedEquation)
	{
		if (!LinearEquationParser.TryParse(normalizedEquation, allowDecimals: true, allowFractions: true, enableSubstitution: true, out LinearEquationParser.ParsedEquation parsed))
			return 2;

		int steps = 1;
		if (parsed.hasBrackets)
			steps++;
		if (parsed.rightVarCoef != 0)
			steps++;
		if (parsed.leftConst != 0 || parsed.rightConst != 0)
			steps++;
		if (Mathf.Abs(parsed.leftVarCoef - parsed.rightVarCoef) > 1)
			steps++;
		return Mathf.Clamp(steps, 1, 6);
	}

	private static int InferComplexityScore(string normalizedEquation)
	{
		if (!LinearEquationParser.TryParse(normalizedEquation, allowDecimals: true, allowFractions: true, enableSubstitution: true, out LinearEquationParser.ParsedEquation parsed))
			return 3;

		int complexity = 1;
		complexity += Mathf.Clamp(Mathf.Abs(parsed.leftVarCoef) + Mathf.Abs(parsed.rightVarCoef), 0, 5) / 2;
		complexity += Mathf.Clamp(Mathf.Abs(parsed.leftConst) + Mathf.Abs(parsed.rightConst), 0, 20) / 5;
		if (parsed.leftConstDenominator > 1 || parsed.rightConstDenominator > 1)
			complexity += 2;
		if (parsed.hasBrackets)
			complexity += 2;
		if (parsed.hasSubstitution)
			complexity += 2;
		return Mathf.Clamp(complexity, 1, 10);
	}

	private static int GetMinimumCountForYear(EquationDataSet.SchoolYear year)
	{
		switch (year)
		{
			case EquationDataSet.SchoolYear.Year5:
			case EquationDataSet.SchoolYear.Year6:
			case EquationDataSet.SchoolYear.Year7:
			case EquationDataSet.SchoolYear.Year8:
				return 25;
			case EquationDataSet.SchoolYear.Year9:
			case EquationDataSet.SchoolYear.Year10:
			case EquationDataSet.SchoolYear.Year11:
			case EquationDataSet.SchoolYear.Year12:
				return 30;
			default:
				return 25;
		}
	}

	private static RuntimeConfigSnapshot CaptureRuntimeConfig()
	{
		return new RuntimeConfigSnapshot
		{
			schoolYear = AlgebraRuntimeConfig.CurrentSchoolYear,
			allowDecimals = AlgebraRuntimeConfig.AllowDecimals,
			allowFractions = AlgebraRuntimeConfig.AllowFractions,
			enableSubstitution = AlgebraRuntimeConfig.EnableSubstitution,
			allowBrackets = AlgebraRuntimeConfig.AllowBrackets,
			allowVariablesOnBothSides = AlgebraRuntimeConfig.AllowVariablesOnBothSides,
			maxAbsCoefficient = AlgebraRuntimeConfig.MaxAbsCoefficient,
			maxAbsConstantNumerator = AlgebraRuntimeConfig.MaxAbsConstantNumerator,
			maxAbsConstantDenominator = AlgebraRuntimeConfig.MaxAbsConstantDenominator
		};
	}

	private static void RestoreRuntimeConfig(RuntimeConfigSnapshot snapshot)
	{
		AlgebraRuntimeConfig.SetSchoolYear(snapshot.schoolYear);
		AlgebraRuntimeConfig.SetEquationToggles(snapshot.allowDecimals, snapshot.allowFractions, snapshot.enableSubstitution);
		AlgebraRuntimeConfig.SetEquationConstraints(
			snapshot.allowBrackets,
			snapshot.allowVariablesOnBothSides,
			snapshot.maxAbsCoefficient,
			snapshot.maxAbsConstantNumerator,
			snapshot.maxAbsConstantDenominator);
	}

	private static Issue Fatal(string message)
	{
		return new Issue { fatal = true, message = message };
	}

	private static Issue Warning(string message)
	{
		return new Issue { fatal = false, message = message };
	}

	private static EquationDataSet LoadDataSet()
	{
		EquationDataSet dataSet = Resources.Load<EquationDataSet>(DataSetResourcePath);
		if (dataSet != null)
			return dataSet;

		string[] guids = AssetDatabase.FindAssets("t:EquationDataSet");
		if (guids == null || guids.Length == 0)
			return null;

		string assetPath = AssetDatabase.GUIDToAssetPath(guids[0]);
		return AssetDatabase.LoadAssetAtPath<EquationDataSet>(assetPath);
	}
}
#endif
