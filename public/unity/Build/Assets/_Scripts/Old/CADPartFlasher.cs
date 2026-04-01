using UnityEngine;
using DG.Tweening;
using System.Collections.Generic;

public class CADPartFlasher : MonoBehaviour
{
    private List<Material> materials = new List<Material>();
    private List<Color> originalColors = new List<Color>();
    private List<Color> originalEmissionColors = new List<Color>();

    [Header("Flash Settings")]
    public Color flashColor = Color.cyan;
    public float flashDuration = 0.25f;
    [Range(0f, 1f)] public float flashChance = 0.5f;
    public bool useEmission = true;

    void Start()
    {
        // Get all child renderers
        Renderer[] renderers = GetComponentsInChildren<Renderer>();

        foreach (Renderer rend in renderers)
        {
            // Create material instances
            Material mat = rend.material;
            materials.Add(mat);

            originalColors.Add(mat.GetColor("_BaseColor"));

            if (useEmission)
            {
                if (mat.HasProperty("_EmissionColor"))
                {
                    mat.EnableKeyword("_EMISSION");
                    originalEmissionColors.Add(mat.GetColor("_EmissionColor"));
                }
                else
                {
                    originalEmissionColors.Add(Color.black);
                }
            }
        }

        ChartSystem.OnBeat += TryFlash;
    }

    void OnDestroy()
    {
        ChartSystem.OnBeat -= TryFlash;
    }

    void TryFlash()
    {
        if (Random.value > flashChance) return;

        for (int i = 0; i < materials.Count; i++)
        {
            Material mat = materials[i];
            Color baseStart = mat.GetColor("_BaseColor");
            Color baseEnd = originalColors[i];

            // Flash base color
            Sequence seq = DOTween.Sequence();
            seq.Append(DOTween.To(() => baseStart, x => mat.SetColor("_BaseColor", x), flashColor, flashDuration / 2f));
            seq.Append(DOTween.To(() => flashColor, x => mat.SetColor("_BaseColor", x), baseEnd, flashDuration / 2f));

            // Optional: Flash emission too
            if (useEmission)
            {
                if (mat.HasProperty("_EmissionColor"))
                {
                    Color emissStart = mat.GetColor("_EmissionColor");
                    Color emissEnd = originalEmissionColors[i];
                    seq.Join(DOTween.To(() => emissStart, x => mat.SetColor("_EmissionColor", x), flashColor * 2f, flashDuration / 2f));
                    seq.Append(DOTween.To(() => flashColor * 2f, x => mat.SetColor("_EmissionColor", x), emissEnd, flashDuration / 2f));
                }
            }
        }
    }
}
