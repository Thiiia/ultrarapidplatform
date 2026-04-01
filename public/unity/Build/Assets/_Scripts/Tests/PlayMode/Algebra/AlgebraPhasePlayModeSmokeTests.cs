using System.Collections;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

public class AlgebraPhasePlayModeSmokeTests
{
	private const string SkTagSceneName = "AlgebraEquations SK Tag";

	[TearDown]
	public void TearDown()
	{
		DestroyAllAdapters();
		DestroyAllOfType<DragExecutionController>();
	}

	[Test]
	public void TouchHudAdapter_AutoInstallRequiresDragController()
	{
		MethodInfo installIfNeeded = typeof(AlgebraTouchHudAdapter).GetMethod(
			"InstallIfNeeded",
			BindingFlags.Static | BindingFlags.NonPublic);

		Assert.IsNotNull(installIfNeeded, "Expected private InstallIfNeeded to exist.");

		installIfNeeded.Invoke(null, null);
		Assert.IsNull(FindAdapter(), "Adapter should not install without a drag controller.");

		GameObject host = new GameObject("TouchHudAdapterSmokeHost");
		host.AddComponent<DragExecutionController>();

		installIfNeeded.Invoke(null, null);
		Assert.IsNotNull(FindAdapter(), "Adapter should install when a drag controller exists.");
	}

	[Test]
	public void TutorialLock_BlocksExternalInitializationPath()
	{
		GameObject host = new GameObject("TutorialLockSmokeHost");
		DragExecutionController dragController = host.AddComponent<DragExecutionController>();
		dragController.TutorialLock = true;

		EquationState externalState = new EquationState(1, 2, 0, 7);
		MethodInfo initializeFromExternalState = typeof(DragExecutionController).GetMethod(
			"InitializeFromExternalState",
			BindingFlags.Instance | BindingFlags.NonPublic);

		Assert.IsNotNull(initializeFromExternalState, "Expected private InitializeFromExternalState to exist.");
		initializeFromExternalState.Invoke(dragController, new object[] { externalState });

		Assert.IsNull(dragController.CurrentState, "CurrentState should stay null while TutorialLock is enabled.");
		Assert.IsFalse(dragController.IsActive, "Drag controller should stay inactive while TutorialLock is enabled.");
	}

	[UnityTest]
	public IEnumerator SkTagScene_Loads_WithExpectedAlgebraWiring()
	{
		PlayerPrefs.SetInt("TutorialCompleted", 1);
		PlayerPrefs.SetInt("AlgebraTutorialCompleted", 1);
		PlayerPrefs.Save();

		SceneManager.LoadScene(SkTagSceneName, LoadSceneMode.Single);
		yield return null;
		yield return null;

		LinearEquationSolver solver = Object.FindFirstObjectByType<LinearEquationSolver>();
		DragExecutionController dragController = Object.FindFirstObjectByType<DragExecutionController>();
		EquationChoiceSystem choiceSystem = Object.FindFirstObjectByType<EquationChoiceSystem>();

		Assert.IsNotNull(solver, "SK Tag scene should contain a LinearEquationSolver.");
		Assert.IsNotNull(dragController, "SK Tag scene should contain a DragExecutionController.");
		Assert.IsNotNull(choiceSystem, "SK Tag scene should contain an EquationChoiceSystem.");

		Assert.AreEqual(LinearEquationSolver.InputMode.BubbleDrag, solver.CurrentInputMode, "SK Tag should start in BubbleDrag mode.");
		Assert.IsTrue(solver.UsesEndlessCheckpointMode, "SK Tag should use endless checkpoint mode.");
		Assert.AreSame(dragController, solver.GetDragController(), "Solver should point at the scene DragExecutionController.");

		Assert.AreEqual(EquationDataSet.SchoolYear.Year6, GetPrivateField<EquationDataSet.SchoolYear>(solver, "selectedDifficulty"),
			"SK Tag should start at Year6.");
		Assert.IsNotNull(GetPrivateField<object>(solver, "equationDataSet"), "Solver should have an equation data set.");
		Assert.IsNotNull(choiceSystem.CurrentState, "Choice system should be initialized after scene load.");
		Assert.IsNotNull(dragController.CurrentState, "Drag controller should be initialized after scene load.");
		Assert.IsTrue(dragController.IsActive, "Drag controller should be active after scene bootstrap.");
	}

	private static void DestroyAllOfType<T>() where T : Component
	{
		T[] found = Object.FindObjectsByType<T>(FindObjectsSortMode.None);
		for (int i = 0; i < found.Length; i++)
		{
			if (found[i] != null)
				Object.DestroyImmediate(found[i].gameObject);
		}
	}

	private static AlgebraTouchHudAdapter FindAdapter()
	{
		AlgebraTouchHudAdapter[] adapters = Resources.FindObjectsOfTypeAll<AlgebraTouchHudAdapter>();
		for (int i = 0; i < adapters.Length; i++)
		{
			if (adapters[i] != null)
				return adapters[i];
		}

		return null;
	}

	private static void DestroyAllAdapters()
	{
		AlgebraTouchHudAdapter[] adapters = Resources.FindObjectsOfTypeAll<AlgebraTouchHudAdapter>();
		for (int i = 0; i < adapters.Length; i++)
		{
			if (adapters[i] != null)
				Object.DestroyImmediate(adapters[i].gameObject);
		}
	}

	private static T GetPrivateField<T>(object target, string fieldName)
	{
		FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
		Assert.IsNotNull(field, $"Expected private field '{fieldName}' on {target.GetType().Name}.");
		return (T)field.GetValue(target);
	}

}
