using UnityEditor;
using UnityEngine;
#if USING_BRP && UNITY_EDITOR
using UnityEngine.Rendering.PostProcessing;
#endif
// WFA 2.0
[ExecuteInEditMode]
public class ppManager : MonoBehaviour
{
#if USING_BRP && UNITY_EDITOR
    [HideInInspector]
    public PostProcessResources postProcessResources;
 
  void Awake()
  {
    if (!Application.isPlaying)
    {
      if (postProcessResources == null)
      {
        postProcessResources = (PostProcessResources)AssetDatabase.LoadAssetAtPath
          (
            assetPath: "Packages/com.unity.postprocessing/PostProcessing/PostProcessResources.asset",
            type: typeof(PostProcessResources)
          );
      }

      PostProcessLayer postProcessLayer = Camera.main.gameObject.GetComponent<PostProcessLayer>();
      postProcessLayer.Init(postProcessResources);
    }
  }
#endif
}