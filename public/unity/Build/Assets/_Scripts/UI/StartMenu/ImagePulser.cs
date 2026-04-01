using UnityEngine.UI;
using UnityEngine;

public class ImagePulser : MonoBehaviour
{
	[SerializeField] private Image imageToPulse;
	[SerializeField] private bool isEnabled = false;
	[SerializeField] private float maxSize = 1f;
	[SerializeField] private float minSize = 1f;

	private bool resetSize = false;
	private float defaultSize = 1f;

	private void Awake()
	{
		if (imageToPulse == null)
		{
			imageToPulse = GetComponent<Image>();
		}

		if (imageToPulse)
		{
			defaultSize = imageToPulse.rectTransform.sizeDelta.x;
		}
	}

	private void Update()
	{
		if (imageToPulse)
		{
			if (isEnabled)
			{
				float scale = (Mathf.Sin(Time.time * 3f) + 1f) / 2f;
				float newSize = Mathf.Lerp(minSize, maxSize, scale);
				imageToPulse.rectTransform.sizeDelta = new Vector2(newSize, newSize);
			}
			else if (resetSize)
			{
				Vector2 currentSize = imageToPulse.rectTransform.sizeDelta;
				imageToPulse.rectTransform.sizeDelta = Vector2.Lerp(currentSize, new Vector2(defaultSize, defaultSize), Time.deltaTime * 10f);

				if (Mathf.Abs(imageToPulse.rectTransform.sizeDelta.x - defaultSize) < 0.1f)
				{
					resetSize = false;
				}
			}
		}
	}

	public void SetEnable(bool enable)
	{
		isEnabled = enable;

		if (!isEnabled)
		{
			resetSize = true;
		}
	}
}
