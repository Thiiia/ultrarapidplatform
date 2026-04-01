using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine.Networking;
using TMPro;
#if UNITY_EDITOR
using UnityEditor;
#endif
using UnityEngine;

[System.Serializable]
public class PythonResponse
{
	public bool success;
	public string chart_data;
	public string error;
	public int status_code;
}

public class SongImporter : MonoBehaviour
{
	[SerializeField] private TextMeshProUGUI songName;
	[SerializeField] private TextMeshProUGUI statusText;
	[SerializeField] private string chartFolderPath = "Assets/StreamingAssets/Charts";
	[SerializeField] private string songsFolderPath = "Assets/StreamingAssets/Songs";

	private string importPath = "";
	private AudioClip mp3Importer;
	private string chartData = "";

	private const string API_URL = "https://ultrarapid--combined-audio-analysis-v1-fastapi-app.modal.run/api/analyze";
	private const string PYTHON_SCRIPT = "upload_to_modal.py";

	public void OpenFileExplorer()
	{
#if UNITY_EDITOR
		importPath = EditorUtility.OpenFilePanel("Import MP3 Song (.mp3)", "", "mp3");
		if (!string.IsNullOrEmpty(importPath))
		{
			StartCoroutine(GetSong());
		}
#else
		UnityEngine.Debug.LogWarning("Song importing via file explorer is only available in the Unity Editor.");
#endif
	}

	private IEnumerator GetSong()
	{
		UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip("file://" + importPath, AudioType.MPEG);

		yield return www.SendWebRequest();

		if (www.result == UnityWebRequest.Result.ConnectionError || www.result == UnityWebRequest.Result.ProtocolError)
		{
			UnityEngine.Debug.Log(www.error);
			UpdateStatus("Error loading MP3");
		}
		else
		{
			UnityEngine.Debug.Log("MP3 Loaded");
			mp3Importer = ((DownloadHandlerAudioClip)www.downloadHandler).audioClip;
			songName.text = Path.GetFileName(importPath);
			UpdateStatus("MP3 loaded successfully");

			SendMp3ToAIModel();
		}
	}

	private void SendMp3ToAIModel()
	{
		if (string.IsNullOrEmpty(importPath))
		{
			UnityEngine.Debug.LogError("No MP3 file loaded!");
			UpdateStatus("Error: No file loaded");
			return;
		}

		StartCoroutine(SendViaPythonBridge());
	}

	private IEnumerator SendViaPythonBridge()
	{
		string scriptPath = Path.Combine(Application.dataPath, "..", PYTHON_SCRIPT);

		if (!File.Exists(scriptPath))
		{
			UnityEngine.Debug.LogError($"Python script not found at: {scriptPath}");
			UnityEngine.Debug.LogError("Please create upload_to_modal.py in your project root directory");
			UpdateStatus("Error: Python script missing");
			yield break;
		}

		UpdateStatus("Uploading via Python bridge...");
		UnityEngine.Debug.Log($"Starting Python upload for: {importPath}");

		ProcessStartInfo startInfo = new ProcessStartInfo
		{
			FileName = "python",
			Arguments = $"\"{scriptPath}\" \"{importPath}\" \"{API_URL}\"",
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true
		};

		Process process = new Process { StartInfo = startInfo };

		string stdOutput = "";
		string stdError = "";

		process.OutputDataReceived += (sender, e) =>
		{
			if (!string.IsNullOrEmpty(e.Data))
			{
				stdOutput += e.Data + "\n";
				UnityEngine.Debug.Log($"[Python]: {e.Data}");
			}
		};

		process.ErrorDataReceived += (sender, e) =>
		{
			if (!string.IsNullOrEmpty(e.Data))
			{
				stdError += e.Data + "\n";
				UnityEngine.Debug.Log($"[Python Info]: {e.Data}");
			}
		};

		bool processStarted = process.Start();

		if (!processStarted)
		{
			UnityEngine.Debug.LogError("Failed to start Python process");
			UpdateStatus("Error: Could not start Python");
			yield break;
		}

		process.BeginOutputReadLine();
		process.BeginErrorReadLine();

		UnityEngine.Debug.Log("Python process started, monitoring output...");

		float timeElapsed = 0f;
		float maxTimeout = 1200f;

		while (!process.HasExited)
		{
			timeElapsed += Time.deltaTime;

			if (timeElapsed > maxTimeout)
			{
				UnityEngine.Debug.LogError($"Process timeout after {maxTimeout} seconds");
				UpdateStatus("Error: Processing timeout");
				process.Kill();
				process.Dispose();
				yield break;
			}

			if (timeElapsed % 10 < Time.deltaTime)
			{
				UpdateStatus($"Processing... ({timeElapsed:F0}s / {maxTimeout:F0}s)");
			}

			yield return null;
		}

		UnityEngine.Debug.Log($"Python process exited with code: {process.ExitCode}");
		UnityEngine.Debug.Log($"Total time: {timeElapsed:F1} seconds");

		yield return new WaitForSeconds(0.5f);

		int exitCode = process.ExitCode;
		process.Dispose();

		if (exitCode == 0)
		{
			UnityEngine.Debug.Log("✅ Python process completed successfully!");
			UpdateStatus("Processing complete, saving files...");

			yield return StartCoroutine(ParseAndSaveChart(stdOutput));
		}
		else
		{
			UnityEngine.Debug.LogError($"❌ Python script failed with exit code: {exitCode}");
			UpdateStatus("Error: Upload failed");
		}
	}

	private IEnumerator ParseAndSaveChart(string output)
	{
		string[] lines = output.Split('\n');
		string jsonLine = "";

		for (int i = lines.Length - 1; i >= 0; i--)
		{
			if (lines[i].Trim().StartsWith("{"))
			{
				jsonLine = lines[i].Trim();
				break;
			}
		}

		if (string.IsNullOrEmpty(jsonLine))
		{
			UnityEngine.Debug.LogError("Could not find JSON response in output");
			UpdateStatus("Error: Invalid response");
			yield break;
		}

		UnityEngine.Debug.Log($"Found JSON response: {jsonLine.Length} characters");

		PythonResponse response = JsonUtility.FromJson<PythonResponse>(jsonLine);

		if (response == null || !response.success)
		{
			UnityEngine.Debug.LogError($"Failed to parse response or API error: {response?.error}");
			UpdateStatus("Error: Processing failed");
			yield break;
		}

		// FIXED: Proper unescaping - replace \n and \t, but NOT single backslashes (for paths)
		// Then replace escaped quotes
		string unescapedChartData = response.chart_data
			.Replace("\\n", "\n")
			.Replace("\\t", "\t")
			.Replace("\\\"", "\"");

		// Convert the chart to simpler format
		chartData = ConvertChartToSimpleFormat(unescapedChartData);

		// Clean up any trailing junk like "} at the end
		chartData = CleanupChartData(chartData);

		UnityEngine.Debug.Log($"Chart converted to simple format");

		yield return StartCoroutine(SaveFiles());
	}

	private string CleanupChartData(string chartData)
	{
		// Remove any trailing quotes and braces that shouldn't be there
		chartData = chartData.TrimEnd();

		// If it ends with "}, remove it
		if (chartData.EndsWith("\"}"))
		{
			chartData = chartData.Substring(0, chartData.Length - 2);
		}
		// If it ends with just }, keep it (that's valid)
		// If it ends with just ", remove it
		else if (chartData.EndsWith("\""))
		{
			chartData = chartData.Substring(0, chartData.Length - 1);
		}

		return chartData;
	}

	private string ConvertChartToSimpleFormat(string originalChart)
	{
		StringBuilder simpleChart = new StringBuilder();

		// Extract sections more carefully
		string songSection = ExtractSimpleSongSection(originalChart);
		string syncTrack = ExtractSection(originalChart, "SyncTrack");
		string events = ExtractSection(originalChart, "Events");
		string mediumSingle = ExtractSection(originalChart, "MediumSingle");
		string easySingle = ExtractSection(originalChart, "EasySingle");

		// Build the chart in order - NO blank lines between sections
		simpleChart.Append(songSection);
		simpleChart.Append(syncTrack);
		simpleChart.Append(events);
		simpleChart.Append(mediumSingle);
		simpleChart.Append(easySingle);

		return simpleChart.ToString();
	}

	private string ExtractSimpleSongSection(string chart)
	{
		StringBuilder section = new StringBuilder();
		section.Append("[Song]\n");
		section.Append("{\n");
		section.Append("  Offset = 0\n");
		section.Append("  Resolution = 240\n");
		section.Append("  Player2 = bass\n");
		section.Append("  Difficulty = 0\n");
		section.Append("  PreviewStart = 0\n");
		section.Append("  PreviewEnd = 0\n");
		section.Append("  Genre = \"rock\"\n");
		section.Append("  MediaType = \"cd\"\n");
		section.Append("  MusicStream = \"PLACEHOLDER_PATH\"\n");
		section.Append("}\n");

		return section.ToString();
	}

	private string ExtractSection(string chart, string sectionName)
	{
		// Find the section start
		string startMarker = "[" + sectionName + "]";
		int startIndex = chart.IndexOf(startMarker);

		if (startIndex == -1)
		{
			UnityEngine.Debug.LogWarning($"Section {sectionName} not found in chart");
			return "";
		}

		// Find the section end (next [ or end of string)
		int endIndex = chart.IndexOf("\n[", startIndex + startMarker.Length);
		if (endIndex == -1)
		{
			endIndex = chart.Length;
		}

		// Extract the section
		string section = chart.Substring(startIndex, endIndex - startIndex);

		// Clean up the section
		StringBuilder cleanSection = new StringBuilder();
		string[] lines = section.Split('\n');

		foreach (string line in lines)
		{
			string trimmed = line.Trim();

			// Skip completely empty lines
			if (string.IsNullOrWhiteSpace(trimmed))
			{
				continue;
			}

			// Add the line with proper formatting
			if (trimmed.StartsWith("["))
			{
				cleanSection.Append(trimmed + "\n");
			}
			else if (trimmed == "{")
			{
				cleanSection.Append("{\n");
			}
			else if (trimmed == "}")
			{
				cleanSection.Append("}\n");
			}
			else
			{
				// Add proper indentation for content lines (2 spaces)
				cleanSection.Append("  " + trimmed + "\n");
			}
		}

		return cleanSection.ToString();
	}

	private IEnumerator SaveFiles()
	{
		string fullChartPath = Path.Combine(Application.dataPath, chartFolderPath.Replace("Assets/", ""));
		string fullSongsPath = Path.Combine(Application.dataPath, songsFolderPath.Replace("Assets/", ""));

		if (!Directory.Exists(fullChartPath))
		{
			Directory.CreateDirectory(fullChartPath);
			UnityEngine.Debug.Log($"Created directory: {fullChartPath}");
		}

		if (!Directory.Exists(fullSongsPath))
		{
			Directory.CreateDirectory(fullSongsPath);
			UnityEngine.Debug.Log($"Created directory: {fullSongsPath}");
		}

		string fileName = Path.GetFileNameWithoutExtension(importPath);
		string mp3FileName = Path.GetFileName(importPath);

		string chartFilePath = Path.Combine(fullChartPath, fileName + ".chart");
		string mp3FilePath = Path.Combine(fullSongsPath, mp3FileName);

		// Convert forward slashes to backslashes for Windows paths
		string windowsPath = mp3FilePath.Replace("/", "\\");

		// Update the MusicStream path to point to the actual saved MP3
		chartData = chartData.Replace("PLACEHOLDER_PATH", windowsPath);

		UpdateStatus("Saving files...");
		yield return null;

		bool saveComplete = false;
		bool saveSuccess = false;
		string errorMsg = "";

		System.Threading.Tasks.Task.Run(() =>
		{
			try
			{
				// Save chart file
				File.WriteAllText(chartFilePath, chartData);
				UnityEngine.Debug.Log($"✅ Chart saved: {chartFilePath}");

				// Copy MP3 file
				File.Copy(importPath, mp3FilePath, true);
				UnityEngine.Debug.Log($"✅ MP3 copied: {mp3FilePath}");

				saveSuccess = true;
			}
			catch (Exception e)
			{
				errorMsg = e.Message;
				saveSuccess = false;
			}
			finally
			{
				saveComplete = true;
			}
		});

		while (!saveComplete)
		{
			yield return null;
		}

		if (saveSuccess)
		{
			UnityEngine.Debug.Log("🎉 All files saved successfully!");
			UnityEngine.Debug.Log($"📁 Chart: {chartFilePath}");
			UnityEngine.Debug.Log($"🎵 MP3: {mp3FilePath}");
			UpdateStatus($"✅ Complete! {fileName}");

#if UNITY_EDITOR
			UnityEditor.AssetDatabase.Refresh();

			UnityEngine.Object chartAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(chartFolderPath + "/" + fileName + ".chart");
			if (chartAsset != null)
			{
				UnityEditor.Selection.activeObject = chartAsset;
				UnityEditor.EditorGUIUtility.PingObject(chartAsset);
			}
#endif
			if (mp3Importer)
			{
				GameplayEventBus.uploadedClip = mp3Importer;
			}

			GameplayEventBus.generatedChartFilePath = chartFilePath;
			OnFilesImported(chartFilePath, mp3FilePath);
		}
		else
		{
			UnityEngine.Debug.LogError($"❌ Failed to save files: {errorMsg}");
			UpdateStatus("Error: Failed to save files");
		}
	}

	private void OnFilesImported(string chartPath, string mp3Path)
	{
		UnityEngine.Debug.Log($"✨ Import complete!");
		UnityEngine.Debug.Log($"Chart: {Path.GetFileName(chartPath)}");
		UnityEngine.Debug.Log($"Song: {Path.GetFileName(mp3Path)}");
	}

	private void UpdateStatus(string message)
	{
		if (statusText != null)
		{
			statusText.text = message;
		}
	}

	public void ProcessLoadedSong()
	{
		SendMp3ToAIModel();
	}

	public void TestPython()
	{
		StartCoroutine(TestPythonInstallation());
	}

	private IEnumerator TestPythonInstallation()
	{
		UnityEngine.Debug.Log("Testing Python installation...");

		ProcessStartInfo startInfo = new ProcessStartInfo
		{
			FileName = "python",
			Arguments = "--version",
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true
		};

		Process process = new Process { StartInfo = startInfo };
		process.Start();

		float timeElapsed = 0f;
		while (!process.HasExited && timeElapsed < 5f)
		{
			timeElapsed += Time.deltaTime;
			yield return null;
		}

		if (!process.HasExited)
		{
			process.Kill();
			UnityEngine.Debug.LogError("Python command timed out");
		}
		else
		{
			string output = process.StandardOutput.ReadToEnd();
			string error = process.StandardError.ReadToEnd();
			UnityEngine.Debug.Log($"Python version: {output}");
			if (!string.IsNullOrEmpty(error))
			{
				UnityEngine.Debug.Log($"Python stderr: {error}");
			}
		}

		process.Dispose();
	}
}
