using UnityEngine;
using UnityEngine.UI;
// WFA 2.0
namespace WFA
{
  [RequireComponent(typeof(Text))]
  public class FPSCounter : MonoBehaviour
  {
    public float fpsMeasurePeriod = 5f;
    private float fpsAccumulator = 0;
    private float fpsNextPeriod = 0;
    private float currentFps;
    private Text Text;
    public string title;

    private void Start()
    {
      Text = GetComponent<Text>();
      fpsNextPeriod = Time.realtimeSinceStartup + fpsMeasurePeriod;
    }

    private void Update()
    {
      fpsAccumulator++;

      if (Time.realtimeSinceStartup > fpsNextPeriod)
      {
        currentFps = fpsAccumulator / fpsMeasurePeriod;
        fpsAccumulator = 0;
        fpsNextPeriod = Time.realtimeSinceStartup + fpsMeasurePeriod;
        string string0 = Text.text.Contains(":") ? ";" : ":";
        Text.text = title + string0 + " " + ((int)currentFps).ToString();
      }
    }
  }
}