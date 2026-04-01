using UnityEngine;
using Febucci.UI.Core;
using Febucci.UI;
using Febucci.UI.Effects;

[CreateAssetMenu(fileName = "LaneGlowEffect", menuName = "Text Animator/Custom/LaneGlowEffect")]
public class LaneGlowEffect : BehaviorScriptableBase
{
    public Gradient glowGradient;
    public float cycleSpeed = 2f;

    private static readonly int OutlineColorID = Shader.PropertyToID("_OutlineColor");
    private static readonly int UnderlayColorID = Shader.PropertyToID("_UnderlayColor");

    public override void ApplyEffectTo(ref CharacterData character, TAnimCore animator)
{
    float t = Mathf.PingPong(Time.time * cycleSpeed + character.index * 0.15f, 1f);
    Color glow = glowGradient.Evaluate(t);

    // Get TMP component directly from GameObject
    var tmp = animator.gameObject.GetComponent<TMPro.TextMeshProUGUI>();
    if (tmp == null) return;

    // Clone font material if not already instanced
    if (!tmp.fontMaterial.name.Contains("(Instance)"))
        tmp.fontMaterial = new Material(tmp.fontMaterial);

    // Set shader properties (if they exist)
    var mat = tmp.fontMaterial;

    if (mat.HasProperty("_OutlineColor"))
        mat.SetColor("_OutlineColor", glow);

    if (mat.HasProperty("_UnderlayColor"))
        mat.SetColor("_UnderlayColor", glow);

    // Optional: modulate the outline width
    if (mat.HasProperty("_OutlineWidth"))
        mat.SetFloat("_OutlineWidth", 0.15f + 0.1f * Mathf.Sin(t * 3f));
}

    public override void ResetContext(TAnimCore animator) { }
    public override void SetModifier(ModifierInfo modifier) { }
    public override float GetMaxDuration() => -1f;
    public override bool CanApplyEffectTo(CharacterData character, TAnimCore animator) => true;
}
