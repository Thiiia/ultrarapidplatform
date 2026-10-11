# Early Algebra content remake candidates

**Status:** local draft package only. These files have not been uploaded to Supabase or published. Existing READY revisions remain untouched.

## Why the remake

The current eight hosted Early Algebra revisions each contain six equations, but their ids and states come from Year 7–9 material. Live examples include coefficients, variables on both sides, negative terms, multiple operations, and quadratics. The DfE Key Stage 2 programme starts algebra with simple formulae and missing-number problems in familiar situations; formal linear-equation manipulation including rearrangement is a Key Stage 3 objective. [DfE mathematics programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study)

## Content rules

The candidates use existing Year 6 bank ids and six one-step equations per song. Every value and answer is positive and at most 9. There are no coefficients, brackets, fractions, decimals, negative values, variables on both sides, or quadratics.

Each song varies the small-number examples while retaining a gradual path through adding a small amount, subtracting a small amount, and applying the same balance idea again. Rhythm difficulty remains separate from equation difficulty.

## Encounter rules

The candidates keep each source encounter id, event id, chart tick, hit-pad assignment, and drag-to-hit link. They relink all six equation groups to Year 6 ids and retarget hit, spin, and drag cues to the small constant being undone. This preserves the known music timing while making the mathematical target consistent through each cue and action.

The sidecars omit `authorId` and `revision` so a candidate cannot be mistaken for a published identity. The manifest records the exact READY source revision for each candidate.

## Validation performed

All eight JSON files parse. Each has six distinct Year 6 equations; solutions were checked by substitution; all event equation ids and token targets resolve; all drag source-hit links point to an earlier hit; and every cue id and tick matches its source revision.

This is static content validation, not Unity playtesting. Before publishing, verify calibration, first-cue readability, equation changes, missed-drag recovery, results, and cue alignment across songs and chart difficulties. The Platform save route also updates the authoring `SongChart` pointer when creating a draft, so save through the intended author account only after reviewing the source revision and expected pointer change.

