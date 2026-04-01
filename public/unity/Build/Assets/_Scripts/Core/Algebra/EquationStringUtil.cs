using UnityEngine;

public static class EquationStringUtil
{
	/// <summary>
	/// Normalizes equation strings for parsers/tokenizers:
	/// - trims whitespace/newlines
	/// - removes spaces/tabs/CR/LF
	/// - normalizes common unicode math glyphs to ASCII equivalents
	/// </summary>
	public static string NormalizeForParsing(string equation)
	{
		if (string.IsNullOrWhiteSpace(equation))
		{
			return string.Empty;
		}

		string cleaned = equation.Trim();

		// Remove common whitespace characters that can sneak into ScriptableObject TextArea fields.
		cleaned = cleaned
			.Replace(" ", "")
			.Replace("\t", "")
			.Replace("\r", "")
			.Replace("\n", "");

		// Normalize math symbols (keeps the equation readable in UI but stable for parsing).
		cleaned = cleaned
			.Replace('\u2212', '-') // minus
			.Replace('\u2013', '-') // en-dash
			.Replace('\u2014', '-') // em-dash
			.Replace('\uFF0B', '+') // fullwidth plus
			.Replace('\u00D7', 'x') // multiplication sign
			.Replace('\u00F7', '/'); // division sign

		return cleaned;
	}
}

