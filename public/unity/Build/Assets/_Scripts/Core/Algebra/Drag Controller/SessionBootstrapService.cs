using UnityEngine;

internal interface ISessionBootstrapHost
{
	EquationChoiceSystem ChoiceSystem { get; }
	EquationState CurrentState { get; set; }
	int CurrentStepDragCount { get; set; }
	int DragsPerStep { get; set; }
	EquationState StepStartState { get; set; }
	bool IsBubbleInitialized { get; set; }
	bool IsActive { get; set; }

	void ResolveChoiceSystem();
	void StopWispAnimation();
	void ClearWispPathVisuals();
	void StopOperatorFollowing(bool dropAccepted);
	void ClearBubbleElements();
	void ResetLockedInEquationPinnedText();
	void ResetProgress();
	void RecomputeStepProgressTargets(EquationState state);
	void StartIntroAnimation();
}

internal static class SessionBootstrapService
{
	internal static bool TryCreateStateFromEquation(string equation, out EquationState state)
	{
		state = null;
		if (!LinearEquationParser.TryParse(equation, false, false, false, out LinearEquationParser.ParsedEquation parsed))
		{
			return false;
		}

		state = new EquationState(
			parsed.leftVarCoef,
			parsed.leftConst,
			parsed.rightVarCoef,
			parsed.rightConst,
			parsed.hasBrackets,
			equation
		);
		return true;
	}

	internal static void PrepareForExternalStateInitialization(ISessionBootstrapHost host)
	{
		host.StopWispAnimation();
		host.ClearWispPathVisuals();
		host.StopOperatorFollowing(false);
		host.ClearBubbleElements();
		host.ResetLockedInEquationPinnedText();
	}

	internal static void BeginSession(ISessionBootstrapHost host, bool initializeChoiceSystem, string debugMessage = null)
	{
		if (initializeChoiceSystem)
		{
			host.ResolveChoiceSystem();
			if (host.ChoiceSystem != null)
			{
				host.ChoiceSystem.Initialize(host.CurrentState);
			}
		}

		host.CurrentStepDragCount = 0;
		host.StepStartState = host.CurrentState.Clone();
		host.DragsPerStep = Mathf.Max(1, host.DragsPerStep);
		host.ResetProgress();
		host.RecomputeStepProgressTargets(host.CurrentState);
		host.IsBubbleInitialized = true;
		host.IsActive = true;
		host.StartIntroAnimation();

		if (!string.IsNullOrEmpty(debugMessage))
		{
			Debug.Log(debugMessage);
		}
	}
}
