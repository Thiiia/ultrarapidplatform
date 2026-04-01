using UnityEngine;
using ChartLoader.NET.Framework;

public partial class DragExecutionController
{
	private void ApplyAlgebraChartConfigIfNeeded()
	{
		if (!applyAlgebraChartConfigOnStart || algebraChartConfig == null)
		{
			return;
		}

		if (algebraChartConfig.dragsPerStep > 0)
		{
			dragsPerStep = Mathf.Max(1, algebraChartConfig.dragsPerStep);
		}

		if (algebraChartConfig.wispSpeedNotesAhead > 0f)
		{
			wispSpeed = Mathf.Max(1f, algebraChartConfig.wispSpeedNotesAhead);
		}
	}

	private void MaybeConfigureChartSystem()
	{
		if (!configureChartSystemOnStart)
		{
			return;
		}

		if (ResolveChartSystem() == null)
		{
			return;
		}

		// Algebra uses the "wisp" judgement profile and does not need highway visuals.
		chartSystem.SetVisualizationMode(ChartSystem.VisualizationMode.WispPerimeter);

		// ChartSystem owns chart loading/reloading. Avoid duplicate startup loads here because
		// they race with ChartSystem.Start(), especially on WebGL where loading is async.
		bool chartAlreadyLoaded = ChartSystem.CachedNotes != null;

		if (!chartAlreadyLoaded)
		{
			string startupPath = null;

			if (applyAlgebraChartConfigOnStart &&
				algebraChartConfig != null &&
				!string.IsNullOrWhiteSpace(algebraChartConfig.chartPath))
			{
				startupPath = algebraChartConfig.chartPath.Trim();
			}
			else if (overrideChartPathOnStart && !string.IsNullOrWhiteSpace(chartPathOverride))
			{
				// Legacy fallback: only seed the path if ChartSystem has not already been configured.
				startupPath = chartPathOverride.Trim();
			}

			if (string.IsNullOrWhiteSpace(chartSystem.Path) && !string.IsNullOrWhiteSpace(startupPath))
			{
				chartSystem.Path = startupPath;
			}

			if (applyAlgebraChartConfigOnStart && algebraChartConfig != null)
			{
				chartSystem.SetDifficulty(algebraChartConfig.chartDifficulty, reloadChart: false);
			}

			if (forceBeatModeFromNotes)
			{
				chartSystem.SetBeatScheduleMode(ChartSystem.BeatScheduleMode.FromNotes);
			}
		}
		else if (autoBeatModeFromChart && !forceBeatModeFromNotes)
		{
			// Safe to refine beat mode after chart init without taking ownership of loading.
			ApplyBeatScheduleModeFromChart();
		}
	}

	private void HandleChartInitialized()
	{
		ResolveChartSystem();
		ResetWispBeatCache();

		if (autoBeatModeFromChart && !forceBeatModeFromNotes)
		{
			ApplyBeatScheduleModeFromChart();
		}

		RequestJourneyGuidanceRefresh();
	}

	private bool IsProceduralOrDotWispPathConfigured()
	{
		// Dot-sprite mode is explicitly procedural. Also treat "no authored arc sprite" setups
		// as procedural so runtime style stays consistent across generated curves.
		return wispDotSprite != null || !HasWispArcSprites();
	}

	private void ApplyProceduralWispVisualProfileIfNeeded()
	{
		if (!wispAutoApplyFigmaPaletteForProceduralPath || !IsProceduralOrDotWispPathConfigured())
		{
			return;
		}

		ApplyFigmaWispPathPaletteInternal(markEditorDirty: false);

		if (wispProceduralPathForceGradientOnly)
		{
			wispPathGradientOnlyMode = true;
		}

		// Dot/procedural paths read too thin on some aspect ratios if left purely data-driven.
		wispPathWidthRatio = Mathf.Max(wispPathWidthRatio, wispProceduralPathMinWidthRatio);
		wispPathThicknessMultiplier = Mathf.Max(1f, wispPathThicknessMultiplier);
		if (wispDotSprite != null)
		{
			// Dot sprite mode uses its own dedicated thickness multiplier.
			float dotSoftFloor = Mathf.Clamp(wispProceduralPathMinDotThicknessMultiplier, 0.25f, 1f);
			wispDotPathThicknessMultiplier = Mathf.Max(wispDotPathThicknessMultiplier, dotSoftFloor);
			wispDotPathEndpointEdgeBias = Mathf.Clamp01(wispDotPathEndpointEdgeBias);
			wispShapesPolylineRoundJoins = true;
			wispShapesPolylineDecimation = Mathf.Min(wispShapesPolylineDecimation, 0.08f);
			wispShapesPolylineMaxPoints = Mathf.Max(wispShapesPolylineMaxPoints, 180);
		}
		else
		{
			wispShapesPolylineThicknessMultiplier = Mathf.Max(wispShapesPolylineThicknessMultiplier, wispProceduralPathMinShapesThicknessMultiplier);
		}

		// Keep behind-bubble visibility stable without shifting gradient hues toward gray/white.
		wispPathMinAlphaWhenBehind = Mathf.Min(wispPathMinAlphaWhenBehind, 0.58f);
		wispPathTintLiftWhenBehind = Mathf.Min(wispPathTintLiftWhenBehind, 0.05f);
		wispPathAlphaLiftWhenBehind = Mathf.Min(wispPathAlphaLiftWhenBehind, 0.04f);
		wispZoneAlphaLiftWhenBehind = Mathf.Min(wispZoneAlphaLiftWhenBehind, 0.04f);
		wispEndpointBubbleFadeEnabled = true;
		wispEndpointBubbleFadeOutlineBand = Mathf.Min(wispEndpointBubbleFadeOutlineBand, 0.03f);
	}

	private void ResetWispBeatCache()
	{
		wispCachedNotesRef = null;
		wispBeatTimes = null;
		wispBeatNotes = null;
		wispTargetBeatIndex = -1;
	}

	private void ApplyBeatScheduleModeFromChart()
	{
		if (chartSystem == null)
		{
			return;
		}

		if (!TrySelectBeatScheduleModeFromChart(out ChartSystem.BeatScheduleMode mode))
		{
			return;
		}

		if (chartSystem.BeatMode != mode)
		{
			chartSystem.SetBeatScheduleMode(mode);
		}
	}

	private bool TrySelectBeatScheduleModeFromChart(out ChartSystem.BeatScheduleMode mode)
	{
		mode = chartSystem != null ? chartSystem.BeatMode : ChartSystem.BeatScheduleMode.FromNotes;

		if (ChartSystem.Chart == null || ChartSystem.Chart.SynchTracks == null || ChartSystem.Chart.SynchTracks.Length == 0)
		{
			return false;
		}

		Note[] notes = ChartSystem.CachedNotes;
		if (notes == null || notes.Length == 0)
		{
			mode = ChartSystem.BeatScheduleMode.FromSyncTrackQuarterNotes;
			return true;
		}

		float min = float.MaxValue;
		float max = 0f;
		for (int i = 0; i < notes.Length; i++)
		{
			Note n = notes[i];
			if (n == null)
			{
				continue;
			}

			float t = ChartSystem.GetNoteSongTime(n);
			if (t < min)
			{
				min = t;
			}

			if (t > max)
			{
				max = t;
			}
		}

		float span = Mathf.Max(0.001f, max - min);
		float notesPerSecond = notes.Length / span;
		mode = notesPerSecond >= autoBeatModeNotesPerSecondThreshold
			? ChartSystem.BeatScheduleMode.FromSyncTrackQuarterNotes
			: ChartSystem.BeatScheduleMode.FromNotes;
		return true;
	}

	private void ApplyFigmaWispPathPaletteInternal(bool markEditorDirty)
	{
		// Figma look: warm red/orange source side, richer olive/green timing zone, charcoal destination side.
		// Keep the path dynamic, but align dynamic tints to the same palette so it doesn't read as white/pastel.
		wispUseDirectionalPathGradient = true;
		wispPathGradientStartColor = new Color(0.93f, 0.14f, 0.12f, 0.78f); // strong red
		wispPathGradientMiddleColor = new Color(0.88f, 0.58f, 0.18f, 0.77f); // cohesive third color (amber)
		wispPathGradientMiddlePosition = 0.56f;
		wispPathGradientMiddleBlendStrength = 0.9f;
		wispPathGradientEndColor = new Color(0.38f, 0.74f, 0.22f, 0.76f);    // balanced green-side end
		wispPathGradientExponent = 1.16f;
		wispPathColor = new Color(0.22f, 0.25f, 0.21f, 0.68f);
		greenZoneColor = new Color(0.58f, 0.96f, 0.20f, 0.86f);              // bright good-zone lime
		wispOverlapEarlyColor = new Color(0.96f, 0.20f, 0.18f, 0.86f);       // early cue red
		wispOverlapGoodColor = new Color(0.84f, 0.96f, 0.28f, 0.88f);        // good cue yellow-green
		wispOverlapPerfectColor = new Color(0.50f, 1.00f, 0.36f, 0.90f);     // bright perfect-zone green

		// Make the green timing zone visually clearer on long arcs without turning the whole path green.
		wispPathGreenZoneTintStrength = 0.5f;
		wispPathPerfectZoneTintStrength = 0.62f;
		wispPathPreGreenRampWidth = 0.18f;
		wispPathPreGreenRampStrength = 0.18f;
		wispGoodZoneGradientStartColor = new Color(0.70f, 0.93f, 0.24f, 0.86f);
		wispGoodZoneGradientEndColor = new Color(0.48f, 1.00f, 0.40f, 0.88f);
		wispGoodZoneGradientStrength = 0.68f;
		wispGoodZoneShimmerStrength = 0.18f;
		wispGoodZoneShimmerHz = 2.0f;
		wispGoodZonePulseColor = new Color(0.60f, 1.00f, 0.42f, 0.88f);
		wispGoodZonePulseTintStrength = 0.56f;

		// Keep path readable behind equation bubbles without washing it toward white.
		wispPathMinAlphaWhenBehind = 0.58f;
		wispPathBehindLiftColor = new Color(0.26f, 0.29f, 0.24f, 1f);        // subtle olive-slate lift instead of white
		wispPathTintLiftWhenBehind = 0.05f;
		wispPathAlphaLiftWhenBehind = 0.04f;
		wispZoneAlphaLiftWhenBehind = 0.04f;
		wispEndpointBubbleFadeEnabled = true;
		wispEndpointBubbleFadeOutlineBand = 0.03f;

		// Dynamic path feedback (motion + heat) that stays within the same palette.
		wispPathAnimateWithMovingTarget = true;
		wispPathMovingTargetAccentStrength = 0.22f;
		wispPathMovingTargetAccentWidth = 0.16f;
		wispPathMovingTargetAccentIndicatorBlend = 0.28f;
		wispPathHeatByAccuracy = true;
		wispPathHeatLerp = 0.14f;
		wispPathHeatLowColor = new Color(0.95f, 0.18f, 0.15f, 0.94f);
		wispPathHeatMidColor = new Color(0.86f, 0.60f, 0.19f, 0.93f);
		wispPathHeatHighColor = new Color(0.56f, 0.90f, 0.26f, 0.95f);

#if UNITY_EDITOR
		if (markEditorDirty)
		{
			UnityEditor.EditorUtility.SetDirty(this);
			if (gameObject != null && gameObject.scene.IsValid())
			{
				UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(gameObject.scene);
			}
		}
#endif
	}
}
