using UnityEngine.UI;
using UnityEngine;
using DG.Tweening;
using Sirenix.Utilities;

public class TimelineProgress : MonoBehaviour, IChartLoaderGameplayMessage
{
	[SerializeField] private Slider timelineSlider;
	[SerializeField] private Image trackerImage;
	[SerializeField] private Transform timelineBackground;
	[SerializeField] private Transform[] timelineNotesPrefab;
	[SerializeField] private float[] timelineNotesYPositions;
	[SerializeField] private float timelineNoteWidth;
	[SerializeField] private float timelineNoteInitialX = -960f;

	private float timelineNoteCurrentX = 0f;

	private void Awake()
	{
		ResetTimeline();
	}

	public void SetProgress(float progress)
	{
		timelineSlider.value = progress;
		if (trackerImage)
		{
			var trackerRect = trackerImage.rectTransform;
			float sliderWidth = ((RectTransform)timelineSlider.transform).rect.width;
			float x = (progress * sliderWidth) - (sliderWidth / 2f);

			// Kill any leftover tween and set directly
			trackerRect.DOKill();
			trackerRect.anchoredPosition = new Vector2(x, trackerRect.anchoredPosition.y);
		}
	}

	public void OnNotesSpawning(float xPosition, int index)
	{
		if (timelineNotesPrefab.Length == timelineNotesYPositions.Length)
		{
			Transform timelineNote = Instantiate(timelineNotesPrefab[timelineNotesPrefab.Length - 1 - index], timelineBackground);
			RectTransform rectTransform = timelineNote.GetComponent<RectTransform>();
			rectTransform.anchoredPosition = new Vector2(timelineNoteCurrentX, timelineNotesYPositions[index]);
		}
	}

	public void IncrementTimelineNoteXPositon()
	{
		timelineNoteCurrentX += timelineNoteWidth;
	}

	public void ResetTimeline()
	{
		timelineNoteCurrentX = timelineNoteInitialX;
		if (timelineSlider)
		{
			timelineSlider.minValue = 0f;
			timelineSlider.maxValue = 1f;
			timelineSlider.value = 0f;
		}
		SetProgress(0f);

		if (timelineBackground)
		{
			for (int i = timelineBackground.childCount - 1; i >= 0; i--)
			{
				Destroy(timelineBackground.GetChild(i).gameObject);
			}
		}
	}
}
