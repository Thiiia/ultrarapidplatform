# Algebra Phase 5 Stress and Profiling Checklist

Date: 2026-02-12

Use this checklist when validating performance/stability changes in Algebra mode.

## Preflight

Run these first in Unity Editor:
- `Tools/ULTRARAPID/Algebra/Validate Project Dependencies`
- `Tools/ULTRARAPID/Algebra/Run Phase 5 Preflight (Dependency + Gates)`

Archive the generated preflight JSON report from `Temp/algebra_phase5_preflight_*.json` with your profiler captures.

## Scope

- Scene loop: `Decision -> Tagging -> Execution -> Commit -> Wait`
- Core systems enabled: `EquationProgressionPhaseBridge`, `DragExecutionController`, `ExecutionTimingGate`, `AlgebraSessionMetrics`
- Optional systems toggled separately via `AlgebraFeatureFlags`

## Target budgets

- Framerate:
  - Desktop target: 60 FPS median under stress
  - No sustained drops below 54 FPS for more than 2 seconds
- Frame time:
  - Median <= 16.7 ms
  - 95th percentile <= 22 ms
- GC alloc:
  - Near-zero per-frame alloc during active gameplay windows
  - No recurring spikes > 1 MB during continuous phrase flow

## Test matrix

1. Baseline core loop:
- Feature flags all off
- Metrics off, adaptive off, mastery off

2. Telemetry stress:
- `EnableSessionMetrics = true`
- Play 5+ continuous minutes, frequent successes/failures

3. Adaptation stress:
- `EnableAdaptiveDifficulty = true`
- Force repeated misses then high-streak performance

4. Full pedagogy stack:
- `EnableSessionMetrics = true`
- `EnableAdaptiveDifficulty = true`
- `EnableMasteryProgression = true`

5. Visual stress:
- Dense chart + all standard FX on + high miss rate (to trigger guidance/hints)

## Capture procedure

1. Open Unity Profiler (CPU, Memory, Rendering, UI).
2. Start deep profile OFF (normal mode first).
3. Record 2-3 minutes per matrix scenario.
4. Mark timestamps when:
- phrase boundaries fire,
- adaptation decisions log,
- repeated miss coaching triggers,
- equation transitions occur.

## Hot path watchlist

- `DragExecutionController`:
  - drag update loops, trail/wisp updates, contextual hint pathways
- `GamePhaseController`:
  - beat/window progression dispatch
- `EquationChoiceSystem`:
  - option generation frequency
- `AlgebraSessionMetrics`:
  - event fan-in and JSON flush timing

## Pass/fail gates

Pass if all are true:
- No null-ref/exception spam in Console across matrix.
- No new alloc spikes attributable to telemetry/adaptation during active windows.
- Phase transitions remain deterministic at phrase boundaries.
- Gameplay remains responsive after chart restart and scene reload.

Fail if any are true:
- Missed phrase boundaries under load.
- Input latency spikes correlated with telemetry writes.
- Progressive FPS degradation during a single session.
- Tutorial-gated scenes accidentally initialize progression systems.

## Follow-up actions when failing

1. Capture profiler snapshot and frame markers.
2. Record scenario + exact feature flag state.
3. Identify top 3 scripts by CPU/GC cost.
4. Apply targeted fix, then rerun only affected matrix scenarios.
