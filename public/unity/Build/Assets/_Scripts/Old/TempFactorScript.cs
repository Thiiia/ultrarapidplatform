using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using TMPro;
using DG.Tweening;

#if UNITY_WEBGL
using System.Runtime.InteropServices;
#endif

public class TempFactorScript : MonoBehaviour
{
    public GameObject[] RefToFactorBlocks;
    public GameObject RootFactorBlock;

    private Dictionary<GameObject, bool> factorCompletion = new Dictionary<GameObject, bool>();

    #if UNITY_WEBGL
    [DllImport("__Internal")]
    private static extern void SaveWebGLPrefs();
    #endif
    

    void Start()
    {
        bool isNewSession = !PlayerPrefs.HasKey("SessionStarted");

        #if UNITY_EDITOR
        // [Note] Ensure a fresh reset when entering Play Mode
        if (!UnityEditor.EditorPrefs.HasKey("SessionStarted"))
        {
            isNewSession = true;
            UnityEditor.EditorPrefs.SetInt("SessionStarted", 1); // Mark session as started in Editor
        }
        #endif

        // [Note] If this is a brand-new game session, reset everything
        if (isNewSession)
        {
            Debug.Log("New session detected! Resetting factor progression.");
            FactorDataManagerScript.ResetAllFactorData();
            PlayerPrefs.SetInt("SessionStarted", 1);
            PlayerPrefs.Save();
        }

        // 🔹 Hide all factor blocks initially
        foreach (var block in RefToFactorBlocks)
        {
            block.SetActive(false);
            factorCompletion[block] = false; // Mark everything as locked initially
        }

        // [Note] Ensure Root Factor is always visible
        RootFactorBlock.SetActive(true);
        factorCompletion[RootFactorBlock] = true;

        if (isNewSession)
        {
            // [Note] Ensure only the first three blocks are visible on a new session
            EnableFactorBlock(0);
            EnableFactorBlock(5);
        }
        else
        {
            // [Note] Restore previously unlocked factors from PlayerPrefs on scene reload
            RestoreUnlockedFactors();
        }
    }

    void RestoreUnlockedFactors()
    {
        Debug.Log("Restoring unlocked factors from PlayerPrefs...");
        for (int i = 0; i < RefToFactorBlocks.Length; i++)
        {
            string name = RefToFactorBlocks[i].name;
            if (FactorDataManagerScript.IsUnlocked(name))
            {
                Debug.Log($"Restoring: {name}");
                EnableFactorBlock(i);
            }
        }
    }

    public void UnlockNextFactors(GameObject completedFactor)
    {
        Debug.Log($"UnlockNextFactors called for: {completedFactor.name}");

        if (!factorCompletion.ContainsKey(completedFactor))
        {
            Debug.LogWarning($"Factor {completedFactor.name} not found in dictionary.");
            return;
        }

        // [Note] Mark factor as completed
        factorCompletion[completedFactor] = true;
        FactorDataManagerScript.SetUnlocked(completedFactor.name, true);
        PlayerPrefs.Save();

        // 🔹 Unlock next set of factors based on tree logic
        if (IsFactorCompleted(0) && IsFactorCompleted(5))
        {
            EnableFactorBlock(1);
            EnableFactorBlock(2);
            EnableFactorBlock(3);
            EnableFactorBlock(4);
        }

        if (IsFactorCompleted(1) && IsFactorCompleted(2) &&
            IsFactorCompleted(3) && IsFactorCompleted(4))
        {
            EnableFactorBlock(6);
            EnableFactorBlock(7);
        }
    }

    private bool IsFactorCompleted(int index)
    {
        if (index < 0 || index >= RefToFactorBlocks.Length) return false;
        return factorCompletion.ContainsKey(RefToFactorBlocks[index]) && factorCompletion[RefToFactorBlocks[index]];
    }

    private void EnableFactorBlock(int index)
    {
        if (index < 0 || index >= RefToFactorBlocks.Length)
        {
            Debug.LogError($"Index {index} is out of bounds in RefToFactorBlocks array.");
            return;
        }

        GameObject factorBlock = RefToFactorBlocks[index];

        // [Note] Ensure factor isn't already unlocked
        if (!FactorDataManagerScript.IsUnlocked(factorBlock.name))
        {
            FactorDataManagerScript.SetUnlocked(factorBlock.name, true);
            PlayerPrefs.Save();
        }

        factorBlock.SetActive(true);
        Debug.Log($"Enabled {factorBlock.name}");

        // Update the text inside the factor block
        TextMeshProUGUI factorText = factorBlock.GetComponentInChildren<TextMeshProUGUI>();
        if (factorText != null)
        {
            factorText.alpha = 1f;
            factorText.DOFade(1f, 0.5f).SetEase(Ease.InOutQuad);
            Debug.Log($"Updated text for {factorBlock.name}");
        }
    }
    public void ResetForReplay()
{
    Debug.Log("[TempFactorScript] Resetting factor tree for replay!");

    // Hide all blocks except Root
    foreach (var block in RefToFactorBlocks)
    {
        if (block == null) continue;
        block.SetActive(false);
    }

    RootFactorBlock.SetActive(true);

    // Reset dictionary manually
    factorCompletion.Clear();
    factorCompletion[RootFactorBlock] = true;

    // Re-unlock initial factors
    EnableFactorBlock(0);
    EnableFactorBlock(5);
}


  void OnApplicationQuit()
{
    Debug.Log("Application quitting - saving preferences!");

    #if UNITY_EDITOR
    UnityEditor.EditorPrefs.DeleteKey("SessionStarted");
    #endif

    #if UNITY_WEBGL && !UNITY_EDITOR
    PlayerPrefs.Save();
    SaveWebGLPrefs(); 
    #endif
}

}


