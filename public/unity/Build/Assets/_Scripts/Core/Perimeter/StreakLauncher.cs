using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations.Rigging;

public class StreakLauncher : MonoBehaviour
{
	[SerializeField] private GameObject streakPrefab;
	[SerializeField] private Transform[] launchPoints;
	[SerializeField] private float launchInterval = 0.5f;
	[SerializeField] private float launchForce = 10f;
	[SerializeField] private float streakLifetime = 5f;

	private int currentMaxIndex = -1;
	private float launchTimer = 0f;
	private List<GameObject> streaks = new List<GameObject>();
	private List<Rigidbody> streakRigidbodies = new List<Rigidbody>();

	private void Start()
	{
		GameplayEventBus.WallSectionCompleted += ActivateStreaks;

		for (int i = 0; i < launchPoints.Length; i++)
		{
			GameObject streak = Instantiate(streakPrefab, launchPoints[i].position, launchPoints[i].rotation);
			streaks.Add(streak);
			streak.transform.parent = launchPoints[i];
			Rigidbody rb = streaks[i].GetComponent<Rigidbody>();
			streakRigidbodies.Add(rb);
		}
	}

	private void OnDisable()
	{
		GameplayEventBus.WallSectionCompleted -= ActivateStreaks;
	}

	private void ActivateStreaks(int index)
	{
		if (index >= 0 && index < streaks.Count)
		{
			currentMaxIndex = index;
		}
	}

	private void Update()
	{
		if (currentMaxIndex >= 0)
		{
			launchTimer += Time.deltaTime;

			if (launchTimer >= launchInterval)
			{
				launchTimer = 0f;
				int index = Random.Range(0, currentMaxIndex);
				LaunchStreaks(index);
				return;
			}
		}
	}

	private void LaunchStreaks(int index)
	{
		Vector3 launchDirection = (transform.position - launchPoints[index].position).normalized;
		streakRigidbodies[index].AddForce(launchDirection * launchForce, ForceMode.VelocityChange);
		StartCoroutine(DisableStreak(index));
	}

	private IEnumerator DisableStreak(int index)
	{
		yield return new WaitForSeconds(streakLifetime);
		streaks[index].transform.position = launchPoints[index].position;
	}
}
