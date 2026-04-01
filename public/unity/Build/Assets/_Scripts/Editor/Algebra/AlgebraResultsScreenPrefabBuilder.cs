#if UNITY_EDITOR
using System.IO;

using UnityEditor;

using UnityEngine;

public static class AlgebraResultsScreenPrefabBuilder
{
	private const string ResourcesRoot = "Assets/Resources";
	private const string PrefabsFolder = "Assets/Resources/Prefabs";
	private const string UiFolder = "Assets/Resources/Prefabs/UI";
	private const string PrefabPath = "Assets/Resources/Prefabs/UI/Results Screen.prefab";

	[InitializeOnLoadMethod]
	private static void BuildPrefabIfMissingOnLoad()
	{
		EditorApplication.delayCall += TryBuildMissingPrefab;
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Build Results Screen Prefab")]
	public static void BuildPrefab()
	{
		BuildPrefabInternal(focusAsset: true);
	}

	private static void BuildPrefabInternal(bool focusAsset)
	{
		EnsureFolders();

		GameObject root = new GameObject("Results Screen", typeof(RectTransform), typeof(CanvasGroup), typeof(AlgebraResultsOverlayController));
		try
		{
			AlgebraResultsOverlayController controller = root.GetComponent<AlgebraResultsOverlayController>();
			controller.RebuildPrefabLayoutForEditor();

			GameObject prefab = PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
			AssetDatabase.SaveAssets();
			AssetDatabase.Refresh();

			if (prefab != null && focusAsset)
			{
				Selection.activeObject = prefab;
				EditorGUIUtility.PingObject(prefab);
			}

			if (prefab != null)
				Debug.Log($"[AlgebraResultsScreenPrefabBuilder] Built prefab at {PrefabPath}");
		}
		finally
		{
			Object.DestroyImmediate(root);
		}
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Instantiate Results Screen Preview In Scene")]
	public static void InstantiatePreviewInScene()
	{
		Canvas targetCanvas = Selection.activeTransform != null
			? Selection.activeTransform.GetComponentInParent<Canvas>()
			: null;

		BuildPrefab();

		GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
		if (prefab == null)
			return;

		GameObject instance = PrefabUtility.InstantiatePrefab(prefab) as GameObject;
		if (instance == null)
			instance = Object.Instantiate(prefab);

		if (targetCanvas != null)
			instance.transform.SetParent(targetCanvas.transform, false);

		Selection.activeObject = instance;
		EditorGUIUtility.PingObject(instance);
	}

	private static void EnsureFolders()
	{
		if (!AssetDatabase.IsValidFolder(ResourcesRoot))
			AssetDatabase.CreateFolder("Assets", "Resources");
		if (!AssetDatabase.IsValidFolder(PrefabsFolder))
			AssetDatabase.CreateFolder(ResourcesRoot, "Prefabs");
		if (!AssetDatabase.IsValidFolder(UiFolder))
			AssetDatabase.CreateFolder(PrefabsFolder, "UI");

		string directory = Path.GetDirectoryName(PrefabPath);
		if (!string.IsNullOrWhiteSpace(directory) && !Directory.Exists(directory))
			Directory.CreateDirectory(directory);
	}

	private static void TryBuildMissingPrefab()
	{
		if (EditorApplication.isCompiling || EditorApplication.isUpdating)
			return;

		if (AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath) != null)
			return;

		BuildPrefabInternal(focusAsset: false);
	}
}
#endif
