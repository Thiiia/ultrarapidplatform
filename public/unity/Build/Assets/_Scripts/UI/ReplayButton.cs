using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class ReplayButton : MonoBehaviour
{
    public bool timeToReplay;
    // Start is called before the first frame update
    void Start()
    {
        timeToReplay = false;
    }

    // Update is called once per frame
    void Update()
    {

    }
    public void ClickToReplay()
{
    timeToReplay = true;
    ReplayBootstrapper.Instance?.TriggerReplay();
    SceneManager.LoadScene("Slideshow");
}

}
