using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

/// <summary>
/// Enumerates available .chart files from both StreamingAssets and persistentDataPath.
/// This is the foundation for "player imported charts" without having to ship them in the build.
/// </summary>
public static class ChartLibrary
{
	public const string StreamingChartsRelativeRoot = "Charts";
	public const string UserChartsRelativeRoot = "UserCharts";

	public readonly struct ChartEntry
	{
		public readonly string displayName;
		public readonly string relativePath;
		public readonly string absolutePath;
		public readonly bool isUserChart;
		public readonly string[] sectionKeys;

		public ChartEntry(string displayName, string relativePath, string absolutePath, bool isUserChart, string[] sectionKeys)
		{
			this.displayName = displayName;
			this.relativePath = relativePath;
			this.absolutePath = absolutePath;
			this.isUserChart = isUserChart;
			this.sectionKeys = sectionKeys ?? Array.Empty<string>();
		}
	}

	public static string GetStreamingChartsAbsoluteRoot()
		=> Path.Combine(Application.streamingAssetsPath, StreamingChartsRelativeRoot);

	public static string GetUserChartsAbsoluteRoot()
		=> Path.Combine(Application.persistentDataPath, UserChartsRelativeRoot);

	public static IReadOnlyList<ChartEntry> GetCharts(bool includeStreaming = true, bool includeUser = true, bool parseSections = true)
	{
		var results = new List<ChartEntry>(128);

		if (includeStreaming)
			CollectFromRoot(results, GetStreamingChartsAbsoluteRoot(), StreamingChartsRelativeRoot, isUser: false, parseSections);

		if (includeUser && Application.platform != RuntimePlatform.WebGLPlayer)
			CollectFromRoot(results, GetUserChartsAbsoluteRoot(), UserChartsRelativeRoot, isUser: true, parseSections);

		results.Sort((a, b) => string.Compare(a.displayName, b.displayName, StringComparison.OrdinalIgnoreCase));
		return results;
	}

	public static bool TryImportUserChart(string sourceAbsolutePath, out string importedRelativePath, bool overwrite = false)
	{
		importedRelativePath = null;

		if (string.IsNullOrWhiteSpace(sourceAbsolutePath))
			return false;

		if (Application.platform == RuntimePlatform.WebGLPlayer)
			return false;

		if (!File.Exists(sourceAbsolutePath))
			return false;

		string ext = Path.GetExtension(sourceAbsolutePath);
		if (!string.Equals(ext, ".chart", StringComparison.OrdinalIgnoreCase))
			return false;

		string fileName = SanitizeFileName(Path.GetFileName(sourceAbsolutePath));
		if (string.IsNullOrWhiteSpace(fileName))
			return false;

		string root = GetUserChartsAbsoluteRoot();
		Directory.CreateDirectory(root);

		string destAbs = Path.Combine(root, fileName);
		if (File.Exists(destAbs) && !overwrite)
			return false;

		File.Copy(sourceAbsolutePath, destAbs, overwrite: true);

		importedRelativePath = $"{UserChartsRelativeRoot}/{fileName}".Replace('\\', '/');
		return true;
	}

	private static void CollectFromRoot(List<ChartEntry> results, string absoluteRoot, string relativeRoot, bool isUser, bool parseSections)
	{
		try
		{
			if (string.IsNullOrWhiteSpace(absoluteRoot) || !Directory.Exists(absoluteRoot))
				return;

			string[] files = Directory.GetFiles(absoluteRoot, "*.chart", SearchOption.TopDirectoryOnly);
			for (int i = 0; i < files.Length; i++)
			{
				string abs = files[i];
				string fileName = Path.GetFileName(abs);
				string rel = $"{relativeRoot}/{fileName}".Replace('\\', '/');
				string display = Path.GetFileNameWithoutExtension(fileName);

				string[] sections = Array.Empty<string>();
				if (parseSections)
				{
					TryParseSectionKeys(abs, out sections);
				}

				results.Add(new ChartEntry(display, rel, abs, isUser, sections));
			}
		}
		catch (Exception ex)
		{
			Debug.LogWarning($"[ChartLibrary] Failed to enumerate charts in '{absoluteRoot}': {ex.Message}");
		}
	}

	/// <summary>
	/// Quick scan for bracket sections like [EasySingle], [ExpertSingle], etc.
	/// Used for UI + validation, not authoritative parsing.
	/// </summary>
	public static bool TryParseSectionKeys(string chartAbsolutePath, out string[] sectionKeys)
	{
		sectionKeys = Array.Empty<string>();
		if (string.IsNullOrWhiteSpace(chartAbsolutePath) || !File.Exists(chartAbsolutePath))
			return false;

		try
		{
			var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (string line in File.ReadLines(chartAbsolutePath))
			{
				string trimmed = line?.Trim();
				if (string.IsNullOrEmpty(trimmed))
					continue;

				if (trimmed.Length < 3 || trimmed[0] != '[')
					continue;

				int close = trimmed.IndexOf(']');
				if (close <= 1)
					continue;

				string key = trimmed.Substring(1, close - 1).Trim();
				if (string.IsNullOrEmpty(key))
					continue;

				// Ignore non-note buckets.
				if (key.Equals("Song", StringComparison.OrdinalIgnoreCase) ||
				    key.Equals("SyncTrack", StringComparison.OrdinalIgnoreCase) ||
				    key.Equals("Events", StringComparison.OrdinalIgnoreCase))
					continue;

				keys.Add(key);
			}

			sectionKeys = keys.OrderBy(k => k, StringComparer.OrdinalIgnoreCase).ToArray();
			return sectionKeys.Length > 0;
		}
		catch (Exception ex)
		{
			Debug.LogWarning($"[ChartLibrary] Failed to parse chart sections for '{chartAbsolutePath}': {ex.Message}");
			return false;
		}
	}

	private static string SanitizeFileName(string fileName)
	{
		if (string.IsNullOrWhiteSpace(fileName))
			return string.Empty;

		foreach (char c in Path.GetInvalidFileNameChars())
			fileName = fileName.Replace(c.ToString(), "_");

		return fileName.Trim();
	}
}

