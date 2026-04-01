using System;
using UnityEngine;
using Sirenix.OdinInspector;

/// <summary>
/// Bridges legacy MonoBehaviours to <see cref="GameplayEventBus"/> while keeping singleton callbacks alive.
/// </summary>
public class EventManager : MonoBehaviour
{
	[Title("Perimeter Signal Relay", Subtitle = "Broadcast to the GameplayEventBus.")]
	[InfoBox("Singleton kept for older scenes. We mirror all events to GameplayEventBus and clear them on each play session so listeners never linger.")]
	[SerializeField, Min(1)] private int totalWallSections = 9;
	[SerializeField, Tooltip("If true, once all wall sections are complete we auto-raise CameraPannedToPerspective. Leave off when ChartSystem drives camera outro (e.g., Wisp perimeter).")]
	private bool autoPanBackOnWallsComplete = false;

	public static EventManager instance;

	public event Action onCameraPannedToBirdsEye;
	public event Action onCameraPannedToPerspective;
	public event Action onStartWallGeneration;
	public event Action onFinishWallGeneration;
	public event Action<int> onWallSectionCompleted;

	private void Awake()
	{
		if (instance == null)
		{
			instance = this;
			DontDestroyOnLoad(gameObject);
		}
		else
		{
			Destroy(gameObject);
		}
	}

	private void OnEnable()
	{
		GameplayEventBus.CameraPannedToBirdsEye += HandleCameraPannedToBirdsEye;
		GameplayEventBus.CameraPannedToPerspective += HandleCameraPannedToPerspective;
		GameplayEventBus.WallGenerationStarted += HandleWallGenerationStarted;
		GameplayEventBus.WallGenerationFinished += HandleWallGenerationFinished;
		GameplayEventBus.WallSectionCompleted += HandleWallSectionCompleted;
	}

	private void OnDisable()
	{
		GameplayEventBus.CameraPannedToBirdsEye -= HandleCameraPannedToBirdsEye;
		GameplayEventBus.CameraPannedToPerspective -= HandleCameraPannedToPerspective;
		GameplayEventBus.WallGenerationStarted -= HandleWallGenerationStarted;
		GameplayEventBus.WallGenerationFinished -= HandleWallGenerationFinished;
		GameplayEventBus.WallSectionCompleted -= HandleWallSectionCompleted;

		if (instance == this)
		{
			instance = null;
		}
	}

	private void HandleCameraPannedToBirdsEye()
	{
		onCameraPannedToBirdsEye?.Invoke();
	}

	private void HandleCameraPannedToPerspective()
	{
		onCameraPannedToPerspective?.Invoke();
	}

	private void HandleWallGenerationStarted()
	{
		onStartWallGeneration?.Invoke();
	}

	private void HandleWallGenerationFinished()
	{
		onFinishWallGeneration?.Invoke();
	}

	private void HandleWallSectionCompleted(int index)
	{
		onWallSectionCompleted?.Invoke(index);

		if (autoPanBackOnWallsComplete && index >= totalWallSections)
		{
			// Default fail-safe: once all walls are reported complete, nudge the camera back to perspective.
			GameplayEventBus.RaiseCameraPannedToPerspective();
		}
	}

	// Called by camera animation when the birds-eye position is reached.
	public void OnCameraPannedToBirdsEye()
	{
		GameplayEventBus.RaiseCameraPannedToBirdsEye();
	}

	// Called when the camera animation rewinds to the ground-level view.
	public void OnCameraPannedToPerspective()
	{
		GameplayEventBus.RaiseCameraPannedToPerspective();
	}

	// Called by SyntheiaCityController when the city dissolve completes.
	public void OnStartWallGeneration()
	{
		GameplayEventBus.RaiseWallGenerationStarted();
	}

	// Called once the perimeter loop is complete.
	public void OnFinishWallGeneration()
	{
		GameplayEventBus.RaiseWallGenerationFinished();
	}

	// Called by wall generators as each section finishes building.
	public void OnWallSectionCompleted(int index)
	{
		GameplayEventBus.RaiseWallSectionCompleted(index);
	}
}
