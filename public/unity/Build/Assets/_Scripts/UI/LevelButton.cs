using UnityEngine;
using UnityEngine.SceneManagement;
using TMPro;
using DG.Tweening;
using UnityEngine.UI;
public class LevelButton : MonoBehaviour
{
    [Header("Scene Settings")]
    public string sceneToLoad;
    public bool isChillMode;
    private string cachedSceneToLoad;

    [Header("Text Labels")]
    public TextMeshProUGUI initialLabel;
    public TextMeshProUGUI confirmLabel;

    [Header("Other Buttons")]
    public GameObject[] otherButtons;

    [Header("Popup UI")]
    public GameObject confirmPopup;
    public CanvasGroup popupCanvasGroup;

    [Header("Popup Animation")]
    public float popupFadeTime = 0.3f;
    public float bounceDuration = 0.4f;
    public float startScale = 0.6f;

    private bool clicked = false;

    private void OnMouseDown()
    {
        // WebGL: treat any level selection click as an audio unlock gesture (no scheduling here).
        AudioManager.UnlockFromUserGesture(false);

        DOTween.Kill(confirmLabel?.transform); // Cancel any running tweens
        confirmLabel?.gameObject.SetActive(false); // Reset if left active from previous click
        cachedSceneToLoad = sceneToLoad;
        if (clicked) return;
        clicked = true;

        if (isChillMode)
        {
            if (initialLabel != null) initialLabel.gameObject.SetActive(false);

            if (confirmLabel != null)
            {
                confirmLabel.gameObject.SetActive(true);
                confirmLabel.transform.localScale = Vector3.zero;
                confirmLabel.transform.DOScale(1f, 0.3f)
                    .SetEase(Ease.OutBack)
                    .SetLink(confirmLabel.gameObject, LinkBehaviour.KillOnDestroy);
            }
        }



        ShowConfirmPopupAtThisButton();
    }

    private void ShowConfirmPopupAtThisButton()
    {
        if (confirmPopup == null || popupCanvasGroup == null) return;

        RectTransform buttonRect = GetComponent<RectTransform>();
        RectTransform popupRect = confirmPopup.GetComponent<RectTransform>();
        RectTransform canvasRect = confirmPopup.GetComponentInParent<Canvas>().GetComponent<RectTransform>();

        confirmPopup.SetActive(true);

        // Get the screen point of the button
        Vector2 screenPoint = RectTransformUtility.WorldToScreenPoint(Camera.main, buttonRect.position);

        // Convert screen point to anchored position in canvas
        RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, screenPoint, Camera.main, out Vector2 anchoredPos);

        // Get half size of popup and canvas to clamp within bounds
        Vector2 popupHalfSize = popupRect.sizeDelta / 2f;
        Vector2 canvasHalfSize = canvasRect.sizeDelta / 2f;

        // Clamp position
        float clampedX = Mathf.Clamp(anchoredPos.x, -canvasHalfSize.x + popupHalfSize.x, canvasHalfSize.x - popupHalfSize.x);
        float clampedY = Mathf.Clamp(anchoredPos.y, -canvasHalfSize.y + popupHalfSize.y, canvasHalfSize.y - popupHalfSize.y);

        popupRect.anchoredPosition = new Vector2(clampedX, clampedY);

        // Set depth manually if needed
        Vector3 local = popupRect.localPosition;
        local.z = -0.2f;
        popupRect.localPosition = local;

        // Animate
        popupCanvasGroup.alpha = 0f;
        popupCanvasGroup.DOFade(1f, popupFadeTime)
            .SetTarget(popupCanvasGroup)
            .SetLink(confirmPopup, LinkBehaviour.KillOnDestroy);
        popupRect.localScale = Vector3.one * startScale;
        popupRect.DOScale(1f, bounceDuration)
            .SetEase(Ease.OutBack)
            .SetTarget(popupRect)
            .SetLink(confirmPopup, LinkBehaviour.KillOnDestroy);

        // Attach confirmation listener
        Button confirmBtn = confirmPopup.GetComponentInChildren<Button>();
        if (confirmBtn != null)
        {
            confirmBtn.onClick.RemoveAllListeners();
            confirmBtn.onClick.AddListener(ConfirmAndLoad);
        }
    }

    public void ConfirmAndLoad()
    {
        if (!string.IsNullOrEmpty(cachedSceneToLoad))
        {
            SceneManager.LoadScene(cachedSceneToLoad);
        }
    }
}
