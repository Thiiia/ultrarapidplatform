using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using DG.Tweening;
using UnityEngine.UI;

public class CamTog : MonoBehaviour
{
    public GameObject refToGuitarMainCam, refToDrumsMainCam;
    public RectTransform button; // Reference to the button's RectTransform

    public float animationDuration = 0.5f; // Duration of the transition
    float guitarCameraWidth = 1.0f; 
    float drumsCameraWidth = 0.5f; 
    private Vector3 originalButtonPosition; // To store the button's original position
    private Vector3 originalButtonScale; // To store the button's original scale
    public Vector3 toggledButtonPosition = new Vector3(-3f, -585f, 0f); // Target position for split-screen(button)
    private Vector3 toggledButtonScale = new Vector3(0.5f, 0.5f, 0.5f); // Target scale for split-screen(button)

    void Start()
    {
        refToGuitarMainCam = GameObject.Find("GMain Camera");
        refToDrumsMainCam = GameObject.Find("DMain Camera");

        // Set initial positions
        Rect guitarInitialRect = refToGuitarMainCam.GetComponent<Camera>().rect;
        guitarInitialRect.x = 0f;
        guitarInitialRect.width = guitarCameraWidth;
        refToGuitarMainCam.GetComponent<Camera>().rect = guitarInitialRect;

        Rect drumsInitialRect = refToDrumsMainCam.GetComponent<Camera>().rect;
        drumsInitialRect.x = 0.5f; // Drums camera starts on the right
        drumsInitialRect.width = drumsCameraWidth;
        refToDrumsMainCam.GetComponent<Camera>().rect = drumsInitialRect;

        refToDrumsMainCam.GetComponent<Camera>().enabled = false; // Drums camera starts disabled

        // Save the button's original position and scale
        originalButtonPosition = button.anchoredPosition3D;
        originalButtonScale = button.localScale;
    }

    public void CameraToggle()
    {
        // Get current rects
        Rect guitarRect = refToGuitarMainCam.GetComponent<Camera>().rect;
        Camera drumsCam = refToDrumsMainCam.GetComponent<Camera>();

        if (Mathf.Approximately(guitarRect.x, 0))
        {
            // Enable Drums Camera
            drumsCam.enabled = true;

            // Animate Guitar Camera to the left
            DOTween.To(() => guitarRect.x, x => guitarRect.x = x, -0.5f, animationDuration).OnUpdate(() =>
            {
                refToGuitarMainCam.GetComponent<Camera>().rect = guitarRect;
            });

            // Animate the button to the toggled position and scale
            button.DOAnchorPos3D(toggledButtonPosition, animationDuration).SetEase(Ease.OutCubic);
            button.DOScale(toggledButtonScale, animationDuration).SetEase(Ease.OutCubic);
        }
        else
        {
            // Disable Drums Camera
            drumsCam.enabled = false;

            // Animate Guitar Camera back to fullscreen
            DOTween.To(() => guitarRect.x, x => guitarRect.x = x, 0f, animationDuration).OnUpdate(() =>
            {
                refToGuitarMainCam.GetComponent<Camera>().rect = guitarRect;
            });

            // Animate the button back to its original position and scale
            button.DOAnchorPos3D(originalButtonPosition, animationDuration).SetEase(Ease.OutCubic);
            button.DOScale(originalButtonScale, animationDuration).SetEase(Ease.OutCubic);
        }
    }
}
