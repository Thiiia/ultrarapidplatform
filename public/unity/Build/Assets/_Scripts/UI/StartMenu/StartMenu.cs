using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using UnityEngine.EventSystems;
using System.Collections;
using System.IO;
using DG.Tweening;

public class StartMenu : MonoBehaviour
{
    [Header("UI References")]
    public RectTransform panelToZoom;
    public RectTransform zoomTarget;
    public CanvasGroup blackoutOverlay;
    public CanvasGroup fullPanelOverlay; // Fullscreen black panel

    [Header("Button Text")]
    public TextMeshProUGUI buttonText;


    [Header("Timing")]
    public float zoomDuration = 1.0f;
    public float blackoutFadeTime = 0.4f;
    public float panelFadeTime = 0.5f;

    [Header("Scenes")]
    [SerializeField] private string primaryLevelSelectSceneName = "LevelSelectScene";
    [SerializeField] private string fallbackLevelSelectSceneName = "Level Select";

    private AsyncOperation slideshowLoadOp;
    private string resolvedLevelSelectSceneName;

    void Start()
    {
        resolvedLevelSelectSceneName = ResolveSceneInBuild(primaryLevelSelectSceneName, fallbackLevelSelectSceneName);
        StartCoroutine(PreloadSlideshowScene());

        if (blackoutOverlay != null)
            blackoutOverlay.alpha = 0f;

        if (fullPanelOverlay != null)
        {
            fullPanelOverlay.alpha = 0f;
            fullPanelOverlay.blocksRaycasts = false;
        }

       
    }

    public void PlayGame()
    {
        // WebGL: ensure the browser audio context is unlocked from this click.
        AudioManager.UnlockFromUserGesture(false);
        StartCoroutine(FadeToBlackAndStart());
    }

    private IEnumerator PreloadSlideshowScene()
    {
        slideshowLoadOp = SceneManager.LoadSceneAsync(resolvedLevelSelectSceneName);
        slideshowLoadOp.allowSceneActivation = false;
        yield return slideshowLoadOp;
    }

    private IEnumerator FadeToBlackAndStart()
    {
        // Fade entire screen to black
        if (fullPanelOverlay != null)
        {
            fullPanelOverlay.blocksRaycasts = true;
            fullPanelOverlay.DOFade(1f, panelFadeTime)
                .SetTarget(fullPanelOverlay)
                .SetLink(fullPanelOverlay.gameObject, LinkBehaviour.KillOnDestroy);
            yield return new WaitForSeconds(panelFadeTime);
        }

        // Optional: zoom the panel before switching scenes
        yield return ZoomThenFadeThenLoad();
    }

    private IEnumerator ZoomThenFadeThenLoad()
    {
        Sequence zoomSequence = DOTween.Sequence()
            .SetTarget(panelToZoom)
            .SetLink(panelToZoom.gameObject, LinkBehaviour.KillOnDestroy);
        zoomSequence.Join(panelToZoom.DOAnchorPos3D(zoomTarget.anchoredPosition3D, zoomDuration).SetEase(Ease.InOutQuad));
        zoomSequence.Join(panelToZoom.DOScale(zoomTarget.localScale, zoomDuration).SetEase(Ease.InOutQuad));
        zoomSequence.Join(panelToZoom.DOLocalRotate(zoomTarget.localEulerAngles, zoomDuration).SetEase(Ease.InOutQuad));
        yield return zoomSequence.WaitForCompletion();

        if (blackoutOverlay != null)
        {
            blackoutOverlay.DOFade(1f, blackoutFadeTime)
                .SetTarget(blackoutOverlay)
                .SetLink(blackoutOverlay.gameObject, LinkBehaviour.KillOnDestroy);
            yield return new WaitForSeconds(blackoutFadeTime);
        }

        if (slideshowLoadOp != null)
        {
            slideshowLoadOp.allowSceneActivation = true;
        }
        else
        {
            SceneManager.LoadScene(resolvedLevelSelectSceneName);
        }
    }

   
    private static string ResolveSceneInBuild(string primary, string fallback)
    {
        string found = FindSceneInBuild(primary);
        if (!string.IsNullOrWhiteSpace(found))
            return found;

        found = FindSceneInBuild(fallback);
        if (!string.IsNullOrWhiteSpace(found))
            return found;

        return string.IsNullOrWhiteSpace(primary) ? fallback : primary;
    }

    private static string FindSceneInBuild(string candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
            return null;

        int count = SceneManager.sceneCountInBuildSettings;
        for (int i = 0; i < count; i++)
        {
            string path = SceneUtility.GetScenePathByBuildIndex(i);
            string name = Path.GetFileNameWithoutExtension(path);
            if (string.Equals(name, candidate, System.StringComparison.OrdinalIgnoreCase))
                return name;
        }

        return null;
    }
}
