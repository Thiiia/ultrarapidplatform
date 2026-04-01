using UnityEngine;

/// <summary>
/// Bridges the WebGL shell launch mode into the in-game authentication UI.
/// If the WebGL template was launched via "SignIn", this
/// script shows the AuthenticationSystem panel as soon as the first scene loads.
/// </summary>
public class PartnerLoginEntryPoint : MonoBehaviour
{
    [SerializeField] private AuthenticationSystem authenticationUI;

    [SerializeField]
    [Tooltip("If true, the auth panel will be shown immediately when SignIn mode is used. "
           + "If false, this script will just ensure it stays hidden for PlayNow launches.")]
    private bool showOnPartnerLaunch = true;

    private bool launchModeApplied;

    private void Start()
    {
        var bootstrapper = LaunchModeBootstrapper.Instance;
        var mode = bootstrapper != null ? bootstrapper.SelectedMode : LaunchModeBootstrapper.LaunchMode.Unknown;

        if (authenticationUI == null)
            return;

        if (bootstrapper == null || mode == LaunchModeBootstrapper.LaunchMode.Unknown)
            return;

        ApplyLaunchMode(mode);
    }

    private void Update()
    {
        if (authenticationUI == null || launchModeApplied)
            return;

        var bootstrapper = LaunchModeBootstrapper.Instance;
        if (bootstrapper == null)
            return;

        var mode = bootstrapper.SelectedMode;
        if (mode == LaunchModeBootstrapper.LaunchMode.Unknown)
        {
            return;
        }

        ApplyLaunchMode(mode);
    }

    private void ApplyLaunchMode(LaunchModeBootstrapper.LaunchMode mode)
    {
        if (mode == LaunchModeBootstrapper.LaunchMode.SignIn)
        {
            if (showOnPartnerLaunch)
            {
                authenticationUI.EnterSignInMode();
            }
        }
        else
        {
            authenticationUI.HideOverlay();
        }

        launchModeApplied = true;
    }
}
