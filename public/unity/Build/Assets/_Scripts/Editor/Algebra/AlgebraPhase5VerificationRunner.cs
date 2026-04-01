#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class AlgebraPhase5VerificationRunner
{
	[Serializable]
	private class Phase5PreflightReport
	{
		public string generatedAtUtc;
		public bool dependencyValidationPassed;
		public bool algebraTestDefineEnabled;
		public string defineSymbols;
		public string coverageReportHint;
		public string stressChecklistPath;
		public string reportPath;
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Run Phase 5 Preflight (Dependency + Gates)")]
	public static void RunPreflightFromMenu()
	{
		bool depsOk = AlgebraProjectDependencyValidator.ValidateProjectDependencies(logAll: true);
		string defineSymbols = GetDefineSymbols();
		bool testsEnabled = HasDefine(defineSymbols, "ULTRARAPID_ENABLE_ALGEBRA_TESTS");

		if (!testsEnabled)
		{
			Debug.LogWarning(
				"[AlgebraPhase5VerificationRunner] Algebra tests are currently disabled by define constraints. " +
				"Enable ULTRARAPID_ENABLE_ALGEBRA_TESTS when you are ready to run EditMode/PlayMode suites.");
		}

		string stressChecklistPath = Path.GetFullPath(Path.Combine(Application.dataPath, "../Docs/AlgebraPhase5StressChecklist.md"));
		if (!File.Exists(stressChecklistPath))
			Debug.LogWarning($"[AlgebraPhase5VerificationRunner] Stress checklist missing: {stressChecklistPath}");

		Phase5PreflightReport report = new Phase5PreflightReport
		{
			generatedAtUtc = DateTime.UtcNow.ToString("O"),
			dependencyValidationPassed = depsOk,
			algebraTestDefineEnabled = testsEnabled,
			defineSymbols = defineSymbols,
			coverageReportHint = "Run Tools/ULTRARAPID/Algebra/Write Curriculum Coverage Report",
			stressChecklistPath = stressChecklistPath
		};

		string path = WriteReport(report);
		report.reportPath = path;

		Debug.Log(
			$"[AlgebraPhase5VerificationRunner] Report written: {path} " +
			$"(deps={depsOk}, testsDefine={testsEnabled})");
	}

	private static string WriteReport(Phase5PreflightReport report)
	{
		string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../Temp"));
		Directory.CreateDirectory(root);
		string outputPath = Path.Combine(root, $"algebra_phase5_preflight_{DateTime.UtcNow:yyyyMMdd_HHmmss}.json");
		string json = JsonUtility.ToJson(report, prettyPrint: true);
		File.WriteAllText(outputPath, json);
		return outputPath;
	}

	private static bool HasDefine(string defineSymbols, string symbol)
	{
		if (string.IsNullOrWhiteSpace(defineSymbols) || string.IsNullOrWhiteSpace(symbol))
			return false;

		string[] parts = defineSymbols.Split(';');
		for (int i = 0; i < parts.Length; i++)
		{
			if (string.Equals(parts[i].Trim(), symbol, StringComparison.Ordinal))
				return true;
		}

		return false;
	}

	private static string GetDefineSymbols()
	{
#if UNITY_2021_2_OR_NEWER
		return PlayerSettings.GetScriptingDefineSymbols(UnityEditor.Build.NamedBuildTarget.Standalone);
#else
		return PlayerSettings.GetScriptingDefineSymbolsForGroup(EditorUserBuildSettings.selectedBuildTargetGroup);
#endif
	}
}
#endif
