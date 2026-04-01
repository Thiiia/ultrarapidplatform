using System.Diagnostics;
using UnityEngine;

/// <summary>
/// Tiny global hook that logs extra detail for the recurring
/// ArgumentNullException(source) you see only in WebGL.
/// Installs itself automatically on load and survives scene changes.
/// </summary>
public class GlobalExceptionLogger : MonoBehaviour
{
	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
	private static void Install()
	{
		var go = new GameObject("GlobalExceptionLogger");
		Object.DontDestroyOnLoad(go);
		go.AddComponent<GlobalExceptionLogger>();
	}

	private void OnEnable()
	{
		Application.logMessageReceived += HandleLogMessage;
	}

	private void OnDisable()
	{
		Application.logMessageReceived -= HandleLogMessage;
	}

	private void HandleLogMessage(string condition, string stackTrace, LogType type)
	{
		if (type != LogType.Exception)
			return;

		// We only care about the mysterious WebGL ArgumentNullException "source"
		if (string.IsNullOrEmpty(condition))
			return;

		if (!condition.Contains("ArgumentNullException") || !condition.Contains("source"))
			return;

		// Emit a local managed stack so we can see which method
		// in your C# code is actually throwing, even when WebGL
		// collapses the original trace.
		var localTrace = new StackTrace(true);
		UnityEngine.Debug.LogError($"[GlobalExceptionLogger] Captured ArgumentNullException(source).\n" +
		               $"Condition: {condition}\n" +
		               $"Local managed stack:\n{localTrace}\n" +
		               $"Original reported stack:\n{stackTrace}");
	}
}

