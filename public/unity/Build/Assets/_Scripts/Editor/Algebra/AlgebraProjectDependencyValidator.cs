#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

public static class AlgebraProjectDependencyValidator
{
	private struct RequiredPackage
	{
		public string id;
		public string minVersion;
	}

	private struct RequiredType
	{
		public string fullName;
		public bool required;
		public string hint;
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Validate Project Dependencies")]
	public static void ValidateFromMenu()
	{
		bool ok = ValidateProjectDependencies(logAll: true);
		if (ok)
			Debug.Log("[AlgebraProjectDependencyValidator] Dependency validation passed.");
		else
			Debug.LogError("[AlgebraProjectDependencyValidator] Dependency validation failed. Resolve missing packages/types before running tests.");
	}

	public static bool ValidateProjectDependencies(bool logAll)
	{
		RequiredPackage[] requiredPackages =
		{
			new RequiredPackage { id = "com.unity.ugui", minVersion = "2.0.0" },
			new RequiredPackage { id = "com.unity.inputsystem", minVersion = "1.14.2" },
			new RequiredPackage { id = "com.unity.render-pipelines.universal", minVersion = "17.2.0" },
			new RequiredPackage { id = "com.unity.services.authentication", minVersion = "3.5.2" },
			new RequiredPackage { id = "com.unity.services.core", minVersion = "1.15.1" },
			new RequiredPackage { id = "com.unity.animation.rigging", minVersion = "1.3.0" },
		};

		RequiredType[] requiredTypes =
		{
			new RequiredType { fullName = "TMPro.TextMeshProUGUI", required = true, hint = "Unity UI / TMP (com.unity.ugui)" },
			new RequiredType { fullName = "UnityEngine.InputSystem.InputAction", required = true, hint = "Input System package" },
			new RequiredType { fullName = "Unity.Services.Core.UnityServices", required = true, hint = "Unity Services Core package" },
			new RequiredType { fullName = "UnityEngine.Animations.Rigging.Rig", required = true, hint = "Animation Rigging package" },
			new RequiredType { fullName = "Shapes.Disc", required = true, hint = "Shapes plugin assembly" },
			new RequiredType { fullName = "LeTai.Asset.TranslucentImage.TranslucentImage", required = true, hint = "TranslucentImage plugin assembly" },
			new RequiredType { fullName = "Febucci.UI.TextAnimator_TMP", required = true, hint = "Febucci Text Animator TMP assembly" },
			new RequiredType { fullName = "MoreMountains.Feedbacks.MMF_Player", required = false, hint = "More Mountains Feel plugin (optional if unused in target scenes)" },
		};

		UnityEditor.PackageManager.PackageInfo[] packages = UnityEditor.PackageManager.PackageInfo.GetAllRegisteredPackages();
		Dictionary<string, UnityEditor.PackageManager.PackageInfo> packageById = new Dictionary<string, UnityEditor.PackageManager.PackageInfo>(StringComparer.Ordinal);
		for (int i = 0; i < packages.Length; i++)
		{
			UnityEditor.PackageManager.PackageInfo pkg = packages[i];
			if (pkg == null || string.IsNullOrWhiteSpace(pkg.name))
				continue;
			packageById[pkg.name] = pkg;
		}

		bool success = true;
		for (int i = 0; i < requiredPackages.Length; i++)
		{
			RequiredPackage requirement = requiredPackages[i];
			bool found = packageById.TryGetValue(requirement.id, out UnityEditor.PackageManager.PackageInfo installed);
			if (!found)
			{
				success = false;
				Debug.LogError($"[AlgebraProjectDependencyValidator] Missing package: {requirement.id} (expected >= {requirement.minVersion}).");
				continue;
			}

			if (logAll)
				Debug.Log($"[AlgebraProjectDependencyValidator] Package OK: {installed.name} {installed.version}");
		}

		for (int i = 0; i < requiredTypes.Length; i++)
		{
			RequiredType requirement = requiredTypes[i];
			bool typeFound = HasType(requirement.fullName);
			if (!typeFound)
			{
				if (requirement.required)
				{
					success = false;
					Debug.LogError($"[AlgebraProjectDependencyValidator] Missing type: {requirement.fullName} ({requirement.hint}).");
				}
				else if (logAll)
				{
					Debug.LogWarning($"[AlgebraProjectDependencyValidator] Optional type missing: {requirement.fullName} ({requirement.hint}).");
				}
				continue;
			}

			if (logAll)
				Debug.Log($"[AlgebraProjectDependencyValidator] Type OK: {requirement.fullName}");
		}

		if (!success)
		{
			Debug.LogError(
				"[AlgebraProjectDependencyValidator] Compile preflight failed. " +
				"Open Package Manager, restore missing dependencies, then re-open the project to trigger a clean recompile.");
		}

		return success;
	}

	private static bool HasType(string fullName)
	{
		if (string.IsNullOrWhiteSpace(fullName))
			return false;

		System.Reflection.Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
		for (int i = 0; i < assemblies.Length; i++)
		{
			System.Reflection.Assembly assembly = assemblies[i];
			if (assembly == null)
				continue;

			Type type = assembly.GetType(fullName, throwOnError: false, ignoreCase: false);
			if (type != null)
				return true;
		}

		return false;
	}
}
#endif
