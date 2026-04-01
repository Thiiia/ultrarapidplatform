# Algebra Equation Difficulty (Year 5–12)

This document is the curriculum-facing difficulty guide for the equation bank.

## Implementation levers

1. `EquationDataSet` content:
- `Assets/Resources/EquationDataSet.asset`
- Uses both legacy `equations` strings and metadata `entries` (`EquationEntry`)

2. Runtime constraints:
- `Assets/_Scripts/Core/Algebra/AlgebraRuntimeConfig.cs`
- `SetSchoolYear(...)` + `ApplyDefaultsForYear(...)`

3. Safety/policy filters:
- `Assets/_Scripts/Core/Algebra/EquationPolicy.cs`
- `Assets/_Scripts/PhaseZero/EquationProgressionPhaseBridge.cs`
- `Assets/_Scripts/Core/Algebra/EquationChoiceSystem.cs`

4. Validation + seeding tools:
- `Tools/ULTRARAPID/Algebra/Validate EquationDataSet`
- `Tools/ULTRARAPID/Algebra/Migrate Legacy Equations To Entries`
- `Tools/ULTRARAPID/Algebra/Seed Year 5-12 Curriculum Bank`

## Year 6 guidance

Note:
- No negatives, fractions, or decimals in equations.
- Numbers stay small (do not exceed 99).

Easy:
- One-step whole-number equations.
- Examples: `x + 4 = 9`, `x - 1 = 2`, `3x = 12`

Medium:
- Two-step whole-number equations.
- Examples: `2x + 4 = 6`, `3x - 5 = 16`

Difficult:
- Word/diagram-to-equation style (represented in-game as equivalent linear equations or tagged boss prompts).
- Example prompt: perimeter/side-length context translated to a linear equation.

## Year 7 guidance

Note:
- Students still do not solve to negative answers.

Easy:
- Two-step whole-number equations.
- Examples: `2x + 4 = 6`, `x + 2 = 5`

Medium:
- One-step equations that can scale in size.
- Examples: `2x = 134`, `9x = 63`

Difficult:
- Two-step equations with larger constants and mild structural variation.
- Examples: `7x + 12 = 68`, `4x - 9 = 35`

## Year 8 guidance

Note:
- Introduce negative values and distribution.
- Equations may be solvable with different valid paths.

Easy:
- Two-step equations with higher arithmetic load.
- Examples: `5x + 14 = 64`, `8x - 19 = 45`

Medium:
- Negative coefficients/constants and distribution.
- Examples: `2(x + 3) = 14`, `3x + 4 = -2`, `-3x + 4 = 10`

Difficult:
- Multi-structure prompts, including bracket expansion and richer contexts.
- Examples: `4(x - 2) + 6 = 2x + 20`, `h - 1/4 = 3` (when fractions are enabled for the target year profile)

## Year 9 guidance

Easy:
- Variable-on-both-sides equations with integer coefficients.
- Examples: `5x + 7 = 2x + 31`, `9x - 4 = 3x + 26`

Medium:
- Fraction constants and mixed multi-step equations.
- Examples: `x + 3/4 = 19/4`, `4x + 1/2 = 25/2`

Difficult:
- Brackets + both-sides movement + signed constants.
- Examples: `6(x - 3) = 2x + 10`, `-8x + 15 = -3x - 20`

## Year 10–12 progression intent

Year 10:
- Decimal-constant equations and larger integer coefficients.

Year 11:
- Add substitution-form entries (`SUB:x=...; ...`) and denser multi-step mixes.

Year 12:
- Highest coefficient/constant bounds, mixed structures, and advanced pacing packs.

## Current runtime defaults (high-level)

- Year 5–7: no brackets, no variables on both sides, integer-only equation parsing
- Year 8: brackets + both sides enabled
- Year 9: fractions enabled
- Year 10+: decimals enabled
- Year 11–12: substitution enabled

If you want stricter/looser behavior, adjust `MaxAbs*` and `Allow*` values in `ApplyDefaultsForYear(...)`.

