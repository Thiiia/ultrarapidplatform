using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

public interface IHitZoneNotesGameplayMessage : IEventSystemHandler
{
	public void OnNotesHitting(Transform note, string inputColor);
}

public interface IChartLoaderGameplayMessage : IEventSystemHandler
{
	public void OnNotesSpawning(float xPosition, int index);
	public void IncrementTimelineNoteXPositon();
}

public interface IScoreManagerGameplayMessage : IEventSystemHandler
{
	public void TriggerStreakBrokenTextPulse();
}

public interface INoteblockGameplayMessage : IEventSystemHandler
{
	public void HandleInteractions(bool isActive, GameObject noteBlock, int laneIndex, List<Transform> activeNotes);
}

public interface IInterationHandlerGameplayMessage : IEventSystemHandler
{
	public void PlayLaneRipple(int laneIndex, string type);
	public void HandleLaneAnimations
	(
		Transform bestMatch, string hitType, int laneIndex, NoteVisualDriver bestDriver, GameObject noteBlock, string inputColor, float targetX, float targetZ
	);
	public void TriggerLaneGlow(GameObject noteBlock);
	public void ResetLaneGlow(GameObject noteBlock);
}