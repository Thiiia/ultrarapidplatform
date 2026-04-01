#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

public static class AlgebraPhaseAssetSetupUtility
{
	private const string ResourcesFolderPath = "Assets/Resources";
	private const string FeatureFlagsAssetPath = "Assets/Resources/AlgebraFeatureFlags.asset";
	private const string RhythmProfileAssetPath = "Assets/Resources/RhythmClarityTuningProfile.asset";
	private const string CreativeProfileAssetPath = "Assets/Resources/CreativeExpansionContentProfile.asset";

	[MenuItem("Tools/ULTRARAPID/Algebra/Setup Required Phase Assets (Flags + Tuning + Creative)")]
	public static void SetupRequiredPhaseAssets()
	{
		EnsureResourcesFolder();

		bool createdFlags;
		AlgebraFeatureFlags flags = LoadOrCreateAsset<AlgebraFeatureFlags>(FeatureFlagsAssetPath, out createdFlags);
		if (flags == null)
		{
			Debug.LogError("[AlgebraPhaseAssetSetupUtility] Could not create/load AlgebraFeatureFlags asset.");
			return;
		}

		bool createdRhythm;
		RhythmClarityTuningProfile rhythm = LoadOrCreateAsset<RhythmClarityTuningProfile>(RhythmProfileAssetPath, out createdRhythm);
		if (rhythm == null)
		{
			Debug.LogError("[AlgebraPhaseAssetSetupUtility] Could not create/load RhythmClarityTuningProfile asset.");
			return;
		}

		bool createdCreative;
		CreativeExpansionContentProfile creative = LoadOrCreateAsset<CreativeExpansionContentProfile>(CreativeProfileAssetPath, out createdCreative);
		if (creative == null)
		{
			Debug.LogError("[AlgebraPhaseAssetSetupUtility] Could not create/load CreativeExpansionContentProfile asset.");
			return;
		}

		if (createdFlags)
			InitializeDefaultFeatureFlags(flags);
		if (createdRhythm)
			InitializeDefaultRhythmProfile(rhythm);
		if (createdCreative)
			InitializeDefaultCreativeProfile(creative);

		EditorUtility.SetDirty(flags);
		EditorUtility.SetDirty(rhythm);
		EditorUtility.SetDirty(creative);
		AssetDatabase.SaveAssets();
		AssetDatabase.Refresh();

		Debug.Log(
			"[AlgebraPhaseAssetSetupUtility] Setup complete:\n" +
			$"- {FeatureFlagsAssetPath} {(createdFlags ? "(created)" : "(existing)")}\n" +
			$"- {RhythmProfileAssetPath} {(createdRhythm ? "(created)" : "(existing)")}\n" +
			$"- {CreativeProfileAssetPath} {(createdCreative ? "(created)" : "(existing)")}\n" +
			"Use 'Enable All Phase Flags (Dev)' when you want full phase behavior active for playtests.");
	}

	[MenuItem("Tools/ULTRARAPID/Algebra/Enable All Phase Flags (Dev)")]
	public static void EnableAllPhaseFlagsForDev()
	{
		EnsureResourcesFolder();
		bool created;
		AlgebraFeatureFlags flags = LoadOrCreateAsset<AlgebraFeatureFlags>(FeatureFlagsAssetPath, out created);
		if (flags == null)
		{
			Debug.LogError("[AlgebraPhaseAssetSetupUtility] Could not create/load AlgebraFeatureFlags asset.");
			return;
		}

		SerializedObject serialized = new SerializedObject(flags);
		SetBool(serialized, "enableSessionMetrics", true);
		SetBool(serialized, "enableAdaptiveDifficulty", true);
		SetBool(serialized, "enableMasteryProgression", true);
		SetBool(serialized, "enableRhythmClarityTuning", true);
		SetBool(serialized, "enableCreativeExpansionTrack", true);
		SetBool(serialized, "enableBpmJudgementClamp", false);
		serialized.ApplyModifiedPropertiesWithoutUndo();

		EditorUtility.SetDirty(flags);
		AssetDatabase.SaveAssets();
		AssetDatabase.Refresh();

		Debug.Log("[AlgebraPhaseAssetSetupUtility] Enabled all phase flags for dev testing in Assets/Resources/AlgebraFeatureFlags.asset.");
	}

	private static void EnsureResourcesFolder()
	{
		if (!AssetDatabase.IsValidFolder("Assets/Resources"))
			AssetDatabase.CreateFolder("Assets", "Resources");
	}

	private static T LoadOrCreateAsset<T>(string assetPath, out bool created) where T : ScriptableObject
	{
		created = false;
		T asset = AssetDatabase.LoadAssetAtPath<T>(assetPath);
		if (asset != null)
			return asset;

		T instance = ScriptableObject.CreateInstance<T>();
		if (instance == null)
			return null;

		string dir = Path.GetDirectoryName(assetPath);
		if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
			Directory.CreateDirectory(dir);

		AssetDatabase.CreateAsset(instance, assetPath);
		created = true;
		return instance;
	}

	private static void InitializeDefaultFeatureFlags(AlgebraFeatureFlags flags)
	{
		SerializedObject serialized = new SerializedObject(flags);
		SetBool(serialized, "enableSessionMetrics", false);
		SetBool(serialized, "enableAdaptiveDifficulty", false);
		SetBool(serialized, "enableMasteryProgression", false);
		SetBool(serialized, "enableRhythmClarityTuning", false);
		SetBool(serialized, "enableCreativeExpansionTrack", false);
		SetBool(serialized, "enableBpmJudgementClamp", false);
		serialized.ApplyModifiedPropertiesWithoutUndo();
	}

	private static void InitializeDefaultRhythmProfile(RhythmClarityTuningProfile profile)
	{
		SerializedObject serialized = new SerializedObject(profile);

		SetInt(serialized, "repeatedMissWindow", 6);
		SetInt(serialized, "repeatedMissThreshold", 2);
		SetInt(serialized, "hintEscalationLevel2Threshold", 3);
		SetInt(serialized, "hintEscalationLevel3Threshold", 4);
		SetFloat(serialized, "hintHoldSeconds", 1.8f);
		SetFloat(serialized, "calmModeHoldSeconds", 2f);
		SetBool(serialized, "enableCalmMode", true);
		SetInt(serialized, "calmModeConsecutiveMissThreshold", 3);
		SetInt(serialized, "calmModeRecoverySuccessThreshold", 3);
		SetString(serialized, "calmModeInstruction", "Focus mode: track the path and release in the green zone");
		serialized.ApplyModifiedPropertiesWithoutUndo();
	}

	private static void InitializeDefaultCreativeProfile(CreativeExpansionContentProfile profile)
	{
		SerializedObject serialized = new SerializedObject(profile);
		SetString(serialized, "defaultPackKey", "pack_baseline");
		SetString(serialized, "defaultPackDisplayName", "Baseline");

		SerializedProperty skillPacks = serialized.FindProperty("skillPacks");
		if (skillPacks != null)
		{
			skillPacks.arraySize = 7;
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(0), "pack_move_constant", "Move Constants", EquationSkillTag.MoveConstant, 0.00f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(1), "pack_move_variable", "Move Variables", EquationSkillTag.MoveVariable, 0.02f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(2), "pack_divide", "Divide Coefficients", EquationSkillTag.DivideByCoefficient, 0.04f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(3), "pack_expand", "Expand Brackets", EquationSkillTag.ExpandBrackets, 0.06f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(4), "pack_substitute", "Substitution", EquationSkillTag.Substitution, 0.08f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(5), "pack_sign_flip", "Sign Flip", EquationSkillTag.SignFlip, 0.05f);
			ConfigureSkillPack(skillPacks.GetArrayElementAtIndex(6), "pack_mixed", "Mixed Multi-Step", EquationSkillTag.MixedMultiStep, 0.10f);
		}

		SerializedProperty bossCues = serialized.FindProperty("bossCues");
		if (bossCues != null)
		{
			bossCues.arraySize = 3;
			ConfigureBossCue(bossCues.GetArrayElementAtIndex(0), "boss_bridge", "Boss phrase: stay centered and prioritize legal moves.", 0.08f);
			ConfigureBossCue(bossCues.GetArrayElementAtIndex(1), "boss_breakdown", "Boss phrase: recover timing first, then commit the operation.", 0.10f);
			ConfigureBossCue(bossCues.GetArrayElementAtIndex(2), "boss_finale", "Boss phrase: chain clean hits and finish the solve under pressure.", 0.12f);
		}

		serialized.ApplyModifiedPropertiesWithoutUndo();
	}

	private static void ConfigureSkillPack(SerializedProperty packElement, string key, string displayName, EquationSkillTag skillTag, float intensityBias)
	{
		if (packElement == null)
			return;

		SetString(packElement.FindPropertyRelative("packKey"), key);
		SetString(packElement.FindPropertyRelative("displayName"), displayName);
		SetFloat(packElement.FindPropertyRelative("intensityBias"), intensityBias);

		SerializedProperty skills = packElement.FindPropertyRelative("skillTags");
		if (skills == null)
			return;

		skills.arraySize = 1;
		SerializedProperty skill = skills.GetArrayElementAtIndex(0);
		if (skill != null)
			skill.enumValueIndex = (int)skillTag;
	}

	private static void ConfigureBossCue(SerializedProperty cueElement, string cueId, string coachMessage, float pulseBoost)
	{
		if (cueElement == null)
			return;

		SetString(cueElement.FindPropertyRelative("cueId"), cueId);
		SetString(cueElement.FindPropertyRelative("coachMessage"), coachMessage);
		SetFloat(cueElement.FindPropertyRelative("intensityPulseBoost"), pulseBoost);

		SerializedProperty clip = cueElement.FindPropertyRelative("cueClip");
		if (clip != null)
			clip.objectReferenceValue = null;
	}

	private static void SetBool(SerializedObject serialized, string propertyName, bool value)
	{
		SerializedProperty property = serialized.FindProperty(propertyName);
		if (property != null)
			property.boolValue = value;
	}

	private static void SetInt(SerializedObject serialized, string propertyName, int value)
	{
		SerializedProperty property = serialized.FindProperty(propertyName);
		if (property != null)
			property.intValue = value;
	}

	private static void SetFloat(SerializedObject serialized, string propertyName, float value)
	{
		SerializedProperty property = serialized.FindProperty(propertyName);
		if (property != null)
			property.floatValue = value;
	}

	private static void SetString(SerializedObject serialized, string propertyName, string value)
	{
		SerializedProperty property = serialized.FindProperty(propertyName);
		if (property != null)
			property.stringValue = value;
	}

	private static void SetString(SerializedProperty property, string value)
	{
		if (property != null)
			property.stringValue = value;
	}

	private static void SetFloat(SerializedProperty property, float value)
	{
		if (property != null)
			property.floatValue = value;
	}
}
#endif
