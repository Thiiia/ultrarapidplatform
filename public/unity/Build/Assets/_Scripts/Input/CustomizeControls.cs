using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

public class CustomizeControls : MonoBehaviour
{
    // ---------------- Public API ----------------
    public static bool PanelVisible { get; private set; }

    [Header("References")]
    [SerializeField] private XplorerGuitarInput guitarInput;

    [Tooltip("UI buttons the player clicks to start rebinding (order must match lanes).")]
    [SerializeField] private List<Button> controlButtons = new List<Button>();

    [Tooltip("Images shown on each button (usually the same order as controlButtons).")]
    [SerializeField] private List<Image> controlButtonImages = new List<Image>();

    [Tooltip("Lookup for KeyCode -> Sprite (e.g., icons for arrows, space, controller).")]
    [SerializeField] private KeyCodeSpriteDictionary keyCodeSpriteDictionary;

    [Tooltip("Fallback sprite used when no icon is found for the key.")]
    [SerializeField] private Sprite defaultSprite;

    [Tooltip("Optional: world-space lane glyphs to mirror the binding visually.")]
    [SerializeField] private List<LaneGlyphView> worldGlyphViews = new List<LaneGlyphView>();

    // ---------------- Private State ----------------
    private PlayerControls inputActions;
    private Dictionary<Button, int> buttonToIndex = new Dictionary<Button, int>();
    private Dictionary<KeyCode, Sprite> spriteMap;

    private Button listeningButton = null;
    private int listeningIndex = -1;
    private bool isArmed = false; // whether we're listening for controller input

    // ---------------- Unity Lifecycle ----------------
    private void Awake()
    {
        inputActions = new PlayerControls();
        spriteMap = keyCodeSpriteDictionary != null
            ? keyCodeSpriteDictionary.ToDictionary()
            : new Dictionary<KeyCode, Sprite>();
    }

    private void Start()
    {
        InitializeButtons();
        SyncAllVisualsFromModel();
    }

    private void OnDestroy()
    {
        // Safe cleanup of input actions
        if (inputActions != null)
        {
            try { inputActions.Gameplay.ButtonPress.performed -= OnControllerButtonClicked; } catch { /* ignore */ }
            inputActions.Gameplay.Disable();
            inputActions.Dispose();
            inputActions = null;
        }
    }

    private void OnGUI()
    {
        // Only capture local keyboard while a button is waiting for a key
        if (!PanelVisible || listeningButton == null) return;
        var e = Event.current;
        if (e == null || !e.isKey || e.type != EventType.KeyDown) return;

        if (!IsListeningIndexValid()) { CancelListening(); return; }

        var prevKey = guitarInput.keyCodes[listeningIndex];
        var newKey = e.keyCode;

        // ESC cancels
        if (newKey == KeyCode.Escape) { CancelListening(); e.Use(); return; }

        ApplyKey(listeningIndex, newKey, prevKey);
        e.Use();
    }

    // ---------------- UI Wiring ----------------
    private void InitializeButtons()
    {
        buttonToIndex.Clear();

        for (int i = 0; i < controlButtons.Count; i++)
        {
            var btn = controlButtons[i];
            if (!btn) continue;

            int capturedIndex = i; // capture for closure
            buttonToIndex[btn] = capturedIndex;
            btn.onClick.AddListener(() => OnControlButtonClicked(btn));
        }
    }

    // Player clicked a rebind button
    public void OnControlButtonClicked(Button button)
    {
        if (!guitarInput || guitarInput.keyCodes == null || guitarInput.keyCodes.Count == 0) return;

        listeningButton = button;
        listeningIndex = buttonToIndex.TryGetValue(button, out var idx) ? idx : -1;

        if (!IsListeningIndexValid()) { CancelListening(); return; }

        ToggleNonSelectedButtons(false, listeningIndex);
    }

    // Controller button pressed while rebinding
    private void OnControllerButtonClicked(InputAction.CallbackContext context)
    {
        if (listeningButton == null || !IsListeningIndexValid()) return;

        // Map a few common gamepad controls to KeyCode
        KeyCode newKey;
        switch (context.control.name)
        {
            case "buttonSouth":   newKey = KeyCode.JoystickButton0; break;
            case "buttonEast":    newKey = KeyCode.JoystickButton1; break;
            case "buttonWest":    newKey = KeyCode.JoystickButton2; break;
            case "buttonNorth":   newKey = KeyCode.JoystickButton3; break;
            case "leftShoulder":  newKey = KeyCode.JoystickButton4; break;
            case "rightShoulder": newKey = KeyCode.JoystickButton5; break;
            default:
                Debug.LogWarning("Unhandled controller button: " + context.control.name);
                return;
        }

        var prevKey = guitarInput.keyCodes[listeningIndex];
        ApplyKey(listeningIndex, newKey, prevKey);
    }

    // ---------------- Public Controls ----------------
    /// <summary>
    /// Shows/hides the rebind panel and arms disarming controller listening accordingly.
    /// </summary>
    public void SetVisible(bool on)
    {
        gameObject.SetActive(on);
        PanelVisible = on;

        if (on && !isArmed)
        {
            inputActions.Gameplay.Enable();
            inputActions.Gameplay.ButtonPress.performed += OnControllerButtonClicked;
            isArmed = true;
        }
        else if (!on && isArmed)
        {
            inputActions.Gameplay.ButtonPress.performed -= OnControllerButtonClicked;
            inputActions.Gameplay.Disable();
            isArmed = false;
        }

        // Reset any in-progress listen
        CancelListening();
        ToggleNonSelectedButtons(true, -1);
    }

    /// <summary>
    /// Convenience toggle for a single “Customize” button in your UI.
    /// </summary>
    public void ToggleControls()
    {
        SetVisible(!PanelVisible);
    }

    // ---------------- Core Binding Logic ----------------
    private void ApplyKey(int index, KeyCode newKey, KeyCode prevKey)
    {
        if (!IsListeningIndexValid()) { CancelListening(); return; }

        // Prevent duplicate assignments (unless it's the same slot)
        if (IsKeyInUse(newKey, ignoreIndex: index))
        {
            // Just cancel and restore interactivity
            CancelListening();
            return;
        }

        guitarInput.keyCodes[index] = newKey;

        // Update UI + world-space mirrors
        RefreshButtonVisual(index, newKey);
        if (index >= 0 && index < worldGlyphViews.Count && worldGlyphViews[index] != null)
            worldGlyphViews[index].ApplyKey(newKey);

        // Done listening
        CancelListening();
    }

    private bool IsKeyInUse(KeyCode key, int ignoreIndex = -1)
    {
        if (!guitarInput || guitarInput.keyCodes == null) return false;
        for (int i = 0; i < guitarInput.keyCodes.Count; i++)
        {
            if (i == ignoreIndex) continue;
            if (guitarInput.keyCodes[i] == key) return true;
        }
        return false;
    }

    private void CancelListening()
    {
        ToggleNonSelectedButtons(true, listeningIndex);
        listeningButton = null;
        listeningIndex = -1;
    }

    private bool IsListeningIndexValid()
    {
        return guitarInput
               && guitarInput.keyCodes != null
               && listeningIndex >= 0
               && listeningIndex < guitarInput.keyCodes.Count;
    }

    private void ToggleNonSelectedButtons(bool enable, int selectedIndex)
    {
        for (int i = 0; i < controlButtons.Count; i++)
        {
            var btn = controlButtons[i];
            if (!btn) continue;
            btn.interactable = enable || i == selectedIndex;
        }
    }

    // ---------------- Visuals ----------------
    private void SyncAllVisualsFromModel()
    {
        if (!guitarInput || guitarInput.keyCodes == null) return;

        for (int i = 0; i < guitarInput.keyCodes.Count && i < controlButtons.Count; i++)
        {
            var key = guitarInput.keyCodes[i];
            RefreshButtonVisual(i, key);

            if (i < worldGlyphViews.Count && worldGlyphViews[i] != null)
                worldGlyphViews[i].ApplyKey(key);
        }
    }

    private void RefreshButtonVisual(int index, KeyCode key)
    {
        if (index < 0 || index >= controlButtonImages.Count) return;
        var img = controlButtonImages[index];
        if (!img) return;

        if (spriteMap != null && spriteMap.TryGetValue(key, out var sprite) && sprite != null)
        {
            img.sprite = sprite;
            img.enabled = true;
        }
        else
        {
            img.sprite = defaultSprite;
            img.enabled = defaultSprite != null;
        }
    }
}
