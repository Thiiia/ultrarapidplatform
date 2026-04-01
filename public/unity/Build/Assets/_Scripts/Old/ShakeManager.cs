using UnityEngine;
using MoreMountains.Feedbacks; // Required for Feel

public class ShakeManager : MonoBehaviour
{
    public static ShakeManager Instance;
    public MMF_Player mmfPlayer; // Single MMF_Player with all shakes

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    public void TriggerShake(string intensity)
    {
        if (mmfPlayer == null)
        {
            Debug.LogWarning("ShakeManager: MMF_Player is not assigned!");
            return;
        }

        // Disable all feedbacks first
        foreach (var feedback in mmfPlayer.FeedbacksList)
        {
            feedback.Active = false;
        }

        // Enable the selected shake
        switch (intensity)
        {
            case "Light":
                mmfPlayer.FeedbacksList[0].Active = true; // Assuming LightShake is first
                break;
            case "Medium":
                mmfPlayer.FeedbacksList[1].Active = true; // MediumShake is second
                break;
            case "Heavy":
                mmfPlayer.FeedbacksList[2].Active = true; // HeavyShake is third
                break;
            default:
                Debug.LogWarning($"ShakeManager: Unknown shake intensity '{intensity}'");
                return;
        }

        mmfPlayer.PlayFeedbacks(); // Play the enabled feedback
    }
}
