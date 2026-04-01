using UnityEngine;
using UnityEngine.UI;

using System;
using System.Collections;
using System.Collections.Generic;

using TMPro;

using DG.Tweening;

public enum OperationType
{
	SubtractConstant,
	AddConstant,
	SubtractVariable,
	AddVariable,
	MultiplyByNegativeOne,
	DivideByCoefficient,
	ExpandBrackets,
	CombineLikeTerms,
	SubstituteValue
}

[System.Serializable]
public class StepOption
{
	public string description;
	public OperationType operationType;
	public int value;
	public int valueDenominator = 1;
	public bool isOptimal;

	public StepOption(string desc, OperationType type, int val = 0, bool optimal = false, int valDenominator = 1)
	{
		description = desc;
		operationType = type;
		value = val;
		valueDenominator = valDenominator <= 0 ? 1 : valDenominator;
		isOptimal = optimal;
	}
}

[System.Serializable]
public class EquationState
{
	public int leftVarCoef;
	public int leftConst;
	public int leftConstDenominator = 1;
	public int rightVarCoef;
	public int rightConst;
	public int rightConstDenominator = 1;
	public bool hasBrackets;
	public string rawEquation;
	public bool hasSubstitution;
	public int substitutionValue;
	public int substitutionValueDenominator = 1;
	public int substitutionVarCoef;
	public int substitutionConst;
	public int substitutionConstDenominator = 1;
	public string substitutionExpression;

	public EquationState(int lv, int lc, int rv, int rc, bool brackets = false, string raw = "")
	{
		leftVarCoef = lv;
		leftConst = lc;
		rightVarCoef = rv;
		rightConst = rc;
		hasBrackets = brackets;
		rawEquation = raw;
		leftConstDenominator = 1;
		rightConstDenominator = 1;
	}

	public EquationState Clone()
	{
		return new EquationState(leftVarCoef, leftConst, rightVarCoef, rightConst, hasBrackets, rawEquation)
		{
			leftConstDenominator = leftConstDenominator,
			rightConstDenominator = rightConstDenominator,
			hasSubstitution = hasSubstitution,
			substitutionValue = substitutionValue,
			substitutionValueDenominator = substitutionValueDenominator,
			substitutionVarCoef = substitutionVarCoef,
			substitutionConst = substitutionConst,
			substitutionConstDenominator = substitutionConstDenominator,
			substitutionExpression = substitutionExpression
		};
	}

	public bool IsSolved()
	{
		return (leftVarCoef == 1 && leftConst == 0 && rightVarCoef == 0) ||
			   (rightVarCoef == 1 && rightConst == 0 && leftVarCoef == 0);
	}
}
public class EquationChoiceSystem : MonoBehaviour
{
	[Header("UI References")]
	[SerializeField] private RectTransform optionsContainer;
	[SerializeField] private GameObject optionButtonPrefab;

	[Header("Visual Settings")]
	[SerializeField] private Color optionNormalColor = new Color(0.2f, 0.2f, 0.3f, 1f);
	[SerializeField] private Color optionHighlightColor = new Color(0.3f, 0.5f, 0.3f, 1f);
	[SerializeField] private Color optionOptimalColor = new Color(0.2f, 0.4f, 0.6f, 1f);
	[SerializeField] private bool showOptimalHint = true;

	[Header("Animation Settings")]
	[SerializeField] private float buttonAnimationDuration = 0.3f;
	[SerializeField] private float buttonStaggerDelay = 0.1f;

	[Header("Layout Settings")]
	[SerializeField] private float buttonSpacing = 15f;
	[SerializeField] private float buttonWidth = 120f;
	[SerializeField] private float buttonHeight = 50f;
	[SerializeField] private TextAnchor buttonAlignment = TextAnchor.MiddleCenter;

	[Header("Safety")]
	[SerializeField] private bool filterOptionsByBounds = true;
	[SerializeField] private bool allowFallbackOutOfBoundsOption = true;

	// State
	private EquationState currentEquationState;
	private EquationState stateBeforeLastOption;
	private List<StepOption> currentOptions = new List<StepOption>();
	private List<GameObject> optionButtons = new List<GameObject>();
	private bool waitingForPlayerChoice = false;

	// Events
	public event Action<StepOption> OnOptionSelected;
	public event Action<EquationState> OnStateChanged;

	// Properties
	public EquationState CurrentState => currentEquationState;
	public EquationState StateBeforeLastOption => stateBeforeLastOption;
	public bool IsWaitingForChoice => waitingForPlayerChoice;
	public List<StepOption> CurrentOptions => new List<StepOption>(currentOptions);
	public bool ShowOptimalHint
	{
		get => showOptimalHint;
		set => showOptimalHint = value;
	}

	/// Initializes the choice system with a parsed equation state
	public void Initialize(EquationState state)
	{
		currentEquationState = state;
		ClearOptions();
		OnStateChanged?.Invoke(currentEquationState);
	}

	/// Initializes from equation coefficients
	public void Initialize(int leftVarCoef, int leftConst, int rightVarCoef, int rightConst, bool hasBrackets = false, string rawEquation = "")
	{
		currentEquationState = new EquationState(leftVarCoef, leftConst, rightVarCoef, rightConst, hasBrackets, rawEquation);
		ClearOptions();
		OnStateChanged?.Invoke(currentEquationState);
	}

	/// Generates all available options for the current equation state
	public List<StepOption> GenerateAvailableOptions()
	{
		return GenerateAvailableOptions(currentEquationState);
	}

	/// Generates all available options for a given equation state
	public List<StepOption> GenerateAvailableOptions(EquationState state)
	{
		List<StepOption> options = new List<StepOption>();

		if (state == null) return options;
		if (state.IsSolved()) return options;

		if (state.hasSubstitution)
		{
			string valueText = FormatValue(state.substitutionValue, state.substitutionValueDenominator);
				options.Add(new StepOption(
					$"Substitute x = {valueText}",
					OperationType.SubstituteValue,
					state.substitutionValue,
					true,
					state.substitutionValueDenominator
				));
				return FinalizeOptions(state, options);
			}

		// If equation has brackets, expanding is mandatory
			if (state.hasBrackets)
			{
				options.Add(new StepOption("Expand", OperationType.ExpandBrackets, 0, true));
				return FinalizeOptions(state, options);
			}

		bool simplified = state.leftConst == 0 && state.rightVarCoef == 0;
		int absCoef = Mathf.Abs(state.leftVarCoef);

		// Simplified form: ax = b (or -ax = b)
		// Provide at least one "wrong direction" option so the decision isn't a single-choice click.
		if (simplified)
		{
			if (state.leftVarCoef < 0)
			{
				// Prefer flipping sign first; dividing by +a yields -x = c which is slower to read.
					options.Add(new StepOption("* (-1)", OperationType.MultiplyByNegativeOne, -1, true));
					if (absCoef > 1)
						options.Add(new StepOption($"\u00F7 {absCoef}", OperationType.DivideByCoefficient, absCoef, false));
				}
				else if (absCoef > 1)
				{
					options.Add(new StepOption($"\u00F7 {absCoef}", OperationType.DivideByCoefficient, absCoef, true));
					options.Add(new StepOption("* (-1)", OperationType.MultiplyByNegativeOne, -1, false));
				}

			// Also offer a decoy constant move (wrong category) so Add/Sub isn't a dead end.
			int decoyConst = state.rightConst != 0 ? state.rightConst : state.leftConst;
			int decoyDen = state.rightConst != 0 ? state.rightConstDenominator : state.leftConstDenominator;
			if (decoyConst != 0)
			{
				int absConst = Mathf.Abs(decoyConst);
				string constText = FormatValue(absConst, decoyDen);
					if (decoyConst > 0)
						options.Add(new StepOption($"+ {constText}", OperationType.AddConstant, absConst, false, decoyDen));
					else
						options.Add(new StepOption($"- {constText}", OperationType.SubtractConstant, absConst, false, decoyDen));
				}
				else
			{
				options.Add(new StepOption("+ 1", OperationType.AddConstant, 1, false));
			}

				if (options.Count > 0)
				{
					return FinalizeOptions(state, options);
				}
			}

		// Option 1: Move constants from left to right
		if (state.leftConst != 0)
		{
			if (state.leftConst > 0)
			{
				string constantText = FormatValue(state.leftConst, state.leftConstDenominator);
					options.Add(new StepOption(
						$"- {constantText}",
						OperationType.SubtractConstant,
						state.leftConst,
						state.rightVarCoef == 0,
						state.leftConstDenominator
				));
			}
			else
			{
				string constantText = FormatValue(Mathf.Abs(state.leftConst), state.leftConstDenominator);
				options.Add(new StepOption(
					$"+ {constantText}",
					OperationType.AddConstant,
					Mathf.Abs(state.leftConst),
					state.rightVarCoef == 0,
					state.leftConstDenominator
				));
			}
		}

		// Option 2: Move constants from right to left
		if (state.rightConst != 0)
		{
			if (state.rightConst > 0)
			{
				string constantText = FormatValue(state.rightConst, state.rightConstDenominator);
					options.Add(new StepOption(
						$"- {constantText}",
						OperationType.SubtractConstant,
						state.rightConst,
						false,
						state.rightConstDenominator
				));
			}
			else
			{
				string constantText = FormatValue(Mathf.Abs(state.rightConst), state.rightConstDenominator);
				options.Add(new StepOption(
					$"+ {constantText}",
					OperationType.AddConstant,
					Mathf.Abs(state.rightConst),
					false,
					state.rightConstDenominator
				));
			}
		}

		// Option 3: Move variables from right to left
		if (state.rightVarCoef != 0)
		{
			if (state.rightVarCoef > 0)
			{
					options.Add(new StepOption(
						$"- {state.rightVarCoef}x",
						OperationType.SubtractVariable,
						state.rightVarCoef,
						state.leftConst == 0
					));
			}
			else
			{
				options.Add(new StepOption(
					$"+ {Mathf.Abs(state.rightVarCoef)}x",
					OperationType.AddVariable,
					Mathf.Abs(state.rightVarCoef),
					state.leftConst == 0
				));
			}
		}

		// Option 4: Move variables from left to right (less common but valid)
		if (state.leftVarCoef != 0 && state.rightVarCoef != 0)
		{
			if (state.leftVarCoef > 0)
			{
					options.Add(new StepOption(
						$"- {state.leftVarCoef}x",
						OperationType.SubtractVariable,
						state.leftVarCoef,
						false
					));
			}
			else
			{
				options.Add(new StepOption(
					$"+ {Mathf.Abs(state.leftVarCoef)}x",
					OperationType.AddVariable,
					Mathf.Abs(state.leftVarCoef),
					false
				));
			}
		}

		// Option 5: Divide by coefficient (if applicable)
		if (state.leftConst == 0 && state.rightVarCoef == 0 && Mathf.Abs(state.leftVarCoef) > 1)
		{
				options.Add(new StepOption(
					$"\u00F7 {Mathf.Abs(state.leftVarCoef)}",
					OperationType.DivideByCoefficient,
					Mathf.Abs(state.leftVarCoef),
					true
				));
		}

		// Option 6: Multiply by -1 (if coefficient is negative)
			if (state.leftVarCoef < 0)
			{
				options.Add(new StepOption(
					"* (-1)",
					OperationType.MultiplyByNegativeOne,
					-1,
					state.leftConst == 0 && state.rightVarCoef == 0
				));
			}

			return FinalizeOptions(state, options);
		}

		private List<StepOption> FinalizeOptions(EquationState state, List<StepOption> options)
		{
			if (options == null)
				return new List<StepOption>();

			options.RemoveAll(o => o == null);
			if (options.Count == 0 || state == null)
				return options;

			EnsureAtLeastOneOptimalOption(state, options);

			if (filterOptionsByBounds)
				options = FilterOptionsByBounds(state, options);

			return options;
		}

		private List<StepOption> FilterOptionsByBounds(EquationState state, List<StepOption> options)
		{
			if (options == null || options.Count == 0 || state == null)
				return options;

			List<StepOption> kept = new List<StepOption>(options.Count);
			for (int i = 0; i < options.Count; i++)
			{
				StepOption option = options[i];
				if (option == null)
					continue;

				EquationState next = ApplyOption(state, option);
				if (EquationPolicy.IsStateWithinBounds(next))
					kept.Add(option);
			}

			if (kept.Count > 0)
				return kept;

			if (!allowFallbackOutOfBoundsOption)
				return kept;

			StepOption optimal = options.Find(o => o != null && o.isOptimal);
			if (optimal != null)
				return new List<StepOption> { optimal };

			return new List<StepOption> { options[0] };
		}

	private static void EnsureAtLeastOneOptimalOption(EquationState state, List<StepOption> options)
	{
		if (state == null || options == null || options.Count == 0)
			return;

		for (int i = 0; i < options.Count; i++)
		{
			StepOption option = options[i];
			if (option != null && option.isOptimal)
				return;
		}

		StepOption best = null;

		if (state.hasBrackets)
		{
			best = options.Find(o => o != null && o.operationType == OperationType.ExpandBrackets);
		}
		else if (state.hasSubstitution)
		{
			best = options.Find(o => o != null && o.operationType == OperationType.SubstituteValue);
		}
		else if (state.rightVarCoef != 0)
		{
			int v = Mathf.Abs(state.rightVarCoef);
			OperationType needed = state.rightVarCoef > 0 ? OperationType.SubtractVariable : OperationType.AddVariable;
			best = options.Find(o => o != null && o.operationType == needed && Mathf.Abs(o.value) == v);
		}
		else if (state.leftConst != 0)
		{
			int v = Mathf.Abs(state.leftConst);
			OperationType needed = state.leftConst > 0 ? OperationType.SubtractConstant : OperationType.AddConstant;
			best = options.Find(o => o != null && o.operationType == needed && Mathf.Abs(o.value) == v && o.valueDenominator == state.leftConstDenominator);
		}
		else if (Mathf.Abs(state.leftVarCoef) > 1 && state.leftConst == 0 && state.rightVarCoef == 0)
		{
			int v = Mathf.Abs(state.leftVarCoef);
			best = options.Find(o => o != null && o.operationType == OperationType.DivideByCoefficient && Mathf.Abs(o.value) == v);
		}
		else if (state.leftVarCoef < 0)
		{
			best = options.Find(o => o != null && o.operationType == OperationType.MultiplyByNegativeOne);
		}

		if (best == null)
			best = options[0];

		if (best != null)
			best.isOptimal = true;
	}

	/// Applies the selected option to the current equation state
	public EquationState ApplyOption(StepOption option)
	{
		return ApplyOption(currentEquationState, option);
	}

	/// Applies the selected option to a given equation state
	public EquationState ApplyOption(EquationState state, StepOption option)
	{
		EquationState newState = state.Clone();

		switch (option.operationType)
		{
			case OperationType.SubtractConstant:
				AddFractionToFraction(ref newState.leftConst, ref newState.leftConstDenominator, -option.value, option.valueDenominator);
				AddFractionToFraction(ref newState.rightConst, ref newState.rightConstDenominator, -option.value, option.valueDenominator);
				break;

			case OperationType.AddConstant:
				AddFractionToFraction(ref newState.leftConst, ref newState.leftConstDenominator, option.value, option.valueDenominator);
				AddFractionToFraction(ref newState.rightConst, ref newState.rightConstDenominator, option.value, option.valueDenominator);
				break;

			case OperationType.SubtractVariable:
				newState.leftVarCoef -= option.value;
				newState.rightVarCoef -= option.value;
				break;

			case OperationType.AddVariable:
				newState.leftVarCoef += option.value;
				newState.rightVarCoef += option.value;
				break;

			case OperationType.MultiplyByNegativeOne:
				newState.leftVarCoef = -newState.leftVarCoef;
				newState.leftConst = -newState.leftConst;
				newState.rightVarCoef = -newState.rightVarCoef;
				newState.rightConst = -newState.rightConst;
				break;

			case OperationType.DivideByCoefficient:
				newState.leftVarCoef = newState.leftVarCoef < 0 ? -1 : 1;
				ApplyDivisionToRightConstant(ref newState.rightConst, ref newState.rightConstDenominator, option.value);
				break;

			case OperationType.ExpandBrackets:
				if (!string.IsNullOrWhiteSpace(newState.rawEquation) &&
					LinearEquationParser.TryParse(
						newState.rawEquation,
						AlgebraRuntimeConfig.AllowDecimals,
						AlgebraRuntimeConfig.AllowFractions,
						AlgebraRuntimeConfig.EnableSubstitution,
						out LinearEquationParser.ParsedEquation parsed))
				{
					newState.leftVarCoef = parsed.leftVarCoef;
					newState.leftConst = parsed.leftConst;
					newState.leftConstDenominator = parsed.leftConstDenominator;
					newState.rightVarCoef = parsed.rightVarCoef;
					newState.rightConst = parsed.rightConst;
					newState.rightConstDenominator = parsed.rightConstDenominator;
					newState.rawEquation = parsed.expandedEquation;
				}

				newState.hasBrackets = false;
				break;

			case OperationType.CombineLikeTerms:
				break;

			case OperationType.SubstituteValue:
				ApplySubstitution(ref newState, option);
				break;
		}

		return newState;
	}

	private static void AddIntegerToFraction(ref int numerator, ref int denominator, int valueToAdd)
	{
		if (denominator == 0)
			denominator = 1;

		numerator += valueToAdd * denominator;
		ReduceFraction(ref numerator, ref denominator);
	}

	private static void AddFractionToFraction(ref int numerator, ref int denominator, int addNumerator, int addDenominator)
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

	private static void ApplyDivisionToRightConstant(ref int numerator, ref int denominator, int divisor)
	{
		if (divisor == 0)
			return;

		if (denominator == 0)
			denominator = 1;

		int absDivisor = Mathf.Abs(divisor);
		denominator *= absDivisor;
		ReduceFraction(ref numerator, ref denominator);
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

		int gcd = Gcd(Mathf.Abs(numerator), Mathf.Abs(denominator));
		if (gcd > 1)
		{
			numerator /= gcd;
			denominator /= gcd;
		}

		if (denominator < 0)
		{
			denominator = -denominator;
			numerator = -numerator;
		}
	}

	private static void ApplySubstitution(ref EquationState state, StepOption option)
	{
		int valueNum = option.value;
		int valueDen = option.valueDenominator <= 0 ? 1 : option.valueDenominator;
		int constNum = state.substitutionConst;
		int constDen = state.substitutionConstDenominator <= 0 ? 1 : state.substitutionConstDenominator;
		int coef = state.substitutionVarCoef;

		int termNum = coef * valueNum;
		int termDen = valueDen;
		AddFractionToFraction(ref termNum, ref termDen, constNum, constDen);

		state.leftVarCoef = 1;
		state.leftConst = 0;
		state.leftConstDenominator = 1;
		state.rightVarCoef = 0;
		state.rightConst = termNum;
		state.rightConstDenominator = termDen;
		state.hasSubstitution = false;
		state.substitutionExpression = string.Empty;
		state.rawEquation = string.Empty;
	}

	private static int Lcm(int a, int b)
	{
		if (a == 0 || b == 0)
			return 0;
		return Mathf.Abs(a / Gcd(a, b) * b);
	}

	private static int Gcd(int a, int b)
	{
		while (b != 0)
		{
			int t = a % b;
			a = b;
			b = t;
		}
		return a == 0 ? 1 : a;
	}

	/// Creates the step string showing the operation being applied
	public string CreateOperationStepString(EquationState state, StepOption option)
	{
		string leftSide = FormatLeftSide(state.leftVarCoef, state.leftConst, state.leftConstDenominator);
		string rightSide = FormatRightSide(state.rightVarCoef, state.rightConst, state.rightConstDenominator);
		string formattedValue = FormatValue(option.value, option.valueDenominator);

		switch (option.operationType)
		{
			case OperationType.SubtractConstant:
				return $"{leftSide} - {formattedValue} = {rightSide} - {formattedValue}";

			case OperationType.AddConstant:
				return $"{leftSide} + {formattedValue} = {rightSide} + {formattedValue}";

			case OperationType.SubtractVariable:
				return $"{leftSide} - {option.value}x = {rightSide} - {option.value}x";

			case OperationType.AddVariable:
				return $"{leftSide} + {option.value}x = {rightSide} + {option.value}x";

				case OperationType.MultiplyByNegativeOne:
					return $"({leftSide}) * -1 = ({rightSide}) * -1";

				case OperationType.DivideByCoefficient:
					return $"{leftSide} \u00F7 {option.value} = {rightSide} \u00F7 {option.value}";

			default:
				return FormatEquation(state);
		}
	}

	/// Displays available options as buttons for player selection
	public void DisplayOptions(List<StepOption> options)
	{
		ClearOptions();
		currentOptions = options;

		if (optionsContainer == null || optionButtonPrefab == null)
		{
			Debug.LogWarning("EquationChoiceSystem: Options container or button prefab not assigned.");
			// Auto-select optimal option
			StepOption optimal = options.Find(o => o.isOptimal) ?? options[0];
			SelectOption(optimal);
			return;
		}

		waitingForPlayerChoice = true;

		// Setup layout group on container if needed
		EnsureLayoutGroup();

		for (int i = 0; i < options.Count; i++)
		{
			StepOption option = options[i];

			GameObject buttonObj = Instantiate(optionButtonPrefab, optionsContainer);
			optionButtons.Add(buttonObj);

			// Setup button size
			RectTransform rect = buttonObj.GetComponent<RectTransform>();
			if (rect != null)
			{
				rect.sizeDelta = new Vector2(buttonWidth, buttonHeight);
			}

			// Setup layout element for consistent sizing
			LayoutElement layoutElement = buttonObj.GetComponent<LayoutElement>();
			if (layoutElement == null)
			{
				layoutElement = buttonObj.AddComponent<LayoutElement>();
			}
			layoutElement.preferredWidth = buttonWidth;
			layoutElement.preferredHeight = buttonHeight;
			layoutElement.minWidth = buttonWidth;
			layoutElement.minHeight = buttonHeight;

			// Setup button text
			TextMeshProUGUI buttonText = buttonObj.GetComponentInChildren<TextMeshProUGUI>();
			if (buttonText != null)
			{
				buttonText.text = option.description;
				buttonText.alignment = TextAlignmentOptions.Center;
			}

			// Setup button color
			Image buttonImage = buttonObj.GetComponent<Image>();
			if (buttonImage != null)
			{
				buttonImage.color = (showOptimalHint && option.isOptimal) ? optionOptimalColor : optionNormalColor;
			}

			// Setup button click
			Button button = buttonObj.GetComponent<Button>();
			if (button != null)
			{
				int index = i;
				button.onClick.AddListener(() => SelectOption(options[index]));
			}

			// Animate button appearance
			if (rect != null)
			{
				rect.localScale = Vector3.zero;
				rect.DOScale(1f, buttonAnimationDuration).SetEase(Ease.OutBack).SetDelay(i * buttonStaggerDelay);
			}
		}

		// Force layout rebuild
		LayoutRebuilder.ForceRebuildLayoutImmediate(optionsContainer);
	}

	/// Ensures the container has a proper layout group for button alignment
	private void EnsureLayoutGroup()
	{
		if (optionsContainer == null) return;

		// Check if horizontal or vertical layout group exists
		HorizontalLayoutGroup hLayout = optionsContainer.GetComponent<HorizontalLayoutGroup>();
		VerticalLayoutGroup vLayout = optionsContainer.GetComponent<VerticalLayoutGroup>();

		// If neither exists, add a horizontal layout group by default
		if (hLayout == null && vLayout == null)
		{
			hLayout = optionsContainer.gameObject.AddComponent<HorizontalLayoutGroup>();
			hLayout.spacing = buttonSpacing;
			hLayout.childAlignment = buttonAlignment;
			hLayout.childControlWidth = false;
			hLayout.childControlHeight = false;
			hLayout.childForceExpandWidth = false;
			hLayout.childForceExpandHeight = false;
		}
		else if (hLayout != null)
		{
			// Update existing horizontal layout
			hLayout.spacing = buttonSpacing;
			hLayout.childAlignment = buttonAlignment;
		}
		else if (vLayout != null)
		{
			// Update existing vertical layout
			vLayout.spacing = buttonSpacing;
			vLayout.childAlignment = buttonAlignment;
		}
	}

	/// Displays options generated from current state
	public void DisplayCurrentOptions()
	{
		List<StepOption> options = GenerateAvailableOptions();
		if (options.Count > 0)
		{
			DisplayOptions(options);
		}
	}

	/// Called when player selects an option (or auto-selected)
	public void SelectOption(StepOption option)
	{
		if (!waitingForPlayerChoice && optionsContainer != null) return;

		waitingForPlayerChoice = false;
		ClearOptions();

		// Store the state BEFORE applying the option (for operation step display)
		stateBeforeLastOption = currentEquationState.Clone();

		// Apply the option to update state
		EquationState newState = ApplyOption(currentEquationState, option);
		currentEquationState = newState;

		// Fire events
		OnOptionSelected?.Invoke(option);
		OnStateChanged?.Invoke(newState);
	}

	/// Programmatically select an option by index
	public void SelectOptionByIndex(int index)
	{
		if (index >= 0 && index < currentOptions.Count)
		{
			SelectOption(currentOptions[index]);
		}
	}

	/// Select the optimal option automatically
	public void SelectOptimalOption()
	{
		StepOption optimal = currentOptions.Find(o => o.isOptimal);
		if (optimal != null)
		{
			SelectOption(optimal);
		}
		else if (currentOptions.Count > 0)
		{
			SelectOption(currentOptions[0]);
		}
	}

	/// Clears all option buttons
	public void ClearOptions()
	{
		foreach (GameObject button in optionButtons)
		{
			if (button != null)
			{
				Destroy(button);
			}
		}
		optionButtons.Clear();
		currentOptions.Clear();
		waitingForPlayerChoice = false;
	}

	/// Updates the current equation state directly
	public void SetState(EquationState state)
	{
		currentEquationState = state;
		OnStateChanged?.Invoke(state);
	}

	#region Formatting Helpers

	public string FormatEquation(EquationState state)
	{
		if (state != null && (state.hasBrackets || state.hasSubstitution) && !string.IsNullOrWhiteSpace(state.rawEquation))
			return state.rawEquation;

		return FormatLeftSide(state.leftVarCoef, state.leftConst, state.leftConstDenominator) + " = " +
			   FormatRightSide(state.rightVarCoef, state.rightConst, state.rightConstDenominator);
	}

	public string FormatLeftSide(int varCoef, int constVal)
	{
		return FormatLeftSide(varCoef, constVal, 1);
	}

	public string FormatLeftSide(int varCoef, int constVal, int constDenominator)
	{
		string left = "";

		if (varCoef != 0)
		{
			if (varCoef == 1)
				left = "x";
			else if (varCoef == -1)
				left = "-x";
			else
				left = varCoef + "x";
		}

		if (constVal != 0)
		{
			string absConst = FormatAbsoluteFraction(Mathf.Abs(constVal), constDenominator);
			if (left != "")
			{
				if (constVal > 0)
					left += " + " + absConst;
				else
					left += " - " + absConst;
			}
			else
			{
				left = constVal < 0 ? "-" + absConst : FormatAbsoluteFraction(constVal, constDenominator);
			}
		}

		if (left == "")
			left = "0";

		return left;
	}

	public string FormatRightSide(int varCoef, int constVal)
	{
		return FormatRightSide(varCoef, constVal, 1);
	}

	public string FormatRightSide(int varCoef, int constVal, int constDenominator)
	{
		string right = "";

		if (varCoef != 0)
		{
			if (varCoef == 1)
				right = "x";
			else if (varCoef == -1)
				right = "-x";
			else
				right = varCoef + "x";
		}

		if (constVal != 0)
		{
			string absConst = FormatAbsoluteFraction(Mathf.Abs(constVal), constDenominator);
			if (right != "")
			{
				if (constVal > 0)
					right += " + " + absConst;
				else
					right += " - " + absConst;
			}
			else
			{
				right = constVal < 0 ? "-" + absConst : FormatAbsoluteFraction(constVal, constDenominator);
			}
		}

		if (right == "")
			right = "0";

		return right;
	}

	private static string FormatAbsoluteFraction(int numeratorAbs, int denominator)
	{
		if (denominator <= 1)
			return numeratorAbs.ToString();

		if (AlgebraRuntimeConfig.AllowDecimals)
		{
			float value = numeratorAbs / (float)denominator;
			return value.ToString("0.###");
		}

		return $"{numeratorAbs}/{denominator}";
	}

	private static string FormatValue(int numeratorAbs, int denominator)
	{
		if (denominator <= 1)
			return numeratorAbs.ToString();

		if (AlgebraRuntimeConfig.AllowDecimals)
		{
			float value = numeratorAbs / (float)denominator;
			return value.ToString("0.###");
		}

		return $"{numeratorAbs}/{denominator}";
	}

	#endregion
}
