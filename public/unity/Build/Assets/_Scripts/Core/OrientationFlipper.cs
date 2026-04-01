using System;
using UnityEngine.UI;
using Shapes;
using UnityEngine;

[Serializable]
public struct OrientationTransforms
{
	[SerializeField] public Vector3 gNoteblocksPosition;
	[SerializeField] public Quaternion gNoteblocksRotation;
	[SerializeField] public Vector3[] noteBlocksPosition;
	[SerializeField] public Quaternion[] noteBlocksRotation;
	[SerializeField] public Vector3 highwayBGPosition;
	[SerializeField] public Quaternion highwayBGRotation;
	[SerializeField] public Vector3[] hBGPosition;
	[SerializeField] public Quaternion[] hBGRotation;
	[SerializeField] public Vector2 hBGSizeDelta;
	[SerializeField] public Quaternion hBGButtonsTextRotation;
	[SerializeField] public float hBGButtonsY;
	[SerializeField] public Vector3[] highwayLinesPosition;
	[SerializeField] public Quaternion[] highwayLinesRotation;
	[SerializeField] public Vector3[] controlButtonsPosition;
	[SerializeField] public Quaternion[] controlButtonsRotation;
}

public class OrientationFlipper : MonoBehaviour
{
	[SerializeField] private Button flipButton;
	[SerializeField] private GameObject gNoteblocks;
	[SerializeField] private GameObject[] noteBlocks;
	[SerializeField] private GameObject highwayBG;
	[SerializeField] private GameObject[] hBG;
	[SerializeField] private GameObject[] hBGButtons;
	[SerializeField] private GameObject[] hBGButtonsText;
	[SerializeField] private GameObject[] highwayLines;
	[SerializeField] private GameObject[] customiseControlButtons;

	[SerializeField] private OrientationTransforms leftToRightTransforms;
	[SerializeField] private OrientationTransforms upToDownTransforms;

	[SerializeField] private ChartSystem chartLoader;

	public void ToggleFlipButton()
	{
		if (flipButton)
		{
			flipButton.gameObject.SetActive(!flipButton.gameObject.activeSelf);
		}
	}

	private void Start()
	{
		if (chartLoader.direction == ChartSystem.NoteDirection.LeftToRight)
		{
			SetOrienationTransform(leftToRightTransforms);
		}
		else if (chartLoader.direction == ChartSystem.NoteDirection.UpToDown)
		{
			SetOrienationTransform(upToDownTransforms);
		}
	}

	public void FlipOrientation()
	{
		if (!chartLoader)
		{
			Debug.LogWarning("ChartLoader reference is missing in OrientationFlipper.");
			return;
		}

		if (chartLoader.direction == ChartSystem.NoteDirection.LeftToRight)
		{
			chartLoader.direction = ChartSystem.NoteDirection.UpToDown;
			SetOrienationTransform(upToDownTransforms);
			//chartLoader.ToggleNotesPositions();
		}
		else if (chartLoader.direction == ChartSystem.NoteDirection.UpToDown)
		{
			chartLoader.direction = ChartSystem.NoteDirection.LeftToRight;
			SetOrienationTransform(leftToRightTransforms);
			//chartLoader.ToggleNotesPositions();
		}
	}

	private void SetOrienationTransform(OrientationTransforms orientationTransforms)
	{
		if (gNoteblocks)
		{
			gNoteblocks.transform.localPosition = orientationTransforms.gNoteblocksPosition;
			gNoteblocks.transform.localRotation = orientationTransforms.gNoteblocksRotation;
		}

		if (noteBlocks.Length == orientationTransforms.noteBlocksPosition.Length)
		{
			for (int i = 0; i < noteBlocks.Length; i++)
			{
				if (noteBlocks[i])
				{
					noteBlocks[i].transform.localPosition = orientationTransforms.noteBlocksPosition[i];
					noteBlocks[i].transform.localRotation = orientationTransforms.noteBlocksRotation[i];
				}
			}
		}

		if (highwayBG)
		{
			highwayBG.transform.localPosition = orientationTransforms.highwayBGPosition;
			highwayBG.transform.localRotation = orientationTransforms.highwayBGRotation;
		}

		if (hBG.Length == orientationTransforms.hBGPosition.Length)
		{
			for (int i = 0; i < hBG.Length; i++)
			{
				if (hBG[i])
				{
					Rectangle rectangle = hBG[i].GetComponent<Rectangle>();
					hBG[i].transform.localPosition = orientationTransforms.hBGPosition[i];
					hBG[i].transform.localRotation = orientationTransforms.hBGRotation[i];

					if (rectangle)
					{
						rectangle.Width = orientationTransforms.hBGSizeDelta.x;
						rectangle.Height = orientationTransforms.hBGSizeDelta.y;
					}
				}
			}
		}

		if (hBGButtons.Length == orientationTransforms.hBGPosition.Length)
		{
			for (int i = 0; i < hBGButtons.Length; i++)
			{
				if (hBGButtons[i])
				{
					hBGButtons[i].transform.localPosition = new Vector3(hBGButtons[i].transform.localPosition.x, orientationTransforms.hBGButtonsY, hBGButtons[i].transform.localPosition.z);
				}

				if (hBGButtonsText.Length == hBGButtons.Length)
				{
					if (hBGButtonsText[i])
					{
						RectTransform rectTransform = hBGButtonsText[i].GetComponent<RectTransform>();
						if (rectTransform != null)
						{
							rectTransform.localRotation = orientationTransforms.hBGButtonsTextRotation;
						}
					}
				}
			}
		}

		if (highwayLines.Length == orientationTransforms.highwayLinesPosition.Length)
		{
			for (int i = 0; i < highwayLines.Length; i++)
			{
				if (highwayLines[i])
				{
					highwayLines[i].transform.localPosition = orientationTransforms.highwayLinesPosition[i];
					highwayLines[i].transform.localRotation = orientationTransforms.highwayLinesRotation[i];
				}
			}
		}

		if (customiseControlButtons.Length == orientationTransforms.controlButtonsRotation.Length)
		{
			for (int i = 0; i < customiseControlButtons.Length; i++)
			{
				if (customiseControlButtons[i])
				{
					RectTransform rectTransform = customiseControlButtons[i].GetComponent<RectTransform>();
					if (rectTransform != null)
					{
						rectTransform.anchoredPosition = orientationTransforms.controlButtonsPosition[i];
						rectTransform.localRotation = orientationTransforms.controlButtonsRotation[i];
					}
				}
			}
		}
	}
}
