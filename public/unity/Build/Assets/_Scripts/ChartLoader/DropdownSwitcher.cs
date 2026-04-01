using UnityEngine;
using UnityEngine.SceneManagement; // For scene management
using TMPro; // For TMP_Dropdown
using System.IO; // For file handling
using UnityEngine.Networking; // For WebGL compatibility
using System.Collections; // For IEnumerator

public class DropdownSwitcher : MonoBehaviour
{
    public TMP_Dropdown chartDropdown; // Reference to TMP_Dropdown
    public string[] chartPaths; // Paths to the chart files relative to StreamingAssets
    public string[] audioPaths; // Paths to the audio files relative to StreamingAssets
    public AudioSource audioSource; // Reference to the AudioSource (should be the same used by AudioManager)

    public static int SelectedIndex = -1; // -1 means no selection yet, use default

    void Start()
    {
        Debug.Log($"DropdownSwitcher Start. SelectedIndex: {SelectedIndex}");

        var chartLoader = GetChartSystem();
        if (chartLoader != null)
        {
            chartLoader.ResetLoaderState();
            if (audioSource == null)
                audioSource = chartLoader.Music;
        }

        if (AudioManager.Instance != null && audioSource != null)
            AudioManager.Instance.musicSource = audioSource;

        if (SelectedIndex >= 0)
        {
            chartDropdown.value = SelectedIndex;
            ApplySettings(SelectedIndex);
        }
        else
        {
            chartDropdown.value = 0;
            StartCoroutine(LoadInitialSettings());
        }

        chartDropdown.RefreshShownValue();
        chartDropdown.onValueChanged.AddListener(OnDropdownValueChanged);
    }

    void OnDropdownValueChanged(int index)
    {
        Debug.Log($"Dropdown value changed to index: {index}");
        ApplySettings(index);
    }

    void ApplySettings(int index)
    {
        Debug.Log($"Applying settings for index: {index}");

        if (audioSource != null)
        {
            audioSource.Stop();
            audioSource.clip = null;
        }

        var chartLoader = GetChartSystem();
        if (chartLoader == null)
        {
            Debug.LogError("ChartSystem instance not found!");
            return;
        }

        if (chartPaths != null && chartPaths.Length > index)
        {
            string relativePath = chartPaths[index];
            chartLoader.Path = relativePath;
            chartLoader.LoadAndInitializeChart();
        }

        if (audioPaths != null && audioPaths.Length > index)
        {
            string audioFullPath = Path.Combine(Application.streamingAssetsPath, audioPaths[index]);
            StartCoroutine(LoadAudio(audioFullPath));
        }
    }

    IEnumerator LoadAudio(string path)
    {
        string url = path;
        Debug.Log($"Attempting to load audio from: {url}");

        using (UnityWebRequest uwr = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return uwr.SendWebRequest();

            if (uwr.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"Successfully loaded audio from: {url}");
                AudioClip clip = DownloadHandlerAudioClip.GetContent(uwr);
                if (audioSource != null)
                {
                    audioSource.Stop();
                    audioSource.clip = clip;
                    audioSource.time = 0f;

                    if (AudioManager.Instance != null)
                    {
                        AudioManager.Instance.musicSource = audioSource;
                        AudioManager.Instance.SchedulePlaybackNow();
                    }
                }
            }
            else
            {
                Debug.LogError($"Failed to load audio from: {url}, Error: {uwr.error}");
            }
        }
    }

    IEnumerator LoadInitialSettings()
    {
        Debug.Log("Loading initial settings...");

        var chartLoader = GetChartSystem();
        if (chartLoader != null && chartPaths != null && chartPaths.Length > 0)
        {
            chartLoader.ClearExistingNotes();
            ChartSystem.Chart = null;
            chartLoader.Path = chartPaths[0];
            chartLoader.LoadAndInitializeChart();
        }

        if (audioPaths != null && audioPaths.Length > 0)
        {
            string audioFullPath = Path.Combine(Application.streamingAssetsPath, audioPaths[0]);
            yield return LoadAudio(audioFullPath);
        }
    }

    private ChartSystem GetChartSystem()
    {
#if UNITY_2023_1_OR_NEWER
        return Object.FindFirstObjectByType<ChartSystem>();
#else
        return Object.FindFirstObjectByType<ChartSystem>();
#endif
    }
}
