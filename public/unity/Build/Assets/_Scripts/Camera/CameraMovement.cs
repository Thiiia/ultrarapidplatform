using System;
using UnityEngine;

public class CameraMovement : MonoBehaviour
{
	private bool _initialized = false;

	private float _speed;
	private float songLength;
	private Vector3 initialPosition;
	private bool reverse = false;

	[SerializeField] private bool bStopMoving = false;
	[SerializeField] private float tiltedAngle = 0f;
	public ChartSystem ReftoChartLoader;

	[Tooltip("Override direction manually if needed.")]
	public bool useDirectionOverride = false;
	public bool directionOverride = false; // true = LeftToRight

	private ChartSystem.NoteDirection? cachedDirection;
	private bool isHorizontalMovement;
	private bool isVerticalMovement;

	public float Speed
	{
		get => _speed;
		set => _speed = value;
	}

	public void InitializeFromAudioManager()
	{
		if (AudioManager.Instance == null)
		{
			Debug.LogError($"{name}: AudioManager instance not found!");
			_initialized = false;
			return;
		}

		songLength = AudioManager.Instance.songLength;
		initialPosition = transform.position;

		cachedDirection = null;

		if (!useDirectionOverride)
		{
			if (ReftoChartLoader == null)
				ReftoChartLoader = UnityEngine.Object.FindFirstObjectByType<ChartSystem>();

			if (ReftoChartLoader != null)
			{
				RefreshMovementDirection();
			}
			else
			{
				Debug.LogWarning($"{name}: ? Could not find ChartSystem in scene.");
			}
		}
		else
		{
			reverse = directionOverride;
			RefreshMovementDirection();
		}

		_initialized = true; // we're live
		Debug.Log($"[{name}] Init ? reverse: {reverse} | z0: {initialPosition}");
	}

	private void LateUpdate()
	{
		if (bStopMoving) return;                          // emergency brake
		if (AudioManager.Instance == null) return;        // no bandleader, no movement
		if (!_initialized) return;                        // wait until baseline set

		if (ReftoChartLoader == null)
			ReftoChartLoader = UnityEngine.Object.FindFirstObjectByType<ChartSystem>();
		if (ReftoChartLoader == null) return;            // still booting? bail gracefully

		RefreshMovementDirection();

		double currentSongTime = AudioManager.Instance.GetAdjustedSongTime();
		if (currentSongTime > songLength) currentSongTime = songLength;

		float deltaPos = (float)(currentSongTime * Speed);

		if (isHorizontalMovement)
		{
			float z = reverse ? initialPosition.z - deltaPos : initialPosition.z + deltaPos;
			transform.position = new Vector3(transform.position.x, transform.position.y, z);
		}
		else if (isVerticalMovement)
		{
			float x = reverse ? initialPosition.x - deltaPos : initialPosition.x + deltaPos;
			transform.position = new Vector3(x, initialPosition.y, initialPosition.z);
		}
		else
		{
			transform.position = new Vector3(
				initialPosition.x - deltaPos * Mathf.Cos(tiltedAngle),
				initialPosition.y - deltaPos * Mathf.Sin(tiltedAngle),
				initialPosition.z
			);
		}
	}

	private void RefreshMovementDirection()
	{
		if (ReftoChartLoader == null) return;

		var direction = ReftoChartLoader.direction;
		if (cachedDirection.HasValue && cachedDirection.Value == direction)
		{
			return;
		}

		cachedDirection = direction;

		isHorizontalMovement = direction == ChartSystem.NoteDirection.LeftToRight
			|| direction == ChartSystem.NoteDirection.RightToLeft;

		isVerticalMovement = direction == ChartSystem.NoteDirection.UpToDown
			|| direction == ChartSystem.NoteDirection.DownToUp;

		if (!useDirectionOverride)
		{
			// Mirror legacy behaviour: chart orientation decides whether we travel "reverse".
			reverse = direction == ChartSystem.NoteDirection.LeftToRight
				|| direction == ChartSystem.NoteDirection.UpToDown
				|| direction == ChartSystem.NoteDirection.GuitarHeroStyle;
		}
	}
}
