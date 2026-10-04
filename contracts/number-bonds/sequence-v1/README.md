# Number Bonds sequence extension v1

The base authored lesson envelope remains version 3. Existing Number Bonds revisions without `numberBondSequenceVersion` keep the legacy Hit-only adapter.

A v1 lesson adds two root fields:

- `numberBondSequenceVersion: 1`
- `numberBondGems: []`

Each gem record carries a unique `gemId`, a zero-based `unitIndex`, `spinEncounterId`, `dragEncounterId`, and `destination: { part, slotIndex }`. The existing v3 Drag target's `sourceHitId` links that Drag to its Hit. The extension does not repeat that stable v3 relationship.

The v3 `equations` and `encounters` remain authoritative for equation and target token IDs, pads, mechanic timing, and encounter identity. The sequence extension adds only the stable physical gem identity/order, the Spin and Drag links, and the destination slot that v3 cannot express.

`part` is `part-a` or `part-b`; `slotIndex` is zero-based within the part. One gem occupies one unit slot. The extension supports whole-first or parts-first integer equations from 2 through 20, creates one gem per whole unit, and derives each destination from the equation's two part values. The canonical fixture remains `5 = 2 + 3`; larger bonds use the same unit-gem interaction and do not invent grouped gems.

`fixtures.json` stores the canonical valid lesson plus named malformed mutations. The mutations derive invalid inputs from the canonical lesson without maintaining fifteen near-identical copies. `testTempoMap` is fixture metadata only: one tick per beat at 60 BPM makes one tick equal one second for deterministic timing checks. It is not part of the authored lesson payload.
