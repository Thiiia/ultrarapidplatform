#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEditor;
using UnityEngine;

public static class EquationDataSetCurriculumSeeder
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

	private struct EquationSeed
	{
		public string equation;
		public EquationSkillTag skillTag;
		public int estimatedSteps;
		public int complexityScore;
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Seed Year 5-12 Curriculum Bank")]
	public static void SeedCurriculumBank()
	{
		EquationDataSet dataSet = LoadDataSet();
		if (dataSet == null)
		{
			Debug.LogError("[EquationDataSetCurriculumSeeder] Could not load EquationDataSet asset.");
			return;
		}

		RuntimeConfigSnapshot snapshot = CaptureRuntimeConfig();
		int totalEntriesWritten = 0;

		try
		{
			foreach (EquationDataSet.SchoolYear year in Enum.GetValues(typeof(EquationDataSet.SchoolYear)))
			{
				AlgebraRuntimeConfig.SetSchoolYear(year);
				int minimumCount = GetMinimumCountForYear(year);
				List<EquationSeed> seeds = BuildSeedsForYear(year, minimumCount);
				if (seeds.Count < minimumCount)
				{
					Debug.LogError($"[EquationDataSetCurriculumSeeder] {year}: generated {seeds.Count}, expected at least {minimumCount}. Skipping this year.");
					continue;
				}

				EquationDataSet.DifficultyLevel level = GetOrCreateLevel(dataSet, year);
				level.entries = new List<EquationEntry>(minimumCount);
				level.equations = new List<string>(minimumCount);

				for (int i = 0; i < minimumCount; i++)
				{
					EquationSeed seed = seeds[i];
					string id = BuildEntryId(year, i, seed.skillTag);

					level.entries.Add(new EquationEntry
					{
						id = id,
						equation = seed.equation,
						skillTag = seed.skillTag,
						estimatedSteps = Mathf.Clamp(seed.estimatedSteps, 1, 6),
						complexityScore = Mathf.Clamp(seed.complexityScore, 1, 10)
					});
					level.equations.Add(seed.equation);
				}

				totalEntriesWritten += minimumCount;
				Debug.Log($"[EquationDataSetCurriculumSeeder] {year}: seeded {minimumCount} equations.");
			}

			EditorUtility.SetDirty(dataSet);
			AssetDatabase.SaveAssets();
			AssetDatabase.Refresh();
		}
		finally
		{
			RestoreRuntimeConfig(snapshot);
		}

		Debug.Log($"[EquationDataSetCurriculumSeeder] Completed. Wrote {totalEntriesWritten} entries across Year 5-12.");
	}

	private static List<EquationSeed> BuildSeedsForYear(EquationDataSet.SchoolYear year, int targetCount)
	{
		List<EquationSeed> seeds = new List<EquationSeed>(targetCount + 12);
		HashSet<string> seen = new HashSet<string>();

		switch (year)
		{
			case EquationDataSet.SchoolYear.Year5:
				BuildYear5Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year6:
				BuildYear6Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year7:
				BuildYear7Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year8:
				BuildYear8Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year9:
				BuildYear9Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year10:
				BuildYear10Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year11:
				BuildYear11Seeds(year, seeds, seen);
				break;
			case EquationDataSet.SchoolYear.Year12:
				BuildYear12Seeds(year, seeds, seen);
				break;
		}

		if (seeds.Count < targetCount)
			BackfillSeeds(year, seeds, seen, targetCount);

		seeds.Sort(CompareSeeds);
		if (seeds.Count > targetCount)
			seeds.RemoveRange(targetCount, seeds.Count - targetCount);

		return seeds;
	}

	private static void BuildYear5Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 8; i++)
		{
			int x = 2 + i;
			int constant = 2 + (i % 4);
			TryAddSeed(year, seeds, seen, $"x+{constant}={x + constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 7; i++)
		{
			int x = 7 + i;
			int constant = 1 + (i % 4);
			TryAddSeed(year, seeds, seen, $"x-{constant}={x - constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 3 + i;
			int coefficient = 2 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x={coefficient * x}", EquationSkillTag.DivideByCoefficient);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 2 + i;
			int coefficient = 2 + (i % 3);
			int constant = 2 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x+{constant}={coefficient * x + constant}", EquationSkillTag.MixedMultiStep);
		}
	}

	private static void BuildYear6Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 6; i++)
		{
			int x = 6 + i;
			int constant = 4 + (i % 5);
			TryAddSeed(year, seeds, seen, $"x+{constant}={x + constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 10 + i;
			int constant = 2 + (i % 5);
			TryAddSeed(year, seeds, seen, $"x-{constant}={x - constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 4 + i;
			int coefficient = 3 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x={coefficient * x}", EquationSkillTag.DivideByCoefficient);
		}

		for (int i = 0; i < 4; i++)
		{
			int x = 3 + i;
			int coefficient = 3 + (i % 4);
			int constant = 4 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x+{constant}={coefficient * x + constant}", EquationSkillTag.MixedMultiStep);
		}

		for (int i = 0; i < 3; i++)
		{
			int x = 8 + i;
			int coefficient = 2 + i;
			int constant = 3 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x-{constant}={coefficient * x - constant}", EquationSkillTag.MixedMultiStep);
		}
	}

	private static void BuildYear7Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 4; i++)
		{
			int x = 5 + i;
			int constant = 3 + i;
			TryAddSeed(year, seeds, seen, $"x+{constant}={x + constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 4; i++)
		{
			int x = 9 + i;
			int constant = 2 + i;
			TryAddSeed(year, seeds, seen, $"x-{constant}={x - constant}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 3 + i;
			int coefficient = 4 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x={coefficient * x}", EquationSkillTag.DivideByCoefficient);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 3 + i;
			int coefficient = 3 + (i % 4);
			int constant = 2 + i;
			string equation = i % 2 == 0
				? $"{coefficient}x+{constant}={coefficient * x + constant}"
				: $"{coefficient}x-{constant}={coefficient * x - constant}";
			TryAddSeed(year, seeds, seen, equation, EquationSkillTag.MixedMultiStep);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int coefficient = 2 + (i % 4);
			int constant = 9 + i;
			TryAddSeed(year, seeds, seen, $"-{coefficient}x+{constant}={-coefficient * x + constant}", EquationSkillTag.SignFlip);
		}
	}

	private static void BuildYear8Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 5; i++)
		{
			int x = 3 + i;
			int coefficient = 3 + (i % 4);
			int constant = 2 + i;
			TryAddSeed(year, seeds, seen, $"{coefficient}x+{constant}={coefficient * x + constant}", EquationSkillTag.MixedMultiStep);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 2 + i;
			int coefficient = 3 + i;
			int constant = 8 + i;
			TryAddSeed(year, seeds, seen, $"-{coefficient}x+{constant}={-coefficient * x + constant}", EquationSkillTag.SignFlip);
		}

		for (int i = 0; i < 7; i++)
		{
			int x = 2 + i;
			int leftCoefficient = 4 + (i % 4);
			int rightCoefficient = 1 + (i % 3);
			if (leftCoefficient == rightCoefficient)
				leftCoefficient++;

			int constant = 3 + i;
			int rhsConstant = (leftCoefficient - rightCoefficient) * x + constant;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{constant}={rightCoefficient}x+{rhsConstant}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 4; i++)
		{
			int x = 3 + i;
			int outer = 2 + i;
			int inner = 1 + i;
			TryAddSeed(year, seeds, seen, $"{outer}(x+{inner})={outer * (x + inner)}", EquationSkillTag.ExpandBrackets);
		}

		for (int i = 0; i < 4; i++)
		{
			int x = 5 + i;
			int outer = 2 + (i % 3);
			int inner = 1 + i;
			TryAddSeed(year, seeds, seen, $"{outer}(x-{inner})={outer * (x - inner)}", EquationSkillTag.ExpandBrackets);
		}
	}

	private static void BuildYear9Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 6; i++)
		{
			int x = 3 + i;
			int leftCoefficient = 5 + (i % 4);
			int rightCoefficient = 1 + (i % 3);
			int constant = 4 + i;
			int rhsConstant = (leftCoefficient - rightCoefficient) * x + constant;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{constant}={rightCoefficient}x+{rhsConstant}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 4 + i;
			int outer = 2 + (i % 4);
			int inner = 1 + (i % 3);
			string equation = i % 2 == 0
				? $"{outer}(x+{inner})={outer * (x + inner)}"
				: $"{outer}(x-{inner})={outer * (x - inner)}";
			TryAddSeed(year, seeds, seen, equation, EquationSkillTag.ExpandBrackets);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int numerator = 1 + (i % 4);
			int denominator = 2 + (i % 4);
			TryAddSeed(year, seeds, seen, $"x+{numerator}/{denominator}={(x * denominator + numerator)}/{denominator}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int coefficient = 2 + (i % 5);
			int numerator = 1 + (i % 3);
			int denominator = 2 + ((i + 1) % 4);
			int rhsNumerator = coefficient * x * denominator + numerator;
			TryAddSeed(year, seeds, seen, $"{coefficient}x+{numerator}/{denominator}={rhsNumerator}/{denominator}", EquationSkillTag.MixedMultiStep);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int leftCoefficient = 4 + (i % 4);
			int rightCoefficient = 1 + (i % 2);
			int numerator = 1 + (i % 4);
			int denominator = 3 + (i % 3);
			int rhsNumerator = ((leftCoefficient - rightCoefficient) * x * denominator) + numerator;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{numerator}/{denominator}={rightCoefficient}x+{rhsNumerator}/{denominator}", EquationSkillTag.MoveVariable);
		}
	}

	private static void BuildYear10Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int tenths = 2 + i;
			TryAddSeed(year, seeds, seen, $"x+{FormatTenths(tenths)}={FormatTenths((x * 10) + tenths)}", EquationSkillTag.MoveConstant);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int coefficient = 2 + (i % 5);
			int tenths = 1 + ((i + 2) % 8);
			int rhsTenths = (coefficient * x * 10) + tenths;
			TryAddSeed(year, seeds, seen, $"{coefficient}x+{FormatTenths(tenths)}={FormatTenths(rhsTenths)}", EquationSkillTag.MixedMultiStep);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 3 + i;
			int leftCoefficient = 4 + (i % 4);
			int rightCoefficient = 1 + (i % 3);
			int tenths = 2 + (i % 6);
			int rhsTenths = ((leftCoefficient - rightCoefficient) * x * 10) + tenths;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{FormatTenths(tenths)}={rightCoefficient}x+{FormatTenths(rhsTenths)}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 3 + i;
			int outer = 2 + (i % 4);
			int tenths = 1 + (i % 5);
			int resultTenths = outer * ((x * 10) + tenths);
			TryAddSeed(year, seeds, seen, $"{outer}(x+{FormatTenths(tenths)})={FormatTenths(resultTenths)}", EquationSkillTag.ExpandBrackets);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int leftCoefficient = 5 + (i % 4);
			int rightCoefficient = 1 + (i % 3);
			int numerator = 1 + (i % 5);
			int denominator = 2 + (i % 4);
			int rhsNumerator = ((leftCoefficient - rightCoefficient) * x * denominator) + numerator;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{numerator}/{denominator}={rightCoefficient}x+{rhsNumerator}/{denominator}", EquationSkillTag.MoveVariable);
		}
	}

	private static void BuildYear11Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 3; i++)
		{
			int x = 2 + i;
			int coefficient = 3 + i;
			int constant = 2 + i;
			TryAddSeed(year, seeds, seen, $"SUB:x={x};{coefficient}x+{constant}", EquationSkillTag.Substitution);
			TryAddSeed(year, seeds, seen, $"SUB:x={x};{coefficient}x-{constant}", EquationSkillTag.Substitution);
		}

		for (int i = 0; i < 2; i++)
		{
			int numerator = 3 + i;
			int denominator = 2 + i;
			int coefficient = 4 + i;
			int constant = 1 + i;
			TryAddSeed(year, seeds, seen, $"SUB:x={numerator}/{denominator};{coefficient}x+{constant}", EquationSkillTag.Substitution);
		}

		for (int i = 0; i < 2; i++)
		{
			int tenths = 15 + (i * 5);
			int coefficient = 5 + i;
			int valueTenths = 10 + (i * 5);
			TryAddSeed(year, seeds, seen, $"SUB:x={FormatTenths(valueTenths)};{coefficient}x+{FormatTenths(tenths)}", EquationSkillTag.Substitution);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 4 + i;
			int leftCoefficient = 7 + (i % 4);
			int rightCoefficient = 2 + (i % 2);
			int numerator = 2 + (i % 4);
			int denominator = 3 + (i % 4);
			int rhsNumerator = ((leftCoefficient - rightCoefficient) * x * denominator) + numerator;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{numerator}/{denominator}={rightCoefficient}x+{rhsNumerator}/{denominator}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 3 + i;
			int leftCoefficient = 6 + (i % 4);
			int rightCoefficient = 1 + (i % 3);
			int tenths = 2 + (i % 7);
			int rhsTenths = ((leftCoefficient - rightCoefficient) * x * 10) + tenths;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{FormatTenths(tenths)}={rightCoefficient}x+{FormatTenths(rhsTenths)}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 5 + i;
			int outer = 3 + (i % 4);
			int tenths = 2 + (i % 7);
			int resultTenths = outer * ((x * 10) - tenths);
			TryAddSeed(year, seeds, seen, $"{outer}(x-{FormatTenths(tenths)})={FormatTenths(resultTenths)}", EquationSkillTag.ExpandBrackets);
		}

		for (int i = 0; i < 5; i++)
		{
			int x = 2 + i;
			int coefficient = 4 + (i % 4);
			int constant = 12 + i;
			TryAddSeed(year, seeds, seen, $"-{coefficient}x+{constant}={-coefficient * x + constant}", EquationSkillTag.SignFlip);
		}
	}

	private static void BuildYear12Seeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen)
	{
		for (int i = 0; i < 4; i++)
		{
			int numerator = 5 + (i * 2);
			int denominator = 2 + i;
			int coefficient = 6 + i;
			int constant = 3 + i;
			TryAddSeed(year, seeds, seen, $"SUB:x={numerator}/{denominator};{coefficient}x+{constant}", EquationSkillTag.Substitution);
			TryAddSeed(year, seeds, seen, $"SUB:x={numerator}/{denominator};{coefficient}x-{constant}", EquationSkillTag.Substitution);
		}

		for (int i = 0; i < 8; i++)
		{
			int x = 3 + i;
			int outer = 2 + (i % 5);
			int leftTenths = 2 + (i % 7);
			int rightCoefficient = 1 + (i % 3);
			int rightTenths = (outer * ((x * 10) + leftTenths)) - (rightCoefficient * x * 10);
			TryAddSeed(year, seeds, seen, $"{outer}(x+{FormatTenths(leftTenths)})={rightCoefficient}x+{FormatTenths(rightTenths)}", EquationSkillTag.ExpandBrackets);
		}

		for (int i = 0; i < 8; i++)
		{
			int x = 3 + i;
			int leftCoefficient = 6 + (i % 5);
			int rightCoefficient = 1 + (i % 4);
			int numerator = 2 + (i % 5);
			int denominator = 2 + (i % 5);
			int rhsNumerator = ((leftCoefficient - rightCoefficient) * x * denominator) + numerator;
			TryAddSeed(year, seeds, seen, $"{leftCoefficient}x+{numerator}/{denominator}={rightCoefficient}x+{rhsNumerator}/{denominator}", EquationSkillTag.MoveVariable);
		}

		for (int i = 0; i < 6; i++)
		{
			int x = 2 + i;
			int leftCoefficient = 4 + i;
			int rightCoefficient = 1 + (i % 3);
			int constant = 14 + i;
			int rhsConstant = ((rightCoefficient - leftCoefficient) * x) + constant;
			TryAddSeed(year, seeds, seen, $"-{leftCoefficient}x+{constant}={rightCoefficient}x+{rhsConstant}", EquationSkillTag.SignFlip);
		}
	}

	private static void BackfillSeeds(EquationDataSet.SchoolYear year, List<EquationSeed> seeds, HashSet<string> seen, int targetCount)
	{
		int cursor = 0;
		while (seeds.Count < targetCount && cursor < 256)
		{
			int x = 2 + (cursor % 9);
			int coefficient = 2 + (cursor % 6);
			int constant = 2 + (cursor % 8);
			string equation = year >= EquationDataSet.SchoolYear.Year8
				? $"{coefficient}x+{constant}={(coefficient - 1)}x+{x + constant}"
				: $"{coefficient}x+{constant}={coefficient * x + constant}";
			TryAddSeed(year, seeds, seen, equation, year >= EquationDataSet.SchoolYear.Year8 ? EquationSkillTag.MoveVariable : EquationSkillTag.MixedMultiStep);
			cursor++;
		}
	}

	private static void TryAddSeed(
		EquationDataSet.SchoolYear year,
		List<EquationSeed> destination,
		HashSet<string> seen,
		string equation,
		EquationSkillTag skillTag)
	{
		if (destination == null || seen == null)
			return;

		string normalized = EquationStringUtil.NormalizeForParsing(equation);
		if (string.IsNullOrWhiteSpace(normalized))
			return;

		if (!seen.Add(normalized))
			return;

		if (!LinearEquationParser.TryParse(
			normalized,
			AlgebraRuntimeConfig.AllowDecimals,
			AlgebraRuntimeConfig.AllowFractions,
			AlgebraRuntimeConfig.EnableSubstitution,
			out LinearEquationParser.ParsedEquation parsed))
		{
			return;
		}

		if (!EquationPolicy.IsEquationAllowed(parsed))
			return;

		if (ViolatesYearSpecificGuidance(year, parsed))
			return;

		destination.Add(new EquationSeed
		{
			equation = normalized,
			skillTag = skillTag,
			estimatedSteps = InferEstimatedSteps(parsed),
			complexityScore = InferComplexityScore(parsed)
		});
	}

	private static int InferEstimatedSteps(LinearEquationParser.ParsedEquation parsed)
	{
		if (parsed.hasSubstitution)
			return 1;

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

	private static int InferComplexityScore(LinearEquationParser.ParsedEquation parsed)
	{
		int complexity = 1;
		complexity += Mathf.Clamp(Mathf.Abs(parsed.leftVarCoef) + Mathf.Abs(parsed.rightVarCoef), 0, 12) / 3;
		complexity += Mathf.Clamp(Mathf.Abs(parsed.leftConst) + Mathf.Abs(parsed.rightConst), 0, 60) / 10;
		if (parsed.leftConstDenominator > 1 || parsed.rightConstDenominator > 1)
			complexity += 2;
		if (parsed.hasBrackets)
			complexity += 2;
		if (parsed.hasSubstitution)
			complexity += 2;

		return Mathf.Clamp(complexity, 1, 10);
	}

	private static int CompareSeeds(EquationSeed a, EquationSeed b)
	{
		int complexity = a.complexityScore.CompareTo(b.complexityScore);
		if (complexity != 0)
			return complexity;

		int steps = a.estimatedSteps.CompareTo(b.estimatedSteps);
		if (steps != 0)
			return steps;

		int skill = a.skillTag.CompareTo(b.skillTag);
		if (skill != 0)
			return skill;

		return string.CompareOrdinal(a.equation, b.equation);
	}

	private static string FormatTenths(int tenths)
	{
		return (tenths / 10f).ToString("0.0", CultureInfo.InvariantCulture);
	}

	private static bool ViolatesYearSpecificGuidance(EquationDataSet.SchoolYear year, LinearEquationParser.ParsedEquation parsed)
	{
		if (year == EquationDataSet.SchoolYear.Year6)
		{
			if (parsed.leftConstDenominator != 1 || parsed.rightConstDenominator != 1)
				return true;

			if (parsed.leftVarCoef < 0 || parsed.rightVarCoef < 0 || parsed.leftConst < 0 || parsed.rightConst < 0)
				return true;

			if (Mathf.Abs(parsed.leftVarCoef) > 99 || Mathf.Abs(parsed.rightVarCoef) > 99)
				return true;

			if (Mathf.Abs(parsed.leftConst) > 99 || Mathf.Abs(parsed.rightConst) > 99)
				return true;
		}

		if (year == EquationDataSet.SchoolYear.Year7 && WouldSolveToNegative(parsed))
			return true;

		return false;
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

	private static EquationDataSet.DifficultyLevel GetOrCreateLevel(EquationDataSet dataSet, EquationDataSet.SchoolYear year)
	{
		List<EquationDataSet.DifficultyLevel> levels = dataSet.GetAllLevels();
		for (int i = 0; i < levels.Count; i++)
		{
			if (levels[i] != null && levels[i].schoolYear == year)
			{
				if (string.IsNullOrWhiteSpace(levels[i].levelName))
					levels[i].levelName = YearDisplayName(year);
				return levels[i];
			}
		}

		EquationDataSet.DifficultyLevel created = new EquationDataSet.DifficultyLevel
		{
			levelName = YearDisplayName(year),
			schoolYear = year,
			equations = new List<string>(),
			entries = new List<EquationEntry>()
		};
		levels.Add(created);
		return created;
	}

	private static string BuildEntryId(EquationDataSet.SchoolYear year, int index, EquationSkillTag skillTag)
	{
		string skill = EquationSkillTagUtility.ToStableKey(skillTag);
		return $"{year}_{index + 1:D3}_{skill}";
	}

	private static string YearDisplayName(EquationDataSet.SchoolYear year)
	{
		switch (year)
		{
			case EquationDataSet.SchoolYear.Year5: return "Year 5";
			case EquationDataSet.SchoolYear.Year6: return "Year 6";
			case EquationDataSet.SchoolYear.Year7: return "Year 7";
			case EquationDataSet.SchoolYear.Year8: return "Year 8";
			case EquationDataSet.SchoolYear.Year9: return "Year 9";
			case EquationDataSet.SchoolYear.Year10: return "Year 10";
			case EquationDataSet.SchoolYear.Year11: return "Year 11";
			case EquationDataSet.SchoolYear.Year12: return "Year 12";
			default: return year.ToString();
		}
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

	private static EquationDataSet LoadDataSet()
	{
		EquationDataSet dataSet = Resources.Load<EquationDataSet>(DataSetResourcePath);
		if (dataSet != null)
			return dataSet;

		string[] guids = AssetDatabase.FindAssets("t:EquationDataSet");
		if (guids == null || guids.Length == 0)
			return null;

		string path = AssetDatabase.GUIDToAssetPath(guids[0]);
		return AssetDatabase.LoadAssetAtPath<EquationDataSet>(path);
	}
}
#endif
