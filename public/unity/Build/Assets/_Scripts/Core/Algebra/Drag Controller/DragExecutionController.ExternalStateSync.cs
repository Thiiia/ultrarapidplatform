using UnityEngine;

public partial class DragExecutionController
{
	private DragExecutionExternalStateSynchronizer externalStateSynchronizer;

	private DragExecutionExternalStateSynchronizer ExternalStateSynchronizer
	{
		get
		{
			if (externalStateSynchronizer == null)
			{
				externalStateSynchronizer = new DragExecutionExternalStateSynchronizer(this);
			}

			return externalStateSynchronizer;
		}
	}

	private EquationChoiceSystem ResolveChoiceSystem()
	{
		return ExternalStateSynchronizer.ResolveChoiceSystem();
	}

	private void BindExternalStateSync()
	{
		ExternalStateSynchronizer.BindChoiceSystem();
	}

	private void UnbindExternalStateSync()
	{
		if (externalStateSynchronizer != null)
		{
			externalStateSynchronizer.UnbindChoiceSystem();
		}
	}

	private void HandleChoiceSystemStateChanged(EquationState state)
	{
		ExternalStateSynchronizer.HandleChoiceSystemStateChanged(state);
	}

	private void InitializeFromExternalState(EquationState state)
	{
		ExternalStateSynchronizer.InitializeFromExternalState(state);
	}

	// Keeps external equation-state wiring isolated from drag rules and presentation logic.
	private sealed class DragExecutionExternalStateSynchronizer
	{
		private readonly DragExecutionController controller;

		public DragExecutionExternalStateSynchronizer(DragExecutionController controller)
		{
			this.controller = controller;
		}

		public EquationChoiceSystem ResolveChoiceSystem()
		{
			if (controller.choiceSystem == null)
			{
				controller.choiceSystem = FindFirstObjectByType<EquationChoiceSystem>();
			}

			return controller.choiceSystem;
		}

		public void BindChoiceSystem()
		{
			if (!controller.syncFromChoiceSystem)
			{
				return;
			}

			EquationChoiceSystem resolvedChoiceSystem = ResolveChoiceSystem();
			if (resolvedChoiceSystem != null)
			{
				resolvedChoiceSystem.OnStateChanged += controller.HandleChoiceSystemStateChanged;
			}
		}

		public void UnbindChoiceSystem()
		{
			if (controller.choiceSystem != null)
			{
				controller.choiceSystem.OnStateChanged -= controller.HandleChoiceSystemStateChanged;
			}
		}

		public void HandleChoiceSystemStateChanged(EquationState state)
		{
			if (!ShouldAcceptExternalState(state))
			{
				return;
			}

			InitializeFromExternalState(state);
		}

		public void InitializeFromExternalState(EquationState state)
		{
			if (state == null || controller.TutorialLock)
			{
				return;
			}

			SessionBootstrapService.PrepareForExternalStateInitialization((ISessionBootstrapHost)controller);

			controller.currentState = state.Clone();

			string equation = controller.FormatEquation(controller.currentState);
			controller.CreateBubbleElements(equation);

			SessionBootstrapService.BeginSession((ISessionBootstrapHost)controller, initializeChoiceSystem: false);
		}

		private bool ShouldAcceptExternalState(EquationState state)
		{
			if (!controller.syncFromChoiceSystem)
			{
				return false;
			}

			// Block ALL external initialization while the tutorial controls this controller.
			if (controller.TutorialLock)
			{
				return false;
			}

			// The tutorial owns explicit initialization via InitializeWithEquation.
			if (EquationTutorialController.ShouldBlockGameplayForTutorial())
			{
				return false;
			}

			if (state == null)
			{
				return false;
			}

			// Ignore self-changes where the incoming state already matches what's on-screen.
			if (controller.currentState != null &&
			    controller.isBubbleInitialized &&
			    DragExecutionController.AreStatesEquivalent(controller.currentState, state))
			{
				return false;
			}

			return true;
		}
	}
}
