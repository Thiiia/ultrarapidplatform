using UnityEngine;
using TMPro;

public class LaneGlyphView : MonoBehaviour
{
    [Header("World-space glyphs")]
    [SerializeField] private TMP_Text labelWS;          //  3D TMP child
    [SerializeField] private SpriteRenderer iconWS;     //  SpriteRenderer child
    [SerializeField] private KeyCodeSpriteDictionary spriteMap; // same dictionary the UI uses
    [SerializeField] private Vector2 iconTargetSize = new Vector2(0.55f, 0.55f);

    // call me after a rebind; I’ll handle world-space visuals like a champ
    public void ApplyKey(KeyCode key)
    {
        string txt = KeyToText(key);

        if (!string.IsNullOrEmpty(txt))
        {
            if (labelWS != null) labelWS.text = txt;
            if (iconWS != null) { iconWS.sprite = null; iconWS.enabled = false; }
        }
        else
        {
            Sprite s = null;
            if (spriteMap != null)
            {
                var dict = spriteMap.ToDictionary();
                dict.TryGetValue(key, out s);
            }

            if (iconWS != null) { iconWS.sprite = s; iconWS.enabled = (s != null); FitIconToTarget(s);}
            if (labelWS != null) labelWS.text = string.Empty;
        }
    }

    private static string KeyToText(KeyCode key)
    {
        if (key >= KeyCode.A && key <= KeyCode.Z) return key.ToString();
        if (key >= KeyCode.Alpha0 && key <= KeyCode.Alpha9) return ((int)key - (int)KeyCode.Alpha0).ToString();
        if (key >= KeyCode.Keypad0 && key <= KeyCode.Keypad9) return ((int)key - (int)KeyCode.Keypad0).ToString();
        return string.Empty; // if we got here, you probably want an icon
    }
    private void FitIconToTarget(Sprite s)
{
    if (iconWS == null || s == null) return;

    // Sprite bounds are already in world units for a SpriteRenderer
    var sz = s.bounds.size;
    if (sz.x <= 0 || sz.y <= 0) return;

    float sx = iconTargetSize.x / sz.x;
    float sy = iconTargetSize.y / sz.y;
    iconWS.transform.localScale = new Vector3(sx, sy, 1f);
}
}
