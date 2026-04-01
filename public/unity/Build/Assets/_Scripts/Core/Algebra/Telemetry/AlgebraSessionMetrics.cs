using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using UnityEngine.SceneManagement;

public class AlgebraSessionMetrics : MonoBehaviour
{
	[Header("Wiring")]
	[SerializeField] private AlgebraFeatureFlags featureFlagsOverride;
	[SerializeField] private EquationChoiceSystem choiceSystem;
	[SerializeField] private DragExecutionController dragController;

	[Header("Output")]
	[SerializeField] private bool writePrettyJson = true;
	[SerializeField] private bool logMetricWrites = false;

	private readonly List<AlgebraEquationMetricsRecord> completedRecords = new List<AlgebraEquationMetricsRecord>(64);
	private AlgebraEquationMetricsRecord activeRecord;
	private float activeRecordStartTime;
	private string sessionId;
	private DateTime sessionStartedUtc;

	private bool hasInitialized;
	private bool hasFeatureFlagGate;

	[Serializable]
	private class SessionPayload
	{
		public string flushReason;
		public AlgebraMetricsSessionSummary summary;
		public List<AlgebraEquationMetricsRecord> records;
	}

	private void Awake()
	{
		if (!IsMetricsEnabledByFlags())
		{
			hasFeatureFlagGate = true;
			enabled = false;
			return;
		}

		ResolveReferences();
		InitializeSession();
	}

	private void OnEnable()
	{
		if (hasFeatureFlagGate)
			return;

		ResolveReferences();
		InitializeSession();
		Subscribe();
		BootstrapActiveRecordIfNeeded();
	}

	private void OnDisable()
	{
		if (hasFeatureFlagGate)
			return;

		Unsubscribe();
		FinalizeActiveRecord(solved: false);
		WriteSessionJson("scene_exit");
	}

	private void OnApplicationPause(bool pauseStatus)
	{
		if (hasFeatureFlagGate || !pauseStatus)
			return;

		WriteSessionJson("pause");
	}

	private void OnApplicationQuit()
	{
		if (hasFeatureFlagGate)
			return;

		WriteSessionJson("quit");
	}

	private bool IsMetricsEnabledByFlags()
	{
		AlgebraFeatureFlags flags = AlgebraFeatureFlags.Resolve(featureFlagsOverride);
		if (flags == null)
			return false;

		return flags.EnableSessionMetrics;
	}

	private void ResolveReferences()
	{
		if (choiceSystem == null)
			choiceSystem = FindFirstObjectByType<EquationChoiceSystem>();
		if (dragController == null)
			dragController = FindFirstObjectByType<DragExecutionController>();
	}

	private void InitializeSession()
	{
		if (hasInitialized)
			return;

		hasInitialized = true;
		sessionStartedUtc = DateTime.UtcNow;
		sessionId = sessionStartedUtc.ToString("yyyyMMdd_HHmmss") + "_" + Guid.NewGuid().ToString("N").Substring(0, 8);
	}

	private void Subscribe()
	{
		if (dragController != null)
		{
			dragController.DragAttemptEvaluated += HandleDragAttemptEvaluated;
			dragController.ContextualHintShown += HandleContextualHintShown;
		}

		if (choiceSystem != null)
			choiceSystem.OnStateChanged += HandleChoiceStateChanged;
	}

	private void Unsubscribe()
	{
		if (dragController != null)
		{
			dragController.DragAttemptEvaluated -= HandleDragAttemptEvaluated;
			dragController.ContextualHintShown -= HandleContextualHintShown;
		}

		if (choiceSystem != null)
			choiceSystem.OnStateChanged -= HandleChoiceStateChanged;
	}

	private void BootstrapActiveRecordIfNeeded()
	{
		if (activeRecord != null || choiceSystem == null || choiceSystem.CurrentState == null)
			return;

		if (choiceSystem.CurrentState.IsSolved())
			return;

		BeginOrUpdateRecord(null, choiceSystem.CurrentState.rawEquation, AlgebraRuntimeConfig.CurrentSchoolYear);
	}

	private void HandleChoiceStateChanged(EquationState state)
	{
		if (state == null)
			return;

		if (state.IsSolved())
		{
			FinalizeActiveRecord(solved: true);
			return;
		}

		BeginOrUpdateRecord(null, state.rawEquation, AlgebraRuntimeConfig.CurrentSchoolYear);
	}

	private void HandleDragAttemptEvaluated(DragExecutionController.DragAttemptTelemetry telemetry)
	{
		if (activeRecord == null)
			return;

		switch (telemetry.hitResult)
		{
			case HitResult.Perfect:
				activeRecord.executionPerfect++;
				break;
			case HitResult.Good:
				activeRecord.executionGood++;
				break;
			default:
				activeRecord.executionMiss++;
				break;
		}

		switch (telemetry.missReason)
		{
			case DragExecutionController.DragMissReason.Early:
				activeRecord.earlyMisses++;
				break;
			case DragExecutionController.DragMissReason.Late:
				activeRecord.lateMisses++;
				break;
			case DragExecutionController.DragMissReason.OffPath:
			case DragExecutionController.DragMissReason.DroppedOffTarget:
				activeRecord.pathMisses++;
				break;
			case DragExecutionController.DragMissReason.InvalidOperation:
				activeRecord.invalidOperationMisses++;
				break;
		}

		if (!float.IsNaN(telemetry.pathCompletion01))
		{
			activeRecord.meanPathCompletion01 += Mathf.Clamp01(telemetry.pathCompletion01);
			activeRecord.pathCompletionSamples++;
		}
	}

	private void HandleContextualHintShown(string hintMessage)
	{
		if (activeRecord == null)
			return;

		activeRecord.hintsShown++;
	}

	private void BeginOrUpdateRecord(EquationEntry entry, string equationText, EquationDataSet.SchoolYear year)
	{
		string normalized = EquationStringUtil.NormalizeForParsing(equationText);
		if (string.IsNullOrWhiteSpace(normalized))
			return;

		if (activeRecord != null)
		{
			string activeNormalized = EquationStringUtil.NormalizeForParsing(activeRecord.equationText);
			if (string.Equals(activeNormalized, normalized, StringComparison.Ordinal))
			{
				ApplyEntryMetadata(entry, year);
				return;
			}

			FinalizeActiveRecord(solved: false);
		}

		activeRecord = new AlgebraEquationMetricsRecord
		{
			equationText = normalized,
			equationTextHash = ComputeShortHash(normalized),
			schoolYear = year,
			skillTag = entry != null ? entry.skillTag : EquationSkillTag.Unknown,
			estimatedSteps = entry != null ? Mathf.Clamp(entry.estimatedSteps, 1, 6) : 1,
			complexityScore = entry != null ? Mathf.Clamp(entry.complexityScore, 1, 10) : 1,
			startedAtUtc = DateTime.UtcNow.ToString("O")
		};

		activeRecord.equationId = EquationEntryUtility.EnsureId(entry, year, completedRecords.Count + 1);
		activeRecordStartTime = Time.unscaledTime;
	}

	private void ApplyEntryMetadata(EquationEntry entry, EquationDataSet.SchoolYear year)
	{
		if (activeRecord == null || entry == null)
			return;

		activeRecord.schoolYear = year;
		activeRecord.skillTag = entry.skillTag;
		activeRecord.estimatedSteps = Mathf.Clamp(entry.estimatedSteps, 1, 6);
		activeRecord.complexityScore = Mathf.Clamp(entry.complexityScore, 1, 10);
		activeRecord.equationId = EquationEntryUtility.EnsureId(entry, year, completedRecords.Count + 1);
	}

	private void FinalizeActiveRecord(bool solved)
	{
		if (activeRecord == null)
			return;

		activeRecord.solved = solved;
		activeRecord.endedAtUtc = DateTime.UtcNow.ToString("O");
		activeRecord.solveDurationSeconds = Mathf.Max(0f, Time.unscaledTime - activeRecordStartTime);

		if (activeRecord.pathCompletionSamples > 0)
			activeRecord.meanPathCompletion01 /= activeRecord.pathCompletionSamples;
		else
			activeRecord.meanPathCompletion01 = float.NaN;

		completedRecords.Add(activeRecord);
		activeRecord = null;
	}

	private void WriteSessionJson(string flushReason)
	{
		if (completedRecords.Count == 0 && activeRecord == null)
			return;

		if (activeRecord != null)
			FinalizeActiveRecord(solved: false);

		string folder = Path.Combine(Application.persistentDataPath, "algebra_metrics");
		string fileName = $"session_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{flushReason}.json";
		string filePath = Path.Combine(folder, fileName);

		SessionPayload payload = new SessionPayload
		{
			flushReason = flushReason,
			summary = BuildSummary(),
			records = new List<AlgebraEquationMetricsRecord>(completedRecords)
		};

		try
		{
			Directory.CreateDirectory(folder);
			string json = JsonUtility.ToJson(payload, writePrettyJson);
			File.WriteAllText(filePath, json, Encoding.UTF8);

			if (logMetricWrites)
				Debug.Log($"[AlgebraSessionMetrics] Wrote metrics file: {filePath}");
		}
		catch (Exception ex)
		{
			Debug.LogWarning($"[AlgebraSessionMetrics] Failed to write metrics JSON: {ex.Message}");
		}
	}

	private AlgebraMetricsSessionSummary BuildSummary()
	{
		int equationsStarted = completedRecords.Count;
		int solvedCount = 0;

		int totalDecisions = 0;
		int totalOptimalDecisions = 0;
		int totalTagAttempts = 0;
		int totalCorrectTags = 0;
		int totalExecGoodOrPerfect = 0;
		int totalExecSamples = 0;
		int totalHints = 0;

		float totalSolveSeconds = 0f;
		int solvedDurationSamples = 0;
		float totalPathCompletion = 0f;
		int pathSamples = 0;

		for (int i = 0; i < completedRecords.Count; i++)
		{
			AlgebraEquationMetricsRecord record = completedRecords[i];
			if (record == null)
				continue;

			if (record.solved)
			{
				solvedCount++;
				totalSolveSeconds += Mathf.Max(0f, record.solveDurationSeconds);
				solvedDurationSamples++;
			}

			totalDecisions += Mathf.Max(0, record.decisionsTaken);
			totalOptimalDecisions += Mathf.Max(0, record.optimalDecisions);
			totalTagAttempts += Mathf.Max(0, record.tagAttempts);
			totalCorrectTags += Mathf.Max(0, record.correctTags);
			totalExecGoodOrPerfect += Mathf.Max(0, record.executionGood) + Mathf.Max(0, record.executionPerfect);
			totalExecSamples += Mathf.Max(0, record.executionGood) + Mathf.Max(0, record.executionPerfect) + Mathf.Max(0, record.executionMiss);
			totalHints += Mathf.Max(0, record.hintsShown);

			if (!float.IsNaN(record.meanPathCompletion01))
			{
				totalPathCompletion += Mathf.Clamp01(record.meanPathCompletion01);
				pathSamples++;
			}
		}

		float durationSeconds = (float)(DateTime.UtcNow - sessionStartedUtc).TotalSeconds;

		AlgebraMetricsSessionSummary summary = new AlgebraMetricsSessionSummary
		{
			sessionId = sessionId,
			sceneName = SceneManager.GetActiveScene().name,
			startedAtUtc = sessionStartedUtc.ToString("O"),
			endedAtUtc = DateTime.UtcNow.ToString("O"),
			durationSeconds = Mathf.Max(0f, durationSeconds),
			equationsStarted = equationsStarted,
			equationsSolved = solvedCount,
			equationCompletionRate = equationsStarted > 0 ? solvedCount / (float)equationsStarted : 0f,
			decisionOptimalRate = totalDecisions > 0 ? totalOptimalDecisions / (float)totalDecisions : 0f,
			taggingAccuracy = totalTagAttempts > 0 ? totalCorrectTags / (float)totalTagAttempts : 0f,
			executionGoodPerfectRate = totalExecSamples > 0 ? totalExecGoodOrPerfect / (float)totalExecSamples : 0f,
			meanSolveDurationSeconds = solvedDurationSamples > 0 ? totalSolveSeconds / solvedDurationSamples : 0f,
			totalHintsShown = totalHints,
			meanPathCompletion01 = pathSamples > 0 ? totalPathCompletion / pathSamples : float.NaN
		};

		return summary;
	}

	private static string ComputeShortHash(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
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
