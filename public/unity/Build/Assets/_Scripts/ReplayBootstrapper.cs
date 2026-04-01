using UnityEngine;

public class ReplayBootstrapper : MonoBehaviour
{
    public static ReplayBootstrapper Instance;
    public bool isReplayRequested = false;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject); // Survive scene transition
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public void TriggerReplay()
    {
        isReplayRequested = true;
    }
}
