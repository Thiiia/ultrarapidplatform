using System;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

[Serializable]
public class EquationEntry
{
	public string id;
	[TextArea(1, 2)] public string equation;
	public EquationSkillTag skillTag = EquationSkillTag.Unknown;
	[Range(1, 6)] public int estimatedSteps = 2;
	[Range(1, 10)] public int complexityScore = 3;

	public string GetNormalizedEquation()
	{
		return EquationStringUtil.NormalizeForParsing(equation);
	}

	public bool IsMetadataComplete()
	{
		return skillTag != EquationSkillTag.Unknown &&
			estimatedSteps >= 1 && estimatedSteps <= 6 &&
			complexityScore >= 1 && complexityScore <= 10;
	}

	public EquationEntry Clone()
	{
		return new EquationEntry
		{
			id = id,
			equation = equation,
			skillTag = skillTag,
			estimatedSteps = estimatedSteps,
			complexityScore = complexityScore
		};
	}
}

public static class EquationEntryUtility
{
	public static string EnsureId(EquationEntry entry, EquationDataSet.SchoolYear schoolYear, int fallbackIndex)
	{
		if (entry == null)
			return BuildFallbackId(string.Empty, schoolYear, fallbackIndex);

		if (!string.IsNullOrWhiteSpace(entry.id))
			return entry.id.Trim();

		return BuildFallbackId(entry.GetNormalizedEquation(), schoolYear, fallbackIndex);
	}

	public static string BuildFallbackId(string equation, EquationDataSet.SchoolYear schoolYear, int fallbackIndex)
	{
		string normalized = EquationStringUtil.NormalizeForParsing(equation ?? string.Empty);
		string hash = ComputeShortHash(normalized);
		return $"{schoolYear}_{fallbackIndex:D3}_{hash}";
	}

	private static string ComputeShortHash(string value)
	{
		if (string.IsNullOrEmpty(value))
			return "empty";

		using (SHA256 sha = SHA256.Create())
		{
			byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
			StringBuilder sb = new StringBuilder(8);
			for (int i = 0; i < 4 && i < bytes.Length; i++)
				sb.Append(bytes[i].ToString("x2"));
			return sb.ToString();
		}
	}
}
