using UnityEngine;

public partial class DragExecutionController
{
	private WispImpactDirector cachedWispImpactDirector;

	private bool TryGetCurrentWispIndicatorPose(out Vector3 worldPos, out Vector2 tangent)
	{
		worldPos = Vector3.zero;
		tangent = Vector2.right;

		Transform indicatorTransform = GetWispIndicatorTransform();
		if (indicatorTransform == null)
		{
			return false;
		}

		worldPos = indicatorTransform.position;

		if (currentWispPath != null && currentWispPath.Count >= 2)
		{
			int last = currentWispPath.Count - 1;
			int center = Mathf.Clamp(Mathf.RoundToInt(Mathf.Clamp01(wispProgress) * last), 0, last);
			int prev = Mathf.Max(0, center - 1);
			int next = Mathf.Min(last, center + 1);
			Vector2 delta = currentWispPath[next] - currentWispPath[prev];
			if (delta.sqrMagnitude > 0.0001f)
			{
				tangent = delta.normalized;
			}
		}

		return true;
	}

	private void EnsureAlgebraTargetImpactFx()
	{
		if (!algebraTargetImpactFxEnable || algebraTargetImpactFxInstance != null)
		{
			return;
		}

		if (algebraTargetImpactFxPrefab == null)
		{
			WispImpactDirector impactDirector = ResolveWispImpactDirectorIncludingInactive();
			if (impactDirector != null && impactDirector.fxPrefab != null)
			{
				algebraTargetImpactFxPrefab = impactDirector.fxPrefab;
			}
		}

		if (algebraTargetImpactFxPrefab == null)
		{
			return;
		}

		Transform parent = algebraTargetImpactFxParentOverride != null
			? algebraTargetImpactFxParentOverride
			: (wispPathContainer != null ? wispPathContainer : (equationContainer != null ? equationContainer : transform));

		algebraTargetImpactFxInstance = Instantiate(algebraTargetImpactFxPrefab, parent);
		algebraTargetImpactFxInstance.name = "AlgebraTargetImpactFx";
		algebraTargetImpactFxInstance.transform.localScale = Vector3.one * Mathf.Max(0.1f, algebraTargetImpactFxScale);
		algebraTargetImpactFxInstance.ResetToPoolState();
		algebraTargetImpactFxInstance.gameObject.SetActive(false);
	}

	private WispImpactDirector ResolveWispImpactDirectorIncludingInactive()
	{
		if (IsSceneComponentAlive(cachedWispImpactDirector))
		{
			return cachedWispImpactDirector;
		}

#if UNITY_2023_1_OR_NEWER
		cachedWispImpactDirector = FindFirstObjectByType<WispImpactDirector>(FindObjectsInactive.Include);
#else
		cachedWispImpactDirector = FindFirstObjectByType<WispImpactDirector>();
#endif
		if (cachedWispImpactDirector != null)
		{
			return cachedWispImpactDirector;
		}

		WispImpactDirector[] directors = Resources.FindObjectsOfTypeAll<WispImpactDirector>();
		for (int i = 0; i < directors.Length; i++)
		{
			WispImpactDirector director = directors[i];
			if (!IsSceneComponentAlive(director))
			{
				continue;
			}

			cachedWispImpactDirector = director;
			return cachedWispImpactDirector;
		}

		return null;
	}

	private void SetAlgebraTargetImpactFxVisible(bool visible)
	{
		if (algebraTargetImpactFxInstance == null)
		{
			return;
		}

		if (algebraTargetImpactFxInstance.gameObject.activeSelf != visible)
		{
			algebraTargetImpactFxInstance.gameObject.SetActive(visible);
		}
	}

	private void ConfigureAlgebraTargetImpactFxPoseAndColor()
	{
		if (algebraTargetImpactFxInstance == null)
		{
			return;
		}

		if (!TryGetCurrentWispIndicatorPose(out Vector3 worldPos, out Vector2 tangent))
		{
			return;
		}

		algebraTargetImpactFxInstance.transform.localScale = Vector3.one * Mathf.Max(0.1f, algebraTargetImpactFxScale);
		algebraTargetImpactFxInstance.SetPose(worldPos, tangent);
		if (algebraTargetImpactFxTintFromWispZone)
		{
			algebraTargetImpactFxInstance.SetLaneColor(GetCurrentWispTargetCueColor());
		}
	}

	private float GetAlgebraTargetImpactFxHeat01()
	{
		float streakHeat = 0f;
		try
		{
			streakHeat = Mathf.Clamp01(GetWispStreak01());
		}
		catch
		{
			streakHeat = 0f;
		}

		return Mathf.Clamp01(Mathf.Clamp01(algebraTargetImpactFxHeatBias) + (streakHeat * (1f - Mathf.Clamp01(algebraTargetImpactFxHeatBias))));
	}

	private void TryPlayAlgebraTargetImpactFxPreview(float previewCueDelaySeconds = 0f)
	{
		if (!algebraTargetImpactFxEnable || !algebraTargetImpactFxPreviewOnSpawn && !algebraTargetImpactFxPreviewOnBeat)
		{
			return;
		}

		EnsureAlgebraTargetImpactFx();
		if (algebraTargetImpactFxInstance == null)
		{
			return;
		}

		SetAlgebraTargetImpactFxVisible(true);
		ConfigureAlgebraTargetImpactFxPoseAndColor();
		algebraTargetImpactFxInstance.ShowPreview();
		if (previewCueDelaySeconds > 0f)
		{
			algebraTargetImpactFxInstance.SchedulePreviewHitCue(previewCueDelaySeconds);
		}
	}

	private void TryPlayAlgebraTargetImpactFxJudgement(HitResult result)
	{
		if (!algebraTargetImpactFxEnable || algebraTargetImpactFxInstance == null)
		{
			return;
		}

		SetAlgebraTargetImpactFxVisible(true);
		ConfigureAlgebraTargetImpactFxPoseAndColor();
		float heat = GetAlgebraTargetImpactFxHeat01();
		switch (result)
		{
			case HitResult.Perfect:
				algebraTargetImpactFxInstance.HitPerfect(heat);
				break;
			case HitResult.Good:
				algebraTargetImpactFxInstance.HitGood(heat);
				break;
			case HitResult.Miss:
				algebraTargetImpactFxInstance.Miss();
				break;
		}
	}

	private void TryEmitAlgebraTimingImpactFxOnSuccess(HitResult result)
	{
		if (!algebraTargetImpactFxEnable || !algebraTargetImpactFxUseHitBursts)
		{
			return;
		}

		if (result == HitResult.None)
		{
			result = IsLegacyTimingExpired() ? HitResult.Miss : (wispProgress >= perfectZoneStart ? HitResult.Perfect : (wispProgress >= greenZoneStart ? HitResult.Good : HitResult.Miss));
		}

		EnsureAlgebraTargetImpactFx();
		if (algebraTargetImpactFxInstance == null)
		{
			return;
		}

		SetAlgebraTargetImpactFxVisible(true);
		TryPlayAlgebraTargetImpactFxJudgement(result);
	}

	private void TryEmitAlgebraTimingImpactFxOnMiss(bool passive = false)
	{
		if (!algebraTargetImpactFxEnable || !algebraTargetImpactFxUseMissBursts)
		{
			return;
		}

		EnsureAlgebraTargetImpactFx();
		if (algebraTargetImpactFxInstance == null)
		{
			return;
		}

		SetAlgebraTargetImpactFxVisible(true);
		ConfigureAlgebraTargetImpactFxPoseAndColor();
		if (passive)
		{
			algebraTargetImpactFxInstance.MissPassive();
		}
		else
		{
			algebraTargetImpactFxInstance.Miss();
		}
	}
}
