using System;

/// <summary>
/// Lightweight descriptor for a phrase boundary (section or derived timing).
/// </summary>
[Serializable]
public readonly struct PhraseBoundaryPayload
{
	public PhraseBoundaryPayload(double songTime, float relativeSongTime, int sequenceIndex, string label, long tick)
		: this(songTime, relativeSongTime, 0d, sequenceIndex, label, tick, -1, -1, 0)
	{ }

	public PhraseBoundaryPayload(
		double songTime,
		float relativeSongTime,
		double dspTime,
		int sequenceIndex,
		string label,
		long tick,
		int beatIndex,
		int measureIndex,
		int beatsPerMeasure)
	{
		SongTime = songTime;
		RelativeSongTime = relativeSongTime;
		DspTime = dspTime;
		SequenceIndex = sequenceIndex;
		Label = label ?? string.Empty;
		Tick = tick;
		BeatIndex = beatIndex;
		MeasureIndex = measureIndex;
		BeatsPerMeasure = beatsPerMeasure;
	}

	/// <summary>Absolute song time (seconds) in AudioManager adjusted time space.</summary>
	public double SongTime { get; }

	/// <summary>Song time relative to chart start (seconds, offset-adjusted).</summary>
	public float RelativeSongTime { get; }

	/// <summary>
	/// Estimated DSP time for this boundary (seconds, AudioSettings.dspTime space).
	/// Zero if unknown / not provided by emitter.
	/// </summary>
	public double DspTime { get; }

	/// <summary>Monotonic index for ordering.</summary>
	public int SequenceIndex { get; }

	/// <summary>Optional label (section name, etc.).</summary>
	public string Label { get; }

	/// <summary>Original chart tick for this boundary (0 if unknown).</summary>
	public long Tick { get; }

	/// <summary>0-based beat index (quarter notes) if Tick/Resolution were available; -1 if unknown.</summary>
	public int BeatIndex { get; }

	/// <summary>0-based measure index if Tick/time signature were available; -1 if unknown.</summary>
	public int MeasureIndex { get; }

	/// <summary>Beats per measure used for MeasureIndex; 0 if unknown.</summary>
	public int BeatsPerMeasure { get; }

	public override string ToString() =>
		$"PhraseBoundary(idx:{SequenceIndex}, song:{SongTime:F3}, rel:{RelativeSongTime:F3}, dsp:{DspTime:F3}, beat:{BeatIndex}, measure:{MeasureIndex}, tick:{Tick}, label:'{Label}')";
}
