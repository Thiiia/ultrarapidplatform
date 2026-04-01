using UnityEngine;
// WFA 2.0
namespace WFA
{
  [ExecuteInEditMode]
  public class renderScale : MonoBehaviour
  {
    private float dpi = 1f;
    private Camera Camera0;
    private RenderTexture RenderTexture0;
    private Material Material0;

    public FilterMode filterMode
    {
      get => WebGLFPSAccelerator.mainData.filterMode;
      set => WebGLFPSAccelerator.mainData.filterMode = value;
    }

    void Awake()
    {
      if (Material0 == null)
        Material0 = Instantiate(Resources.Load<Material>("wfaUnlit"));

      Camera0 = GetComponent<Camera>();
    }

    public void resetDPI()
    {
      dpi = 1;
      Camera0.rect = new Rect(0, 0, 1, 1);
    }

    public void setDPI(float DPI, FilterMode filterMode)
    {
      dpi = DPI;
      this.filterMode = filterMode;
    }

    public void setDPI(float DPI)
    {
      dpi = DPI;
    }

    private void OnRenderImage(RenderTexture src, RenderTexture dst)
    {
      src.filterMode = filterMode;
      Camera0.rect = new Rect(0, 0, 1, 1);
      Graphics.Blit(src, RenderTexture0, Material0);
      Camera0.rect = new Rect(0, 0, dpi, dpi);
    }
  }
}