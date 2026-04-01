using UnityEngine;
using TMPro;
using UnityEngine.EventSystems;

public class HoverTextChange : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    public TextMeshProUGUI buttonText;
    public string defaultText = "Ready to Play?";
    public string hoverText = "I'm Ready";

    private bool hasClicked = false;

    public void OnPointerEnter(PointerEventData eventData)
    {
        if (buttonText != null && !hasClicked)
            buttonText.text = hoverText;
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        if (buttonText != null && !hasClicked)
            buttonText.text = defaultText;
    }

    public void OnClick()
    {
        hasClicked = true;
        if (buttonText != null)
            buttonText.text = hoverText;
    }
}
