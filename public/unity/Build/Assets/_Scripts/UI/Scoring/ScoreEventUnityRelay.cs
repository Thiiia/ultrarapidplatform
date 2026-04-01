using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// UnityEvent bridge so designers can respond to score judgements without scripting.
/// </summary>
public class ScoreEventUnityRelay : MonoBehaviour
{
	[System.Serializable]
	public class HitJudgedUnityEvent : UnityEvent<RhythmHitKind, int> { }

	[SerializeField] private HitJudgedUnityEvent onHitJudged = new HitJudgedUnityEvent();

	private void OnEnable() => GameplayEventBus.HitJudged += HandleHit;
	private void OnDisable() => GameplayEventBus.HitJudged -= HandleHit;

	private void HandleHit(RhythmHitKind hit, int streak) => onHitJudged.Invoke(hit, streak);
}
