using System;
using UnityEngine;

public enum HitResult { None, Perfect, Good, Miss }

[Serializable]
public struct HitWindows
{
    // Seconds (not ms). Keep small for snap.
    public float perfect;
    public float good;
    public float miss;

    public HitWindows(float perfect, float good, float miss)
    {
        this.perfect = perfect;
        this.good = good;
        this.miss = miss;
    }
}

[DefaultExecutionOrder(-10)]
public static class JudgementService
{
  
    public static readonly HitWindows WispJudgement    = new HitWindows(0.375f, 0.500f, 0.675f);
    public static readonly HitWindows HighwayJudgement = new HitWindows(0.060f, 0.110f, 0.180f);
    public static readonly HitWindows HighwayHard      = new HitWindows(0.040f, 0.080f, 0.150f);


    public static HitWindows Windows = WispJudgement;

    // -----------------------------
    // calibration & bias (small but mighty)
    // -----------------------------

    /// <summary>
    /// Global calibration offset in milliseconds. Positive => game is late vs player (so we advance 'now').
    /// Hook to your calibration UI. 0 = off.
    /// </summary>
    public static float CalibrationOffsetMs = 0f;

    /// <summary>
    /// Micro asymmetry: slightly wider early, slightly tighter late. Keep near ±5%.
    /// </summary>
    public static float EarlyBias = 1.05f;
    public static float LateBias  = 0.95f;

    // optional: BPM cap (OFF by default). Caps windows to a slice of the quarter note.
    public static bool  UseBpmClamp = false;
    public static float CurrentBpm   = 120f;
    // Fractions of a quarter note (Q = 60/BPM). Effective windows = min(base, frac * Q).
    public static Vector3 BpmClampFractions = new Vector3(0.06f, 0.12f, 0.20f); // P/G/M

    // -----------------------------
    // legacy entry point (kept)
    // -----------------------------
    public static HitResult Judge(double expectedTime, double now)
    {
        var info = JudgeDetailed(expectedTime, now);
        return info.result;
    }

    // -----------------------------
    //   hit info for cooler VFX/score
    // -----------------------------
    public struct HitInfo
    {
        public HitResult result;     // Perfect/Good/Miss
        public float signedErrorMs;  // + = late, - = early
        public float absErrorMs;     // magnitude only
        /// <summary>0 = dead center, 1 = at miss border. Great for scaling FX.</summary>
        public float normalizedToMiss;
    }

    public static HitInfo JudgeDetailed(double expectedTime, double now)
    {
        // apply calibration (ms -> s). Positive calibration means game is late; we advance 'now'.
        double calSec = CalibrationOffsetMs * 0.001;
        double signedSec = (now + calSec) - expectedTime; // + = late, - = early

        var w = GetEffectiveWindows();
        float p = w.perfect, g = w.good, m = w.miss;

        // tiny early/late bias
        float bias = signedSec < 0 ? EarlyBias : LateBias;
        float pB = p * bias;
        float gB = g * bias;

        float absSec = Mathf.Abs((float)signedSec);
        HitResult res =
            (absSec <= pB) ? HitResult.Perfect :
            (absSec <= gB) ? HitResult.Good :
            (absSec <= m ) ? HitResult.Miss : HitResult.Miss;

        float absMs  = Mathf.Abs((float)signedSec * 1000f);
        float missMs = Mathf.Max(1f, m * 1000f);
        float norm   = Mathf.Clamp01(absMs / missMs);

        return new HitInfo {
            result           = res,
            signedErrorMs    = (float)(signedSec * 1000.0),
            absErrorMs       = absMs,
            normalizedToMiss = norm
        };
    }

    // -----------------------------
    // convenience + helpers
    // -----------------------------

    /// <summary>Switch preset at runtime (e.g., Wisp vs Highway).</summary>
    public static void UsePreset(HitWindows preset) => Windows = Sanitize(preset);

    /// <summary>Set Wisp-friendly windows.</summary>
    public static void UseWispJudgement()    => UsePreset(WispJudgement);

    /// <summary>Set crisp Highway windows.</summary>
    public static void UseHighwayJudgement() => UsePreset(HighwayJudgement);

    /// <summary>Set BPM for clamping (only used if UseBpmClamp = true).</summary>
    public static void SetCurrentBpm(float bpm) => CurrentBpm = Mathf.Max(1f, bpm);

    /// <summary>Simple scoring weights (override if you want curves).</summary>
    public static int ScoreFor(HitResult r) => (r == HitResult.Perfect) ? 100 : (r == HitResult.Good ? 70 : 0);

    /// <summary>Pretty logger for tuning.</summary>
    public static string DescribeWindows()
    {
        var w = GetEffectiveWindows();
        return $"Windows(s): P={w.perfect:0.000} G={w.good:0.000} M={w.miss:0.000} | Bias(E/L)={EarlyBias:0.###}/{LateBias:0.###} | Cal={CalibrationOffsetMs:+0;-0;0}ms";
    }

    // clamp order, no negatives, optional bpm-cap
    private static HitWindows GetEffectiveWindows()
    {
        var w = Sanitize(Windows);

        if (UseBpmClamp && CurrentBpm > 0.1f)
        {
            float q = 60f / CurrentBpm; // quarter note in seconds
            var cap = new HitWindows(
                BpmClampFractions.x * q,
                BpmClampFractions.y * q,
                BpmClampFractions.z * q
            );

            // cap by beat slice
            w.perfect = Mathf.Min(w.perfect, cap.perfect);
            w.good    = Mathf.Min(w.good,    cap.good);
            w.miss    = Mathf.Min(w.miss,    cap.miss);
            w = Sanitize(w);
        }

        return w;
    }

    private static HitWindows Sanitize(HitWindows w)
    {
        // enforce order: perfect <= good <= miss
		w.perfect = Mathf.Max(0f, w.perfect);
		w.good    = Mathf.Max(w.perfect, w.good);
		w.miss    = Mathf.Max(w.good,    w.miss);
		return w;
	}
}
