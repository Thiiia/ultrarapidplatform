using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "EquationDataSet", menuName = "ULTRARAPID/Algebra/Equation Data Set")]
public class EquationDataSet : ScriptableObject
{
	[System.Serializable]
	public class DifficultyLevel
	{
		public string levelName;
		public SchoolYear schoolYear;
		[TextArea(1, 2)]
		public List<string> equations = new List<string>();
		public List<EquationEntry> entries = new List<EquationEntry>();
	}

	public enum SchoolYear
	{
		Year5,
		Year6,
		Year7,
		Year8,
		Year9,
		Year10,
		Year11,
		Year12
	}

	[SerializeField] private List<DifficultyLevel> difficultyLevels = new List<DifficultyLevel>();

	/// Get all equations for a specific school year (metadata entries + legacy strings).
	public List<string> GetEquationsForYear(SchoolYear year)
	{
		List<string> equations = new List<string>();
		HashSet<string> seen = new HashSet<string>();
		DifficultyLevel level = FindLevel(year);
		if (level == null)
			return equations;

		if (level.entries != null)
		{
			for (int i = 0; i < level.entries.Count; i++)
			{
				EquationEntry entry = level.entries[i];
				if (entry == null)
					continue;

				string normalized = entry.GetNormalizedEquation();
				if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
					continue;

				equations.Add(normalized);
			}
		}

		if (level.equations != null)
		{
			for (int i = 0; i < level.equations.Count; i++)
			{
				string normalized = EquationStringUtil.NormalizeForParsing(level.equations[i]);
				if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
					continue;

				equations.Add(normalized);
			}
		}

		return equations;
	}

	/// Get metadata entries for a specific school year. Legacy string equations are surfaced as inferred entries.
	public List<EquationEntry> GetEntriesForYear(SchoolYear year)
	{
		List<EquationEntry> entries = new List<EquationEntry>();
		HashSet<string> seen = new HashSet<string>();
		DifficultyLevel level = FindLevel(year);
		if (level == null)
			return entries;

		if (level.entries != null)
		{
			for (int i = 0; i < level.entries.Count; i++)
			{
				EquationEntry entry = level.entries[i];
				if (entry == null)
					continue;

				string normalized = entry.GetNormalizedEquation();
				if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
					continue;

				EquationEntry clone = entry.Clone();
				clone.equation = normalized;
				clone.id = EquationEntryUtility.EnsureId(clone, year, entries.Count + 1);
				clone.estimatedSteps = Mathf.Clamp(clone.estimatedSteps, 1, 6);
				clone.complexityScore = Mathf.Clamp(clone.complexityScore, 1, 10);
				entries.Add(clone);
			}
		}

		if (level.equations != null)
		{
			for (int i = 0; i < level.equations.Count; i++)
			{
				string normalized = EquationStringUtil.NormalizeForParsing(level.equations[i]);
				if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
					continue;

				EquationEntry inferred = InferEntryFromLegacyEquation(normalized, year, entries.Count + 1);
				entries.Add(inferred);
			}
		}

		return entries;
	}

	/// Get a random equation for a specific school year.
	public string GetRandomEquation(SchoolYear year)
	{
		EquationEntry entry = GetRandomEntry(year);
		return entry != null ? entry.GetNormalizedEquation() : string.Empty;
	}

	/// Get a random metadata entry for a specific school year.
	public EquationEntry GetRandomEntry(SchoolYear year)
	{
		List<EquationEntry> entries = GetEntriesForYear(year);
		if (entries.Count == 0)
			return null;
		return entries[Random.Range(0, entries.Count)];
	}

	/// Get all difficulty levels.
	public List<DifficultyLevel> GetAllLevels()
	{
		return difficultyLevels;
	}

	/// Get equation count for a year.
	public int GetEquationCount(SchoolYear year)
	{
		return GetEntriesForYear(year).Count;
	}

	private DifficultyLevel FindLevel(SchoolYear year)
	{
		return difficultyLevels.Find(d => d != null && d.schoolYear == year);
	}

	private static EquationEntry InferEntryFromLegacyEquation(string normalizedEquation, SchoolYear year, int fallbackIndex)
	{
		EquationSkillTag tag = GuessSkillTagFromEquation(normalizedEquation);
		int estimatedSteps = EstimateSteps(normalizedEquation);
		int complexity = EstimateComplexity(normalizedEquation);

		EquationEntry inferred = new EquationEntry
		{
			id = EquationEntryUtility.BuildFallbackId(normalizedEquation, year, fallbackIndex),
			equation = normalizedEquation,
			skillTag = tag,
			estimatedSteps = Mathf.Clamp(estimatedSteps, 1, 6),
			complexityScore = Mathf.Clamp(complexity, 1, 10)
		};

		return inferred;
	}

	private static EquationSkillTag GuessSkillTagFromEquation(string normalizedEquation)
	{
		return EquationSkillTagUtility.InferFromEquation(normalizedEquation);
	}

	private static int EstimateSteps(string normalizedEquation)
	{
		if (!LinearEquationParser.TryParse(
			normalizedEquation,
			allowDecimals: true,
			allowFractions: true,
			enableSubstitution: true,
			out LinearEquationParser.ParsedEquation parsed))
		{
			return 2;
		}

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

	private static int EstimateComplexity(string normalizedEquation)
	{
		if (!LinearEquationParser.TryParse(
			normalizedEquation,
			allowDecimals: true,
			allowFractions: true,
			enableSubstitution: true,
			out LinearEquationParser.ParsedEquation parsed))
		{
			return 3;
		}

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
}
