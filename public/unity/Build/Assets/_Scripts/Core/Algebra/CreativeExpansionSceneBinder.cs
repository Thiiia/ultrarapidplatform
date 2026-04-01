using System;
using System.Collections.Generic;
using UnityEngine;

public class CreativeExpansionSceneBinder : MonoBehaviour
{
	[Serializable]
	private class SequencePackBinding
	{
		public string packKey = "pack_baseline";
		public List<GameObject> activateWhenSelected = new List<GameObject>();
		public List<GameObject> deactivateWhenSelected = new List<GameObject>();
	}

	[Header("Wiring")]
	[SerializeField] private CreativeExpansionTrackController expansionController;
	[SerializeField] private MonoBehaviour hintSinkBehaviour;

	private IAlgebraHintSink hintSink;

	[Header("Pack Visual Bindings")]
	[SerializeField] private bool deactivateUnmatchedBindings = true;
	[SerializeField] private List<SequencePackBinding> sequencePackBindings = new List<SequencePackBinding>();

	[Header("Boss Cue Coaching")]
	[SerializeField] private bool showBossCoachCue = true;
	[SerializeField] private Color bossCueColor = new Color(1f, 0.85f, 0.35f, 1f);
	[SerializeField, Min(0.2f)] private float bossCueHoldSeconds = 2.2f;

	private void Awake()
	{
		if (expansionController == null)
			expansionController = FindFirstObjectByType<CreativeExpansionTrackController>();
		ResolveHintSink();
	}

	private void OnEnable()
	{
		if (expansionController == null)
			return;

		expansionController.SequencePackActivated += HandleSequencePackActivated;
		expansionController.BossCueResolved += HandleBossCueResolved;
		if (!string.IsNullOrWhiteSpace(expansionController.ActiveSequencePackKey))
			HandleSequencePackActivated(expansionController.ActiveSequencePackKey);
	}

	private void OnDisable()
	{
		if (expansionController == null)
			return;

		expansionController.SequencePackActivated -= HandleSequencePackActivated;
		expansionController.BossCueResolved -= HandleBossCueResolved;
	}

	private void HandleSequencePackActivated(string packKey)
	{
		if (string.IsNullOrWhiteSpace(packKey))
			return;

		for (int i = 0; i < sequencePackBindings.Count; i++)
		{
			SequencePackBinding binding = sequencePackBindings[i];
			if (binding == null)
				continue;

			bool isActive = string.Equals(binding.packKey, packKey, StringComparison.Ordinal);
			ApplyBinding(binding.activateWhenSelected, isActive);
			ApplyBinding(binding.deactivateWhenSelected, !isActive);

			if (!isActive && deactivateUnmatchedBindings)
				ApplyBinding(binding.activateWhenSelected, false);
		}
	}

	private void HandleBossCueResolved(CreativeExpansionContentProfile.BossCueDefinition cue)
	{
		if (!showBossCoachCue || hintSink == null || cue == null)
			return;
		if (string.IsNullOrWhiteSpace(cue.coachMessage))
			return;

		hintSink.ShowCoachingHint(cue.coachMessage, bossCueColor, Mathf.Max(0.2f, bossCueHoldSeconds));
	}

	private void ResolveHintSink()
	{
		if (hintSinkBehaviour == null)
			hintSinkBehaviour = SceneInterfaceLocator.FindFirstBehaviourImplementing<IAlgebraHintSink>();

		hintSink = hintSinkBehaviour as IAlgebraHintSink;
		if (hintSink == null && hintSinkBehaviour != null)
			hintSinkBehaviour = null;
	}

	private static void ApplyBinding(List<GameObject> targets, bool isActive)
	{
		if (targets == null)
			return;

		for (int i = 0; i < targets.Count; i++)
		{
			GameObject target = targets[i];
			if (target == null)
				continue;
			if (target.activeSelf == isActive)
				continue;
			target.SetActive(isActive);
		}
	}
}
