#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class AlgebraCurriculumPipelineRunner
{
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

	[Serializable]
	private class YearCoverageRecord
	{
		public string schoolYear;
		public int requiredMinimumCount;
		public int legacyCount;
		public int metadataCount;
		public int runtimeCount;
		public int parseableCount;
		public int policyAllowedCount;
		public int metadataCompleteCount;
		public int distinctSkillCount;
		public int minComplexity;
		public int maxComplexity;
		public int minEstimatedSteps;
		public int maxEstimatedSteps;
		public bool hasFractions;
		public bool hasDecimals;
		public bool hasBrackets;
		public bool hasSubstitution;
	}

	[Serializable]
	private class OverlapRecord
	{
		public string fromYear;
		public string toYear;
		public int sharedEquationCount;
		public float fromYearOverlapRatio;
		public float toYearOverlapRatio;
	}

	[Serializable]
	private class CurriculumCoverageReport
	{
		public string generatedAtUtc;
		public bool validationPassed;
		public bool coverageMeetsMinimums;
		public int totalRuntimeEntries;
		public int totalMetadataEntries;
		public int totalLegacyEntries;
		public string reportPath;
		public List<YearCoverageRecord> years = new List<YearCoverageRecord>();
		public List<OverlapRecord> overlaps = new List<OverlapRecord>();
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Run Phase 1 Pipeline (Seed + Validate + Report)")]
	public static void RunPhase1PipelineFromMenu()
	{
		RunPipeline(exitWhenDone: false);
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Write Curriculum Coverage Report")]
	public static void WriteCoverageReportOnlyFromMenu()
	{
		EquationDataSet dataSet = LoadDataSet();
		if (dataSet == null)
		{
			Debug.LogError("[AlgebraCurriculumPipelineRunner] Could not load EquationDataSet.");
			return;
		}

		CurriculumCoverageReport report = BuildCoverageReport(dataSet, validationPassed: true);
		WriteReportFile(report, out string path);
		LogReportSummary(report, path);
	}

	// Supports Unity batchmode:
	// Unity.exe -batchmode -projectPath "<repo>" -executeMethod AlgebraCurriculumPipelineRunner.RunPhase1PipelineBatchMode -quit
	public static void RunPhase1PipelineBatchMode()
	{
		RunPipeline(exitWhenDone: true);
	}

	private static void RunPipeline(bool exitWhenDone)
	{
		bool success = false;
		try
		{
			EquationDataSetCurriculumSeeder.SeedCurriculumBank();

			EquationDataSet dataSet = LoadDataSet();
			if (dataSet == null)
			{
				Debug.LogError("[AlgebraCurriculumPipelineRunner] Could not load EquationDataSet after seeding.");
				success = false;
				return;
			}

			bool validationPassed = EquationDataSetValidator.Validate(dataSet, logAllIssues: true);
			CurriculumCoverageReport report = BuildCoverageReport(dataSet, validationPassed);
			WriteReportFile(report, out string path);
			LogReportSummary(report, path);

			success = validationPassed && report.coverageMeetsMinimums;
		}
		catch (Exception ex)
		{
			success = false;
			Debug.LogError($"[AlgebraCurriculumPipelineRunner] Pipeline failed with exception: {ex}");
		}
		finally
		{
			if (exitWhenDone)
				EditorApplication.Exit(success ? 0 : 1);
		}
	}

	private static CurriculumCoverageReport BuildCoverageReport(EquationDataSet dataSet, bool validationPassed)
	{
		CurriculumCoverageReport report = new CurriculumCoverageReport
		{
			generatedAtUtc = DateTime.UtcNow.ToString("O"),
			validationPassed = validationPassed,
			coverageMeetsMinimums = true,
			totalRuntimeEntries = 0,
			totalMetadataEntries = 0,
			totalLegacyEntries = 0
		};

		if (dataSet == null)
		{
			report.coverageMeetsMinimums = false;
			return report;
		}

		RuntimeConfigSnapshot snapshot = CaptureRuntimeConfig();
		try
		{
			List<EquationDataSet.DifficultyLevel> levels = dataSet.GetAllLevels();
			Dictionary<EquationDataSet.SchoolYear, HashSet<string>> runtimeEquationSets = new Dictionary<EquationDataSet.SchoolYear, HashSet<string>>();
			foreach (EquationDataSet.SchoolYear year in Enum.GetValues(typeof(EquationDataSet.SchoolYear)))
			{
				AlgebraRuntimeConfig.SetSchoolYear(year);

				EquationDataSet.DifficultyLevel level = levels.Find(l => l != null && l.schoolYear == year);
				List<EquationEntry> runtimeEntries = dataSet.GetEntriesForYear(year);

				int required = GetMinimumCountForYear(year);
				int runtimeCount = runtimeEntries != null ? runtimeEntries.Count : 0;
				int metadataCount = level != null && level.entries != null ? level.entries.Count : 0;
				int legacyCount = level != null && level.equations != null ? level.equations.Count : 0;

				int parseableCount = 0;
				int policyCount = 0;
				int metadataCompleteCount = 0;
				HashSet<EquationSkillTag> skills = new HashSet<EquationSkillTag>();
				HashSet<string> equations = new HashSet<string>();
				int minComplexity = int.MaxValue;
				int maxComplexity = int.MinValue;
				int minSteps = int.MaxValue;
				int maxSteps = int.MinValue;
				bool hasFractions = false;
				bool hasDecimals = false;
				bool hasBrackets = false;
				bool hasSubstitution = false;

				if (runtimeEntries != null)
				{
					for (int i = 0; i < runtimeEntries.Count; i++)
					{
						EquationEntry entry = runtimeEntries[i];
						if (entry == null)
							continue;

						string normalized = entry.GetNormalizedEquation();
						if (string.IsNullOrWhiteSpace(normalized))
							continue;

						equations.Add(normalized);
						minComplexity = Mathf.Min(minComplexity, entry.complexityScore);
						maxComplexity = Mathf.Max(maxComplexity, entry.complexityScore);
						minSteps = Mathf.Min(minSteps, entry.estimatedSteps);
						maxSteps = Mathf.Max(maxSteps, entry.estimatedSteps);

						if (entry.IsMetadataComplete())
							metadataCompleteCount++;

						if (entry.skillTag != EquationSkillTag.Unknown)
							skills.Add(entry.skillTag);

						if (!LinearEquationParser.TryParse(
								normalized,
								AlgebraRuntimeConfig.AllowDecimals,
								AlgebraRuntimeConfig.AllowFractions,
								AlgebraRuntimeConfig.EnableSubstitution,
								out LinearEquationParser.ParsedEquation parsed))
						{
							continue;
						}

						parseableCount++;
						if (normalized.Contains("."))
							hasDecimals = true;
						if (parsed.hasBrackets)
							hasBrackets = true;
						if (parsed.leftConstDenominator > 1 || parsed.rightConstDenominator > 1 || parsed.substitutionValueDenominator > 1 || parsed.substitutionConstDenominator > 1)
							hasFractions = true;
						if (parsed.hasSubstitution)
							hasSubstitution = true;
						if (EquationPolicy.IsEquationAllowed(parsed))
							policyCount++;
					}
				}

				runtimeEquationSets[year] = equations;

				YearCoverageRecord yearRecord = new YearCoverageRecord
				{
					schoolYear = year.ToString(),
					requiredMinimumCount = required,
					legacyCount = legacyCount,
					metadataCount = metadataCount,
					runtimeCount = runtimeCount,
					parseableCount = parseableCount,
					policyAllowedCount = policyCount,
					metadataCompleteCount = metadataCompleteCount,
					distinctSkillCount = skills.Count,
					minComplexity = minComplexity == int.MaxValue ? 0 : minComplexity,
					maxComplexity = maxComplexity == int.MinValue ? 0 : maxComplexity,
					minEstimatedSteps = minSteps == int.MaxValue ? 0 : minSteps,
					maxEstimatedSteps = maxSteps == int.MinValue ? 0 : maxSteps,
					hasFractions = hasFractions,
					hasDecimals = hasDecimals,
					hasBrackets = hasBrackets,
					hasSubstitution = hasSubstitution
				};
				report.years.Add(yearRecord);

				report.totalRuntimeEntries += runtimeCount;
				report.totalMetadataEntries += metadataCount;
				report.totalLegacyEntries += legacyCount;

				if (runtimeCount < required)
					report.coverageMeetsMinimums = false;
			}

			foreach (EquationDataSet.SchoolYear fromYear in Enum.GetValues(typeof(EquationDataSet.SchoolYear)))
			{
				if (!runtimeEquationSets.TryGetValue(fromYear, out HashSet<string> fromEquations) || fromEquations == null || fromEquations.Count == 0)
					continue;

				foreach (EquationDataSet.SchoolYear toYear in Enum.GetValues(typeof(EquationDataSet.SchoolYear)))
				{
					if (toYear <= fromYear)
						continue;

					if (!runtimeEquationSets.TryGetValue(toYear, out HashSet<string> toEquations) || toEquations == null || toEquations.Count == 0)
						continue;

					int shared = 0;
					foreach (string equation in fromEquations)
					{
						if (toEquations.Contains(equation))
							shared++;
					}

					report.overlaps.Add(new OverlapRecord
					{
						fromYear = fromYear.ToString(),
						toYear = toYear.ToString(),
						sharedEquationCount = shared,
						fromYearOverlapRatio = fromEquations.Count > 0 ? shared / (float)fromEquations.Count : 0f,
						toYearOverlapRatio = toEquations.Count > 0 ? shared / (float)toEquations.Count : 0f
					});
				}
			}
		}
		finally
		{
			RestoreRuntimeConfig(snapshot);
		}

		return report;
	}

	private static void WriteReportFile(CurriculumCoverageReport report, out string outputPath)
	{
		string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../Temp"));
		Directory.CreateDirectory(root);
		outputPath = Path.Combine(root, $"algebra_curriculum_report_{DateTime.UtcNow:yyyyMMdd_HHmmss}.json");
		report.reportPath = outputPath;

		string json = JsonUtility.ToJson(report, prettyPrint: true);
		File.WriteAllText(outputPath, json);
	}

	private static void LogReportSummary(CurriculumCoverageReport report, string path)
	{
		if (report == null)
		{
			Debug.LogError("[AlgebraCurriculumPipelineRunner] Coverage report was null.");
			return;
		}

		for (int i = 0; i < report.years.Count; i++)
		{
			YearCoverageRecord year = report.years[i];
			if (year == null)
				continue;

			string summary =
				$"[AlgebraCurriculumPipelineRunner] {year.schoolYear}: runtime={year.runtimeCount}/{year.requiredMinimumCount}, " +
				$"metadata={year.metadataCount}, legacy={year.legacyCount}, parseable={year.parseableCount}, " +
				$"policy={year.policyAllowedCount}, metadataComplete={year.metadataCompleteCount}, skills={year.distinctSkillCount}, " +
				$"complexity={year.minComplexity}-{year.maxComplexity}, steps={year.minEstimatedSteps}-{year.maxEstimatedSteps}, " +
				$"fractions={year.hasFractions}, decimals={year.hasDecimals}, brackets={year.hasBrackets}, substitution={year.hasSubstitution}";

			if (year.runtimeCount < year.requiredMinimumCount)
				Debug.LogError(summary);
			else
				Debug.Log(summary);
		}

		if (!report.validationPassed)
			Debug.LogError("[AlgebraCurriculumPipelineRunner] Validator reported fatal issues.");
		if (!report.coverageMeetsMinimums)
			Debug.LogError("[AlgebraCurriculumPipelineRunner] Coverage is below minimum requirements.");

		for (int i = 0; i < report.overlaps.Count; i++)
		{
			OverlapRecord overlap = report.overlaps[i];
			if (overlap == null)
				continue;

			if (overlap.sharedEquationCount <= 0)
				continue;

			string message =
				$"[AlgebraCurriculumPipelineRunner] overlap {overlap.fromYear}->{overlap.toYear}: " +
				$"shared={overlap.sharedEquationCount}, fromRatio={overlap.fromYearOverlapRatio:0.00}, toRatio={overlap.toYearOverlapRatio:0.00}";

			if (overlap.fromYearOverlapRatio >= 0.5f || overlap.toYearOverlapRatio >= 0.5f)
				Debug.LogWarning(message);
			else
				Debug.Log(message);
		}

		Debug.Log(
			$"[AlgebraCurriculumPipelineRunner] Report written: {path} " +
			$"(runtime={report.totalRuntimeEntries}, metadata={report.totalMetadataEntries}, legacy={report.totalLegacyEntries}, " +
			$"validation={report.validationPassed}, coverage={report.coverageMeetsMinimums})");
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
		EquationDataSet dataSet = Resources.Load<EquationDataSet>("EquationDataSet");
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
