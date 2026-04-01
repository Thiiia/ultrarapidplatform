using UnityEngine;
using UnityEngine.EventSystems;

// Attach this to the CTA button that shows the popup/start flow.
// It forwards hover events so the title text can swap via StartScreenAnimator.
public class CtaHoverTitleSwap : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
	[SerializeField] private StartScreenAnimator startScreenAnimator;

	public void OnPointerEnter(PointerEventData eventData)
	{
		if (startScreenAnimator != null)
		{
			startScreenAnimator.HandleCtaHoverEnter();
		}
	}

	public void OnPointerExit(PointerEventData eventData)
	{
		if (startScreenAnimator != null)
		{
			startScreenAnimator.HandleCtaHoverExit();
		}
	}
}
