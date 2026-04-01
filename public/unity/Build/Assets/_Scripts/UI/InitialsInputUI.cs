using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

public class InitialsInputUI : MonoBehaviour
{
    public GameObject panel;
    public TMP_InputField initialsInput;
    public Button submitButton;

    private void Awake()
    {
        panel.SetActive(false);
        submitButton.onClick.AddListener(SubmitInitials);
    }

    public void Show()
    {
        Debug.Log("Testing Input");
        panel.SetActive(true);
        initialsInput.text = "";
        initialsInput.ActivateInputField();
    }

    private void SubmitInitials()
    {
        string initials = initialsInput.text.ToUpper().Trim();
        if (initials.Length != 3) return;

        ScoreEntry entry = new ScoreEntry(initials, ScoreManagerScript.Instance);
        HighScoreManager.SaveScore(entry);
        panel.SetActive(false);

    }
}
