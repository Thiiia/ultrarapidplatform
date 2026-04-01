using UnityEngine;
using TMPro;
using System.Collections.Generic;
using UnityEngine.UI;
using System.Collections;

public class HighScoreUI : MonoBehaviour
{
    public TextMeshProUGUI missionTimeText;
    public TextMeshProUGUI totalGemsText;
    public TextMeshProUGUI perfectGemsText;
    public TextMeshProUGUI wellTimedGemsText;
    public TextMeshProUGUI missedGemsText;

    public Transform scoreListParent;
    public GameObject scoreEntryPrefab;
    public InitialsInputUI initialsInput;

    void Start()
    {
        StartCoroutine(DelayedShowInitialsInput());

        // Display current run's stats
        missionTimeText.text = $"Total Mission Time: {ScoreManagerScript.Instance.totalMissionTime}";
        totalGemsText.text = $"Total Game Gems: {ScoreManagerScript.Instance.totalGameGems}";
        perfectGemsText.text = $"Perfect-Time Gems: {ScoreManagerScript.Instance.perfectTimeGems}";
        wellTimedGemsText.text = $"Well-Timed Gems: {ScoreManagerScript.Instance.wellTimedGems}";
        missedGemsText.text = $"Missed Gems: {ScoreManagerScript.Instance.missedGems}";

        ShowAllScores();
    }

    IEnumerator DelayedShowInitialsInput()
    {
        yield return null; // wait 1 frame
        initialsInput.Show();
    }

    private void ShowAllScores()
    {
        List<ScoreEntry> allScores = HighScoreManager.LoadScores();
        allScores.Sort((a, b) => b.totalGems.CompareTo(a.totalGems)); // descending

        foreach (var entry in allScores)
        {
            GameObject row = Instantiate(scoreEntryPrefab, scoreListParent);
            row.GetComponentInChildren<TextMeshProUGUI>().text =
                $"{entry.initials} | {entry.totalGems} Gems | P:{entry.perfectHits} G:{entry.goodHits} M:{entry.missedHits}";
        }
    }

    public void ReturnToMainMenu()
    {
        UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
    }
}
