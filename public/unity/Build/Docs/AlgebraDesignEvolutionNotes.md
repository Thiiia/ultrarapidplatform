# Algebra Design Evolution Notes (Codebase-Aware)

Date: 2026-02-12

This document proposes next design improvements based on the current implementation shape.

## Implemented already (this branch)

- Skill mastery ribbon HUD is live (`SkillMasteryRibbonHUD`).
- Miss-reason coach buckets and calm-mode controller are live (`RhythmClarityController` + `CoachHUD` hooks).
- Creative expansion runtime hooks are live (`CreativeExpansionTrackController` + `CreativeExpansionAudioBridge`).
- Execution timing gate now aligns to `JudgementService` windows (bounded).
- Rhythm clarity is now profile-driven (`RhythmClarityTuningProfile`) with 3-level hint ladder escalation.
- Creative authored-content path is now available (`CreativeExpansionContentProfile` + `CreativeExpansionSceneBinder`).

## Current architecture strengths

- `GamePhaseController` already centralizes deterministic phase flow.
- `EquationProgressionPhaseBridge` already supports entry-based progression, interleaving, spaced retrieval, and mastery tracking hooks.
- `DragExecutionController` already has high-quality timing/path telemetry surfaces and hint events.
- `AlgebraSessionMetrics` + `AdaptiveDifficultyController` already provide the closed-loop instrumentation layer.
- `AlgebraFeatureFlags` gives safe rollout control.

## Design mechanics to add next (codebase-aware)

1. Skill heat-map line (session-level)
- Goal: show where the learner is currently unstable, not just mastered vs not.
- Data source:
  - `PlayerPerformanceModel` snapshot + `AlgebraSessionMetrics`.
- UI model:
  - tiny horizontal bar of skill segments with color by recent fail pressure.
- Trigger:
  - update on each equation boundary only (avoid mid-execution noise).

2. Adaptive hint ladder escalation by repeated pattern
- Goal: move from generic miss copy to operation-aware coaching when repeats persist.
- Data source:
  - current miss buckets + `EquationSkillTag` + latest attempted operation id.
- Policy:
  - status: baseline implemented in `RhythmClarityController` + tuning profile:
    - after 2 repeats: semantic hint
    - after 3 repeats: stronger directive
    - after 4 repeats: explicit timing/operation cue
  - remaining: token-level visual highlight + micro-step formatting cue.

3. Phrase-end recap card (2-3s, opt-in)
- Goal: convert telemetry into learning intent without interrupting rhythm flow.
- Data source: rolling summary from `AlgebraSessionMetrics` plus current model snapshot.
- Card content:
  - best streak quality,
  - most-missed skill,
  - one suggested next action.
- Timing: show in `Wait` phase only, never during `Execution`.

4. Boss-equation phrase scripting
- Goal: make Phase 6 “boss encounter” signal mechanically meaningful.
- Data source:
  - `CreativeExpansionTrackController.BossEncounterTriggered`.
- Flow:
  - 2-3 equation mini-sequence with forced interleaving of one weak skill + one stable skill.
  - completion unlocks short celebratory sequence pack state.

## UX sequencing and guardrails

- Keep all new UX systems behind `AlgebraFeatureFlags`.
- Do not mutate core solve mechanics when flags are off.
- Prioritize `Execution` readability over decorative effects.
- Keep tutorial experience unchanged by default.

## Suggested implementation order

1. Adaptive hint ladder escalation (build on current miss buckets).
2. Phrase-end recap card.
3. Skill heat-map line.
4. Boss-equation phrase scripting + authored pack content.

## Metrics to verify impact

- Same-skill repeat-failure rate per session.
- Hint usage trend by skill tag.
- Average recovery time from 3-miss cluster.
- Equation completion rate under adaptive + UX assists.
