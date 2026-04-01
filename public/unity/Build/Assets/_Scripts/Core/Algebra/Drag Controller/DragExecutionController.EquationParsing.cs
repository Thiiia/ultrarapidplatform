using System;
using System.Collections.Generic;

using UnityEngine;

public partial class DragExecutionController
{
	private struct TokenInfo
	{
		public string text;
		public bool isOperator;
		public int numericValue;
		public bool isVariable;      // True for standalone "x"
		public bool isCoefficient;   // True for the "5" in "5x"
	}

	private static bool IsVariableGlyphToken(TokenInfo token)
	{
		return token.isVariable || (token.isCoefficient && string.Equals((token.text ?? string.Empty).Trim(), "x", StringComparison.OrdinalIgnoreCase));
	}

	private static string GetDisplayTokenText(TokenInfo token)
	{
		if (IsVariableGlyphToken(token))
		{
			return "X";
		}

		return token.text;
	}

	private List<TokenInfo> TokenizeEquation(string equation)
	{
		List<TokenInfo> tokens = new List<TokenInfo>();

		equation = equation.Replace(" ", "");
		// Normalize common unicode math symbols to ASCII so parsing is stable.
		equation = equation
			.Replace('\u2212', '-') // minus
			.Replace('\u2013', '-') // en-dash
			.Replace('\u2014', '-') // em-dash
			.Replace('\uFF0B', '+') // fullwidth plus
			.Replace('\u00D7', 'x') // multiplication sign
			.Replace('\u00F7', '/'); // division sign

		string current = "";

		for (int i = 0; i < equation.Length; i++)
		{
			char c = equation[i];

			if (c == '=' || c == '+')
			{
				if (!string.IsNullOrEmpty(current))
				{
					AddTokensFromTerm(tokens, current);
					current = "";
				}
				tokens.Add(new TokenInfo { text = c.ToString(), isOperator = true, numericValue = 0 });
			}
			else if (c == '-')
			{
				if (current.Length > 0 || (tokens.Count > 0 && !tokens[tokens.Count - 1].isOperator))
				{
					if (!string.IsNullOrEmpty(current))
					{
						AddTokensFromTerm(tokens, current);
						current = "";
					}
					tokens.Add(new TokenInfo { text = "-", isOperator = true, numericValue = 0 });
				}
				else
				{
					current += c;
				}
			}
			else
			{
				current += c;
			}
		}

		if (!string.IsNullOrEmpty(current))
		{
			AddTokensFromTerm(tokens, current);
		}

		return tokens;
	}

	// Splits "5x" into coefficient "5" and variable "x"
	private void AddTokensFromTerm(List<TokenInfo> tokens, string term)
	{
		bool hasX = term.ToLower().Contains("x");

		if (!hasX)
		{
			// Pure constant: "2", "17", "-3"
			if (!int.TryParse(term, out int val))
			{
				tokens.Add(new TokenInfo { text = term, numericValue = 0 });
				return;
			}

			if (val < 0)
			{
				// Always render the sign as an operator label, and keep digits-only inside bubbles.
				tokens.Add(new TokenInfo { text = "-", isOperator = true, numericValue = 0 });
				tokens.Add(new TokenInfo { text = Mathf.Abs(val).ToString(), numericValue = val });
				return;
			}

			tokens.Add(new TokenInfo { text = val.ToString(), numericValue = val });
			return;
		}

		int xIndex = term.ToLower().IndexOf('x');

		if (xIndex == 0)
		{
			// Just "x" - no coefficient, variable is not draggable alone
			tokens.Add(new TokenInfo { text = "x", numericValue = 1, isVariable = true });
		}
		else if (xIndex == 1 && term[0] == '-')
		{
			// "-x" = -1 * x (render as a single draggable "x" bubble, plus a leading '-' operator label)
			tokens.Add(new TokenInfo { text = "-", isOperator = true, numericValue = 0 });
			tokens.Add(new TokenInfo { text = "x", numericValue = -1, isCoefficient = true });
		}
		else
		{
			// "5x", "-3x" etc - split into coefficient + x
			string coefStr = term.Substring(0, xIndex);
			if (int.TryParse(coefStr, out int coef))
			{
				if (coef < 0)
				{
					// Special case: "-1x" should look like "-x" (no visible 1 bubble).
					if (coef == -1)
					{
						tokens.Add(new TokenInfo { text = "-", isOperator = true, numericValue = 0 });
						tokens.Add(new TokenInfo { text = "x", numericValue = -1, isCoefficient = true });
						return;
					}

					// Render '-' as a separate operator label; keep digits-only inside bubbles.
					tokens.Add(new TokenInfo { text = "-", isOperator = true, numericValue = 0 });
					tokens.Add(new TokenInfo { text = Mathf.Abs(coef).ToString(), numericValue = coef, isCoefficient = true });
				}
				else
				{
					tokens.Add(new TokenInfo { text = coef.ToString(), numericValue = coef, isCoefficient = true });
				}

				tokens.Add(new TokenInfo { text = "x", numericValue = 1, isVariable = true });
			}
			else
			{
				// Fallback
				tokens.Add(new TokenInfo { text = term, numericValue = 0 });
			}
		}
	}

	private string FormatEquation(EquationState state)
	{
		if (state == null)
		{
			return string.Empty;
		}

		try
		{
			string left = FormatSide(state.leftVarCoef, state.leftConst);
			string right = FormatSide(state.rightVarCoef, state.rightConst);
			return $"{left} = {right}";
		}
		catch
		{
			return string.Empty;
		}
	}

	private string FormatSide(int varCoef, int constVal)
	{
		string result = "";

		if (varCoef != 0)
		{
			if (varCoef == 1)
			{
				result = "X";
			}
			else if (varCoef == -1)
			{
				result = "-X";
			}
			else
			{
				result = $"{varCoef}X";
			}
		}

		if (constVal != 0)
		{
			if (!string.IsNullOrEmpty(result))
			{
				result += constVal > 0 ? $" + {constVal}" : $" - {Mathf.Abs(constVal)}";
			}
			else
			{
				result = constVal.ToString();
			}
		}

		if (string.IsNullOrEmpty(result))
		{
			result = "0";
		}

		return result;
	}
}
