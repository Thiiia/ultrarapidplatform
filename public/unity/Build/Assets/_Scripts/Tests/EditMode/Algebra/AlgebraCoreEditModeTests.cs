using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class AlgebraCoreEditModeTests
{
	private struct RuntimeConfigSnapshot
	{
		public EquationDataSet.SchoolYear schoolYear;
		public bool allowDecimals;
		public bool allowFractions;
		public bool enableSubstitution;
		public bool allowBrackets;
		public bool allowVariablesOnBothSides;
		public int maxAbsCoefficient;
		public int maxAbsConstantNumerator;
		public int maxAbsConstantDenominator;
	}

	private RuntimeConfigSnapshot snapshot;

	[SetUp]
	public void SetUp()
	{
		snapshot = CaptureRuntimeConfig();
		AlgebraRuntimeConfig.SetSchoolYear(EquationDataSet.SchoolYear.Year7);
		AlgebraRuntimeConfig.SetEquationToggles(allowDecimals: false, allowFractions: false, enableSubstitution: false);
		AlgebraRuntimeConfig.SetEquationConstraints(
			allowBrackets: true,
			allowVariablesOnBothSides: true,
			maxAbsCoefficient: 50,
			maxAbsConstantNumerator: 200,
			maxAbsConstantDenominator: 24);
	}

	[TearDown]
	public void TearDown()
	{
		RestoreRuntimeConfig(snapshot);
	}

	[Test]
	public void Parser_RespectsFeatureToggles_ForDecimalsFractionsAndSubstitution()
	{
		Assert.IsFalse(
			LinearEquationParser.TryParse("x + 0.5 = 2.0", allowDecimals: false, allowFractions: true, enableSubstitution: false, out _),
			"Decimal parse should fail when decimals are disabled.");

		Assert.IsTrue(
			LinearEquationParser.TryParse("x + 0.5 = 2.0", allowDecimals: true, allowFractions: true, enableSubstitution: false, out _),
			"Decimal parse should pass when decimals are enabled.");

		Assert.IsFalse(
			LinearEquationParser.TryParse("x + 1/2 = 5/2", allowDecimals: true, allowFractions: false, enableSubstitution: false, out _),
			"Fraction parse should fail when fractions are disabled.");

		Assert.IsTrue(
			LinearEquationParser.TryParse("x + 1/2 = 5/2", allowDecimals: true, allowFractions: true, enableSubstitution: false, out _),
			"Fraction parse should pass when fractions are enabled.");

		Assert.IsFalse(
			LinearEquationParser.TryParse("SUB:x=3; 2x+1", allowDecimals: true, allowFractions: true, enableSubstitution: false, out _),
			"Substitution parse should fail when substitution is disabled.");

		Assert.IsTrue(
			LinearEquationParser.TryParse("SUB:x=3; 2x+1", allowDecimals: true, allowFractions: true, enableSubstitution: true, out _),
			"Substitution parse should pass when substitution is enabled.");
	}

	[Test]
	public void Policy_EnforcesBoundsAndBothSidesRules()
	{
		AlgebraRuntimeConfig.SetEquationConstraints(
			allowBrackets: true,
			allowVariablesOnBothSides: false,
			maxAbsCoefficient: 5,
			maxAbsConstantNumerator: 10,
			maxAbsConstantDenominator: 4);

		EquationState bothSides = new EquationState(2, 1, 1, 3);
		Assert.IsFalse(EquationPolicy.IsStateWithinBounds(bothSides));

		EquationState denominatorTooLarge = new EquationState(1, 1, 0, 3)
		{
			leftConstDenominator = 5
		};
		Assert.IsFalse(EquationPolicy.IsStateWithinBounds(denominatorTooLarge));

		AlgebraRuntimeConfig.SetEquationConstraints(
			allowBrackets: true,
			allowVariablesOnBothSides: true,
			maxAbsCoefficient: 5,
			maxAbsConstantNumerator: 10,
			maxAbsConstantDenominator: 4);

		EquationState valid = new EquationState(2, 3, 0, 7)
		{
			leftConstDenominator = 2,
			rightConstDenominator = 1
		};
		Assert.IsTrue(EquationPolicy.IsStateWithinBounds(valid));
	}

	[Test]
	public void ChoiceGeneration_AlwaysProvidesAnOptimalOption_WhenOptionsExist()
	{
		GameObject go = new GameObject("EquationChoiceSystemTest");
		try
		{
			EquationChoiceSystem choiceSystem = go.AddComponent<EquationChoiceSystem>();

			List<StepOption> standard = choiceSystem.GenerateAvailableOptions(new EquationState(3, 4, 0, 19));
			Assert.IsNotEmpty(standard);
			Assert.IsTrue(standard.Exists(option => option != null && option.isOptimal));

			List<StepOption> bracket = choiceSystem.GenerateAvailableOptions(new EquationState(0, 0, 0, 0, brackets: true, raw: "2(x+3)=14"));
			Assert.IsNotEmpty(bracket);
			Assert.IsTrue(bracket.Exists(option => option != null && option.isOptimal));

			EquationState substitutionState = new EquationState(0, 0, 0, 0)
			{
				hasSubstitution = true,
				substitutionValue = 3,
				substitutionValueDenominator = 1,
				substitutionVarCoef = 2,
				substitutionConst = 1,
				substitutionConstDenominator = 1
			};
			List<StepOption> substitution = choiceSystem.GenerateAvailableOptions(substitutionState);
			Assert.IsNotEmpty(substitution);
			Assert.IsTrue(substitution.Exists(option => option != null && option.isOptimal));
		}
		finally
		{
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void ApplyOption_TransformsState_ForConstantVariableDivisionAndSubstitution()
	{
		GameObject go = new GameObject("EquationChoiceSystemApplyTest");
		try
		{
			EquationChoiceSystem choiceSystem = go.AddComponent<EquationChoiceSystem>();

			EquationState constantState = new EquationState(1, 4, 0, 9);
			EquationState afterConstant = choiceSystem.ApplyOption(constantState, new StepOption("- 4", OperationType.SubtractConstant, 4, true));
			Assert.AreEqual(0, afterConstant.leftConst);
			Assert.AreEqual(5, afterConstant.rightConst);
			Assert.AreEqual(1, afterConstant.leftConstDenominator);
			Assert.AreEqual(1, afterConstant.rightConstDenominator);

			EquationState variableState = new EquationState(3, 0, 1, 4);
			EquationState afterVariable = choiceSystem.ApplyOption(variableState, new StepOption("- x", OperationType.SubtractVariable, 1, true));
			Assert.AreEqual(2, afterVariable.leftVarCoef);
			Assert.AreEqual(0, afterVariable.rightVarCoef);
			Assert.AreEqual(4, afterVariable.rightConst);

			EquationState divisionState = new EquationState(4, 0, 0, 10);
			EquationState afterDivision = choiceSystem.ApplyOption(divisionState, new StepOption("/ 4", OperationType.DivideByCoefficient, 4, true));
			Assert.AreEqual(1, afterDivision.leftVarCoef);
			Assert.AreEqual(5, afterDivision.rightConst);
			Assert.AreEqual(2, afterDivision.rightConstDenominator);

			EquationState substitutionState = new EquationState(0, 0, 0, 0)
			{
				hasSubstitution = true,
				substitutionVarCoef = 2,
				substitutionConst = 3,
				substitutionConstDenominator = 1
			};
			EquationState afterSubstitution = choiceSystem.ApplyOption(substitutionState, new StepOption("Substitute", OperationType.SubstituteValue, 3, true, 1));
			Assert.AreEqual(1, afterSubstitution.leftVarCoef);
			Assert.AreEqual(0, afterSubstitution.leftConst);
			Assert.AreEqual(0, afterSubstitution.rightVarCoef);
			Assert.AreEqual(9, afterSubstitution.rightConst);
			Assert.AreEqual(1, afterSubstitution.rightConstDenominator);
			Assert.IsFalse(afterSubstitution.hasSubstitution);
		}
		finally
		{
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void SkillTagInference_ClassifiesNormalizedEquations()
	{
		Assert.AreEqual(EquationSkillTag.MoveConstant, EquationSkillTagUtility.InferFromEquation("x + 4 = 9"));
		Assert.AreEqual(EquationSkillTag.MoveVariable, EquationSkillTagUtility.InferFromEquation("3x + 1 = x + 7"));
		Assert.AreEqual(EquationSkillTag.DivideByCoefficient, EquationSkillTagUtility.InferFromEquation("4x = 20"));
		Assert.AreEqual(EquationSkillTag.ExpandBrackets, EquationSkillTagUtility.InferFromEquation("2(x + 3) = 14"));
		Assert.AreEqual(EquationSkillTag.Substitution, EquationSkillTagUtility.InferFromEquation(" SUB:x=3; 2x+1 "));
		Assert.AreEqual(EquationSkillTag.SignFlip, EquationSkillTagUtility.InferFromEquation("-x = 5"));
	}

	[Test]
	public void EquationDataSet_EntriesParseForTheirYear_AndAvoidLowQualityFormatting()
	{
		EquationDataSet dataSet = Resources.Load<EquationDataSet>("EquationDataSet");
		Assert.IsNotNull(dataSet, "Expected Resources/EquationDataSet.asset to exist for algebra content validation.");

		List<EquationDataSet.DifficultyLevel> levels = dataSet.GetAllLevels();
		Assert.IsNotNull(levels);
		Assert.IsNotEmpty(levels);

		for (int i = 0; i < levels.Count; i++)
		{
			EquationDataSet.DifficultyLevel level = levels[i];
			if (level == null)
				continue;

			AlgebraRuntimeConfig.SetSchoolYear(level.schoolYear);

			if (level.equations != null)
			{
				for (int equationIndex = 0; equationIndex < level.equations.Count; equationIndex++)
				{
					ValidateEquationForLevel(level.levelName, level.schoolYear, $"legacy[{equationIndex}]", level.equations[equationIndex]);
				}
			}

			if (level.entries != null)
			{
				for (int entryIndex = 0; entryIndex < level.entries.Count; entryIndex++)
				{
					EquationEntry entry = level.entries[entryIndex];
					if (entry == null)
						continue;

					Assert.IsTrue(
						entry.IsMetadataComplete(),
						$"{level.levelName}/{level.schoolYear}/{entry.id ?? $"entry[{entryIndex}]"} has incomplete metadata.");

					ValidateEquationForLevel(level.levelName, level.schoolYear, entry.id ?? $"entry[{entryIndex}]", entry.equation);
				}
			}
		}
	}

	[Test]
	public void EquationPathHemisphereClassifier_DistinguishesUpperLowerAndNeutralPaths()
	{
		MethodInfo classify = typeof(DragExecutionController).GetMethod(
			"ClassifyEquationPathHemisphere",
			BindingFlags.Static | BindingFlags.NonPublic);

		Assert.IsNotNull(classify, "Expected private path hemisphere classifier to exist.");

		object upper = classify.Invoke(null, new object[]
		{
			new List<Vector2>
			{
				new Vector2(-120f, 0f),
				new Vector2(-60f, 36f),
				new Vector2(0f, 54f),
				new Vector2(60f, 32f),
				new Vector2(120f, 0f)
			},
			8f,
			0.22f
		});
		object lower = classify.Invoke(null, new object[]
		{
			new List<Vector2>
			{
				new Vector2(-120f, 0f),
				new Vector2(-60f, -34f),
				new Vector2(0f, -52f),
				new Vector2(60f, -30f),
				new Vector2(120f, 0f)
			},
			8f,
			0.22f
		});
		object neutral = classify.Invoke(null, new object[]
		{
			new List<Vector2>
			{
				new Vector2(-120f, 0f),
				new Vector2(-60f, 3f),
				new Vector2(0f, 5f),
				new Vector2(60f, 2f),
				new Vector2(120f, 0f)
			},
			8f,
			0.22f
		});

		Assert.AreEqual("Upper", upper?.ToString());
		Assert.AreEqual("Lower", lower?.ToString());
		Assert.AreEqual("Neutral", neutral?.ToString());
	}

	[Test]
	public void DotSpriteMode_DoesNotForcePlaceholderCanonicalPathSelection()
	{
		GameObject go = new GameObject("DragExecutionControllerDotModePathTest");
		Texture2D texture = null;
		Sprite sprite = null;

		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo shouldForce = controllerType.GetMethod(
				"ShouldForceCanonicalPathForPlaceholderArcSprites",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(shouldForce, "Expected placeholder canonical path helper to exist.");

			FieldInfo forceCanonical = controllerType.GetField("wispPlaceholderArcSpritesForceCanonicalPath", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo arcUnits2 = controllerType.GetField("wispArcSpriteUnits2", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo dotSprite = controllerType.GetField("wispDotSprite", BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(forceCanonical);
			Assert.IsNotNull(arcUnits2);
			Assert.IsNotNull(dotSprite);

			texture = new Texture2D(2, 2);
			sprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f));

			forceCanonical.SetValue(controller, true);
			arcUnits2.SetValue(controller, sprite);
			dotSprite.SetValue(controller, null);
			bool forcedWithoutDot = (bool)shouldForce.Invoke(controller, null);

			dotSprite.SetValue(controller, sprite);
			bool forcedWithDot = (bool)shouldForce.Invoke(controller, null);

			Assert.IsTrue(forcedWithoutDot, "Expected placeholder arc workflow to preserve canonical forcing when no dot sprite is assigned.");
			Assert.IsFalse(forcedWithDot, "Dot sprite mode should not collapse path selection to placeholder canonical arcs.");
		}
		finally
		{
			if (sprite != null)
			{
				Object.DestroyImmediate(sprite);
			}

			if (texture != null)
			{
				Object.DestroyImmediate(texture);
			}

			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void SourceApproachRing_DotModeKeepsCueLocalToBubble()
	{
		GameObject go = new GameObject("DragExecutionControllerSourceRingScaleTest");
		Texture2D texture = null;
		Sprite sprite = null;

		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo getScale = controllerType.GetMethod(
				"GetScaledSourceBubbleApproachRingStartScale",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(getScale, "Expected source approach-ring scale helper to exist.");

			FieldInfo algebraScale = controllerType.GetField("algebraApproachRingScaleMultiplier", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo sourceScale = controllerType.GetField("sourceBubbleApproachRingStartScale", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo dotSprite = controllerType.GetField("wispDotSprite", BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(algebraScale);
			Assert.IsNotNull(sourceScale);
			Assert.IsNotNull(dotSprite);

			texture = new Texture2D(2, 2);
			sprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f));

			algebraScale.SetValue(controller, 3.25f);
			sourceScale.SetValue(controller, 1.6f);
			dotSprite.SetValue(controller, sprite);

			float scaled = (float)getScale.Invoke(controller, null);

			Assert.AreEqual(1.6f, scaled, 0.001f, "Dot-mode source cue should not inherit the large equation-wide ring multiplier.");
		}
		finally
		{
			if (sprite != null)
			{
				Object.DestroyImmediate(sprite);
			}

			if (texture != null)
			{
				Object.DestroyImmediate(texture);
			}

			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void DotPathRuntime_UsesActualEndpointsWhenVisualRowOffsetsDiffer()
	{
		GameObject go = new GameObject("DragExecutionControllerDotPathEndpointTest");
		Texture2D texture = null;
		Sprite sprite = null;

		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo rebuild = controllerType.GetMethod(
				"RebuildWispPathSymmetricForDotSprite",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(rebuild, "Expected dot-path runtime rebuild helper to exist.");

			FieldInfo dotSprite = controllerType.GetField("wispDotSprite", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentPath = controllerType.GetField("currentWispPath", BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(dotSprite);
			Assert.IsNotNull(currentPath);

			texture = new Texture2D(2, 2);
			sprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f));
			dotSprite.SetValue(controller, sprite);

			Vector2 start = new Vector2(-80f, 12f);
			Vector2 end = new Vector2(80f, 44f);
			rebuild.Invoke(controller, new object[] { start, end });

			List<Vector2> points = currentPath.GetValue(controller) as List<Vector2>;
			Assert.IsNotNull(points);
			Assert.GreaterOrEqual(points.Count, 2);
			Assert.AreEqual(start.x, points[0].x, 0.001f);
			Assert.AreEqual(start.y, points[0].y, 0.001f, "Dot path should start from the live source anchor, not a flattened baseline.");

			Vector2 last = points[points.Count - 1];
			Assert.AreEqual(end.x, last.x, 0.001f);
			Assert.AreEqual(end.y, last.y, 0.001f);
		}
		finally
		{
			if (sprite != null)
			{
				Object.DestroyImmediate(sprite);
			}

			if (texture != null)
			{
				Object.DestroyImmediate(texture);
			}

			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void DotPathRuntime_UsesResolvedUpperHemisphereInsteadOfAlwaysBendingDown()
	{
		GameObject go = new GameObject("DragExecutionControllerDotPathHemisphereTest");
		Texture2D texture = null;
		Sprite sprite = null;

		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo rebuild = controllerType.GetMethod(
				"RebuildWispPathSymmetricForDotSprite",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(rebuild, "Expected dot-path runtime rebuild helper to exist.");

			FieldInfo dotSprite = controllerType.GetField("wispDotSprite", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentPath = controllerType.GetField("currentWispPath", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo activeHemisphere = controllerType.GetField("activeEquationPathHemisphere", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentStyle = controllerType.GetField("currentWispPathStyle", BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(dotSprite);
			Assert.IsNotNull(currentPath);
			Assert.IsNotNull(activeHemisphere);
			Assert.IsNotNull(currentStyle);

			texture = new Texture2D(2, 2);
			sprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f));
			dotSprite.SetValue(controller, sprite);
			activeHemisphere.SetValue(controller, System.Enum.ToObject(activeHemisphere.FieldType, 1));
			currentStyle.SetValue(controller, System.Enum.ToObject(currentStyle.FieldType, 1));

			Vector2 start = new Vector2(-80f, 0f);
			Vector2 end = new Vector2(80f, 0f);
			rebuild.Invoke(controller, new object[] { start, end });

			List<Vector2> points = currentPath.GetValue(controller) as List<Vector2>;
			Assert.IsNotNull(points);
			Assert.GreaterOrEqual(points.Count, 3);

			Vector2 mid = points[points.Count / 2];
			Assert.Greater(mid.y, 0.001f, "Dot runtime should respect the resolved upper hemisphere instead of collapsing back to a lower U-shape.");
		}
		finally
		{
			if (sprite != null)
			{
				Object.DestroyImmediate(sprite);
			}

			if (texture != null)
			{
				Object.DestroyImmediate(texture);
			}

			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void CaptureResolvedWispPathState_PromotesPreparedWindowToResolvedSourceOfTruth()
	{
		GameObject go = new GameObject("DragExecutionControllerResolvedWindowStateTest");
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo prepareWindow = controllerType.GetMethod(
				"PrepareWispWindowState",
				BindingFlags.Instance | BindingFlags.NonPublic);
			MethodInfo captureResolved = controllerType.GetMethod(
				"CaptureResolvedWispPathState",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(prepareWindow, "Expected window-state preparation helper to exist.");
			Assert.IsNotNull(captureResolved, "Expected resolved path capture helper to exist.");

			FieldInfo currentStyle = controllerType.GetField("currentWispPathStyle", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentTemplate = controllerType.GetField("currentWispResolvedTemplateMode", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentBucket = controllerType.GetField("currentWispPathUnitBucket", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentFlipX = controllerType.GetField("currentWispPathUnitFlipX", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentFlipY = controllerType.GetField("currentWispPathUnitFlipY", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo currentPath = controllerType.GetField("currentWispPath", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo activeWindow = controllerType.GetField("activeWispWindowState", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo lockedStyle = controllerType.GetField("lockedWindowPathStyle", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo lockedHemisphere = controllerType.GetField("lockedWindowEquationPathHemisphere", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo lockedTemplate = controllerType.GetField("lockedWindowTemplateMode", BindingFlags.Instance | BindingFlags.NonPublic);
			FieldInfo lockedBucket = controllerType.GetField("lockedWindowPathUnitBucket", BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(currentStyle);
			Assert.IsNotNull(currentTemplate);
			Assert.IsNotNull(currentBucket);
			Assert.IsNotNull(currentFlipX);
			Assert.IsNotNull(currentFlipY);
			Assert.IsNotNull(currentPath);
			Assert.IsNotNull(activeWindow);
			Assert.IsNotNull(lockedStyle);
			Assert.IsNotNull(lockedHemisphere);
			Assert.IsNotNull(lockedTemplate);
			Assert.IsNotNull(lockedBucket);

			object initialStyle = System.Enum.ToObject(currentStyle.FieldType, 0);
			object initialHemisphere = System.Enum.ToObject(lockedHemisphere.FieldType, 1);
			prepareWindow.Invoke(controller, new[] { initialStyle, initialHemisphere });

			currentStyle.SetValue(controller, System.Enum.ToObject(currentStyle.FieldType, 1));
			currentTemplate.SetValue(controller, System.Enum.ToObject(currentTemplate.FieldType, 3));
			currentBucket.SetValue(controller, System.Enum.ToObject(currentBucket.FieldType, 4));
			currentFlipX.SetValue(controller, true);
			currentFlipY.SetValue(controller, true);
			currentPath.SetValue(controller, new List<Vector2>
			{
				new Vector2(-100f, 0f),
				new Vector2(0f, -46f),
				new Vector2(100f, 0f),
			});

			captureResolved.Invoke(controller, null);

			object window = activeWindow.GetValue(controller);
			Assert.IsNotNull(window);

			System.Type windowType = window.GetType();
			FieldInfo windowStyle = windowType.GetField("pathStyle", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
			FieldInfo windowHemisphere = windowType.GetField("pathHemisphere", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
			FieldInfo windowTemplate = windowType.GetField("templateMode", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
			FieldInfo windowBucket = windowType.GetField("pathUnitBucket", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
			FieldInfo windowResolved = windowType.GetField("hasResolvedPathState", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);

			Assert.IsNotNull(windowStyle);
			Assert.IsNotNull(windowHemisphere);
			Assert.IsNotNull(windowTemplate);
			Assert.IsNotNull(windowBucket);
			Assert.IsNotNull(windowResolved);

			Assert.AreEqual("ArcDown", windowStyle.GetValue(window)?.ToString());
			Assert.AreEqual("Lower", windowHemisphere.GetValue(window)?.ToString());
			Assert.AreEqual("HalfRectangle", windowTemplate.GetValue(window)?.ToString());
			Assert.AreEqual("Units4", windowBucket.GetValue(window)?.ToString());
			Assert.IsTrue((bool)windowResolved.GetValue(window), "Prepared window state should become the resolved path authority after capture.");

			Assert.AreEqual("ArcDown", lockedStyle.GetValue(controller)?.ToString());
			Assert.AreEqual("Lower", lockedHemisphere.GetValue(controller)?.ToString());
			Assert.AreEqual("HalfRectangle", lockedTemplate.GetValue(controller)?.ToString());
			Assert.AreEqual("Units4", lockedBucket.GetValue(controller)?.ToString());
		}
		finally
		{
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void EquationRepeatMotion_UsesConfiguredVerticalPatternRadius()
	{
		GameObject go = new GameObject("DragExecutionControllerRepeatMotionTest");
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo getOffset = controllerType.GetMethod(
				"GetEquationRepeatTargetOffsetForCurrentStep",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(getOffset, "Expected repeat-motion offset helper to exist.");

			controllerType.GetField("moveEquationBetweenRepeats", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("moveEquationOnlyDuringRepeatSteps", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("equationFollowPathHemisphere", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, false);
			controllerType.GetField("equationRepeatMoveCenterOffset", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, Vector2.zero);
			controllerType.GetField("equationRepeatMotionBaselineOffset", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, Vector2.zero);
			controllerType.GetField("equationRepeatMoveRadiusX", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 100f);
			controllerType.GetField("equationRepeatMoveRadiusY", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 200f);
			controllerType.GetField("currentStepRequiredDrags", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 5);
			controllerType.GetField("currentStepDragCount", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 1);

			Vector2 offset = (Vector2)getOffset.Invoke(controller, null);

			Assert.AreEqual(-38f, offset.x, 0.001f);
			Assert.AreEqual(10f, offset.y, 0.001f);
		}
		finally
		{
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void ApproachCueRuntimeReset_LeavesAllCueStateIdle()
	{
		GameObject go = new GameObject("DragExecutionControllerStateTest");
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			MethodInfo reset = typeof(DragExecutionController).GetMethod(
				"ResetApproachCueRuntimeState",
				BindingFlags.Instance | BindingFlags.NonPublic);
			MethodInfo snapshot = typeof(DragExecutionController).GetMethod(
				"BuildApproachCueDebugSnapshot",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(reset, "Expected cue-state reset helper to exist.");
			Assert.IsNotNull(snapshot, "Expected cue-state debug snapshot helper to exist.");

			reset.Invoke(controller, new object[] { true });
			object debugSnapshot = snapshot.Invoke(controller, null);
			string summary = debugSnapshot?.ToString() ?? string.Empty;

			StringAssert.Contains("SourceBubble:idle", summary);
			StringAssert.Contains("MovingTarget:idle", summary);
			StringAssert.Contains("ActiveDrag:idle", summary);
			StringAssert.Contains("window:idle", summary);
		}
		finally
		{
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void CanBuildHitZoneWindow_AllowsDragBootstrapWhileEquationRowSettles()
	{
		GameObject go = new GameObject("DragExecutionControllerDragBootstrapTest");
		GameObject bubbleGo = new GameObject("DragBootstrapBubble", typeof(RectTransform));
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo canBuild = controllerType.GetMethod(
				"CanBuildHitZoneWindow",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(canBuild, "Expected hit-zone window gate helper to exist.");

			controllerType.GetField("equationAtTop", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("isBubbleAnimating", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("currentState", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, new EquationState(2, 3, 0, 9));

			EquationBubbleElement dragBubble = bubbleGo.AddComponent<EquationBubbleElement>();
			controllerType.GetField("currentDraggingElement", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, dragBubble);

			bool withoutDragBypass = (bool)canBuild.Invoke(controller, new object[] { false });
			bool withDragBypass = (bool)canBuild.Invoke(controller, new object[] { true });

			Assert.IsFalse(withoutDragBypass, "Idle preview should still respect the bubble-animation gate.");
			Assert.IsTrue(withDragBypass, "Active drags should be allowed to bootstrap the path while the row is still settling.");
		}
		finally
		{
			Object.DestroyImmediate(bubbleGo);
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void ResolveDotRuntimeBendDown_FlipsToReadableHemisphereWhenLowerWouldCrease()
	{
		GameObject go = new GameObject("DragExecutionControllerDotRuntimeBendTest");
		GameObject sourceGo = new GameObject("DotRuntimeSource", typeof(RectTransform));
		GameObject targetGo = new GameObject("DotRuntimeTarget", typeof(RectTransform));
		Texture2D texture = null;
		Sprite sprite = null;
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo resolve = controllerType.GetMethod(
				"ResolveDotRuntimeBendDown",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(resolve, "Expected dot-runtime bend resolver to exist.");

			texture = new Texture2D(2, 2);
			sprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f));
			controllerType.GetField("wispDotSprite", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, sprite);
			controllerType.GetField("activeEquationPathHemisphere", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(
				controller,
				System.Enum.ToObject(controllerType.GetField("activeEquationPathHemisphere", BindingFlags.Instance | BindingFlags.NonPublic).FieldType, 2));

			EquationBubbleElement source = sourceGo.AddComponent<EquationBubbleElement>();
			EquationBubbleElement target = targetGo.AddComponent<EquationBubbleElement>();
			RectTransform sourceRect = sourceGo.GetComponent<RectTransform>();
			RectTransform targetRect = targetGo.GetComponent<RectTransform>();
			sourceRect.anchoredPosition = new Vector2(0f, 120f);
			targetRect.anchoredPosition = new Vector2(260f, 0f);
			typeof(EquationBubbleElement).GetField("rectTransform", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(source, sourceRect);
			typeof(EquationBubbleElement).GetField("rectTransform", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(target, targetRect);

			controllerType.GetField("currentDraggingElement", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, source);
			controllerType.GetField("currentDropZone", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, target);

			bool bendDown = (bool)resolve.Invoke(controller, new object[]
			{
				sourceRect.anchoredPosition,
				targetRect.anchoredPosition
			});

			Assert.IsFalse(bendDown, "Dot runtime should flip to the upper bend when the planned lower path would create an overly creased shoulder.");
		}
		finally
		{
			if (sprite != null)
			{
				Object.DestroyImmediate(sprite);
			}

			if (texture != null)
			{
				Object.DestroyImmediate(texture);
			}

			Object.DestroyImmediate(sourceGo);
			Object.DestroyImmediate(targetGo);
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void NeedsIdleJourneyPreviewRebuild_ReturnsTrueAfterLayoutChangeInvalidatesResolvedWindow()
	{
		GameObject go = new GameObject("DragExecutionControllerIdlePreviewRebuildTest");
		GameObject sourceGo = new GameObject("IdlePreviewSource", typeof(RectTransform));
		GameObject targetGo = new GameObject("IdlePreviewTarget", typeof(RectTransform));
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo prepareWindow = controllerType.GetMethod(
				"PrepareWispWindowState",
				BindingFlags.Instance | BindingFlags.NonPublic);
			MethodInfo captureResolved = controllerType.GetMethod(
				"CaptureResolvedWispPathState",
				BindingFlags.Instance | BindingFlags.NonPublic);
			MethodInfo invalidate = controllerType.GetMethod(
				"InvalidateApproachCueStateForLayoutChange",
				BindingFlags.Instance | BindingFlags.NonPublic);
			MethodInfo needsRebuild = controllerType.GetMethod(
				"NeedsIdleJourneyPreviewRebuild",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(prepareWindow, "Expected window-state preparation helper to exist.");
			Assert.IsNotNull(captureResolved, "Expected path-state capture helper to exist.");
			Assert.IsNotNull(invalidate, "Expected layout invalidation helper to exist.");
			Assert.IsNotNull(needsRebuild, "Expected idle-preview rebuild helper to exist.");

			EquationBubbleElement source = sourceGo.AddComponent<EquationBubbleElement>();
			EquationBubbleElement target = targetGo.AddComponent<EquationBubbleElement>();
			RectTransform sourceRect = sourceGo.GetComponent<RectTransform>();
			RectTransform targetRect = targetGo.GetComponent<RectTransform>();
			sourceRect.anchoredPosition = new Vector2(0f, 0f);
			targetRect.anchoredPosition = new Vector2(240f, -60f);
			typeof(EquationBubbleElement).GetField("rectTransform", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(source, sourceRect);
			typeof(EquationBubbleElement).GetField("rectTransform", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(target, targetRect);

			controllerType.GetField("enableJourneyGuidance", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("journeyShowWispWhileIdle", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("lockPathPerHitZoneWindow", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("journeySuggestedElement", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, source);
			controllerType.GetField("journeySuggestedDropZone", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, target);
			controllerType.GetField("journeyWispStart", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, sourceRect.anchoredPosition);
			controllerType.GetField("journeyWispEnd", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, targetRect.anchoredPosition);

			List<Vector2> path = controllerType.GetField("currentWispPath", BindingFlags.Instance | BindingFlags.NonPublic)?.GetValue(controller) as List<Vector2>;
			Assert.IsNotNull(path, "Expected runtime wisp path storage to exist.");
			path.Clear();
			path.Add(sourceRect.anchoredPosition);
			path.Add(new Vector2(120f, 90f));
			path.Add(targetRect.anchoredPosition);

			FieldInfo currentStyleField = controllerType.GetField("currentWispPathStyle", BindingFlags.Instance | BindingFlags.NonPublic);
			Assert.IsNotNull(currentStyleField, "Expected current path style field to exist.");
			currentStyleField.SetValue(controller, System.Enum.Parse(currentStyleField.FieldType, "ArcUp"));

			object style = System.Enum.Parse(prepareWindow.GetParameters()[0].ParameterType, "ArcUp");
			object hemisphere = System.Enum.Parse(prepareWindow.GetParameters()[1].ParameterType, "Upper");
			prepareWindow.Invoke(controller, new[] { style, hemisphere });
			captureResolved.Invoke(controller, null);

			bool beforeInvalidate = (bool)needsRebuild.Invoke(controller, null);
			Assert.IsFalse(beforeInvalidate, "A freshly captured idle preview should not be considered stale.");

			invalidate.Invoke(controller, new object[] { true });

			bool afterInvalidate = (bool)needsRebuild.Invoke(controller, null);
			Assert.IsTrue(afterInvalidate, "Geometry invalidation should force the idle preview to rebuild instead of reusing stale path state.");
		}
		finally
		{
			Object.DestroyImmediate(sourceGo);
			Object.DestroyImmediate(targetGo);
			Object.DestroyImmediate(go);
		}
	}

	[Test]
	public void BuildJourneyGuidanceKey_ChangesWhenEquationMovesToANewRepeatPosition()
	{
		GameObject go = new GameObject("DragExecutionControllerJourneyPlacementKeyTest");
		GameObject sourceGo = new GameObject("JourneySource", typeof(RectTransform));
		GameObject targetGo = new GameObject("JourneyTarget", typeof(RectTransform));
		try
		{
			DragExecutionController controller = go.AddComponent<DragExecutionController>();
			System.Type controllerType = typeof(DragExecutionController);
			MethodInfo buildKey = controllerType.GetMethod(
				"BuildJourneyGuidanceKey",
				BindingFlags.Instance | BindingFlags.NonPublic);

			Assert.IsNotNull(buildKey, "Expected journey guidance key helper to exist.");

			EquationBubbleElement source = sourceGo.AddComponent<EquationBubbleElement>();
			EquationBubbleElement target = targetGo.AddComponent<EquationBubbleElement>();

			typeof(EquationBubbleElement).GetField("equationSide", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(source, 0);
			typeof(EquationBubbleElement).GetField("equationSide", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(target, 1);
			typeof(EquationBubbleElement).GetField("elementType", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(source, BubbleElementType.Constant);
			typeof(EquationBubbleElement).GetField("numericValue", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(source, 6);

			controllerType.GetField("moveEquationBetweenRepeats", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, true);
			controllerType.GetField("currentStepRequiredDrags", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 5);
			controllerType.GetField("equationRepeatMoveRadiusX", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 100f);
			controllerType.GetField("equationRepeatMoveRadiusY", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 200f);
			controllerType.GetField("bubbleSize", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 100f);
			controllerType.GetField("currentState", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, new EquationState(1, 6, 0, 20));
			controllerType.GetField("rightDropZone", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, target);

			controllerType.GetField("currentStepDragCount", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 0);
			string firstKey = buildKey.Invoke(controller, new object[] { source, target }) as string;

			controllerType.GetField("currentStepDragCount", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(controller, 1);
			string secondKey = buildKey.Invoke(controller, new object[] { source, target }) as string;

			Assert.IsFalse(string.IsNullOrWhiteSpace(firstKey));
			Assert.IsFalse(string.IsNullOrWhiteSpace(secondKey));
			Assert.AreNotEqual(firstKey, secondKey, "Moved equation positions should count as distinct first-exposure guidance windows.");
		}
		finally
		{
			Object.DestroyImmediate(sourceGo);
			Object.DestroyImmediate(targetGo);
			Object.DestroyImmediate(go);
		}
	}

	private static RuntimeConfigSnapshot CaptureRuntimeConfig()
	{
		return new RuntimeConfigSnapshot
		{
			schoolYear = AlgebraRuntimeConfig.CurrentSchoolYear,
			allowDecimals = AlgebraRuntimeConfig.AllowDecimals,
			allowFractions = AlgebraRuntimeConfig.AllowFractions,
			enableSubstitution = AlgebraRuntimeConfig.EnableSubstitution,
			allowBrackets = AlgebraRuntimeConfig.AllowBrackets,
			allowVariablesOnBothSides = AlgebraRuntimeConfig.AllowVariablesOnBothSides,
			maxAbsCoefficient = AlgebraRuntimeConfig.MaxAbsCoefficient,
			maxAbsConstantNumerator = AlgebraRuntimeConfig.MaxAbsConstantNumerator,
			maxAbsConstantDenominator = AlgebraRuntimeConfig.MaxAbsConstantDenominator
		};
	}

	private static void RestoreRuntimeConfig(RuntimeConfigSnapshot state)
	{
		AlgebraRuntimeConfig.SetSchoolYear(state.schoolYear);
		AlgebraRuntimeConfig.SetEquationToggles(state.allowDecimals, state.allowFractions, state.enableSubstitution);
		AlgebraRuntimeConfig.SetEquationConstraints(
			state.allowBrackets,
			state.allowVariablesOnBothSides,
			state.maxAbsCoefficient,
			state.maxAbsConstantNumerator,
			state.maxAbsConstantDenominator);
	}

	private static void ValidateEquationForLevel(string levelName, EquationDataSet.SchoolYear schoolYear, string label, string rawEquation)
	{
		string normalized = EquationStringUtil.NormalizeForParsing(rawEquation ?? string.Empty);
		Assert.IsFalse(
			string.IsNullOrWhiteSpace(normalized),
			$"{levelName}/{schoolYear}/{label} is blank or normalizes to an empty equation.");

		if (TryGetLowQualityReason(normalized, out string lowQualityReason))
		{
			Assert.Fail($"{levelName}/{schoolYear}/{label} has low-quality formatting: {lowQualityReason}. Raw: '{rawEquation}'.");
		}

		bool parsed = LinearEquationParser.TryParse(
			normalized,
			AlgebraRuntimeConfig.AllowDecimals,
			AlgebraRuntimeConfig.AllowFractions,
			AlgebraRuntimeConfig.EnableSubstitution,
			out LinearEquationParser.ParsedEquation equation);

		Assert.IsTrue(
			parsed,
			$"{levelName}/{schoolYear}/{label} failed to parse under that year's runtime toggles. Raw: '{rawEquation}'.");

		Assert.IsTrue(
			EquationPolicy.IsEquationAllowed(equation),
			$"{levelName}/{schoolYear}/{label} parsed but violates that year's runtime policy. Raw: '{rawEquation}'.");
	}

	private static bool TryGetLowQualityReason(string normalizedEquation, out string reason)
	{
		string[] malformedOperatorPatterns = { "+-", "-+", "++", "--" };
		for (int i = 0; i < malformedOperatorPatterns.Length; i++)
		{
			if (normalizedEquation.Contains(malformedOperatorPatterns[i]))
			{
				reason = $"contains consecutive operator tokens '{malformedOperatorPatterns[i]}'";
				return true;
			}
		}

		MatchCollection fractions = Regex.Matches(normalizedEquation, @"(?<![A-Za-z])(-?\d+)/(\d+)");
		for (int i = 0; i < fractions.Count; i++)
		{
			Match match = fractions[i];
			if (!int.TryParse(match.Groups[1].Value, out int numerator) ||
				!int.TryParse(match.Groups[2].Value, out int denominator))
			{
				continue;
			}

			if (denominator == 0)
			{
				reason = $"contains zero denominator fraction '{match.Value}'";
				return true;
			}

			if (GreatestCommonDivisor(numerator, denominator) > 1)
			{
				reason = $"contains reducible fraction '{match.Value}'";
				return true;
			}
		}

		if (Regex.IsMatch(normalizedEquation, @"(^|[=+\-(])1x($|[=+\-)])"))
		{
			reason = "contains explicit '1x' coefficient; prefer 'x'";
			return true;
		}

		if (Regex.IsMatch(normalizedEquation, @"(^|[=+\-(])-1x($|[=+\-)])"))
		{
			reason = "contains explicit '-1x' coefficient; prefer '-x'";
			return true;
		}

		reason = null;
		return false;
	}

	private static int GreatestCommonDivisor(int a, int b)
	{
		a = Mathf.Abs(a);
		b = Mathf.Abs(b);

		while (b != 0)
		{
			int remainder = a % b;
			a = b;
			b = remainder;
		}

		return a == 0 ? 1 : a;
	}
}
