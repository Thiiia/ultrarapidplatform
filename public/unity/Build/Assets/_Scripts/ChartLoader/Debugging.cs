using UnityEngine;

public class Debugging : MonoBehaviour
{
	[SerializeField] private bool showOverlay;
	[SerializeField] private bool demoModeOnly = true;

	private void OnGUI()
	{
		if (!showOverlay)
			return;
		if (demoModeOnly && !AlgebraRuntimeConfig.IsDemoMode)
			return;
		if (ChartSystem.Chart == null)
			return;

		GUI.color = Color.white;
		GUI.Label(new Rect(0, 0, Screen.width, Screen.height), ChartSystem.Chart.ToString());
	}
}
