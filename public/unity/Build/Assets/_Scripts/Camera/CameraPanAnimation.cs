using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CameraPanAnimation : MonoBehaviour
{
	[SerializeField] private Transform startPoint;
	[SerializeField] private Transform endPoint;
	[SerializeField] private float duration = 1f;
	[SerializeField] private AnimationCurve animationCurve = AnimationCurve.Linear(0f, 0f, 1f, 1f);
	[SerializeField] private bool toggleAnimation = true;

	public bool ToggleAnimation
	{
		get { return toggleAnimation; }
		set { toggleAnimation = value; }
	}

	private bool _isPanning;
	private float _panProgress;

	public event Action OnPanStarted;

	public float Duration => duration;
	public AnimationCurve Curve => animationCurve;
	public bool IsPanning => _isPanning;
	public float PanProgress => _panProgress;

	private void OnEnable()
	{
		GameplayEventBus.CameraPannedToPerspective += TriggerReverseAnimation;

		if (AudioManager.Instance)
		{
			AudioManager.Instance.OnPlaybackStarted += Initialize;
		}
	}

	private void OnDestroy()
	{
		GameplayEventBus.CameraPannedToPerspective -= TriggerReverseAnimation;

		if (AudioManager.Instance)
		{
			AudioManager.Instance.OnPlaybackStarted -= Initialize;
		}
	}

	private void Initialize()
	{
		if (startPoint)
		{
			if (toggleAnimation)
			{
				ResetToStartPoint();
				StartCoroutine(PanCamera());
			}
			else
			{
				transform.position = endPoint.position;
				transform.rotation = endPoint.rotation;
			}
		}
	}

	public void TriggerAnimation()
	{
		if (toggleAnimation)
		{
			StartCoroutine(PanCamera());
		}
	}

	public void TriggerReverseAnimation()
	{
		if (toggleAnimation)
		{
			StartCoroutine(PanCameraReverse());
		}
	}

	private IEnumerator PanCamera()
	{
		_isPanning = true;
		_panProgress = 0f;
		OnPanStarted?.Invoke();

		float elapsedTime = 0f;
		Vector3 initialPosition = transform.position;
		Quaternion initialRotation = transform.rotation;

		while (elapsedTime < duration)
		{
			float t = elapsedTime / duration;
			float curveValue = animationCurve.Evaluate(t);
			_panProgress = curveValue;

			transform.position = Vector3.Lerp(initialPosition, endPoint.position, curveValue);
			transform.rotation = Quaternion.Slerp(initialRotation, endPoint.rotation, curveValue);

			elapsedTime += Time.deltaTime;
			yield return null;
		}

		transform.position = endPoint.position;
		transform.rotation = endPoint.rotation;

		_panProgress = 1f;
		_isPanning = false;

		GameplayEventBus.RaiseCameraPannedToBirdsEye();
	}

	private IEnumerator PanCameraReverse()
	{
		float elapsedTime = 0f;
		Vector3 initialPosition = transform.position;
		Quaternion initialRotation = transform.rotation;

		while (elapsedTime < duration)
		{
			float t = elapsedTime / duration;
			float curveValue = animationCurve.Evaluate(t);

			transform.position = Vector3.Lerp(initialPosition, startPoint.position, curveValue);
			transform.rotation = Quaternion.Slerp(initialRotation, startPoint.rotation, curveValue);

			elapsedTime += Time.deltaTime;
			yield return null;
		}

		transform.position = startPoint.position;
		transform.rotation = startPoint.rotation;
	}

	public void RestartPanFromStart()
	{
		if (!toggleAnimation || !startPoint || !endPoint)
			return;

		StopAllCoroutines();
		ResetToStartPoint();
		StartCoroutine(PanCamera());
	}

	private void ResetToStartPoint()
	{
		transform.position = startPoint.position;
		transform.rotation = startPoint.rotation;
		_panProgress = 0f;
		_isPanning = false;
	}
}
