using UnityEngine;

public class LoadScene : MonoBehaviour
{
	public void Load(string sceneName)
	{
		if (!string.IsNullOrEmpty(sceneName))
		{
			UnityEngine.SceneManagement.SceneManager.LoadScene(sceneName);
		}
	}
}
