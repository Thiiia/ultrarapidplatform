# Algebra Gameplay Optimization and Evolution Roadmap

Date: 2026-02-12

## 0) Implementation Checkpoint (Current Branch)

Completed in this pass:
- Phase 0 foundation implemented:
  - `AlgebraSessionMetrics` added and wired to decision/tagging/execution/drag/hint streams.
  - Per-equation records + session summary JSON output to `Application.persistentDataPath/algebra_metrics/`.
- Phase 1 data model + tooling implemented:
  - `EquationEntry` + `EquationSkillTag` added.
  - `EquationDataSet` now supports metadata entries with backward-compatible legacy string fallback.
  - Editor validator/migration utility added at `Tools/ULTRARAPID/Algebra/*`.
- Phase 2 adaptive engine baseline implemented:
  - `PlayerPerformanceModel` and `AdaptiveDifficultyController` added.
  - Equation-boundary adaptation with hard clamps for windows, drags-per-step, and wisp overlap thresholds.
  - Adaptation decisions are logged with trigger metrics.
- Phase 3 progression baseline implemented:
  - `EquationProgressionPhaseBridge` now queues `EquationEntry` payloads (legacy compatible).
  - Skill interleaving, spaced retrieval (+2/+5), and mastery tracking logic added.
  - Mastery state transitions are logged.
- Phase 1 execution tooling started:
  - Added curriculum seeder tool to generate Year 5–12 equation entries/counts:
    - `Tools/ULTRARAPID/Algebra/Seed Year 5-12 Curriculum Bank`
    - `Assets/_Scripts/Editor/Algebra/EquationDataSetCurriculumSeeder.cs`
  - Added overflow continuity handoff:
    - `Docs/AlgebraContextOverflowHandoff.md`
- Phase 1 validator hardening:
  - `EquationDataSetValidator` now enforces Year 6/7 pedagogy constraints as fatal checks
    (Year 6 no negatives/fractions/decimals and <=99 values, Year 7 non-negative solutions).
- Phase 5 test hardening started:
  - Added EditMode test assembly and algebra core tests:
    - `Assets/_Scripts/Tests/EditMode/Algebra/Algebra.EditMode.Tests.asmdef`
    - `Assets/_Scripts/Tests/EditMode/Algebra/AlgebraCoreEditModeTests.cs`
  - Covers parser toggles, policy bounds, optimal-option guarantee, and state transforms.
- Phase 5 PlayMode smoke coverage added:
  - `Assets/_Scripts/Tests/PlayMode/Algebra/Algebra.PlayMode.Tests.asmdef`
  - `Assets/_Scripts/Tests/PlayMode/Algebra/AlgebraPhasePlayModeSmokeTests.cs`
  - Covers full phase loop progression, timeout/failure behavior, and tutorial lock/gating checks.
- Phase 5 profiling prep docs added:
  - `Docs/AlgebraPhase5StressChecklist.md`
- Design evolution notes (code-aware) added:
  - `Docs/AlgebraDesignEvolutionNotes.md`
- Phase 3 UX implementation added:
  - Skill mastery ribbon HUD:
    - `Assets/_Scripts/UI/PhaseZero/SkillMasteryRibbonHUD.cs`
    - `EquationProgressionPhaseBridge` now exposes mastery-state query/event for UI binding.
- Phase 4 baseline implementation added:
  - Rhythm clarity controller:
    - `Assets/_Scripts/Core/Algebra/RhythmClarityController.cs`
  - Standardized miss-bucket coaching (`early`, `late`, `off-path`, `invalid operation`) and calm-mode trigger/recovery.
  - `CoachHUD` now supports external coaching hints + clarity focus mode.
  - `DragExecutionController` now supports runtime calm-mode visual declutter toggles.
- Phase 6 baseline hooks added:
  - Creative expansion track controller:
    - `Assets/_Scripts/Core/Algebra/CreativeExpansionTrackController.cs`
  - Feature-flagged hooks for skill sequence packs, boss encounter cadence, and dynamic intensity signals.
- Phase 1 one-click execution pipeline added:
  - `Assets/_Scripts/Editor/Algebra/AlgebraCurriculumPipelineRunner.cs`
  - New menu command:
    - `Tools/ULTRARAPID/Algebra/Run Phase 1 Pipeline (Seed + Validate + Report)`
  - Outputs JSON coverage report to `Temp/algebra_curriculum_report_*.json`.
- Phase 5 pooling/perf pass added for transient confirmation FX:
  - `DecisionWheelUI` confirm-dot FX now uses pooled runtime dots.
  - `TaggingHighwayPreview` preview ghost now reuses a persistent runtime object.
- Phase 4 judgement alignment pass added:
  - `ExecutionTimingGate` now aligns Perfect/Good/Miss timing windows to `JudgementService` windows (bounded by a max miss window clamp).
  - Optional BPM judgement clamp flag added via `AlgebraFeatureFlags.enableBpmJudgementClamp`.
- Phase 6 audio hook wiring added:
  - `Assets/_Scripts/Core/Algebra/CreativeExpansionAudioBridge.cs`
  - Dynamic intensity + boss encounter signals now drive bounded music-volume modulation when creative track flag is enabled.
- Phase 4 tuning workflow hardened:
  - `Assets/_Scripts/Core/Algebra/RhythmClarityTuningProfile.cs`
  - `RhythmClarityController` now supports profile-driven tuning and a 3-level hint ladder escalation.
- Phase 6 authored-content integration path added:
  - `Assets/_Scripts/Core/Algebra/CreativeExpansionContentProfile.cs`
  - `Assets/_Scripts/Core/Algebra/CreativeExpansionSceneBinder.cs`
  - `CreativeExpansionTrackController` now emits resolved pack/cue payloads from profile data.
  - `CreativeExpansionAudioBridge` now supports pack intensity bias + boss cue clip pulses.
- Phase 5 preflight automation added:
  - `Assets/_Scripts/Editor/Algebra/AlgebraProjectDependencyValidator.cs`
  - `Assets/_Scripts/Editor/Algebra/AlgebraPhase5VerificationRunner.cs`
  - `Assets/_Scripts/Editor/Algebra/AlgebraPhaseAssetSetupUtility.cs`
  - New menu commands:
    - `Tools/ULTRARAPID/Algebra/Validate Project Dependencies`
    - `Tools/ULTRARAPID/Algebra/Run Phase 5 Preflight (Dependency + Gates)`
    - `Tools/ULTRARAPID/Algebra/Setup Required Phase Assets (Flags + Tuning + Creative)`
    - `Tools/ULTRARAPID/Algebra/Enable All Phase Flags (Dev)`
- Usage and authoring guide added:
  - `Docs/AlgebraPhaseUsageAndAuthoring.md`

Remaining to ship-quality after 2026-02-13 pipeline pass:
- Phase 1 finalization completed on 2026-02-13 (seed + validate + report all green for Year 5-12 coverage).
- Phase 5 remaining items: run/green all PlayMode tests in Unity, execute stress checklist, and capture profiler traces.
- Phase 4 remaining items: run playtest tuning passes with `RhythmClarityTuningProfile` assets and finalize thresholds/copy.
- Phase 6 remaining items: author concrete profile assets + scene bindings (pack visuals, boss cue clips/messages) and validate against baseline KPI.

Next prompt starting point:
- Resume from **Phase 5 verification** (tests + stress profiling), then continue **Phase 4 playtest tuning** and **Phase 6 authored content integration**.

Suggested next-step design mechanics + UX adjustments:
- Add adaptive hint-ladder escalation (semantic -> token highlight -> explicit formatting cue) based on repeated same-pattern mistakes.
- Add a compact skill heat-map strip (recent fail pressure per skill) so “what to practice now” is always visible.
- Add phrase-end recap card (2-3 seconds): best streak quality, most-missed skill, suggested next focus.
- Use boss-encounter events to launch 2-3 equation mini-sequences that intentionally mix one weak skill and one stable skill.
- Bind creative sequence packs and intensity events to authored VFX/audio assets, not just debug logs.

## 1) Current Snapshot (What You Have Been Building)

Recent work is strongly focused on:
- Wisp/timing/guidance depth and visual feedback tuning.
- Step-repetition and per-drag performance feedback.
- Tutorial gating and prevention of tutorial/gameplay overlap.
- Phase-driven gameplay loop wiring (Decision -> Tagging -> Execution -> Commit).

Evidence in repo:
- `Assets/_Scripts/Core/Algebra/DragExecutionController.cs`
- `Assets/_Scripts/Core/Algebra/DragExecutionController.Drag.cs`
- `Assets/_Scripts/Core/Algebra/DragExecutionController.Wisp.cs`
- `Assets/_Scripts/Core/Tutorial/EquationTutorialController.cs`
- `Assets/_Scripts/PhaseZero/GamePhaseController.cs`
- Recent commits on 2026-02-10 through 2026-02-12 (wisp/timing/tutorial merge sequence).

## 2) Non-Drift Anchors (Core Requirements)

Treat these as hard constraints so the project can expand without losing core quality:

1. Every rhythm action must map to a valid algebraic transformation.
2. Learning clarity beats visual complexity when they conflict.
3. Adaptation must be bounded (never silently become too easy/hard).
4. Difficulty progression must be data-driven, not hardcoded scene-by-scene.
5. A failed input should provide an actionable next move, not only a punishment.
6. Performance budget must hold on target devices before adding new visual complexity.

## 3) Main Gaps Identified

1. Curriculum/data mismatch:
- Runtime defaults are Year 5-12, but `Assets/Resources/EquationDataSet.asset` currently contains Year 6-8 content only.

2. Limited learning telemetry:
- You track score/streak/judgements, but not enough skill-level metrics for adaptive pedagogy.

3. Adaptivity is mostly timing/feel, not full pedagogy:
- Strong wisp adaptation exists, but operation-level mastery progression is still shallow.

4. No automated tests for algebra correctness:
- Parser/policy/option-generation regressions are currently manual-risk.

## 4) Multi-Step Implementation Plan

### Phase 0 - Baseline Instrumentation (2-3 days)

Goal:
- Capture objective quality metrics before tuning further.

Implementation:
- Add a lightweight session telemetry component (new `AlgebraSessionMetrics` service).
- Hook events from:
  - `GamePhaseController` (phase transitions, timeouts)
  - `EquationChoicePhaseBridge` + `EquationChoiceSystem` (optimal vs non-optimal decisions)
  - `TaggingHighwayPreview` (tag correctness)
  - `ExecutionTimingGate` and/or `DragExecutionController` (signed timing errors, hit quality)
- Emit per-equation summary:
  - solve time
  - decisions taken
  - hint exposures
  - miss clusters (early/late/path miss)
- Save to JSON in persistent data path for playtest analysis.

Acceptance gates:
- 100% of solved equations produce a metrics record.
- You can compare two playtest runs with a simple script/table.

### Phase 1 - Curriculum and Equation Bank Integrity (3-5 days)

Goal:
- Align content with your intended Year 5-12 runtime design.

Implementation:
- Expand `EquationDataSet` to full Year 5-12 coverage.
- Add metadata model per equation (new struct/class):
  - `skillTag` (move constant, move variable, divide coefficient, expand, substitution)
  - `estimatedSteps`
  - `complexityScore`
- Add editor validation tool:
  - parseability check (`LinearEquationParser`)
  - policy check (`EquationPolicy`)
  - year-bound check (`AlgebraRuntimeConfig`)
- Update `Docs/AlgebraEquationDifficulty.md` to reflect actual content coverage.

Acceptance gates:
- No year falls back unexpectedly during normal progression.
- Validator passes for all equations.

### Phase 2 - Adaptive Difficulty Engine (4-6 days)

Goal:
- Move from static tuning to controlled, player-specific adaptation.

Implementation:
- Introduce `PlayerPerformanceModel` (rolling window over last N equations):
  - decision optimal rate
  - tagging accuracy
  - timing consistency (stddev of signed error)
  - path adherence/guide completion
- Use model to tune bounded knobs:
  - `dragsPerStep`
  - decision/tagging/execution beat windows
  - overlap thresholds (`wispOverlapResultGoodMin`, `wispOverlapResultPerfectMin`)
  - contextual guidance thresholds
- Keep strict min/max rails so behavior is predictable and debuggable.

Acceptance gates:
- Adaptation decisions are logged and explainable.
- Players with repeated misses receive measurable assist increase within 1-2 equations.
- High-performing players receive tighter challenge without sudden spikes.

### Phase 3 - Pedagogical Loop Upgrade (5-7 days)

Goal:
- Make progression maximize retention, not just completion.

Implementation:
- Add spaced retrieval queue in `EquationProgressionPhaseBridge`:
  - recently failed skill tags reappear later with spacing intervals.
- Add interleaving rules:
  - alternate operation classes instead of long single-skill streaks.
- Define mastery rule:
  - e.g., 3 successful executions of a skill across spaced attempts before promotion.
- Add hint ladder system:
  - Level 1: semantic hint
  - Level 2: target token highlight
  - Level 3: explicit transformation format

Acceptance gates:
- Fewer repeated same-mistake failures over a session.
- Mastery transitions are traceable by skill tag.

### Phase 4 - Rhythm Feel and Cognitive Clarity Tuning (3-4 days)

Goal:
- Keep rhythm satisfaction high while preserving conceptual clarity.

Implementation:
- Align judgement windows with BPM/clamp strategy in `JudgementService`.
- Calibrate drag release messaging to root cause buckets:
  - early/late
  - off-path
  - invalid operation
- Simplify visual load in high error states:
  - reduce non-essential effects after consecutive misses
  - prioritize coach text and equation highlights

Acceptance gates:
- Miss reason classification is accurate in logs.
- Lower cognitive overload reports in playtest feedback.

### Phase 5 - Performance and Stability Hardening (3-5 days)

Goal:
- Ensure stable gameplay under full effects load.

Implementation:
- Profile hotspots with Unity Profiler/Recorder for target hardware.
- Reduce runtime object discovery in hot paths (cache where repeated in active windows).
- Expand pooling for short-lived UI effects (rails, confirm dots, transient visuals).
- Add automated tests:
  - EditMode: parser + equation policy + option generation
  - PlayMode: phase loop smoke tests (decision->tagging->execution->commit)

Acceptance gates:
- Stable frame budget target met under stress scene.
- Core algebra logic test suite passes in CI/local runs.

### Phase 6 - Creative Expansion Track (parallel after Phase 2)

Goal:
- Push identity and novelty without destabilizing core loop.

Candidates:
- Skill-themed songs/sections (e.g., "distribute" chorus, "substitute" bridge).
- "Boss equations" with multi-phrase staged solving.
- Dual-lane cooperative mode (one player picks operation, one executes rhythm).
- Dynamic stem mixing based on streak quality.

Constraint:
- Ship behind feature flags and only after Phase 0-2 metrics are in place.

## 5) Milestone Sequence (Recommended)

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 5
6. Phase 4 (polish pass can run in parallel with late Phase 5)
7. Phase 6

## 6) KPI Set (Use from Phase 0 onward)

Primary:
- Equation solve rate per session
- Median time-to-solve per equation
- Optimal decision rate
- Tagging accuracy
- Execution perfect/good/miss distribution
- Repeated mistake recurrence rate by skill tag

Secondary:
- Hint usage rate
- Early vs late miss ratio
- Path completion ratio
- Rage-quit / restart frequency on algebra scene

## 7) Research-Informed Design Principles Used

- Retrieval practice improves long-term retention over restudy.
- Spacing and interleaving improve transfer and durable learning.
- Educational/serious games show positive effects when feedback and adaptation are well designed.
- Accessibility and UDL principles improve reach and outcomes.

References:
- Karpicke & Roediger (2008), retrieval practice: https://pubmed.ncbi.nlm.nih.gov/18426295/
- Cepeda et al. (2006), spacing effect meta-analysis: https://pubmed.ncbi.nlm.nih.gov/19076480/
- Rohrer & Taylor (2007), interleaving math practice: https://pubmed.ncbi.nlm.nih.gov/17723068/
- Abdul Jabbar & Felicia (2015), serious games and learning meta-analysis: https://link.springer.com/article/10.1007/s10758-013-9206-3
- Tao et al. (2021), immediate vs delayed feedback in serious games: https://pubmed.ncbi.nlm.nih.gov/33497049/
- Andrade et al. (2013), adaptive game balancing and learning: https://www.sciencedirect.com/science/article/pii/S0360131512003000
- CAST UDL Guidelines 3.0: https://udlguidelines.cast.org/
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/
