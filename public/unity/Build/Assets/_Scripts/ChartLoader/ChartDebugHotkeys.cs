using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Lightweight runtime helper for quickly testing multiple charts in the same scene.
/// Uses hotkeys to switch ChartSystem.Path and optionally load a matching song from StreamingAssets/Songs.
/// </summary>
public class ChartDebugHotkeys : MonoBehaviour
{
	[Header("Enable")]
	[SerializeField] private bool enableHotkeys = true;

	[Header("Hotkeys")]
	[SerializeField] private KeyCode previousChartKey = KeyCode.LeftBracket;
	[SerializeField] private KeyCode nextChartKey = KeyCode.RightBracket;
	[SerializeField] private KeyCode reloadKey = KeyCode.Backslash;
	[SerializeField] private KeyCode toggleBeatModeKey = KeyCode.F8;

	[Header("Audio (optional)")]
	[SerializeField] private bool autoLoadAudioFromStreamingAssets = true;
	[SerializeField] private string songsFolderRelative = "Songs";
	[SerializeField] private string chartsFolderRelative = "Charts";
	[SerializeField] private bool includeUserCharts = true;
	[SerializeField] private string userChartsFolderRelative = "UserCharts";

	[Header("Debug")]
	[SerializeField] private bool logSwitches = true;

	private ChartSystem chartSystem;
	private AudioManager audioManager;

	private readonly List<string> chartRelativePaths = new List<string>();
	private readonly Dictionary<string, string> chartToAudioAbsolutePath = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
	private int currentIndex;
	private Coroutine audioLoadRoutine;

	private void Awake()
	{
		if (Application.platform == RuntimePlatform.WebGLPlayer)
		{
			enabled = false;
			return;
		}

		chartSystem = FindFirstObjectByType<ChartSystem>();
		audioManager = AudioManager.Instance;

		RebuildChartList();
		BuildAudioMap();
		SyncCurrentIndexFromChartSystem();
	}

	private void Update()
	{
		if (!enableHotkeys || chartSystem == null)
			return;

		if (Input.GetKeyDown(previousChartKey))
			SwitchChart(-1);
		if (Input.GetKeyDown(nextChartKey))
			SwitchChart(+1);
		if (Input.GetKeyDown(reloadKey))
			ReloadCurrent();
		if (Input.GetKeyDown(toggleBeatModeKey))
			ToggleBeatMode();
	}

	private void RebuildChartList()
	{
		chartRelativePaths.Clear();

		try
		{
			string chartsRoot = Path.Combine(Application.streamingAssetsPath, chartsFolderRelative);
			if (!Directory.Exists(chartsRoot))
				chartsRoot = null;

			if (!string.IsNullOrEmpty(chartsRoot))
			{
				foreach (string file in Directory.GetFiles(chartsRoot, "*.chart", SearchOption.TopDirectoryOnly))
				{
					string rel = $"{chartsFolderRelative}/{Path.GetFileName(file)}";
					chartRelativePaths.Add(rel);
				}
			}

			if (includeUserCharts)
			{
				string userRoot = Path.Combine(Application.persistentDataPath, userChartsFolderRelative);
				if (Directory.Exists(userRoot))
				{
					foreach (string file in Directory.GetFiles(userRoot, "*.chart", SearchOption.TopDirectoryOnly))
					{
						string rel = $"{userChartsFolderRelative}/{Path.GetFileName(file)}";
						chartRelativePaths.Add(rel);
					}
				}
			}

			chartRelativePaths.Sort(StringComparer.OrdinalIgnoreCase);
		}
		catch (Exception ex)
		{
			if (logSwitches)
				Debug.LogWarning($"[ChartDebugHotkeys] Failed to enumerate charts: {ex.Message}");
		}
	}

	private void BuildAudioMap()
	{
		chartToAudioAbsolutePath.Clear();
		if (!autoLoadAudioFromStreamingAssets)
			return;

		try
		{
			string songsRoot = Path.Combine(Application.streamingAssetsPath, songsFolderRelative);
			if (!Directory.Exists(songsRoot))
				return;

			List<string> songs = Directory.GetFiles(songsRoot, "*.mp3", SearchOption.TopDirectoryOnly).ToList();
			if (songs.Count == 0)
				return;

			foreach (string chartRel in chartRelativePaths)
			{
				string chartName = Path.GetFileNameWithoutExtension(chartRel);
				string best = FindBestMatchingSongPath(chartName, songs);
				if (!string.IsNullOrEmpty(best))
					chartToAudioAbsolutePath[chartRel] = best;
			}
		}
		catch (Exception ex)
		{
			if (logSwitches)
				Debug.LogWarning($"[ChartDebugHotkeys] Failed to enumerate songs: {ex.Message}");
		}
	}

	private void SyncCurrentIndexFromChartSystem()
	{
		if (chartSystem == null || chartRelativePaths.Count == 0)
		{
			currentIndex = 0;
			return;
		}

		int idx = chartRelativePaths.FindIndex(p => string.Equals(p, chartSystem.Path, StringComparison.OrdinalIgnoreCase));
		currentIndex = idx >= 0 ? idx : 0;
	}

	private void SwitchChart(int delta)
	{
		if (chartRelativePaths.Count == 0)
			return;

		currentIndex = (currentIndex + delta) % chartRelativePaths.Count;
		if (currentIndex < 0)
			currentIndex += chartRelativePaths.Count;

		string rel = chartRelativePaths[currentIndex];
		LoadChart(rel);
	}

	private void ReloadCurrent()
	{
		if (chartRelativePaths.Count == 0)
			return;

		string rel = chartRelativePaths[Mathf.Clamp(currentIndex, 0, chartRelativePaths.Count - 1)];
		LoadChart(rel);
	}

	private void ToggleBeatMode()
	{
		if (chartSystem == null)
			return;

		ChartSystem.BeatScheduleMode next =
			chartSystem.BeatMode == ChartSystem.BeatScheduleMode.FromNotes
				? ChartSystem.BeatScheduleMode.FromSyncTrackQuarterNotes
				: ChartSystem.BeatScheduleMode.FromNotes;

		chartSystem.SetBeatScheduleMode(next);

		if (logSwitches)
			Debug.Log($"[ChartDebugHotkeys] Beat mode -> {next}");

		ReloadCurrent();
	}

	private void LoadChart(string chartRelativePath)
	{
		if (chartSystem == null)
			return;

		if (logSwitches)
			Debug.Log($"[ChartDebugHotkeys] Loading chart '{chartRelativePath}'");

		chartSystem.Path = chartRelativePath;

		if (autoLoadAudioFromStreamingAssets)
		{
			if (audioLoadRoutine != null)
				StopCoroutine(audioLoadRoutine);

			audioLoadRoutine = StartCoroutine(LoadAudioForChartThenReload(chartRelativePath));
			return;
		}

		chartSystem.ReloadChart(preservePlaybackPosition: false);
	}

	private IEnumerator LoadAudioForChartThenReload(string chartRelativePath)
	{
		// AudioManager may not exist yet when this component is auto-added very early at runtime.
		// Always refresh it at the moment we actually need it.
		if (audioManager == null)
			audioManager = AudioManager.Instance;

		if (audioManager != null && audioManager.musicSource != null)
		{
			audioManager.musicSource.Stop();
			audioManager.musicSource.clip = null;
		}

		if (!chartToAudioAbsolutePath.TryGetValue(chartRelativePath, out string audioPath) || string.IsNullOrEmpty(audioPath))
		{
			if (logSwitches)
				Debug.LogWarning($"[ChartDebugHotkeys] No matching audio found for '{chartRelativePath}'. Reloading chart anyway.");

			chartSystem.ReloadChart(preservePlaybackPosition: false);
			yield break;
		}

		string url = audioPath;
		try
		{
			if (!audioPath.Contains("://"))
				url = new Uri(audioPath).AbsoluteUri;
		}
		catch (Exception ex)
		{
			if (logSwitches)
				Debug.LogWarning($"[ChartDebugHotkeys] Failed to build audio URL for '{audioPath}': {ex.Message}");
		}

		using (UnityWebRequest uwr = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
		{
			yield return uwr.SendWebRequest();

			if (uwr.result != UnityWebRequest.Result.Success)
			{
				Debug.LogWarning($"[ChartDebugHotkeys] Audio load failed '{url}': {uwr.error}");
			}
			else
			{
				AudioClip clip = DownloadHandlerAudioClip.GetContent(uwr);
				if (clip != null && audioManager != null && audioManager.musicSource != null)
					audioManager.musicSource.clip = clip;
			}
		}

		chartSystem.ReloadChart(preservePlaybackPosition: false);

		// If charts are being used outside the tutorial flow, kick playback.
		if (audioManager == null)
			audioManager = AudioManager.Instance;

		if (audioManager != null && audioManager.musicSource != null && audioManager.musicSource.clip != null && !AudioManager.IsAutoStartSuppressed)
			audioManager.SchedulePlaybackNow();
	}

	private static string FindBestMatchingSongPath(string chartName, List<string> songPaths)
	{
		string chartKey = NormalizeName(chartName);

		string best = null;
		int bestScore = -1;

		for (int i = 0; i < songPaths.Count; i++)
		{
			string songPath = songPaths[i];
			string songName = Path.GetFileNameWithoutExtension(songPath);
			string songKey = NormalizeName(songName);

			int score = 0;
			if (songKey == chartKey)
				score += 1000;

			if (songKey.Contains(chartKey) || chartKey.Contains(songKey))
				score += 200;

			string[] chartTokens = chartKey.Split(new[] { '_' }, StringSplitOptions.RemoveEmptyEntries);
			for (int t = 0; t < chartTokens.Length; t++)
			{
				if (songKey.Contains(chartTokens[t]))
					score += 10;
			}

			if (score > bestScore)
			{
				bestScore = score;
				best = songPath;
			}
		}

		return bestScore >= 10 ? best : null;
	}

	private static string NormalizeName(string value)
	{
		if (string.IsNullOrEmpty(value))
			return string.Empty;

		string s = value.ToLowerInvariant();
		s = s.Replace("(", string.Empty).Replace(")", string.Empty);
		s = s.Replace("-", " ").Replace(".", " ").Replace(",", " ").Replace("'", string.Empty);
		s = RegexCollapseWhitespaceToUnderscore(s);
		return s;
	}

	private static string RegexCollapseWhitespaceToUnderscore(string value)
	{
		char[] buffer = new char[value.Length];
		int len = 0;
		bool lastWasUnderscore = false;
		for (int i = 0; i < value.Length; i++)
		{
			char c = value[i];
			bool isWs = char.IsWhiteSpace(c);
			if (isWs)
			{
				if (!lastWasUnderscore && len > 0)
				{
					buffer[len++] = '_';
					lastWasUnderscore = true;
				}
				continue;
			}

			if (char.IsLetterOrDigit(c) || c == '_')
			{
				buffer[len++] = c;
				lastWasUnderscore = c == '_';
				continue;
			}
		}

		while (len > 0 && buffer[len - 1] == '_')
			len--;

		return new string(buffer, 0, len);
	}
}
