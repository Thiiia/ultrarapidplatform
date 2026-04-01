using UnityEngine;

[CreateAssetMenu(menuName = "Rhythm/Beat Profile", fileName = "BeatProfile")]
public class BeatProfile : ScriptableObject
{
	[Header("Lead-in Timing")]
	[Tooltip("If true, lead time is expressed in beats; otherwise fallback to seconds.")]
	public bool leadInBeats = true;

	[Tooltip("Lead amount in beats when leadInBeats is true.")]
	[Range(0.05f, 8f)]
	public float leadBeats = 1f;

	[Tooltip("Lead time in seconds when beat data is unavailable or leadInBeats is false.")]
	[Range(0.05f, 5f)]
	public float fallbackLeadSeconds = 1f;

	[Header("Visual Curves")]
	[Tooltip("Curve describing how approach radius interpolates (0 = spawn, 1 = impact).")]
	public AnimationCurve radiusCurve = AnimationCurve.EaseInOut(0, 1f, 1f, 0f);

	[Tooltip("Curve describing how approach alpha interpolates (0 = spawn, 1 = impact).")]
	public AnimationCurve alphaCurve = AnimationCurve.EaseInOut(0, 0.95f, 1f, 0f);
}
