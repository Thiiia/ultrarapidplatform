using System;
using UnityEngine;

/// <summary>
/// Receives the launch mode from the WebGL template (PlayNow / SignIn)
/// and persists it across the initial scene load.
/// </summary>
public class LaunchModeBootstrapper : MonoBehaviour
{
    public enum LaunchMode
    {
        Unknown = 0,
        PlayNow = 1,
        SignIn = 2,
    }

    public static LaunchModeBootstrapper Instance { get; private set; }

    /// <summary>Mode chosen on the shell page. Defaults to Unknown.</summary>
    public LaunchMode SelectedMode { get; private set; } = LaunchMode.Unknown;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    /// <summary>
    /// Called from the WebGL template via SendMessage when a launch button is clicked.
    /// Signature must be (string) for SendMessage.
    /// </summary>
    /// <param name="mode">"PlayNow" or "SignIn" (case-insensitive).</param>
    public void OnLaunchModeSelected(string mode)
    {
        if (string.IsNullOrEmpty(mode))
        {
            SelectedMode = LaunchMode.Unknown;
            return;
        }

        if (string.Equals(mode, "SignIn", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(mode, "PartnerLogin", StringComparison.OrdinalIgnoreCase))
        {
            SelectedMode = LaunchMode.SignIn;
        }
        else
        {
            SelectedMode = LaunchMode.PlayNow;
        }

        // At this point you can branch to different flows
        // (e.g., skip intro slideshow when PlayNow, or open sign-in UI).
    }

    /// <summary>
    /// Called from the WebGL shell button to unlock audio and kick off playback.
    /// </summary>
    public void OnUserGestureStart()
    {
        AudioManager.UnlockFromUserGesture(true);
    }
}
