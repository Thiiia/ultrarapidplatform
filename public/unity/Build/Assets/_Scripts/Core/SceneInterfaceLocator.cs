using UnityEngine;

public static class SceneInterfaceLocator
{
	public static MonoBehaviour FindFirstBehaviourImplementing<T>() where T : class
	{
		MonoBehaviour[] behaviours = Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Include, FindObjectsSortMode.None);
		for (int i = 0; i < behaviours.Length; i++)
		{
			MonoBehaviour behaviour = behaviours[i];
			if (behaviour is T)
				return behaviour;
		}

		return null;
	}
}
