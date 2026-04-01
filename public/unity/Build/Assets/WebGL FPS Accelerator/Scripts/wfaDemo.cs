using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Rendering;
using System.Runtime.InteropServices;
using UnityEditor;
// WFA 2.0
namespace WFA
{
  public class wfaDemo : MonoBehaviour
  {
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    public static extern bool isAndroid2();

    [DllImport("__Internal")]
    public static extern bool isiOS2();
#endif

    [HideInInspector]
    public GameObject warningText;

    [HideInInspector]
    public GameObject requiredSettings;

    [HideInInspector]
    public GameObject postProcessVolume;

    private float shadowDistanceTemp;

    [HideInInspector]
    public bool isiOS;
    [HideInInspector]
    public bool isAndroid;

    private int vp;

    void Start()
    {
#if UNITY_2020_1_OR_NEWER && USING_URP
      VolumeProfile VolumeProfile1 = Resources.Load<VolumeProfile>("URP Volume Profile 2");
      postProcessVolume.GetComponent<Volume>().profile = VolumeProfile1;
      vp = 1;
#endif

#if UNITY_WEBGL && !UNITY_EDITOR
      isiOS = isiOS2();
      isAndroid = isAndroid2();

      if (isiOS || isAndroid)
      {
        RectTransform rt = WFA.utilities.runtimeInspector.panel.GetComponent<RectTransform>();
        rt.localScale = new Vector3(1.6f, 1.6f, 1);
      }
#endif

#if UNITY_EDITOR
      EditorApplication.playModeStateChanged += playModeStateChanged;
#endif

      QualitySettings.shadowDistance = 300f;

#if USING_URP
      var rpAsset = UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline;
      var urpAsset = (UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset)rpAsset;

      shadowDistanceTemp = urpAsset.shadowDistance;
      urpAsset.shadowDistance = 200f;
#endif

      m0();
    }

#if USING_URP
    public void changeVolumeProfile()
    {
      if (vp == 0)
      {
        VolumeProfile VolumeProfile1 = Resources.Load<VolumeProfile>("URP Volume Profile 2");
        postProcessVolume.GetComponent<Volume>().profile = VolumeProfile1;
        vp = 1;
      }
      else
      {
        VolumeProfile VolumeProfile1 = Resources.Load<VolumeProfile>("URP Volume Profile");
        postProcessVolume.GetComponent<Volume>().profile = VolumeProfile1;
        vp = 0;
      }
    }
#endif

#if UNITY_EDITOR
    public void playModeStateChanged(PlayModeStateChange state)
    {
      if (state == PlayModeStateChange.ExitingPlayMode)
      {
#if USING_URP
        var rpAsset = UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline;
        var urpAsset = (UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset)rpAsset;

        urpAsset.shadowDistance = shadowDistanceTemp;
#endif
      }
    }
#endif

    public void m0()
    {
#if UNITY_EDITOR
      if (warningText)
        warningText.SetActive(true);
#endif

      if (requiredSettings)
      {
#if !UNITY_EDITOR
        requiredSettings.SetActive(false);
#endif
      }
    }
  }
}