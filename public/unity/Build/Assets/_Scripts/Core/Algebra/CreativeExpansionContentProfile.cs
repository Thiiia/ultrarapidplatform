using System;
using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "CreativeExpansionContentProfile", menuName = "ULTRARAPID/Algebra/Creative Expansion Content Profile")]
public class CreativeExpansionContentProfile : ScriptableObject
{
	[Serializable]
	public class SkillPackDefinition
	{
		public string packKey = "pack_baseline";
		public string displayName = "Baseline";
		public EquationSkillTag[] skillTags = Array.Empty<EquationSkillTag>();
		[Range(-0.25f, 0.25f)] public float intensityBias = 0f;
	}

	[Serializable]
	public class BossCueDefinition
	{
		public string cueId = "boss_default";
		public string coachMessage = "Boss phrase: hold rhythm and keep operations clean.";
		public AudioClip cueClip;
		[Range(0f, 0.25f)] public float intensityPulseBoost = 0.08f;
	}

	[SerializeField] private string defaultPackKey = "pack_baseline";
	[SerializeField] private string defaultPackDisplayName = "Baseline";
	[SerializeField] private List<SkillPackDefinition> skillPacks = new List<SkillPackDefinition>();
	[SerializeField] private List<BossCueDefinition> bossCues = new List<BossCueDefinition>();

	public string DefaultPackKey => string.IsNullOrWhiteSpace(defaultPackKey) ? "pack_baseline" : defaultPackKey;
	public string DefaultPackDisplayName => string.IsNullOrWhiteSpace(defaultPackDisplayName) ? "Baseline" : defaultPackDisplayName;

	public SkillPackDefinition ResolvePack(EquationSkillTag skillTag)
	{
		for (int i = 0; i < skillPacks.Count; i++)
		{
			SkillPackDefinition pack = skillPacks[i];
			if (pack == null || pack.skillTags == null || string.IsNullOrWhiteSpace(pack.packKey))
				continue;

			for (int j = 0; j < pack.skillTags.Length; j++)
			{
				if (pack.skillTags[j] == skillTag)
					return pack;
			}
		}

		return null;
	}

	public BossCueDefinition ResolveBossCue(int bossEncounterIndex)
	{
		if (bossCues == null || bossCues.Count == 0)
			return null;

		int safeIndex = Mathf.Abs(bossEncounterIndex) % bossCues.Count;
		return bossCues[safeIndex];
	}
}
