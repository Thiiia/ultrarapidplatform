using UnityEngine;
using UnityEngine.SceneManagement;

public static class AlgebraResultsRuntimeBootstrap
{
	private const string TargetSceneName = "AlgebraEquations SK Tag";
	private static bool sceneHookRegistered;

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
	private static void ResetStatics()
	{
		sceneHookRegistered = false;
	}

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
	private static void RegisterSceneHook()
	{
		if (sceneHookRegistered)
			return;

		SceneManager.sceneLoaded += HandleSceneLoaded;
		sceneHookRegistered = true;
	}

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
	private static void HandleInitialScene()
	{
		TryInstall(SceneManager.GetActiveScene());
	}

	private static void HandleSceneLoaded(Scene scene, LoadSceneMode mode)
	{
		TryInstall(scene);
	}

	private static void TryInstall(Scene scene)
	{
		if (!scene.IsValid() || !string.Equals(scene.name, TargetSceneName, System.StringComparison.Ordinal))
			return;

#if UNITY_2023_1_OR_NEWER
		DragExecutionController drag = Object.FindFirstObjectByType<DragExecutionController>(FindObjectsInactive.Include);
#else
		DragExecutionController drag = Object.FindFirstObjectByType<DragExecutionController>();
#endif
		if (drag == null)
			return;

		AlgebraResultsSessionTracker tracker = drag.GetComponent<AlgebraResultsSessionTracker>();
		if (tracker == null)
			tracker = drag.gameObject.AddComponent<AlgebraResultsSessionTracker>();
		tracker.Initialize(drag);
		tracker.ResetSession();

		Canvas canvas = drag.ParentCanvas;
		if (canvas == null)
			canvas = drag.GetComponentInParent<Canvas>();
		if (canvas == null)
			return;

		AlgebraResultsOverlayController overlay = canvas.GetComponentInChildren<AlgebraResultsOverlayController>(true);
		if (overlay == null)
		{
			GameObject overlayPrefab = Resources.Load<GameObject>(AlgebraResultsOverlayController.ResultsScreenPrefabResourcePath);
			if (overlayPrefab != null)
			{
				GameObject instance = Object.Instantiate(overlayPrefab, canvas.transform, false);
				instance.name = overlayPrefab.name;
				instance.transform.SetAsLastSibling();
				overlay = instance.GetComponent<AlgebraResultsOverlayController>();
			}
		}

		if (overlay == null)
			overlay = canvas.gameObject.AddComponent<AlgebraResultsOverlayController>();

		overlay.Initialize(drag, tracker, canvas);
	}
}
