using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public partial class DragExecutionController
{
	private int contextualGuidanceMissStreak;
	private int contextualGuidanceSuccessStreak;
	private bool contextualGuidanceShownOnFirstDrag;
	private bool contextualAutoTutorialShownThisSession;
	private bool triedAutoBindContextualHelpButton;
	private HitResult contextualGuidanceLastHitResult = HitResult.None;
	private float contextualGuidanceLastSignedErrorMs = float.NaN;

	private void BindContextualGuidanceHelpButton()
	{
		TryAutoBindContextualHelpButton();
		if (contextualGuidanceHelpButton == null)
		{
			return;
		}

		contextualGuidanceHelpButton.onClick.RemoveListener(HandleContextualGuidanceHelpButtonPressed);
		contextualGuidanceHelpButton.onClick.AddListener(HandleContextualGuidanceHelpButtonPressed);
	}

	private void UnbindContextualGuidanceHelpButton()
	{
		if (contextualGuidanceHelpButton == null)
		{
			return;
		}

		contextualGuidanceHelpButton.onClick.RemoveListener(HandleContextualGuidanceHelpButtonPressed);
	}

	private void TryAutoBindContextualHelpButton()
	{
		if (!autoBindContextualGuidanceHelpButton || contextualGuidanceHelpButton != null || triedAutoBindContextualHelpButton)
		{
			return;
		}

		triedAutoBindContextualHelpButton = true;
		Transform searchRoot = parentCanvas != null ? parentCanvas.transform : transform.root;
		Transform match = FindDescendantByName(searchRoot, contextualGuidanceHelpButtonName);
		if (match == null)
		{
			return;
		}

		contextualGuidanceHelpButton = match.GetComponent<Button>();
	}

	private AlgebraTutorialGate ResolveAlgebraTutorialGateIncludingInactive()
	{
		if (IsSceneComponentAlive(algebraTutorialGate))
		{
			return algebraTutorialGate;
		}

#if UNITY_2023_1_OR_NEWER
		algebraTutorialGate = FindFirstObjectByType<AlgebraTutorialGate>(FindObjectsInactive.Include);
		return algebraTutorialGate;
#else
		AlgebraTutorialGate[] gates = Resources.FindObjectsOfTypeAll<AlgebraTutorialGate>();
		if (gates == null || gates.Length <= 0)
		{
			return null;
		}

		for (int i = 0; i < gates.Length; i++)
		{
			AlgebraTutorialGate gate = gates[i];
			if (gate == null)
			{
				continue;
			}

			if (IsSceneComponentAlive(gate))
			{
				algebraTutorialGate = gate;
				return algebraTutorialGate;
			}
		}

		algebraTutorialGate = gates[0];
		return algebraTutorialGate;
#endif
	}

	private void HandleContextualGuidanceHelpButtonPressed()
	{
		if (algebraTutorialGate == null)
		{
			algebraTutorialGate = ResolveAlgebraTutorialGateIncludingInactive();
		}

		if (algebraTutorialGate != null)
		{
			algebraTutorialGate.OpenTutorialOverlayFromExternalHowTo();
			return;
		}

		ShowContextualGuidanceHelp();
	}

	private EquationBubbleElement ResolveContextualFeedbackAnchorDropZone()
	{
		if (currentDropZone != null)
		{
			return currentDropZone;
		}

		if (journeySuggestedDropZone != null)
		{
			return journeySuggestedDropZone;
		}

		if (rightDropZone != null)
		{
			return rightDropZone;
		}

		return leftDropZone;
	}

	private static Transform FindDescendantByName(Transform root, string targetName)
	{
		if (root == null || string.IsNullOrWhiteSpace(targetName))
		{
			return null;
		}

		Stack<Transform> stack = new Stack<Transform>();
		stack.Push(root);
		while (stack.Count > 0)
		{
			Transform node = stack.Pop();
			if (node == null)
			{
				continue;
			}

			if (node.name == targetName)
			{
				return node;
			}

			for (int i = node.childCount - 1; i >= 0; i--)
			{
				stack.Push(node.GetChild(i));
			}
		}

		return null;
	}

	private void NotifyContextualGuidanceOnDragStart()
	{
		if (!contextualGuidanceEnabled || contextualGuidanceShownOnFirstDrag)
		{
			return;
		}

		contextualGuidanceShownOnFirstDrag = true;
		ShowContextualGuidanceFeedback(contextualGuidanceFirstDragMessage, new Color(0.88f, 0.94f, 1f));
		ContextualHintShown?.Invoke(contextualGuidanceFirstDragMessage);
	}

	private void RecordContextualGuidanceAttempt(HitResult hitResult, float signedErrorMs)
	{
		contextualGuidanceLastHitResult = hitResult;
		contextualGuidanceLastSignedErrorMs = signedErrorMs;
	}

	private void NotifyContextualGuidanceOnDragResolved(bool success)
	{
		if (!contextualGuidanceEnabled)
		{
			return;
		}

		if (success)
		{
			contextualGuidanceSuccessStreak++;
			contextualGuidanceMissStreak = 0;

			if (contextualGuidanceSuccessStreak >= Mathf.Max(1, contextualGuidanceSuccessStreakToHide))
			{
				// Do not hide the shared judgement chip here; this path is only meant to dismiss contextual guidance.
				HideContextualGuidanceTooltipImmediate();
			}

			return;
		}

		contextualGuidanceSuccessStreak = 0;
		contextualGuidanceMissStreak++;
		if (contextualGuidanceAutoTutorialOverlayEnabled &&
			contextualGuidanceMissStreak >= Mathf.Max(1, contextualGuidanceAutoTutorialMissThreshold) &&
			(!contextualGuidanceAutoTutorialOncePerSession || !contextualAutoTutorialShownThisSession))
		{
			if (algebraTutorialGate == null)
			{
				algebraTutorialGate = ResolveAlgebraTutorialGateIncludingInactive();
			}

			if (algebraTutorialGate != null && algebraTutorialGate.TryOpenOverlayFromContextualTrigger())
			{
				if (contextualGuidanceAutoTutorialOncePerSession)
				{
					contextualAutoTutorialShownThisSession = true;
				}

				contextualGuidanceMissStreak = 0;
				return;
			}
		}

		if (contextualGuidanceMissStreak >= Mathf.Max(1, contextualGuidanceMissThreshold))
		{
			string hintMessage = BuildContextualGuidanceMissMessage();
			ShowContextualGuidanceFeedback(
				hintMessage,
				new Color(1f, 0.92f, 0.4f),
				contextualGuidanceLastHitResult,
				contextualGuidanceLastSignedErrorMs);
			ContextualHintShown?.Invoke(hintMessage);
			contextualGuidanceMissStreak = 0;
		}
	}

	private string BuildContextualGuidanceMissMessage()
	{
		if (contextualGuidanceLastHitResult == HitResult.Miss && !float.IsNaN(contextualGuidanceLastSignedErrorMs))
		{
			if (contextualGuidanceLastSignedErrorMs < 0f)
			{
				return string.IsNullOrWhiteSpace(contextualGuidanceEarlyMissMessage)
					? contextualGuidanceMissMessage
					: contextualGuidanceEarlyMissMessage;
			}

			return string.IsNullOrWhiteSpace(contextualGuidanceLateMissMessage)
				? contextualGuidanceMissMessage
				: contextualGuidanceLateMissMessage;
		}

		return string.IsNullOrWhiteSpace(contextualGuidancePathMissMessage)
			? contextualGuidanceMissMessage
			: contextualGuidancePathMissMessage;
	}

	private void ShowContextualGuidanceFeedback(
		string message,
		Color fallbackColor,
		HitResult timingHitResult = HitResult.None,
		float signedErrorMs = float.NaN)
	{
		if (string.IsNullOrWhiteSpace(message))
		{
			return;
		}

		if (TryShowContextualGuidanceTooltip(message, fallbackColor, timingHitResult, signedErrorMs))
		{
			return;
		}

		ShowFeedback(message, fallbackColor);
	}
}
