using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class OnboardingSlideshow : MonoBehaviour
{
    [Header("Slides")]
    public Sprite[] slideImages;
    public Image imageComponent;
    public string sceneToLoadAfterLast = "NextSceneName"; // Set this in Inspector

    private int currentIndex = 0;

    void Start()
    {
        if (slideImages.Length > 0 && imageComponent != null)
        {
            imageComponent.sprite = slideImages[0];
        }
    }

    public void NextSlide()
    {
        currentIndex++;

        if (currentIndex < slideImages.Length)
        {
            imageComponent.sprite = slideImages[currentIndex];
        }
        else
        {
            SceneManager.LoadScene(sceneToLoadAfterLast);
        }
    }
}
