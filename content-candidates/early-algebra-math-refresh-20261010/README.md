# Early Algebra math refresh candidates — 10 October 2026

These eight sidecars are local review candidates generated from the latest hosted READY revisions with `refreshEarlyAlgebraEquationContent` in math-only mode. The published charts and audio are unchanged; candidate encounter IDs, event IDs, cue ticks, pad assignments, and event counts remain tied to their source revisions.

| Song | Source revision | Candidate equations | Hits | Spins | Drags |
| --- | --- | ---: | ---: | ---: | ---: |
| Garden | `eb171cbc-fb04-44ce-a1d0-0e3b66d80cbe` | 9 | 20 | 3 | 9 |
| GEMINI QUEEN | `35d7c908-8d24-435f-8063-bb6b2281fd12` | 8 | 26 | 4 | 8 |
| grudge | `62bed83e-2e57-4c6c-9be0-b259bec21653` | 10 | 17 | 2 | 10 |
| jazz in the maybach | `b346a2c3-c8ad-4395-8397-ef0dc55e218a` | 9 | 21 | 2 | 8 |
| just because | `dc33a284-c050-477c-a749-282ff95946da` | 9 | 20 | 2 | 9 |
| one & one | `b44f2b55-bb10-43eb-9576-4e2df8a551df` | 9 | 21 | 2 | 9 |
| Seven | `c3f14f88-dd94-45fb-a997-2791015cb874` | 11 | 17 | 3 | 11 |
| Waves | `d8fb4994-43b0-40f4-ac3a-cc334c2bfcfa` | 13 | 27 | 5 | 13 |

The existing refresh produces one inverse addition or subtraction per Drag row, with positive whole-number solutions and literals no greater than 10. The dry run found no quadratics. The migration test group passed 10/10 tests, and the dry run prepared and validated all eight sidecars.

## Review notes

- The source revisions each had six equation rows; the candidate equation counts follow the actual Drag schedule. Garden and Waves therefore have nine and thirteen rows respectively. Review the pacing and visual equation changes in Unity before using these with learners.
- Jazz retains a cue-only row `Year7_002_moveconstant` (`x - 2 = 5`) with seven Hit cues and no Drag. The refresh preserves this in-range row and its targets. Confirm its intended instructional role before accepting the candidate.
- These files are not saved Platform drafts and are not published. A same-origin save attempt from the current browser session returned `401 Authentication required`; no lesson content was written. Save reviewed candidates through the authenticated `POST /api/lesson-builder/save` draft flow only.

## Candidate files

`garden.json`, `geminiqueen.json`, `grudge.json`, `jazzmaybach.json`, `justbecause.json`, `oneone.json`, `seven.json`, and `waves.json`.
