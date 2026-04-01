using UnityEngine;
using System.Collections.Generic;
using ES3Types;
using ES3Internal;

public static class FactorDataManagerScript
{
    private const string saveKey = "FactorData";

    [System.Serializable]
    public class FactorSaveData
    {
        public bool unlocked;
        public bool full;
    }

    private static Dictionary<string, FactorSaveData> _cache = new Dictionary<string, FactorSaveData>();

    public static void SetUnlocked(string factorName, bool unlocked)
    {
        EnsureFactorExists(factorName);
        _cache[factorName].unlocked = unlocked;
        Save();
    }

    public static void SetFull(string factorName, bool full)
    {
        EnsureFactorExists(factorName);
        _cache[factorName].full = full;
        Save();
    }

    public static bool IsUnlocked(string factorName)
    {
        Load(); // Ensure cache is populated
        return _cache.ContainsKey(factorName) && _cache[factorName].unlocked;
    }

    public static bool IsFull(string factorName)
    {
        Load(); // Ensure cache is populated
        return _cache.ContainsKey(factorName) && _cache[factorName].full;
    }

    public static void ResetAllFactorData()
    {
        _cache.Clear();

        // Set only initial factors
        SetUnlocked("120", true);
        SetUnlocked("0", true);
        SetUnlocked("5", true);

        Save();
        Debug.Log("Factor progression reset (ES3 version).");
    }

    private static void EnsureFactorExists(string factorName)
    {
        if (!_cache.ContainsKey(factorName))
        {
            _cache[factorName] = new FactorSaveData();
        }
    }

    private static void Save()
    {
        ES3.Save(saveKey, _cache);
    }

    private static void Load()
    {
        if (_cache.Count == 0 && ES3.KeyExists(saveKey))
        {
            _cache = ES3.Load<Dictionary<string, FactorSaveData>>(saveKey);
        }
    }
}
