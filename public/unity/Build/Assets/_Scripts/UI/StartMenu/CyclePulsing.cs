using UnityEngine;

public class CyclePulsing : MonoBehaviour
{
	[SerializeField] private ImagePulser[] imagePulsers;
	[SerializeField] private float cycleInterval = 2.0f;

	private int currentIndex = -1;
	private int previousIndex = -1;
	private float timer = 0f;

	private void Start()
	{
		currentIndex = -1;
		previousIndex = -1;
		timer = 0f;
	}

	private void Update()
	{
		if (imagePulsers.Length == 0)
		{
			return;
		}

		float time = Time.time;

		if (time - timer >= cycleInterval)
		{
			timer = time;
			previousIndex = currentIndex;
			++currentIndex;

			if (currentIndex >= imagePulsers.Length)
			{
				currentIndex = 0;
			}

			if (previousIndex >= 0 && previousIndex < imagePulsers.Length && imagePulsers[previousIndex])
			{
				imagePulsers[previousIndex].SetEnable(false);
			}

			if (imagePulsers[currentIndex])
			{
				imagePulsers[currentIndex].SetEnable(true);
			}
		}
	}
}
