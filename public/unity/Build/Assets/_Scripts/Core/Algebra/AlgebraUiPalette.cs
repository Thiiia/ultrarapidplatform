using UnityEngine;

/// <summary>
/// Shared algebra UI palette (Figma-aligned). Centralizing these removes repeated magic literals
/// across the drag flow, feedback chips, and locked/reference equation UI.
/// </summary>
public static class AlgebraUiPalette
{
	public static readonly Color BgDark = new Color32(25, 25, 25, 255);              // #191919
	public static readonly Color White = Color.white;
	public static readonly Color White50 = new Color(1f, 1f, 1f, 0.5f);

	public static readonly Color AccentPurple = new Color32(111, 0, 246, 255);        // #6F00F6
	public static readonly Color JudgementRed = new Color32(255, 71, 71, 255);        // #FF4747
	public static readonly Color JudgementYellow = new Color32(255, 221, 0, 255);     // #FFDD00
	public static readonly Color JudgementGreen = new Color32(0, 255, 87, 255);       // #00FF57

	public static readonly Color TrackGray = new Color32(76, 76, 76, 255);            // #4C4C4C
	public static readonly Color MidGray = new Color32(128, 128, 128, 255);

	public static Color WithAlpha(Color color, float alpha)
	{
		return new Color(color.r, color.g, color.b, alpha);
	}
}
