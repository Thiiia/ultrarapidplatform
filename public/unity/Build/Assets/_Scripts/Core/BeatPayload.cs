using System;

/// <summary>
/// Lightweight descriptor for a timed beat or impact event, exposing DSP timing and optional lead information.
/// </summary>
[Serializable]
public readonly struct BeatPayload
{
    public BeatPayload(double dspTime, int sequenceIndex, float beatDuration, float leadInSeconds)
    {
        DspTime = dspTime;
        SequenceIndex = sequenceIndex;
        BeatDuration = beatDuration;
        LeadInSeconds = leadInSeconds;
    }

    /// <summary>Exact DSP timestamp (seconds) when the beat is expected to land.</summary>
    public double DspTime { get; }

    /// <summary>Monotonic index so listeners can correlate schedule and resolve callbacks.</summary>
    public int SequenceIndex { get; }

    /// <summary>Length of the beat in seconds (0 when unknown).</summary>
    public float BeatDuration { get; }

    /// <summary>Lead time in seconds used when scheduling approach FX.</summary>
    public float LeadInSeconds { get; }

    /// <summary>DSP timestamp at which the approach phase begins.</summary>
    public double LeadStartDspTime => DspTime - LeadInSeconds;

    public BeatPayload WithLead(float newLeadSeconds) => new BeatPayload(DspTime, SequenceIndex, BeatDuration, newLeadSeconds);

    public override string ToString() =>
        $"BeatPayload(idx:{SequenceIndex}, dsp:{DspTime:F6}, dur:{BeatDuration:F3}, lead:{LeadInSeconds:F3})";
}
