using System.Collections;
using UnityEngine;
using System.Collections.Generic;

[System.Serializable]
public class ScoreEntry
{
    public string initials;
    public int perfectHits;
    public int goodHits;
    public int missedHits;
    public int totalGems;
    public string time;
    public System.DateTime timestamp;

    public ScoreEntry(string initials, ScoreManagerScript score)
    {
        this.initials = initials;
        this.perfectHits = score.perfectTimeGems;
        this.goodHits = score.wellTimedGems;
        this.missedHits = score.missedGems;
        this.totalGems = score.totalGameGems;
        this.time = score.totalMissionTime;
        this.timestamp = System.DateTime.Now;
    }
}

public static class HighScoreManager
{
    private const string SaveKey = "HighScores";

    public static List<ScoreEntry> LoadScores()
    {
        return ES3.KeyExists(SaveKey) 
            ? ES3.Load<List<ScoreEntry>>(SaveKey) 
            : new List<ScoreEntry>();
    }

    public static void SaveScore(ScoreEntry newEntry)
    {
        var scores = LoadScores();
        scores.Add(newEntry);
        ES3.Save(SaveKey, scores);
    }

    public static void ClearScores()
    {
        ES3.DeleteKey(SaveKey);
    }
}
