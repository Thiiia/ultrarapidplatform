using UnityEngine;
using ChartLoader.NET.Framework;
using System.Collections.Generic;

public class BeatFretlineSpawner : MonoBehaviour
{
	[Tooltip("Prefab used for beat lines.")]
	public Transform fretLinePrefab;

	[Tooltip("Container to hold all fret lines.")]
	public Transform parentContainer;

	[Tooltip("Reference to chart loader.")]
	public ChartSystem chartLoader;

	[Tooltip("Spacing multiplier (usually same as note speed).")]
	public float speed = 1f;

	public void StartSpawningFretLines()
	{
		if (fretLinePrefab == null || parentContainer == null)
		{
			Debug.LogError("FretLineSpawner: Missing prefab or parent container.");
			return;
		}

		if (chartLoader == null)
		{
			Debug.LogError("FretLineSpawner: Missing ChartSystem reference.");
			return;
		}

		Note[] notes = chartLoader != null ? chartLoader.GetLoadedNotes() : null;
		if (notes == null || notes.Length == 0)
		{
			Debug.LogWarning("FretLineSpawner: No cached notes found.");
			return;
		}

		float firstNoteZ = chartLoader.GetFirstNoteZ();
		float firstNoteX = chartLoader.GetFirstNoteX();
		bool isReversed = chartLoader.direction == ChartSystem.NoteDirection.LeftToRight || chartLoader.direction == ChartSystem.NoteDirection.UpToDown;

		HashSet<int> uniqueSeconds = new HashSet<int>();

		foreach (var note in notes)
		{
			float noteTime = ChartSystem.GetNoteSongTime(note);
			int roundedSecond = Mathf.FloorToInt(noteTime);
			if (uniqueSeconds.Add(roundedSecond))
			{
				Transform line = Instantiate(fretLinePrefab, parentContainer);
				if (chartLoader.direction == ChartSystem.NoteDirection.LeftToRight || chartLoader.direction == ChartSystem.NoteDirection.RightToLeft)
				{
					// Calculate the Z position based on the note's seconds and speed
					float zPosition = isReversed ? -noteTime * speed + firstNoteZ : noteTime * speed + firstNoteZ;
					line.localPosition = new Vector3(0f, 0f, zPosition);
				}
				else
				{
					float xPosition = isReversed ? -noteTime * speed + firstNoteX : noteTime * speed + firstNoteX;
					line.localPosition = new Vector3(xPosition, 0f, 0f);
				}

				line.name = $"FretLine_{roundedSecond}s";
			}
		}

		Debug.Log($"[FretlineSpawner] Spawned {uniqueSeconds.Count} fret lines for {(isReversed ? "L->R" : "R->L")}.");
	}
}


