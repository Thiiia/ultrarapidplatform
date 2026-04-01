using System;
using System.Text.RegularExpressions;

using UnityEngine;

public static class LinearEquationParser
{
	public struct ParsedEquation
	{
		public int leftVarCoef;
		public int leftConst;
		public int leftConstDenominator;
		public int rightVarCoef;
		public int rightConst;
		public int rightConstDenominator;
		public bool hasBrackets;
		public string normalizedEquation;
		public string expandedEquation;

		public bool hasSubstitution;
		public int substitutionValue;
		public int substitutionValueDenominator;
		public int substitutionVarCoef;
		public int substitutionConst;
		public int substitutionConstDenominator;
		public string substitutionExpression;
	}

	public static bool TryParse(string raw, bool allowDecimals, bool allowFractions, bool enableSubstitution, out ParsedEquation parsed)
	{
		parsed = new ParsedEquation
		{
			leftConstDenominator = 1,
			rightConstDenominator = 1,
			substitutionValueDenominator = 1,
			substitutionConstDenominator = 1
		};

		if (string.IsNullOrWhiteSpace(raw))
			return false;

		string normalized = Normalize(raw);
		if (string.IsNullOrWhiteSpace(normalized))
			return false;

		if (normalized.StartsWith("SUB:", StringComparison.OrdinalIgnoreCase))
		{
			if (!enableSubstitution)
				return false;

			return TryParseSubstitution(normalized.Substring(4), allowDecimals, allowFractions, out parsed);
		}

		if (!normalized.Contains("="))
			return false;

		string[] sides = normalized.Split('=');
		if (sides.Length != 2)
			return false;

		bool leftHasBrackets;
		bool rightHasBrackets;
		if (!TryParseExpression(sides[0], allowDecimals, allowFractions, out int leftVar, out int leftConst, out int leftDen, out leftHasBrackets))
			return false;
		if (!TryParseExpression(sides[1], allowDecimals, allowFractions, out int rightVar, out int rightConst, out int rightDen, out rightHasBrackets))
			return false;

		parsed.leftVarCoef = leftVar;
		parsed.leftConst = leftConst;
		parsed.leftConstDenominator = leftDen;
		parsed.rightVarCoef = rightVar;
		parsed.rightConst = rightConst;
		parsed.rightConstDenominator = rightDen;
		parsed.hasBrackets = leftHasBrackets || rightHasBrackets || normalized.Contains("(");
		parsed.normalizedEquation = normalized;
		parsed.expandedEquation = BuildEquationString(leftVar, leftConst, leftDen, rightVar, rightConst, rightDen);
		return true;
	}

	private static bool TryParseSubstitution(string body, bool allowDecimals, bool allowFractions, out ParsedEquation parsed)
	{
		parsed = new ParsedEquation
		{
			leftConstDenominator = 1,
			rightConstDenominator = 1,
			substitutionValueDenominator = 1,
			substitutionConstDenominator = 1,
			hasSubstitution = true
		};

		string[] parts = body.Split(';');
		if (parts.Length < 2)
			return false;

		string assignPart = parts[0].Trim();
		string exprPart = parts[1].Trim();
		if (string.IsNullOrWhiteSpace(assignPart) || string.IsNullOrWhiteSpace(exprPart))
			return false;

		Match assignMatch = Regex.Match(assignPart, @"([a-zA-Z])\s*=\s*([^;]+)");
		if (!assignMatch.Success)
			return false;

		string valueText = assignMatch.Groups[2].Value;
		if (!TryParseNumber(valueText, allowDecimals, allowFractions, out int valueNum, out int valueDen))
			return false;

		if (!TryParseExpression(exprPart, allowDecimals, allowFractions, out int varCoef, out int constNum, out int constDen, out bool hasBrackets))
			return false;

		if (hasBrackets)
			return false;

		parsed.substitutionValue = valueNum;
		parsed.substitutionValueDenominator = valueDen;
		parsed.substitutionVarCoef = varCoef;
		parsed.substitutionConst = constNum;
		parsed.substitutionConstDenominator = constDen;
		parsed.substitutionExpression = exprPart;
		parsed.normalizedEquation = $"x={FormatFraction(valueNum, valueDen)} | {exprPart}";
		return true;
	}

	private static bool TryParseExpression(string expr, bool allowDecimals, bool allowFractions, out int varCoef, out int constNum, out int constDen, out bool hasBrackets)
	{
		varCoef = 0;
		constNum = 0;
		constDen = 1;
		hasBrackets = false;

		if (string.IsNullOrWhiteSpace(expr))
			return false;

		string compact = expr.Replace(" ", string.Empty);
		int i = 0;
		int sign = 1;

		while (i < compact.Length)
		{
			char c = compact[i];
			if (c == '+')
			{
				sign = 1;
				i++;
				continue;
			}
			if (c == '-')
			{
				sign = -1;
				i++;
				continue;
			}

			int coefNum = 0;
			int coefDen = 1;
			bool coefParsed = false;

			int numberStart = i;
			while (i < compact.Length && (char.IsDigit(compact[i]) || compact[i] == '.' || compact[i] == '/'))
				i++;

			if (i > numberStart)
			{
				string numberText = compact.Substring(numberStart, i - numberStart);
				if (!TryParseNumber(numberText, allowDecimals, allowFractions, out coefNum, out coefDen))
					return false;
				coefParsed = true;
			}

			if (i < compact.Length && compact[i] == '(')
			{
				hasBrackets = true;
				int close = FindMatchingParen(compact, i);
				if (close < 0)
					return false;

				string inner = compact.Substring(i + 1, close - i - 1);
				if (!TryParseExpression(inner, allowDecimals, allowFractions, out int innerVar, out int innerConst, out int innerConstDen, out bool innerHasBrackets))
					return false;
				if (innerHasBrackets)
					return false;

				int outerCoef = coefParsed ? coefNum : 1;
				int outerDen = coefParsed ? coefDen : 1;
				if (outerDen != 1)
					return false;

				varCoef += sign * outerCoef * innerVar;
				AddFraction(ref constNum, ref constDen, sign * outerCoef * innerConst, innerConstDen);

				i = close + 1;
				sign = 1;
				continue;
			}

			if (i < compact.Length && (compact[i] == 'x' || compact[i] == 'X'))
			{
				int termCoef = coefParsed ? coefNum : 1;
				int termDen = coefParsed ? coefDen : 1;
				if (termDen != 1)
					return false;
				varCoef += sign * termCoef;
				i++;
				sign = 1;
				continue;
			}

			if (coefParsed)
			{
				AddFraction(ref constNum, ref constDen, sign * coefNum, coefDen);
				sign = 1;
				continue;
			}

			return false;
		}

		return true;
	}

	private static bool TryParseNumber(string text, bool allowDecimals, bool allowFractions, out int numerator, out int denominator)
	{
		numerator = 0;
		denominator = 1;

		if (string.IsNullOrWhiteSpace(text))
			return false;

		if (text.Contains("/"))
		{
			if (!allowFractions)
				return false;

			string[] parts = text.Split('/');
			if (parts.Length != 2)
				return false;
			if (!int.TryParse(parts[0], out numerator))
				return false;
			if (!int.TryParse(parts[1], out denominator))
				return false;
			if (denominator == 0)
				return false;
			ReduceFraction(ref numerator, ref denominator);
			return true;
		}

		if (text.Contains("."))
		{
			if (!allowDecimals)
				return false;

			if (!decimal.TryParse(text, out decimal value))
				return false;

			string[] parts = text.Split('.');
			int scale = parts.Length > 1 ? (int)Mathf.Pow(10, parts[1].Length) : 1;
			numerator = (int)(value * scale);
			denominator = scale;
			ReduceFraction(ref numerator, ref denominator);
			return true;
		}

		return int.TryParse(text, out numerator);
	}

	private static void AddFraction(ref int numerator, ref int denominator, int addNumerator, int addDenominator)
	{
		if (addDenominator == 0)
			return;

		if (denominator == 0)
			denominator = 1;

		int lcm = Lcm(denominator, addDenominator);
		int scaled = numerator * (lcm / denominator);
		int addScaled = addNumerator * (lcm / addDenominator);
		numerator = scaled + addScaled;
		denominator = lcm;
		ReduceFraction(ref numerator, ref denominator);
	}

	private static int FindMatchingParen(string text, int openIndex)
	{
		int depth = 0;
		for (int i = openIndex; i < text.Length; i++)
		{
			if (text[i] == '(') depth++;
			else if (text[i] == ')')
			{
				depth--;
				if (depth == 0)
					return i;
			}
		}
		return -1;
	}

	private static string Normalize(string equation)
	{
		string cleaned = equation.Replace(" ", string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);
		return cleaned.Replace("−", "-");
	}

	private static string BuildEquationString(int leftVar, int leftConst, int leftDen, int rightVar, int rightConst, int rightDen)
	{
		string left = BuildSide(leftVar, leftConst, leftDen);
		string right = BuildSide(rightVar, rightConst, rightDen);
		return $"{left} = {right}";
	}

	private static string BuildSide(int varCoef, int constNum, int constDen)
	{
		string left = string.Empty;
		if (varCoef != 0)
		{
			if (varCoef == 1)
				left = "x";
			else if (varCoef == -1)
				left = "-x";
			else
				left = $"{varCoef}x";
		}

		if (constNum != 0)
		{
			string absConst = FormatFraction(Mathf.Abs(constNum), constDen);
			if (!string.IsNullOrEmpty(left))
			{
				left += constNum > 0 ? $" + {absConst}" : $" - {absConst}";
			}
			else
			{
				left = constNum < 0 ? "-" + absConst : absConst;
			}
		}

		return string.IsNullOrEmpty(left) ? "0" : left;
	}

	private static string FormatFraction(int numeratorAbs, int denominator)
	{
		if (denominator <= 1)
			return numeratorAbs.ToString();
		return $"{numeratorAbs}/{denominator}";
	}

	private static int Lcm(int a, int b)
	{
		if (a == 0 || b == 0)
			return 0;
		return Mathf.Abs(a / Gcd(a, b) * b);
	}

	private static int Gcd(int a, int b)
	{
		a = Mathf.Abs(a);
		b = Mathf.Abs(b);
		while (b != 0)
		{
			int temp = a % b;
			a = b;
			b = temp;
		}
		return a == 0 ? 1 : a;
	}

	private static void ReduceFraction(ref int numerator, ref int denominator)
	{
		if (denominator == 0)
		{
			denominator = 1;
			return;
		}

		if (numerator == 0)
		{
			denominator = 1;
			return;
		}

		int gcd = Gcd(numerator, denominator);
		if (gcd > 1)
		{
			numerator /= gcd;
			denominator /= gcd;
		}
	}
}
