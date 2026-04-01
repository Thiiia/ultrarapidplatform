using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;
using UnityEngine;
using UnityEngine.SceneManagement;


public class ExitGameplay : MonoBehaviour
{
    public void ExitGameplayFromTutorial()
    {
#if WEBGL || UNITY_EDITOR
		Debug.Log("Exiting to main menu from tutorial (WebGL).");
		SceneManager.LoadScene("Start Scene");
#elif UNITY_STANDALONE_WIN || WINDOWS
		Debug.Log("Exiting application from tutorial (Windows).");
		Application.Quit();
#endif
    }
}
