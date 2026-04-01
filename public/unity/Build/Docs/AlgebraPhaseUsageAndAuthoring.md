# Algebra Phase Usage and Authoring Guide

Date: 2026-02-13

## What This System Does

The roadmap work added four practical layers on top of your existing algebra rhythm loop:

1. Curriculum integrity (Phase 1)
- Guarantees Year 5-12 equation coverage and validation.
- Prevents bad equations from reaching runtime.

2. Adaptive + mastery loop (Phases 2-3)
- Tracks player performance by skill.
- Adjusts difficulty at equation boundaries.
- Tracks mastery and updates skill progression.

3. Rhythm clarity coaching (Phase 4)
- Detects miss patterns (`early`, `late`, `off-path`, `invalid`).
- Escalates hints when the same error repeats.
- Enters calm mode after repeated misses.

4. Creative expansion hooks (Phase 6)
- Activates skill-based sequence packs.
- Fires boss cue events.
- Drives music intensity and optional boss cue audio.

## What Player Interacts With

In play, the user-facing loop is:

1. Solve flow:
- `Decision -> Tagging -> Execution -> Commit`.

2. Mastery ribbon HUD:
- Shows each algebra skill as `locked`, `in progress`, or `mastered`.
- Highlights currently active skill.

3. Coaching feedback:
- If misses repeat, hints escalate:
  - first hint: simple correction
  - second hint: stronger directional cue
  - third hint: explicit timing/operation cue
- After sustained misses, calm mode reduces clutter and focuses guidance.

4. Creative phase moments:
- Active skill can switch sequence pack state.
- Boss encounter cue triggers special guidance + optional audio pulse.

## Unity Menu Actions and When to Use Them

`Tools/ULTRARAPID/Algebra`

1. `Run Phase 1 Pipeline (Seed + Validate + Report)`
- Use when equation content changes.
- Seeds curriculum, validates, writes report JSON.

2. `Validate EquationDataSet`
- Quick validator run without reseeding.

3. `Write Curriculum Coverage Report`
- Generates a report snapshot for QA.

4. `Validate Project Dependencies`
- Checks package/plugin/type availability before tests.

5. `Run Phase 5 Preflight (Dependency + Gates)`
- Runs dependency checks + test-gate checks and writes preflight JSON.

6. `Setup Required Phase Assets (Flags + Tuning + Creative)`
- Creates required `Resources` assets if missing:
  - `AlgebraFeatureFlags.asset`
  - `RhythmClarityTuningProfile.asset`
  - `CreativeExpansionContentProfile.asset`

7. `Enable All Phase Flags (Dev)`
- Enables all main rollout flags for dev playtests.

## What You Need To Author For Phase 6

Phase 6 is now code-integrated, but content still needs authoring.

Author these:

1. Creative content profile
- Asset: `Assets/Resources/CreativeExpansionContentProfile.asset`
- Fill:
  - `skillPacks`: mapping from skill tags to pack keys + intensity bias
  - `bossCues`: cue ids, coaching messages, and optional audio clips

2. Scene bindings
- Add `CreativeExpansionSceneBinder` to your gameplay scene.
- For each `packKey`, map:
  - `activateWhenSelected`: objects/VFX to turn on
  - `deactivateWhenSelected`: objects/VFX to turn off

3. Boss cue audio
- On `CreativeExpansionAudioBridge`, assign `bossCueSource`.
- Put clips in `CreativeExpansionContentProfile.bossCues[*].cueClip`.

4. Optional coach text tuning
- Edit `bossCues[*].coachMessage` for the tone you want in boss moments.

## Recommended Run Order (To Finish Integration)

1. Run `Setup Required Phase Assets (Flags + Tuning + Creative)`.
2. Run `Enable All Phase Flags (Dev)` for integration testing.
3. Run `Validate Project Dependencies`.
4. Run `Run Phase 5 Preflight (Dependency + Gates)`.
5. Run `Run Phase 1 Pipeline (Seed + Validate + Report)`.
6. Run EditMode and PlayMode tests.
7. Do a per-year play pass (Year5-Year12) and verify:
- no fallback warnings
- mastery ribbon updates correctly
- miss coaching escalates correctly
- boss cues and pack bindings trigger as expected
