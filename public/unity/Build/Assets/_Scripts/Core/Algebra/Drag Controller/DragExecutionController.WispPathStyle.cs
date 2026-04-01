using System;

using UnityEngine;

using ChartLoader.NET.Framework;

public partial class DragExecutionController
{
	private WispPathStyle PickWispPathStyle()
	{
		WispPathStyle selectedStyle = wispFixedPathStyle;
		if (!wispUseVariantPaths)
		{
			return ResolveEquationAwareStyleBias(selectedStyle);
		}

		// Best default: drive the feel from the loaded .chart lane patterns (5-lane GH style).
		// This makes path variety deterministic/learnable and musically consistent, rather than purely random.
		if (wispVariantUseChartLane && ChartSystem.CachedNotes != null && ChartSystem.CachedNotes.Length > 0)
		{
			EnsureWispBeatCache();
			double targetHitTime = wispTimingPrepared ? wispExpectedDropSongTime : NowSongTime();

			Note best = null;
			double bestAbs = double.MaxValue;

			// If we scheduled from notes, just use that target beat's representative note.
			if (wispTargetBeatIndex >= 0 && wispBeatNotes != null && wispTargetBeatIndex < wispBeatNotes.Length)
			{
				best = wispBeatNotes[wispTargetBeatIndex];
				if (wispBeatTimes != null && wispTargetBeatIndex < wispBeatTimes.Length)
				{
					bestAbs = Math.Abs(wispBeatTimes[wispTargetBeatIndex] - targetHitTime);
				}
				else
				{
					bestAbs = 0d;
				}
			}
			else if (wispBeatTimes != null && wispBeatTimes.Length > 0)
			{
				// Otherwise pick nearest representative note within a small window.
				double[] times = wispBeatTimes;
				int idx = Array.BinarySearch(times, targetHitTime);
				if (idx < 0) idx = ~idx;
				int a = Mathf.Clamp(idx - 1, 0, times.Length - 1);
				int b = Mathf.Clamp(idx, 0, times.Length - 1);

				double da = Math.Abs(times[a] - targetHitTime);
				double db = Math.Abs(times[b] - targetHitTime);
				int pick = da <= db ? a : b;
				bestAbs = Math.Min(da, db);
				best = wispBeatNotes != null && pick < wispBeatNotes.Length ? wispBeatNotes[pick] : null;
			}

			if (best != null && bestAbs <= Mathf.Max(0.05f, wispVariantChartLaneSearchWindowSeconds))
			{
				int lane = -1;
				bool[] btn = best.ButtonIndexes;
				if (btn != null)
				{
					for (int i = 0; i < btn.Length; i++)
					{
						if (btn[i]) { lane = i; break; }
					}
				}

				// Fallback if ButtonIndexes isn't populated.
				if (lane < 0)
				{
					lane = Mathf.Clamp(best.HighestFret, 0, 4);
				}

				// Map 5 lanes -> "families" of curves.
				// Chords are allowed to escalate into layered silhouettes so the chart can inject
				// more visible path phrases than the standard arc/S palette.
				selectedStyle = lane switch
				{
					0 => WispPathStyle.ArcLeft,
					1 => WispPathStyle.ArcUp,
					2 => best.IsChord ? WispPathStyle.MWave : WispPathStyle.ArcUp,
					3 => WispPathStyle.ArcRight,
					4 => best.IsChord ? WispPathStyle.WWave : WispPathStyle.ArcRight,
					_ => wispFixedPathStyle
				};
				return ResolveEquationAwareStyleBias(selectedStyle);
			}
		}

		if (wispPathStylePool == null || wispPathStylePool.Length == 0)
		{
			return ResolveEquationAwareStyleBias(selectedStyle);
		}

		if (wispVariantDeterministic)
		{
			// Deterministic per-drag, based on a seed + drag counter.
			int seed = unchecked(wispVariantSeed * 397) ^ dragBeatSequenceCounter;
			System.Random rng = new System.Random(seed);
			int idx = rng.Next(0, wispPathStylePool.Length);
			selectedStyle = wispPathStylePool[Mathf.Clamp(idx, 0, wispPathStylePool.Length - 1)];
			return ResolveEquationAwareStyleBias(selectedStyle);
		}

		int r = UnityEngine.Random.Range(0, wispPathStylePool.Length);
		selectedStyle = wispPathStylePool[Mathf.Clamp(r, 0, wispPathStylePool.Length - 1)];
		return ResolveEquationAwareStyleBias(selectedStyle);
	}

	private EquationSkillTag ResolveCurrentEquationSkillTag()
	{
		if (currentEquationSkillTag != EquationSkillTag.Unknown)
		{
			return currentEquationSkillTag;
		}

		if (currentState == null)
		{
			return EquationSkillTag.Unknown;
		}

		string equation = !string.IsNullOrWhiteSpace(currentState.rawEquation)
			? currentState.rawEquation
			: FormatEquation(currentState);
		currentEquationSkillTag = EquationSkillTagUtility.InferFromEquation(equation);
		return currentEquationSkillTag;
	}

	private float ScoreSkillTagPathBias(WispPathStyle candidate, float distance, float unit, bool crossesEquals)
	{
		if (!wispUseSkillTagPathBias)
		{
			return 0f;
		}

		EquationSkillTag skillTag = ResolveCurrentEquationSkillTag();
		if (skillTag == EquationSkillTag.Unknown)
		{
			return 0f;
		}

		bool roomy = distance >= unit * 2.15f;
		bool extraRoomy = distance >= unit * 3.1f;
		float bias = Mathf.Clamp(wispSkillTagPathBiasStrength, 0f, 0.2f);
		float score = 0f;

		switch (skillTag)
		{
			case EquationSkillTag.MoveVariable:
				if (candidate == WispPathStyle.MWave)
					score -= roomy ? bias : bias * 0.3f;
				else if (candidate == WispPathStyle.WWave)
					score -= extraRoomy ? bias * 0.35f : 0f;
				break;

			case EquationSkillTag.ExpandBrackets:
			case EquationSkillTag.MixedMultiStep:
				if (candidate == WispPathStyle.WWave)
					score -= extraRoomy ? bias * 1.15f : bias * 0.55f;
				else if (candidate == WispPathStyle.MWave)
					score -= roomy ? bias * 0.45f : bias * 0.15f;
				break;

			case EquationSkillTag.Substitution:
				if (candidate == WispPathStyle.MWave)
					score -= roomy ? bias * 0.85f : bias * 0.25f;
				else if (candidate == WispPathStyle.SCurve)
					score -= bias * 0.25f;
				break;

			case EquationSkillTag.MoveConstant:
				if (candidate == WispPathStyle.MWave && roomy && !crossesEquals)
					score -= bias * 0.45f;
				break;

			case EquationSkillTag.DivideByCoefficient:
				if (candidate == WispPathStyle.MWave && extraRoomy)
					score -= bias * 0.25f;
				else if (candidate == WispPathStyle.ArcDown)
					score -= bias * 0.18f;
				break;

			case EquationSkillTag.SignFlip:
				if (candidate == WispPathStyle.MWave && roomy)
					score -= bias * 0.22f;
				else if (candidate == WispPathStyle.SCurve)
					score -= bias * 0.3f;
				break;
		}

		if (!roomy && (candidate == WispPathStyle.MWave || candidate == WispPathStyle.WWave))
		{
			score += bias * 0.9f;
		}

		if (crossesEquals && candidate == WispPathStyle.WWave)
		{
			score += bias * 0.4f;
		}

		return score;
	}

	private float ScoreEquationAwareWispStyle(
		WispPathStyle candidate,
		WispPathStyle baseStyle,
		float dx,
		float dy,
		float distance,
		bool crossesEquals,
		BubbleElementType sourceType)
	{
		float score = candidate == baseStyle ? 0f : Mathf.Clamp(wispEquationStyleOverrideStrength, 0f, 0.45f);
		float absDx = Mathf.Abs(dx);
		float absDy = Mathf.Abs(dy);
		float unit = Mathf.Max(8f, bubbleSize);

		if (crossesEquals)
		{
			score += candidate switch
			{
				WispPathStyle.ArcDown => 0f,
				WispPathStyle.SCurve => 0.03f,
				WispPathStyle.MWave => 0.08f,
				WispPathStyle.WWave => 0.12f,
				WispPathStyle.ArcLeft => 0.08f,
				WispPathStyle.ArcRight => 0.08f,
				WispPathStyle.ArcUp => 0.14f,
				WispPathStyle.Jitter => 0.2f,
				_ => 0.1f
			};
		}
		else if (absDx >= absDy * 1.25f)
		{
			if (candidate == WispPathStyle.SCurve)
			{
				score += 0.02f;
			}
			else if (candidate == WispPathStyle.MWave)
			{
				score += 0.015f;
			}
			else if (candidate == WispPathStyle.WWave)
			{
				score += 0.028f;
			}

			bool moveRight = dx >= 0f;
			if (candidate == (moveRight ? WispPathStyle.ArcRight : WispPathStyle.ArcLeft))
			{
				score += 0f;
			}
			else if (candidate == (moveRight ? WispPathStyle.ArcLeft : WispPathStyle.ArcRight))
			{
				score += 0.07f;
			}
			else if (candidate == WispPathStyle.ArcUp || candidate == WispPathStyle.ArcDown)
			{
				score += 0.05f;
			}
		}
		else
		{
			bool movingUp = dy >= 0f;
			if (candidate == (movingUp ? WispPathStyle.ArcUp : WispPathStyle.ArcDown))
			{
				score += 0f;
			}
			else if (candidate == (movingUp ? WispPathStyle.ArcDown : WispPathStyle.ArcUp))
			{
				score += 0.09f;
			}
			else
			{
				score += 0.04f;
			}

			if (candidate == WispPathStyle.SCurve)
			{
				score += 0.015f;
			}
			else if (candidate == WispPathStyle.MWave)
			{
				score += 0.02f;
			}
			else if (candidate == WispPathStyle.WWave)
			{
				score += 0.03f;
			}
		}

		if (sourceType == BubbleElementType.Variable || sourceType == BubbleElementType.Coefficient)
		{
			if (candidate == WispPathStyle.Jitter)
			{
				score += 0.18f;
			}

			if (candidate == WispPathStyle.SCurve)
			{
				score -= 0.02f;
			}
			else if (candidate == WispPathStyle.MWave)
			{
				score -= 0.03f;
			}
			else if (candidate == WispPathStyle.WWave)
			{
				score -= 0.01f;
			}
		}
		else if (sourceType == BubbleElementType.Constant && candidate == WispPathStyle.Jitter)
		{
			score += 0.08f;
		}

		if (distance > unit * 4f && candidate == WispPathStyle.SCurve)
		{
			score -= 0.025f;
		}

		if (distance < unit * 1.6f && (candidate == WispPathStyle.SCurve || candidate == WispPathStyle.Jitter || candidate == WispPathStyle.MWave || candidate == WispPathStyle.WWave))
		{
			score += 0.06f;
		}

		score += ScoreSkillTagPathBias(candidate, distance, unit, crossesEquals);

		return score;
	}

	private WispPathStyle ResolveEquationAwareStyleBias(WispPathStyle baseStyle)
	{
		if (!wispUseEquationAwareStyleBias || !TryGetActiveWispEndpoints(out Vector2 startPos, out Vector2 endPos))
		{
			return baseStyle;
		}

		Vector2 delta = endPos - startPos;
		float distance = delta.magnitude;
		if (distance <= 0.0001f)
		{
			return baseStyle;
		}

		EquationBubbleElement source = GetActiveWispSourceElement();
		BubbleElementType sourceType = source != null ? source.ElementType : BubbleElementType.Constant;
		bool crossesEquals = IsWispCrossingEquals(startPos, endPos);

		WispPathStyle bestStyle = baseStyle;
		float bestScore = float.MaxValue;
		WispPathStyle[] candidates =
		{
			WispPathStyle.ArcUp,
			WispPathStyle.ArcDown,
			WispPathStyle.ArcLeft,
			WispPathStyle.ArcRight,
			WispPathStyle.SCurve,
			WispPathStyle.Jitter,
			WispPathStyle.MWave,
			WispPathStyle.WWave,
		};

		for (int i = 0; i < candidates.Length; i++)
		{
			WispPathStyle candidate = candidates[i];
			float score = ScoreEquationAwareWispStyle(candidate, baseStyle, delta.x, delta.y, distance, crossesEquals, sourceType);
			if (score < bestScore)
			{
				bestScore = score;
				bestStyle = candidate;
			}
		}

		return bestStyle;
	}

}
