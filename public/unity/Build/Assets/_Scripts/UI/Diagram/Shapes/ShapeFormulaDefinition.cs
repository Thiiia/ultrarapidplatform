using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Describes how to generate a perimeter/circumference formula for a shape type.
/// Supports randomised variable values so each run feels unique.
/// </summary>
[Serializable]
public class ShapeFormulaDefinition
{
	public enum TotalComputationMode { Sum = 0, MultiplySingleTerm = 1, CircleCircumference = 2 }

	[SerializeField] private ShapeSelectButton.ShapeType shapeType = ShapeSelectButton.ShapeType.Square;
	[SerializeField] private string formulaName = "Perimeter";
	[SerializeField, TextArea] private string expressionTemplate = "P = {a} + {b} + {c}";
	[SerializeField] private string unitSuffix = "cm";
	[SerializeField] private int totalDecimalPlaces = 2;
	[SerializeField] private bool totalAsInteger = false;
	[SerializeField] private TotalComputationMode totalMode = TotalComputationMode.Sum;
	[SerializeField, Tooltip("Used when Total Mode = MultiplySingleTerm (e.g., square perimeter = 4a).")]
	private int totalPrimaryTermIndex = 0;
	[SerializeField, Tooltip("Used when Total Mode = MultiplySingleTerm to multiply the selected term value.")]
	private float totalMultiplier = 4f;
	[SerializeField, Tooltip("Used when Total Mode = CircleCircumference. Select radius variable index.")]
	private int circleRadiusTermIndex = 0;
	[SerializeField] private ShapeFormulaTerm[] terms;


	public ShapeSelectButton.ShapeType Shape => shapeType;

	public ShapeFormulaRuntimeData GenerateRuntimeData(DiagramManager.PerimeterSegment[] segments)
	{
		var data = ShapeFormulaRuntimeData.Empty;
		data.formulaName = formulaName;
		data.expression = expressionTemplate;
		data.unitSuffix = unitSuffix;

		var resolvedTerms = BuildRuntimeTerms(segments);
		data.values = resolvedTerms;
		data.totalValue = ComputeTotal(resolvedTerms);
		data.formattedTotal = FormatNumber(data.totalValue, totalDecimalPlaces, totalAsInteger);
		data.resolvedExpression = ResolveExpression(expressionTemplate, resolvedTerms, data.formattedTotal, unitSuffix);

		return data;
	}

	private ShapeFormulaTermValue[] BuildRuntimeTerms(DiagramManager.PerimeterSegment[] segments)
	{
		var definitionTerms = terms != null && terms.Length > 0
			? terms
			: BuildDefaultTerms(segments);

		if (definitionTerms == null || definitionTerms.Length == 0)
			return Array.Empty<ShapeFormulaTermValue>();

		var sharedBuckets = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
		var results = new ShapeFormulaTermValue[definitionTerms.Length];

		for (int i = 0; i < definitionTerms.Length; i++)
		{
			var term = definitionTerms[i];
			float sampledValue;
			if (!string.IsNullOrEmpty(term.sharedValueKey))
			{
				if (!sharedBuckets.TryGetValue(term.sharedValueKey, out sampledValue))
				{
					sampledValue = SampleValue(term);
					sharedBuckets[term.sharedValueKey] = sampledValue;
				}
			}
			else
			{
				sampledValue = SampleValue(term);
			}

			int segmentIndex = ResolveSegmentIndex(term, i, segments);
			string segmentId = ResolveSegmentId(term, segmentIndex, segments);

			results[i] = new ShapeFormulaTermValue
			{
				variableName = term.variableName,
				value = sampledValue,
				formattedValue = FormatNumber(sampledValue, term.decimalPlaces, term.useIntegerValues),
				unit = string.IsNullOrEmpty(term.unitOverride) ? unitSuffix : term.unitOverride,
				segmentId = segmentId,
				segmentIndex = segmentIndex,
				coefficient = Mathf.Approximately(term.coefficient, 0f) ? 1f : term.coefficient
			};
		}

		return results;
	}

	private float SampleValue(ShapeFormulaTerm term)
	{
		float value = UnityEngine.Random.Range(term.valueRange.x, term.valueRange.y);
		if (term.useIntegerValues)
		{
			value = Mathf.Round(value);
		}
		else
		{
			int decimals = Mathf.Clamp(term.decimalPlaces, 0, 5);
			float pow = Mathf.Pow(10f, decimals);
			value = Mathf.Round(value * pow) / pow;
		}
		return value;
	}

	private float ComputeTotal(ShapeFormulaTermValue[] runtimeTerms)
	{
		if (runtimeTerms == null || runtimeTerms.Length == 0)
			return 0f;

		switch (totalMode)
		{
			case TotalComputationMode.MultiplySingleTerm:
			{
				int idx = Mathf.Clamp(totalPrimaryTermIndex, 0, runtimeTerms.Length - 1);
				return runtimeTerms[idx].value * totalMultiplier;
			}
			case TotalComputationMode.CircleCircumference:
			{
				int idx = Mathf.Clamp(circleRadiusTermIndex, 0, runtimeTerms.Length - 1);
				return 2f * Mathf.PI * runtimeTerms[idx].value;
			}
			default:
			{
				float sum = 0f;
				for (int i = 0; i < runtimeTerms.Length; i++)
				{
					sum += runtimeTerms[i].value * runtimeTerms[i].coefficient;
				}
				return sum;
			}
		}
	}

	private static string ResolveExpression(string template, ShapeFormulaTermValue[] runtimeTerms, string formattedTotal, string unit)
	{
		if (string.IsNullOrEmpty(template))
			return string.Empty;

		string resolved = template;
		if (runtimeTerms != null)
		{
			for (int i = 0; i < runtimeTerms.Length; i++)
			{
				var term = runtimeTerms[i];
				if (string.IsNullOrEmpty(term.variableName))
					continue;
				string token = "{" + term.variableName + "}";
				string replacement = string.IsNullOrEmpty(term.unit) ? term.formattedValue : $"{term.formattedValue}{term.unit}";
				resolved = resolved.Replace(token, replacement);
			}
		}

		resolved = resolved.Replace("{total}", formattedTotal);
		resolved = resolved.Replace("{unit}", unit ?? string.Empty);
		return resolved;
	}

	private int ResolveSegmentIndex(ShapeFormulaTerm term, int fallbackIndex, DiagramManager.PerimeterSegment[] segments)
	{
		if (term.segmentIndex >= 0)
			return term.segmentIndex;
		if (!string.IsNullOrEmpty(term.segmentId) && segments != null)
		{
			for (int i = 0; i < segments.Length; i++)
			{
				if (segments[i].id == term.segmentId)
					return i;
			}
		}
		return fallbackIndex;
	}

	private string ResolveSegmentId(ShapeFormulaTerm term, int index, DiagramManager.PerimeterSegment[] segments)
	{
		if (!string.IsNullOrEmpty(term.segmentId))
			return term.segmentId;

		if (segments != null && index >= 0 && index < segments.Length)
			return segments[index].id;

		return string.Empty;
	}

	private static ShapeFormulaTerm[] BuildDefaultTerms(DiagramManager.PerimeterSegment[] segments)
	{
		int count = (segments != null && segments.Length > 0) ? segments.Length : 4;
		var defaults = new ShapeFormulaTerm[count];
		for (int i = 0; i < count; i++)
		{
			defaults[i] = new ShapeFormulaTerm
			{
				variableName = $"s{i + 1}",
				segmentId = segments != null && i < segments.Length ? segments[i].id : string.Empty,
				segmentIndex = i,
				valueRange = new Vector2(4f, 16f),
				useIntegerValues = true,
				decimalPlaces = 0,
				coefficient = 1f,
				unitOverride = string.Empty,
				sharedValueKey = string.Empty
			};
		}
		return defaults;
	}

	private static string FormatNumber(float value, int decimals, bool asInteger)
	{
		if (asInteger)
			return Mathf.RoundToInt(value).ToString();
		int clamped = Mathf.Clamp(decimals, 0, 4);
		return Math.Round(value, clamped).ToString($"F{clamped}");
	}

	#region Static helpers

	public static ShapeFormulaDefinition CreateFallback(ShapeSelectButton.ShapeType type, DiagramManager.PerimeterSegment[] segments)
	{
		switch (type)
		{
			case ShapeSelectButton.ShapeType.Triangle:
				return CreatePolygonDefinition(type, "Triangle Perimeter", 3, segments);
			case ShapeSelectButton.ShapeType.Hexagon:
				return CreatePolygonDefinition(type, "Hexagon Perimeter", 6, segments);
			case ShapeSelectButton.ShapeType.Star:
				return CreatePolygonDefinition(type, "Star Perimeter", 10, segments);
			case ShapeSelectButton.ShapeType.Circle:
				return CreateCircleDefinition();
			case ShapeSelectButton.ShapeType.Complex:
				return CreatePolygonDefinition(type, "Perimeter", segments != null ? segments.Length : 6, segments);
			default:
				return CreatePolygonDefinition(type, $"{type} Perimeter", segments != null ? segments.Length : 4, segments);
		}
	}

	private static ShapeFormulaDefinition CreatePolygonDefinition(ShapeSelectButton.ShapeType type, string name, int sides, DiagramManager.PerimeterSegment[] segments)
	{
		var def = new ShapeFormulaDefinition
		{
			shapeType = type,
			formulaName = name,
			expressionTemplate = BuildPolygonExpression(sides),
			unitSuffix = "cm",
			totalMode = TotalComputationMode.Sum,
			totalDecimalPlaces = 2,
			totalAsInteger = false,
			terms = BuildDefaultTermsForPolygon(sides, segments)
		};
		return def;
	}

	private static ShapeFormulaDefinition CreateCircleDefinition()
	{
		return new ShapeFormulaDefinition
		{
			shapeType = ShapeSelectButton.ShapeType.Circle,
			formulaName = "Circle Circumference",
			expressionTemplate = "C = 2π{r}",
			unitSuffix = "cm",
			totalMode = TotalComputationMode.CircleCircumference,
			circleRadiusTermIndex = 0,
			totalDecimalPlaces = 2,
			totalAsInteger = false,
			terms = new[]
			{
				new ShapeFormulaTerm
				{
					variableName = "r",
					segmentIndex = 0,
					valueRange = new Vector2(3f, 12f),
					useIntegerValues = false,
					decimalPlaces = 1,
					unitOverride = "cm",
					coefficient = 1f,
					includeInTotal = false
				}
			}
		};
	}

	private static string BuildPolygonExpression(int sides)
	{
		var parts = new List<string>();
		for (int i = 0; i < sides; i++)
			parts.Add($"{{s{i + 1}}}");
		return $"P = {string.Join(" + ", parts)}";
	}

	private static ShapeFormulaTerm[] BuildDefaultTermsForPolygon(int sides, DiagramManager.PerimeterSegment[] segments)
	{
		var terms = new ShapeFormulaTerm[sides];
		var sharedKey = (sides % 2 == 0) ? "pair" : string.Empty;
		for (int i = 0; i < sides; i++)
		{
			terms[i] = new ShapeFormulaTerm
			{
				variableName = $"s{i + 1}",
				segmentIndex = i,
				segmentId = segments != null && i < segments.Length ? segments[i].id : string.Empty,
				valueRange = new Vector2(4f, 18f),
				useIntegerValues = true,
				decimalPlaces = 0,
				coefficient = 1f,
				unitOverride = "cm",
				sharedValueKey = string.Empty
			};
		}
		return terms;
	}

	#endregion

	[Serializable]
	public class ShapeFormulaTerm
	{
		public string variableName = "a";
		public string segmentId;
		public int segmentIndex = -1;
		public Vector2 valueRange = new Vector2(4f, 12f);
		public bool useIntegerValues = true;
		[Range(0, 4)] public int decimalPlaces = 0;
		public float coefficient = 1f;
		public bool includeInTotal = true;
		public string unitOverride;
		[SerializeField, Tooltip("Terms sharing the same key reuse the same sampled value (useful for opposite sides).")]
		public string sharedValueKey;
	}
}
