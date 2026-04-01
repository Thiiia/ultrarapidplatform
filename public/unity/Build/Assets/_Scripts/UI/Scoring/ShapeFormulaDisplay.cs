using System.Text;
using TMPro;
using UnityEngine;

/// <summary>
/// Binds ShapeFormulaRuntime data to UI text elements so each run can surface the current perimeter formula.
/// Add to any canvas object and wire up the TMP references (auto-locates if left empty).
/// </summary>
public class ShapeFormulaDisplay : MonoBehaviour
{
	[SerializeField] private TMP_Text formulaNameText;
	[SerializeField] private TMP_Text expressionTemplateText;
	[SerializeField] private TMP_Text resolvedExpressionText;
	[SerializeField] private TMP_Text variableListText;
	[SerializeField, Tooltip("Attempt to locate TMP children named \"FormulaName\", \"FormulaExpression\", etc. when references are missing.")]
	private bool autoLocate = true;
	[SerializeField, Tooltip("Format used when listing variable values. {0} = variable name, {1} = value with unit.")]
	private string variableLineFormat = "{0} = {1}";
	[SerializeField] private string variableSeparator = "\n";

	private void Awake()
	{
		if (autoLocate)
			TryAutoLocate();
	}

	private void OnEnable()
	{
		ShapeFormulaRuntime.FormulaChanged += HandleFormulaChanged;
		HandleFormulaChanged(ShapeFormulaRuntime.Current);
	}

	private void OnDisable()
	{
		ShapeFormulaRuntime.FormulaChanged -= HandleFormulaChanged;
	}

	private void HandleFormulaChanged(ShapeFormulaRuntimeData data)
	{
		if (formulaNameText)
			formulaNameText.text = data.IsValid ? data.formulaName : string.Empty;
		if (expressionTemplateText)
			expressionTemplateText.text = data.IsValid ? data.expression : string.Empty;
		if (resolvedExpressionText)
			resolvedExpressionText.text = data.IsValid ? data.resolvedExpression : string.Empty;
		if (variableListText)
			variableListText.text = data.IsValid ? BuildVariableList(data) : string.Empty;
	}

	private string BuildVariableList(ShapeFormulaRuntimeData data)
	{
		if (!data.HasValues)
			return string.Empty;

		var builder = new StringBuilder();
		for (int i = 0; i < data.values.Length; i++)
		{
			var term = data.values[i];
			string unit = string.IsNullOrEmpty(term.unit) ? data.unitSuffix : term.unit;
			string value = string.IsNullOrEmpty(unit) ? term.formattedValue : $"{term.formattedValue}{unit}";
			builder.AppendFormat(variableLineFormat, term.variableName, value);
			if (i < data.values.Length - 1)
				builder.Append(variableSeparator);
		}
		return builder.ToString();
	}

	private void TryAutoLocate()
	{
		if (!formulaNameText)
			formulaNameText = FindChildByKeyword("FormulaName");
		if (!expressionTemplateText)
			expressionTemplateText = FindChildByKeyword("FormulaExpression");
		if (!resolvedExpressionText)
			resolvedExpressionText = FindChildByKeyword("FormulaResolved");
		if (!variableListText)
			variableListText = FindChildByKeyword("FormulaVariables");
	}

	private TMP_Text FindChildByKeyword(string keyword)
	{
		if (string.IsNullOrEmpty(keyword))
			return null;
		var texts = GetComponentsInChildren<TMP_Text>(true);
		for (int i = 0; i < texts.Length; i++)
		{
			if (texts[i] && texts[i].name.IndexOf(keyword, System.StringComparison.OrdinalIgnoreCase) >= 0)
				return texts[i];
		}
		return null;
	}
}
