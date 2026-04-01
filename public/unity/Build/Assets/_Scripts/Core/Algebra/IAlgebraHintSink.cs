using UnityEngine;

public interface IAlgebraHintSink
{
	void ShowCoachingHint(string message, Color color, float holdSeconds = -1f);
	void SetClarityFocus(bool enabled, string instruction = null);
}
